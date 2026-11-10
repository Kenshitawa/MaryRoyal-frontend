-- Phase 6: field-name-only audit metadata for payment-settings changes.
ALTER TABLE "AuditEvent" ADD COLUMN "metadata" TEXT;
