# Round 2 UI inventory and upgrade checklist

This table retains the historic Round 2 visual inventory; it is **not a feature-completion or release certificate**. Every existing row has been reconciled against current source. A styled page, button, badge, or API does not establish an end-to-end workflow, correct authorization, accessibility, or production readiness. “Implemented in source” below means code exists, not that current acceptance QA passed.

## Current acceptance boundary

- `PageNavigation` is restored inside `PageShell`. Learner names, admission numbers, chips and register profile actions deliberately use native anchors after disabling Next.js prefetch failed to fix the click stall. Fourteen production-mode browser cases now cover Director/Head Teacher/Secretary register-to-profile navigation at 390/1280px plus Parent/Learner role-home return, Secretary single-prompt dirty-form navigation and Accountant identity-only privacy; all pass. Staff and shared workspace navigation retain Next.js links; no staff-link repair is claimed.
- Strict lint (zero warnings), type-check, 66 unit tests and SQLite/PostgreSQL schema parity passed on the same source as the browser suite.
- Full E2E is green: one serial isolated run passed 44/44 on 2026-10-28 and the mobile audit collected 0 findings across 20/20 role and viewport collections (42 route paths, four appearances). Shared JavaScript was remeasured at 441.6 KiB against the unchanged 350 KiB limit on a matching 2026-10-28 production build; 339.1 KiB of that is `react-dom` plus the Next.js App Router/RSC client runtime, so the limit is below the framework floor and needs an owner decision. Route-specific JavaScript is 189.7 KiB against 250 KiB. No row below overrides these gates.
- Production security/privacy, PostgreSQL migration validation, encrypted backup/restore, and explicit owner release approval remain open. This work does not deploy or clean production data.

## Shared and signed-out pages

| Page/component | Current capability and gaps | Remaining improvements / verification | Status |
|---|---|---|---|
| `/` — sign in | Branded split layout, password visibility, busy/error states and credential login exist; no public registration | Recheck small screens, focus order, error recovery, rate-limit guidance and reduced motion | Implemented in source; current visual/accessibility QA pending |
| `/change-password` | Confirmation field, visibility control, live password guidance and redirect exist; session feedback needs verification | Align guidance with enforced server rules; test first-login, error and navigation/session outcomes | Partial; acceptance pending |
| `/privacy` | Readable static notice exists; no complete data-request workflow | Owner-approved notice and export/correction/deletion/retention process; do not certify legal compliance from copy | Partial; privacy gate open |
| `/receipts/[id]` | Scoped receipt page, child context, print and direct `/api/finance/payments/[id]/pdf` link exist; displayed QR-style graphic is not working verification | Build standards-compliant QR encoding and a privacy-safe verification/token endpoint; test PDF access, cache headers, layout and print | PDF implemented in source; QR verification not built; QA pending |
| `/staff` — staff directory | Director/Head Teacher directory with search/filter controls and profile links exists | Audit mobile cards, private exports/documents, self-only staff access and account-provisioning policy | Implemented in source; permission/visual QA pending |
| `/admissions/new` — new admission entry | Permission-gated wizard exists; transient path is excluded from shared history; shared admission Back currently targets `/learners` | Verify direct-entry, wizard Back versus shared Back, unsaved state and loop-free register/list return | Partial; latest navigation QA pending |
| `loading.tsx`, `error.tsx`, `not-found.tsx` — shared route states | Portal loading skeleton, root recovery/404 and staff-specific boundaries exist; these are boundary files, not literal `/loading`, `/error`, `/not-found` routes | Exercise failures, safe role-home recovery, focus/announcements and reduced motion; remove unsupported safety assurances | Implemented in source; recovery QA pending |
| `PageShell` (replaces historic `PortalFrame`) | Shared app shell, role navigation, skip link, theme controls, notifications, search and restored `PageNavigation` exist | Rebuild role sweep; verify desktop/mobile navigation, focus, dark states and list/query preservation | Implemented in source; latest shell QA pending |
| `PageNavigation` | Shared breadcrumbs, route stack, scroll handling and unsaved-form guard exist; history tracks pathname rather than full query state | Verify external/deep entry, browser back/forward, admission fallback, mobile event integration and filter preservation | Partial; latest navigation QA pending |
| `ThemeToggle` / `ThemeProvider` | Persisted light/dark/system and Bento/Glass controls exist | Audit contrast, preference changes, hydration, focus and reduced motion on every view | Implemented in source; full theme QA pending |
| `IdleSessionGuard` | Ten-minute client idle timer calls logout and activity-triggered session refresh | Test multiple tabs, network failure, expired sessions and browser history; implement durable server revocation/device controls | Partial; server-session hardening open |

