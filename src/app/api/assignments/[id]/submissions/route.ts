import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";

const submitSchema = z.object({
  response: z.string().trim().min(1).max(5000),
  attachmentUrl: z.string().trim().max(1000).optional().nullable(),
  attachmentType: z.string().trim().max(50).optional().nullable(),
});
const markSchema = z.object({ learnerId: z.string().min(1), score: z.number().int().min(0).max(1000), feedback: z.string().trim().max(600).optional() });
async function actor() {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "assignments", "view", "self")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Write your answer before submitting." }, { status: 400 });
  const { id } = await params;
  const links = await db.guardianLink.findMany({ where: { userId: user.id, relation: "Learner", learner: { archivedAt: null, admissionStatus: "APPROVED" } }, select: { learnerId: true, learner: { select: { grade: true } } } });
  const assignment = await db.assignment.findUnique({ where: { id } });
  const learner = links.find(link => link.learner.grade === assignment?.grade);
  if (!assignment || !learner) return NextResponse.json({ error: "Assignment not found for your class." }, { status: 404 });
  if (assignment.dueAt && assignment.dueAt.getTime() < Date.now()) return NextResponse.json({ error: "The submission deadline has passed." }, { status: 409 });
  const previous = await db.assignmentSubmission.findUnique({ where: { assignmentId_learnerId: { assignmentId: id, learnerId: learner.learnerId } }, select: { status: true } });
  if (previous?.status === "MARKED") return NextResponse.json({ error: "This assignment has already been marked and cannot be resubmitted." }, { status: 409 });
  const normalized = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-KE");
  const score = assignment.autoMark && assignment.answerKey ? (normalized(parsed.data.response) === normalized(assignment.answerKey) ? assignment.maxScore : 0) : null;
  try {
    const submission = await db.$transaction(async tx => {
      const row = await tx.assignmentSubmission.upsert({
        where: { assignmentId_learnerId: { assignmentId: id, learnerId: learner.learnerId } },
        create: {
          assignmentId: id,
          learnerId: learner.learnerId,
          response: parsed.data.response,
          attachmentUrl: parsed.data.attachmentUrl ?? null,
          attachmentType: parsed.data.attachmentType ?? null,
          score,
          status: assignment.autoMark ? "MARKED" : "SUBMITTED",
        },
        update: {
          response: parsed.data.response,
          attachmentUrl: parsed.data.attachmentUrl ?? null,
          attachmentType: parsed.data.attachmentType ?? null,
          score,
          status: assignment.autoMark ? "MARKED" : "SUBMITTED",
          feedback: null,
          submittedAt: new Date(),
        },
      });
      await tx.auditEvent.create({ data: { actorId: user.id, action: assignment.autoMark ? "ASSIGNMENT_AUTO_MARKED" : "ASSIGNMENT_SUBMITTED", entity: "AssignmentSubmission", entityId: row.id } });
      return row;
    });
    return NextResponse.json({ submission }, { status: 201 });
  } catch { return NextResponse.json({ error: "This assignment could not be submitted." }, { status: 409 }); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "assignments", "update", "assigned")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = markSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid score and feedback." }, { status: 400 });
  const { id } = await params;
  const assignment = await db.assignment.findUnique({ where: { id } });
  if (!assignment || assignment.teacherId !== user.id) return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  if (parsed.data.score > assignment.maxScore) return NextResponse.json({ error: "Score cannot be higher than the assignment maximum." }, { status: 400 });
  const learner = await db.learner.findUnique({ where: { id: parsed.data.learnerId }, select: { grade: true, archivedAt: true } });
  if (!learner || learner.archivedAt || learner.grade !== assignment.grade) return NextResponse.json({ error: "Learner is outside this assignment class." }, { status: 403 });
  const old = await db.assignmentSubmission.findUnique({ where: { assignmentId_learnerId: { assignmentId: id, learnerId: parsed.data.learnerId } } });
  if (!old || old.status === "MARKED") return NextResponse.json({ error: "Submission not found or already marked." }, { status: 409 });
  const submission = await db.$transaction(async tx => {
    const row = await tx.assignmentSubmission.update({ where: { id: old.id, status: "SUBMITTED" }, data: { score: parsed.data.score, feedback: parsed.data.feedback, status: "MARKED" } });
    await tx.auditEvent.create({ data: { actorId: user.id, action: "ASSIGNMENT_MARKED", entity: "AssignmentSubmission", entityId: row.id } });
    return row;
  });
  return NextResponse.json({ submission });
}
