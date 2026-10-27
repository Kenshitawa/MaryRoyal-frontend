# Mary Royal SMS — Agent Operating Rules

## Product and security rules
- Build a local-first school management system for Mary Royal School, Kisumu, using the stated CBE workflows and KES/EAT context.
- No public registration. Only the Director manages accounts and roles. Enforce least privilege on the server for every mutation/read; UI hiding is supplemental. Scope parent/learner/teacher records to linked/assigned learners. Secretary handles admissions and records, but only reads fee structure and learner balances. Accountant manages operational finance and must not see grades, discipline, medical, or private family-message data. Head Teacher and Director approve/authorize as configured. Complaints are only Parent → Head Teacher/Director.
- Validate every external input with Zod, use hashed credentials and HTTP-only session cookies, log sensitive actions append-only, and avoid sensitive values in logs.
- Protect children’s data, soft archive people with history, use transactions/unique constraints for grades and money, and record material decisions in docs/DECISIONS.md.
- Learner profile access must use the `learners` matrix scopes, with Accountant restricted to `learner-identity` plus permitted finance data. Fetch restricted medical fields only for authorized roles and append an audit record on each health-profile view. Staff directory/profile browsing is Director/Head Teacher only; staff may view their own profile.
- Use royal blue/white, accessible mobile-first layouts, clear labels, keyboard/focus support, and Mary Royal branding.
- Do not deploy or use paid services. No public registration, fake buttons, or placeholder claims.
- Optional assignment drafting must use a local model only; never send child data or user content to a paid/external AI service.

## Stack
Next.js App Router, strict TypeScript, Tailwind CSS, shadcn-compatible accessible primitives, lucide-react, Prisma with SQLite locally and PostgreSQL-compatible models, credentials auth, Zod, Vitest and Playwright. Keep feature code modular and centralize authorization in `src/lib/permissions.ts` and grading in `src/lib/grading.ts`.

## Phase workflow
For each phase: read this file; run the app locally; run lint, type-check and available tests; fix failures; append actual built/tested/known/next notes to docs/PROGRESS.md; commit with a clear phase message. Do not claim a check passed unless it ran. If a phase cannot be completed, record precise remaining work in docs/ROADMAP.md and continue.

## Commands
- `npm run setup`: install dependencies, apply the Prisma schema, and create an empty local system with the Director and defaults.
- `npm run seed:demo`: optional synthetic demo data for development and E2E tests.
- `npm run reset:fresh`: interactively clear school data while preserving the Director and system defaults; use `-- --yes` only when a reset is explicitly intended.
- `npm run dev`: local development server.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`: quality checks.
- `npm run backup`: create an encrypted PostgreSQL backup using `DIRECT_URL` and `BACKUP_ENCRYPTION_KEY`.
- `npm run backup:sqlite`: create a local SQLite backup for development only.
- `npm run restore:postgres`: restore an encrypted backup into a separate empty PostgreSQL database after explicit target confirmation.
- `npm run retention:enforce`: dry-run abandoned admission draft cleanup; actual purge requires an explicit `RETENTION_APPLY` value.
- `npm run build:production`: build using the PostgreSQL Prisma schema for deployment hosts.
- `npm run db:migrate:production`: apply PostgreSQL migrations using `DIRECT_URL`.
- `npm run bootstrap:director`: one-time empty-database setup using temporary `DIRECTOR_NAME`, `DIRECTOR_EMAIL`, and `DIRECTOR_PASSWORD`; never run demo seed/reset against production.

## Production deployment preparation
- Keep the full Next.js monolith on one app host; frontend/backend repository snapshots are not independently deployable services.
- Local mode uses SQLite. Production builds use `prisma/postgresql/schema.prisma`; deploy migrations before the one-time Director bootstrap.
- Store private files in a private Supabase Storage bucket on Vercel or on the mounted persistent disk in `render.yaml`. Admission and assignment files are capped at 4 MiB, with API routes also rejecting multipart bodies above 4 MiB plus 64 KiB so they remain below Vercel's 4.5 MB function body cap.
- Do not call the app production-ready while security, privacy, live PostgreSQL, backup/restore and full E2E items remain open.

## U11 final acceptance
- U11 is final local acceptance and hardening for the Round 2 request. Run the complete permission/IDOR suite, full Playwright E2E suite, production build, local HTTP smoke checks, and `git diff --check`; fix failures before marking complete.
- Reconcile every row in `docs/UI_UPGRADE_CHECKLIST.md`, document remaining work precisely in `docs/ROADMAP.md`, and never describe partial features as complete. U11 does not include deployment.
