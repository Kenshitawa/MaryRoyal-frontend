import { readFile, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const cbcDefaults = [
  { code: "EE", label: "Exceeding Expectations", minScore: 80, maxScore: 100, descriptor: "Consistently exceeds the expected competency", sortOrder: 1 },
  { code: "ME", label: "Meeting Expectations", minScore: 60, maxScore: 79.99, descriptor: "Demonstrates the expected competency", sortOrder: 2 },
  { code: "AE", label: "Approaching Expectations", minScore: 40, maxScore: 59.99, descriptor: "Is developing the expected competency", sortOrder: 3 },
  { code: "BE", label: "Below Expectations", minScore: 0, maxScore: 39.99, descriptor: "Needs additional support to develop the competency", sortOrder: 4 }
] as const;

async function main() {
  const env = await readFile(resolve(process.cwd(), ".env"), "utf8").catch(() => "");
  const databaseUrl = process.env.DATABASE_URL ?? env.match(/^DATABASE_URL\s*=\s*["']?([^\r\n"']+)/m)?.[1];
  if (!databaseUrl?.startsWith("file:")) throw new Error("Fresh reset is restricted to the local SQLite database. No school data was changed.");

  if (!process.argv.includes("--yes")) {
    const prompt = createInterface({ input, output });
    const answer = await prompt.question("This permanently deletes local school demo and operational data. Type RESET to continue: ");
    prompt.close();
    if (answer.trim() !== "RESET") { console.log("Reset cancelled. No data was changed."); return; }
  }

  const db = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const demoOnly = process.argv.includes("--demo-only");
    const preserveDirector = demoOnly || process.argv.includes("--preserve-director");
    const director = preserveDirector
      ? await db.user.findFirst({ where: { role: "DIRECTOR" }, select: { id: true } })
      : await db.user.findUnique({ where: { email: "director@maryroyal.ac.ke" }, select: { id: true } });
    if (preserveDirector && !director) throw new Error("The existing Director account is required for a credentials-preserving local reset.");
    const preservedUserIds = director ? [director.id] : [];
    if (demoOnly) {
      const learners = await db.learner.findMany({ select: { admissionNo: true } });
      if (learners.length !== 30 || learners.some(learner => !/^MR-2026-(?:00[1-9]|0[12]\d|030)$/.test(learner.admissionNo))) {
        throw new Error("Demo-only cleanup requires the original thirty local seed learners. No data was changed.");
      }
      const seedEmails = ["director", "headteacher", "deputy", "secretary", "accountant", "teacher", "parent", "learner", "welfare", "nonteaching"].map(name => `${name}@maryroyal.ac.ke`);
      const users = await db.user.findMany({ select: { id: true, email: true, role: true, learnerLinks: { select: { learner: { select: { admissionNo: true } } } } } });
      for (const user of users) {
        const generatedDemoLearner = user.role === "LEARNER" && user.email.endsWith("@learners.maryroyal.ac.ke") && user.learnerLinks.length > 0 && user.learnerLinks.every(link => /^MR-2026-\d{3}$/.test(link.learner.admissionNo));
        if (!seedEmails.includes(user.email) && !generatedDemoLearner) preservedUserIds.push(user.id);
      }
    }
    const passwordHash = await bcrypt.hash("MaryRoyal2026!", 12);
    await db.$transaction(async tx => {
      await tx.complaintReply.deleteMany();
      await tx.complaint.deleteMany();
      await tx.learningVideoWatch.deleteMany();
      await tx.assignmentSubmission.deleteMany();
      await tx.assessmentHistory.deleteMany();
      await tx.feePaymentHistory.deleteMany();
      await tx.feeCredit.deleteMany();
      await tx.feePayment.deleteMany();
      await tx.invoiceLine.deleteMany();
      await tx.feeInvoice.deleteMany();
      await tx.feeStructureLine.deleteMany();
      await tx.feeStructure.deleteMany();
      await tx.payrollHistory.deleteMany();
      await tx.payrollEntry.deleteMany();
      await tx.feeExpense.deleteMany();
      await tx.assessment.deleteMany();
      await tx.assignment.deleteMany();
      await tx.learningGameAttempt.deleteMany();
      await tx.learningResource.deleteMany();
      await tx.teachingLog.deleteMany();
      await tx.attendance.deleteMany();
      await tx.staffAttendance.deleteMany();
      await tx.disciplineIncident.deleteMany();
      await tx.examSession.deleteMany();
      await tx.cbcRubric.deleteMany();
      await tx.feeWaiver.deleteMany();
      await tx.textbookIssue.deleteMany();
      await tx.textbook.deleteMany();
      await tx.schemeOfWork.deleteMany();
      await tx.schoolTimetable.deleteMany();
      await tx.welfareLoan.deleteMany();
      await tx.welfareContribution.deleteMany();
      await tx.welfareProduct.deleteMany();
      await tx.welfareMember.deleteMany();
      await tx.notification.deleteMany();
      await tx.learningVideo.deleteMany();
      await tx.teacherAssignment.deleteMany();
      await tx.classTeacherAssignment.deleteMany();
      await tx.admissionDocument.deleteMany();
      await tx.admissionDraft.deleteMany();
      await tx.learnerPickupPerson.deleteMany();
      await tx.learnerEmergencyContact.deleteMany();
      await tx.learnerGuardian.deleteMany();
      await tx.learnerProfile.deleteMany();
      await tx.guardianLink.deleteMany();
      await tx.learner.deleteMany();
      await tx.auditEvent.deleteMany();
      if (!demoOnly) {
        await tx.schoolSetting.deleteMany();
        await tx.cbcLevel.deleteMany();
      }
      await tx.admissionCounter.deleteMany();
      await tx.receiptCounter.deleteMany();
      await tx.user.deleteMany({ where: preservedUserIds.length ? { id: { notIn: preservedUserIds } } : { email: { not: "director@maryroyal.ac.ke" } } });
      if (director && !preserveDirector) await tx.user.update({ where: { id: director.id }, data: { name: "Mary Royal Director", role: "DIRECTOR", passwordHash, forcePasswordChange: true, suspended: false, failedLogins: 0, avatarUrl: null } });
      else if (!director) await tx.user.create({ data: { name: "Mary Royal Director", email: "director@maryroyal.ac.ke", passwordHash, role: "DIRECTOR", forcePasswordChange: true } });
      if (!demoOnly) {
        await tx.schoolSetting.createMany({ data: [
          { key: "school.profile", value: JSON.stringify({ name: "Mary Royal Junior School", motto: "Hard work pays", slogan: "Nurturing Excellence Through CBE", county: "Kisumu", area: "Obunga", currency: "KES", timezone: "Africa/Nairobi" }) },
          { key: "school.academicSetup", value: JSON.stringify({ years: [], terms: [], classes: [], streams: [], subjects: [], feeStructures: [] }) }
        ] });
        await tx.cbcLevel.createMany({ data: [...cbcDefaults] });
      }
    });
    for (const relativeDir of demoOnly ? [] : ["private-uploads", "public/uploads"]) {
      const directory = resolve(process.cwd(), relativeDir);
      const workspaceRoot = `${resolve(process.cwd())}${sep}`;
      if (directory.startsWith(workspaceRoot)) await rm(directory, { recursive: true, force: true });
    }
    console.log(demoOnly
      ? "Local demo school records cleared. Director credentials, non-demo accounts, settings and uploaded files preserved."
      : preserveDirector
        ? "Local school data and local uploads cleared. Existing Director account and credentials preserved; school identity and CBC defaults restored."
        : "Local school data and local uploads cleared. The Director requires first-login setup; school identity and CBC defaults restored.");
  } finally { await db.$disconnect(); }
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Fresh reset failed."); process.exitCode = 1; });
