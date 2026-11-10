import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { PrismaClient, Role } from "@prisma/client";
import { withTenantContext, scopeToTenant } from "../src/lib/tenant-db";

const db = new PrismaClient();

describe("Multi-Tenant Isolation Test Suite", () => {
  const schoolAId = "test_school_alpha_" + Date.now();
  const schoolBId = "test_school_beta_" + Date.now();

  const cleanup = async () => {
    await db.feePayment.deleteMany({ where: { schoolId: { in: [schoolAId, schoolBId] } } });
    await db.feeInvoice.deleteMany({ where: { schoolId: { in: [schoolAId, schoolBId] } } });
    await db.learner.deleteMany({ where: { schoolId: { in: [schoolAId, schoolBId] } } });
    await db.user.deleteMany({ where: { schoolId: { in: [schoolAId, schoolBId] } } });
    await db.schoolPaymentConfig.deleteMany({ where: { schoolId: { in: [schoolAId, schoolBId] } } });
    await db.school.deleteMany({ where: { id: { in: [schoolAId, schoolBId] } } });
  };

  beforeAll(async () => {
    await cleanup();

    // 1. Create School A
    await db.school.create({
      data: {
        id: schoolAId,
        name: "Alpha Academy",
        slug: "alpha-" + Date.now(),
        motto: "Strive for Excellence",
        primaryColour: "#0284c7",
        secondaryColour: "#0f172a",
        accentColour: "#f59e0b",
        status: "ACTIVE"
      }
    });

    // 2. Create School B
    await db.school.create({
      data: {
        id: schoolBId,
        name: "Beta Preparatory",
        slug: "beta-" + Date.now(),
        motto: "Knowledge is Power",
        primaryColour: "#16a34a",
        secondaryColour: "#14532d",
        accentColour: "#d97706",
        status: "ACTIVE"
      }
    });
  });

  afterAll(async () => {
    await cleanup();
    await db.$disconnect();
  });

  it("permits identical user emails across distinct schools without conflict", async () => {
    const commonEmail = "principal@institutes.co.ke";

    // Create user in School A
    const userA = await db.user.create({
      data: {
        schoolId: schoolAId,
        name: "Alpha Principal",
        email: commonEmail,
        passwordHash: "hash_alpha",
        role: Role.DIRECTOR
      }
    });

    // Create user in School B with SAME email
    const userB = await db.user.create({
      data: {
        schoolId: schoolBId,
        name: "Beta Principal",
        email: commonEmail,
        passwordHash: "hash_beta",
        role: Role.DIRECTOR
      }
    });

    expect(userA.id).not.toEqual(userB.id);
    expect(userA.schoolId).toBe(schoolAId);
    expect(userB.schoolId).toBe(schoolBId);

    // Lookups scoped by tenant return strictly that tenant's user
    const foundA = await db.user.findUnique({
      where: { schoolId_email: { schoolId: schoolAId, email: commonEmail } }
    });
    expect(foundA?.name).toBe("Alpha Principal");

    const foundB = await db.user.findUnique({
      where: { schoolId_email: { schoolId: schoolBId, email: commonEmail } }
    });
    expect(foundB?.name).toBe("Beta Principal");
  });

  it("permits identical learner admission numbers across distinct schools without conflict", async () => {
    const commonAdmNo = "ADM-2026-999";

    const learnerA = await db.learner.create({
      data: {
        schoolId: schoolAId,
        admissionNo: commonAdmNo,
        name: "Alice Alpha",
        grade: "Grade 4",
        gender: "Female"
      }
    });

    const learnerB = await db.learner.create({
      data: {
        schoolId: schoolBId,
        admissionNo: commonAdmNo,
        name: "Bob Beta",
        grade: "Grade 4",
        gender: "Male"
      }
    });

    expect(learnerA.id).not.toEqual(learnerB.id);

    // Querying School A learners must NEVER contain School B learners
    const schoolALearners = await db.learner.findMany({
      where: scopeToTenant(schoolAId)
    });

    expect(schoolALearners.some((l) => l.name === "Alice Alpha")).toBe(true);
    expect(schoolALearners.some((l) => l.name === "Bob Beta")).toBe(false);
  });

  it("enforces tenant-isolated financial records", async () => {
    const teacherA = await db.user.create({
      data: {
        schoolId: schoolAId,
        name: "Teacher Alpha",
        email: "teacher.alpha@school.co.ke",
        passwordHash: "hash",
        role: Role.TEACHER
      }
    });

    const teacherB = await db.user.create({
      data: {
        schoolId: schoolBId,
        name: "Teacher Beta",
        email: "teacher.beta@school.co.ke",
        passwordHash: "hash",
        role: Role.TEACHER
      }
    });

    const learnerA = await db.learner.findFirstOrThrow({ where: { schoolId: schoolAId } });
    const learnerB = await db.learner.findFirstOrThrow({ where: { schoolId: schoolBId } });

    // Create Invoice for School A
    const invoiceA = await db.feeInvoice.create({
      data: {
        schoolId: schoolAId,
        learnerId: learnerA.id,
        term: "2026 Term 1",
        createdById: teacherA.id
      }
    });

    // Create Invoice for School B
    const invoiceB = await db.feeInvoice.create({
      data: {
        schoolId: schoolBId,
        learnerId: learnerB.id,
        term: "2026 Term 1",
        createdById: teacherB.id
      }
    });

    // Create Payment in School A
    await db.feePayment.create({
      data: {
        schoolId: schoolAId,
        invoiceId: invoiceA.id,
        receiptNo: "REC-ALPHA-001",
        amount: 25000,
        method: "MPESA",
        recordedById: teacherA.id
      }
    });

    // Create Payment in School B
    await db.feePayment.create({
      data: {
        schoolId: schoolBId,
        invoiceId: invoiceB.id,
        receiptNo: "REC-BETA-001",
        amount: 40000,
        method: "BANK",
        recordedById: teacherB.id
      }
    });

    // Query School A payments
    const paymentsA = await db.feePayment.findMany({
      where: scopeToTenant(schoolAId)
    });

    expect(paymentsA).toHaveLength(1);
    expect(paymentsA[0].receiptNo).toBe("REC-ALPHA-001");
    expect(paymentsA[0].amount).toBe(25000);

    // Query School B payments
    const paymentsB = await db.feePayment.findMany({
      where: scopeToTenant(schoolBId)
    });

    expect(paymentsB).toHaveLength(1);
    expect(paymentsB[0].receiptNo).toBe("REC-BETA-001");
    expect(paymentsB[0].amount).toBe(40000);
  });

  it("guarantees withTenantContext enforces transactional boundary", async () => {
    const result = await withTenantContext(schoolAId, async (tx) => {
      return await tx.learner.findMany({
        where: { schoolId: schoolAId }
      });
    });

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.every((l) => l.schoolId === schoolAId)).toBe(true);
  });

  it("throws a security error if scopeToTenant is invoked without a schoolId", () => {
    expect(() => scopeToTenant("")).toThrow("Security Violation");
  });
});
