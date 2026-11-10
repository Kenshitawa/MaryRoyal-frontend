import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { readStoredFile } from "@/lib/file-storage";

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { docId } = await params;
  const doc = await db.staffDocument.findUnique({
    where: { id: docId },
    include: {
      staffProfile: {
        select: { userId: true },
      },
    },
  });

  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const isOwner = user.id === doc.staffProfile.userId;
  const canViewAll = canInScope(user.role, "staff", "view", "school");

  if (!isOwner && !canViewAll) {
    await db.auditEvent.create({
      data: { actorId: user.id, action: "ACCESS_DENIED", entity: "StaffDocument", entityId: docId },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const fileBytes = await readStoredFile("private", doc.storageKey);

    await db.auditEvent.create({
      data: {
        actorId: user.id,
        action: "STAFF_DOCUMENT_VIEWED",
        entity: "StaffDocument",
        entityId: docId,
      },
    });

    return new Response(fileBytes, {
      headers: {
        "content-type": doc.contentType,
        "content-length": String(doc.sizeBytes),
        "content-disposition": `inline; filename="${encodeURIComponent(doc.originalName)}"`,
        "cache-control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch {
    console.error("Staff document read failed.");
    return NextResponse.json({ error: "File not found or unreadable." }, { status: 404 });
  }
}
