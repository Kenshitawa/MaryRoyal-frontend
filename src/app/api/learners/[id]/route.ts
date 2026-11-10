import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { readSession } from "@/lib/session";

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  grade: z.string().min(1).max(50).optional(),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
  admissionStatus: z.enum(["PENDING", "APPROVED", "REJECTED", "TRANSFERRED", "WITHDRAWN"]).optional(),
  stream: z.string().max(50).optional().nullable(),
  upiNumber: z.string().max(50).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  nationality: z.string().max(60).optional().nullable(),
  religion: z.string().max(60).optional().nullable(),
  languagesSpoken: z.string().max(120).optional().nullable(),
  county: z.string().max(80).optional().nullable(),
  subCounty: z.string().max(80).optional().nullable(),
  ward: z.string().max(80).optional().nullable(),
  village: z.string().max(80).optional().nullable(),
  physicalAddress: z.string().max(200).optional().nullable(),
  knownConditions: z.string().max(300).optional().nullable(),
  allergies: z.string().max(300).optional().nullable(),
  currentMedication: z.string().max(300).optional().nullable(),
  specialNeeds: z.string().max(300).optional().nullable(),
  bloodGroup: z.string().max(10).optional().nullable(),
  doctorOrHospital: z.string().max(120).optional().nullable(),
  healthInsurance: z.string().max(80).optional().nullable()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true }
  });
  if (!user || user.suspended || user.forcePasswordChange) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await params;

  // STRICT RULE: ONLY SECRETARY AND HEAD_TEACHER CAN EDIT A LEARNER PROFILE
  if (!can(user.role, "learners", "update")) {
    await db.auditEvent.create({
      data: {
        actorId: user.id,
        action: "ACCESS_DENIED",
        entity: "Learner",
        entityId: id
      }
    });
    return NextResponse.json(
      { error: "Forbidden: Learner profile editing is strictly restricted to Secretary and Head Teacher." },
      { status: 403 }
    );
  }

  const learner = await db.learner.findUnique({
    where: { id },
    include: { profile: true }
  });
  if (!learner) return NextResponse.json({ error: "Learner not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
  }

  const data = parsed.data;

  // Track differences for audit log
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  if (data.name !== undefined && data.name !== learner.name) changes.name = { old: learner.name, new: data.name };
  if (data.grade !== undefined && data.grade !== learner.grade) changes.grade = { old: learner.grade, new: data.grade };
  if (data.gender !== undefined && data.gender !== learner.gender) changes.gender = { old: learner.gender, new: data.gender };
  if (data.admissionStatus !== undefined && data.admissionStatus !== learner.admissionStatus) {
    changes.admissionStatus = { old: learner.admissionStatus, new: data.admissionStatus };
  }

  const profile = learner.profile;
  const profileFields = [
    "stream", "upiNumber", "nationality", "religion", "languagesSpoken",
    "county", "subCounty", "ward", "village", "physicalAddress",
    "knownConditions", "allergies", "currentMedication", "specialNeeds",
    "bloodGroup", "doctorOrHospital", "healthInsurance"
  ] as const;

  for (const field of profileFields) {
    if (data[field] !== undefined) {
      const oldVal = profile ? (profile as Record<string, unknown>)[field] : null;
      if (oldVal !== data[field]) {
        changes[field] = { old: oldVal, new: data[field] };
      }
    }
  }

  if (data.dateOfBirth !== undefined) {
    const newDob = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    const oldDob = profile?.dateOfBirth?.toISOString().slice(0, 10);
    const newDobStr = newDob?.toISOString().slice(0, 10);
    if (oldDob !== newDobStr) {
      changes.dateOfBirth = { old: oldDob, new: newDobStr };
    }
  }

  // Perform updates in transaction
  const updated = await db.$transaction(async (tx) => {
    const updatedLearner = await tx.learner.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.grade ? { grade: data.grade } : {}),
        ...(data.gender ? { gender: data.gender } : {}),
        ...(data.admissionStatus ? { admissionStatus: data.admissionStatus } : {})
      }
    });

    const profileData = {
      ...(data.stream !== undefined ? { stream: data.stream } : {}),
      ...(data.upiNumber !== undefined ? { upiNumber: data.upiNumber } : {}),
      ...(data.dateOfBirth !== undefined ? { dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null } : {}),
      ...(data.nationality !== undefined ? { nationality: data.nationality ?? "Kenyan" } : {}),
      ...(data.religion !== undefined ? { religion: data.religion } : {}),
      ...(data.languagesSpoken !== undefined ? { languagesSpoken: data.languagesSpoken ?? "" } : {}),
      ...(data.county !== undefined ? { county: data.county ?? "" } : {}),
      ...(data.subCounty !== undefined ? { subCounty: data.subCounty ?? "" } : {}),
      ...(data.ward !== undefined ? { ward: data.ward ?? "" } : {}),
      ...(data.village !== undefined ? { village: data.village ?? "" } : {}),
      ...(data.physicalAddress !== undefined ? { physicalAddress: data.physicalAddress ?? "" } : {}),
      ...(data.knownConditions !== undefined ? { knownConditions: data.knownConditions } : {}),
      ...(data.allergies !== undefined ? { allergies: data.allergies } : {}),
      ...(data.currentMedication !== undefined ? { currentMedication: data.currentMedication } : {}),
      ...(data.specialNeeds !== undefined ? { specialNeeds: data.specialNeeds } : {}),
      ...(data.bloodGroup !== undefined ? { bloodGroup: data.bloodGroup } : {}),
      ...(data.doctorOrHospital !== undefined ? { doctorOrHospital: data.doctorOrHospital } : {}),
      ...(data.healthInsurance !== undefined ? { healthInsurance: data.healthInsurance } : {})
    };

    if (profile) {
      await tx.learnerProfile.update({
        where: { id: profile.id },
        data: profileData
      });
    } else {
      await tx.learnerProfile.create({
        data: {
          learnerId: id,
          ...profileData
        }
      });
    }

    await tx.auditEvent.create({
      data: {
        actorId: user.id,
        action: "LEARNER_PROFILE_UPDATED",
        entity: "Learner",
        entityId: id
      }
    });

    return updatedLearner;
  });

  return NextResponse.json({ ok: true, learner: updated });
}
