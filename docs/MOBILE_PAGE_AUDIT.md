# Mobile Page Audit — Every Page, Every Role

Automated evidence: `e2e/mobile-audit.spec.ts` visits the 42-path index/detail union for all ten roles at **360px** and **390px** in four appearances (light/dark × bento/glass). It fails on horizontal overflow, sub-scale text, missing landmarks, unnamed controls, undersized targets, contrast failures, runtime errors, unavailable authorized records and unexpected access. The rebuilt serial run on 2026-10-28 completed **20/20 collections with 0 findings** (`docs/MOBILE_FAILURES.md`), and all ten `mobile-shots/contact-<role>.png` sheets were visually re-inspected at 360px against the same isolated build, so every row below is marked Done.

Screenshots: `mobile-shots/` (360px, ignored by git) with `mobile-shots/contact-<role>.png` contact sheets.

Rules applied: 12px captions/badges, 13px labels/nav, 14px body, 16px titles, 20px page titles, 24px KPI; 44px targets; no horizontal scroll; one `<main>` and one `<h1>`; AA contrast in both themes; tables become card lists below `lg`. The only 44px exception is an inline prose link, recorded in `docs/DECISIONS.md`.

Legend: **Pending** = included in the current matrix, but latest automated/visual acceptance is not complete. **Done** requires zero findings in the matching rebuilt collection and a fresh visual check at 360px.

---

## Shared (public and account)

| Page | Route | 360px | 390px | Appearances | Status |
|---|---|---|---|---|---|
| Sign in | `/` | Done | Done | 4 | Done |
| Change password | `/change-password` | Done | Done | 4 | Done |
| Privacy notice | `/privacy` | Done | Done | 4 | Done |
| Printable receipt | `/receipts/[id]` | Done | Done | 4 | Done |
| Dev styleguide | `/dev/styleguide` | n/a | n/a | n/a | Dev-only, excluded from production audit |

## Parent

| Page | Route | 360px | 390px | Appearances | Status |
|---|---|---|---|---|---|
| Children overview, results, fee guide | `/portal` | Done | Done | 4 | Done |
| Complaints thread | `/complaints` | Done | Done | 4 | Done |
| Child profile (linked scope) | `/learners/[id]` | Done | Done | 4 | Done |
| Fee receipt | `/receipts/[id]` | Done | Done | 4 | Done |
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
| Own learner profile | `/learners/[id]` | Done | Done | 4 | Done |
| Personal account | `/profile` | Done | Done | 4 | Done |
| Privacy notice | `/privacy` | Done | Done | 4 | Done |
| Change password | `/change-password` | Done | Done | 4 | Done |

## Teacher

| Page | Route | 360px | 390px | Appearances | Status |
|---|---|---|---|---|---|
| Dashboard | `/dashboard` | Done | Done | 4 | Done |
| Class attendance | `/attendance` | Done | Done | 4 | Done |
| Learner register | `/learners` | Done | Done | 4 | Done |
| Assigned learner profile | `/learners/[id]` | Done | Done | 4 | Done |
| My staff profile (self only) | `/staff/[id]` | Done | Done | 4 | Done |
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
| Draft and submitted admission packets | `/admissions/[id]` | Done | Done | 4 | Done |
| Learner register | `/learners` | Done | Done | 4 | Done |
| Learner profile and permitted balance | `/learners/[id]` | Done | Done | 4 | Done |
| Edit learner | `/learners/[id]/edit` | Done | Done | 4 | Done |
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
| Learner identity and balance | `/learners/[id]` | Done | Done | 4 | Done |
| Invoices and payments | `/finance` | Done | Done | 4 | Done |
| Fee structures | `/finance/structures` | Done | Done | 4 | Done |
| Official receipt | `/receipts/[id]` | Done | Done | 4 | Done |
| Welfare | `/welfare` | Done | Done | 4 | Done |
| Personal account | `/profile` | Done | Done | 4 | Done |
| Privacy notice | `/privacy` | Done | Done | 4 | Done |
| Change password | `/change-password` | Done | Done | 4 | Done |

