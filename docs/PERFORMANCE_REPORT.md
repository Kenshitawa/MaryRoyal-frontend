# Mary Royal SMS — Performance Report (Mobile First)

## Method

- **Build**: production Next.js build served by `next start` (`npm run build:e2e`, `.next-e2e`), not the development compiler.
- **Data**: isolated local E2E database (`round3-e2e.test.db`), demo seed. No production data or production host was used.
- **Tooling**: `scripts/measure-performance.mjs` drives Chromium through the DevTools protocol.
- **Viewport**: 390×844, touch enabled, mobile user agent.
- **Network**: CDP Fast 4G — 150 ms RTT, 1.6 Mbps down, 750 kbps up.
- **CPU**: CDP `Emulation.setCPUThrottlingRate: 4` (mid-tier Android).
- **Measured**: time to `domcontentloaded` for a cold visit and a repeat visit, LCP via `PerformanceObserver`, CLS via `PerformanceObserver`, and the sum of JavaScript response bodies observed during the cold visit.

## Before and after (same script, same viewport and throttling)

| Page | First visit before (ms) | First visit after (ms) | Repeat before (ms) | Repeat after (ms) | LCP after (ms) | CLS after | JS body after (KB) |
|---|---|---|---|---|---|---|---|
| Dashboard `/dashboard` | 2,451 | **851** | 1,113 | 1,015 | 1,144 | 0.000 | 446 |
| Learners `/learners` | 967 | 876 | 869 | 1,751 | 1,088 | 0.000 | 689 |
| Learner profile `/learners/[id]` | 2,841 | **1,135** | 3,020 | 1,475 | 2,228 | 0.000 | 683 |
| Attendance `/attendance` | 1,052 | 660 | 923 | 571 | 1,004 | 0.000 | 708 |
| Marks `/assessments` | 1,051 | 425 | 842 | 591 | 512 | 0.097 | 718 |
| Invoices `/finance` | 1,052 | 796 | 806 | 1,414 | 1,040 | 0.000 | 683 |
| Payments `/finance?tab=payments` | 996 | 508 | 1,047 | 827 | 708 | 0.000 | 683 |
| Staff directory `/staff` | 1,002 | 691 | 903 | 749 | 1,172 | 0.000 | 683 |
| Parent portal `/portal` | 3,865 | **926** | 957 | 801 | 926 | 0.000 | 28* |

\* The parent-portal JavaScript counter attaches to its own page after navigation starts, so its byte count is not comparable with the director rows. It is retained for regression tracking, not as a size claim.

Readings are single-run and network-emulated; repeat timings move by a few hundred milliseconds between runs (learners and invoices were slower on the repeat in this run, and the dashboard and parent portal improved most). The numbers that matter for the brief — parent portal and learner profile cold loads — fell by roughly 76% and 60%. CLS is 0 on every page except assessments (0.097, from the mark-entry grid settling), still under the 0.1 threshold.

## What changed

1. **Parallel server data fetching** — the dashboard, parent portal and learner profile resolve their independent queries in a single `Promise.all()` instead of serial awaits.
2. **Route-level skeleton** — `src/app/(portal)/loading.tsx` paints the blue header and KPI skeleton immediately on navigation; `src/app/(portal)/staff/loading.tsx` covers the staff section. No blank frame between tap and content.
3. **Navigation** — workspace navigation, mobile tabs and the More sheet retain Next.js links. Learner names, admission numbers, chips and register profile actions now use normal authenticated document navigation: disabling prefetch did not resolve the observed profile-click stall. The six role/viewport development-browser regressions passed; the rebuilt production-mode suite remains the acceptance gate.
4. **PWA** — `public/manifest.webmanifest`, `public/sw.js` and `public/offline.html` are registered over HTTP(S). The worker caches only approved public branding and versioned Next.js static chunks. Authenticated documents always use the network, with a generic offline page on failure; APIs and private uploads are never intercepted or cached. Old school caches are purged. Five worker unit tests pass; deployed offline behavior is not verified.
5. **Mobile rendering** — backdrop blur is disabled below 640px, inputs are 16px to prevent iOS zoom, and lists render as cards instead of wide tables.
6. **Database** — one shared `PrismaClient` (`src/lib/db.ts`, global singleton in development), 74 `@@index` declarations across hot relations (learner, guardian, invoice, payment, assessment, attendance, timetable, audit), and relation fields with explicit foreign keys. No unbounded per-row queries were added in this pass.
7. **Performance budget** — `npm run budget:check` (`scripts/check-perf-budget.ts`) checks both App Router and build manifests, deduplicates shared/root/portal JavaScript, and enforces the unchanged 250 KiB route-own and 350 KiB shared limits using uncompressed file sizes. Remeasured on the 2026-10-28 production build (117 App Router entries): **shared JavaScript 441.6 KiB — fails the 350 KiB limit**; the largest route-own allocation is 189.7 KiB, inside 250 KiB. Attribution of the nine shared files: `react-dom` 169.0 KiB and the Next.js App Router/RSC client runtime 170.1 KiB — 339.1 KiB of framework code before any application JavaScript — then root layout 12.4, shared icon set 12.3, two vendor chunks 13.3 and 8.3, webpack runtime 3.4, `main-app` 0.5 and the application portal shell 52.2 KiB. Removing the entire portal shell would still leave 389.4 KiB, so the 350 KiB shared limit sits below the framework floor for Next.js 15 App Router with React 19 and cannot be reached by application changes. The threshold, the raw-size accounting and the failing exit code are left untouched; this stays an open release blocker that needs an owner decision, not a passed gate. The earlier claim that both limits passed came from incomplete manifest accounting and is withdrawn. Cold-visit bytes above include shared runtime and prefetched chunks, so they are not the route-own budget metric.

## Known limits

- These numbers come from a local production build over an emulated network. They do not measure the Kenyan mobile carrier path, DNS, or TLS setup of a real deployment.
- The largest remaining cold-load cost is the shared React/Next runtime; reducing it further needs a deliberate bundle-splitting pass, not a CSS change.
- CLS was measured on the seat/mark grid only; other dynamic lists showed 0 in this run.
