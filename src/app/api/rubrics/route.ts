import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";

async function actor() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true }
  });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

const rubricLevelSchema = z.object({
  code: z.string().trim().min(1).max(10), // e.g. EE, ME, AE, BE, EE1, EE2
  label: z.string().trim().min(2).max(60),
  minScore: z.number().min(0).max(100),
  maxScore: z.number().min(0).max(100),
  descriptor: z.string().trim().min(3).max(300),
  color: z.string().trim().min(3).max(30),
  learningArea: z.string().trim().optional(),
  gradeBand: z.string().trim().optional()
});

const rubricBatchSchema = z.object({
  levels: z.array(rubricLevelSchema).min(2),
  effectiveDate: z.string().optional()
});

export async function GET() {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "rubrics", "view", "school")) {
    await db.auditEvent.create({
      data: { actorId: user.id, action: "ACCESS_DENIED", entity: "CbcRubric" }
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rubrics = await db.cbcRubric.findMany({
    where: { active: true },
    orderBy: [{ minScore: "desc" }],
    include: { createdBy: { select: { id: true, name: true } } }
  });

  // Also count how many marks currently exist in the system to preview impact of changing boundaries
  const totalAssessments = await db.assessment.count();

  return NextResponse.json({ rubrics, totalAssessments });
}

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "rubrics", "create", "school")) {
    await db.auditEvent.create({
      data: { actorId: user.id, action: "ACCESS_DENIED", entity: "CbcRubric" }
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = rubricBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check rubric level codes, scores, and descriptors." }, { status: 400 });
  }

  const { levels, effectiveDate } = parsed.data;

  // Calculate impact before saving
  const existingCount = await db.assessment.count();

  const createdRubrics = await db.$transaction(async (tx) => {
    // Find highest current version
    const latest = await tx.cbcRubric.findFirst({
      orderBy: { version: "desc" },
      select: { version: true }
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    // Deactivate previous active versions
    await tx.cbcRubric.updateMany({
      where: { active: true },
      data: { active: false }
    });

    // Also sync the core CbcLevel table for backwards compatibility
    await tx.cbcLevel.deleteMany();

    const created = [];
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const rubric = await tx.cbcRubric.create({
        data: {
          version: nextVersion,
          code: level.code,
          label: level.label,
          minScore: level.minScore,
          maxScore: level.maxScore,
          descriptor: level.descriptor,
          color: level.color,
          learningArea: level.learningArea || null,
          gradeBand: level.gradeBand || null,
          effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
          active: true,
          createdById: user.id
        }
      });
      created.push(rubric);

      // Keep legacy cbcLevel in sync
      await tx.cbcLevel.create({
        data: {
          code: level.code,
          label: level.label,
          minScore: level.minScore,
          maxScore: level.maxScore,
          descriptor: level.descriptor,
          sortOrder: i + 1,
          active: true
        }
      });
    }

    await tx.auditEvent.create({
      data: {
        actorId: user.id,
        action: "CBC_RUBRIC_CONFIGURED",
        entity: "CbcRubric",
        entityId: `v${nextVersion}`,
      }
    });

    return created;
  });

  return NextResponse.json({
    rubrics: createdRubrics,
    impact: { assessmentsImpacted: existingCount }
  }, { status: 201 });
}
