# Mary Royal SMS — remaining work

This roadmap separates source implementation, verified acceptance, and production release status. It does not itself authorize production changes; see the owner-directed release record below for the specific migration and deployment performed on 2026-11-01.

## Current local preparation status — 2026-10-28

- `PageNavigation` is restored inside `PageShell` (the historic `PortalFrame` reference is obsolete). Learner record links deliberately use native anchors: disabling Next.js prefetch did not fix the click stall. Director/Head Teacher/Secretary profile clicks passed six development-browser cases at 390/1280px. Staff and shared workspace navigation retain Next.js links; rebuilt all-role navigation/mobile/E2E acceptance is running and has not passed yet.
- Strict lint with zero warnings, type-check, 65 unit tests and SQLite/PostgreSQL schema parity passed before the final native-link repair; final matching checks remain pending. The current dependency audit reports zero vulnerabilities, and the limited repository/history secret scanner reports zero category matches. Neither check establishes complete permission or release acceptance. The actual Windows runtime is Node 26.12.1, outside the declared Node 20.9–22 range; compatible-runtime acceptance is required before release.
- Full E2E is green on a fresh isolated production build: one serial run passed **44/44** (2026-10-28) and the mobile audit reported **0 findings** across **20/20** role and viewport collections covering 42 route paths in four appearances. The two failures in the preceding run were a stale Accountant guardian expectation — inverted to match the tightened privacy rule — and stale app-bar section labels for Accountant, Teacher, Parent and Learner, corrected to the deliberate navigation labels.
- Shared JavaScript measured **441.6 KiB** on the 2026-10-28 production build against the unchanged **350 KiB** gate. Attribution: `react-dom` 169.0 KiB plus the Next.js App Router/RSC client runtime 170.1 KiB is 339.1 KiB before any application code, and the whole application portal shell is 52.2 KiB, so removing it entirely would still leave 389.4 KiB. The gate cannot be met by application changes; it stays an open owner decision with the threshold and raw-size accounting untouched. Route-specific JavaScript is 189.7 KiB against its 250 KiB budget (`scripts/check-perf-budget.ts`).
- The local development database now has no demo learners, invoices, payments, assessments or admission drafts. Two accounts were retained: the Director and a non-demo Parent. Both credentials and school-settings/CBC defaults were preserved. This is not a Director-only reset and says nothing about production data.
- A local backup is retained in the ignored `backups/` directory. Uploads were retained to avoid deleting files belonging to preserved accounts; orphan-file cleanup requires a separate verified retention plan. A local SQLite backup is not evidence of encrypted PostgreSQL recovery.
- Every existing row in `docs/UI_UPGRADE_CHECKLIST.md` now distinguishes current source capability, unbuilt work and pending verification. The historic visual baseline does not certify planned functionality as shipped.

## Current UI acceptance evidence — 2026-11-16

- The 2026-10-28 full mobile pass is historical and predates the recent BoardUI/theme changes. The latest generated report (`docs/MOBILE_FAILURES.md`, 2026-11-17) is incomplete at 3/20 collections and records 17 findings (16 horizontal-overflow cases and one authorized route unavailable). Earlier focused Deputy and Parent checks passed at both 360px and 390px, but they do not clear the current report. Complete all roles and widths after fixing the findings.
- The Deputy follow-up exposed low contrast in the shared dark-mode secondary-text token. It now resolves to neutral-300, and the focused Deputy rerun passed. The earlier parent payment-guide size finding and exam empty-state finding are also absent from these focused latest-source results.
- Welfare Chair and Non-teaching Staff at both widths, the remaining three 390px role collections, refreshed visual contact sheets, sign-in visual review, desktop/keyboard/screen-reader review, and browser/physical print QA remain unverified. U10 and U11 are not complete; no production-readiness claim follows from these partial checks.

## Public website refresh and performance follow-up — 2026-11-18

