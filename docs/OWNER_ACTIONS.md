# Owner actions for production preparation and future release

## Authorization boundary

This pass prepares documentation only. It does **not** push, deploy, promote a release, contact production, run migrations, bootstrap accounts, or clean any production database/files. The owner retains explicit release approval. A feature branch, styled checklist or successful local unit check is not permission to release.

Never run `seed:demo`, setup/demo seeds, `reset:fresh`, `prisma migrate reset`, `migrate dev`, `prisma db push`, browser write tests or retention purges against production. Local demo cleanup is not a production migration step. Preserve existing production accounts, credentials, school defaults, learner history and private files; do not infer production content from the local database.

## 1. Close the release gates first

Keep release approval withheld until current evidence closes all of the following:

- Fresh full permission/IDOR suite and rebuilt all-role Playwright/mobile/accessibility/navigation audit; production-schema build and local HTTP smoke checks; `git diff --check`.
- Shared JavaScript within the unchanged 350 KiB budget. Remeasured on a matching 2026-10-28 production build: **441.6 KiB**, of which 339.1 KiB is `react-dom` plus the Next.js App Router/RSC client runtime and only 52.2 KiB is the application portal shell, so the limit sits below the framework floor. This needs an owner decision (accept a documented framework floor or redefine the metric); the threshold and raw-size accounting are unchanged. Route-specific JavaScript is 189.7 KiB against its 250 KiB budget.
- Server-side privacy: Accountant identity-only learner access, restricted medical fetches, admission-packet ownership, and the exam/rubric/packet GET scopes are repaired in source with per-role regression assertions; independent verification of staff account/payroll policy and private receipt/file access is still open.
- Required unfinished feature workflows and honest checklist acceptance, including approved-structure invoice wiring and genuine QR verification. A direct receipt PDF exists; its current QR-style stamp is not a verification service.
- Durable authentication/rate-limit/session controls, dependency/secret review, approved child-data privacy/consent/retention/data-request procedures and ODPC/legal review as applicable.
- Approved separate PostgreSQL test-target migration/storage/security validation and encrypted database/private-file recovery rehearsal.

Previously reported strict zero-warning lint, type-check, 65 unit tests and schema parity passed, but do not close these release gates. No checks were rerun for this documentation update. See `docs/ROADMAP.md` and `docs/UI_UPGRADE_CHECKLIST.md` for precise unfinished work.

## 2. Agree the future target and preserve current state

- Decide the canonical full-stack repository and hosting target. This is one Next.js monolith; the frontend/backend source-map folders are not independent deployments.
- Confirm actual current host, database, applied migrations and data ownership only through a separately authorized review. Historical GitHub/hosting notes do not establish current live state.
- Rehearse on an approved isolated non-production PostgreSQL database and private storage target using synthetic data. Never point local/E2E scripts or browser write tests at production.
- Current local development state retains the Director and a non-demo Parent with unchanged credentials/defaults; no demo learners/invoices/payments/assessments/admission drafts remain. The ignored local backup and retained uploads protect that local state only. Do not run another routine reset that would remove the preserved Parent.

## 3. Backup and recovery gate — separately authorized

Before any future production mutation, the owner/operator must approve and verify a current backup and recovery plan:

- Confirm a backup method actually supported by the chosen database/host and service plan; do not assume a dashboard manual snapshot is available. Do not provision paid services as part of this pass.
- The repository's `npm run backup` creates an encrypted PostgreSQL dump using trusted `DIRECT_URL` and `BACKUP_ENCRYPTION_KEY`; it is a future authorized operation, not an instruction to run now. `backup:sqlite` is local development only.
- Preserve private admission, staff, assignment and avatar files plus required storage metadata. A database snapshot alone does not recover private file contents. Keep encryption keys separately protected and recoverable.
- Record timestamps, sizes, checksums, retention and recovery evidence outside the repository without personal fields or connection secrets.
- Rehearse `restore:postgres` only into a separately approved **empty non-production database**, with explicit target confirmation. The script requires `BACKUP_FILE`, `RESTORE_DATABASE_URL`, `BACKUP_ENCRYPTION_KEY` and `RESTORE_CONFIRM=RESTORE_TO_EMPTY_DATABASE`; never use the live database as the restore target.
- Dumps/restores omit owners/ACLs. Independently restore and verify runtime grants, public API/RLS lockdown, append-only audit triggers and private storage access after recovery. Record verified recovery-time/data-loss expectations before approving release.

