-- CreateTable
CREATE TABLE "StaffProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gender" TEXT,
    "dateOfBirth" DATETIME,
    "nationalId" TEXT,
    "nationality" TEXT NOT NULL DEFAULT 'Kenyan',
    "maritalStatus" TEXT,
    "alternatePhone" TEXT,
    "residenceAddress" TEXT,
    "county" TEXT,
    "dateJoined" DATETIME,
    "employmentType" TEXT,
    "department" TEXT,
    "lineManager" TEXT,
    "probationEndDate" DATETIME,
    "educationHistory" TEXT,
    "professionalQualifications" TEXT,
    "certificates" TEXT,
    "specializations" TEXT,
    "yearsOfExperience" REAL,
    "previousEmployers" TEXT,
    "kraPin" TEXT,
    "nssfNumber" TEXT,
    "shaNumber" TEXT,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankBranch" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffEmergencyContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffProfileId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "isNextOfKin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffEmergencyContact_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffReferee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffProfileId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "title" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffReferee_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffProfileId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffDocument_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StaffDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffProfileId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffHistory_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StaffHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdById" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffDraft_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_userId_key" ON "StaffProfile"("userId");

-- CreateIndex
CREATE INDEX "StaffProfile_userId_idx" ON "StaffProfile"("userId");

-- CreateIndex
CREATE INDEX "StaffEmergencyContact_staffProfileId_idx" ON "StaffEmergencyContact"("staffProfileId");

-- CreateIndex
CREATE INDEX "StaffReferee_staffProfileId_idx" ON "StaffReferee"("staffProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffDocument_storageKey_key" ON "StaffDocument"("storageKey");

-- CreateIndex
CREATE INDEX "StaffDocument_staffProfileId_category_idx" ON "StaffDocument"("staffProfileId", "category");

-- CreateIndex
CREATE INDEX "StaffHistory_staffProfileId_createdAt_idx" ON "StaffHistory"("staffProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffDraft_createdById_updatedAt_idx" ON "StaffDraft"("createdById", "updatedAt");

-- Backfill only empty profiles; do not copy salary, health or payroll data.
INSERT INTO "StaffProfile" ("id", "userId", "updatedAt")
SELECT lower(hex(randomblob(16))), u."id", CURRENT_TIMESTAMP
FROM "User" AS u
WHERE u."role" IN ('DIRECTOR', 'HEAD_TEACHER', 'DEPUTY', 'SECRETARY', 'ACCOUNTANT', 'TEACHER', 'WELFARE_CHAIR', 'NON_TEACHING_STAFF')
  AND NOT EXISTS (SELECT 1 FROM "StaffProfile" AS p WHERE p."userId" = u."id");
