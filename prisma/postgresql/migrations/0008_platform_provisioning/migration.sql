-- Phase 4/5 platform provisioning, Super Admin bootstrap and tenant auth metadata.

-- School provisioning correlation key (set once, reused for retry detection).
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "provisioningKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "School_provisioningKey_key" ON "School"("provisioningKey");

-- Tenant user login identity and session invalidation.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorSecretEncrypted" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_schoolId_username_key" ON "User"("schoolId", "username");

-- Durable, retryable provisioning jobs (idempotency survives process restarts).
CREATE TABLE IF NOT EXISTS "ProvisioningJob" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "schoolId" TEXT,
    "requestJson" TEXT NOT NULL,
    "resultJson" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProvisioningJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProvisioningJob_idempotencyKey_key" ON "ProvisioningJob"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ProvisioningJob_slug_idx" ON "ProvisioningJob"("slug");
CREATE INDEX IF NOT EXISTS "ProvisioningJob_status_idx" ON "ProvisioningJob"("status");

-- Platform-level audit trail (school creation, retries, Super Admin auth).
CREATE TABLE IF NOT EXISTS "PlatformAuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlatformAuditEvent_createdAt_idx" ON "PlatformAuditEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "PlatformAuditEvent_action_idx" ON "PlatformAuditEvent"("action");
