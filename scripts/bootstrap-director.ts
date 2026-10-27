import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const database = new PrismaClient();
const cbcLevels = [
  { code: "EE", label: "Exceeding Expectations", minScore: 80, maxScore: 100, descriptor: "Consistently exceeds the expected competency", sortOrder: 1 },
  { code: "ME", label: "Meeting Expectations", minScore: 60, maxScore: 79.99, descriptor: "Demonstrates the expected competency", sortOrder: 2 },
  { code: "AE", label: "Approaching Expectations", minScore: 40, maxScore: 59.99, descriptor: "Is developing the expected competency", sortOrder: 3 },
  { code: "BE", label: "Below Expectations", minScore: 0, maxScore: 39.99, descriptor: "Needs additional support to develop the competency", sortOrder: 4 },
] as const;

async function main() {
  const name = process.env.DIRECTOR_NAME?.trim();
  const email = process.env.DIRECTOR_EMAIL?.trim().toLowerCase();
  const password = process.env.DIRECTOR_PASSWORD;
  const bootstrapToken = process.env.DIRECTOR_BOOTSTRAP_TOKEN;
  if (!bootstrapToken || bootstrapToken.length < 32) {
    throw new Error("Set a one-time DIRECTOR_BOOTSTRAP_TOKEN of at least 32 characters in the trusted command environment.");
  }
  if (!name || name.length < 2 || name.length > 100 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Set valid DIRECTOR_NAME and DIRECTOR_EMAIL values for the one-time bootstrap.");
  }
  if (!password || password.length < 16 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new Error("DIRECTOR_PASSWORD must be at least 16 characters and include upper/lowercase letters, a number, and a symbol.");
  }

  const count = await database.user.count();
  if (count > 0) throw new Error("Bootstrap stopped: this database already contains an account. Use normal account management instead.");

  const passwordHash = await bcrypt.hash(password, 12);
  await database.$transaction(async tx => {
    await tx.user.create({ data: { name, email, passwordHash, role: Role.DIRECTOR, forcePasswordChange: true } });
    await tx.schoolSetting.createMany({ data: [
      { key: "school.profile", value: JSON.stringify({ name: "Mary Royal Junior School", motto: "Hard work pays", slogan: "Nurturing Excellence Through CBE", county: "Kisumu", area: "Obunga", currency: "KES", timezone: "Africa/Nairobi" }) },
      { key: "school.academicSetup", value: JSON.stringify({ years: [], terms: [], classes: [], streams: [], subjects: [], feeStructures: [] }) },
    ] });
    await tx.cbcLevel.createMany({ data: [...cbcLevels] });
  });
  console.log("Initial Director and school defaults created. Remove the bootstrap password from the environment and sign in to change it.");
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Director bootstrap failed.");
  process.exitCode = 1;
}).finally(async () => database.$disconnect());
