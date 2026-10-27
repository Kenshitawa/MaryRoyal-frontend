import { PrismaClient } from "@prisma/client";
if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build" && !/^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL ?? "")) {
  throw new Error("Production requires a PostgreSQL DATABASE_URL.");
}
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
