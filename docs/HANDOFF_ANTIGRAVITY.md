# Handoff to Antigravity — Status and Execution Plan

This document tracks takeover from Codex on branch `feat/staff-drafts-mobilenav-audit`.

## Verified Completed Work (Codex)
- **Staff crash fix (commit c20ce46)**: Staff bio tables synchronized across SQLite and PostgreSQL schemas. Additive migrations with empty-profile backfill for existing staff. Server error logging and branded error boundary retry state. Role-gated payroll queries.
- **Mobile header (commit ef7661e)**: Compact 56px header with profile bottom sheet (appearance, themes, profile/password, sign out) and full-screen search overlay. Duplicate mobile breadcrumb/back row removed.
- **Bottom navigation (commit ef7661e)**: High-contrast light-mode white bar with dark readable labels and dark-mode styling, 24px icons, 44px+ touch targets. Fixed hide-on-keyboard behavior (only hides when text inputs are focused and visual viewport shrinks).
- **Targeted fixes & suites**: Fixed 360px overflow on complaints filter. Cross-role permissions suite (`tests/permissions.test.ts`), admission draft deletion (`tests/admissions-delete.test.ts`), staff suite (`tests/staff.test.ts`), and all-role mobile shell navigation verified in targeted runs.

## Remaining Work (Antigravity Takeover)
1. **Section 1: Verify staff, drafts, payroll and migrations**:
   - Make PostgreSQL & SQLite staff migrations strictly idempotent/re-runnable (`CREATE TABLE IF NOT EXISTS`, etc.).
   - Verify non-destructive application on fresh DB and schema without staff tables.
   - Add schema drift detection script (`scripts/check-schema-drift.ts`) failing if SQLite and PostgreSQL Prisma schemas differ in models or fields.
   - Fix local SQLite migration state so `prisma migrate status` is clean.
   - Add/verify targeted tests for staff profiles, payroll field masking/access (Accountant view-only, Director/HeadTeacher edit within scope, others 403), audit logging.
   - Verify admission draft deletion rules (Secretary, Head Teacher, Director; single & bulk; file purge; protected status SUBMITTED/ENROLLED).
2. **Section 2: Speed and efficiency**:
   - Establish baseline performance numbers across 9 key pages per role using Playwright Chromium with network and CPU throttling.
   - Record baseline in `docs/PERFORMANCE_REPORT.md`.
   - Implement data parallelization (`Promise.all`), DB indexes on foreign keys / search columns, cache stable reads, dynamic imports for heavy components, bundle budget, and PWA service worker with offline fallback.
   - Re-measure and record before/after in `docs/PERFORMANCE_REPORT.md`.
3. **Section 3: Page-by-page mobile pass & automated checks**:
   - Create `docs/MOBILE_PAGE_AUDIT.md` covering all roles and pages.
   - Standardize typography tokens (12, 14, 16, 20, 24px only; weights 400 & 600 only; no body text <14px).
   - Convert wide tables to responsive card lists, ensure 44px+ touch targets, 1 primary action per screen.
   - Build permanent automated Playwright mobile test (`tests/mobile-audit.test.ts`) asserting no horizontal overflow, typography constraints, 44px touch targets, a11y contrast, and no console errors at 360px & 390px.
4. **Section 4: Faster, reliable tests**:
   - Implement role session reuse (`storageState`) in Playwright.
   - Split test runs into fast smoke and full test suites.
   - Resolve any remaining failures in the full E2E suite.
5. **Section 5: Complete lint cleanup**:
   - Verify `npm run lint` achieves 0 warnings and 0 errors with `--max-warnings 0`.
   - Run type-check and unit tests after any cleanup.
6. **Section 6: Full verification**:
   - Sequential run: lint, type-check, build, unit tests, schema drift check, full E2E, mobile checks, smoke tests, accessibility, performance budget.
   - Verify `docs/MOBILE_PAGE_AUDIT.md` has 0 open items.
7. **Section 7: Safe deploy gates (1–6)**:
   - Follow deployment gates sequentially: Git push check, pre-deploy safety & backup gate, preview verification, production migrations, release & post-deploy checks, handover instructions.
