# Mary Royal SMS — remaining work

This roadmap separates source implementation from verified local acceptance and owner-approved production release. Preparation is **not deployment**, permission to contact production, or permission to clean production data. No production request, migration, seed, reset, account change or release is authorized by this documentation pass.

## Current local preparation status — 2026-10-28

- `PageNavigation` is restored inside `PageShell` (the historic `PortalFrame` reference is obsolete). Learner record links deliberately use native anchors: disabling Next.js prefetch did not fix the click stall. Director/Head Teacher/Secretary profile clicks passed six development-browser cases at 390/1280px. Staff and shared workspace navigation retain Next.js links; rebuilt all-role navigation/mobile/E2E acceptance is running and has not passed yet.
- Strict lint with zero warnings, type-check, 65 unit tests and SQLite/PostgreSQL schema parity passed before the final native-link repair; final matching checks remain pending. The current dependency audit reports zero vulnerabilities, and the limited repository/history secret scanner reports zero category matches. Neither check establishes complete permission or release acceptance. The actual Windows runtime is Node 26.12.1, outside the declared Node 20.9–22 range; compatible-runtime acceptance is required before release.
- Full E2E is green on a fresh isolated production build: one serial run passed **44/44** (2026-10-28) and the mobile audit reported **0 findings** across **20/20** role and viewport collections covering 42 route paths in four appearances. The two failures in the preceding run were a stale Accountant guardian expectation — inverted to match the tightened privacy rule — and stale app-bar section labels for Accountant, Teacher, Parent and Learner, corrected to the deliberate navigation labels.
- Shared JavaScript measured **441.6 KiB** on the 2026-10-28 production build against the unchanged **350 KiB** gate. Attribution: `react-dom` 169.0 KiB plus the Next.js App Router/RSC client runtime 170.1 KiB is 339.1 KiB before any application code, and the whole application portal shell is 52.2 KiB, so removing it entirely would still leave 389.4 KiB. The gate cannot be met by application changes; it stays an open owner decision with the threshold and raw-size accounting untouched. Route-specific JavaScript is 189.7 KiB against its 250 KiB budget (`scripts/check-perf-budget.ts`).
- The local development database now has no demo learners, invoices, payments, assessments or admission drafts. Two accounts were retained: the Director and a non-demo Parent. Both credentials and school-settings/CBC defaults were preserved. This is not a Director-only reset and says nothing about production data.
- A local backup is retained in the ignored `backups/` directory. Uploads were retained to avoid deleting files belonging to preserved accounts; orphan-file cleanup requires a separate verified retention plan. A local SQLite backup is not evidence of encrypted PostgreSQL recovery.
- Every existing row in `docs/UI_UPGRADE_CHECKLIST.md` now distinguishes current source capability, unbuilt work and pending verification. The historic visual baseline does not certify planned functionality as shipped.

## Current release-blocking gates

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

Seven-step draft/resume, normalized learner/residence/guardian/emergency/pick-up/health records, consent, private photo/PDF documents, required-document checklist, branded admission PDF and explicit learner/parent access setup exist.

Remaining: photo crop/edit; pre-existing parent identity maintenance and sibling-link E2E; fee handoff tied to approved class/term pricing and invoice preview; private document read/download/remove tests and safe abandoned-draft retention. Learner-profile supporting-document links now exist, so this is a verification/policy gap, not an absent route. Admission detail GET currently permits school-scope reads more broadly than the page's Secretary ownership and Head Teacher draft restrictions; align all detail/document/mutation policies before release.

### U5 — learner/staff profiles (partial; privacy gate open)

Learner biography, private photo, section anchors, contacts, attendance, CBC/result trends, fee balances/receipt links, protected documents, discipline and history views exist. Secretary/Head Teacher learner editing exists; Teacher assigned, Parent linked and Learner self scopes are represented. Restricted health reads append audit events.

Remaining and blocking:

