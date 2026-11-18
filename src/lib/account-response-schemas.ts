import { z } from "zod";

export const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string(),
  role: z.string().min(1),
  suspended: z.boolean(),
  suspensionReason: z.string().nullable(),
  forcePasswordChange: z.boolean(),
  failedLogins: z.number().int().nonnegative(),
});

export const accountsResponseSchema = z.object({
  accounts: z.array(accountSchema),
});

export const learnersResponseSchema = z.object({
  learners: z.array(z.object({
    id: z.string().min(1),
    name: z.string(),
    admissionNo: z.string(),
    grade: z.string(),
  })),
});

export const guardianLinksResponseSchema = z.object({
  links: z.array(z.object({
    id: z.string().min(1),
    user: z.object({
      name: z.string(),
      email: z.string(),
      role: z.string().min(1),
    }),
    learner: z.object({
      id: z.string().optional(),
      name: z.string(),
      admissionNo: z.string(),
      grade: z.string(),
    }),
    relation: z.string(),
  })),
});

export type AccountSummary = z.infer<typeof accountSchema>;