## Director

| Page/component | Current capability and gaps | Remaining improvements / verification | Status |
|---|---|---|---|
| `/dashboard` — Director | KPIs, fee/payroll aggregates and data-driven ordered setup checklist exist | Verify empty-system checklist counts and setup destinations; deepen needs-attention/trends without unsupported claims | Partial; dashboard QA pending |
| `/accounts` / `AccountDirectory` | Create/reset/suspend actions plus search/role/status filters exist; full account history, bulk account import and multi-role grants are absent | Accessible safe dialogs, durable history and approved import/grant workflows; preserve Director-only account management | Partial; planned account flows remain open |
| `/accounts` / `GuardianLinks` | Searchable account-to-learner linking/removal and `LearnerLink` exist | Duplicate-aware phone/ID matching, family profile maintenance, visible link history and sibling-link E2E | Partial; family workflow QA pending |
| `/learners` / `LearnerDirectory` | Search/grade/status filters, profile links and permitted admission/login actions exist | Verify role scope, empty states, keyboard/mobile use and URL-backed pagination/filter state | Implemented in source; directory QA pending |
| `/learners/[id]` — learner profile | Section anchors, biography, photo, contacts, attendance/results/fees, documents, discipline and edit/audit views exist; anchors are not independently loaded tabs | Verify the repaired access-before-fetch and Accountant family-data boundary; complete nested IDOR coverage and replace unsupported timeline/talent claims | Partial; privacy/IDOR release gate open |
| `/staff` and `/staff/[id]` — staff directory/profile | Employment/TSC/qualification data, assignments, teaching notes, attendance, private files and history/edit UI exist; staff profile payroll is not Director-only in current source | Reconcile payroll/statutory access and Head Teacher account creation with approved policy; verify staff self-scope, imports and edit-history privacy | Partial; policy and E2E gate open |
| `/admissions` and `/admissions/[id]` | Seven-step draft/resume, consent, private files, explicit access setup and branded PDF exist | Photo crop, sibling/pre-existing-parent matching, fee handoff pricing, document privacy and page/API ownership parity | Partial; admission E2E/security pending |
| `/assessments` / `AssessmentWorkspace` | Mark entry/edit/review/release, term selection and active-exam picker exist; full rubric integration/grid/report card absent | Enforce active assigned exam context on server; integrate versioned grading, rubric help, keyboard/bulk editing and verified report cards | Partial; academic workflow not complete |
| `/attendance` / `AttendanceClient` | Daily school/class completion overview, learner register and leadership staff attendance capture exist | Date-range/stream/gender trends, absentee follow-up/notifications, reminders and exports; verify lock/edit behavior | Partial; follow-up and broader analytics open |
| `/finance` / `FinanceClient` + `PayrollSheet` | Invoice stepper, search, payment drawer, confirmation/void actions, waiver UI, totals/arrears aging and payroll controls exist | Bind invoice UI to approved structure IDs/version instead of manual items/hard-coded fallback; verify waiver accounting, statements, expenses, analytics and exports | Partial; finance integrity/E2E open |
| `/finance/structures` — Head Teacher/Director | Versioned class/term structures, effective-date and compulsory/optional line editor exist | Verify effective-date selection, immutable snapshots, optional preview, audit feedback and mobile/dark editing | Implemented in source; finance/visual QA pending |
| `/reports` | Director-only learner/assessment/finance CSV links and school/grade-band/welfare charts exist; not a complete filterable reporting system | Verify totals beyond capped datasets, configurable rubric consistency, CSV safety, filters, accessible charts and print/export output | Partial; report verification open |
| `/audit` | Action/entity URL filters, quick chips and latest 200 events exist | Time/user filters, pagination, export history and backend append-only verification; do not infer immutability from table styling | Partial; audit hardening/QA open |
| `/complaints` / `ComplaintsClient` | Parent-origin threads, leadership replies/status, search/category/status filters exist | Attachment workflow, actual both-recipient fan-out, delivery/unread state, assignment and moderation; remove notification claims not backed by delivery | Partial; complaint extensions not built |

