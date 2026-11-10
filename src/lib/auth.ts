import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { can, canInScope, type Action, type DataScope, type Resource } from "@/lib/permissions";
import { readSession } from "@/lib/session";

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export type SchoolActor = {
  id: string;
  name: string;
  email: string;
  role: Role;
  schoolId: string;
};

/**
 * Resolve the signed-in school user for the current request.
 *
 * The session JWT carries the tenant id. The user row is then re-read and must
 * belong to that same tenant, so a stale or tampered token cannot cross the
 * tenant boundary even if a database row is somehow reused.
 */
export async function getSchoolActor(): Promise<SchoolActor | null> {
  const store = await cookies();
  const token = store.get("school_session")?.value ?? store.get("school_session")?.value;
  if (!token) return null;

  const session = await readSession(token);
  if (!session) return null;

  const user = await db.user.findFirst({
    where: { id: session.id, schoolId: session.schoolId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      schoolId: true,
      suspended: true,
      forcePasswordChange: true,
      school: { select: { slug: true, status: true } },
    },
  });

  if (!user || user.suspended || user.forcePasswordChange) return null;
  if (user.school.status === "SUSPENDED") return null;
  if (user.school.slug !== session.schoolSlug) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    schoolId: user.schoolId,
  };
}

export async function requireSchoolActor(): Promise<SchoolActor> {
  const actor = await getSchoolActor();
  if (!actor) throw new HttpError(401, "Unauthenticated");
  return actor;
}

/** Deny-by-default route guard. */
export async function requirePermission(resource: Resource, action: Action): Promise<SchoolActor> {
  const actor = await requireSchoolActor();
  if (!can(actor.role, resource, action)) {
    throw new HttpError(403, "Forbidden");
  }
  return actor;
}

/** Deny-by-default route guard that also checks the actor's data scope. */
export async function requireScopedPermission(
  resource: Resource,
  action: Action,
  scope: DataScope,
): Promise<SchoolActor> {
  const actor = await requireSchoolActor();
  if (!canInScope(actor.role, resource, action, scope)) {
    throw new HttpError(403, "Forbidden");
  }
  return actor;
}

export async function auditDenied(actorId: string | null, schoolId: string, entity: string) {
  await db.auditEvent.create({
    data: { schoolId, actorId, action: "ACCESS_DENIED", entity },
  });
}