- Learner detail now resolves basic identity first, establishes school/assigned/linked/self/identity access, then queries permitted sections. Accountant no longer queries the biography/guardian profile or renders guardian contacts; only identity/photo metadata and permitted finance remain. Matching browser privacy regressions are pending.
- `specialNeeds` is selected only in the authorized, audited health query. Unused admission payload and private pre-authorization profile reads were removed. Verify remaining nested API/file/profile reads separately; this source repair does not close the whole child-data privacy gate.
- Prove every section and nested endpoint has linked/self/assigned/identity scope, including unreleased assessments, histories, photos, admission documents and private family data. Disable-prefetch changes reduce incidental reads but do not fix authorization.
- Validate talent/timeline/chart claims against persisted records rather than presentation-only content. Add photo crop/edit, a genuinely secure parent-message destination if approved, and configurable teacher fee/parent health visibility only under approved policy.

Staff directory/profile, employment/TSC/qualifications, assignments, teaching notes, attendance, document/import/edit/history foundations now exist. Director/Head Teacher browse the directory; other staff detail is self-only. Current permissions/API allow Head Teacher staff account creation, and staff-profile payroll visibility is broader than the earlier Director-only claim. Reconcile account/role provisioning with the Director-only account rule and confirm payroll/statutory/history exposure with approved least privilege. Verify all staff documents, bulk imports/exports, editing and self-only history access; employment editing is no longer wholly absent.

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

Assigned-class general HTTPS resources and separate official-channel `VideoLibrary` exist. YouTube oEmbed channel verification, grade/weak-topic matching and watched state are implemented in source; arbitrary teacher VIDEO resources are excluded from learner resource reads. Grade-dependent Number Quest/Science Explorer questions and feedback exist; these are not full course authoring.

Remaining: network/official-channel E2E fixture, malicious URL and class/self IDOR tests, accessible playback/watch behavior, video self-check questions, stronger mastery/trend weighting and playlist ordering. Optional YouTube Data API integration is not implemented. Assignment marking remains exact-answer matching plus teacher feedback; optional assignment drafting must remain local-model-only, with no child/user content sent to paid/external AI.

### U9 — finance (partial; integrity/E2E gate open)

Head Teacher/Director versioned class/term structures, effective dates and compulsory/optional lines exist; Secretary/Accountant read versions. The invoice API can snapshot an approved structure, enforcing compulsory lines when structure-line IDs rather than manual items are used. Invoice stepper/search/preview, payment drawer, confirmation/void, waiver request/Director decision, arrears aging and collection totals now exist in source.

Remaining:

- The stepper currently posts manual `items` and uses hard-coded fallback fees, bypassing the approved structure snapshot path. Bind to selected approved line IDs/version/effective date, prevent unsupported fallback pricing and validate learner/invoice identifiers returned to the UI.
- Prove discounts/waivers/credits, invoice uniqueness, confirmation/void and aging/balance calculations under transaction/concurrency and full E2E tests. Finish statements, operational expenses, richer collection/payment-method analytics, verified filters/pagination and export/report output.
- Secretary invoice reads suppress payment identifiers, but the page still passes a payment affordance. Remove it and verify permitted structure/paid/balance-only output, no receipt/payment writes and no private finance identifiers.
- Direct receipt PDF route and download link **exist**. Test role/linked-child IDOR, authorization before restricted fetches, cache privacy, long text/page overflow, totals, void state and print output.
- QR verification is **not implemented**. `src/lib/qr.ts` creates a hash-derived QR-style matrix, not a standards-compliant encoded verification payload; the page points at an absent `/verify/receipt` route and the PDF's “token” is not signed verification. Build a privacy-safe verification service and genuine QR encoding, or remove unsupported verification/authenticity claims. Do not expose child identifiers or payment details in public verification URLs.

### U10 — whole-system UX (partial)

Shared responsive primitives, Bento/Glass/theme controls, page redesigns, profile/history sections, report charts and CSV links exist. `docs/UI_UPGRADE_CHECKLIST.md` is now an honest source inventory, not a passed visual audit.

Remaining: rebuilt route-by-route mobile/desktop/keyboard/screen-reader/dark-mode checks for every role, including staff creation, learner edit, exams/rubrics, videos, library, schemes, timetable and welfare. Finish responsive sortable/paginated tables, URL-backed state, safe command-palette search, complete report-card/statement print output and accessible charts. Separate Parent overview/results/fees/attendance pages and own phone/email editing are not built; current `/portal` is shared and `/profile` remains photo/password settings. Audit forbidden dashboard shortcuts and unsupported “safe,” “verified,” delivery and compliance copy.

