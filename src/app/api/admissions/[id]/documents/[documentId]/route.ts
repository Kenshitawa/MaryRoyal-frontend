import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { assertCanInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { deleteStoredFile, readStoredFile } from "@/lib/file-storage";

export const runtime = "nodejs";
const safeKey = (draftId: string, key: string) => /^[a-f0-9-]{36}\.(jpg|png|pdf)$/.test(key) ? `admissions/${draftId}/${key}` : null;
async function getAccess(id: string) {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return { response: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }) };
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended || user.forcePasswordChange) return { response: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }) };
  try { assertCanInScope(user.role, "learners", "view", "school"); } catch { await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "AdmissionDocument" } }); return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }; }
  const draft = await db.admissionDraft.findUnique({ where: { id }, select: { id: true, createdById: true, status: true } });
  if (!draft) return { response: NextResponse.json({ error: "Admission document not found." }, { status: 404 }) };
  if (user.role === "HEAD_TEACHER" && draft.status === "DRAFT") return { response: NextResponse.json({ error: "This draft is not available for review." }, { status: 404 }) };
  return { user, draft };
}
export async function GET(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const { id, documentId } = await params;
  const access = await getAccess(id);
  if ("response" in access) return access.response;
  const document = await db.admissionDocument.findFirst({ where: { id: documentId, draftId: id } });
  const key = document && safeKey(id, document.storageKey);
  if (!document || !key) return NextResponse.json({ error: "Admission document not found." }, { status: 404 });
  try {
    const bytes = await readStoredFile("private", key);
    await db.auditEvent.create({ data: { actorId: access.user.id, action: "ADMISSION_DOCUMENT_VIEWED", entity: "AdmissionDocument", entityId: document.id } });
    const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";
    return new NextResponse(bytes, { headers: { "content-type": document.contentType, "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(document.originalName)}`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch { return NextResponse.json({ error: "The stored admission document is unavailable." }, { status: 404 }); }
}
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const { id, documentId } = await params;
  const access = await getAccess(id);
  if ("response" in access) return access.response;
  if (!access.user || !["DIRECTOR", "SECRETARY"].includes(access.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (access.draft.status !== "DRAFT") return NextResponse.json({ error: "Submitted documents are retained with the admission record." }, { status: 409 });
  const document = await db.admissionDocument.findFirst({ where: { id: documentId, draftId: id } });
  const key = document && safeKey(id, document.storageKey);
  if (!document || !key) return NextResponse.json({ error: "Admission document not found." }, { status: 404 });
  await db.$transaction(async tx => {
    await tx.admissionDocument.delete({ where: { id: document.id } });
    await tx.auditEvent.create({ data: { actorId: access.user!.id, action: "ADMISSION_DOCUMENT_REMOVED", entity: "AdmissionDocument", entityId: document.id } });
  });
  await deleteStoredFile("private", key).catch(() => undefined);
  return NextResponse.json({ success: true });
}
