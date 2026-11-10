# School Core System: Mary Royal Codebase Analysis & Multi-Tenant Transition Architecture

> **Document Status**: Ready for Review & Approval  
> **Target System**: School Core System (Multi-Tenant School Generator)  
> **Source Baseline**: Mary Royal School Management System (`SMS`)  
> **Author**: Antigravity Core Engineering  
> **Phase**: Phase 1 — Codebase Analysis & Multi-Tenant Strategy

---

## 1. Executive Summary

This document provides a comprehensive inspection of the **Mary Royal School Management System (`SMS`)** codebase, serving as the canonical source-of-truth template for the multi-tenant **School Core System**. 

The goal of the core system is to allow a platform **Super Admin** to log in, click **"Add School"**, provide core institution details (name, slug/subdomain, logo, motto, brand colours, and M-Pesa/bank/Daraja payment credentials), and automatically provision an identical, isolated instance of the school management system.

Every generated school will possess the exact same features, CBC curriculum structures, roles, pages, and workflows as Mary Royal School. The only per-school differentiators will be tenant configuration parameters.

Per project constraints: **no code implementation of subsequent phases will begin until this analysis is reviewed and approved.**

---

## 2. Technology Stack & Runtime Architecture

| Layer | Technologies & Dependencies | Role in System |
|---|---|---|
| **Framework** | Next.js 15.5.6 (App Router), React 19.1.1 | Server Components, Server Actions, API Route Handlers |
| **Language** | TypeScript 5.9.3 | Strict type safety (`strict: true`, no implicit any) |
| **Styling & UI** | Tailwind CSS v4.1.16, PostCSS 8.5.31, Lucide React (0.468.0), Framer Motion (14.6.0) | CSS variables for theme tokens (`--brand`, `--canvas`, etc.), responsive mobile-first UI |
| **Database & ORM** | Prisma ORM 6.19.0, PostgreSQL (Supabase Production with Direct/Pooled URLs), SQLite (local test harness) | Data modeling, migrations, client queries, connection pooling |
| **Database Security** | PostgreSQL Row-Level Security (RLS) | Database-level row isolation by tenant identifier (`school_id`) |
| **Validation** | Zod 4.1.12 | Input validation and schema parsing across all API endpoints |
| **Security & Auth** | `jose` (v6.1.0), `bcryptjs` (v3.0.2), Node.js `crypto` | JWT signed sessions, password hashing, AES-256-GCM Daraja secret encryption |
| **PDF Generation** | `pdf-lib` (v1.17.1) | Vector-accurate institutional documents (receipts, admission slips, salary vouchers, staff slips) |
| **Analytics & Charts** | Recharts 3.10.1 | Role dashboards and financial analytics |
| **Testing** | Vitest 5.0.5, Playwright 1.56.1 | Unit tests, permissions matrix tests, e2e browser flows, tenant isolation test suite |
| **PWA / Offline** | Custom Service Worker (`sw.js`), Web App Manifest, offline cache | Installable web app experience with offline fallbacks |

---

## 3. Database Schema Analysis & Multi-Tenant Adaptation

### 3.1 Existing Schema Overview (Single-Tenant Baseline)
The existing database contains **58 models** defined across both `prisma/schema.prisma` (SQLite) and `prisma/postgresql/schema.prisma` (PostgreSQL):

1. **Identity & Core Access**: `User`, `AuditEvent`
2. **Learner Management & Admissions**: `Learner`, `LearnerProfile`, `LearnerGuardian`, `LearnerEmergencyContact`, `LearnerPickupPerson`, `AdmissionDraft`, `AdmissionDocument`, `AdmissionCounter`, `GuardianLink`
3. **Staff & HR**: `StaffProfile`, `StaffEmergencyContact`, `StaffReferee`, `StaffDocument`, `StaffHistory`, `StaffDraft`, `StaffAttendance`
4. **Academics & CBC Curriculum**: `CbcLevel`, `TeacherAssignment`, `ClassTeacherAssignment`, `TeachingLog`, `Assignment`, `AssignmentSubmission`, `LearningResource`, `LearningGameAttempt`, `Assessment`, `AssessmentHistory`, `ExamSession`, `CbcRubric`, `Textbook`, `TextbookIssue`, `SchemeOfWork`, `SchoolTimetable`, `LearningVideo`, `LearningVideoWatch`
5. **Finance & Bursary**: `FeeInvoice`, `InvoiceLine`, `FeeStructure`, `FeeStructureLine`, `ReceiptCounter`, `FeePayment`, `FeeCredit`, `FeePaymentHistory`, `FeeExpense`, `PayrollEntry`, `PayrollHistory`, `FeeWaiver`
6. **Welfare Fund**: `WelfareMember`, `WelfareContribution`, `WelfareProduct`, `WelfareLoan`
7. **Discipline & Pastoral**: `DisciplineIncident`, `Complaint`, `ComplaintReply`
8. **System & Notifications**: `Notification`, `SchoolSetting`

