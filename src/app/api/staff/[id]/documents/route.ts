import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { canManageStaffTarget } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { writeStoredFile } from "@/lib/file-storage";

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

const ALLOWED_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];

const ALLOWED_CATEGORIES = [
  "ID_COPY",
  "TSC_CARD",
  "ACADEMIC_CERTIFICATE",
  "CV",
  "CONTRACT",
  "PASSPORT_PHOTO",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { id } = await params;
  const staff = await db.user.findUnique({
    where: { id },
    include: { staffProfile: true },
  });

  if (!staff) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });

  // Can upload if Director, Head Teacher managing staff, or the staff member themselves
  if (user.id !== id && !canManageStaffTarget(user.role, staff.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const category = (formData.get("category") as string)?.toUpperCase();

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!ALLOWED_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid document category" }, { status: 400 });
  }

  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: "Only PDF, PNG, JPEG, and WebP files are accepted." }, { status: 400 });
  }

  const MAX_SIZE = 4 * 1024 * 1024; // 4 MiB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File exceeds 4 MiB limit." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const storageKey = `staff-docs/${id}/${category.toLowerCase()}-${randomBytes(8).toString("hex")}.${ext}`;

  try {
    await writeStoredFile("private", storageKey, buffer, file.type);

    let profileId = staff.staffProfile?.id;
    if (!profileId) {
      const createdProfile = await db.staffProfile.create({
        data: { userId: id },
      });
      profileId = createdProfile.id;
    }

    const doc = await db.staffDocument.create({
      data: {
        staffProfileId: profileId,
        category,
        originalName: file.name.slice(0, 150),
        storageKey,
        contentType: file.type,
        sizeBytes: file.size,
        uploadedById: user.id,
      },
    });

    await db.auditEvent.create({
      data: {
        actorId: user.id,
        action: "STAFF_DOCUMENT_UPLOADED",
        entity: "StaffDocument",
        entityId: doc.id,
      },
    });

    return NextResponse.json({ success: true, document: doc }, { status: 201 });
  } catch {
    console.error("Staff document upload failed.");
    return NextResponse.json({ error: "Failed to store document." }, { status: 500 });
  }
}