Deputy timetable, textbook library and schemes foundations now exist, so their earlier “pages do not exist” note is obsolete. Standalone duty/events/discipline pages remain absent; validate timetable clash enforcement and library transaction/audit integrity rather than certifying the entire operations module from these pages.

## Security, privacy and operations still required

- Exam-session, rubric and admission-packet reads now enforce the same matrix as their pages: `GET /api/exams` requires `examSessions:view` and limits an assigned-scope teacher to exam sessions covering their own grades, `GET /api/rubrics` requires the school scope the rubric page requires, and `GET /api/admissions/[id]` keeps the page rule that a Secretary reads only their own draft and a Head Teacher never reads a DRAFT packet. Denials are audited and packet denials answer 404 so existence is not disclosed. Remaining: complete route/action/file/IDOR coverage for every role, especially profile restricted-field fetches, staff provisioning/payroll/history and receipt PDFs. Validate every external input with Zod, including query/state transitions and nested JSON schedules; never log private payloads or file-storage details.
- PostgreSQL migrations `0002_lock_down_public_api`, `0003_append_only_audit` and `0004_secure_audit_function` include public API lockdown and audit mutation/truncate triggers. `0005_staff_profiles` includes private-table lockdown. These are source safeguards, not proof they are applied or effective on a live service. Verify runtime grants/RLS/triggers and migrations on an approved separate test target; SQLite/application-level audit guarantees are not equivalent.
- Login throttling/session behavior still needs durable cross-process storage, idle/session revocation, sign-out-all-devices and session/device history tests. Confirm cookie/CSRF/security-header, dependency and secret-history review without exposing values.
- Learner export and abandoned-admission retention tools now exist, but do not complete the full data-subject correction/deletion/anonymization process, scheduled safe purge, document/file retention or owner-approved privacy notice. Protect preserved accounts and history; never use demo cleanup as a production privacy workflow.
- Separate PostgreSQL schema/migrations, production build, health route, private Supabase Storage/Render disk adapter and encrypted backup/restore scripts exist. Live target configuration, PostgreSQL behavior, private-file durability and recovery are unverified in this review. Backup restore uses `--no-owner --no-acl`; recovery must separately restore/verify least-privilege grants/RLS and private files.
- Finish/review `docs/guides/` for Accountant and changed permissions/clean-start behavior, plus README/operator instructions. This docs-only pass does not edit those files or mark their review complete.

## U11 final local acceptance

U11 is the final local acceptance/hardening gate, not deployment. Require full permission/IDOR and rebuilt E2E/mobile suites, production-schema build, local smoke checks, budget acceptance, `git diff --check`, checklist reconciliation and guide/README review. Required U4/U6/U7/U9/U10 items remain incomplete or unverified; **U11 is not complete and the release remains blocked**.

Use the dedicated isolated local E2E database/build (`scripts/run-e2e.mjs`), never production or the preserved development accounts. No routine Director-only reset should overwrite the currently preserved non-demo Parent or credentials. Owner-approved scope reductions, if any, must be explicit; visual styling does not silently reduce acceptance requirements.

## Historical operational notes — not current live-state evidence

The 2026-10-27 notes recorded dependency-audit results, supplied repository checks and a denied GitHub push. They are historical observations only; no current repository, deployment, host, database or vulnerability state was checked here. Do not infer the supplied repositories are still empty, that no host exists, that migrations are applied/unapplied, or that an earlier network failure is the only E2E blocker.

Keep the existing Next.js full-stack monolith on one approved app host; `frontend/` and `backend/` source maps are not independently runnable services. Decide the canonical repository before publication. Any future empty-production bootstrap uses owner-controlled temporary Director credentials, never demo defaults; existing production accounts/data must be preserved. Upload source limits remain 4 MiB per admission/assignment file with a 4 MiB + 64 KiB multipart budget; confirm host behavior on an approved non-production target first.

**Do not use real learner data or expose an unapproved release while these gates remain open.** Follow `docs/OWNER_ACTIONS.md` only after separate owner authorization; no deployment or production cleanup is performed here.
