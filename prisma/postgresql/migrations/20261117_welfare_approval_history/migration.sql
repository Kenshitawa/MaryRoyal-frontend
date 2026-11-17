ALTER TABLE "WelfareLoan" ADD COLUMN "directorApprovedAt" TIMESTAMP(3);
ALTER TABLE "WelfareLoan" ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "WelfareLoan" ADD COLUMN "rejectedByRole" TEXT;