### 3.2 Critical Multi-Tenant Gaps in Current Schema
- **Missing Tenant Key**: None of the 58 domain models currently possess a `school_id` foreign key.
- **Global Unique Constraints**:
  - `User.email` is currently `@unique` globally across the entire database. In multi-tenant, parents or teachers could conceivably have accounts across schools, or schools might have identical generic emails (e.g. `director@school.com`). The constraint must be scoped: `@@unique([schoolId, email])`.
  - `User.phone` and `User.governmentId` are globally unique.
  - `Learner.admissionNo` is globally unique. In multi-tenancy, multiple schools inevitably have overlapping admission numbers (e.g. `ADM-001`). This must be scoped: `@@unique([schoolId, admissionNo])`.
  - `ReceiptCounter.id` and `AdmissionCounter.id` are single-row tables without tenant scoping.
  - `CbcLevel.sortOrder` is globally unique.

### 3.3 Target Multi-Tenant Schema Additions
To transform this into an enterprise multi-tenant core:
1. **`School` (Tenant Master Table)**:
   - `id`: `String @id @default(cuid())`
   - `name`: `String` (e.g., "Mary Royal School", "St. Jude Academy")
   - `slug`: `String @unique` (subdomain identifier, e.g., "maryroyal", "stjude")
   - `motto`: `String`
   - `slogan`: `String?`
   - `logoUrl`: `String`
   - `primaryColour`: `String` (Hex/OKLCH, e.g., `#1d4ed8`)
   - `secondaryColour`: `String` (Hex, e.g., `#102653`)
   - `accentColour`: `String` (Hex, e.g., `#d97706`)
   - `contactEmail`: `String?`
   - `contactPhone`: `String?`
   - `poBox`: `String?`
   - `physicalAddress`: `String?`
   - `status`: `String @default("ACTIVE")` (`ACTIVE`, `SUSPENDED`)
   - `createdAt`: `DateTime @default(now())`
   - `updatedAt`: `DateTime @updatedAt`
2. **`SchoolPaymentConfig` (Encrypted Financial Settings Table)**:
   - `id`: `String @id @default(cuid())`
   - `schoolId`: `String @unique`
   - `paybillNumber`: `String?`
   - `accountFormat`: `String @default("ADMISSION_NO")`
   - `tillNumber`: `String?`
   - `bankName`: `String?`
   - `bankBranch`: `String?`
   - `bankAccountNumber`: `String?`
   - `bankAccountName`: `String?`
   - `darajaConsumerKeyEncrypted`: `String?`
   - `darajaConsumerSecretEncrypted`: `String?`
   - `darajaPasskeyEncrypted`: `String?`
   - `darajaShortcode`: `String?`
   - `darajaEnvironment`: `String @default("sandbox")` (`sandbox` or `production`)
   - `updatedAt`: `DateTime @updatedAt`
3. **`SuperAdmin` (Core Platform Administration Table)**:
   - `id`: `String @id @default(cuid())`
   - `email`: `String @unique`
   - `name`: `String`
   - `passwordHash`: `String`
   - `twoFactorSecret`: `String?`
   - `twoFactorEnabled`: `Boolean @default(false)`
   - `createdAt`: `DateTime @default(now())`
