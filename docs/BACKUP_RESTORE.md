# PostgreSQL backup and restore runbook

## Backup format and schedule

`npm run backup` invokes the installed PostgreSQL `pg_dump` client against `DIRECT_URL`, streams a custom-format dump through AES-256-GCM, and writes `mary-royal-<UTC timestamp>.pgdump.enc` under `BACKUP_DIR` (default `backups/`). Supply a base64url-encoded 32-byte `BACKUP_ENCRYPTION_KEY` through the trusted host/maintenance environment. The encryption key must be stored separately from the backup files in a managed secret store. Neither connection URLs nor key values are printed by the scripts.

Generate a key in a trusted terminal with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`; copy it directly to the secret manager, not to a project file.

Schedule a daily backup during a low-traffic window (for example 02:00 EAT), retain 35 daily copies and 12 month-end copies, and keep at least one encrypted copy outside the application host and its storage account. Monitor the scheduled job and alert on missing or failed backups. This schedule is a proposed operational default and must be approved by the school owner and aligned with the approved records-retention schedule.

The repository does not configure a scheduled cloud job. A private job runner with `pg_dump` installed and access to the direct database URL is required. Never use the runtime pooler URL for `pg_dump`.

## Restore drill

1. Provision a separate, empty PostgreSQL database/project. Do not point restore at the production database.
2. Install PostgreSQL client tools compatible with the server and generate the PostgreSQL Prisma Client with `npm run restore:postgres` (the command does this before restore).
3. In a trusted shell, set `BACKUP_FILE`, `BACKUP_ENCRYPTION_KEY`, `RESTORE_DATABASE_URL`, and `RESTORE_CONFIRM=RESTORE_TO_EMPTY_DATABASE`. Set `DIRECT_URL` to the production source only for the script's same-target guard. Do not place values in command arguments, files, logs, or chat.
4. Run `npm run restore:postgres`. The command verifies the backup authentication tag and checks the target has no application tables before invoking `pg_restore`.
5. Compare table row counts against a separately recorded pre-backup inventory, run `npm run security:check-supabase` if the restored target is Supabase, start a temporary app pointed at the restored database, test Director login and a learner profile, and delete the temporary database after sign-off.

## Current drill status

**Not performed.** No direct database password/URL, second empty database, `pg_dump`, or `pg_restore` executable was available in the workspace. The scripts and runbook are code deliverables; they are not evidence of a successful backup or restore. Do not mark recovery readiness complete until a dated drill result, matching counts, login check, and learner-profile check are recorded here.
