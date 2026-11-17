ALTER TABLE "WelfareLoan" ADD COLUMN "directorApprovedAt" DATETIME;
ALTER TABLE "WelfareLoan" ADD COLUMN "rejectedAt" DATETIME;
ALTER TABLE "WelfareLoan" ADD COLUMN "rejectedByRole" TEXT;
