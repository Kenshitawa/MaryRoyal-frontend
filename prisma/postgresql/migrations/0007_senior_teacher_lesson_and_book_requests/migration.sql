ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SENIOR_TEACHER';

CREATE TABLE "TextbookRequest" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "grade" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "responseNotes" TEXT,
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TextbookRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TextbookRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TextbookRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "TextbookRequest_requestedById_status_idx" ON "TextbookRequest"("requestedById", "status");
CREATE INDEX "TextbookRequest_status_createdAt_idx" ON "TextbookRequest"("status", "createdAt");

CREATE TABLE "DailyTeachingLog" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "grade" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "lessonDate" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyTeachingLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DailyTeachingLog_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DailyTeachingLog_teacherId_grade_subject_lessonDate_key" ON "DailyTeachingLog"("teacherId", "grade", "subject", "lessonDate");
CREATE INDEX "DailyTeachingLog_lessonDate_status_idx" ON "DailyTeachingLog"("lessonDate", "status");
CREATE INDEX "DailyTeachingLog_teacherId_lessonDate_idx" ON "DailyTeachingLog"("teacherId", "lessonDate");
