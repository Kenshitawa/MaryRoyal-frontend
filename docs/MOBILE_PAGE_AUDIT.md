# Mobile Page Audit — Every Page, Every Role

Automated evidence: `e2e/mobile-audit.spec.ts` visits every role-accessible route at **360px** and **390px** in four appearances (light/dark × bento/glass) and fails on horizontal overflow, sub-scale text, missing landmarks, unnamed controls, undersized targets, contrast failures, runtime errors and unexpected redirects. The last full run recorded **20/20 role/viewport collections, 0 findings** across the index routes; the detail-page pass is part of the same spec and is re-run in the final acceptance batch.

Screenshots: `mobile-shots/` (360px, ignored by git) with `mobile-shots/contact-<role>.png` contact sheets.

Rules applied: 12px captions/badges, 13px labels/nav, 14px body, 16px titles, 20px page titles, 24px KPI; 44px targets; no horizontal scroll; one `<main>` and one `<h1>`; AA contrast in both themes; tables become card lists below `lg`. The only 44px exception is an inline prose link, recorded in `docs/DECISIONS.md`.

Legend: **Done** = automated collection passed with zero findings and the screen was visually checked at 360px; **In progress** = wired into the matrix, final detail pass pending.

---

## Shared (public and account)

| Page | Route | 360px | 390px | Appearances | Status |
|---|---|---|---|---|---|
| Sign in | `/` | Done | Done | 4 | Done |
| Change password | `/change-password` | Done | Done | 4 | Done |
| Privacy notice | `/privacy` | Done | Done | 4 | Done |
| Printable receipt | `/receipts/[id]` | Done | Done | 4 | In progress |
| Dev styleguide | `/dev/styleguide` | n/a | n/a | n/a | Dev-only, excluded from production audit |

## Parent

| Page | Route | 360px | 390px | Appearances | Status |
|---|---|---|---|---|---|
| Children overview, results, fee guide | `/portal` | Done | Done | 4 | Done |
| Complaints thread | `/complaints` | Done | Done | 4 | Done |
| Child profile (linked scope) | `/learners/[id]` | Done | Done | 4 | In progress |
| Fee receipt | `/receipts/[id]` | Done | Done | 4 | In progress |
| Personal account | `/profile` | Done | Done | 4 | Done |
| Privacy notice | `/privacy` | Done | Done | 4 | Done |
| Change password | `/change-password` | Done | Done | 4 | Done |

## Learner

| Page | Route | 360px | 390px | Appearances | Status |
|---|---|---|---|---|---|
| My learning dashboard | `/learning` | Done | Done | 4 | Done |
| Assignments and feedback | `/assignments` | Done | Done | 4 | Done |
| KICD video library | `/learning-videos` | Done | Done | 4 | Done |
| Results and fee statement | `/portal` | Done | Done | 4 | Done |
| Own learner profile | `/learners/[id]` | Done | Done | 4 | In progress |
| Personal account | `/profile` | Done | Done | 4 | Done |
| Privacy notice | `/privacy` | Done | Done | 4 | Done |
| Change password | `/change-password` | Done | Done | 4 | Done |

## Teacher

| Page | Route | 360px | 390px | Appearances | Status |
|---|---|---|---|---|---|
| Dashboard | `/dashboard` | Done | Done | 4 | Done |
| Class attendance | `/attendance` | Done | Done | 4 | Done |
| Learner register | `/learners` | Done | Done | 4 | Done |
| Assigned learner profile | `/learners/[id]` | Done | Done | 4 | In progress |
| CBC assessments workspace | `/assessments` | Done | Done | 4 | Done |
| Exam sessions | `/assessments/exams` | Done | Done | 4 | Done |
| CBC rubrics | `/assessments/rubrics` | Done | Done | 4 | Done |
| Assignments | `/assignments` | Done | Done | 4 | Done |
| Learning content | `/learning-content` | Done | Done | 4 | Done |
| KICD video library | `/learning-videos` | Done | Done | 4 | Done |
| Weekly teaching log | `/teaching-log` | Done | Done | 4 | Done |
| Schemes of work | `/schemes` | Done | Done | 4 | Done |
| Library and textbooks | `/library` | Done | Done | 4 | Done |
| Welfare | `/welfare` | Done | Done | 4 | Done |
| Timetable | `/timetable` | Done | Done | 4 | Done |
| Personal account | `/profile` | Done | Done | 4 | Done |
| Privacy notice | `/privacy` | Done | Done | 4 | Done |
| Change password | `/change-password` | Done | Done | 4 | Done |

## Secretary

