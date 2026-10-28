# Mobile failure report

**Complete mobile audit.** Generated 2026-10-28T12:08:22.510Z. It attempted all 29 inventoried route paths for each of ten roles at 360px and 390px; four mode/style appearances were measured for each authorized rendered route. Access-denied routes were attempted once per role and were not counted as rendered UI. The sole touch-target exception is an inline anchor within a prose paragraph with surrounding sentence text, as documented in docs/DECISIONS.md.

Total findings: **115** across 7 distinct causes. Completed collections: **20/20**.


## Text below allowed sizes — 48 (6 unique causes)

- **8 occurrences:** b “M-PESA” 13.0px (minimum 14px)
  - parent /portal · 360px · light/bento; parent /portal · 360px · dark/bento; parent /portal · 360px · light/glass; parent /portal · 360px · dark/glass; parent /portal · 390px · light/bento; parent /portal · 390px · dark/bento; …and 2 more
- **8 occurrences:** b “Lipa na M-PESA” 13.0px (minimum 14px)
  - parent /portal · 360px · light/bento; parent /portal · 360px · dark/bento; parent /portal · 360px · light/glass; parent /portal · 360px · dark/glass; parent /portal · 390px · light/bento; parent /portal · 390px · dark/bento; …and 2 more
- **8 occurrences:** b “Paybill” 13.0px (minimum 14px)
  - parent /portal · 360px · light/bento; parent /portal · 360px · dark/bento; parent /portal · 360px · light/glass; parent /portal · 360px · dark/glass; parent /portal · 390px · light/bento; parent /portal · 390px · dark/bento; …and 2 more
- **8 occurrences:** b.font-mono “522123” 13.0px (minimum 14px)
  - parent /portal · 360px · light/bento; parent /portal · 360px · dark/bento; parent /portal · 360px · light/glass; parent /portal · 360px · dark/glass; parent /portal · 390px · light/bento; parent /portal · 390px · dark/bento; …and 2 more
- **8 occurrences:** b.font-mono “MR-2026-001” 13.0px (minimum 14px)
  - parent /portal · 360px · light/bento; parent /portal · 360px · dark/bento; parent /portal · 360px · light/glass; parent /portal · 360px · dark/glass; parent /portal · 390px · light/bento; parent /portal · 390px · dark/bento; …and 2 more
- **8 occurrences:** b “Send” 13.0px (minimum 14px)
  - parent /portal · 360px · light/bento; parent /portal · 360px · dark/bento; parent /portal · 360px · light/glass; parent /portal · 360px · dark/glass; parent /portal · 390px · light/bento; parent /portal · 390px · dark/bento; …and 2 more

## Route authorization — 25 (1 unique causes)

- **25 occurrences:** restricted route remained accessible to this role
  - accountant /welfare · 360px · light/bento; learner /portal · 360px · light/bento; head_teacher /accounts · 390px · light/bento; secretary /accounts · 390px · light/bento; accountant /welfare · 390px · light/bento; teacher /staff/new · 390px · light/bento; …and 19 more

## Page landmarks and headings — 16 (2 unique causes)

- **8 occurrences:** found 0 visible <h1> headings
  - teacher /attendance · 360px · light/bento; teacher /attendance · 360px · dark/bento; teacher /attendance · 360px · light/glass; teacher /attendance · 360px · dark/glass; teacher /attendance · 390px · light/bento; teacher /attendance · 390px · dark/bento; …and 2 more
- **8 occurrences:** found 2 visible <h1> headings
  - learner /learning · 360px · light/bento; learner /learning · 360px · dark/bento; learner /learning · 360px · light/glass; learner /learning · 360px · dark/glass; learner /learning · 390px · light/bento; learner /learning · 390px · dark/bento; …and 2 more

## Controls without accessible names — 8 (1 unique causes)

- **8 occurrences:** input.mt-1.min-h-11.w-full has no accessible name
  - teacher /assessments · 360px · light/bento; teacher /assessments · 360px · dark/bento; teacher /assessments · 360px · light/glass; teacher /assessments · 360px · dark/glass; teacher /assessments · 390px · light/bento; teacher /assessments · 390px · dark/bento; …and 2 more

## WCAG text contrast — 8 (2 unique causes)

- **4 occurrences:** .bg-purple-700: Fix any of the following: Element has insufficient color contrast of 2.52 (foreground color: #0f172a, background color: #8200db, font size: 10.5pt (14px), font weight: normal). Exp
  - teacher /schemes · 360px · light/bento; teacher /schemes · 360px · light/glass; teacher /schemes · 390px · light/bento; teacher /schemes · 390px · light/glass
- **4 occurrences:** .min-h-11: Fix any of the following: Element has insufficient color contrast of 1.15 (foreground color: #162456, background color: #111c2e, font size: 9.8pt (13px), font weight: normal). Expe
  - parent /portal · 360px · dark/bento; parent /portal · 360px · dark/glass; parent /portal · 390px · dark/bento; parent /portal · 390px · dark/glass

## Failed requests — 8 (1 unique causes)

- **8 occurrences:** GET /api/accounts HTTP 403
  - welfare_chair /welfare · 360px · light/bento; welfare_chair /welfare · 360px · dark/bento; welfare_chair /welfare · 360px · light/glass; welfare_chair /welfare · 360px · dark/glass; welfare_chair /welfare · 390px · light/bento; welfare_chair /welfare · 390px · dark/bento; …and 2 more

## Authorized route unavailable — 2 (1 unique causes)

- **2 occurrences:** expected route but was sent to /dashboard
  - head_teacher /reports · 360px · light/bento; head_teacher /reports · 390px · light/bento
