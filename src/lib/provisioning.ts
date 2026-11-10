import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { recordPlatformAudit } from "@/lib/platform-audit";
import { removeSchoolLogo, storeSchoolLogo } from "@/lib/school-logo";
import { isValidSlug } from "@/lib/tenant-host";
import { invalidateTenantCache } from "@/lib/tenant";

const RESERVED_TENANT_SLUGS = new Set(["maryroyal", "demo", "schoolcore", "support"]);
const JOB_LOCK_TIMEOUT_MS = 5 * 60_000;

const optionalText = (max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    },
    z.string().max(max).optional(),
  );

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .transform((value) => value.toLowerCase())
  .refine(isValidSlug, "Use 3–40 lowercase letters, numbers or hyphens; this subdomain is reserved.")
  .refine((value) => !RESERVED_TENANT_SLUGS.has(value), "That subdomain is reserved for the platform.");

const phoneSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().regex(/^[0-9+()\-.\s]{7,40}$/, "Enter a valid phone number.").optional(),
);

export const provisionSchoolSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: slugSchema,
    motto: z.string().trim().min(2).max(120),
    slogan: optionalText(160),
    primaryColour: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex colour.")
      .transform((value) => value.toLowerCase()),
    secondaryColour: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex colour.")
      .transform((value) => value.toLowerCase()),
    accentColour: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex colour.")
      .transform((value) => value.toLowerCase()),
    contactEmail: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().toLowerCase().email().max(254).optional(),
    ),
    contactPhone: phoneSchema,
    poBox: optionalText(200),
    physicalAddress: optionalText(200),
    directorName: z.string().trim().min(2).max(120),
    directorEmail: z.string().trim().toLowerCase().email().max(254),
    directorPhone: phoneSchema,
    directorUsername: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9][a-z0-9._-]{2,39}$/, "Use 3–40 lowercase letters, numbers, dots, dashes or underscores.")
        .optional(),
    ),
  })
  .strict();

export type ProvisionSchoolInput = z.infer<typeof provisionSchoolSchema>;

export type ProvisionedSchool = {
  id: string;
  name: string;
  slug: string;
  status: string;
  logoUrl: string;
};

export type ProvisionSchoolResult = {
  created: boolean;
  school: ProvisionedSchool;
  director: { name: string; email: string; username: string | null };
  /** Returned exactly once on first creation; never persisted or logged. */
  temporaryPassword: string | null;
};

type ExistingResult = {
  schoolId: string;
  directorName: string;
  directorEmail: string;
  directorUsername: string | null;
};

export class ProvisioningError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ProvisioningError";
    this.status = status;
    this.code = code;
  }
}

const cbcDefaults = [
  { code: "EE", label: "Exceeding Expectations", minScore: 80, maxScore: 100, descriptor: "Consistently exceeds the expected competency", sortOrder: 1 },
  { code: "ME", label: "Meeting Expectations", minScore: 60, maxScore: 79.99, descriptor: "Demonstrates the expected competency", sortOrder: 2 },
  { code: "AE", label: "Approaching Expectations", minScore: 40, maxScore: 59.99, descriptor: "Is developing the expected competency", sortOrder: 3 },
  { code: "BE", label: "Below Expectations", minScore: 0, maxScore: 39.99, descriptor: "Needs additional support to develop the competency", sortOrder: 4 },
] as const;

function makeTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(14);
  let body = "";
  for (const byte of bytes) body += alphabet[byte % alphabet.length];
  return `Sc!${body}7`;
}