4. **`schoolId` column and indexes on all 58 tenant tables**:
   - `ALTER TABLE "..." ADD COLUMN "school_id" TEXT NOT NULL REFERENCES "School"("id") ON DELETE CASCADE;`
   - `CREATE INDEX "..._school_id_idx" ON "..."("school_id");`
5. **PostgreSQL RLS Policies**:
   - `ENABLE ROW LEVEL SECURITY` on every tenant table.
   - Session variable `app.current_school_id` evaluated in policies:
     `CREATE POLICY tenant_isolation ON "Learner" USING (school_id = current_setting('app.current_school_id', true));`

---

## 4. Authentication, Sessions & RBAC

### 4.1 Existing Authentication Model
- **Token Format**: Stateless Signed JWT (`HS256`) generated via `jose`.
- **Cookies**:
  - `mary_session`: Contains `{ sub: userId, role, forcePasswordChange }`. Expiration: 8 hours. SameSite: Lax, HttpOnly.
  - `mary_activity`: Tracks user idle state `{ kind: "idle", sub: userId }`. Expiration: 10 minutes. If expired, `middleware.ts` invalidates both cookies and forces re-authentication.
- **Login Endpoint** (`/api/login`):
  - Validates credentials against `User` table (email + bcrypt compare).
  - Rate limiting: In-memory IP bucket (max 12 attempts per minute).
  - Account Lockout: Tracks `failedLogins`. Locks account after 8 consecutive failures.
  - Audit: Records `LOGIN_SUCCEEDED` or `LOGIN_FAILED` in `AuditEvent`.

### 4.2 Multi-Tenant Auth Evolution
- **Session Cookie Separation**:
  - `platform_session`: Dedicated Super Admin JWT cookie for core provisioning and multi-school governance.
  - `school_session`: Per-school tenant JWT, containing `{ sub: userId, schoolId, role, forcePasswordChange }`.
  - `school_activity`: 10-minute idle verification scoped to active user and school session.
- **Two-Step Verification (2FA)**:
  - Required for: **Super Admin**, **Director**, **Head Teacher**, and **Accountant**.
  - TOTP / Authenticator RFC 6238 implementation with encrypted secret storage.
- **Login Credentials**:
  - Support username/email or Kenyan phone (`+254...` or `07...`) plus password. No external OAuth/Google sign-in.
  - Tenant-bound authentication: User queries on login must be scoped to the resolved school's `school_id`.

### 4.3 Roles and RBAC Matrix
The 10 existing school roles are preserved verbatim:
1. `DIRECTOR`: Executive authority, system setup, user creation, fee waivers, report releases.
2. `HEAD_TEACHER`: Academic leadership, admissions approval, payroll authoring, assessments review.
3. `DEPUTY`: Timetables, textbook management, discipline, day-to-day operations.
4. `SECRETARY`: Learner registration, admissions entry, student profile edits, front desk.
5. `ACCOUNTANT`: Fee invoicing, receipting, fee structure entry, expense tracking, payroll review.
6. `TEACHER`: Assessment scoring, schemes of work, lesson logs, homework, roll call.
7. `WELFARE_CHAIR`: Staff benevolent fund, savings, welfare loans.
8. `NON_TEACHING_STAFF`: Support staff profile, welfare fund participation.
9. `PARENT`: Guardian portal, fee balances, M-Pesa receipts, academic reports, complaints.
10. `LEARNER`: Student portal, assignments, timetables, educational games and videos.

**Platform Level**:
- `SUPER_ADMIN`: Cross-tenant platform administrator. Can provision schools, update tenant configurations, manage platform keys, inspect global audit logs, but does not interfere with internal school grading/pastoral records.

**Enforcement Rule**:
- In accordance with the Mary Royal design, **only the Secretary and Head Teacher can edit learner profiles**; all other roles view only.
- Deny-by-default on every route and database query via centralized permission guards.

---

## 5. Complete Page & Route Inventory

### 5.1 Public and Authentication Routes
- `/`: Branded School Sign-in Page (Hero banner, school crest, login form, privacy link).
- `/privacy`: Institutional Data Protection & Privacy Notice.
- `/change-password`: Compulsory first-time password reset portal.
- `/receipts/[id]`: Public/Parent receipt validation and digital printable view with verification QR code.
- `/super-admin/login`: **[NEW]** Platform Super Admin authentication console.
- `/super-admin/*`: **[NEW]** School generator dashboard, "Add School" modal/form, school status manager, global metrics.