## Head Teacher

| Page/component | Current capability and gaps | Remaining improvements / verification | Status |
|---|---|---|---|
| `/dashboard` — Head Teacher | Academic/pending-review/attendance/finance indicators and task links exist | Class/subject comparisons and at-risk panels; audit shortcuts (Director-only reports must not be advertised as accessible) | Partial; dashboard scope/QA pending |
| `/learners` — class register | Searchable school register and profile navigation exist | Class/stream setup, URL-backed filters/pagination and permitted detail review | Partial; setup and directory QA open |
| `/learners/[id]` and `/staff/[id]` | Role-aware learner/staff detail and history/edit views exist | Per-section scope/privacy checks; reconcile staff account-management and payroll policy rather than certifying RBAC from presentation | Partial; policy/IDOR gate open |
| `/assessments` | Review/release chain plus separate exam/rubric pages exist | Approval queue, grading-version integration and released report-card workflow; prove server enforcement | Partial; academics acceptance open |
| `/attendance` | Daily all-class overview and staff attendance capture exist | Range trends, missing-register reminders, absentee follow-up and notification workflow | Partial; attendance extensions open |
| `/finance` | Read/payment-confirmation/payroll workflow, fee structures and waiver visibility exist | Verify permitted decisions/history, Director-only waiver approval, immutable invoicing and secretary read-only behavior | Partial; finance QA open |
| `/audit` | Shared action/entity filters exist | Leadership time/user/entity context, pagination and export review | Partial; audit extensions open |
| `/teaching-log` | Submission list, search/status filters and confirmation exist | Review feedback, durable drafts, accurate EAT deadline behavior and notifications | Partial; workflow QA pending |
| `/complaints` | Parent inbox/reply/status with search/filter/count UI exists | Assignment, unread state, attachment handling and real delivery/fan-out | Partial; complaint extensions open |

## Deputy Head Teacher

| Page/component | Current capability and gaps | Remaining improvements / verification | Status |
|---|---|---|---|
| `/dashboard` — Deputy | Attendance/operations summaries and timetable/library/exam task links exist | Useful drill-down, follow-up tasks and correct permitted destinations | Partial; role dashboard QA pending |
| `/learners` | School register with profile links and role-aware sections exists | Useful restricted summaries and exhaustive detail/health/document scope checks | Partial; profile privacy QA pending |
| `/attendance` | Daily schoolwide overview and staff attendance capture exist | Heatmap/range trends, absentee follow-up and notifications | Partial; attendance extensions open |
| `/assessments` | Marks read view plus `/assessments/exams` and `/assessments/rubrics` management pages exist | Secure assigned/role reads, exam timetable editing, grading integration and reopen/version tests | Partial; exam/rubric controls not fully validated |
| Deputy operations pages | Timetable, textbook library and schemes pages/APIs exist; discipline API/profile section exists, but no standalone duty/events/discipline pages | Build missing modules; validate timetable clashes, library transactions, scoped reads and append-only decisions | Partial; exams/rubrics and operations foundations only |

## Secretary

| Page/component | Current capability and gaps | Remaining improvements / verification | Status |
|---|---|---|---|
| `/dashboard` — Secretary | Admission counters/task links exist; source still includes a complaints count/shortcut despite forbidden complaint access | Remove forbidden complaint metadata/shortcut; verify admission queue, setup guidance and permitted fee-only indicators | Partial; least-privilege gate open |
| `/admissions` / admission | Guided draft/resume, private upload/preview, consent, access setup and branded form exist | Verify fee pricing handoff, pre-existing/sibling parent matching, ownership parity, print and photo crop | Partial; admission acceptance open |
| `/finance` — read-only | Invoice API suppresses payment identifiers and structures have a read-only view; page still passes a Secretary payment affordance | Remove write affordance and test server denial plus permitted structure/paid/balance fields; no receipt access | Partial; read-only UI/permission QA open |
| `/profile` | Shared own-photo/password form and feedback exist | Mobile validation, focus and session outcome checks; approved contact-edit policy | Implemented in source; profile QA pending |

