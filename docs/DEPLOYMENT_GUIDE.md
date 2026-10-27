# Mary Royal SMS production deployment guide

Last reviewed: 2026-10-27. This guide prepares a deployment; it does not deploy the app or provision cloud resources.

## Pick one application host

The app is a **single Next.js full-stack application**. UI pages, server components, API route handlers, authentication and Prisma data access are in one project. Do not deploy `MaryRoyal-frontend` to Vercel and `MaryRoyal-Baclend` to Render as two services: those repositories are source snapshots, and the app has not been extracted into a remote API architecture. Choose one host for the whole project:

- **Vercel + Supabase Postgres + Supabase Storage**: use Vercel for the complete Next.js project. The upload adapter must use a private Supabase Storage bucket because serverless filesystems are temporary.
- **Render + Supabase Postgres + Render persistent disk**: use Render for the complete Next.js project. The included `render.yaml` mounts a persistent disk for private uploads. A persistent disk changes Render deploy behavior and may require a paid service tier.

Do not use both hosts for split halves. The Vercel/Render project root must contain the complete source tree (`src/app`, `src/lib`, `src/components`, `prisma`, `scripts`, `package.json` and lockfile). `MaryRoyal-frontend` is the complete deployable checkout. `MaryRoyal-Baclend` is a backend source snapshot and does not satisfy the root requirement by itself.

## PostgreSQL and migrations

- Local development continues to use `prisma/schema.prisma` and SQLite.
- Production uses `prisma/postgresql/schema.prisma` and its checked-in PostgreSQL migration history.
- `npm run build:production` generates the PostgreSQL Prisma Client and builds Next.js.
- `npm run db:migrate:production` applies production migrations. It uses `DIRECT_URL` for migration connections; set both `DATABASE_URL` and `DIRECT_URL` in the shell that runs the command.
- The PostgreSQL migrations enable RLS on every current `public` table and revoke schema/table access from `PUBLIC`, `anon`, and `authenticated`. Prisma is the server-side data path. After migration, run `npm run security:check-supabase` from a trusted environment with `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` set; it verifies RLS and grants on each table and probes the public Data API. Do not call this check passed until run against the actual Supabase project.
- Never run `npm run setup`, `npm run seed:demo`, or `npm run reset:fresh` against the production database.

