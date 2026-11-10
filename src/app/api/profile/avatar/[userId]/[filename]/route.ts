import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readStoredFile } from "@/lib/file-storage";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";

export const runtime = "nodejs";
const types: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string; filename: string }> }) {
  const { userId, filename } = await params;
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!/^[a-z0-9_-]{8,80}$/i.test(userId) || !/^[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(filename) || !types[extension]) return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const viewer = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!viewer || viewer.suspended || viewer.forcePasswordChange) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, avatarUrl: true, suspended: true } });
  const expected = `/api/profile/avatar/${userId}/${filename}`;
  const self = viewer.id === userId;
  const staffViewer = canInScope(viewer.role, "staff", "view", "school");
  if (!target || target.suspended || target.avatarUrl !== expected || (!self && !staffViewer)) {
    await db.auditEvent.create({ data: { actorId: viewer.id, action: "ACCESS_DENIED", entity: "UserAvatar", entityId: userId } });
    return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  }
  try {
    const bytes = await readStoredFile("avatars", `${userId}/${filename}`);
    return new NextResponse(bytes, { headers: { "content-type": types[extension], "cache-control": "private, max-age=300", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox" } });
  } catch {
    return NextResponse.json({ error: "Photo is unavailable." }, { status: 404 });
  }
}