## Accountant

| Page/component | Current capability and gaps | Remaining improvements / verification | Status |
|---|---|---|---|
| `/dashboard` — Accountant | Invoice/paid/outstanding metrics and finance task links exist | Payment-method/collection trends and arrears drill-down; prove no academic/private-message reads | Partial; finance/dashboard QA pending |
| `/learners` and `/learners/[id]` | Identity-scoped directory and fees exist; detail now checks access before section reads and withholds Accountant biography/guardian queries and output | Verify the new identity/finance-only browser regressions and all nested endpoints; no broad RBAC certificate from one page repair | Profile privacy repaired in source; matching QA and wider privacy gate open |
| `/finance` / `FinanceClient` | Learner search, invoice stepper, payment drawer, aging and waiver flows exist; stepper posts manual items, not approved structure-line IDs | Eliminate hard-coded fallback fees, persist approved version/snapshot, test Secretary denial, discounts/credits, confirmation/void and fresh-system pricing | Partial; structure-driven invoicing not complete |
| `/receipts/[id]` | Authorized print and direct PDF output exist; QR-style stamp has no working verification | Implement privacy-safe signed verification and standards-compliant QR; verify PDF/receipt IDOR, cache and print output | PDF implemented in source; QR verification not built; QA pending |

## Teacher

| Page/component | Current capability and gaps | Remaining improvements / verification | Status |
|---|---|---|---|
| `/dashboard` — Teacher | Assigned learner/marks/attendance summaries and task links exist | Timetable/work-due overview, teaching-log CTA and server-aligned attendance visibility | Partial; teacher UX/role QA pending |
| `/learners` | Assigned directory and learner profile links exist | Verify assigned grade/subject scope, permitted contacts and attendance/result sections | Implemented in source; assignment IDOR QA pending |
| `/learners/[id]` and `/staff/[id]` | Assigned learner detail and own staff profile exist | Subject-only marks, audited permitted health, self-only staff history/documents and all nested IDOR checks | Partial; profile privacy acceptance open |
| `/attendance` | Class-teacher register controls exist with daily statuses | One-tap keyboard/mobile behavior, missing status, save/verify/lock feedback and subject-teacher denial | Implemented in source; register QA pending |
| `/assessments` / `AssessmentWorkspace` | Active-exam picker, mark entry/edit and review feedback exist; term-based list is not a complete exam-scoped grid | Mandatory active assigned exam enforcement, rubric/version help, bulk/keyboard entry and autosave | Partial; academic integrity/UX open |
| `/assignments` / `AssignmentClient` | Author/create, attachments, submit/mark, feedback and optional local-model draft exist | Authored question formats, due/saved/error clarity, upload privacy and accessible feedback; exact-answer marking is not AI grading | Partial; assignment E2E/usability pending |
| `/learning-content` / `LearningContentClient` | Assigned-class HTTPS resources and search/type filters exist; official video curation is separate at `/learning-videos` | Verify resource safety and assignment scope; test official-channel library/network fixtures and watch metrics separately | Partial; do not equate general resources with KICD verification |
| `/teaching-log` / `TeachingLogClient` | Summary/reflection, search/status, confirmation and local draft assistance exist | Durable saved drafts, accurate EAT deadline, mobile review feedback and actual notifications | Partial; log workflow QA pending |
| `/profile` | Own-photo/password settings exist; staff workload/employment detail is at own `/staff/[id]` | Clear self-profile navigation, approved contact edits and validation/session QA | Partial; profile acceptance pending |

## Parent

| Page/component | Current capability and gaps | Remaining improvements / verification | Status |
|---|---|---|---|
| `/portal` — children dashboard | Linked child switcher, released results, attendance, invoices/receipts and payment guidance exist on one shared page | Separate overview/results/fees/attendance routes, progress/transaction visuals and linked-child IDOR/accessibility checks | Partial; separate family pages not built |
| `/complaints` | Own linked-child threads, replies/status and filter UI exist | Attachment/privacy, genuine both-recipient delivery, unread state and reply notification verification | Partial; notification/attachment extensions open |
| `/receipts/[id]` | Linked receipt access, child context, print and direct PDF link exist | Linked PDF IDOR/cache checks, print QA and privacy-safe verification | PDF implemented in source; QR verification not built; QA pending |
| `/profile` | Own photo/password form exists; no phone/email editing workflow in current component/API | Implement approved own phone/email maintenance; reconcile parent photo/password rule and validate session outcomes | Partial; contact editing not built |

