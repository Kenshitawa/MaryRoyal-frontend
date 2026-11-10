-- Multi-tenant schema migration: School, SchoolPaymentConfig, SuperAdmin and RLS policies

-- CreateTable
CREATE TABLE IF NOT EXISTS "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "motto" TEXT NOT NULL DEFAULT 'Hard work pays',
    "slogan" TEXT DEFAULT 'Nurturing Excellence Through CBE',
    "logoUrl" TEXT NOT NULL DEFAULT '/mary-royal-logo.png',
    "primaryColour" TEXT NOT NULL DEFAULT '#1d4ed8',
    "secondaryColour" TEXT NOT NULL DEFAULT '#102653',
    "accentColour" TEXT NOT NULL DEFAULT '#d97706',
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "poBox" TEXT,
    "physicalAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "School_slug_key" ON "School"("slug");

-- Seed initial demo school so existing rows have foreign key integrity
INSERT INTO "School" ("id", "name", "slug", "motto", "slogan", "logoUrl", "primaryColour", "secondaryColour", "accentColour", "status", "createdAt", "updatedAt")
VALUES ('school_demo_mary_royal', 'Mary Royal School', 'maryroyal', 'Hard work pays', 'Nurturing Excellence Through CBE', '/mary-royal-logo.png', '#1d4ed8', '#102653', '#d97706', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SchoolPaymentConfig" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "paybillNumber" TEXT,
    "accountFormat" TEXT NOT NULL DEFAULT 'ADMISSION_NO',
    "tillNumber" TEXT,
    "bankName" TEXT,
    "bankBranch" TEXT,
    "bankAccountNumber" TEXT,
    "bankAccountName" TEXT,
    "darajaConsumerKeyEncrypted" TEXT,
    "darajaConsumerSecretEncrypted" TEXT,
    "darajaPasskeyEncrypted" TEXT,
    "darajaShortcode" TEXT,
    "darajaEnvironment" TEXT NOT NULL DEFAULT 'sandbox',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolPaymentConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SchoolPaymentConfig_schoolId_key" ON "SchoolPaymentConfig"("schoolId");
ALTER TABLE "SchoolPaymentConfig" DROP CONSTRAINT IF EXISTS "SchoolPaymentConfig_schoolId_fkey";
ALTER TABLE "SchoolPaymentConfig" ADD CONSTRAINT "SchoolPaymentConfig_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SuperAdmin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuperAdmin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SuperAdmin_email_key" ON "SuperAdmin"("email");

-- Add schoolId and multi-tenant unique indexes to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "schoolId" TEXT NOT NULL DEFAULT 'school_demo_mary_royal';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
DROP INDEX IF EXISTS "User_email_key";
DROP INDEX IF EXISTS "User_phone_key";
DROP INDEX IF EXISTS "User_governmentId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "User_schoolId_email_key" ON "User"("schoolId", "email");
CREATE INDEX IF NOT EXISTS "User_schoolId_idx" ON "User"("schoolId");
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_schoolId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add schoolId and multi-tenant unique indexes to Learner
ALTER TABLE "Learner" ADD COLUMN IF NOT EXISTS "schoolId" TEXT NOT NULL DEFAULT 'school_demo_mary_royal';
DROP INDEX IF EXISTS "Learner_admissionNo_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Learner_schoolId_admissionNo_key" ON "Learner"("schoolId", "admissionNo");
CREATE INDEX IF NOT EXISTS "Learner_schoolId_idx" ON "Learner"("schoolId");
ALTER TABLE "Learner" DROP CONSTRAINT IF EXISTS "Learner_schoolId_fkey";
ALTER TABLE "Learner" ADD CONSTRAINT "Learner_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add schoolId to all other tenant tables
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'LearnerProfile', 'LearnerGuardian', 'LearnerEmergencyContact',
        'LearnerPickupPerson', 'AdmissionDraft', 'AdmissionDocument', 'AdmissionCounter',
        'SchoolSetting', 'CbcLevel', 'GuardianLink', 'Attendance', 'TeacherAssignment',
        'ClassTeacherAssignment', 'TeachingLog', 'Assignment', 'AssignmentSubmission',
        'LearningResource', 'LearningGameAttempt', 'Complaint', 'ComplaintReply',
        'Assessment', 'AssessmentHistory', 'FeeInvoice', 'InvoiceLine', 'FeeStructure',
        'FeeStructureLine', 'ReceiptCounter', 'FeePayment', 'FeeCredit', 'FeePaymentHistory',
        'FeeExpense', 'PayrollEntry', 'PayrollHistory', 'LearningVideo',
        'LearningVideoWatch', 'StaffAttendance', 'DisciplineIncident', 'ExamSession',
        'CbcRubric', 'FeeWaiver', 'Textbook', 'TextbookIssue', 'SchemeOfWork',
        'SchoolTimetable', 'WelfareMember', 'WelfareContribution', 'WelfareProduct',
        'WelfareLoan', 'Notification', 'StaffProfile', 'StaffEmergencyContact',
        'StaffReferee', 'StaffDocument', 'StaffHistory', 'StaffDraft'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "schoolId" TEXT NOT NULL DEFAULT ''school_demo_mary_royal''', tbl);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I ("schoolId")', tbl || '_schoolId_idx', tbl);
    END LOOP;
END $$;

-- AuditEvent schoolId can be nullable for platform-level actions
ALTER TABLE "AuditEvent" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
CREATE INDEX IF NOT EXISTS "AuditEvent_schoolId_idx" ON "AuditEvent"("schoolId");

-- Row Level Security (RLS) enforcement
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'User', 'Learner', 'LearnerProfile', 'LearnerGuardian', 'LearnerEmergencyContact',
        'LearnerPickupPerson', 'AdmissionDraft', 'AdmissionDocument', 'AdmissionCounter',
        'SchoolSetting', 'CbcLevel', 'GuardianLink', 'Attendance', 'TeacherAssignment',
        'ClassTeacherAssignment', 'TeachingLog', 'Assignment', 'AssignmentSubmission',
        'LearningResource', 'LearningGameAttempt', 'Complaint', 'ComplaintReply',
        'Assessment', 'AssessmentHistory', 'FeeInvoice', 'InvoiceLine', 'FeeStructure',
        'FeeStructureLine', 'ReceiptCounter', 'FeePayment', 'FeeCredit', 'FeePaymentHistory',
        'FeeExpense', 'PayrollEntry', 'PayrollHistory', 'AuditEvent', 'LearningVideo',
        'LearningVideoWatch', 'StaffAttendance', 'DisciplineIncident', 'ExamSession',
        'CbcRubric', 'FeeWaiver', 'Textbook', 'TextbookIssue', 'SchemeOfWork',
        'SchoolTimetable', 'WelfareMember', 'WelfareContribution', 'WelfareProduct',
        'WelfareLoan', 'Notification', 'StaffProfile', 'StaffEmergencyContact',
        'StaffReferee', 'StaffDocument', 'StaffHistory', 'StaffDraft', 'SchoolPaymentConfig'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON public.%I', tbl);
        EXECUTE format(
            'CREATE POLICY tenant_isolation_policy ON public.%I FOR ALL USING ("schoolId" = NULLIF(current_setting(''app.current_school_id'', true), '''') OR current_setting(''app.is_super_admin'', true) = ''true'') WITH CHECK ("schoolId" = NULLIF(current_setting(''app.current_school_id'', true), '''') OR current_setting(''app.is_super_admin'', true) = ''true'')',
            tbl
        );
    END LOOP;
END $$;

-- Security Definer Helpers
CREATE OR REPLACE FUNCTION public.set_current_school(p_school_id text) RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_school_id', p_school_id, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.set_super_admin_context(p_is_super boolean) RETURNS void AS $$
BEGIN
  PERFORM set_config('app.is_super_admin', CASE WHEN p_is_super THEN 'true' ELSE 'false' END, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
