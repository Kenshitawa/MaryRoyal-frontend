import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { cbcLevel } from "@/lib/grading";

async function actor() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true },
  });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

const filtersSchema = z.object({
  mode: z.enum(["marks", "roster"]).optional().default("marks"),
  term: z.string().max(40).optional(),
  grade: z.string().trim().min(1).max(40).optional(),
  subject: z.string().trim().min(1).max(60).optional(),
  take: z.coerce.number().int().min(1).max(100).default(100),
});

export async function GET(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const parsed = filtersSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid filters." }, { status: 400 });

  if (parsed.data.mode === "roster") {
    if (!canInScope(user.role, "assessments", "view", "assigned") || !parsed.data.grade || !parsed.data.subject || !parsed.data.term) {
      return NextResponse.json({ error: "Choose an assigned class, learning area and term." }, { status: 400 });
    }
    const assignment = await db.teacherAssignment.findUnique({
      where: {
        teacherId_grade_subject: {
          teacherId: user.id,
          grade: parsed.data.grade,
          subject: parsed.data.subject,
        },
      },
      select: { id: true },
    });
    if (!assignment) return NextResponse.json({ error: "This class and learning area are outside your assignment." }, { status: 403 });

    const learners = await db.learner.findMany({
      where: { grade: parsed.data.grade, archivedAt: null, admissionStatus: "APPROVED" },
      select: { id: true, name: true, admissionNo: true, grade: true },
      orderBy: [{ name: "asc" }, { admissionNo: "asc" }],
      take: 500,
    });
    const existingAssessments = learners.length
      ? await db.assessment.findMany({
          where: {
            learnerId: { in: learners.map((learner) => learner.id) },
            subject: parsed.data.subject,
            term: parsed.data.term,
          },
          select: { id: true, learnerId: true, score: true, status: true, strand: true, competency: true },
        })
      : [];
    return NextResponse.json({ learners, existingAssessments });
  }

  const term = parsed.data.term;
  let where: Prisma.AssessmentWhereInput = term ? { term } : {};
  if (canInScope(user.role, "assessments", "view", "school")) {
    // School-scoped academic leaders can see all records.
  } else if (canInScope(user.role, "assessments", "view", "assigned")) {
    const assignments = await db.teacherAssignment.findMany({
      where: { teacherId: user.id },
      select: { grade: true, subject: true },
    });
    if (!assignments.length) return NextResponse.json({ assessments: [] });
    where = {
      ...where,
      OR: assignments.map((assignment) => ({
        subject: assignment.subject,
        learner: { grade: assignment.grade },
      })),
    };
  } else if (
    canInScope(user.role, "assessments", "view", "linked") ||
    canInScope(user.role, "assessments", "view", "self")
  ) {
    const links = await db.guardianLink.findMany({
      where: { userId: user.id, learner: { archivedAt: null, admissionStatus: "APPROVED" } },
      select: { learnerId: true },
    });
    where = { ...where, learnerId: { in: links.map((link) => link.learnerId) }, status: "RELEASED" };
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const assessments = await db.assessment.findMany({
    where,
    select: {
      id: true,
      learnerId: true,
      subject: true,
      score: true,
      term: true,
      strand: true,
      competency: true,
      comment: true,
      status: true,
      version: true,
      learner: { select: { id: true, name: true, admissionNo: true, grade: true } },
    },
    orderBy: [{ term: "desc" }, { subject: "asc" }, { learner: { name: "asc" } }],
    take: parsed.data.take,
  });
  return NextResponse.json({ assessments: assessments.map((item) => ({ ...item, level: cbcLevel(item.score) })) });
}

const entrySchema = z.object({
  learnerId: z.string().min(1),
  subject: z.string().trim().min(2).max(60),
  score: z.number().min(0).max(100),
  term: z.string().regex(/^\d{4} Term [123]$/),
  strand: z.string().trim().max(100).optional(),
  competency: z.string().trim().max(160).optional(),
  comment: z.string().trim().max(500).optional(),
});

const bulkEntrySchema = z.object({
  mode: z.literal("bulk"),
  grade: z.string().trim().min(1).max(40),
  subject: z.string().trim().min(2).max(60),
  term: z.string().regex(/^\d{4} Term [123]$/),
  strand: z.string().trim().max(100).optional(),
  competency: z.string().trim().max(160).optional(),
  comment: z.string().trim().max(500).optional(),
  rows: z.array(z.object({
    learnerId: z.string().min(1),
    score: z.number().min(0).max(100),
  })).min(1).max(500).superRefine((rows, context) => {
    const learnerIds = new Set<string>();
    rows.forEach((row, index) => {
      if (learnerIds.has(row.learnerId)) {
        context.addIssue({ code: "custom", path: [index, "learnerId"], message: "Each learner can appear only once." });
      }
      learnerIds.add(row.learnerId);
    });
  }),
});

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const bulkEnvelope = z.object({ mode: z.literal("bulk") }).passthrough().safeParse(body);
  if (bulkEnvelope.success) {
    if (!canInScope(user.role, "assessments", "create", "assigned")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const parsedBulk = bulkEntrySchema.safeParse(body);
    if (!parsedBulk.success) {
      return NextResponse.json({ error: "Check each mark and ensure the class has no duplicate learners." }, { status: 400 });
    }

    const assignment = await db.teacherAssignment.findUnique({
      where: {
        teacherId_grade_subject: {
          teacherId: user.id,
          grade: parsedBulk.data.grade,
          subject: parsedBulk.data.subject,
        },
      },
      select: { id: true },
    });
    if (!assignment) return NextResponse.json({ error: "This class and learning area are outside your assignment." }, { status: 403 });

    const learners = await db.learner.findMany({
      where: {
        id: { in: parsedBulk.data.rows.map((row) => row.learnerId) },
        grade: parsedBulk.data.grade,
        archivedAt: null,
        admissionStatus: "APPROVED",
      },
      select: { id: true },
    });
    if (learners.length !== parsedBulk.data.rows.length) {
      return NextResponse.json({ error: "One or more learners are no longer in this assigned class." }, { status: 403 });
    }

    try {
      const assessments = await db.$transaction(async (tx) => {
        const created = [];
        for (const mark of parsedBulk.data.rows) {
          const assessment = await tx.assessment.create({
            data: {
              learnerId: mark.learnerId,
              enteredById: user.id,
              subject: parsedBulk.data.subject,
              score: mark.score,
              term: parsedBulk.data.term,
              strand: parsedBulk.data.strand,
              competency: parsedBulk.data.competency,
              comment: parsedBulk.data.comment,
              status: "DRAFT",
            },
          });
          await tx.assessmentHistory.create({
            data: { assessmentId: assessment.id, actorId: user.id, version: 1, newScore: assessment.score },
          });
          await tx.auditEvent.create({
            data: { actorId: user.id, action: "ASSESSMENT_CREATED", entity: "Assessment", entityId: assessment.id },
          });
          created.push(assessment);
        }
        return created;
      });
      return NextResponse.json({
        assessments: assessments.map((assessment) => ({ ...assessment, level: cbcLevel(assessment.score) })),
      }, { status: 201 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return NextResponse.json({ error: "At least one learner already has a mark for this learning area and term. Reload the roster to review it." }, { status: 409 });
      }
      throw error;
    }
  }

  if (!canInScope(user.role, "assessments", "create", "school") && !canInScope(user.role, "assessments", "create", "assigned")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = entrySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the learner, subject, score, term and comments." }, { status: 400 });

  const learner = await db.learner.findUnique({
    where: { id: parsed.data.learnerId },
    select: { id: true, grade: true, archivedAt: true, admissionStatus: true },
  });
  if (!learner || learner.archivedAt || learner.admissionStatus !== "APPROVED") {
    return NextResponse.json({ error: "Learner not found." }, { status: 404 });
  }
  if (canInScope(user.role, "assessments", "create", "assigned")) {
    const assignment = await db.teacherAssignment.findUnique({
      where: {
        teacherId_grade_subject: {
          teacherId: user.id,
          grade: learner.grade,
          subject: parsed.data.subject,
        },
      },
    });
    if (!assignment) return NextResponse.json({ error: "This learner and subject are outside your assignment." }, { status: 403 });
  }
  try {
    const assessment = await db.$transaction(async (tx) => {
      const row = await tx.assessment.create({ data: { ...parsed.data, enteredById: user.id, status: "DRAFT" } });
      await tx.assessmentHistory.create({ data: { assessmentId: row.id, actorId: user.id, version: 1, newScore: row.score } });
      await tx.auditEvent.create({ data: { actorId: user.id, action: "ASSESSMENT_CREATED", entity: "Assessment", entityId: row.id } });
      return row;
    });
    return NextResponse.json({ assessment: { ...assessment, level: cbcLevel(assessment.score) } }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A mark already exists for this learner, subject and term." }, { status: 409 });
    }
    throw error;
  }
}

const updateSchema = z.object({
  id: z.string().min(1),
  score: z.number().min(0).max(100),
  strand: z.string().trim().max(100).optional(),
  competency: z.string().trim().max(160).optional(),
  comment: z.string().trim().max(500).optional(),
});

export async function PATCH(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "assessments", "update", "school") && !canInScope(user.role, "assessments", "update", "assigned")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid mark and comments." }, { status: 400 });
  const old = await db.assessment.findUnique({
    where: { id: parsed.data.id },
    include: { learner: { select: { grade: true } } },
  });
  if (!old) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  if (!["DRAFT", "RETURNED"].includes(old.status)) {
    return NextResponse.json({ error: "Submitted or approved marks are locked." }, { status: 409 });
  }
  if (canInScope(user.role, "assessments", "update", "assigned")) {
    const assignment = await db.teacherAssignment.findUnique({
      where: {
        teacherId_grade_subject: {
          teacherId: user.id,
          grade: old.learner.grade,
          subject: old.subject,
        },
      },
    });
    if (!assignment) return NextResponse.json({ error: "This mark is outside your assignment." }, { status: 403 });
  }
  try {
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.assessment.update({
        where: { id: old.id, version: old.version },
        data: {
          score: parsed.data.score,
          strand: parsed.data.strand,
          competency: parsed.data.competency,
          comment: parsed.data.comment,
          status: "DRAFT",
          reviewComment: null,
          version: { increment: 1 },
        },
      });
      await tx.assessmentHistory.create({
        data: { assessmentId: row.id, actorId: user.id, version: row.version, oldScore: old.score, newScore: row.score },
      });
      await tx.auditEvent.create({ data: { actorId: user.id, action: "ASSESSMENT_UPDATED", entity: "Assessment", entityId: row.id } });
      return row;
    });
    return NextResponse.json({ assessment: updated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "This mark changed in another session. Reload before editing." }, { status: 409 });
    }
    throw error;
  }
}
