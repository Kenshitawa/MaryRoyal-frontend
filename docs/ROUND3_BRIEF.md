# Round 3 delivery brief

The original requested `docs/ROUND3_BRIEF.md` was not present when this work began. The authoritative requirements are the user's Round 3 request in this task. This file records the execution order and release constraints; it does not replace that request.

1. Repair staff pages and their additive schema migrations.
2. Simplify the mobile header and profile sheet.
3. Improve mobile bottom navigation and accessibility.
4. Measure and improve performance.
5. Audit every role's pages at phone widths and simplify layouts.
6. Fix every lint warning without disabling rules.
7. Run local verification only.
8. Deploy only after all checks pass, with Git, configuration, additive migration and verified-backup gates.

Never test, seed, reset or migrate the production database during local development. Keep credentials and connection values out of source, logs and replies.
