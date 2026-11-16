import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { assertCanInScope } from "@/lib/permissions";
import { completedAdmissionSchema } from "@/lib/admissions";
import { readSession } from "@/lib/session";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended || user.forcePasswordChange) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try { assertCanInScope(user.role, "admissions", "submit", "school"); } catch { await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "AdmissionDraft" } }); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  try { const body: unknown = await request.json(); if (JSON.stringify(body) !== "{}") return NextResponse.json({ error: "Invalid request." }, { status: 400 }); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { id } = await params;
  const draft = await db.admissionDraft.findUnique({ where: { id }, include: { documents: { select: { category: true } } } });
  if (!draft) return NextResponse.json({ error: "Admission draft not found." }, { status: 404 });
  if (user.role === "SECRETARY" && draft.createdById !== user.id) { await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "AdmissionDraft", entityId: id } }); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  if (draft.status !== "DRAFT") return NextResponse.json({ error: "This admission has already been submitted." }, { status: 409 });
  let rawPayload: unknown;
  try { rawPayload = JSON.parse(draft.payload) as unknown; } catch { rawPayload = {}; }
  const parsed = completedAdmissionSchema.safeParse(rawPayload);
  if (!parsed.success) return NextResponse.json({ error: "Complete the required details before submitting.", issues: parsed.error.issues.map(issue => ({ path: issue.path, message: issue.message })) }, { status: 400 });
  const form = parsed.data;
  const missingDocuments = ["PASSPORT_PHOTO", "BIRTH_CERTIFICATE"].filter(category => !draft.documents.some(document => document.category === category));
  try {
    const learner = await db.$transaction(async tx => {
      let learnerId = draft.learnerId;
      if (learnerId) {
        const provisional = await tx.learner.findUnique({
          where: { id: learnerId },
          select: { id: true, archivedAt: true, admissionStatus: true },
        });
        if (!provisional || provisional.archivedAt || provisional.admissionStatus !== "PENDING") {
          throw new Error("PROVISIONAL_LEARNER_UNAVAILABLE");
        }
        await tx.learner.update({
          where: { id: learnerId },
          data: {
            admissionNo: draft.admissionNo,
            name: form.learner.fullName,
            grade: form.learner.grade,
            gender: form.learner.gender,
          },
        });
      } else {
        const created = await tx.learner.create({ data: {
          admissionNo: draft.admissionNo,
          name: form.learner.fullName,
          grade: form.learner.grade,
          gender: form.learner.gender,
          admissionStatus: "PENDING",
        }, select: { id: true } });
        learnerId = created.id;
      }

      const profileFields = {
        dateOfBirth: new Date(`${form.learner.dateOfBirth}T00:00:00.000Z`),
        nationality: form.learner.nationality,
        upiNumber: form.learner.upiNumber || null,
        stream: form.learner.stream || null,
        admissionDate: new Date(`${form.learner.admissionDate}T00:00:00.000Z`),
        previousSchool: form.learner.previousSchool || null,
        previousClass: form.learner.previousClass || null,
        reasonForLeaving: form.learner.reasonForLeaving || null,
        religion: form.learner.religion || null,
        languagesSpoken: form.learner.languagesSpoken.join(", "),
        county: form.residence.county,
        subCounty: form.residence.subCounty,
        ward: form.residence.ward,
        village: form.residence.village,
        physicalAddress: form.residence.physicalAddress,
        landmark: form.residence.landmark || null,
        distanceToSchoolKm: form.residence.distanceToSchoolKm ?? null,
        transportMeans: form.residence.transportMeans || null,
        latitude: form.residence.latitude ?? null,
        longitude: form.residence.longitude ?? null,
        knownConditions: form.health.knownConditions || null,
        allergies: form.health.allergies || null,
        currentMedication: form.health.currentMedication || null,
        specialNeeds: form.health.specialNeeds || null,
        bloodGroup: form.health.bloodGroup || null,
        doctorOrHospital: form.health.doctorOrHospital || null,
        immunizationStatus: form.health.immunizationStatus || null,
        healthInsurance: form.health.healthInsurance || null,
        feePayer: form.fee.feePayerGuardian,
      };
      const guardians = form.guardians.map(person => ({
        ...person,
        idNumber: person.idNumber || null,
        alternatePhone: person.alternatePhone || null,
        email: person.email || null,
        occupation: person.occupation || null,
        employer: person.employer || null,
        homeAddress: person.homeAddress || null,
        workAddress: person.workAddress || null,
      }));
      await tx.learnerProfile.upsert({
        where: { learnerId },
        create: {
          learnerId,
          ...profileFields,
          consentAt: new Date(),
          guardians: { create: guardians },
          emergencyContacts: { create: form.emergencyContacts },
          pickupPersons: { create: form.pickupPersons },
        },
        update: {
          ...profileFields,
          guardians: { deleteMany: {}, create: guardians },
          emergencyContacts: { deleteMany: {}, create: form.emergencyContacts },
          pickupPersons: { deleteMany: {}, create: form.pickupPersons },
        },
      });

      const submitted = await tx.admissionDraft.updateMany({
        where: { id: draft.id, status: "DRAFT" },
        data: { status: "SUBMITTED", learnerId, submittedAt: new Date() },
      });
      if (submitted.count !== 1) throw new Error("ADMISSION_ALREADY_SUBMITTED");
      const created = await tx.learner.findUniqueOrThrow({
        where: { id: learnerId },
        select: { id: true, admissionNo: true, name: true, grade: true, gender: true, admissionStatus: true },
      });
      await tx.auditEvent.create({ data: { actorId: user.id, action: "ADMISSION_SUBMITTED", entity: "AdmissionDraft", entityId: draft.id } });
      if (!draft.learnerId) {
        await tx.auditEvent.create({ data: { actorId: user.id, action: "LEARNER_CREATED_FROM_ADMISSION", entity: "Learner", entityId: created.id } });
      }
      return created;
    });
    return NextResponse.json({ learner, draft: { id: draft.id, admissionNo: draft.admissionNo, status: "SUBMITTED" }, missingDocuments }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error.message === "PROVISIONAL_LEARNER_UNAVAILABLE" || error.message === "ADMISSION_ALREADY_SUBMITTED")) {
      return NextResponse.json({ error: "This admission is no longer available to submit. Reload and check its status." }, { status: 409 });
    }
    throw error;
  }
}
