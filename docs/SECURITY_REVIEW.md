# Security review — 2026-10-27

This is a code and configuration review, not a penetration test or a certification. Live Supabase, Vercel, and Render access was not available from the repository, so hosted controls below remain unverified.

## Findings and status

| Area | Finding | Status |
|---|---|---|
| PostgreSQL Data API | The initial PostgreSQL migration did not enable RLS or revoke Supabase `anon`/`authenticated` grants. | **Code fix added:** migration `0002_lock_down_public_api` enables RLS for each current `public` table and revokes schema/table/sequence access from `PUBLIC`, `anon`, and `authenticated`; default grants are revoked for future objects. Must apply to the target database and run `npm run security:check-supabase`. |
| Server-side data path | Prisma access is implemented in server modules and route handlers; no browser Prisma client is used. | Code inspection only; build/deployment still needs verification. |
| Object storage | Uploads use private storage configured with a server-only service-role key, and reads are served through authenticated application routes. | Keep the bucket private and verify all routes and file scopes on the deployed service. Current implementation proxies bytes after authorization rather than issuing expiring signed URLs. |
| Bootstrap | `bootstrap:director` requires a one-time environment token, refuses to create an account if any user already exists, validates a strong temporary password, and forces a password change. | Code fix added. The token/password must be temporary and supplied only through a trusted command environment. |
| Environment validation | Production startup validates PostgreSQL runtime URL, session secret, and storage-driver configuration without printing secret values. | Code fix added; verify deployment environment by starting a disposable production service. |
| Sessions and login defense | Signed HTTP-only session cookies, 10-minute idle activity token, login lockout and security headers exist. | **Medium/high operational gap:** login throttling is process-local and is not reliable across multiple instances; no durable session revocation/sign-out-all-devices. Verify cookie flags, CSRF protection, proxy IP trust, and session invalidation in a dedicated review. |
| Authorization/IDOR | Central permission matrix and selected role/IDOR tests exist. | **Open high-risk gap:** tests do not cover every route, action, nested ID, health record and file download. No claim of exhaustive authorization coverage. |
| Uploads | MIME/signature and size checks exist for selected paths; generic assignment upload is capped at 4 MiB. | Review each upload/download endpoint, archive/decompression behavior, storage replacement and malware handling before production. |
| Audit log | Application actions write audit events. | **Code fix added:** migration `0003_append_only_audit` rejects row update/delete and table truncate. Must apply and verify on Supabase; a superuser can still disable triggers, so operational admin access must be tightly controlled. Full audit completeness reconciliation remains open. |
| Dependency and secret scans | Production dependency audit and `npm run security:scan-history` were run in this pass. | Production dependencies: 0 advisories. Git history/current tracked files: 0 matches for scanned key/connection/private-key patterns. This is not a complete secret scanner; local ignored `.env` was not read or reported. |
| Privacy and retention | Privacy notice, admission consent timestamp, Director-only audited JSON learner export, and dry-run-first abandoned-draft retention script exist. | **Open high-risk gap:** no anonymization/deletion workflow, no in-app request tracking, no complete file bundle, and no approved complete record-class schedule or retention run. |
| Backup/recovery | Encrypted PostgreSQL backup and guarded empty-target restore scripts/runbook added. | **Open high risk:** no `pg_dump`/`pg_restore` executable or production DB credentials were present, so backup, restore, row-count comparison and post-restore login/profile checks have not run. |

## RLS deployment verification

1. Apply production migrations against an empty test Supabase project using the direct migration URL.
2. Run `npm run security:check-supabase` with the runtime PostgreSQL URL, project URL, and publishable/anon key in the trusted environment.
3. Require the command to report every public table as RLS-enabled, no `anon` or `authenticated` table privileges, and denied publishable-key Data API reads.
4. Confirm normal application DB operations work through the server-side runtime connection.

Until all high/medium findings are fixed and the production checks are actually run, do not store real student data.
