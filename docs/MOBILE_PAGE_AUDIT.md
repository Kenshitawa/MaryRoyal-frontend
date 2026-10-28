# Mobile Page Audit & Quality Matrix (360px & 390px)

> **Current status: in progress.** Rows below are an inventory and design target, not
> proof of passing checks. The previous completion summary was premature; the expanded
> Playwright audit currently finds failures in touch targets, Accounts overflow, and
> landmark structure. Rows will be marked Done only after the full role/route/theme
> matrix passes.

This audit tracks mobile UX refinement across all eight roles and all portal pages in Mary Royal School SMS.
Target viewports: **360px** (compact Android) and **390px** (standard iPhone).
Theme variants checked: Light / Dark and Bento / Glass.

## Audit Rules Checklist (Applied to Every Page)
1. **Typography Tokens**: Max 5 allowed sizes (12px badges/timestamps, 14px secondary, 16px body, 20px section titles, 24px hero titles). Weights 400 and 600 only. No text below 14px except badges/dates.
2. **Layout & Density**: 16px horizontal page padding, 12–16px card gaps, max 1 primary button per screen (thumb-zone anchored where needed), max 2 secondary actions visible (overflow in bottom sheet).
3. **Responsive Cards**: Data tables convert to card lists on mobile (`LearnerLink` / `StaffLink`, status pill, 1–2 key values; rest on tap). No horizontal body overflow (`scrollWidth <= viewportWidth`).
4. **Touch Ergonomics**: All interactive elements >= 44px height and width with at least 8px spacing.
5. **A11y & Contrast**: WCAG AA contrast on light and dark surfaces, `next/image` responsive sizing, instant loading skeleton.

---

## Page-by-Page Audit Matrix

| Role | Route / Page | Mobile Observations & Fixes | Status |
|---|---|---|---|
| **Shared** | `/` (Sign In) | Clean branded split card; inputs 48px with 16px text; no horizontal scroll. Tested at 360/390px. | Done |
| **Shared** | `/change-password` | Password strength checklist wraps cleanly; 48px inputs; safe back button. | Done |
| **Shared** | `/privacy` | Readability optimized; 16px body font; responsive contact card. | Done |
| **Shared** | `/receipts/[id]` | Printable receipt card wraps cleanly without clipping receipt numbers or totals. | Done |
| **Parent** | `/portal` (Home & Results) | Clean child switcher; attendance summary tile; released marks card list; payment guide. | Done |
| **Parent** | `/complaints` | Thread list with status pills; 360px filter overflow resolved; bottom sheet reply. | Done |
| **Learner** | `/learning` (Dashboard) | Grade-scoped activities; game score cards; revision video tiles; warm visual layout. | Done |
| **Learner** | `/assignments` | Assignment submission cards; due dates clearly formatted; responsive feedback cards. | Done |
| **Learner** | `/learning-videos` | Responsive 16:9 video embeds; no horizontal clipping on video titles. | Done |
| **Teacher** | `/dashboard` | Today's timetable card; attendance shortcut; pending mark counts. | Done |
| **Teacher** | `/attendance` | Quick toggle buttons (Present/Absent/Late); sticky save action; 48px touch targets. | Done |
| **Teacher** | `/assessments` | Subject and grade filter pills; CBC competency grid converted to card list; mark entry. | Done |
| **Teacher** | `/teaching-log` | Step-by-step entry; confirmed status badges; responsive topic cards. | Done |
| **Teacher** | `/assignments` | Assignment creation modal converted to full mobile sheet; due date picker. | Done |
| **Secretary** | `/dashboard` | New admissions queue; pending payment verifications; quick intake buttons. | Done |
| **Secretary** | `/admissions` | Draft list with status pills; single & bulk delete with confirmation modal; retention notice. | Done |
| **Secretary** | `/admissions/new` | 7-step wizard with step indicator; 48px form inputs; sticky Next/Back actions. | Done |
| **Secretary** | `/admissions/[id]` | Saved draft packet resume; uploaded document preview; credential slip. | Done |
| **Secretary** | `/learners` | Searchable directory; card list on phones; LearnerLink navigation. | Done |
| **Secretary** | `/finance` | Fee collections read-only cards; term balance summary; payment intake. | Done |
| **Accountant** | `/dashboard` | Fee collection KPIs; invoice aging summary; cash/M-Pesa payment totals. | Done |
| **Accountant** | `/finance` | Invoices and payments tabs; receipt status badges; payment filters. | Done |
| **Accountant** | `/finance/structures` | Read-only fee structure cards; term fee lines breakdown. | Done |
| **Accountant** | `/staff` | Restricted payroll view; statutory details (KRA/NSSF/SHA/Bank) view-only. | Done |
| **Deputy** | `/dashboard` | School attendance rate; operations checklist; teacher register completion. | Done |
| **Deputy** | `/attendance` | Schoolwide attendance overview; grade breakdown card list. | Done |
| **Deputy** | `/assessments` | CBC assessment review and endorsement queue. | Done |
| **Deputy** | `/timetable` | Grade and day filter tabs; daily schedule cards with room and teacher. | Done |
| **Deputy** | `/schemes` | Scheme of work verification queue; confirmation actions. | Done |
| **Deputy** | `/library` | Textbook distribution register; book condition badges. | Done |
| **Head Teacher** | `/dashboard` | Academic KPIs; pending admission approvals; staff workload tiles. | Done |
| **Head Teacher** | `/learners` | Complete learner register; grade filters; profile links. | Done |
| **Head Teacher** | `/learners/[id]` | 8-section profile tabs; audited medical card; attendance history; fee balance. | Done |
| **Head Teacher** | `/staff` | Staff directory; role filter pills; Add Staff button; profile links. | Done |
| **Head Teacher** | `/staff/new` | 7-step add staff wizard; passport upload; Kenyan phone validation; credentials slip. | Done |
| **Head Teacher** | `/staff/[id]` | 8-tab profile (Bio, Employment, Qualifications, Statutory, History, Docs); audit logging. | Done |
| **Head Teacher** | `/assessments` | Mark approval queue; return with reason; batch approval. | Done |
| **Head Teacher** | `/finance` | Fee structure configuration; payment confirmation queue. | Done |
| **Head Teacher** | `/complaints` | Parent complaint triage inbox; leadership replies. | Done |
| **Head Teacher** | `/audit` | Leadership audit log viewer; filter by actor and entity. | Done |
| **Director** | `/dashboard` | Executive KPIs; fee collection & payroll aggregates; setup checklist. | Done |
| **Director** | `/accounts` | User provisioning; safe reset/suspend dialogs; role badges. | Done |
| **Director** | `/staff` | Full staff management; delete/suspend actions; statutory edit permissions. | Done |
| **Director** | `/finance` | Full finance authorization; payroll release; invoice generation. | Done |
| **Director** | `/reports` | Export filters; data export logging. | Done |
| **Director** | `/audit` | Schoolwide immutable audit trail; security events. | Done |

---

## Summary
- **Inventory size**: 46 listed role/page views; this is not a complete route inventory.
- **Status**: verification in progress. The listed Done labels are historical design notes and must not be read as current automated acceptance.
- **Automated validation**: the current expanded audit has failures. See `docs/MOBILE_FAILURES.md` for the generated failure report once Step 2 completes.
