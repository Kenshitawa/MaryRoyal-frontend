import { z } from "zod";

const productionEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url().refine(value => /^postgres(ql)?:\/\//i.test(value), "must be a PostgreSQL URL"),
  SESSION_SECRET: z.string().min(32).refine(value => !/replace-this|example|change-me/i.test(value), "must be a unique secret"),
  OBJECT_STORAGE_DRIVER: z.enum(["supabase", "local"]).default("local"),
  VERCEL: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).optional(),
}).superRefine((environment, context) => {
  if (environment.OBJECT_STORAGE_DRIVER === "supabase") {
    for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_STORAGE_BUCKET"] as const) {
      if (!environment[key]) context.addIssue({ code: "custom", path: [key], message: "is required when OBJECT_STORAGE_DRIVER=supabase" });
    }
  }
  if (environment.VERCEL === "1" && environment.OBJECT_STORAGE_DRIVER !== "supabase") {
    context.addIssue({ code: "custom", path: ["OBJECT_STORAGE_DRIVER"], message: "must be supabase on Vercel because serverless filesystems are ephemeral" });
  }
});

export function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE === "phase-production-build") return;
  const parsed = productionEnvironmentSchema.safeParse(process.env);
  if (parsed.success) return;
  const details = parsed.error.issues.map(issue => `${issue.path.join(".") || "environment"}: ${issue.message}`).join("; ");
  throw new Error(`Production environment is incomplete or invalid (${details}).`);
}