## Learner

| Page/component | Current capability and gaps | Remaining improvements / verification | Status |
|---|---|---|---|
| `/learning` / `LearningClient` | Released results, assignment feedback, grade-level games and embedded official-channel `VideoLibrary` exist | Network/URL/grade-IDOR fixtures, accessible playback, self-check questions and stronger mastery weighting; full course authoring absent | Partial; learning-library acceptance open |
| `/assignments` / `AssignmentClient` | Scoped answer/photo submission and marked feedback exist | Due-date clarity, accessible entry/retry and feedback; private upload and self-only submission tests | Implemented in source; learner usability/IDOR QA pending |
| `/portal` | Shared self-summary exists; fee invoices are fetched only for Parents | Verify self-relation, released-only records, no Parent finance controls and safe unlinked/archived states | Implemented in source; self-scope QA pending |
| Learner games | Number Quest/Science Explorer generate grade-dependent questions, explanations and recorded scores | Validate curriculum depth, scoring trust, feedback, keyboard/mobile use and replay; not a complete learning course | Partial; game acceptance pending |

## Shared feature components

| Component | Current capability and gaps | Remaining improvements / verification | Status |
|---|---|---|---|
| `LoginForm` | Busy/error, show/hide and alert markup exist | Rate-limit guidance, keyboard/screen-reader and network-error recovery checks | Implemented in source; auth/accessibility QA pending |
| `ChangePasswordForm` | Confirmation, live criteria, visibility and first-login redirect exist | Align criteria with server rules, robust success/session state and focus/recovery checks | Partial; password-flow QA pending |
| `ProfileSettings` | Photo upload/preview, password visibility/length guidance and status/error feedback exist | Contact editing, photo remove/crop, parent-policy review and session validation | Partial; profile extensions open |
| `AttendanceClient` | Class/date and attendance save/verify controls exist | Accessible status summary, mobile lock/edit behavior and assigned-register denial tests | Implemented in source; attendance QA pending |
| `AssessmentWorkspace` | Active-exam picker and mark/review/version feedback exist | Server-enforced exam context, configurable rubric/version integration, visible history, grid and autosave | Partial; academic workflow open |
| `FinanceClient` | Invoice stepper/search, payment drawer, totals/status, aging and waiver controls exist | Approved structure snapshot wiring, read-only affordances, full list pagination/status filtering and finance integrity tests | Partial; finance workflow open |
| `PayrollSheet` | Search, record/pay/approval controls exist | Verify scope, filter/export and visible approval history; reconcile staff-profile payroll exposure | Partial; payroll policy/QA open |
| `ComplaintsClient` | Thread/filter/reply/status UI exists; Secretary compose branch is unreachable under current permissions | Keep Parent → Head Teacher/Director only; remove stale Secretary/delivery claims; build attachments/unread/fan-out | Partial; complaint extensions open |
| `AssignmentClient` (current export: `AssignmentsClient`) | Author/submit/mark, attachments and feedback exist | Improved authored question formats, due/saved/error states and exact-answer/privacy testing | Partial; assignment acceptance pending |
| `LearningContentClient` | HTTPS resource form/search exists; curated official videos use separate `VideoLibrary` | Safe resource review and scoped API checks; verify KICD channel and watch workflow in the separate library | Partial; content/library QA open |
| `TeachingLogClient` | Daily report/review, search/status and local assistance exist | Saved draft, review feedback, EAT deadlines and notification verification | Partial; log acceptance pending |
| Print styles | Receipt print/PDF, branded admission PDF and some register/timetable print controls exist; no complete statements/report-card print system | Test pagination, long text, totals, privacy, branding/footers and PDF output across roles; QR verification remains absent | Partial; comprehensive print QA/features open |

## Source reference map and additional route coverage

References are repository-relative. Repeated role rows above refer to the same implementation; a role-specific heading does not imply a separate page or independent acceptance result.

