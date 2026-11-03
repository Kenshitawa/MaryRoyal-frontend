import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";

async function actor() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

// GET /api/notifications — list unread + recent (auto-delete read older than 5 days)
export async function GET() {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  // Automatically purge read notifications older than 5 days
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  try {
    await db.notification.deleteMany({
      where: {
        userId: user.id,
        read: true,
        createdAt: { lt: fiveDaysAgo },
      },
    });
  } catch (err) {
    console.error("Failed to prune old notifications:", err);
  }

  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unreadCount = notifications.filter((n) => !n.read).length;
  return NextResponse.json({ notifications, unreadCount });
}

// PATCH /api/notifications — mark read or action done
export async function PATCH(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const { id, action } = body as { id?: string; action?: string };
  if (action === "read-all") {
    await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
    return NextResponse.json({ ok: true });
  }
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const notification = await db.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.notification.update({ where: { id }, data: { read: true, ...(action === "done" ? { actionDone: true } : {}) } });
  return NextResponse.json({ ok: true });
}
