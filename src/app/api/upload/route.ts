import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { writeStoredFile } from "@/lib/file-storage";
import { MAX_MULTIPART_BODY_BYTES, MAX_UPLOAD_FILE_BYTES } from "@/lib/upload-limits";

async function actor() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true },
  });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

export async function POST(request: Request) {
  const user = await actor();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BODY_BYTES) {
      return NextResponse.json({ error: "Upload request exceeds the 4 MB file limit." }, { status: 413 });
    }
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, WEBP, GIF, and PDF are allowed." },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_FILE_BYTES) {
      return NextResponse.json(
        { error: "File exceeds the 4 MB limit." },
        { status: 413 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Extension from mime
    const ext = file.type === "application/pdf"
      ? "pdf"
      : file.type.split("/")[1] || "bin";

    const filename = `${randomUUID()}.${ext}`;
    const fileUrl = `/api/uploads/assignments/${filename}`;
    await writeStoredFile("assignments", filename, buffer, file.type);

    return NextResponse.json({
      url: fileUrl,
      filename: file.name,
      type: file.type,
      size: file.size,
    });
  } catch {
    console.error("Assignment upload failed.");
    return NextResponse.json({ error: "File upload failed" }, { status: 500 });
  }
}
