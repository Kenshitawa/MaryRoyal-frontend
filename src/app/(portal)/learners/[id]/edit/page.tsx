import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import LearnerEditForm from "./learner-edit-form";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { readSession } from "@/lib/session";

export default async function LearnerEditPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/");

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true }
  });
  if (!user || user.suspended) redirect("/");
  if (user.forcePasswordChange) redirect("/change-password");

  const { id } = await params;

  // STRICT RULE: ONLY SECRETARY AND HEAD_TEACHER CAN EDIT A LEARNER PROFILE
  if (!can(user.role, "learners", "update")) {
    await db.auditEvent.create({
      data: {
        actorId: user.id,
        action: "ACCESS_DENIED",
        entity: "LearnerProfileEditRoute",
        entityId: id
      }
    });
    redirect(`/learners/${id}`);
  }

  const learner = await db.learner.findUnique({
    where: { id },
    include: {
      profile: true
    }
  });

  if (!learner) notFound();

  return (
    <>
      <section className="mx-auto max-w-5xl p-4 pb-28 sm:p-6 md:p-8">
        <LearnerEditForm
          learner={{
            id: learner.id,
            admissionNo: learner.admissionNo,
            name: learner.name,
            grade: learner.grade,
            gender: learner.gender,
            admissionStatus: learner.admissionStatus,
            profile: learner.profile
              ? {
                  stream: learner.profile.stream,
                  upiNumber: learner.profile.upiNumber,
                  dateOfBirth: learner.profile.dateOfBirth?.toISOString() ?? null,
                  nationality: learner.profile.nationality,
                  religion: learner.profile.religion,
                  languagesSpoken: learner.profile.languagesSpoken,
                  county: learner.profile.county,
                  subCounty: learner.profile.subCounty,
                  ward: learner.profile.ward,
                  village: learner.profile.village,
                  physicalAddress: learner.profile.physicalAddress,
                  knownConditions: learner.profile.knownConditions,
                  allergies: learner.profile.allergies,
                  currentMedication: learner.profile.currentMedication,
                  specialNeeds: learner.profile.specialNeeds,
                  bloodGroup: learner.profile.bloodGroup,
                  doctorOrHospital: learner.profile.doctorOrHospital,
                  healthInsurance: learner.profile.healthInsurance
                }
              : null
          }}
        />
      </section>
    </>
  );
}
