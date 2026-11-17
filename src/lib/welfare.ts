import { Role, type Prisma } from "@prisma/client";

export async function createStaffWelfareMember(
  tx: Prisma.TransactionClient,
  userId: string,
  role: Role,
  actorId: string,
) {
  if (role === Role.PARENT || role === Role.LEARNER) return null;

  const existing = await tx.welfareMember.findUnique({ where: { userId }, select: { id: true } });
  if (existing) return existing;

  const member = await tx.welfareMember.create({ data: { userId } });
  await tx.auditEvent.create({
    data: {
      actorId,
      action: "STAFF_WELFARE_PROFILE_CREATED",
      entity: "WelfareMember",
      entityId: member.id,
    },
  });
  await tx.notification.create({
    data: {
      userId,
      title: "Staff welfare profile opened",
      message: "A zero-balance welfare profile is ready. No savings or salary deductions have been made.",
      type: "INFO",
      link: "/welfare",
    },
  });
  return member;
}
