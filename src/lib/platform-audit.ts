import { db } from "@/lib/db";

type PlatformAuditInput = {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
};

/**
 * Append-only platform audit trail. Callers must never pass passwords,
 * tokens, raw Daraja credentials or other secrets in metadata.
 */
export async function recordPlatformAudit(input: PlatformAuditInput): Promise<void> {
  try {
    await db.platformAuditEvent.create({
      data: {
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (error) {
    // Auditing must not break authentication or provisioning. Log only the
    // error class/message, never request data.
    console.error("[platform-audit] failed", error instanceof Error ? error.message : "unknown error");
  }
}