function parseExistingResult(resultJson: string | null): ExistingResult | null {
  if (!resultJson) return null;
  try {
    const parsed = JSON.parse(resultJson) as Partial<ExistingResult>;
    if (
      typeof parsed.schoolId === "string" &&
      typeof parsed.directorEmail === "string" &&
      typeof parsed.directorName === "string"
    ) {
      return {
        schoolId: parsed.schoolId,
        directorEmail: parsed.directorEmail,
        directorName: parsed.directorName,
        directorUsername: typeof parsed.directorUsername === "string" ? parsed.directorUsername : null,
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function completedResult(job: {
  schoolId: string | null;
  resultJson: string | null;
}): Promise<ProvisionSchoolResult | null> {
  const saved = parseExistingResult(job.resultJson);
  if (!saved) return null;
  const school = await db.school.findUnique({
    where: { id: saved.schoolId },
    select: { id: true, name: true, slug: true, status: true, logoUrl: true },
  });
  if (!school) return null;
  return {
    created: false,
    school,
    director: {
      name: saved.directorName,
      email: saved.directorEmail,
      username: saved.directorUsername,
    },
    temporaryPassword: null,
  };
}

async function claimExistingJob(
  job: { id: string; status: string; updatedAt: Date },
  idempotencyKey: string,
): Promise<boolean> {
  const staleBefore = new Date(Date.now() - JOB_LOCK_TIMEOUT_MS);
  const claimed = await db.provisioningJob.updateMany({
    where: {
      idempotencyKey,
      status: { in: ["PENDING", "FAILED"] },
    },
    data: {
      status: "IN_PROGRESS",
      attempts: { increment: 1 },
      startedAt: new Date(),
      completedAt: null,
      error: null,
    },
  });
  if (claimed.count === 1) return true;

  if (job.status === "IN_PROGRESS" && job.updatedAt > staleBefore) {
    return false;
  }

  const reclaimed = await db.provisioningJob.updateMany({
    where: {
      idempotencyKey,
      status: "IN_PROGRESS",
      updatedAt: { lte: staleBefore },
    },
    data: {
      status: "IN_PROGRESS",
      attempts: { increment: 1 },
      startedAt: new Date(),
      completedAt: null,
      error: null,
    },
  });
  return reclaimed.count === 1;
}

/**
 * Provision an identical copy of the Mary Royal school template for a tenant.
 *
 * The database work is one transaction; the only non-transactional side effect
 * is the processed logo, which is written before the transaction and removed
 * again if the transaction fails. The unique ProvisioningJob.idempotencyKey and
 * School.provisioningKey columns make client retries safe.
 */
export async function provisionSchool(
  rawInput: ProvisionSchoolInput,
  options: {
    idempotencyKey: string;
    logo: File;
    actor: { id: string; email: string };
    ipAddress: string;
  },
): Promise<ProvisionSchoolResult> {
  const input = provisionSchoolSchema.parse(rawInput);
  const key = options.idempotencyKey;

  let job = await db.provisioningJob.findUnique({ where: { idempotencyKey: key } });

  if (job?.status === "COMPLETED") {
    const existing = await completedResult(job);
    if (existing) return existing;
    throw new ProvisioningError(
      409,
      "PROVISIONING_STATE_INVALID",
      "This provisioning request is already complete but its school could not be loaded. Contact platform support.",
    );
  }

  if (job) {
    const claimed = await claimExistingJob(job, key);
    if (!claimed) {
      throw new ProvisioningError(
        409,
        "PROVISIONING_IN_PROGRESS",
        "This school is already being provisioned. Wait a moment and try again.",
      );
    }
  } else {
    try {
      job = await db.provisioningJob.create({
        data: {
          idempotencyKey: key,
          slug: input.slug,
          status: "IN_PROGRESS",
          attempts: 1,
          requestJson: JSON.stringify({
            school: {
              name: input.name,
              slug: input.slug,
              motto: input.motto,
              slogan: input.slogan ?? null,
              primaryColour: input.primaryColour,
              secondaryColour: input.secondaryColour,
              accentColour: input.accentColour,
              contactEmail: input.contactEmail ?? null,
              contactPhone: input.contactPhone ?? null,
              poBox: input.poBox ?? null,
              physicalAddress: input.physicalAddress ?? null,
            },
            director: {
              name: input.directorName,
              email: input.directorEmail,
              phone: input.directorPhone ?? null,
              username: input.directorUsername ?? null,
            },
            logo: { name: options.logo.name, size: options.logo.size, type: options.logo.type },
          }),
          startedAt: new Date(),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const concurrent = await db.provisioningJob.findUnique({ where: { idempotencyKey: key } });
        if (concurrent?.status === "COMPLETED") {
          const existing = await completedResult(concurrent);
          if (existing) return existing;
        }
        throw new ProvisioningError(
          409,
          "PROVISIONING_IN_PROGRESS",
          "This school is already being provisioned. Wait a moment and try again.",
        );
      }
      throw error;
    }
  }

  if (!job) {
    throw new ProvisioningError(500, "PROVISIONING_JOB_MISSING", "Could not start provisioning.");
  }
  const jobId = job.id;

  let committed = false;
  try {
    const logo = await storeSchoolLogo(input.slug, options.logo);

    const temporaryPassword = makeTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const schoolId = `school_${input.slug}`;
    const schoolSettingProfile = JSON.stringify({
      name: input.name,
      motto: input.motto,
      slogan: input.slogan ?? "",
      county: "",
      area: "",
      currency: "KES",
      timezone: "Africa/Nairobi",
    });

    const result = await db.$transaction(
      async (tx) => {
        const conflictingSchool = await tx.school.findUnique({
          where: { slug: input.slug },
          select: { id: true, provisioningKey: true },
        });
        if (conflictingSchool) {
          throw new ProvisioningError(409, "SUBDOMAIN_TAKEN", "That subdomain is already in use.");
        }

        const school = await tx.school.create({
          data: {
            id: schoolId,
            name: input.name,
            slug: input.slug,
            motto: input.motto,
            slogan: input.slogan ?? null,
            logoUrl: logo.url,
            primaryColour: input.primaryColour,
            secondaryColour: input.secondaryColour,
            accentColour: input.accentColour,
            contactEmail: input.contactEmail ?? null,
            contactPhone: input.contactPhone ?? null,
            poBox: input.poBox ?? null,
            physicalAddress: input.physicalAddress ?? null,
            status: "ACTIVE",
            provisioningKey: key,
          },
        });

        await tx.schoolPaymentConfig.create({
          data: { schoolId: school.id, accountFormat: "ADMISSION_NO", darajaEnvironment: "sandbox" },
        });

        await tx.admissionCounter.create({
          data: { id: `admission_counter_${school.id}`, schoolId: school.id, lastNumber: 0 },
        });
        await tx.receiptCounter.create({
          data: { id: `receipt_counter_${school.id}`, schoolId: school.id, lastNumber: 0 },
        });

        await tx.cbcLevel.createMany({
          data: cbcDefaults.map((level) => ({ ...level, schoolId: school.id, active: true })),
        });

        await tx.schoolSetting.createMany({
          data: [
            { schoolId: school.id, key: "school.profile", value: schoolSettingProfile },
            {
              schoolId: school.id,
              key: "school.academicSetup",
              value: JSON.stringify({ years: [], terms: [], classes: [], streams: [], subjects: [], feeStructures: [] }),
            },
          ],
        });

        const director = await tx.user.create({
          data: {
            schoolId: school.id,
            name: input.directorName,
            email: input.directorEmail,
            phone: input.directorPhone ?? null,
            username: input.directorUsername ?? null,
            passwordHash,
            role: Role.DIRECTOR,
            forcePasswordChange: true,
          },
          select: { id: true, name: true, email: true, username: true },
        });

        await tx.auditEvent.create({
          data: {
            schoolId: school.id,
            action: "SCHOOL_PROVISIONED",
            entity: "School",
            entityId: school.id,
          },
        });

        await tx.platformAuditEvent.create({
          data: {
            actorId: options.actor.id,
            actorEmail: options.actor.email,
            action: "SCHOOL_PROVISIONED",
            entity: "School",
            entityId: school.id,
            ipAddress: options.ipAddress,
            metadata: JSON.stringify({ slug: school.slug, directorEmail: director.email }),
          },
        });

        await tx.provisioningJob.update({
          where: { id: jobId },
          data: {
            status: "COMPLETED",
            schoolId: school.id,
            completedAt: new Date(),
            error: null,
            resultJson: JSON.stringify({
              schoolId: school.id,
              directorName: director.name,
              directorEmail: director.email,
              directorUsername: director.username,
            } satisfies ExistingResult),
          },
        });

        return {
          school,
          directorEmail: director.email,
          directorUsername: director.username,
        };
      },
      { timeout: 20_000 },
    );

    committed = true;
    invalidateTenantCache(input.slug);
    invalidateTenantCache(result.school.id);

    return {
      created: true,
      school: {
        id: result.school.id,
        name: result.school.name,
        slug: result.school.slug,
        status: result.school.status,
        logoUrl: result.school.logoUrl,
      },
      director: {
        name: input.directorName,
        email: result.directorEmail,
        username: result.directorUsername,
      },
      temporaryPassword,
    };
  } catch (error) {
    if (!committed) await removeSchoolLogo(input.slug);

    const friendly =
      error instanceof ProvisioningError
        ? error
        : error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
          ? new ProvisioningError(409, "SUBDOMAIN_TAKEN", "That subdomain is already in use.")
          : new ProvisioningError(500, "PROVISIONING_FAILED", "The school could not be provisioned. Try again.");

    await db.provisioningJob
      .update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          error: friendly.message.slice(0, 500),
          completedAt: new Date(),
        },
      })
      .catch(() => undefined);

    await recordPlatformAudit({
      actorId: options.actor.id,
      actorEmail: options.actor.email,
      action: "SCHOOL_PROVISIONING_FAILED",
      entity: "ProvisioningJob",
      entityId: jobId,
      ipAddress: options.ipAddress,
      metadata: { slug: input.slug, code: friendly.code },
    });

    if (error instanceof ProvisioningError) throw error;
    throw friendly;
  }
}