## Deputy

| Page | Route | 360px | 390px | Appearances | Status |
|---|---|---|---|---|---|
| Operations dashboard | `/dashboard` | Done | Done | 4 | Done |
| Admissions | `/admissions` | Done | Done | 4 | Done |
| Draft and submitted admission packets | `/admissions/[id]` | Done | Done | 4 | Done |
| Learner register | `/learners` | Done | Done | 4 | Done |
| Learner profile | `/learners/[id]` | Done | Done | 4 | Done |
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
| Submitted admission packet (draft denied) | `/admissions/[id]` | Done | Done | 4 | Done |
| Learner register | `/learners` | Done | Done | 4 | Done |
| Learner profile | `/learners/[id]` | Done | Done | 4 | Done |
| Edit learner | `/learners/[id]/edit` | Done | Done | 4 | Done |
| Staff directory | `/staff` | Done | Done | 4 | Done |
| Staff profile | `/staff/[id]` | Done | Done | 4 | Done |
| Add staff wizard | `/staff/new` | Done | Done | 4 | Done |
| Assessments approval | `/assessments` | Done | Done | 4 | Done |
| Exam sessions | `/assessments/exams` | Done | Done | 4 | Done |
| CBC rubrics | `/assessments/rubrics` | Done | Done | 4 | Done |
| Attendance | `/attendance` | Done | Done | 4 | Done |
| Finance | `/finance` | Done | Done | 4 | Done |
| Fee structures | `/finance/structures` | Done | Done | 4 | Done |
| Official receipt | `/receipts/[id]` | Done | Done | 4 | Done |
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
| Reports | `/reports` | Done | Done | 4 | Done |
| Admissions | `/admissions` | Done | Done | 4 | Done |
| New admission wizard | `/admissions/new` | Done | Done | 4 | Done |
| Draft and submitted admission packets | `/admissions/[id]` | Done | Done | 4 | Done |
| Learner register | `/learners` | Done | Done | 4 | Done |
| Learner profile | `/learners/[id]` | Done | Done | 4 | Done |
| Staff directory | `/staff` | Done | Done | 4 | Done |
| Staff profile | `/staff/[id]` | Done | Done | 4 | Done |
| Add staff wizard | `/staff/new` | Done | Done | 4 | Done |
| Assessments | `/assessments` | Done | Done | 4 | Done |
| Exam sessions | `/assessments/exams` | Done | Done | 4 | Done |
| CBC rubrics | `/assessments/rubrics` | Done | Done | 4 | Done |
| Attendance | `/attendance` | Done | Done | 4 | Done |
| Finance | `/finance` | Done | Done | 4 | Done |
| Fee structures | `/finance/structures` | Done | Done | 4 | Done |
| Official receipt | `/receipts/[id]` | Done | Done | 4 | Done |
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
- Restricted routes are still visited by every role across the 42-path union. Unauthorized access must redirect, deny, or render a record-unavailable page without exposing the record. A streamed Next.js not-found document can return HTTP 200, so the unavailable-page heading is checked as well as the URL/status.
- All eight staff roles have their own seeded `/staff/[id]` target. Director and Head Teacher also visit each seeded staff variant; Parent/Learner are not assigned staff-self targets. These variants are included in the 20/20 zero-finding collections and appear in the Director and Head Teacher contact sheets.
- Director learner-edit access is deliberately excluded from the authorized set and tested as denied. Secretary and Head Teacher edit targets remain included; no permissions were widened to satisfy the audit.
- Director/Deputy/Secretary visit both synthetic DRAFT and SUBMITTED admission fixtures. Head Teacher visits the submitted packet and is tested as denied for the draft.
- `/dev/styleguide` is development-only (`NODE_ENV !== "production"`), so it is excluded from production screenshots and from the mobile matrix.
- Detail routes are audited with ids discovered from the isolated E2E database (`e2e/.auth/sample-records.json`), never from production data.
