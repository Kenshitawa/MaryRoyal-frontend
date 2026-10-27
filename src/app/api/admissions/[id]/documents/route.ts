import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { assertCanInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { admissionDocumentCategory } from "@/lib/admissions";
import { deleteStoredFile, writeStoredFile } from "@/lib/file-storage";
import { MAX_MULTIPART_BODY_BYTES, MAX_UPLOAD_FILE_BYTES } from "@/lib/upload-limits";

export const runtime = "nodejs";
const extensionByType = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" } as const;
const fileKey = (draftId: string, key: string) => `admissions/${draftId}/${key}`;
function matchesSignature(type: string, bytes: Uint8Array) {
  if (type === "image/png") return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === "image/jpeg") return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "application/pdf") return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  return false;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended || user.forcePasswordChange) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try { assertCanInScope(user.role, "admissions", "update", "school"); } catch { await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "AdmissionDocument" } }); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const { id } = await params;
  const draft = await db.admissionDraft.findUnique({ where: { id }, include: { documents: true } });
  if (!draft) return NextResponse.json({ error: "Admission draft not found." }, { status: 404 });
  if (user.role === "SECRETARY" && draft.createdById !== user.id) { await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "AdmissionDraft", entityId: id } }); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  if (draft.status !== "DRAFT") return NextResponse.json({ error: "Documents cannot change after submission." }, { status: 409 });
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BODY_BYTES) return NextResponse.json({ error: "Upload request exceeds the 4 MB file limit." }, { status: 413 });
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Upload an admission document." }, { status: 400 }); }
  const category = admissionDocumentCategory.safeParse(form.get("category"));
  const file = form.get("file");
  if (!category.success || !(file instanceof File)) return NextResponse.json({ error: "Choose a document type and file." }, { status: 400 });
  const contentType = file.type.toLowerCase() as keyof typeof extensionByType;
  if (!Object.hasOwn(extensionByType, contentType) || file.size < 1 || file.size > MAX_UPLOAD_FILE_BYTES || category.data === "PASSPORT_PHOTO" && contentType === "application/pdf") return NextResponse.json({ error: "Use a JPEG/PNG photo or PDF document up to 4 MB. Passport photos must be an image." }, { status: file.size > MAX_UPLOAD_FILE_BYTES ? 413 : 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesSignature(contentType, bytes)) return NextResponse.json({ error: "The file content does not match the selected image or PDF type." }, { status: 400 });
  const key = `${randomUUID()}.${extensionByType[contentType]}`;
  const safeName = file.name.replace(/[\u0000-\u001f\u007f/\\]/g, "_").slice(0, 120) || "admission-document";
  const old = draft.documents.filter(document => document.category === category.data);
  try {
    await writeStoredFile("private", fileKey(id, key), bytes, contentType);
    const document = await db.$transaction(async tx => {
      await tx.admissionDocument.deleteMany({ where: { draftId: id, category: category.data } });
      const created = await tx.admissionDocument.create({ data: { draftId: id, category: category.data, originalName: safeName, storageKey: key, contentType, sizeBytes: bytes.byteLength, uploadedById: user.id } });
      await tx.auditEvent.create({ data: { actorId: user.id, action: "ADMISSION_DOCUMENT_UPLOADED", entity: "AdmissionDocument", entityId: created.id } });
      return created;
    });
    await Promise.all(old.map(document => deleteStoredFile("private", fileKey(id, document.storageKey)).catch(() => undefined)));
    return NextResponse.json({ document: { id: document.id, category: document.category, originalName: document.originalName, contentType: document.contentType, sizeBytes: document.sizeBytes, createdAt: document.createdAt } }, { status: 201 });
  } catch {
    await deleteStoredFile("private", fileKey(id, key)).catch(() => undefined);
    return NextResponse.json({ error: "Document upload failed. Try a smaller image or PDF." }, { status: 500 });
  }
}