- The standalone public school website has a BoardUI-token-based color refresh, a higher-priority hero-image preload, and lazy-loaded below-fold images. A static-page Playwright check passed at 390px and 1440px for theme controls, mobile menu open/close, horizontal overflow, and browser errors. This is not a substitute for the incomplete authenticated-app mobile audit.
- The assessment workspace now dynamically loads its typed data-grid adapter. A PostgreSQL-schema production build completed for 82 routes. The raw performance gate still fails: 476.3 KiB shared against 350 KiB, and assessments 394.8 KiB, learning 274.3 KiB, learners 256.9 KiB and library 256.0 KiB against 250 KiB. Thresholds remain unchanged.
- Optional Redis caching is limited to the non-personal, school-wide draft-retention setting (30-second TTL and invalidation on update). No Redis service was provisioned or live-tested; this is not a broad latency claim. Production dependency audit reported zero vulnerabilities.
- Lint, type-check, 86 unit tests, schema parity, history secret scan, production build and `git diff --check` passed. Production-mode HTTP smoke on the isolated SQLite E2E build returned 200 for `/`, `/privacy`, `/api/health`; 401 for the unauthenticated learners, staff and admissions-settings APIs; and 404 for `/dev/styleguide`. The 48-test Playwright attempt was stopped after the first mobile-audit collection failed; it is not a full-suite result. Stale dark-surface and teacher-roster expectations were aligned with current styling and assigned-class access, and the isolated `e2e/director.spec.ts` run then passed 12/12. The complete Playwright/mobile sweep remains open. Node 26.12.1 remains outside the declared Node 20.9–22 range.
- No production deployment is authorized by this work. U11, mobile/privacy/IDOR, backup/restore and other documented release gates remain open.

## Owner-directed production release — 2026-11-01

- The owner explicitly directed deployment of feature commit 02712366cfc50a00e77d0ef2ec89e6ec3c4d07da to Vercel Production while assuming unresolved gates, and deferred the encrypted production backup. This is a risk acceptance for this deployment only; it does not close the technical gates below or certify the app for real learner data.
- Applied PostgreSQL migration 0005_staff_profiles to the Supabase maryroyal production project, recorded as migration version 20261101161641. Preflight showed all six target tables absent. Post-migration verification found all six present and, across 58 public tables, RLS enabled, no anon/authenticated table grants, and no public-schema usage for those roles.
- Vercel created a Production deployment from the feature branch commit using the Production environment, not the staging Preview environment. Vercel reported Ready and attached portal.maryroyalschool.co.ke. Live checks returned: sign-in page 200, /api/health 200 with status ok (database SELECT 1), and unauthenticated /api/learners and /api/staff 401.
- Current local checks: lint, type-check, 66 unit tests, schema parity, limited history secret scan, production build, and git diff --check passed. The shared JavaScript budget still fails (441.6 KiB vs 350 KiB; route-specific 189.7 KiB vs 250 KiB). The full 44-test E2E run was stopped after 25 passed; 19 were not run. Local Node 26.12.1 remains outside the declared 20.9–22 range. No authenticated production workflow was exercised.
- Remaining gates are still open: complete privacy/IDOR and workflow verification, privacy/legal operations, durable authentication/session controls, encrypted backup/restore and private-file recovery, full E2E, compatible-runtime acceptance, and the shared-bundle budget decision. Do not call the deployment fully production-ready or enable real learner data on this evidence.

## Remaining release-readiness gates (not cleared by the owner override)

