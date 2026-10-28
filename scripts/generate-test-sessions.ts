import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { makeSession, makeActivitySession } from "../src/lib/session";

const localTestDatabaseUrl = "file:./round3-e2e.test.db";
const db = new PrismaClient();

const roles = [
  { role: "DIRECTOR", email: "director@maryroyal.ac.ke" },
  { role: "HEAD_TEACHER", email: "headteacher@maryroyal.ac.ke" },
  { role: "DEPUTY", email: "deputy@maryroyal.ac.ke" },
  { role: "SECRETARY", email: "secretary@maryroyal.ac.ke" },
  { role: "ACCOUNTANT", email: "accountant@maryroyal.ac.ke" },
  { role: "TEACHER", email: "teacher@maryroyal.ac.ke" },
  { role: "PARENT", email: "parent@maryroyal.ac.ke" },
  { role: "LEARNER", email: "learner@maryroyal.ac.ke" },
  { role: "WELFARE_CHAIR", email: "welfare@maryroyal.ac.ke" },
  { role: "NON_TEACHING_STAFF", email: "nonteaching@maryroyal.ac.ke" },
];

export async function generateStorageStates(outDir = path.resolve(process.cwd(), "e2e/.auth")) {
  assertLocalTestDatabase();
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Ensure accounts have forcePasswordChange: false and are not locked
  await db.user.updateMany({
    where: { email: { in: roles.map((r) => r.email) } },
    data: { forcePasswordChange: false, failedLogins: 0, suspended: false },
  });

  const domain = "127.0.0.1";
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 8;

  for (const item of roles) {
    const user = await db.user.findUnique({ where: { email: item.email } });
    if (!user) {
      console.warn(`User ${item.email} not found for storageState generation.`);
      continue;
    }

    const sessionToken = await makeSession(user);
    const activityToken = await makeActivitySession(user.id);

    const storageState = {
      cookies: [
        {
          name: "mary_session",
          value: sessionToken,
          domain,
          path: "/",
          expires,
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
        {
          name: "mary_activity",
          value: activityToken,
          domain,
          path: "/",
          expires,
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    };

    const filePath = path.join(outDir, `${item.role.toLowerCase()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(storageState, null, 2));
  }

  // Detail pages need real record ids so the mobile audit can cover every page.
  const teacher = await db.user.findUnique({ where: { email: "teacher@maryroyal.ac.ke" }, select: { id: true } });
  const parent = await db.user.findUnique({ where: { email: "parent@maryroyal.ac.ke" }, select: { id: true } });
  const secretary = await db.user.findUnique({ where: { email: "secretary@maryroyal.ac.ke" }, select: { id: true } });
  const learnerUser = await db.user.findUnique({ where: { email: "learner@maryroyal.ac.ke" }, select: { id: true } });
  const selfLink = learnerUser
    ? await db.guardianLink.findFirst({ where: { userId: learnerUser.id, relation: "Learner" }, orderBy: { createdAt: "asc" } })
    : null;
  const parentLink = parent
    ? await db.guardianLink.findFirst({ where: { userId: parent.id }, include: { learner: true }, orderBy: { createdAt: "asc" } })
    : null;
  const learner = parentLink?.learner ?? (await db.learner.findFirst({ orderBy: { admissionNo: "asc" } }));
  const teacherGrades = teacher
    ? (await db.teacherAssignment.findMany({ where: { teacherId: teacher.id }, select: { grade: true } })).map((row) => row.grade)
    : [];
  const teacherLearner = teacherGrades.length
    ? await db.learner.findFirst({ where: { grade: { in: teacherGrades } }, orderBy: { admissionNo: "asc" } })
    : null;
  const payment = learner
    ? await db.feePayment.findFirst({ where: { invoice: { learnerId: learner.id } }, orderBy: { createdAt: "asc" } })
    : null;
  const secretaryDraft = secretary
    ? await db.admissionDraft.findFirst({ where: { createdById: secretary.id }, orderBy: { createdAt: "asc" } })
    : null;
  const reviewDraft = await db.admissionDraft.findFirst({ where: { status: { not: "DRAFT" } }, orderBy: { createdAt: "asc" } });

  fs.writeFileSync(
    path.join(outDir, "sample-records.json"),
    JSON.stringify(
      {
        learnerId: learner?.id ?? null,
        teacherLearnerId: teacherLearner?.id ?? null,
        selfLearnerId: selfLink?.learnerId ?? null,
        staffId: teacher?.id ?? null,
        secretaryDraftId: secretaryDraft?.id ?? null,
        reviewDraftId: reviewDraft?.id ?? null,
        paymentId: payment?.id ?? null,
      },
      null,
      2,
    ),
  );

  console.log(`Generated Playwright storage states for all ${roles.length} roles in the isolated test environment.`);
}

export function assertLocalTestDatabase(databaseUrl = process.env.DATABASE_URL, isE2E = process.env.MARY_E2E) {
  if (isE2E !== "1" || databaseUrl !== localTestDatabaseUrl) {
    throw new Error("Playwright session generation requires the isolated local E2E database. Run npm run test:e2e.");
  }
}

const scriptPath = path.resolve(process.cwd(), "scripts/generate-test-sessions.ts");
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  generateStorageStates()
    .then(() => db.$disconnect())
    .catch(() => {
      console.error("Could not generate local Playwright sessions. Check that the isolated E2E database is migrated and seeded.");
      db.$disconnect();
      process.exit(1);
    });
}
