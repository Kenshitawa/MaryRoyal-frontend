import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createStaffWelfareMember } from "../src/lib/welfare";

const db = new PrismaClient();
const cbcDefaults = [
  { code: "EE", label: "Exceeding Expectations", minScore: 80, maxScore: 100, descriptor: "Consistently exceeds the expected competency", sortOrder: 1 },
  { code: "ME", label: "Meeting Expectations", minScore: 60, maxScore: 79.99, descriptor: "Demonstrates the expected competency", sortOrder: 2 },
  { code: "AE", label: "Approaching Expectations", minScore: 40, maxScore: 59.99, descriptor: "Is developing the expected competency", sortOrder: 3 },
  { code: "BE", label: "Below Expectations", minScore: 0, maxScore: 39.99, descriptor: "Needs additional support to develop the competency", sortOrder: 4 }
] as const;

async function main() {
  const passwordHash = await bcrypt.hash("MaryRoyal2026!", 12);
  await db.user.upsert({
    where: { email: "director@maryroyal.ac.ke" },
    create: { name: "Mary Royal Director", email: "director@maryroyal.ac.ke", passwordHash, role: Role.DIRECTOR, forcePasswordChange: true },
    update: {}
  });
  const director = await db.user.findUniqueOrThrow({ where: { email: "director@maryroyal.ac.ke" }, select: { id: true } });
  const existingStaff = await db.user.findMany({
    where: { role: { notIn: [Role.PARENT, Role.LEARNER] } },
    select: { id: true, role: true },
  });
  for (const staff of existingStaff) {
    await db.$transaction((tx) => createStaffWelfareMember(tx, staff.id, staff.role, director.id));
  }
  await db.schoolSetting.upsert({
    where: { key: "school.profile" },
    create: { key: "school.profile", value: JSON.stringify({ name: "Mary Royal Junior School", motto: "Hard work pays", slogan: "Nurturing Excellence Through CBE", county: "Kisumu", area: "Obunga", currency: "KES", timezone: "Africa/Nairobi" }) },
    update: {}
  });
  await db.schoolSetting.upsert({
    where: { key: "school.academicSetup" },
    create: { key: "school.academicSetup", value: JSON.stringify({ years: [], terms: [], classes: [], streams: [], subjects: [], feeStructures: [] }) },
    update: {}
  });
  for (const level of cbcDefaults) {
    await db.cbcLevel.upsert({ where: { code: level.code }, create: level, update: {} });
  }
}

main().finally(() => db.$disconnect());
