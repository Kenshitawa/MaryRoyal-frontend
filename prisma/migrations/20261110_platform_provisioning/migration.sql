-- Phase 4/5 platform provisioning, Super Admin bootstrap and tenant auth metadata (SQLite dev schema).

ALTER TABLE "School" ADD COLUMN "provisioningKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "School_provisioningKey_key" ON "School"("provisioningKey");

ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "twoFactorSecretEncrypted" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_schoolId_username_key" ON "User"("schoolId", "username");

CREATE TABLE IF NOT EXISTS "ProvisioningJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "idempotencyKey" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "schoolId" TEXT,
    "requestJson" TEXT NOT NULL,
    "resultJson" TEXT,
    "error" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProvisioningJob_idempotencyKey_key" ON "ProvisioningJob"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ProvisioningJob_slug_idx" ON "ProvisioningJob"("slug");
CREATE INDEX IF NOT EXISTS "ProvisioningJob_status_idx" ON "ProvisioningJob"("status");

CREATE TABLE IF NOT EXISTS "PlatformAuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PlatformAuditEvent_createdAt_idx" ON "PlatformAuditEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "PlatformAuditEvent_action_idx" ON "PlatformAuditEvent"("action");
