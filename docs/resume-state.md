# Resume State — `feat/multi-tenant-core`

Recorded: 2026-11-10 (local Windows machine). Repository root: `D:\main_system\SMS`.

## Branch and history

- Branch: `feat/multi-tenant-core` (not `main`; no merge performed).
- Recent commits:
  - `4756a5a` feat: implement multi-tenant schema, PostgreSQL RLS policies, and tenant isolation tests (Phase 2)
  - `8fdf57b` docs: complete Phase 1 codebase analysis and multi-tenant transition plan
  - `faf23e2` feat: redesign admission forms as single-page document with centered logo header and professional footer
  - `b201c42` feat: redesign admission slip and dossier forms with executive branding and professional layout
  - `c7433e8` docs: record Vercel production deployment verification for ce1fb3b

## Uncommitted / untracked files found at resume

Modified (all left in place, none discarded or reset):

| File | Assessment at resume |
|---|---|
| `middleware.ts` | **Half-done and broken for production.** It imported `@/lib/tenant`, which imports Prisma, into Edge middleware. It introduced `school_session`/`school_activity` and platform routes, but accepted a spoofable `?school=` and `current_school_slug` cookie before host resolution, and mixed legacy `mary_*` cookies indefinitely. No host/session tenant match check. |
| `src/app/api/login/route.ts` | **Half-done.** Tenant-aware login and legacy cookie dual-write were added, but only email login (no username/phone), no 2FA, and `x-school-slug` was trusted from the request. |
| `src/app/layout.tsx` | **Half-done.** Added dynamic metadata, tenant CSS variables and `TenantProvider`, but injected raw colour strings from the database into a `<style>` tag without validation, and imported both the tenant loader (Prisma) and `headers()` into a root layout rendered for every route. |
| `src/app/page.tsx` | **Half-done.** Branding replaced with tenant values; default fallback object did not satisfy `TenantConfig` (missing `contactEmail`/`contactPhone`/`poBox`). |
| `src/app/not-found.tsx` | **Finished but hardcodes** “School Portal” instead of tenant name (no request context available; acceptable once a tenant 404 page exists). |
| `src/components/confirm-logout-form.tsx` | **Finished** client-side tenant name substitution. |
| `src/components/dashboard-header.tsx` | **Finished** client-side tenant brand substitution. |
| `src/components/ui/page-shell.tsx` | **Finished** client-side tenant branding; still imports `Image` unoptimised logo paths. |
| `src/lib/session.ts` | **Half-done.** Added `schoolId` to school sessions and Super Admin JWT helpers; defaults every old token to the demo tenant (unsafe if a legacy cookie is replayed on another tenant), no 2FA claim, no session version. |
| `src/components/tenant-provider.tsx` (untracked) | **Finished** context provider, but hardcoded demo defaults. |
| `src/lib/tenant.ts` (untracked) | **Half-done.** Host parser and 60s in-memory cache, but imports Prisma at module top (Edge-unsafe), maps `demo.*` to `maryroyal`, accepts arbitrary slugs and returns `null` without a 404/suspended rendering path. |

Unfinished work from the cut-off implementation run: Phase 2 changed unique keys to `[schoolId, …]` in both Prisma schemas but did not update application callers. Type-check exposed 15 call sites.

## Checks at resume

| Check | Result |
|---|---|
| `npm run lint` (`eslint . --max-warnings 0`) | **Pass** — 0 errors, 0 warnings |
| `npm run typecheck` (`tsc --noEmit`) | **Fail** — 15 errors: `User.email`, `SchoolSetting.key`, `ClassTeacherAssignment.grade`, `AdmissionDraft.admissionNo` unique lookups still used pre-Phase-2 keys in e2e/scripts, staff routes, attendance, learner login, admissions page/settings. |
| `npm test` (`vitest run`) | **Pass** — 16 files, 79 tests |
| `npm run test:e2e` | Not run at resume (requires a dev server / test database) |

## Remediation applied before Phase 3

- Added `src/lib/tenant-constants.ts` (demo tenant identifiers, no Prisma import).
- Added `src/lib/auth.ts` (signed school-session actor resolution, deny-by-default permission helpers).
- Fixed every type-check error forward by scoping compound unique lookups to `schoolId`; no uncommitted work was discarded.
- Added explicit `schoolId` to staff/learner account creation paths touched by those fixes.

## Repository observations

- Stack: Next.js 15.5.6 App Router, React 19, strict TypeScript, Tailwind v4, Prisma 6.19 (SQLite locally, PostgreSQL/Supabase production), Zod 4, `jose`, `bcryptjs`, Vitest 5, Playwright.
- 59 models, 58 tenant-scoped tables plus `School`, `SchoolPaymentConfig`, `SuperAdmin`. Every tenant table has `schoolId` and an index; PostgreSQL RLS migration `0007_multi_tenant_rls` exists.
- Demo tenant id: `school_demo_mary_royal`, slug: `maryroyal`.
- Existing roles: `DIRECTOR`, `HEAD_TEACHER`, `DEPUTY`, `SECRETARY`, `ACCOUNTANT`, `TEACHER`, `WELFARE_CHAIR`, `NON_TEACHING_STAFF`, `PARENT`, `LEARNER`. Platform `SuperAdmin` is a separate table. “Staff” in the brief maps to `NON_TEACHING_STAFF`; `WELFARE_CHAIR` remains because it is part of the Mary Royal template.
- Hardcoded “Mary Royal” strings remain in PDF generators, `public/manifest.webmanifest`, `public/logo.svg`, the mobile nav, change-password/privacy pages, receipt verification URL and payment guide. These are tracked in `docs/analysis.md` §6 and are replaced or parameterised during Phases 3–6.
- Security debt inherited from the single-tenant app: bcrypt cost 12 (acceptable but not argon2id), no 2FA, in-memory rate-limit buckets, no CSP/security headers, tenant scoping missing from most API queries, `AuditEvent` writes do not always carry `schoolId`.
