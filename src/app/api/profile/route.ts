import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { writeStoredFile } from "@/lib/file-storage";

export const runtime = "nodejs";
const imageTypes = ["image/png", "image/jpeg", "image/webp"] as const;
const photoSchema = z.object({ type: z.enum(imageTypes), size: z.number().int().positive().max(2 * 1024 * 1024) });
async function currentUser() {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, name: true, email: true, role: true, avatarUrl: true, suspended: true, forcePasswordChange: true } });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  return NextResponse.json({ profile: { name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl } });
}
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const contentLength = request.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > 2 * 1024 * 1024 + 64 * 1024)) return NextResponse.json({ error: "Profile photos must be smaller than 2 MB." }, { status: 413 });
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Choose a valid image file." }, { status: 400 });
  const photo = form.get("photo");
  if (!(photo instanceof File)) return NextResponse.json({ error: "Choose a profile photo." }, { status: 400 });
  const checked = photoSchema.safeParse({ type: photo.type, size: photo.size });
  if (!checked.success) return NextResponse.json({ error: "Use a PNG, JPEG or WebP image under 2 MB." }, { status: 400 });
  const bytes = Buffer.from(await photo.arrayBuffer());
  const signatures: Record<(typeof imageTypes)[number], boolean> = {
    "image/png": bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/jpeg": bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    "image/webp": bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP"
  };
  if (!signatures[checked.data.type]) return NextResponse.json({ error: "The selected file does not match its image type." }, { status: 400 });
  const extension = checked.data.type === "image/jpeg" ? "jpg" : checked.data.type.slice("image/".length);
  const filename = `${randomUUID()}.${extension}`;
  const avatarUrl = `/api/profile/avatar/${user.id}/${filename}`;
  await writeStoredFile("avatars", `${user.id}/${filename}`, bytes, checked.data.type);
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { avatarUrl } }),
    db.auditEvent.create({ data: { actorId: user.id, action: "PROFILE_PHOTO_UPDATED", entity: "User", entityId: user.id } })
  ]);
  return NextResponse.json({ avatarUrl });
}
