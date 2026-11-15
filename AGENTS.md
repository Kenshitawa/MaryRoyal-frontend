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

<!-- boardui:rules:start -->
# BoardUI design rules

This project uses BoardUI (React + Tailwind CSS v4, source-owned components under `components/`). These rules always apply when writing UI code. MCP tools are on demand; these rules are not optional context.

## Components first

- Before hand-building any UI element, check for an installed BoardUI component under `components/base/` and `components/application/`, and prefer it.
- Missing a component? Install it (BoardUI MCP `install_components`, or `npx boardui@latest add <name>`) instead of writing a lookalike.
- Import through the `@/` alias, e.g. `import { Button } from "@/components/base/buttons/button"`.

## Color: semantic tokens only

- Never use raw palette classes (`text-gray-500`, `bg-white`, `border-neutral-200`) or hex/oklch literals. Every color rides a BoardUI semantic token, which also makes dark mode automatic.
- Text: `text-text-primary`, `text-text-secondary`, `text-text-tertiary`, `text-text-placeholder`, errors `text-text-error-primary`.
- Surfaces: `bg-background-primary-default`, `bg-background-secondary-default` / `-hover`, `bg-background-tertiary-default`, page ground `bg-background-full`.
- Borders: `border-border-button-default` / `-hover`, hairlines `border-separator-border`, tables `border-border-table`, errors `border-border-error-default`.
- Icons: `text-foreground-icon-primary` through `text-foreground-icon-quaternary`.
- Charts: the `chart-1` … `chart-5` tokens (plus `-active` variants). CTAs and selection states: the `accent-50` … `accent-950` ramp.
- Dark mode flips tokens via the `.dark` class on `<html>`. Do not write `dark:` overrides with raw colors; if a token pair looks wrong in dark mode, pick a different token, not a literal.

## Typography: composite utilities only

- Use BoardUI's composite type utilities: `text-title-1-medium`, `text-title-2-medium`, `text-title-3-semibold`, `text-headline-medium`, `text-body-medium`, `text-body-regular`, `text-body-2-*`, `text-caption-1-semibold`, and friends. Each sets size, weight, line-height, and letter-spacing together.
- Never rebuild type by stacking `text-sm font-medium leading-5`; if a style seems missing, look in `styles/typography.css` before inventing one.

## Spacing and shape

- Stay on Tailwind's spacing scale (`gap-2`, `p-4`, `mt-6`); prefer flex/grid `gap` over per-child margins. Arbitrary values (`p-[13px]`) only when matching an existing BoardUI component exactly.
- Cards and panels: `rounded-3xl` with `border-border-button-default`. Inputs and menu rows: `rounded-md` to `rounded-xl`. Pills: `rounded-full`.

## Mechanics

- Direction: wrap the app (or a mixed-language region) in `DirectionProvider` from `@/components/foundations/direction/direction`, with an explicit BCP 47 `locale` (`ar`, `he`, `en-US`, `zh-CN`). Set matching `lang` and `dir` on `<html>` for full-app RTL. CSS `dir` alone does not configure React Aria keyboard navigation or portal placement. Use `useDirection()` for custom interactions and put its value on custom portal roots.
- Use logical styles: `ms`/`me`, `ps`/`pe`, `start`/`end`, `text-start`/`text-end`, `border-s`/`border-e`, `rounded-s`/`rounded-e`, and inline logical CSS properties. Mirror navigation/disclosure glyphs and horizontal drawer motion in RTL. Preserve physical coordinates for measured geometry, charts, canvas, and decorative art. Keep code, OTP digits, email addresses and URLs in explicit LTR regions; isolate mixed text with `<bdi>` or `dir="auto"`. Translating labels and formatting application data is separate from layout direction. See https://www.boardui.com/rtl.

- Internal vertical scroll regions must soften the top edge with a progressive blur and surface fade once scrolled, rather than sharply clipping content. Keep headers outside the scroll region. Use a stationary, `pointer-events-none`, `aria-hidden` overlay in a relative wrapper: a 24px masked 1px backdrop blur, a 16px masked 4px backdrop blur, and a gradient from the enclosing semantic surface token to transparent. Ramp each layer's opacity from 0 to 1 over the first 24px of scrolling; keep it invisible at scrollTop 0. Apply opacity to the individual layers, never the overlay parent (a translucent parent creates a backdrop root and can break blur at normal browser zoom). Verify top/reset, overflow, light/dark mode, and 100% zoom; preserve keyboard scrolling and do not blur the whole content area. The `scroll-fade` registry item ships this recipe as `ScrollFade` + `useScrollFade` (`@/components/foundations/scroll-fade/scroll-fade`); reuse it rather than rebuilding the layers.

- Merge classes with `cx()` from `@/utils/cx` (tailwind-merge aware of BoardUI's composite text styles). No string concatenation, no plain `clsx`.
- Icons come from `@remixicon/react`, passed as component references (`leadingIcon={RiAddLine}`), not rendered elements.
- Form components build on `react-aria-components`; extend the installed BoardUI form components rather than raw `<input>`/`<select>`.
- Focus states: `outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring`.

When unsure about a token, a component's API, or working example code, ask the BoardUI MCP server: `get_theme`, `get_component`, `get_usage_examples`.
<!-- boardui:rules:end -->
