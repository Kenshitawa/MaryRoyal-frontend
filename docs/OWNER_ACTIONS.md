# Owner actions for Round 3 live release

These steps must be completed only after the Round 3 local checks are green. Do not run seeds, resets or browser write tests against production.

## Safe Pre-Deploy Production Comparison & Migration Procedure

### 1. Production Backup Gate
- In the Supabase dashboard (Database -> Backups), create a manual backup snapshot.
- Confirm the backup is ready and restorable. Record its filename/timestamp and size in release records (outside the repository).

### 2. Verify Environment Variables (Names Only)
- In a trusted deployment shell, confirm the runtime and migration configuration exists by variable name only:
  `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `OBJECT_STORAGE_DRIVER`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`.
- Never paste or log secrets or connection values.

### 3. Read-Only Production Diff Check
Before running any migration, perform a read-only comparison against production using `DIRECT_URL`:
```bash
# Check current migration status against production
npx prisma migrate status --schema prisma/postgresql/schema.prisma

# Diff PostgreSQL schema against the target database without making changes
npx prisma migrate diff --from-schema-datamodel prisma/postgresql/schema.prisma --to-schema-datasource prisma/postgresql/schema.prisma
```

### 4. Handling Existing Tables (Prisma Migrate Resolve)
If production already has the staff tables created manually or out-of-band, running `migrate deploy` could fail or conflict if not marked:
- If `prisma migrate status` shows `0005_staff_profiles` unapplied, but `prisma migrate diff` reports no differences or only the expected tables already exist:
  ```bash
  npx prisma migrate resolve --applied 0005_staff_profiles --schema prisma/postgresql/schema.prisma
  ```
- Because migration `0005_staff_profiles` has been rewritten with `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, idempotent constraint additions, and `INSERT ... WHERE NOT EXISTS`, running `npm run db:migrate:production` is also non-destructive and safe to re-run.

### 5. Applying Pending Migrations
Apply pending migrations cleanly using:
```bash
npm run db:migrate:production
```
Never run `prisma db push`, `migrate dev`, `migrate reset`, or seed commands against production.

### 6. Post-Migration Verification
- Verify `npx prisma migrate status --schema prisma/postgresql/schema.prisma` reports "Database schema is up to date!".
- Check staff profile row counts without exporting personal fields.
- Verify `/api/health` and the staff pages using real owner accounts.

## Hosting and Recovery
- Keep Vercel server functions in a region near the Supabase database region to minimize request latency.
- Store all production settings in the hosting project's encrypted environment configuration.
- If the deployment fails, use Vercel's deployment history to promote/redeploy the last Ready production deployment.
- Database rollbacks are not required because all migrations are additive.
