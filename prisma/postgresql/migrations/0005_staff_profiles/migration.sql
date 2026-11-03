-- CreateTable
CREATE TABLE IF NOT EXISTS "StaffProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gender" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "nationalId" TEXT,
    "nationality" TEXT NOT NULL DEFAULT 'Kenyan',
    "maritalStatus" TEXT,
    "alternatePhone" TEXT,
    "residenceAddress" TEXT,
    "county" TEXT,
    "dateJoined" TIMESTAMP(3),
    "employmentType" TEXT,
    "department" TEXT,
    "lineManager" TEXT,
    "probationEndDate" TIMESTAMP(3),
    "educationHistory" TEXT,
    "professionalQualifications" TEXT,
    "certificates" TEXT,
    "specializations" TEXT,
    "yearsOfExperience" DOUBLE PRECISION,
    "previousEmployers" TEXT,
    "kraPin" TEXT,
    "nssfNumber" TEXT,
    "shaNumber" TEXT,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankBranch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StaffEmergencyContact" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "isNextOfKin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffEmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StaffReferee" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "title" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffReferee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StaffDocument" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StaffHistory" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StaffDraft" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StaffProfile_userId_key" ON "StaffProfile"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StaffProfile_userId_idx" ON "StaffProfile"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StaffEmergencyContact_staffProfileId_idx" ON "StaffEmergencyContact"("staffProfileId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StaffReferee_staffProfileId_idx" ON "StaffReferee"("staffProfileId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StaffDocument_storageKey_key" ON "StaffDocument"("storageKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StaffDocument_staffProfileId_category_idx" ON "StaffDocument"("staffProfileId", "category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StaffHistory_staffProfileId_createdAt_idx" ON "StaffHistory"("staffProfileId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StaffDraft_createdById_updatedAt_idx" ON "StaffDraft"("createdById", "updatedAt");

-- AddForeignKey safely and idempotently
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffProfile_userId_fkey') THEN
    ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffEmergencyContact_staffProfileId_fkey') THEN
    ALTER TABLE "StaffEmergencyContact" ADD CONSTRAINT "StaffEmergencyContact_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffReferee_staffProfileId_fkey') THEN
    ALTER TABLE "StaffReferee" ADD CONSTRAINT "StaffReferee_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffDocument_staffProfileId_fkey') THEN
    ALTER TABLE "StaffDocument" ADD CONSTRAINT "StaffDocument_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffDocument_uploadedById_fkey') THEN
    ALTER TABLE "StaffDocument" ADD CONSTRAINT "StaffDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffHistory_staffProfileId_fkey') THEN
    ALTER TABLE "StaffHistory" ADD CONSTRAINT "StaffHistory_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffHistory_actorId_fkey') THEN
    ALTER TABLE "StaffHistory" ADD CONSTRAINT "StaffHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffDraft_createdById_fkey') THEN
    ALTER TABLE "StaffDraft" ADD CONSTRAINT "StaffDraft_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill a minimal, empty profile for existing staff accounts; never copy sensitive fields.
INSERT INTO "StaffProfile" ("id", "userId", "updatedAt")
SELECT md5(u."id" || clock_timestamp()::text || random()::text), u."id", CURRENT_TIMESTAMP
FROM "User" AS u
WHERE u."role"::text IN ('DIRECTOR', 'HEAD_TEACHER', 'DEPUTY', 'SECRETARY', 'ACCOUNTANT', 'TEACHER', 'WELFARE_CHAIR', 'NON_TEACHING_STAFF')
  AND NOT EXISTS (SELECT 1 FROM "StaffProfile" AS p WHERE p."userId" = u."id");

-- Preserve deny-by-default access for the newly created private staff tables.
DO $$
DECLARE item text;
BEGIN
  FOREACH item IN ARRAY ARRAY['StaffProfile', 'StaffEmergencyContact', 'StaffReferee', 'StaffDocument', 'StaffHistory', 'StaffDraft'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', item);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated', item);
  END LOOP;
END
$$;