Supabase connection values depend on the application host. For Vercel functions, use the Supavisor transaction-pooler URL for `DATABASE_URL` and include `pgbouncer=true` when the Supabase Prisma connection instructions specify it; use a session/direct connection for `DIRECT_URL` and migrations. For a persistent Render Node service, use a session-pooler or direct connection supported by that service's network. Supabase connection strings are shown in its Connect panel. See [Supabase's Prisma guide](https://supabase.com/docs/guides/database/prisma) and [connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres).

**Vercel upload limit:** Vercel Functions cap request and response bodies at 4.5 MB. Admission and assignment uploads are capped at 4 MiB per file, and the API rejects multipart request bodies larger than 4 MiB plus 64 KiB to leave room below that platform cap. The API is authoritative; browser checks provide an earlier message. Verify uploads on the chosen host before using real records. Larger uploads would require direct/resumable browser-to-private-Supabase-Storage transfers. See [Vercel's function limits](https://vercel.com/docs/functions/limitations) and [Supabase resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads).

Deployment update (2026-10-27): the production migration set was applied to the empty Supabase project `yosbrtigxfqagdkixegh`: initial schema, deny-by-default RLS/API lockdown, append-only audit trigger, and fixed audit-function search path. The live project now has 52 public tables and all 52 have RLS enabled. A SQL privilege check confirmed `anon` and `authenticated` have no schema usage or table read/write permissions. The security advisor reports the expected informational notices for tables with RLS and no policies; server-side Prisma is the only application data path. No learner or demo data was inserted.

The migrations were applied through the Supabase management connection, so Prisma's migration history table is not yet populated in the app database. Before running `prisma migrate deploy` from a host, reconcile Supabase migration history against the four checked-in PostgreSQL migration files; do not replay the already-applied initial schema.

The supplied Supabase dashboard showed project status Healthy on 2026-10-27. Its database schema and public-role grants are now verified as described above. The unauthenticated Storage status endpoint returned HTTP 200; the Auth and REST endpoints returned HTTP 401 without an API key. A live app connection, runtime credentials, private bucket configuration, and backup/restore drill are still pending.

At Node server startup, the app validates production `DATABASE_URL`, `SESSION_SECRET`, and storage-driver configuration. Build-time validation is skipped because Vercel builds do not connect to the database; production server startup remains strict. When `OBJECT_STORAGE_DRIVER=supabase`, all three Supabase storage variables are required. Vercel production rejects local file storage because its filesystem is ephemeral. Validation reports variable names only, never values. `DIRECT_URL` is needed by migration commands, not app requests.

## Vercel + Supabase setup

1. Connect `MaryRoyal-frontend`, select the repository root, and keep the Next.js framework preset. Its current `main` branch contains the complete monolith. The included `vercel.json` selects `npm ci` and `npm run build:production`.
2. Create a Supabase Postgres project in a region near the app. In Vercel Project Settings → Environment Variables, set:
   - `DATABASE_URL`: Supabase transaction-pooler URL for serverless runtime.
   - `DIRECT_URL`: Supabase session/direct URL for migrations.
   - `SESSION_SECRET`: a new random secret of at least 32 bytes.
   - `OBJECT_STORAGE_DRIVER`: `supabase`.
   - `SUPABASE_URL`: the project URL.
   - `SUPABASE_SERVICE_ROLE_KEY`: server-only service-role secret. Never prefix it with `NEXT_PUBLIC_` and never put it in browser code.
   - `SUPABASE_STORAGE_BUCKET`: `mary-royal-private`.
3. Create a **private** Supabase Storage bucket named `mary-royal-private`. Do not make it public. File reads are proxied through authenticated, scoped app routes; the service-role key stays server-side.
4. The schema and security migrations are already applied to project `yosbrtigxfqagdkixegh`, with 52/52 tables protected by RLS. Before running Prisma Migrate from another environment, reconcile its migration ledger against the four checked-in PostgreSQL migration files. Then set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` and run `npm run security:check-supabase` with real pooled and direct database URLs; require a pass before admitting data.
5. Create the initial Director from a trusted shell connected to the production database. Set `DIRECTOR_BOOTSTRAP_TOKEN` (random and at least 32 characters), `DIRECTOR_NAME`, `DIRECTOR_EMAIL`, and a unique `DIRECTOR_PASSWORD` (16+ characters with upper/lowercase, number and symbol), then run `npm run bootstrap:director`. The command requires the token and refuses to run if any account exists; it forces a password change at first login. Do not add the bootstrap token or password to Vercel variables or commit either. Clear all temporary environment variables immediately after the command.
6. Deploy. Verify `/api/health` returns `{"status":"ok"}`, sign in as the Director, change the password, and verify a private admission document and assignment attachment can be uploaded and retrieved by authorized accounts only.

Generate a secret locally with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`; paste it directly into the host's secret field and do not commit or send it in chat.

## Render alternative

The included `render.yaml` describes one Node web service for the full app, a pre-deploy migration command, health check and persistent upload disk. Create the service from the project root. Set `DATABASE_URL` and `DIRECT_URL` to the Supabase connection values in Render's secret environment settings. The blueprint generates `SESSION_SECRET`; the local file-storage adapter uses the mounted disk paths. Keep the disk attached and confirm its mount path before admitting any file. Use Render's service shell for the one-time Director bootstrap with temporary shell environment variables; remove those values afterward.

Render's default filesystem is ephemeral. The persistent disk is necessary for local-file mode and may disable zero-downtime deploys. See [Render's Next.js guide](https://render.com/docs/deploy-nextjs-app), [deploy behavior](https://render.com/docs/deploys), and [persistent disk documentation](https://render.com/docs/disks).

## Current app-host state

The current full-stack source was published to `Kenshitawa/MaryRoyal-frontend` `main` at commit `ea4d2a2910444f4d812fbe516062ca92633e3fe1`. The Vercel account still has an older `maryroyalschool` project connected to `Kenshitawa/maryroyalschool`; it has no environment variables and is not connected to the canonical repository. Do not replace its production source until runtime secrets below are set. A private `mary-royal-private` Storage bucket is configured with a 4 MiB file limit. The app is not yet live against Supabase.

## Before entering real learner data

This repository is not certified production-ready yet. Do not admit real children until all of these are complete:

- Test the live PostgreSQL app connection and migration ledger; test encrypted backup and restore from a separate environment.
- Run the complete Playwright suite to green. The last recorded full run was 8/9, with the admission PDF request timing out on the remaining scenario.
- Complete route-by-route authorization and IDOR tests, including nested records, file downloads, finance, parent/learner scope and the new upload routes. The present test suite does not cover every endpoint/action/role combination.
- Replace process-local login throttling with a durable distributed rate limit; verify account lock and recovery, idle-session behavior, and sign-out-all-devices semantics under multiple instances.
- Finish data-subject export, correction, retention, deletion/anonymization request workflows and verify audit-log immutability at the database boundary.
- Confirm restore drills, encrypted off-site backups, alerting, incident response, school privacy notice, guardian consent, and applicable ODPC registration/DPIA requirements.
- Resolve remaining Round 2 items in [the roadmap](ROADMAP.md), including outstanding finance/report/UX requirements. Do not mark them complete from deployment success alone.

This deployment configuration is a technical starting point, not a production-readiness certification or legal approval. Use synthetic records for training until the blockers above are independently closed and verified.
