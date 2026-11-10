import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { readSuperAdminSession } from "@/lib/session";

export const PLATFORM_SESSION_COOKIE = "platform_session";
export const PLATFORM_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export type PlatformActor = {
  id: string;
  name: string;
  email: string;
};

export class PlatformAuthError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "PlatformAuthError";
    this.status = status;
  }
}

/**
 * Resolve the signed-in Super Admin. The JWT is only a pointer: the account is
 * re-read on every request so suspension or deletion takes effect immediately.
 */
export async function getPlatformActor(): Promise<PlatformActor | null> {
  const token = (await cookies()).get(PLATFORM_SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await readSuperAdminSession(token);
  if (!session) return null;

  const admin = await db.superAdmin.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, email: true, suspended: true },
  });
  if (!admin || admin.suspended) return null;
  if (admin.email.toLowerCase() !== session.email.toLowerCase()) return null;

  return { id: admin.id, name: admin.name, email: admin.email };
}

export async function requirePlatformActor(): Promise<PlatformActor> {
  const actor = await getPlatformActor();
  if (!actor) throw new PlatformAuthError(401, "Unauthorized platform access.");
  return actor;
}