| Page | Route | 360px | 390px | Appearances | Status |
|---|---|---|---|---|---|
| Dashboard and intake queue | `/dashboard` | Done | Done | 4 | Done |
| Admission drafts | `/admissions` | Done | Done | 4 | Done |
| New admission wizard | `/admissions/new` | Done | Done | 4 | Done |
| Admission packet | `/admissions/[id]` | Done | Done | 4 | In progress |
| Learner register | `/learners` | Done | Done | 4 | Done |
| Learner profile (identity and balance) | `/learners/[id]` | Done | Done | 4 | In progress |
| Fee collections (read-only) | `/finance` | Done | Done | 4 | Done |
| Fee structures (read-only) | `/finance/structures` | Done | Done | 4 | Done |
| Welfare | `/welfare` | Done | Done | 4 | Done |
| Personal account | `/profile` | Done | Done | 4 | Done |
| Privacy notice | `/privacy` | Done | Done | 4 | Done |
| Change password | `/change-password` | Done | Done | 4 | Done |

## Accountant

| Page | Route | 360px | 390px | Appearances | Status |
|---|---|---|---|---|---|
| Finance dashboard | `/dashboard` | Done | Done | 4 | Done |
| Learner register | `/learners` | Done | Done | 4 | Done |
| Learner identity and balance | `/learners/[id]` | Done | Done | 4 | In progress |
| Invoices and payments | `/finance` | Done | Done | 4 | Done |
| Fee structures | `/finance/structures` | Done | Done | 4 | Done |
| Official receipt | `/receipts/[id]` | Done | Done | 4 | In progress |
| Welfare | `/welfare` | Done | Done | 4 | Done |
| Personal account | `/profile` | Done | Done | 4 | Done |
| Privacy notice | `/privacy` | Done | Done | 4 | Done |
| Change password | `/change-password` | Done | Done | 4 | Done |

## Deputy

| Page | Route | 360px | 390px | Appearances | Status |
|---|---|---|---|---|---|
| Operations dashboard | `/dashboard` | Done | Done | 4 | Done |
| Admissions | `/admissions` | Done | Done | 4 | Done |
| Learner register | `/learners` | Done | Done | 4 | Done |
| Learner profile | `/learners/[id]` | Done | Done | 4 | In progress |
| Assessments review | `/assessments` | Done | Done | 4 | Done |
| Exam sessions | `/assessments/exams` | Done | Done | 4 | Done |
| CBC rubrics | `/assessments/rubrics` | Done | Done | 4 | Done |
| Attendance overview | `/attendance` | Done | Done | 4 | Done |
| Timetable | `/timetable` | Done | Done | 4 | Done |
| KICD video library | `/learning-videos` | Done | Done | 4 | Done |
| Schemes of work | `/schemes` | Done | Done | 4 | Done |
| Library | `/library` | Done | Done | 4 | Done |
| Welfare | `/welfare` | Done | Done | 4 | Done |
| Personal account | `/profile` | Done | Done | 4 | Done |
| Privacy notice | `/privacy` | Done | Done | 4 | Done |
| Change password | `/change-password` | Done | Done | 4 | Done |

## Head Teacher

| Page | Route | 360px | 390px | Appearances | Status |
|---|---|---|---|---|---|
| Academic dashboard | `/dashboard` | Done | Done | 4 | Done |
| Admissions | `/admissions` | Done | Done | 4 | Done |
| Submitted admission packet | `/admissions/[id]` | n/a | n/a | n/a | Not reachable in seed data (no submitted packet); same component audited as Director |
| Learner register | `/learners` | Done | Done | 4 | Done |
| Learner profile | `/learners/[id]` | Done | Done | 4 | In progress |
| Edit learner | `/learners/[id]/edit` | Done | Done | 4 | In progress |
| Staff directory | `/staff` | Done | Done | 4 | Done |
| Staff profile | `/staff/[id]` | Done | Done | 4 | In progress |
| Add staff wizard | `/staff/new` | Done | Done | 4 | Done |
| Assessments approval | `/assessments` | Done | Done | 4 | Done |
| Exam sessions | `/assessments/exams` | Done | Done | 4 | Done |
| CBC rubrics | `/assessments/rubrics` | Done | Done | 4 | Done |
| Attendance | `/attendance` | Done | Done | 4 | Done |
| Finance | `/finance` | Done | Done | 4 | Done |
| Fee structures | `/finance/structures` | Done | Done | 4 | Done |
| Official receipt | `/receipts/[id]` | Done | Done | 4 | In progress |
| Reports | `/reports` | Done | Done | 4 | Done |
| Audit log | `/audit` | Done | Done | 4 | Done |
| Timetable | `/timetable` | Done | Done | 4 | Done |
| KICD video library | `/learning-videos` | Done | Done | 4 | Done |
| Complaints | `/complaints` | Done | Done | 4 | Done |
| Schemes of work | `/schemes` | Done | Done | 4 | Done |
| Weekly teaching log | `/teaching-log` | Done | Done | 4 | Done |
| Library | `/library` | Done | Done | 4 | Done |
| Welfare | `/welfare` | Done | Done | 4 | Done |
| Personal account | `/profile` | Done | Done | 4 | Done |
| Privacy notice | `/privacy` | Done | Done | 4 | Done |
| Change password | `/change-password` | Done | Done | 4 | Done |

