# Performance audit

Baseline captured for `perf/fast-web-all-devices` before application performance changes. No database records or production settings were changed.

## Build and route bundle baseline

The first `npm run build` attempt did not complete: Prisma Client generation failed on Windows with `EPERM` replacing `node_modules/.prisma/client/query_engine-windows.dll.node`, which was locked by another process. A retry completed successfully. `npm run build:production` also completed successfully after the lock cleared, regenerating the PostgreSQL Prisma Client and compiling all 82 routes.

The isolated `NEXT_DIST_DIR=.next-perf-baseline npx next build` completed using the already generated local Prisma Client; this is a **provisional local bundle baseline**. The successful production-schema build reported the same six-route values below and 103 kB shared First Load JS.

| Page | Route JS | First Load JS |
| --- | ---: | ---: |
| Dashboard | 3.59 kB | 128 kB |
| Learners list | 7.86 kB | 203 kB |
| Learner profile | 179 B | 111 kB |
| Finance / fees | 13.3 kB | 169 kB |
| Attendance | 5.50 kB | 113 kB |
| Admissions | 5.65 kB | 117 kB |

The requested after sizes are pending performance changes.

## Lighthouse baseline

Desktop and mobile Lighthouse scores were **not measured**. The Lighthouse package/CLI is not installed and no local app server was listening on ports 3000, 3001 or 4173 during the audit. These authenticated pages also require a synthetic test session to measure the real dashboard and school data workflows safely. No production credentials or real learner data were used to fabricate a baseline.

Required routes: dashboard, learners list, learner profile, finance/fees, attendance, and admissions. Record Performance, Accessibility, Best Practices, LCP, INP/TBT and CLS for desktop and mobile once an isolated test environment and Lighthouse are available.

## Database and page-query inventory

The app uses Prisma for database reads; no Supabase database-client `.from(...).select(...)` calls were found under `src`. Supabase is used by the private file-storage adapter. Counts below are direct Prisma read call sites in each server page, including role-conditional branches; client-side API requests and calls inside imported components are not included yet.

| Page | Direct read call sites | Models queried |
| --- | ---: | --- |
| `/accounts` | 1 | User |
| `/admissions` | 3 | AdmissionDraft, SchoolSetting, User |
| `/admissions/[id]` | 2 | AdmissionDraft, User |
| `/admissions/new` | 1 | User |
| `/assessments` | 2 | TeacherAssignment, User |
| `/assessments/exams` | 1 | User |
| `/assessments/rubrics` | 1 | User |
| `/assignments` | 2 | TeacherAssignment, User |
| `/attendance` | 5 | Attendance, ClassTeacherAssignment, Learner, User |
| `/audit` | 2 | AuditEvent, User |
| `/complaints` | 2 | GuardianLink, User |
| `/dashboard` | 39 across role branches | Assessment, Attendance, AuditEvent, ClassTeacherAssignment, Complaint, ExamSession, FeeInvoice, FeePayment, FeeStructure, Learner, PayrollEntry, SchoolTimetable, TeacherAssignment, User, WelfareMember |
| `/finance` | 1 | User; main finance data is fetched by its client component/API |
| `/finance/structures` | 1 | User |
| `/learners` | 2 | TeacherAssignment, User; directory data is fetched by its client component/API |
| `/learners/[id]` | 13 | AdmissionDocument, AdmissionDraft, Assessment, Attendance, AuditEvent, DisciplineIncident, FeeInvoice, FeePayment, GuardianLink, Learner, LearnerProfile, User |
| `/learners/[id]/edit` | 2 | Learner, User |
| `/learning` | 6 | Assessment, AssignmentSubmission, Attendance, GuardianLink, LearningGameAttempt, User |
| `/learning-content` | 2 | TeacherAssignment, User |
| `/learning-videos` | 1 | User |
| `/library` | 1 | User |
| `/portal` | 5 | Assessment, Attendance, FeeInvoice, GuardianLink, User |
| `/profile` | 1 | User |
| `/receipts` | 5 | FeePayment, GuardianLink, User |
| `/reports` | 7 | Assessment, FeeInvoice, Learner, User, WelfareContribution |
| `/schemes` | 2 | TeacherAssignment, User |
| `/staff` | 2 | User |
| `/staff/[id]` | 5 | PayrollEntry, StaffAttendance, TeachingLog, User |
| `/staff/new` | 1 | User |
| `/teaching-log` | 2 | TeacherAssignment, User |
| `/timetable` | 4 | SchoolTimetable, TeacherAssignment, User |
| `/welfare` | 1 | User |

Call-site totals do not equal runtime query counts: Prisma relation includes may issue multiple SQL statements, conditions vary by role, and database calls inside client-facing API handlers/imported components have not been inventoried. Dashboard is the clearest server-render hotspot (up to 13 reads in the Director branch plus an audit activity read); its fee summaries fetch nested invoice lines and payments with hard `take` caps rather than database-side aggregates. The learner profile has 13 conditional call sites. Per-query latency, N+1 loops, unbounded lists and all API/client query call sites remain to be measured.

## Hosting and database region

Production database and app-host regions were not verified. `.env` contains a `DATABASE_URL`, but no credential or connection string was printed or copied into this report. The repository has a Render deployment manifest and no `vercel.json`; hosting region cannot be inferred safely from local files. Check the Supabase project region and the actual production host/function region in their dashboards, then document the exact regions here. If they differ, coordinate any move manually; do not change the production project region as part of this audit.

## Current blockers and next measurement work

- Retry Prisma generation/build when the existing Windows process releases the query-engine DLL; then record the PostgreSQL production-schema route bundles.
- Run Lighthouse desktop/mobile on an isolated, synthetic-data app server and record the requested scores and top findings.
- Inventory API-handler queries and imported client component fetches for all routes; flag unbounded lists, `select`-all/overfetching and database calls inside loops.
- Only after query timing is available, run `EXPLAIN ANALYZE` on the three slowest safe queries against an isolated copy; do not run production mutations or change production database settings.
- Existing mobile audit is incomplete (3/20 collections, 17 findings; see `docs/MOBILE_FAILURES.md`), so it cannot currently establish non-regression.
- The pasted release rule forbids deployment until lint, type-check, all unit tests and build pass and the mobile audit does not regress. Deployment is therefore not authorized by the current verification state, even though the requested push to a performance branch is allowed.

## Baseline verification

- `npm run lint` passed after excluding the isolated generated build directory from ESLint.
- `npm run typecheck` passed.
- `npm test -- --maxWorkers=1 --testTimeout=20000` passed (16 files, 81/81 tests).
- `npm run build` passed on retry (SQLite/local schema); `npm run build:production` passed (PostgreSQL schema, 82 routes).
- Lighthouse and E2E/mobile non-regression checks remain outstanding.
