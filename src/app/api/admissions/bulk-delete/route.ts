import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { deleteStoredFile } from "@/lib/file-storage";

async function actor() {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, role: true, suspended: true, forcePasswordChange: true },
  });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one draft to delete."),
});

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  try {
    assertCan(user.role, "admissions", "delete");
  } catch {
    await db.auditEvent.create({
      data: { actorId: user.id, action: "ACCESS_DENIED", entity: "AdmissionDraftBulkDelete" },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bulkDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid draft selection." }, { status: 400 });
  }

  const { ids } = parsed.data;

  // Fetch all matching drafts that have status DRAFT
  const drafts = await db.admissionDraft.findMany({
    where: {
      id: { in: ids },
      status: "DRAFT",
    },
    include: { documents: true },
  });

  if (drafts.length === 0) {
    return NextResponse.json(
      { error: "No eligible draft admissions found to delete. Submitted or enrolled admissions cannot be deleted." },
      { status: 400 }
    );
  }

  // Delete all uploaded private files from storage
  for (const draft of drafts) {
    for (const doc of draft.documents) {
      try {
        await deleteStoredFile("private", doc.storageKey);
      } catch (e) {
        console.warn(`Failed to delete document ${doc.storageKey} from storage:`, e);
      }
    }
  }

  const targetIds = drafts.map((d) => d.id);
  const admissionNos = drafts.map((d) => d.admissionNo);

  await db.$transaction(async (tx) => {
    await tx.admissionDocument.deleteMany({
      where: { draftId: { in: targetIds } },
    });
    await tx.admissionDraft.deleteMany({
      where: { id: { in: targetIds } },
    });

    await tx.auditEvent.create({
      data: {
        actorId: user.id,
        action: "ADMISSION_DRAFTS_BULK_DELETED",
        entity: "AdmissionDraft",
        entityId: `${targetIds.length} drafts: ${admissionNos.join(", ")}`,
      },
    });
  });

  return NextResponse.json({
    success: true,
    count: drafts.length,
    admissionNos,
    message: `Successfully deleted ${drafts.length} draft admission(s).`,
  });
}
