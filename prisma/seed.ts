import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const DEMO_SCHOOL_ID = "school_demo_mary_royal";

const cbcDefaults = [
  { code: "EE", label: "Exceeding Expectations", minScore: 80, maxScore: 100, descriptor: "Consistently exceeds the expected competency", sortOrder: 1 },
  { code: "ME", label: "Meeting Expectations", minScore: 60, maxScore: 79.99, descriptor: "Demonstrates the expected competency", sortOrder: 2 },
  { code: "AE", label: "Approaching Expectations", minScore: 40, maxScore: 59.99, descriptor: "Is developing the expected competency", sortOrder: 3 },
  { code: "BE", label: "Below Expectations", minScore: 0, maxScore: 39.99, descriptor: "Needs additional support to develop the competency", sortOrder: 4 }
] as const;

async function main() {
  // 1. Seed Demo Tenant (Mary Royal School)
  const school = await db.school.upsert({
    where: { slug: "maryroyal" },
    create: {
      id: DEMO_SCHOOL_ID,
      name: "Mary Royal School",
      slug: "maryroyal",
      motto: "Hard work pays",
      slogan: "Nurturing Excellence Through CBE",
      logoUrl: "/mary-royal-logo.png",
      primaryColour: "#1d4ed8",
      secondaryColour: "#102653",
      accentColour: "#d97706",
      contactEmail: "maryroyalschool81@gmail.com",
      contactPhone: "+254 718 216 374",
      poBox: "P.O. Box 40100, Kisumu",
      physicalAddress: "Obunga, near Breweries, Kisumu",
      status: "ACTIVE"
    },
    update: {
      name: "Mary Royal School",
      status: "ACTIVE"
    }
  });

  // 2. Seed Demo School Payment Config
  await db.schoolPaymentConfig.upsert({
    where: { schoolId: school.id },
    create: {
      schoolId: school.id,
      paybillNumber: "522123",
      accountFormat: "ADMISSION_NO",
      tillNumber: "889900",
      bankName: "Kenya Commercial Bank (KCB)",
      bankBranch: "Kisumu Main Branch (Bank Code: 01)",
      bankAccountNumber: "1289456721",
      bankAccountName: "Mary Royal School Accounts"
    },
    update: {
      paybillNumber: "522123",
      bankAccountNumber: "1289456721"
    }
  });

  // 3. Seed Platform Super Admin Account
  const superAdminPassword = await bcrypt.hash("SuperAdmin2026!", 12);
  await db.superAdmin.upsert({
    where: { email: "admin@schoolcore.system" },
    create: {
      email: "admin@schoolcore.system",
      name: "Platform Super Admin",
      passwordHash: superAdminPassword,
      twoFactorEnabled: false
    },
    update: {
      name: "Platform Super Admin"
    }
  });

  // 4. Seed Director Account
  const passwordHash = await bcrypt.hash("MaryRoyal2026!", 12);
  await db.user.upsert({
    where: { schoolId_email: { schoolId: school.id, email: "director@maryroyal.ac.ke" } },
    create: {
      schoolId: school.id,
      name: "Mary Royal Director",
      email: "director@maryroyal.ac.ke",
      passwordHash,
      role: Role.DIRECTOR,
      forcePasswordChange: true
    },
    update: {}
  });

  // 5. Seed School Settings
  await db.schoolSetting.upsert({
    where: { schoolId_key: { schoolId: school.id, key: "school.profile" } },
    create: {
      schoolId: school.id,
      key: "school.profile",
      value: JSON.stringify({
        name: "Mary Royal Junior School",
        motto: "Hard work pays",
        slogan: "Nurturing Excellence Through CBE",
        county: "Kisumu",
        area: "Obunga",
        currency: "KES",
        timezone: "Africa/Nairobi"
      })
    },
    update: {}
  });

  await db.schoolSetting.upsert({
    where: { schoolId_key: { schoolId: school.id, key: "school.academicSetup" } },
    create: {
      schoolId: school.id,
      key: "school.academicSetup",
      value: JSON.stringify({ years: [], terms: [], classes: [], streams: [], subjects: [], feeStructures: [] })
    },
    update: {}
  });

  // 6. Seed CBC Levels
  for (const level of cbcDefaults) {
    await db.cbcLevel.upsert({
      where: { schoolId_code: { schoolId: school.id, code: level.code } },
      create: {
        schoolId: school.id,
        code: level.code,
        label: level.label,
        minScore: level.minScore,
        maxScore: level.maxScore,
        descriptor: level.descriptor,
        sortOrder: level.sortOrder,
        active: true
      },
      update: {}
    });
  }
}

main().finally(() => db.$disconnect());
