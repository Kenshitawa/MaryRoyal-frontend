import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";

const schema = z.object({ message: z.string().trim().min(1).max(2500) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended || user.forcePasswordChange) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "complaints", "update", "school")) { await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "Complaint" } }); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Write a reply before sending." }, { status: 400 });
  const { id } = await params;
  const complaint = await db.complaint.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!complaint) return NextResponse.json({ error: "Complaint not found." }, { status: 404 });
  if (!canInScope(user.role, "complaints", "view", "school")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const reply = await db.$transaction(async tx => {
    const row = await tx.complaintReply.create({ data: { complaintId: id, authorId: user.id, message: parsed.data.message } });
    await tx.complaint.update({ where: { id }, data: { status: complaint.status === "RESOLVED" ? "IN_REVIEW" : complaint.status } });
    await tx.auditEvent.create({ data: { actorId: user.id, action: "COMPLAINT_REPLY_SENT", entity: "Complaint", entityId: id } });
    return row;
  });
  return NextResponse.json({ reply }, { status: 201 });
}
