# Round 3 status

The requested starting files `docs/ROUND3_STATUS.md` and `docs/OWNER_ACTIONS.md` were absent at the start of this task. `docs/ROUND3_BRIEF.md` has been reconstructed as an execution index from the user's full request; the user request remains authoritative.

| Section | Status | Evidence / remaining work |
|---|---|---|
| 1. Staff crash and completion | In progress | Root cause confirmed: StaffProfile and related tables were missing from both checked-in migration histories. Additive SQLite/PostgreSQL migrations, empty-profile backfill, safe error states and staff E2E coverage added. Local migration test passed; production application is gated on verified backup. |
| 2. Mobile header | Implemented; final suite pending | Mobile header, profile sheet, search overlay and desktop profile/sign-out menu added. Role-driven Playwright checks passed for the all-role navigation test. |
| 3. Bottom navigation | Implemented; final suite pending | Light/dark contrast, active state and 24px icons updated; keyboard and full-screen wizard handling corrected. Mobile overflow was found and fixed on the Parent Complaints page. |
| 4. Speed | Todo | No local Lighthouse or page timing baseline recorded yet. |
| 5. Every page mobile pass | Todo | No Round 3 page-by-page audit or four-theme viewport suite exists yet. |
| 6. Lint | Todo | Latest known baseline is 69 warnings, 0 errors. |
| 7. Verification | In progress | Type-check passed, unit tests 54/54 passed, legacy SQLite migration/backfill test passed. Latest targeted E2E: cross-role permissions, admissions/guardian linking and all-role mobile navigation passed. Full suite, mobile/accessibility/performance matrices and production build remain. |
| 8. Safe deploy | Not started | Must follow `docs/OWNER_ACTIONS.md`; no production migration or test data operation has been run. |