## 4. Configuration review — variable names only

A future authorized operator should verify configuration in the trusted hosting environment without displaying values:

- Core runtime/migration: `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `OBJECT_STORAGE_DRIVER`.
- If Supabase private storage is selected: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`; verify the bucket is private and server credentials are never public/browser variables.
- If persistent-disk storage is selected: confirm mounted persistence and permissions against the existing storage adapter/host configuration instead of assuming Supabase variables apply.
- Backup/recovery: `BACKUP_ENCRYPTION_KEY` and approved backup location/client tools; restore variables belong only in the separately authorized recovery environment.

Never paste/log `.env` contents, tokens, passwords, connection strings, auth-state files, child records or private payloads. Verify runtime and direct migration connections target the intended PostgreSQL database; do not treat SQLite/PostgreSQL schema parity as live connection validation.

## 5. Read-only migration comparison — future approval required

After explicit authorization for a production read-only comparison, an operator may inspect migration status and compare the target database with the checked-in PostgreSQL schema from `D:/SMS`. Do not run these commands during this preparation pass:

```bash
npx prisma migrate status --schema prisma/postgresql/schema.prisma

# Direction: current database -> desired checked-in PostgreSQL model.
# Uses the schema's configured datasource; verify the intended target in the trusted environment first.
npx prisma migrate diff --from-schema-datasource prisma/postgresql/schema.prisma --to-schema-datamodel prisma/postgresql/schema.prisma
```

- These commands do not apply migrations; they still contact the configured database. Capture only reviewed schema/migration metadata in restricted release records, never secrets or personal fields.
- Review **every** pending migration, applied migration checksum and unexpected drift. A datamodel diff does not prove grants/RLS, audit functions/triggers, backfills or private storage are correct; inspect those separately with authorized non-personal metadata checks.
- Do not automatically mark `0005_staff_profiles` applied because table names exist or a datamodel diff is empty. Baseline/resolve is a production migration-history mutation requiring separate owner approval, exact structural/backfill/security evidence and the operator's documented reconciliation plan.
- `IF NOT EXISTS` clauses in `0005_staff_profiles` do not prove pre-existing columns, indexes, constraints, permissions or data match. They do not guarantee the migration or all migrations are safe to rerun. Stop on drift, failed migration/checksum disagreement or unexpected state.

## 6. Future mutation and release gate

Only after the preceding gates are green may the owner explicitly authorize a reviewed production migration/release window. That approval must state the target, migration set, verified backup, recovery plan, acceptable downtime and release scope; it does not authorize demo cleanup.

- An authorized operator applies reviewed pending PostgreSQL migrations using `npm run db:migrate:production`, then verifies migration status and independent security metadata. Never bypass failures with a blind resolve, schema push or reset.
- Use `bootstrap:director` only for a confirmed empty new database after migrations, with private temporary `DIRECTOR_NAME`, `DIRECTOR_EMAIL` and `DIRECTOR_PASSWORD`. Never seed/reset an existing production system or replace retained credentials as preparation. Remove temporary bootstrap secrets after the authorized operation.
- Deploy the approved production-schema build of the full monolith only after explicit release approval. Use private file persistence; admission/assignment source limits are 4 MiB per file and 4 MiB + 64 KiB multipart bodies. Confirm actual host request/storage behavior on the non-production target first.
- Run an approved post-release verification plan: health, role/read-only scope, migration/security state and private file retrieval. Ordinary profile views can append audit events, so “read-only browser review” must not be assumed mutation-free. No production browser write tests or real-data exports are included by default.

## 7. Hosting and recovery decision

- Select compatible app/database regions and keep settings in encrypted host configuration; do not infer a current Vercel, Render or Supabase deployment from repository files.
- Record the last verified compatible application artifact and recovery procedure. Promoting an older app build does **not** roll back schema, data or private files and may be incompatible with new migrations.
- Do not assume additive/idempotent migrations eliminate database recovery needs. Verify the combined app/database/storage recovery plan on the separate rehearsal target and stop release on unexpected drift or failed privacy gates.
- Keep explicit owner go/no-go approval and evidence outside the repository. These instructions prepare a future controlled release; **no deployment or production database cleanup has been performed or authorized here**.