### 5.2 Portal Pages (`src/app/(portal)/*`)
- `/dashboard`: Role-tailored operational KPIs, quick actions, Director startup checklist.
- `/accounts`: School staff user account provisioning and access control (Director only).
- `/admissions`: Learner application intake, documentation verification, approval workflows.
- `/admissions/new`: Multi-step admission entry wizard.
- `/assessments`: CBC rubric evaluation, formative and summative marks, grade calculation.
- `/assignments`: Homework assignment publishing and submission tracking.
- `/attendance`: Daily student attendance registers and staff clock-in tracking.
- `/audit`: Immutable security, login, and modification audit logs.
- `/complaints`: Parent concern filing, automated triage, and administrative replies.
- `/finance`: Invoicing, fee structures, payments, credit notes, fee waivers, and payroll slips.
- `/learners`: Student directory, admission dossiers, guardian contacts, export slips.
- `/learners/[id]`: Full learner record with photo capture and printable admission slip.
- `/learning`: CBC curriculum catalog, competencies, learning games, interactive exercises.
- `/learning-content`: Digital library, schemes, and teacher study notes.
- `/learning-videos`: Curated educational video streaming & watch logs.
- `/library`: Textbooks inventory, lending records, return condition logs.
- `/profile`: User credential management, avatar upload, and theme/color preferences.
- `/reports`: Academic report cards, financial collections, and enrollment distribution.
- `/schemes`: Schemes of work preparation, HOD confirmation, and administrative approval.
- `/staff`: Human resource directory, TSC numbers, qualification dossiers, credential slips.
- `/teaching-log`: Classroom lesson delivery logs and curriculum pacing checks.
- `/timetable`: Classroom and educator schedule management.
- `/welfare`: Staff welfare contributions, monthly statements, and benevolent loan applications.

### 5.3 API Route Handlers (`src/app/api/*`)
Over 40 API route handlers managing accounts, admissions, AI assists, assessments, attendance, audit, complaints, exams, finance (invoices, payments, payroll, structures, waivers), learners, learning resources, navigation badges, profile, reports, rubrics, schemes, staff dossiers, textbooks, timetable, file uploads, and welfare.

Every single API handler must be updated to resolve `school_id` from the host/session context and enforce multi-tenant isolation.

---

## 6. Audit of Hardcoded "Mary Royal" Values & Assets

A comprehensive grep across the codebase revealed that "Mary Royal" values and institution-specific data appear in **28 critical locations**. Every one of these will be replaced with dynamic tenant configuration.

### 6.1 Names, Mottos & Identifiers
| Location / File | Hardcoded Text / Pattern | Tenant Replacement Key |
|---|---|---|
| `src/app/layout.tsx` (L18-25) | `title: "Mary Royal School \| Hard work pays"`<br>`description: "Mary Royal School · Nurturing Excellence Through CBE"`<br>`applicationName: "Mary Royal SMS"` | `tenant.name`, `tenant.motto`, `tenant.slogan` |
| `src/app/page.tsx` (L15-20) | `MARY ROYAL SCHOOL · KISUMU`<br>`School motto · Hard work pays`<br>`Nurturing Excellence Through CBE`<br>`© 2026 Mary Royal School · Obunga, Kisumu` | `tenant.name`, `tenant.motto`, `tenant.slogan`, `tenant.physicalAddress` |
| `src/app/login-form.tsx` (L22) | `"Use the account provided by Mary Royal School."` | `"Use the account provided by " + tenant.name` |
| `src/app/not-found.tsx` (L4) | `"Mary Royal School"` | `tenant.name` |
| `src/app/change-password/page.tsx` (L33-36) | `"Mary Royal School"`<br>`"Obunga, Kisumu · First-time Setup"` | `tenant.name`<br>`tenant.physicalAddress + " · First-time Setup"` |
| `src/app/privacy/page.tsx` (L48) | `"Mary Royal School · Obunga, Kisumu, Kenya"` | `tenant.name + " · " + tenant.physicalAddress` |
| `src/app/receipts/[id]/page.tsx` (L75, 114) | `https://maryroyal.ac.ke/verify/receipt?...`<br>`"Mary Royal School - Obunga, Kisumu · Hard work pays"` | Dynamic tenant verification URL (`tenant.slug + "." + rootDomain`)<br>`tenant.name`, `tenant.motto` |
| `src/components/ui/page-shell.tsx` (L69-71, 101-102, 109) | `"Mary Royal School · Obunga · Kisumu"`<br>`"Hard work pays · Nurturing Excellence Through CBE"` | `tenant.name`, `tenant.physicalAddress`, `tenant.motto`, `tenant.slogan` |
| `src/components/dashboard-header.tsx` (L29, 33) | `"Mary Royal"`<br>`"Mary Royal School"` | `tenant.name` |
| `src/components/mobile-nav.tsx` (L261) | `"Mary Royal Workspace"` | `tenant.name + " Workspace"` |
| `src/components/confirm-logout-form.tsx` (L7) | `"Sign out of Mary Royal School?"` | `"Sign out of " + tenant.name + "?"` |

