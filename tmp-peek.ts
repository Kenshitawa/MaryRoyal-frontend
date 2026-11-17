import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const users = await p.user.findMany({ select: { email: true, name: true, role: true, forcePasswordChange: true, suspended: true } });
  const counts = {
    learners: await p.learner.count(),
    parents: await p.user.count({ where: { role: "PARENT" } }),
    invoices: await p.feeInvoice.count(),
    assessments: await p.assessment.count(),
    attendance: await p.attendance.count(),
  };
  console.log(JSON.stringify({ counts, users }, null, 1));
  await p.$disconnect();
}

main();