- Shared/auth: `src/app/page.tsx`, `src/app/login-form.tsx`, `src/app/change-password/{page,change-password-form}.tsx`, `src/app/privacy/page.tsx`, `src/app/{error,not-found}.tsx`, `src/app/(portal)/loading.tsx`, `src/app/(portal)/layout.tsx`, `src/components/ui/{page-shell,portal-header,portal-nav}.tsx`, `src/components/{page-navigation,theme-toggle,idle-session-guard}.tsx`, `src/components/design-system/{theme-provider,command-palette}.tsx`.
- Director/accounts/register: `src/app/(portal)/dashboard/page.tsx`, `src/components/director-checklist.tsx`, `src/app/(portal)/accounts/{page,account-directory,guardian-links}.tsx`, `src/app/(portal)/learners/{page,directory}.tsx`, `src/components/{learner-link,staff-link}.tsx`.
- Profiles/admissions: `src/app/(portal)/learners/[id]/page.tsx`, `src/app/(portal)/learners/[id]/edit/{page,learner-edit-form}.tsx`, `src/app/(portal)/staff/{page,staff-directory-client}.tsx`, `src/app/(portal)/staff/[id]/{page,staff-profile-client}.tsx`, `src/app/(portal)/staff/new/page.tsx`, `src/app/(portal)/admissions/{page,admission-wizard,admissions-client}.tsx`, `src/app/(portal)/admissions/{new,[id]}/page.tsx`; corresponding learner, staff, admission document/form APIs and `src/lib/permissions.ts` remain part of privacy acceptance.
- Academics/attendance: `src/app/(portal)/assessments/{page,workspace}.tsx`, `src/app/(portal)/assessments/exams/{page,exam-sessions-client}.tsx`, `src/app/(portal)/assessments/rubrics/{page,rubrics-client}.tsx`, `src/app/api/exams/{route,[id]/route}.ts`, `src/app/api/rubrics/route.ts`, `src/lib/grading.ts`, `src/app/(portal)/attendance/{page,attendance-client,staff-attendance-client}.tsx`. Exam/rubric pages exist, but their GET authorization, mandatory active-exam enforcement, published reopen rules and grading integration remain release blockers.
- Finance/receipts/reports: `src/app/(portal)/finance/{page,finance-client,payroll-sheet}.tsx`, `src/app/(portal)/finance/structures/{page,structures-client}.tsx`, `src/app/api/finance/{invoices,waivers}/route.ts`, `src/app/receipts/[id]/{page,print-button}.tsx`, `src/app/api/finance/payments/[id]/pdf/route.ts`, `src/lib/qr.ts`, `src/app/(portal)/reports/{page,reports-visualizer}.tsx`, `src/app/(portal)/audit/page.tsx`. `src/lib/qr.ts` fills a hash-derived QR-style matrix; there is no implemented `/verify/receipt` route or signed verification service.
- Communication/learning: `src/app/(portal)/complaints/{page,complaints-client}.tsx`, `src/app/api/complaints/route.ts`, `src/app/(portal)/assignments/{page,assignments-client}.tsx`, `src/app/(portal)/learning-content/{page,learning-content-client}.tsx`, `src/app/(portal)/learning/{page,learning-client}.tsx`, `src/app/(portal)/learning-videos/{page,video-library}.tsx`, `src/app/(portal)/teaching-log/{page,teaching-log-client}.tsx`, `src/app/(portal)/portal/page.tsx`, `src/app/(portal)/profile/{page,profile-settings}.tsx`, `src/app/api/profile/route.ts`.
- Routes omitted from the historic visual rows also need current all-role/mobile/accessibility/IDOR acceptance: `/staff/new`, `/learners/[id]/edit`, `/assessments/exams`, `/assessments/rubrics`, `/learning-videos`, `/library`, `/schemes`, `/timetable`, `/welfare`. Their pages and client/API foundations exist; timetable clash enforcement, complete library transaction/audit safeguards and welfare privacy are not certified. `/dev/styleguide` is a development reference, not a shipped school workflow.

See `docs/ROADMAP.md` for operational blockers and `docs/OWNER_ACTIONS.md` for future owner-controlled release gates. Historic “Bento/Glass shipped” labels have deliberately been replaced with bounded source capability and explicit remaining work.
