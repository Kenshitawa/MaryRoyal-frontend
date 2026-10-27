# Round 3 status

The requested starting files `docs/ROUND3_STATUS.md` and `docs/OWNER_ACTIONS.md` were absent at the start of this task. `docs/ROUND3_BRIEF.md` has been reconstructed as an execution index from the user's full request; the user request remains authoritative.

| Section | Status | Evidence / remaining work |
|---|---|---|
| 1. Staff crash and completion | In progress | Root cause confirmed: StaffProfile and related tables were missing from both checked-in migration histories. Additive SQLite/PostgreSQL migrations, empty-profile backfill, safe error states and staff E2E coverage added. Local migration test passed; production application is gated on verified backup. |
| 2. Mobile header | Todo | Existing compact header still shows redundant theme, name and sign-out controls on mobile. |
| 3. Bottom navigation | Todo | Current bar uses low-contrast labels, 20px icons and 10.5px type. |
| 4. Speed | Todo | No local Lighthouse or page timing baseline recorded yet. |
| 5. Every page mobile pass | Todo | No Round 3 page-by-page audit or four-theme viewport suite exists yet. |
| 6. Lint | Todo | Latest known baseline is 69 warnings, 0 errors. |
| 7. Verification | In progress | Type-check passed, unit tests 54/54 passed, legacy SQLite migration/backfill test passed, Playwright 9/10 passed. One existing mobile navigation visibility assertion failed; investigate and rerun. Production build and complete mobile/accessibility/performance matrices remain. |
| 8. Safe deploy | Not started | Must follow `docs/OWNER_ACTIONS.md`; no production migration or test data operation has been run. |