### 6.2 Financial & Payment Settings (M-Pesa & Bank)
| Location / File | Hardcoded Value | Tenant Replacement Key |
|---|---|---|
| `src/components/parent-fee-payment-guide.tsx` (L135, 199) | M-Pesa Paybill: `522123` | `tenant.paymentConfig.paybillNumber` |
| `src/components/parent-fee-payment-guide.tsx` (L159-163) | Account Format: `Learner Admission No.` | `tenant.paymentConfig.accountFormat` |
| `src/components/parent-fee-payment-guide.tsx` (L244-245) | Bank: `Kenya Commercial Bank (KCB)`<br>Branch: `Kisumu Main Branch (Bank Code: 01)` | `tenant.paymentConfig.bankName`<br>`tenant.paymentConfig.bankBranch` |
| `src/components/parent-fee-payment-guide.tsx` (L254, 258) | Account Number: `1289456721` | `tenant.paymentConfig.bankAccountNumber` |
| `src/components/parent-fee-payment-guide.tsx` (L295, 303-316) | Accounts Desk: `"Administration Block, Ground Floor, Obunga Campus"`<br>`"Official Mary Royal School receipts..."` | `tenant.name + " Accounts Desk"`<br>`tenant.physicalAddress` |

### 6.3 PDF Generation Engines (Vector Graphics & Mastheads)
All PDF generators embed school headers, P.O. Box, contacts, and custom color accents:
1. **Fee Receipt PDF** (`src/app/api/finance/payments/[id]/pdf/route.ts`):
   - School name: `"MARY ROYAL PRIMARY & JUNIOR SCHOOL"`
   - Address: `"P.O. Box 40100, Kisumu, Kenya · Tel: +254 718 216 374 · Email: maryroyalschool81@gmail.com"`
   - Location: `"Obunga (Near Breweries), Kisumu, Kenya"`
   - Motto & Slogan: `"Hard Work Pays" · "Nurturing Excellence Through CBE"`
   - Logo: reads `public/mary-royal-logo.png`
2. **Fee Invoice PDF** (`src/app/api/finance/invoices/[id]/pdf/route.ts`):
   - Identical hardcoded institutional masthead and contact strings.
3. **Salary & Remuneration Slip PDF** (`src/app/api/finance/payroll/[id]/pdf/route.ts`):
   - `"MARY ROYAL SCHOOL · Obunga, Kisumu, Kenya"`
   - `"Human Resources & Finance Department · P.O. Box Obunga, Kisumu"`
4. **Learner Admission Slip PDF** (`src/app/api/learners/[id]/admission-slip/route.ts`):
   - Centered crest with "MR" fallback monogram.
   - Reference code prefix: `"MR-SLIP/"`
   - Hardcoded campus line: `"Campus: Obunga (Near Breweries), Central Kisumu Sub-County, Kisumu County"`
5. **Staff Credential Slip PDF** (`src/lib/staff-slip-pdf.ts`):
   - Reference prefix: `"MRS/ACC/"`
   - Fallback logo drawn with "MR" text in gold/royal colors.
   - Hardcoded contacts and footer.

