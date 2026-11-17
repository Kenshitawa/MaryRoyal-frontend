# Mobile failure report

**INCOMPLETE (3/20 role and viewport collections) mobile audit.** Generated 2026-11-17T06:15:39.733Z. It attempted all 42 inventoried route paths for each of ten roles at 360px and 390px; four mode/style appearances were measured for each authorized rendered route. Access-denied routes were attempted once per role and were not counted as rendered UI. The sole touch-target exception is an inline anchor within a prose paragraph with surrounding sentence text, as documented in docs/DECISIONS.md.

Total findings: **17** across 2 distinct causes. Completed collections: **3/20**.


## Horizontal overflow — 16 (3 unique causes)

- **8 occurrences:** nav.sticky.top-16.z-20 horizontal scroll 1799px inside 334px; chain nav.sticky.top-16.z-20 ← section.mx-auto.max-w-7xl.space-y-6 ← main#main-content.app-main.page-main ← div.app-column ← div.app-shell
  - director /learners/cmwkaebeh000aubesztshthg6 · 360px · light/bento; director /learners/cmwkaebeh000aubesztshthg6 · 360px · dark/bento; director /learners/cmwkaebeh000aubesztshthg6 · 360px · light/glass; director /learners/cmwkaebeh000aubesztshthg6 · 360px · dark/glass; head_teacher /learners/cmwkaebeh000aubesztshthg6 · 360px · light/bento; head_teacher /learners/cmwkaebeh000aubesztshthg6 · 360px · dark/bento; …and 2 more
- **4 occurrences:** div.relative.inline-flex.items-center horizontal scroll 675px inside 326px; chain div.relative.inline-flex.items-center ← div.flex.flex-wrap.items-center ← div.space-y-8 ← section.mx-auto.max-w-7xl.space-y-5 ← main#main-content.app-main.page-main
  - director /reports · 360px · light/bento; director /reports · 360px · dark/bento; director /reports · 360px · light/glass; director /reports · 360px · dark/glass
- **4 occurrences:** nav.sticky.top-16.z-20 horizontal scroll 1617px inside 334px; chain nav.sticky.top-16.z-20 ← section.mx-auto.max-w-7xl.space-y-6 ← main#main-content.app-main.page-main ← div.app-column ← div.app-shell
  - deputy /learners/cmwkaebeh000aubesztshthg6 · 360px · light/bento; deputy /learners/cmwkaebeh000aubesztshthg6 · 360px · dark/bento; deputy /learners/cmwkaebeh000aubesztshthg6 · 360px · light/glass; deputy /learners/cmwkaebeh000aubesztshthg6 · 360px · dark/glass

## Authorized route unavailable — 1 (1 unique causes)

- **1 occurrence:** expected route but was sent to /staff
  - head_teacher /staff/new · 360px · light/bento
