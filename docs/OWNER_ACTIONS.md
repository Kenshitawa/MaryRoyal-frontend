# Owner actions for Round 3 live release

These steps must be completed only after the Round 3 local checks are green. Do not run seeds, resets or browser write tests against production.

## Before the staff schema migration

1. In Supabase, create a fresh production database backup. Confirm the backup completed and is restorable. The migration `0005_staff_profiles` creates staff profile, contact, referee, document, history and draft tables; it also creates minimal empty profiles for existing staff accounts. It does not copy or alter existing staff identity or payroll values.
2. In a trusted deployment shell, confirm the runtime and migration configuration exists by variable name only: `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `OBJECT_STORAGE_DRIVER`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET`. Never paste their values into chat, logs or this repository.
3. Confirm `DIRECT_URL` targets the intended production project, then run `npm run db:migrate:production`. Do not run `prisma db push`, `migrate dev`, `migrate reset`, or a seed command on production.
4. Run `prisma migrate status --schema prisma/postgresql/schema.prisma` and verify the database is up to date. Check staff profile row counts without exporting personal fields.
5. Verify `/api/health` and the staff pages using owner accounts after deployment. Do not create training or fake accounts in production.

## Hosting and recovery

- Keep Vercel server functions in a region near the Supabase database region to reduce request latency.
- Store all production settings in the hosting project's encrypted environment configuration. Inspect names and target environments only; never print values.
- If the deployment fails, use Vercel's deployment history to redeploy the last Ready production deployment. Do not roll back or edit database schema manually; the staff migration is additive.
- Keep the successful backup outside the repository and record only its filename, timestamp and size in the release log.