### 6.4 Static Assets & Public Files
- `public/mary-royal-logo.png`: School crest (PNG format).
- `public/mary-royal-icon.png`: App icon 512x512.
- `public/logo.svg`: SVG crest with centered "MR" emblem and royal blue `#1d4ed8`.
- `public/manifest.webmanifest`: Contains hardcoded `"name": "Mary Royal School"`, `"short_name": "Mary Royal"`, theme color `#1d4ed8`.

### 6.5 System & Storage Keys
- Cookie names: `mary_session`, `mary_activity` -> Will be generalized to `school_session`, `school_activity` (plus `platform_session` for Super Admin).
- LocalStorage keys: `mary-theme`, `mary-style`, `mary-nav-*` -> Updated to standard theme and navigation keys.
- DOM events: `mary-go-back` -> `app-go-back`.
- Environment flag: `MARY_E2E` in `src/lib/environment.ts`.

---

## 7. Multi-Tenant Architecture & Subdomain Resolution Plan

```
                              [ Incoming HTTP Request ]
                                          │
                                 (Read Host Header)
                                          │
                 ┌────────────────────────┴────────────────────────┐
                 ▼                                                 ▼
        [ superadmin.domain.com ]                     [ <school-slug>.domain.com ]
                 │                                                 │
      (Super Admin Platform)                            (Tenant Resolution & Cache)
                 │                                                 │
    ┌────────────┴────────────┐                                    ▼
    ▼                         ▼                        [ Fetch School Config ]
[ Admin Login ]        [ "Add School" ]                            │
                       (Provisioning Job)                          ▼
                              │                        [ Inject Theme & Branding ]
                              ▼                       (CSS Variables, Logo, Colors)
                   - Insert Tenant Row                             │
                   - Upload Logo to Storage                        ▼
                   - Seed Default CBC Roles           [ Set DB Session & RLS ]
                   - Create First Director Account    (SET app.current_school_id)
                   - Encrypt Daraja Credentials                    │
                   - Bind Subdomain                                ▼
                                                       [ Isolated School System ]
```

### 7.1 Subdomain Tenant Resolution Flow
1. **Host Header Inspection**: `middleware.ts` inspects the request `Host` header.
   - If host matches `superadmin.*` or `/super-admin` route, route to Platform Management.
   - If host matches `<subdomain>.domain.co.ke` (or `<subdomain>.localhost:3000` in local development), extract the subdomain slug.
2. **Tenant Config Caching**:
   - Query `School` record by `slug`.
   - Cache in-memory / edge key-value cache with a short TTL (e.g., 60 seconds) for high throughput across 200+ schools.
   - If school is `SUSPENDED`, render an institutional notice page.
   - If school does not exist, return a dedicated tenant 404 page.
3. **Dynamic Branding Injection**:
   - The root layout injects dynamic CSS variables (`--brand`, `--brand-hover`, `--chrome-from`, etc.) from the tenant's primary and secondary colors.
   - Layout metadata (title, favicon, description) dynamically renders tenant institution details.
4. **Database Context & RLS**:
   - Prisma middleware / extension sets `SET LOCAL app.current_school_id = '<current_school_id>'` before tenant queries, ensuring Supabase Postgres RLS policies completely block cross-tenant read/write.

---

## 8. Per-School Payment Configuration & Encryption Spec

### 8.1 Fields Managed Per School
1. **M-Pesa Paybill Number** (e.g. `522123`)
2. **Account Format** (e.g. `ADMISSION_NO`, `ADMISSION_NAME`, `CUSTOM_PREFIX`)
3. **Till Number** (optional for point-of-sale/canteen payments)
4. **Bank Details** (Bank Name, Branch, Account Number, Account Name)
5. **Daraja API Credentials**:
   - Consumer Key
   - Consumer Secret
   - Passkey
   - Shortcode / Paybill
   - Environment: Sandbox vs Production

