# Mary Royal SMS — remaining work

This repository is a local prototype. The Round 2 work improves its authorization model and fresh-start flow, but does not make it ready for real children’s or financial data.

## Round 2 implemented foundations

- Accountant is a distinct role again. Secretary can admit learners and explicitly create learner logins, but has read-only fee totals/balances and cannot record payments or open receipts.
- Complaint access is limited to Parent, Head Teacher, and Director. Parents can create and track private complaint threads; school leaders can reply and update status.
- Default setup creates the Director, school identity settings, and CBC EE/ME/AE/BE defaults. Optional `seed:demo` supplies synthetic records; `reset:fresh` requires explicit confirmation and preserves only the Director and defaults.
- Playwright tests cover the seeded role access matrix for selected APIs, admission/login approval, the Parent complaint channel, Accountant payment workflow, learner-scoped portals and teaching/assignment workflows.

## Still required from Upgrade Round 2

- **Navigation (U3, core implemented):** shared role-aware breadcrumbs, mobile detail back bar, safe parent fallback, in-app route history, scroll restoration and unsaved-form warnings now cover PortalFrame pages and receipts. A role sweep exercises direct page loads, app back, browser back and forward. URL-backed filters/list pagination and QA of routes outside PortalFrame remain for U10.
- **Admission (U4):** the multi-step draft/resume wizard, normalized residence/guardian/emergency/pick-up/health records, consent, private photo/PDF uploads, required-document checklist, branded admission PDF, and explicit opt-in learner and parent access are implemented. Remaining: photo crop, broader parent identity maintenance for pre-existing accounts, parent account linking across sibling admissions E2E, secure view/download of individual supporting documents from the learner profile, and admission-to-approved-fee invoice preview.
- **Profiles (U5, substantially implemented; final role E2E pending):** learner profile sections now have role-aware anchors; a private no-store passport photo route, protected/audited document preview/download, attendance summary, released CBC results with subject trend bars, fee balances and authorized receipt links, discipline follow-up, and dated learner timeline. Accountant sees identity, guardian contacts, and fee details only; Teacher is assigned-learner scoped; Parent/Learner are linked/self scoped; restricted health reads are audited. Staff profiles display photo/contact, staff/TSC numbers, position, qualifications, assigned classes/subjects, lesson notes, attendance/punctuality, last login, and Director-only payroll. Added schoolwide staff attendance capture for Director/Head Teacher/Deputy and self-only attendance access for other staff. Remaining: photo crop/edit in admission, Director editing employment fields after account creation, message-parent quick action (no secure messaging destination exists), configurable teacher fee-status and parent health toggles, exhaustive per-tab/profile IDOR coverage, and visual QA in U10.
- **Attendance/exams/rubrics (U6, partial):** Director, Head Teacher and Deputy have the schoolwide daily learner overview, and school leaders can capture staff attendance while other staff can only read their own records. Remaining: date-range trends, stream/gender split, absentee follow-up/parent notifications, reminders and exports. Deputy exam-session/timetable creation and progress tracking, teacher active-exam filtering, central configurable/versioned rubrics, and impact/reopen approvals are not implemented.
- **Complaints (U7):** attachment upload, explicit recipient fan-out for “both,” notification delivery, assignment and full conversation moderation are not implemented. Current one-way Parent-to-leadership access and reply/status workflows are implemented.
- **KICD learning library (U8, partial):** staff can curate by grade/subject/strand; YouTube oEmbed metadata is verified against `@edutvkenya`, the handle linked by KICD, before saving. Learners receive only matching grade videos for subjects/strands below 60%, can mark lessons watched, and never see arbitrary teacher video links. Remaining: optional YouTube Data API integration, API/network verification end-to-end fixture, video self-check questions, mastery/trend weighting beyond the BE/AE threshold, playlist ordering and stronger test coverage of malicious URLs and class IDOR.
- **Finance (U9, partial):** Head Teacher/Director can create versioned class/term fee structures with effective dates and compulsory/optional items. Secretary and Accountant read the approved versions; changes are audited. Invoice API can generate an immutable invoice-line snapshot from the current approved structure, requires compulsory lines and allows selected optional lines. Remaining: the invoice wizard/preview UI, discounts and Director waiver workflow, arrears aging and statements, expenses and collection analytics, actual PDF/QR receipt download, export reports and end-to-end testing of structure migration on a fresh reset.
- **Whole-system UX (U10):** page-by-page redesign and visual/accessibility audit across every role, full command-palette search, responsive sortable/paginated tables, dark-mode checks on every view, and comprehensive print behavior remain.

