import { db } from "./db";
import { Prisma } from "@prisma/client";

/**
 * Executes a callback within a verified tenant database context.
 * In PostgreSQL, this sets the PostgreSQL transaction session variable `app.current_school_id`
 * so that Row-Level Security (RLS) policies at the database engine level physically isolate rows.
 * In SQLite (local/test harness), it guarantees the application-level tenant scope.
 */
export async function withTenantContext<T>(
  schoolId: string,
  callback: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  if (!schoolId || typeof schoolId !== "string" || !schoolId.trim()) {
    throw new Error("Invalid tenant context: schoolId is required.");
  }

  return await db.$transaction(async (tx) => {
    // If PostgreSQL, set RLS context variable for this transaction
    if (process.env.DATABASE_URL?.startsWith("postgres")) {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_school_id', $1, true)`, schoolId);
    }
    return await callback(tx);
  });
}

/**
 * Super Admin database execution context, bypassing tenant RLS policies securely.
 */
export async function withSuperAdminContext<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return await db.$transaction(async (tx) => {
    if (process.env.DATABASE_URL?.startsWith("postgres")) {
      await tx.$executeRawUnsafe(`SELECT set_config('app.is_super_admin', 'true', true)`);
    }
    return await callback(tx);
  });
}

/**
 * Utility to build tenant-scoped Prisma query filters.
 * Rejects requests if schoolId is missing, preventing accidental unbounded queries.
 */
export function scopeToTenant<T extends Record<string, unknown>>(
  schoolId: string,
  whereClause: T = {} as T
): T & { schoolId: string } {
  if (!schoolId) {
    throw new Error("Security Violation: Cannot perform database query without valid schoolId.");
  }
  return {
    ...whereClause,
    schoolId,
  };
}
