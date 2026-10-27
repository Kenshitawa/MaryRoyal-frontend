# Go-live checklist

**Status: not cleared for real learner or finance data.** This checklist separates repository work from actions requiring school-owned cloud accounts, keys, approvals, and a second database. Complete and evidence every owner action before inviting families or staff.

## Code and repository

| Item | Status | Evidence / next action |
|---|---|---|
| Upload caps | Done in code | 4 MiB/file and 4 MiB + 64 KiB declared request cap; host smoke test still required. |
| Public Supabase access | RLS and grants verified in live project | Applied to all 52 tables; anon/authenticated have no public schema usage or table read/write grants. Run the full publishable-key API probe from a trusted app environment when keys are set. |
| Production env validation | Added in code | Verify a disposable production start rejects missing names only and starts with correct secrets. |
| Director-only learner JSON export | Added in code | E2E covers Director allow, teacher denial, download header and audit record; portable documents bundle and parent request workflow remain open. |
| Bootstrap | CLI now requires token and empty DB | Exercise once against an empty disposable database; then clear temporary environment variables. |
| Encrypted PostgreSQL backup/restore | Scripts added | Requires compatible `pg_dump`/`pg_restore`; no real backup or second-DB restore drill has been performed. |
| Retention | Draft-only enforcement command added | Dry-run default; policy approval and script review required before `RETENTION_APPLY=PURGE_EXPIRED_DRAFTS`. Other record classes are not automatically retained/deleted. |
| Security review | Partial, see `SECURITY_REVIEW.md` | Exhaustive role/route/file IDOR review, durable rate limiting/session revocation, append-only DB audit, CSRF checks, and secrets/history scan remain open. |
| Full app E2E | Pending final run | Require complete green unit, permission, and Playwright suites. No visual test suite is configured as a separate package command. |
| Supabase project status | Schema deployed 2026-10-27 | Healthy PostgreSQL 17 project; four migrations recorded, 52 public tables, 52/52 RLS enabled, all empty. No learner/demo records inserted. |
| Vercel project | Existing project inspected 2026-10-27 | `maryroyalschool` is connected to an older repository and has zero environment variables; do not replace its production source until canonical source and runtime secrets are ready. |
| Hosting shape | Monolith configuration exists | This is one Next.js app with server API routes. Do not split browser frontend to Vercel and APIs to Render until a real remote API boundary, auth/CORS/CSRF model, and shared session design are implemented. |

## Owner actions in hosting dashboards

- [x] Choose Vercel for the full-stack monolith with Supabase for Postgres and private storage. Do not create split frontend/backend deployments from source-map folders.
- [x] Create an empty production Supabase project and apply the four checked-in PostgreSQL migrations. Keep it empty until the app host is connected and production startup is verified.
- [ ] Set secrets only in the selected host's secret manager: runtime `DATABASE_URL`, migration `DIRECT_URL` as needed, strong `SESSION_SECRET`, storage driver/bucket/project settings and server-only storage credential. The publishable key must not substitute for the storage service key or DB password.
- [ ] Create the private storage bucket (if using Supabase Storage); verify it is not public and define backup/lifecycle controls.
- [ ] Ensure the GitHub identity has repository write access and connect the canonical complete app repository to the chosen host. Confirm the commit deployed and the deployment URL is HTTPS.
- [ ] Confirm school ownership of the domain/DNS if a custom domain is desired; turn on MFA for GitHub, Supabase, and hosting accounts and restrict team access.
- [ ] Approve privacy notice, guardian consent, retention schedule, breach response, ODPC registration/DPIA/cross-border hosting obligations, backup schedule, recovery objectives and named data protection lead.

## Deployment and acceptance actions

- [x] Apply schema and lockdown migrations; verify RLS on every table and denied public Postgres privileges. Full publishable-key REST denial and normal Prisma runtime connection remain pending secure host credentials.
- [ ] Create the Director once using a trusted shell and `DIRECTOR_BOOTSTRAP_TOKEN`; record no bootstrap secret in tickets, logs or chat. Change the password on first login.
- [ ] Run the full security/permission suite and E2E tests against production-like synthetic data; perform an independent review of every role, nested ID and file route.
- [ ] Record an encrypted backup, restore it into a second empty database, compare table counts, verify Director login and a learner profile, then securely remove the temporary restore.
- [ ] Verify `/api/health`, TLS/security headers, idle logout, lockout/recovery, file upload/retrieval, monitoring alerts, backups and incident contacts.
- [ ] Keep public access disabled until all checks are signed off. Train staff using synthetic data first; create accounts and admit children only after owner approval.
