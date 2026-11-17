import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";
import { createNotification } from "@/lib/notify";

async function actor() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true, name: true } });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

// GET /api/textbooks
export async function GET() {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const isTeacher = user.role === "TEACHER";
  const scope = isTeacher ? "self" : "school";
  if (!canInScope(user.role, "textbooks", "view", scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const textbooks = await db.textbook.findMany({
    include: {
      issues: {
        include: { teacher: { select: { id: true, name: true, role: true } } },
        orderBy: { issuedAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const [myIssues, requests, teachingAssignments] = await Promise.all([
    db.textbookIssue.findMany({
      where: isTeacher ? { teacherId: user.id } : undefined,
      include: { textbook: true },
      orderBy: { issuedAt: "desc" },
    }),
    db.textbookRequest.findMany({
      where: isTeacher ? { requestedById: user.id } : undefined,
      include: { requestedBy: { select: { id: true, name: true } }, reviewedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    isTeacher
      ? db.teacherAssignment.findMany({ where: { teacherId: user.id }, select: { grade: true, subject: true }, orderBy: [{ grade: "asc" }, { subject: "asc" }] })
      : Promise.resolve([]),
  ]);
  const staffOptions = isTeacher
    ? []
    : await db.user.findMany({ where: { role: { in: ["TEACHER", "DEPUTY", "SENIOR_TEACHER"] }, suspended: false }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } });
  return NextResponse.json({
    textbooks: isTeacher ? textbooks.map((book) => ({ ...book, issues: [] })) : textbooks,
    myIssues,
    requests,
    teachingAssignments,
    staffOptions,
  });
}

const createSchema = z.object({
  title: z.string().trim().min(2).max(120),
  subject: z.string().trim().min(2).max(60),
  grade: z.string().trim().min(1).max(20),
  publisher: z.string().trim().max(80).optional(),
  curriculumCode: z.string().trim().max(40).optional(),
  totalCopies: z.number().int().min(1).max(500),
});
const issueSchema = z.object({
  textbookId: z.string().min(1),
  teacherId: z.string().min(1),
  copyNumber: z.string().trim().max(20).optional(),
  dueDate: z.string().datetime().optional(),
  remarks: z.string().trim().max(300).optional(),
});
const actionSchema = z.object({
  issueId: z.string().min(1),
  action: z.enum(["confirm", "return-request", "return", "confirm-return"]),
  remarks: z.string().trim().max(300).optional(),
});
const requestSchema = z.object({
  title: z.string().trim().min(2).max(120),
  subject: z.string().trim().min(2).max(60),
  grade: z.string().trim().min(1).max(20),
  quantity: z.number().int().min(1).max(100),
  notes: z.string().trim().max(500).optional(),
});
const requestDecisionSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  responseNotes: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const envelope = z.object({ _action: z.enum(["create", "issue", "action", "request", "request-decision"]) }).passthrough().safeParse(body);
  if (!envelope.success) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const { _action, ...rest } = envelope.data;

  if (_action === "create") {
    if (!canInScope(user.role, "textbooks", "create", "school")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = createSchema.safeParse(rest);
    if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    const textbook = await db.textbook.create({ data: { ...parsed.data, availableCopies: parsed.data.totalCopies, createdById: user.id } });
    return NextResponse.json({ textbook }, { status: 201 });
  }

  if (_action === "issue") {
    if (!canInScope(user.role, "textbooks", "create", "school")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = issueSchema.safeParse(rest);
    if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    const textbook = await db.textbook.findUnique({ where: { id: parsed.data.textbookId } });
    if (!textbook || textbook.availableCopies < 1) return NextResponse.json({ error: "No copies available." }, { status: 409 });
    const issue = await db.$transaction(async (tx) => {
      await tx.textbook.update({ where: { id: parsed.data.textbookId }, data: { availableCopies: { decrement: 1 } } });
      return tx.textbookIssue.create({ data: { ...parsed.data, issuedById: user.id, dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null } });
    });
    // Notify teacher
    await createNotification({ userId: parsed.data.teacherId, title: "Textbook Issued To You", message: `"${textbook.title}" (${textbook.subject}) has been issued to you. Please confirm receipt.`, type: "ACTION", link: "/library", actionRequired: true });
    return NextResponse.json({ issue }, { status: 201 });
  }

  if (_action === "request") {
    if (!canInScope(user.role, "textbooks", "apply", "self")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = requestSchema.safeParse(rest);
    if (!parsed.success) return NextResponse.json({ error: "Check the textbook request details." }, { status: 400 });
    const assignment = await db.teacherAssignment.findUnique({
      where: { teacherId_grade_subject: { teacherId: user.id, grade: parsed.data.grade, subject: parsed.data.subject } },
    });
    if (!assignment) return NextResponse.json({ error: "Choose a grade and subject assigned to you." }, { status: 403 });
    const textbookRequest = await db.$transaction(async (tx) => {
      const created = await tx.textbookRequest.create({ data: { ...parsed.data, requestedById: user.id } });
      await tx.auditEvent.create({ data: { actorId: user.id, action: "TEXTBOOK_REQUESTED", entity: "TextbookRequest", entityId: created.id } });
      return created;
    });
    const reviewers = await db.user.findMany({
      where: { role: { in: ["DEPUTY", "SENIOR_TEACHER", "HEAD_TEACHER", "DIRECTOR"] }, suspended: false },
      select: { id: true },
    });
    await Promise.all(reviewers.map((reviewer) => createNotification({
      userId: reviewer.id,
      title: "Textbook request needs review",
      message: `${user.name} requested ${parsed.data.quantity} ${parsed.data.title} for ${parsed.data.grade} ${parsed.data.subject}.`,
      type: "ACTION",
      link: "/library",
      actionRequired: true,
    })));
    return NextResponse.json({ request: textbookRequest }, { status: 201 });
  }

  if (_action === "request-decision") {
    if (!canInScope(user.role, "textbooks", "approve", "school")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = requestDecisionSchema.safeParse(rest);
    if (!parsed.success) return NextResponse.json({ error: "Invalid request decision." }, { status: 400 });
    const existing = await db.textbookRequest.findUnique({ where: { id: parsed.data.requestId } });
    if (!existing) return NextResponse.json({ error: "Request not found." }, { status: 404 });
    if (existing.status !== "PENDING") return NextResponse.json({ error: "This request has already been reviewed." }, { status: 409 });
    const updated = await db.$transaction(async (tx) => {
      const decision = await tx.textbookRequest.update({
        where: { id: existing.id, status: "PENDING" },
        data: { status: parsed.data.decision, responseNotes: parsed.data.responseNotes, reviewedById: user.id, reviewedAt: new Date() },
      });
      await tx.auditEvent.create({ data: { actorId: user.id, action: `TEXTBOOK_REQUEST_${parsed.data.decision}`, entity: "TextbookRequest", entityId: decision.id } });
      return decision;
    }).catch((error: unknown) => {
      if (error instanceof Error && "code" in error && error.code === "P2025") return null;
      throw error;
    });
    if (!updated) return NextResponse.json({ error: "This request has already been reviewed." }, { status: 409 });
    await createNotification({
      userId: existing.requestedById,
      title: `Textbook request ${parsed.data.decision.toLowerCase()}`,
      message: parsed.data.responseNotes || `Your request for "${existing.title}" was ${parsed.data.decision.toLowerCase()}.`,
      type: parsed.data.decision === "APPROVED" ? "SUCCESS" : "INFO",
      link: "/library",
    });
    return NextResponse.json({ request: updated });
  }

  if (_action === "action") {
    const parsed = actionSchema.safeParse(rest);
    if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    const issue = await db.textbookIssue.findUnique({ where: { id: parsed.data.issueId }, include: { textbook: true, issuedBy: { select: { id: true, name: true } } } });
    if (!issue) return NextResponse.json({ error: "Issue record not found" }, { status: 404 });

    if (parsed.data.action === "confirm") {
      if (issue.teacherId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      await db.textbookIssue.update({ where: { id: issue.id }, data: { status: "CONFIRMED", confirmedAt: new Date(), remarks: parsed.data.remarks ?? issue.remarks } });
      await createNotification({ userId: issue.issuedById, title: "Textbook Receipt Confirmed", message: `${user.name} confirmed receipt of "${issue.textbook.title}".`, type: "SUCCESS", link: "/library" });
      return NextResponse.json({ ok: true });
    }

    if (parsed.data.action === "return-request") {
      if (!canInScope(user.role, "textbooks", "update", "school")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      await db.textbookIssue.update({ where: { id: issue.id }, data: { status: "RETURN_REQUESTED", remarks: parsed.data.remarks ?? issue.remarks } });
      await createNotification({ userId: issue.teacherId, title: "Return Textbook", message: `Please return "${issue.textbook.title}" to the library.`, type: "ACTION", link: "/library", actionRequired: true });
      return NextResponse.json({ ok: true });
    }

    if (parsed.data.action === "confirm-return") {
      if (!canInScope(user.role, "textbooks", "update", "school")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      await db.$transaction(async (tx) => {
        await tx.textbookIssue.update({ where: { id: issue.id }, data: { status: "RETURNED", returnedAt: new Date(), remarks: parsed.data.remarks ?? issue.remarks } });
        await tx.textbook.update({ where: { id: issue.textbookId }, data: { availableCopies: { increment: 1 } } });
      });
      await createNotification({ userId: issue.teacherId, title: "Textbook Return Confirmed", message: `Return of "${issue.textbook.title}" has been confirmed. Thank you.`, type: "SUCCESS", link: "/library" });
      return NextResponse.json({ ok: true });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
