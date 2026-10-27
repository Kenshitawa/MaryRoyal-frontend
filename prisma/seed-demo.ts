import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
const db = new PrismaClient();
async function main() {
  const accounts = [
    ["director@maryroyal.ac.ke", "Mary Royal Director", Role.DIRECTOR],
    ["headteacher@maryroyal.ac.ke", "Demo Head Teacher", Role.HEAD_TEACHER],
    ["deputy@maryroyal.ac.ke", "Demo Deputy Head", Role.DEPUTY],
    ["secretary@maryroyal.ac.ke", "Demo Secretary", Role.SECRETARY],
    ["accountant@maryroyal.ac.ke", "Demo Accountant", Role.ACCOUNTANT],
    ["teacher@maryroyal.ac.ke", "Demo Teacher", Role.TEACHER],
    ["parent@maryroyal.ac.ke", "Demo Parent", Role.PARENT],
    ["learner@maryroyal.ac.ke", "Demo Learner", Role.LEARNER]
  ] as const;
  const passwordHash = await bcrypt.hash("MaryRoyal2026!", 12);
  for (const [email, name, role] of accounts) {
    await db.user.upsert({ where: { email }, create: { name, email, passwordHash, role, forcePasswordChange: true }, update: { name, passwordHash, role, forcePasswordChange: true, suspended: false, failedLogins: 0 } });
  }
  const roster = [
    ["Achieng Otieno","Female"],["Brian Ouma","Male"],["Faith Akoth","Female"],["Kevin Onyango","Male"],["Lilian Atieno","Female"],
    ["Moses Odhiambo","Male"],["Joyce Auma","Female"],["Collins Ochieng","Male"],["Esther Anyango","Female"],["David Omondi","Male"],
    ["Mercy Adhiambo","Female"],["Peter Ouma","Male"],["Ruth Akinyi","Female"],["Samuel Okoth","Male"],["Brenda Awino","Female"],
    ["Dennis Otieno","Male"],["Grace Atieno","Female"],["Mark Ochieng","Male"],["Diana Auma","Female"],["Victor Onyango","Male"],
    ["Sarah Akoth","Female"],["George Odhiambo","Male"],["Leah Anyango","Female"],["Felix Omondi","Male"],["Cynthia Adhiambo","Female"],
    ["Eric Ouma","Male"],["Naomi Akinyi","Female"],["Joseph Okoth","Male"],["Stella Awino","Female"],["Martin Otieno","Male"]
  ] as const;
  for (const [index, [name, gender]] of roster.entries()) {
    const grade = `Grade ${Math.floor(index / 10) + 4}`;
    const admissionNo = `MR-2026-${String(index + 1).padStart(3, "0")}`;
    await db.learner.upsert({ where: { admissionNo }, create: { admissionNo, name, grade, gender }, update: {} });
  }
  const teacher = await db.user.findUniqueOrThrow({ where: { email: "teacher@maryroyal.ac.ke" } });
  const payrollPeriod = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Africa/Nairobi" }).format(new Date());
  const payrollSamples = [
    ["headteacher@maryroyal.ac.ke", 72000, 7000, "PAID"],
    ["deputy@maryroyal.ac.ke", 58000, 5200, "PAID"],
    ["teacher@maryroyal.ac.ke", 42000, 3600, "PAID"]
  ] as const;
  const financeLead = await db.user.findUniqueOrThrow({ where: { email: "headteacher@maryroyal.ac.ke" } });
  for (const [email, grossAmount, deductions, status] of payrollSamples) {
    const staff = await db.user.findUniqueOrThrow({ where: { email } });
    const existing = await db.payrollEntry.findUnique({ where: { staffId_period: { staffId: staff.id, period: payrollPeriod } } });
    if (!existing) {
      const entry = await db.payrollEntry.create({ data: { staffId: staff.id, period: payrollPeriod, grossAmount, deductions, netAmount: grossAmount - deductions, status, paidAt: status === "PAID" ? new Date() : null, enteredById: financeLead.id } });
      await db.payrollHistory.create({ data: { payrollId: entry.id, actorId: financeLead.id, version: 1, grossAmount, deductions, netAmount: grossAmount - deductions, status } });
    }
  }
  const learners = await db.learner.findMany({ where: { archivedAt: null, admissionNo: { startsWith: "MR-2026-" } }, orderBy: { admissionNo: "asc" } });
  const seedTerms = ["2026 Term 1", "2026 Term 2"];
  for (const [index, learner] of learners.entries()) {
    for (const [termIndex, term] of seedTerms.entries()) {
      let invoice = await db.feeInvoice.findUnique({ where: { learnerId_term: { learnerId: learner.id, term } } });
      if (!invoice) {
        invoice = await db.feeInvoice.create({ data: { learnerId: learner.id, term, createdById: financeLead.id, lines: { create: [{ category: "TUITION", description: `${term} tuition`, amount: 16000 }, { category: "LUNCH", description: `${term} lunch programme`, amount: 4000 }] } } });
      }
      const alreadyPaid = await db.feePayment.count({ where: { invoiceId: invoice.id } });
      const shouldPay = termIndex === 0 ? index < 20 : index < 14;
      if (!alreadyPaid && shouldPay) {
        const amount = termIndex === 0 ? 9000 + (index % 4) * 1000 : 5000 + (index % 3) * 1000;
        await db.$transaction(async tx => {
          const receiptCounter = await tx.receiptCounter.upsert({ where: { id: "global" }, create: { id: "global", lastNumber: 1 }, update: { lastNumber: { increment: 1 } } });
          const receiptNo = `MRR-2026-${String(receiptCounter.lastNumber).padStart(6, "0")}`;
          const payment = await tx.feePayment.create({ data: { invoiceId: invoice!.id, receiptNo, amount, method: "CASH", reference: "Seeded demo payment", recordedById: financeLead.id } });
          await tx.feePaymentHistory.create({ data: { paymentId: payment.id, actorId: financeLead.id, version: 1, amount, method: "CASH", status: "RECORDED", reason: "Seed demo payment" } });
        });
      }
    }
  }
  for (const grade of ["Grade 4", "Grade 5", "Grade 6"]) {
    for (const subject of ["English", "Mathematics", "Science"]) {
      await db.teacherAssignment.upsert({ where: { teacherId_grade_subject: { teacherId: teacher.id, grade, subject } }, create: { teacherId: teacher.id, grade, subject }, update: {} });
    }
  }
  await db.classTeacherAssignment.upsert({ where: { grade: "Grade 4" }, create: { grade: "Grade 4", teacherId: teacher.id }, update: { teacherId: teacher.id } });
  const parent = await db.user.findUniqueOrThrow({ where: { email: "parent@maryroyal.ac.ke" } });
  const learnerAccount = await db.user.findUniqueOrThrow({ where: { email: "learner@maryroyal.ac.ke" } });
  for (const child of learners.slice(0, 2)) await db.guardianLink.upsert({ where: { userId_learnerId: { userId: parent.id, learnerId: child.id } }, create: { userId: parent.id, learnerId: child.id, relation: "Parent" }, update: {} });
  if (learners[0]) await db.guardianLink.upsert({ where: { userId_learnerId: { userId: learnerAccount.id, learnerId: learners[0].id } }, create: { userId: learnerAccount.id, learnerId: learners[0].id, relation: "Learner" }, update: {} });
  for (const [index, learner] of learners.entries()) {
    for (const subject of ["English", "Mathematics", "Science"]) {
      for (const [termIndex, term] of ["2026 Term 1", "2026 Term 2"].entries()) {
        if (await db.assessment.findFirst({ where: { learnerId: learner.id, subject, term } })) continue;
        const score = 45 + ((index * 7 + subject.length * 3 + termIndex * 5) % 51);
        const status = termIndex === 0 ? "RELEASED" : "DRAFT";
        const assessment = await db.assessment.create({ data: { learnerId: learner.id, enteredById: teacher.id, subject, score, term, strand: subject === "Mathematics" ? "Number" : "Communication and collaboration", competency: `Apply ${subject.toLowerCase()} skills`, comment: "Keep practising and asking thoughtful questions.", status } });
        await db.assessmentHistory.create({ data: { assessmentId: assessment.id, actorId: teacher.id, version: 1, newScore: score } });
      }
    }
  }
}
main().finally(() => db.$disconnect());