### 8.2 Cryptographic Security Requirements
- **Algorithm**: `AES-256-GCM` with a 96-bit initialization vector (IV) and 128-bit authentication tag.
- **Master Encryption Key**: Loaded strictly from `ENCRYPTION_MASTER_KEY` environment variable. Never written to the database or committed to version control.
- **Masking at Rest & Presentation**:
  - Daraja Consumer Key: stored encrypted; in UI displayed as `••••••••••••••••` with only the last 4 characters visible (`...3A9f`).
  - Daraja Consumer Secret and Passkey: stored encrypted; never returned to the browser under any circumstances after saving.
- **Access Control**: Payment settings viewable and editable exclusively by **Super Admin**, and the specific school's **Director** and **Accountant**.

---

## 9. Provisioning Engine Design ("Add School")

When Super Admin submits "Add School":
1. **Validation**: Validate school name, slug (lowercase alphanumeric and hyphens), motto, primary/secondary colors, payment settings, and initial Director details (name, email, phone, temporary password).
2. **Transactional Execution**:
   - Execute in a single PostgreSQL transaction / idempotent orchestration job.
   - If any step fails (e.g. logo upload failure, duplicate email, database connection blip), roll back completely so no partial school records exist.
3. **Steps**:
   1. Create `School` record.
   2. Save encrypted `SchoolPaymentConfig`.
   3. Store uploaded logo asset (optimized to WebP format, max 512x512).
   4. Seed foundational data:
      - Default CBC Levels (`EE`, `ME`, `AE`, `BE`).
      - Default Receipt Counter and Admission Counter for the school.
      - Default School Settings.
   5. Create first `User` with role `DIRECTOR`, hashed password (bcrypt high cost factor), and `forcePasswordChange: true`.
   6. Write `AuditEvent` with action `PROVISION_SCHOOL`.
   7. Return confirmation with the provisioned school URL (e.g., `http://demo.localhost:3000` or `https://demo.yourdomain.co.ke`).

---

## 10. Security & Performance Guardrails

- **Tenant Isolation Testing**: Automated test suite (`tests/tenant-isolation.test.ts`) asserting that:
  - User from School A cannot view, query, or mutate Learners, Invoices, Payments, Staff, or Audit logs of School B.
  - API endpoints reject spoofed host headers or cross-tenant IDs with HTTP 403/404.
- **Rate Limiting**: Applied to login, password change, provisioning endpoints, and payment webhook handlers.
- **Input Validation**: Strict Zod schemas on every route with `.strict()` where appropriate to strip unknown fields.
- **Performance Targets**:
  - `school_id` indexed on every single tenant table.
  - Short-TTL tenant config caching.
  - Pagination on all lists (`take` and `skip` or cursor-based).
  - Mobile-first bundle budget: Keep initial HTML/CSS payload lean, optimize images to WebP.

---

## 11. Proposed Execution Phases (Post-Approval)

- **Phase 2**: Multi-tenant database schema (`School`, `SchoolPaymentConfig`, `SuperAdmin`, `school_id` migrations, Supabase RLS policies, and tenant isolation tests).
- **Phase 3**: Subdomain tenant resolution middleware, tenant configuration loader, and dynamic CSS brand variables.
- **Phase 4**: Super Admin authentication, school listing dashboard, and "Add School" UI with logo upload.
- **Phase 5**: Idempotent provisioning job (tenant row, seed data, initial Director bootstrap, subdomain binding).
- **Phase 6**: Per-school payment settings with AES-256-GCM encryption and masked UI display.
- **Phase 7**: Central RBAC permission table, server-side route guards, and role scoping.
- **Phase 8**: Security hardening (rate limits, Zod validation, security headers, audit logging, 2FA).
- **Phase 9**: Performance optimization (indexes, tenant caching, list pagination, WebP image pipeline).
- **Phase 10**: Full test suite verification (lint, typecheck, unit tests, tenant-isolation tests, E2E creation & login).
- **Phase 11**: Local demonstration showing the Demo School and a newly generated school operating side-by-side.

---

## 12. Approval Sign-Off Request

In strict compliance with the project instructions:
> *"Save it as docs/analysis.md. Do not implement anything until I approve that analysis."*

**No implementation code has been modified or generated.** We await your review and explicit approval of this architectural analysis and plan before advancing to Phase 2.
