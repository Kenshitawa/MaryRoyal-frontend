import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

type LearnerAccountSource = {
  id: string;
  name: string;
  admissionNo: string;
};

export async function provisionLearnerAccount(
  tx: Prisma.TransactionClient,
  actorId: string,
  learner: LearnerAccountSource,
) {
  const existingLink = await tx.guardianLink.findFirst({
    where: { learnerId: learner.id, relation: "Learner" },
    select: { id: true },
  });
  if (existingLink) throw new Error("LEARNER_LOGIN_EXISTS");

  let email: string;
  if (learner.name.startsWith("E2E")) {
    email = `${learner.admissionNo.toLowerCase()}@learners.maryroyal.ac.ke`;
  } else {
    const rawFirst = learner.name.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") || "learner";
    const candidate = `${rawFirst}@learners.maryroyal.ac.ke`;
    const inUse = await tx.user.findUnique({ where: { email: candidate }, select: { id: true } });
    email = inUse
      ? `${rawFirst}.${learner.admissionNo.toLowerCase().replace(/[^a-z0-9]/g, "")}@learners.maryroyal.ac.ke`
      : candidate;
  }

  const temporaryPassword = randomBytes(18).toString("base64url");
  const user = await tx.user.create({
    data: {
      name: learner.name,
      email,
      passwordHash: await bcrypt.hash(temporaryPassword, 12),
      role: "LEARNER",
      forcePasswordChange: true,
    },
  });
  await tx.guardianLink.create({
    data: { userId: user.id, learnerId: learner.id, relation: "Learner" },
  });
  await tx.auditEvent.create({
    data: { actorId, action: "LEARNER_LOGIN_CREATED", entity: "Learner", entityId: learner.id },
  });

  return {
    account: { id: user.id, email: user.email, suspended: user.suspended },
    temporaryPassword,
  };
}
