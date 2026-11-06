-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "readAt" DATETIME;

-- CreateIndex
CREATE INDEX "Notification_userId_read_readAt_idx" ON "Notification"("userId", "read", "readAt");
