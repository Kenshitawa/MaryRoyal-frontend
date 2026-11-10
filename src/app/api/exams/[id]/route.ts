import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";

async function actor() {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true }
  });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

const updateSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "CLOSED", "PUBLISHED"]).optional(),
  name: z.string().trim().min(3).max(100).optional(),
  reopenReason: z.string().trim().min(5).max(300).optional(),
  classes: z.array(z.string().trim()).optional(),
  subjects: z.array(z.string().trim()).optional()
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { id } = await params;
  const exam = await db.examSession.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, role: true } },
      assessments: {
        take: 50,
        include: {
          learner: { select: { id: true, name: true, admissionNo: true, grade: true } },
          enteredBy: { select: { id: true, name: true } }
        }
      }
    }
  });

  if (!exam) return NextResponse.json({ error: "Exam session not found" }, { status: 404 });
  return NextResponse.json({ exam });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { id } = await params;
  const existing = await db.examSession.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Exam session not found" }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid updates provided." }, { status: 400 });
  }

  const { status, name, reopenReason, classes, subjects } = parsed.data;

  // Authorization check based on action:
  // Reopening closed/published requires HEAD_TEACHER or DIRECTOR approval
  if (existing.status === "CLOSED" && status === "ACTIVE") {
    if (!canInScope(user.role, "examSessions", "approve", "school")) {
      await db.auditEvent.create({
        data: { actorId: user.id, action: "ACCESS_DENIED", entity: "ExamSession", entityId: id }
      });
      return NextResponse.json({ error: "Only Head Teacher or Director can approve reopening a closed exam." }, { status: 403 });
    }
    if (!reopenReason) {
      return NextResponse.json({ error: "A reason is required to reopen an exam session." }, { status: 400 });
    }
  } else if (!canInScope(user.role, "examSessions", "update", "school")) {
    await db.auditEvent.create({
      data: { actorId: user.id, action: "ACCESS_DENIED", entity: "ExamSession", entityId: id }
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await db.$transaction(async (tx) => {
    const dataToUpdate: Record<string, unknown> = {};
    if (status) dataToUpdate.status = status;
    if (name) dataToUpdate.name = name;
    if (classes) dataToUpdate.classesJson = JSON.stringify(classes);
    if (subjects) dataToUpdate.subjectsJson = JSON.stringify(subjects);
    if (reopenReason) {
      dataToUpdate.reopenReason = reopenReason;
      dataToUpdate.reopenApprovedById = user.id;
    }

    const exam = await tx.examSession.update({
      where: { id },
      data: dataToUpdate
    });

    await tx.auditEvent.create({
      data: {
        actorId: user.id,
        action: `EXAM_SESSION_${status ?? "UPDATED"}`,
        entity: "ExamSession",
        entityId: id
      }
    });

    return exam;
  });

  return NextResponse.json({ exam: updated });
}
