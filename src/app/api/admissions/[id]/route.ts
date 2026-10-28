import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { assertCan, assertCanInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { deleteStoredFile } from "@/lib/file-storage";

async function actor() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, role: true, suspended: true, forcePasswordChange: true },
  });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  try {
    assertCanInScope(user.role, "admissions", "view", "school");
  } catch {
    await db.auditEvent.create({
      data: { actorId: user.id, action: "ACCESS_DENIED", entity: "AdmissionDraft" },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const draft = await db.admissionDraft.findUnique({
    where: { id },
    include: {
      documents: {
        select: {
          id: true,
          category: true,
          originalName: true,
          contentType: true,
          sizeBytes: true,
          createdAt: true,
        },
      },
      learner: {
        select: { id: true, name: true, grade: true, admissionStatus: true },
      },
    },
  });

  if (!draft) return NextResponse.json({ error: "Admission draft not found." }, { status: 404 });

  // The packet page hides another Secretary's draft and every DRAFT packet from the Head
  // Teacher, so the API must not be a wider door than the page it serves.
  if ((user.role === "SECRETARY" && draft.createdById !== user.id) || (user.role === "HEAD_TEACHER" && draft.status === "DRAFT")) {
    await db.auditEvent.create({
      data: { actorId: user.id, action: "ACCESS_DENIED", entity: "AdmissionDraft", entityId: id },
    });
    return NextResponse.json({ error: "Admission draft not found." }, { status: 404 });
  }

  let payload: unknown = {};
  try {
    payload = JSON.parse(draft.payload) as unknown;
  } catch {
    /* Legacy payload */
  }

  const learnerLogin = draft.learnerId
    ? await db.guardianLink.findFirst({
        where: { learnerId: draft.learnerId, relation: "Learner" },
        select: { id: true },
      })
    : null;

  await db.auditEvent.create({
    data: { actorId: user.id, action: "ADMISSION_RECORD_VIEWED", entity: "AdmissionDraft", entityId: id },
  });

  if (payload && typeof payload === "object" && "health" in payload) {
    await db.auditEvent.create({
      data: { actorId: user.id, action: "HEALTH_DATA_ACCESSED", entity: "AdmissionDraft", entityId: id },
    });
  }

  return NextResponse.json({
    draft: {
      id: draft.id,
      admissionNo: draft.admissionNo,
      currentStep: draft.currentStep,
      status: draft.status,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      submittedAt: draft.submittedAt,
      learner: draft.learner ? { ...draft.learner, hasLearnerLogin: Boolean(learnerLogin) } : null,
      documents: draft.documents,
      payload,
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  // Permitted roles: Secretary, Head Teacher, Director
  try {
    assertCan(user.role, "admissions", "delete");
  } catch {
    await db.auditEvent.create({
      data: { actorId: user.id, action: "ACCESS_DENIED", entity: "AdmissionDraft" },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const draft = await db.admissionDraft.findUnique({
    where: { id },
    include: { documents: true },
  });

  if (!draft) {
    return NextResponse.json({ error: "Admission draft not found." }, { status: 404 });
  }

  // Only status DRAFT can be deleted. Submitted or enrolled admissions cannot be deleted here.
  if (draft.status !== "DRAFT") {
    return NextResponse.json(
      {
        error:
          "Only draft admissions can be deleted. Submitted or enrolled admissions must use withdraw or archive.",
      },
      { status: 400 }
    );
  }

  // Delete all uploaded private files from storage
  for (const doc of draft.documents) {
    try {
      await deleteStoredFile("private", doc.storageKey);
    } catch (e) {
      console.warn(`Failed to delete document ${doc.storageKey} from storage:`, e);
    }
  }

  // Transactionally delete documents, draft record, and record audit event
  await db.$transaction(async (tx) => {
    await tx.admissionDocument.deleteMany({ where: { draftId: id } });
    await tx.admissionDraft.delete({ where: { id } });

    await tx.auditEvent.create({
      data: {
        actorId: user.id,
        action: "ADMISSION_DRAFT_DELETED",
        entity: "AdmissionDraft",
        entityId: id,
      },
    });
  });

  return NextResponse.json({
    success: true,
    message: `Draft admission ${draft.admissionNo} deleted successfully.`,
    admissionNo: draft.admissionNo,
  });
}
