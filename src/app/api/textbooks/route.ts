import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { can } from "@/lib/permissions";
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
  if (!can(user.role as never, "textbooks", "view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const textbooks = await db.textbook.findMany({
    include: {
      issues: {
        include: { teacher: { select: { id: true, name: true, role: true } } },
        orderBy: { issuedAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Teachers only see their own issues
  if (user.role === "TEACHER") {
    const myIssues = await db.textbookIssue.findMany({
      where: { teacherId: user.id },
      include: { textbook: true },
      orderBy: { issuedAt: "desc" },
    });
    return NextResponse.json({ textbooks: textbooks.map((b) => ({ ...b, issues: [] })), myIssues });
  }

  const canIssue = ["DIRECTOR", "HEAD_TEACHER", "DEPUTY"].includes(user.role);
  const staffOptions = canIssue
    ? await db.user.findMany({ where: { role: { in: ["TEACHER", "DEPUTY"] }, suspended: false }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } })
    : [];
  return NextResponse.json({ textbooks, myIssues: [], staffOptions });
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

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { _action, ...rest } = body as { _action?: string } & Record<string, unknown>;

  if (_action === "create") {
    if (!can(user.role as never, "textbooks", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = createSchema.safeParse(rest);
    if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    const textbook = await db.textbook.create({ data: { ...parsed.data, availableCopies: parsed.data.totalCopies, createdById: user.id } });
    return NextResponse.json({ textbook }, { status: 201 });
  }

  if (_action === "issue") {
    if (!can(user.role as never, "textbooks", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      if (!["DEPUTY", "HEAD_TEACHER", "DIRECTOR"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      await db.textbookIssue.update({ where: { id: issue.id }, data: { status: "RETURN_REQUESTED", remarks: parsed.data.remarks ?? issue.remarks } });
      await createNotification({ userId: issue.teacherId, title: "Return Textbook", message: `Please return "${issue.textbook.title}" to the library.`, type: "ACTION", link: "/library", actionRequired: true });
      return NextResponse.json({ ok: true });
    }

    if (parsed.data.action === "confirm-return") {
      if (!["DEPUTY", "HEAD_TEACHER", "DIRECTOR"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