1. **Local acceptance:** fresh full permission/IDOR suite, rebuilt full Playwright E2E including mobile audit, production-schema build, local HTTP smoke checks and `git diff --check`. Resolve the shared-bundle failure and all required accessibility/navigation/print defects. Do not mark U11 complete without these results.
2. **Server least privilege and child-data privacy:** reconcile every read/mutation with `src/lib/permissions.ts` and approved product rules, including nested records/files and the specific gaps below. UI hiding, styled tabs and passing unit tests are insufficient.
3. **Authentication and security:** durable rate limiting/lockout, session revocation/device behavior, secret-history/dependency review, upload/storage controls and append-only audit validation. Earlier security notes are not current independent evidence.
4. **Privacy/legal operations:** owner-approved notice, lawful child-data processing/guardian consent, ODPC registration/DPIA review as applicable, export/correction/deletion/anonymization and approved retention/recovery procedures.
5. **PostgreSQL/storage/recovery:** validate migrations, role/grant/RLS and audit-trigger behavior on a separate approved PostgreSQL test target; verify private storage and encrypted backup/restore including private files. Source/schema parity is not proof of live migration state.
6. **Owner release decision:** record the canonical full-stack repository/host choice, reviewed migration/recovery plan, current evidence and explicit release approval. This pass does not push, deploy, modify production or infer that a host/database is already configured.

## Round 2 implemented foundations and remaining feature work

### U3 — navigation (partial acceptance)

`PageShell` includes role navigation, skip link, responsive header/nav, theme controls, search and restored `PageNavigation`. The latter implements breadcrumbs, a bounded pathname history, scroll restoration and unsaved-form checks; admission Back currently returns to `/learners`. Receipts have their own shared navigation.

