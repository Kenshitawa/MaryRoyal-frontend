import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { admissionDraftDataSchema, mergeAdmissionData, provisionalLearnerSchema } from "@/lib/admissions";
import { provisionLearnerAccount } from "@/lib/learner-accounts";

const requestSchema = z.object({
  learner: provisionalLearnerSchema,
  consent: z.literal(true),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const actor = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true },
  });
  if (!actor || actor.suspended || actor.forcePasswordChange) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!canInScope(actor.role, "admissions", "update", "school") ||
      !canInScope(actor.role, "learnerAccounts", "create", "school")) {
    await db.auditEvent.create({
      data: { actorId: actor.id, action: "ACCESS_DENIED", entity: "LearnerLogin" },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the learner's name, date of birth, gender, class and consent." }, { status: 400 });
  }

  const { id } = await params;
  const draft = await db.admissionDraft.findUnique({
    where: { id },
    select: { id: true, admissionNo: true, payload: true, status: true, learnerId: true },
  });
  if (!draft) return NextResponse.json({ error: "Admission draft not found." }, { status: 404 });
  if (draft.status !== "DRAFT" || draft.learnerId) {
    return NextResponse.json({ error: "This admission already has a learner record or is no longer open." }, { status: 409 });
  }

  let savedPayload;
  try {
    const currentPayload = admissionDraftDataSchema.parse(JSON.parse(draft.payload));
    savedPayload = mergeAdmissionData(currentPayload, {
      learner: parsed.data.learner,
      consent: parsed.data.consent,
    });
  } catch {
    return NextResponse.json({ error: "This admission draft could not be read. Reload it before creating the account." }, { status: 409 });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const current = await tx.admissionDraft.findUnique({
        where: { id: draft.id },
        select: { id: true, admissionNo: true, status: true, learnerId: true },
      });
      if (!current || current.status !== "DRAFT" || current.learnerId) {
        throw new Error("ADMISSION_NO_LONGER_OPEN");
      }

      const learner = await tx.learner.create({
        data: {
          admissionNo: current.admissionNo,
          name: parsed.data.learner.fullName,
          grade: parsed.data.learner.grade,
          gender: parsed.data.learner.gender,
          admissionStatus: "PENDING",
          profile: {
            create: {
              dateOfBirth: new Date(`${parsed.data.learner.dateOfBirth}T00:00:00.000Z`),
              nationality: parsed.data.learner.nationality,
              upiNumber: parsed.data.learner.upiNumber || null,
              stream: parsed.data.learner.stream || null,
              admissionDate: new Date(`${parsed.data.learner.admissionDate}T00:00:00.000Z`),
              consentAt: new Date(),
            },
          },
        },
        select: { id: true, admissionNo: true, name: true, grade: true, gender: true, admissionStatus: true },
      });

      const linked = await tx.admissionDraft.updateMany({
        where: { id: current.id, status: "DRAFT", learnerId: null },
        data: { learnerId: learner.id, payload: JSON.stringify(savedPayload), currentStep: 1 },
      });
      if (linked.count !== 1) throw new Error("ADMISSION_NO_LONGER_OPEN");

      const login = await provisionLearnerAccount(tx, actor.id, learner);
      await tx.auditEvent.create({
        data: { actorId: actor.id, action: "LEARNER_CREATED_FROM_ADMISSION", entity: "Learner", entityId: learner.id },
      });
      return { learner, ...login };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A learner account with these details already exists." }, { status: 409 });
    }
    if (error instanceof Error && (error.message === "LEARNER_LOGIN_EXISTS" || error.message === "ADMISSION_NO_LONGER_OPEN")) {
      return NextResponse.json({ error: "This admission already has a learner account or is no longer open." }, { status: 409 });
    }
    throw error;
  }
}