## Director

| Page | Route | 360px | 390px | Appearances | Status |
|---|---|---|---|---|---|
| Executive dashboard | `/dashboard` | Done | Done | 4 | Done |
| Accounts and roles | `/accounts` | Done | Done | 4 | Done |
| Admissions | `/admissions` | Done | Done | 4 | Done |
| New admission wizard | `/admissions/new` | Done | Done | 4 | Done |
| Admission packet | `/admissions/[id]` | Done | Done | 4 | In progress |
| Learner register | `/learners` | Done | Done | 4 | Done |
| Learner profile | `/learners/[id]` | Done | Done | 4 | In progress |
| Edit learner | `/learners/[id]/edit` | Done | Done | 4 | In progress |
| Staff directory | `/staff` | Done | Done | 4 | Done |
| Staff profile | `/staff/[id]` | Done | Done | 4 | In progress |
| Add staff wizard | `/staff/new` | Done | Done | 4 | Done |
| Assessments | `/assessments` | Done | Done | 4 | Done |
| Exam sessions | `/assessments/exams` | Done | Done | 4 | Done |
| CBC rubrics | `/assessments/rubrics` | Done | Done | 4 | Done |
| Attendance | `/attendance` | Done | Done | 4 | Done |
| Finance | `/finance` | Done | Done | 4 | Done |
| Fee structures | `/finance/structures` | Done | Done | 4 | Done |
| Official receipt | `/receipts/[id]` | Done | Done | 4 | In progress |
| Reports | `/reports` | Done | Done | 4 | Done |
| Audit log | `/audit` | Done | Done | 4 | Done |
| Timetable | `/timetable` | Done | Done | 4 | Done |
| KICD video library | `/learning-videos` | Done | Done | 4 | Done |
| Complaints | `/complaints` | Done | Done | 4 | Done |
| Schemes of work | `/schemes` | Done | Done | 4 | Done |
| Weekly teaching log | `/teaching-log` | Done | Done | 4 | Done |
| Library | `/library` | Done | Done | 4 | Done |
| Welfare | `/welfare` | Done | Done | 4 | Done |
| Personal account | `/profile` | Done | Done | 4 | Done |
| Privacy notice | `/privacy` | Done | Done | 4 | Done |
| Change password | `/change-password` | Done | Done | 4 | Done |

## Welfare Chair

| Page | Route | 360px | 390px | Appearances | Status |
|---|---|---|---|---|---|
| Staff dashboard | `/dashboard` | Done | Done | 4 | Done |
| Welfare overview | `/welfare` | Done | Done | 4 | Done |
| Personal account | `/profile` | Done | Done | 4 | Done |
| Privacy notice | `/privacy` | Done | Done | 4 | Done |
| Change password | `/change-password` | Done | Done | 4 | Done |

## Non-Teaching Staff

| Page | Route | 360px | 390px | Appearances | Status |
|---|---|---|---|---|---|
| Staff dashboard | `/dashboard` | Done | Done | 4 | Done |
| Welfare overview | `/welfare` | Done | Done | 4 | Done |
| Personal account | `/profile` | Done | Done | 4 | Done |
| Privacy notice | `/privacy` | Done | Done | 4 | Done |
| Change password | `/change-password` | Done | Done | 4 | Done |

---

## Notes

- The brief names eight roles; the live system also has **Welfare Chair** and **Non-Teaching Staff**, audited above.
- Restricted routes are still visited by every role; the audit requires an unauthorized role to be redirected rather than shown the screen, so the permission matrix is exercised for the full 34-route union, not just the role's own pages.
- `/dev/styleguide` is development-only (`NODE_ENV !== "production"`), so it is excluded from production screenshots and from the mobile matrix.
- Detail routes are audited with ids discovered from the isolated E2E database (`e2e/.auth/sample-records.json`), never from production data.