Remaining: fresh role sweep of direct/deep/external entry, app Back and browser back/forward, admission list/register fallback, unsaved forms, mobile back-event integration, focus recovery and reduced motion. Query-backed filters/pagination are not preserved by the pathname-only history. Source search/navigation controls are not a complete permission-aware command palette: check advertised destinations, Ctrl/Cmd-K opening, focus trapping and the learner search parameter (`query` versus the API's `q`).

### U4 — admissions (partial)

Seven-step draft/resume, normalized learner/residence/guardian/emergency/pick-up/health records, consent, private photo/PDF documents, required-document checklist and branded admission PDF exist. Director-only learner account provisioning can start from basic identity/class details and the full admission later updates the same pending learner; non-Director staff can save admission records but cannot create accounts.

Remaining: photo crop/edit; pre-existing parent identity maintenance and sibling-link E2E; fee handoff tied to approved class/term pricing and invoice preview; private document read/download/remove tests and safe abandoned-draft retention. Learner-profile supporting-document links now exist, so this is a verification/policy gap, not an absent route. Admission detail GET currently permits school-scope reads more broadly than the page's Secretary ownership and Head Teacher draft restrictions; align all detail/document/mutation policies before release.

### U5 — learner/staff profiles (partial; privacy gate open)

Learner biography, private photo, section anchors, contacts, attendance, CBE/result trends, fee balances/receipt links, protected documents, discipline and history views exist. Secretary/Head Teacher learner editing exists; Parent linked and Learner self scopes are represented. Restricted health reads append audit events. Teachers now use an assigned grade/subject academic roster instead of profile browsing; it shows approved learners, subject assessments, assignments and released-result-derived strengths/support areas, without learner profile or demographic fields.

Remaining and blocking:

- Learner detail now resolves basic identity first, establishes school/assigned/linked/self/identity access, then queries permitted sections. Accountant no longer queries the biography/guardian profile or renders guardian contacts; only identity/photo metadata and permitted finance remain. Teachers are redirected before learner detail queries; teacher requests to the general learner directory and learner photo API are denied. Focused roster/privacy browser regressions have been added but still need to pass.
- `specialNeeds` is selected only in the authorized, audited health query. Unused admission payload and private pre-authorization profile reads were removed. Verify remaining nested API/file/profile reads separately; this source repair does not close the whole child-data privacy gate.
- Prove every section and nested endpoint has linked/self/assigned/identity scope, including unreleased assessments, histories, photos, admission documents and private family data. Disable-prefetch changes reduce incidental reads but do not fix authorization.
- Validate talent/timeline/chart claims against persisted records rather than presentation-only content. Add photo crop/edit, a genuinely secure parent-message destination if approved, and configurable teacher fee/parent health visibility only under approved policy.

Staff directory/profile, employment/TSC/qualifications, assignments, teaching notes, attendance, document/import/edit/history foundations now exist. Director/Head Teacher browse the directory; other staff detail is self-only. Account and role creation is now Director-only, including staff accounts; Head Teacher profile editing of permitted staff remains distinct from account/role administration. Verify that staff provisioning endpoints, role changes, payroll/statutory/history exposure and staff documents/imports/exports enforce approved least privilege.

### U6 — attendance/exams/rubrics (partial)

Daily schoolwide learner/class completion and leadership staff attendance capture exist. `/assessments/exams` includes session creation/status/progress and closed-session reopen controls; its create UI sends an empty timetable. `/assessments/rubrics` persists versioned configurable levels with an impact-count warning. Assessment entry has an active-exam picker.

Remaining and blocking:

- Exam list/detail GET and rubric GET currently authenticate without applying the resource/role scopes; exam detail includes assessment/learner data. Enforce matrix/assigned reads before querying and add every-role IDOR tests.
- The assessment UI sends `examSessionId`, but the POST Zod schema omits it, so it is stripped and not persisted. Make active assigned exam context mandatory on the assessment server, validate class/subject/date windows, filter marks by exam, implement exam timetable editing/clash checks and accurate submission progress. A picker is not enforcement.
- Closed-to-active reopen checks exist, but published-to-active transitions need equivalent approval/reason protection. Verify the complete state machine and audit decisions.
- Rubric storage/versioning does not establish grading integration: `src/lib/grading.ts` and report calculations retain default fixed thresholds. Validate unique codes, contiguous/non-overlapping bounds, effective dates, immutable assessment-version references and controlled impact/regrading before claiming configurable grading complete.
- Attendance range trends, stream/gender splits, absentee follow-up/parent notifications, reminders, exports and full register lock/edit QA remain open.

### U7 — complaints (partial)

Server access remains Parent → Head Teacher/Director only, with linked-child creation, own parent threads, leadership reply/status and search/filter/count UI. A `BOTH` selection currently assigns only the Head Teacher; leadership school-scope visibility is not both-recipient delivery.

Remaining: secure attachment upload/download (metadata fields alone are not a file workflow), explicit fan-out, real notification/unread/delivery state, assignment and moderation. Remove stale Secretary compose branches/shortcuts and “posted and notified” claims. The Secretary dashboard's complaint count/shortcut must also be reconciled with forbidden complaint access.

### U8 — learning library (partial)

Assigned-class general HTTPS resources, separate official-channel `VideoLibrary`, eBook management and textbook requests exist. YouTube oEmbed channel verification, grade/weak-topic matching and watched state are implemented in source; arbitrary teacher VIDEO resources are excluded from learner resource reads. Teacher YouTube search uses an explicit copy/paste link flow with a preview because a page cannot read a result URL from another browser origin. Grade-dependent Number Quest/Science Explorer questions and feedback exist; these are not full course authoring.

Pending learners can now access grade-scoped teacher resources, assignments, assignment submission and verified class videos without academic summaries, attendance, game activity, or assignment scores/feedback. This is a source implementation and the focused E2E scenario must pass before it is treated as accepted.

Remaining: network/official-channel E2E fixture, malicious URL and class/self IDOR tests, accessible playback/watch behavior, video self-check questions, stronger mastery/trend weighting and playlist ordering. Optional YouTube Data API integration is not implemented. Assignment marking remains exact-answer matching plus teacher feedback; optional assignment drafting must remain local-model-only, with no child/user content sent to paid/external AI. Teacher daily lesson status can be saved and used to prefill the weekly log; focused workflow and role-visibility E2E remain pending.

### U9 — finance (partial; integrity/E2E gate open)

Head Teacher/Director versioned class/term structures, effective dates and compulsory/optional lines exist; Secretary/Accountant read versions. The invoice API can snapshot an approved structure, enforcing compulsory lines when structure-line IDs rather than manual items are used. Invoice stepper/search/preview, payment drawer, confirmation/void, waiver request/Director decision, arrears aging and collection totals now exist in source.

Remaining:

- The stepper currently posts manual `items` and uses hard-coded fallback fees, bypassing the approved structure snapshot path. Bind to selected approved line IDs/version/effective date, prevent unsupported fallback pricing and validate learner/invoice identifiers returned to the UI.
- Prove discounts/waivers/credits, invoice uniqueness, confirmation/void and aging/balance calculations under transaction/concurrency and full E2E tests. Finish statements, operational expenses, richer collection/payment-method analytics, verified filters/pagination and export/report output.
- Secretary invoice reads suppress payment identifiers, but the page still passes a payment affordance. Remove it and verify permitted structure/paid/balance-only output, no receipt/payment writes and no private finance identifiers.
- Direct receipt PDF route and download link **exist**. Test role/linked-child IDOR, authorization before restricted fetches, cache privacy, long text/page overflow, totals, void state and print output.
- The `/receipts` register now lists confirmed and void receipts with a KES collection summary and pagination. School-scoped finance roles can browse it, parents are limited to linked learners, and Secretary access is denied; full role/IDOR and UI acceptance remain open.
- QR verification is **not implemented**. Receipt HTML/PDF and the learner admission slip now show reference details instead of unsupported QR/authenticity claims. Other PDFs still require review: `src/lib/qr.ts` creates a hash-derived matrix, not a standards-compliant encoded verification payload. Build a privacy-safe verification service and genuine QR encoding only if approved; do not expose child identifiers or payment details in public verification URLs.

### U10 — whole-system UX (partial)

Shared responsive primitives, Bento/Glass/theme controls, page redesigns, profile/history sections, report charts and CSV links exist. `docs/UI_UPGRADE_CHECKLIST.md` is now an honest source inventory, not a passed visual audit.

Remaining: rebuilt route-by-route mobile/desktop/keyboard/screen-reader/dark-mode checks for every role, including staff creation, learner edit, exams/rubrics, videos, library, schemes, timetable and welfare. The staff credential slip now adapts to narrow screens and A4 printing, but its browser and print-preview QA remains pending. The report-card PDF now uses released marks and recorded teacher comments; complete browser/print-output QA, rubric-version integration, responsive sortable/paginated tables, URL-backed state, safe command-palette search and accessible charts remain. Separate Parent overview/results/fees/attendance pages and own phone/email editing are not built; current `/portal` is shared and `/profile` remains photo/password settings. Audit forbidden dashboard shortcuts and unsupported “safe,” “verified,” delivery and compliance copy.

Deputy timetable, textbook library and schemes foundations now exist, so their earlier “pages do not exist” note is obsolete. Standalone duty/events/discipline pages remain absent; validate timetable clash enforcement and library transaction/audit integrity rather than certifying the entire operations module from these pages.

## Security, privacy and operations still required

- Exam-session, rubric and admission-packet reads now enforce the same matrix as their pages: `GET /api/exams` requires `examSessions:view` and limits an assigned-scope teacher to exam sessions covering their own grades, `GET /api/rubrics` requires the school scope the rubric page requires, and `GET /api/admissions/[id]` keeps the page rule that a Secretary reads only their own draft and a Head Teacher never reads a DRAFT packet. Denials are audited and packet denials answer 404 so existence is not disclosed. Remaining: complete route/action/file/IDOR coverage for every role, especially profile restricted-field fetches, staff provisioning/payroll/history and receipt PDFs. Validate every external input with Zod, including query/state transitions and nested JSON schedules; never log private payloads or file-storage details.
- PostgreSQL migrations `0002_lock_down_public_api`, `0003_append_only_audit` and `0004_secure_audit_function` include public API lockdown and audit mutation/truncate triggers. `0005_staff_profiles` includes private-table lockdown. These are source safeguards, not proof they are applied or effective on a live service. Verify runtime grants/RLS/triggers and migrations on an approved separate test target; SQLite/application-level audit guarantees are not equivalent.
- Login throttling/session behavior still needs durable cross-process storage, idle/session revocation, sign-out-all-devices and session/device history tests. Confirm cookie/CSRF/security-header, dependency and secret-history review without exposing values.
- Learner export and abandoned-admission retention tools now exist, but do not complete the full data-subject correction/deletion/anonymization process, scheduled safe purge, document/file retention or owner-approved privacy notice. Protect preserved accounts and history; never use demo cleanup as a production privacy workflow.
- Separate PostgreSQL schema/migrations, production build, health route, private Supabase Storage/Render disk adapter and encrypted backup/restore scripts exist. Live target configuration, PostgreSQL behavior, private-file durability and recovery are unverified in this review. Backup restore uses `--no-owner --no-acl`; recovery must separately restore/verify least-privilege grants/RLS and private files.
- Finish/review `docs/guides/` for Accountant and changed permissions/clean-start behavior, plus README/operator instructions. This docs-only pass does not edit those files or mark their review complete.

## U11 final local acceptance

U11 is the final local acceptance/hardening gate, not deployment. Require full permission/IDOR and rebuilt E2E/mobile suites, production-schema build, local smoke checks, budget acceptance, `git diff --check`, checklist reconciliation and guide/README review. Required U4/U6/U7/U9/U10 items remain incomplete or unverified; **U11 is not complete**. The 2026-11-01 Production deployment was explicitly authorized while these gates were assumed; this is not evidence that they passed.

### 2026-11-18 verification update

- The PostgreSQL-schema production build completed (130 App Router entries); local lint, type-check, unit suite (87/87), schema parity, secret-history scan, local health smoke check, targeted sign-out/account-onboarding E2E (2/2) and cross-role breadcrumb/theme E2E (1/1) passed.
- The mobile audit is still incomplete. The interrupted rebuilt suite reached test 25/50 and had recorded contrast failures, 13px text, a report-tab horizontal scroller, unnamed Library selects, a Teacher learner-detail fixture that redirected, and `/teaching-log` available to Deputy despite the audit role-page allowlist omitting it. Shared tertiary token contrast, learner summary size and report-tab viewport sizing were adjusted after the audit build; rerun the audit on the current source and reconcile the Deputy access expectation against the permission matrix before changing authorization.
- `npm run budget:check` currently fails six raw-JavaScript budgets: shared 481.4 KB/350 KB and Assessments 388.2 KB, Finance 255.9 KB, Learners 261.6 KB, Learning 274.9 KB, and Library 258.3 KB against 250 KB each. The historical framework-floor note in `docs/OWNER_ACTIONS.md` still requires an owner decision; route-specific excesses also need analysis.
- The full suite was interrupted; complete mobile/accessibility and all-role IDOR E2E remain open. No live host source branch, production PostgreSQL target, applied migration state, backup/recovery rehearsal or deployment workflow has been verified. Do not push a force update or promote this build to production while these gates are red.

Use the dedicated isolated local E2E database/build (`scripts/run-e2e.mjs`), never production or the preserved development accounts. No routine Director-only reset should overwrite the currently preserved non-demo Parent or credentials. Owner-approved scope reductions, if any, must be explicit; visual styling does not silently reduce acceptance requirements.

## Historical operational notes — not current live-state evidence

The 2026-10-27 notes recorded dependency-audit results, supplied repository checks and a denied GitHub push. They are historical observations only; no current repository, deployment, host, database or vulnerability state was checked here. Do not infer the supplied repositories are still empty, that no host exists, that migrations are applied/unapplied, or that an earlier network failure is the only E2E blocker.

Keep the existing Next.js full-stack monolith on one approved app host; `frontend/` and `backend/` source maps are not independently runnable services. Decide the canonical repository before publication. Any future empty-production bootstrap uses owner-controlled temporary Director credentials, never demo defaults; existing production accounts/data must be preserved. Upload source limits remain 4 MiB per admission/assignment file with a 4 MiB + 64 KiB multipart budget; confirm host behavior on an approved non-production target first.

**Do not use real learner data or expose an unapproved release while these gates remain open.** Follow `docs/OWNER_ACTIONS.md` only after separate owner authorization; no deployment or production cleanup is performed here.

## 2026-11-18 teacher/curriculum request follow-up

- In this turn the local source changes were type-checked, linted, and unit-tested. The production build is still running; no completion of U11 is implied.
- Live migrations `0007_senior_teacher_lesson_and_book_requests`, `20261117_welfare_approval_history`, and `20261117_welfare_member_backfill` remain to be applied and verified against Supabase project `yosbrtigxfqagdkixegh`. The installed Supabase CLI reports no access token and the dashboard session is signed out; use an authenticated owner session to apply repository SQL and verify migration history. Do not infer migration state from local schema files.
- Production push is not confirmed until the commit reaches the configured Vercel production branch and deployment status/domain are checked. Vercel CLI is not installed in this workspace; if Git auto-deploy does not provide a verifiable Ready deployment, an authenticated Vercel project session is needed.
- Remaining user-request items: support in-app YouTube result selection, expand assistant capability only within role permissions and local-only constraints, verify the downloaded class roll against an actual Ministry learner-register template, and run full E2E/mobile/production acceptance. Keep the assistant's local KICD summary scoped to the curriculum-area defaults available in source.
- Final local verification: the production-schema build passed with 85 App Router routes, and type-check, lint, unit tests (88/88) and `git diff --check` passed. The commit/deployment outcome and live database migration state are tracked separately and remain unverified here.
- Deployment update: commit `e2f8bd8` reached production `main` and the GitHub Vercel status is `success`; the live portal returned HTTP 200 and its health endpoint returned `{"status":"ok"}`. The three requested Supabase migrations are still not applied/verified: Supabase CLI has no access token, and the connected dashboard session is signed out. Production cannot be called fully updated until those migrations are applied and verified.

## 2026-11-18 mobile diary follow-up

- The mobile layout and family diary changes are committed locally as `972cf17` on `perf/fast-web-all-devices`. The diary PostgreSQL migration at `prisma/postgresql/migrations/20261118120000_family_diary/migration.sql` is prepared but has not been applied to production. This phase explicitly excludes deployment per the project operating rules; do not describe this feature as live.
- Local lint, type-check, production-schema build (87 routes), local health/unauthenticated diary API smoke checks, and `git diff --check` passed. Full automated tests and signed-in mobile browser review were not run.
- Release follow-up: after the project’s deployment gate is authorized, deploy the monolith and apply/verify the diary migration before enabling diary in production. Re-run full permission/IDOR and mobile E2E acceptance; confirm production migration history and app health.

## 2026-11-18 account, receipt and mobile UX release follow-up

- Local changes are complete on `perf/fast-web-all-devices`: BoardUI dashboard metrics, account list, notification center, bulk receipt PDF/CSV, upload progress, theme visibility and Director-only account/learner archival. Validation passed locally, including 88/88 unit tests and an 88-route production-schema build. The finance invoice area already uses a responsive list.
- Not released: these changes have not been pushed or deployed. The supplied `AGENTS.md` says not to deploy, and U11/mobile, IDOR and production acceptance remain open. Account and learner controls preserve records through suspension/archive instead of hard-deleting history. A release requires a separate authorized production workflow after acceptance gates are addressed.