## Other security, operational and data gaps

- Permission tests still do not enumerate every route/action/IDOR for every role. The E2E sweep now includes profile scope checks, but does not cover all nested records, receipt privacy, each profile tab, uploads, and future modules.
- Append-only audit is enforced in application workflows, not at the database layer. Login rate limiting is process-local; durable lockout, idle-session revocation/sign-out-all-devices and session/device history need stronger storage and tests.
- Finish data-subject export/correction/deletion/anonymization workflow, retention controls, approved privacy notice, secure admission-document retention and encrypted backup/restore verification before real data use.
- Local setup remains SQLite. A separate PostgreSQL schema and initial migration, production build command, health route, and private Supabase Storage/Render disk adapter now exist. These have not been applied to or exercised against a real PostgreSQL service; don't treat this as a validated one-line database switch yet.
- Assignment auto-marking is exact-answer matching only. Optional AI needs a locally installed Ollama model. No child or school content is sent to a paid/external AI service.
- Finish `docs/guides/` for the new Accountant role and revise existing role guides for changed permissions and the clean-start walkthrough.

No deployment is performed.

## U11 final acceptance (definition)

U11 was not part of the original U1-U10 brief. It is defined as a final local acceptance gate: full permission/IDOR and E2E suites, production build, local smoke test, U10 checklist reconciliation, guide/README review and accurate roadmap. No deployment is included. This gate cannot be marked complete while any required U4/U6/U7/U9/U10 item remains unimplemented or unverified.

## 2026-10-27 follow-up status

- Shared navigation, admission Back fallback, welfare privacy, local-only AI drafts, Director setup checklist completion, and grade-band/welfare reports were updated in this pass.
- The local development database was explicitly reset to the Director-only state after implementation; it is reset again after E2E runs.
- Superseded by the 2026-10-28 mobile redesign status below; E2E, build and lint results are recorded in `docs/PROGRESS.md` for that pass. Complete the route-by-route RBAC/IDOR, file-upload privacy, authentication rate-limit/session, and all-role profile E2E audit before real student data is used.
- Frontend/backend source directories contain architecture maps only. The two provided GitHub URLs have not been configured or pushed; a separate runnable backend does not exist yet because the current API is implemented as Next.js route handlers.

## Production and GitHub status — 2026-10-27

- `npm audit` and `npm audit --omit=dev` currently report zero package vulnerabilities. This is useful but does not constitute an application security review.
- Both supplied GitHub repositories were checked and contain only an initial `LICENSE` commit. This project is a single Next.js App Router full-stack application; only README source maps exist in its `frontend/` and `backend/` folders.
- A push to `MaryRoyal-frontend` was attempted after preserving its initial commit, but GitHub returned HTTP 403: the configured Git identity `apakalaundryservices-stack` does not have write access. No code was published. Do not duplicate the monolith in both repos; decide a canonical full-stack repo or complete a real service split first.
- **Do not use real learner data or expose this build to users yet.** Production configuration exists, but PostgreSQL migrations have not been exercised against a live service; the full E2E suite still has a flaky finance `ECONNRESET`; the full route/IDOR review, durable rate limiting/session revocation, secure backup/restore, and child-data export/retention workflows remain incomplete. Use the private one-time Director bootstrap, never the local seed password, for production.
- Admission and assignment uploads now allow up to 4 MiB per file and enforce a 4 MiB + 64 KiB multipart body budget for Vercel's 4.5 MB request cap. Confirm the host's actual multipart behavior with a deployment smoke test; larger uploads still need direct/resumable browser-to-private-storage transfer.
- Kenya ODPC guidance identifies provision of education as a category subject to mandatory data-handler registration and calls for child-data safeguards, transparent notice and verifiable guardian consent. The school should complete its legal/privacy review and any required DPIA before processing real learner records.
