import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";

async function actor() {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, name: true, role: true, suspended: true, forcePasswordChange: true } });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}
export async function GET() {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const scope = user.role === "DIRECTOR" || user.role === "HEAD_TEACHER" ? "school" : user.role === "PARENT" ? "self" : "school";
  if (!canInScope(user.role, "complaints", "view", scope)) { await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "Complaint" } }); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const where = scope === "school" ? {} : { openedById: user.id };
  const complaints = await db.complaint.findMany({ where, include: { openedBy: { select: { id: true, name: true, role: true } }, assignedTo: { select: { id: true, name: true, role: true } }, replies: { include: { author: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" } } }, orderBy: { updatedAt: "desc" }, take: 100 });
  return NextResponse.json({ complaints });
}
const schema = z.object({
  subject: z.string().trim().min(3).max(120),
  category: z.enum(["ACADEMIC", "FEES", "SAFETY", "WELLBEING", "OTHER"]).default("OTHER"),
  message: z.string().trim().min(5).max(2500),
  recipientRole: z.enum(["HEAD_TEACHER", "DIRECTOR", "BOTH"]),
  learnerId: z.string().min(1),
  attachmentName: z.string().trim().max(120).optional(),
  attachmentKey: z.string().trim().max(255).optional()
});
export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "complaints", "create", "self")) { await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "Complaint" } }); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Add a category, subject, message and authorized school contact." }, { status: 400 });
  const learnerId = parsed.data.learnerId;
  const link = await db.guardianLink.findUnique({ where: { userId_learnerId: { userId: user.id, learnerId } }, include: { learner: { select: { admissionStatus: true, archivedAt: true } } } });
  if (!link || link.learner.admissionStatus !== "APPROVED" || link.learner.archivedAt) return NextResponse.json({ error: "That learner is not linked to your account." }, { status: 403 });
  const assignedRole = parsed.data.recipientRole === "BOTH" ? "HEAD_TEACHER" : parsed.data.recipientRole;
  const assignedToId = (await db.user.findFirst({ where: { role: assignedRole, suspended: false }, select: { id: true } }))?.id ?? null;
  if (!assignedToId) return NextResponse.json({ error: "No active staff member is assigned to receive this complaint." }, { status: 409 });
  const complaint = await db.$transaction(async tx => {
    const row = await tx.complaint.create({
      data: {
        subject: parsed.data.subject,
        category: parsed.data.category,
        message: parsed.data.message,
        audience: parsed.data.recipientRole,
        reporterName: user.name,
        reporterRole: "PARENT",
        status: "RECEIVED",
        openedById: user.id,
        assignedToId,
        learnerId,
        attachmentName: parsed.data.attachmentName,
        attachmentKey: parsed.data.attachmentKey
      }
    });
    await tx.complaintReply.create({ data: { complaintId: row.id, authorId: user.id, message: parsed.data.message } });
    await tx.auditEvent.create({ data: { actorId: user.id, action: "COMPLAINT_CREATED", entity: "Complaint", entityId: row.id } });
    return row;
  });
  return NextResponse.json({ complaint }, { status: 201 });
}
