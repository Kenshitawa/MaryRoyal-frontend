import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { createNotification } from "@/lib/notify";

async function actor() {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true, name: true } });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

export async function GET() {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!can(user.role as never, "schemesOfWork", "view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const isAdmin = ["DIRECTOR", "HEAD_TEACHER", "DEPUTY"].includes(user.role);
  const schemes = await db.schemeOfWork.findMany({
    where: isAdmin ? {} : { teacherId: user.id },
    include: { teacher: { select: { id: true, name: true, role: true } } },
    orderBy: [{ year: "desc" }, { term: "asc" }, { week: "asc" }, { lessonNo: "asc" }],
    take: 200,
  });
  return NextResponse.json({ schemes });
}

const schemeSchema = z.object({
  grade: z.string().trim().min(1).max(20),
  subject: z.string().trim().min(1).max(60),
  term: z.string().trim().min(1).max(30),
  year: z.number().int().min(2020).max(2100).optional(),
  week: z.number().int().min(1).max(52),
  lessonNo: z.number().int().min(1).max(20),
  strand: z.string().trim().min(1).max(120),
  subStrand: z.string().trim().min(1).max(120),
  learningOutcomes: z.string().trim().min(5).max(1000),
  keyInquiryQuestions: z.string().trim().max(500).optional(),
  learningExperiences: z.string().trim().min(5).max(1000),
  learningResources: z.string().trim().min(2).max(500),
  assessmentMethods: z.string().trim().min(2).max(500),
  reflection: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!can(user.role as never, "schemesOfWork", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = schemeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Fill in all required fields." }, { status: 400 });
  const scheme = await db.schemeOfWork.create({ data: { ...parsed.data, year: parsed.data.year ?? new Date().getFullYear(), teacherId: user.id, status: "SUBMITTED" } });

  // Notify deputy + head teacher
  const deputies = await db.user.findMany({ where: { role: { in: ["DEPUTY", "HEAD_TEACHER"] } }, select: { id: true } });
  for (const d of deputies) {
    await createNotification({ userId: d.id, title: "New Scheme of Work Submitted", message: `${user.name} submitted a scheme for ${parsed.data.grade} ${parsed.data.subject} â€” Term ${parsed.data.term} Week ${parsed.data.week}.`, type: "ACTION", link: "/schemes", actionRequired: true });
  }
  return NextResponse.json({ scheme }, { status: 201 });
}

const reviewSchema = z.object({
  schemeId: z.string().min(1),
  action: z.enum(["confirm-deputy", "verify-head", "reject"]),
  feedback: z.string().trim().max(400).optional(),
});

export async function PATCH(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const scheme = await db.schemeOfWork.findUnique({ where: { id: parsed.data.schemeId }, include: { teacher: { select: { id: true, name: true } } } });
  if (!scheme) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.action === "confirm-deputy") {
    if (!["DEPUTY", "HEAD_TEACHER", "DIRECTOR"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await db.schemeOfWork.update({ where: { id: scheme.id }, data: { status: "CONFIRMED_BY_DEPUTY", deputyFeedback: parsed.data.feedback ?? null, deputyConfirmedAt: new Date() } });
    await createNotification({ userId: scheme.teacherId, title: "Scheme Confirmed by Deputy", message: `Your scheme for ${scheme.grade} ${scheme.subject} Week ${scheme.week} has been confirmed by the Deputy.`, type: "SUCCESS", link: "/schemes" });
    // Notify head teachers for final verification
    const heads = await db.user.findMany({ where: { role: "HEAD_TEACHER" }, select: { id: true } });
    for (const h of heads) {
      await createNotification({ userId: h.id, title: "Scheme Needs Your Verification", message: `${scheme.teacher.name}'s scheme for ${scheme.grade} ${scheme.subject} is awaiting your verification.`, type: "ACTION", link: "/schemes", actionRequired: true });
    }
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "verify-head") {
    if (!["HEAD_TEACHER", "DIRECTOR"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await db.schemeOfWork.update({ where: { id: scheme.id }, data: { status: "VERIFIED_BY_HEADTEACHER", headteacherFeedback: parsed.data.feedback ?? null, headteacherVerifiedAt: new Date() } });
    await createNotification({ userId: scheme.teacherId, title: "Scheme Verified âœ“", message: `Your scheme for ${scheme.grade} ${scheme.subject} Week ${scheme.week} has been fully verified by the Head Teacher.`, type: "SUCCESS", link: "/schemes" });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "reject") {
    if (!["DEPUTY", "HEAD_TEACHER", "DIRECTOR"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await db.schemeOfWork.update({ where: { id: scheme.id }, data: { status: "REJECTED", deputyFeedback: user.role === "DEPUTY" ? parsed.data.feedback ?? null : scheme.deputyFeedback, headteacherFeedback: ["HEAD_TEACHER", "DIRECTOR"].includes(user.role) ? parsed.data.feedback ?? null : scheme.headteacherFeedback } });
    await createNotification({ userId: scheme.teacherId, title: "Scheme Needs Revision", message: `Your scheme for ${scheme.grade} ${scheme.subject} Week ${scheme.week} needs revisions. ${parsed.data.feedback ?? ""}`, type: "WARNING", link: "/schemes" });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
