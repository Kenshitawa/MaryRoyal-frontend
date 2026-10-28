# Mary Royal School Management System

A local-first school administration portal for Mary Royal School, Obunga, Kisumu. It supports role-based access for school leaders, staff, families, and learners. Use synthetic records until the remaining security, privacy, and workflow work in [the roadmap](docs/ROADMAP.md) is complete.

## Local setup

Install Node.js 20.9–22 and npm, matching `package.json` engines. Node 24/26 is outside the declared support range; rerun acceptance on Node 22 before release. On Windows use `cmd /c "npm run <script>"` or `npm.cmd` to avoid PowerShell's blocked `npm.ps1`. The first setup needs internet access to install packages. No cloud account or paid service is required.

### Windows (PowerShell)

```powershell
npm run setup
npm run dev
```

### macOS and Linux

```sh
npm run setup
npm run dev
```

Open <http://localhost:3000>. Setup installs dependencies, creates `.env` if needed, generates a local `SESSION_SECRET`, applies the Prisma schema to SQLite, and creates an otherwise empty school with a Director, school identity settings, and CBC grading defaults. Existing local school data is preserved by setup. To explicitly clear it, use `npm run reset:fresh` and type `RESET` at the prompt, or run `npm run reset:fresh -- --yes` when you intend to reset it.

The fresh Director account is `director@maryroyal.ac.ke` with temporary password `MaryRoyal2026!`. The Director must change it at first sign-in.

### Optional synthetic walkthrough data

```sh
npm run seed:demo
npm run dev
```

Every seeded account uses `MaryRoyal2026!` and is prompted to change its password. Demo data is fictional and should be reset before real records are added.

| Role | Email |
|---|---|
| Director | director@maryroyal.ac.ke |
| Head Teacher | headteacher@maryroyal.ac.ke |
| Deputy Head Teacher | deputy@maryroyal.ac.ke |
| Secretary | secretary@maryroyal.ac.ke |
| Accountant | accountant@maryroyal.ac.ke |
| Teacher | teacher@maryroyal.ac.ke |
| Parent | parent@maryroyal.ac.ke |
| Learner | learner@maryroyal.ac.ke |

## Role workflows

- **Director:** manage all accounts; oversee learner, fee, attendance, payroll, assessment, and audit data; approve or release controlled school workflows.
- **Head Teacher:** lead academic work, review/approve admissions and results, approve fee confirmations, and view school finance summaries; cannot create accounts or enter marks.
- **Deputy Head Teacher:** support school-wide attendance and academic operations. The full exam, timetable, library, discipline, and duty workflows are tracked in the roadmap.
- **Secretary:** complete and resume the seven-step admission packet, upload private documents, download/print the admission form, explicitly create learner access or create/link a parent account, search class lists, and view fee structures and learner fee totals/balances. Secretary cannot record payments, access receipts, or view the complaint inbox.
- **Accountant:** create invoices, record and correct payments, issue receipts after approval, and manage finance workflows. Finance-only access excludes grades, discipline, medical notes, and private messages.
- **Teacher:** work with assigned learners/subjects, submit marks, take attendance only when separately assigned as class teacher, create assignments and review submissions, and submit a short teaching log for school-leader confirmation.
- **Parent:** view only linked children, results, attendance, and fee statements; submit and track complaints directed to the Head Teacher, Director, or both.
- **Learner:** view their own learning area and records, submit assignments, access teacher-shared grade-specific resources, and play the practice games.

Learner and parent logins are not created automatically at admission. The Secretary or Director can explicitly create learner access and create or link parent access from the completed admission. Existing parents are matched by phone/ID where available. New temporary passwords are shown once and must be changed at first sign-in; pending admissions keep new accounts suspended until Head Teacher approval.

## Commands

- `npm run setup` — install, apply local schema, create Director and school defaults; local only
- `npm run seed:demo` — optional synthetic data; never use on production or the cleaned development database
- `npm run reset:fresh` — destructive local reset; requires explicit intent. `-- --demo-only` verifies the original thirty seed learners and preserves Director/non-demo accounts, credentials, defaults and uploads. Do not repeat it on the now-empty development database.
- `npm run dev` — run the local development server
- `npm run build` — SQLite-schema application build
- `npm run build:production` — PostgreSQL-schema application build; does not apply migrations or establish release readiness
- `npm run lint` — ESLint with zero-warning gate
- `npm run typecheck` — strict TypeScript check
- `npm test` — Vitest unit suite
- `npm run test:e2e` — reset/seed only the dedicated isolated test database, build and run Playwright; never overlaps lint/typecheck/build
- `npm run backup:sqlite` — local SQLite copy into ignored `backups/`
- `npm run backup` — encrypted PostgreSQL backup; separately authorized target/configuration required
- `npm run restore:postgres` — restore into a separately approved empty non-production PostgreSQL database; explicit confirmation required

## Backup restore

For local SQLite recovery, stop the app, preserve the current database, then restore the explicitly selected backup and verify it locally. Never use this procedure for production. PostgreSQL recovery and private-file preservation require the separate approved rehearsal in [owner actions](docs/OWNER_ACTIONS.md). Backups contain children’s information; restrict access, protect encryption keys separately, and never commit them.

The 2026-10-28 local demo-only cleanup retained the Director and a non-demo Parent with unchanged credentials/defaults and uploaded files; no demo school records remain. Production data and deployment were untouched.

## Current status

This remains a local prototype, not a school-ready production system. Important incomplete modules and security limits are listed in [docs/ROADMAP.md](docs/ROADMAP.md). No deployment is performed.

## Production deployment preparation

The app now has a PostgreSQL schema/migration path, a one-time Director bootstrap, a database health endpoint, and private Supabase Storage support. Read [the production deployment guide](docs/DEPLOYMENT_GUIDE.md) before deploying. Choose one host for the **whole Next.js app** (Vercel or Render); it is not a separately deployable frontend and backend. `MaryRoyal-frontend` is the canonical complete app checkout for deployment; `MaryRoyal-Baclend` remains a backend source snapshot and must not be deployed separately. Production setup still requires your own Supabase project, secrets, private storage bucket and legal/privacy sign-off. The remaining app-security and workflow gaps in the roadmap mean this is not yet cleared for real learner data.

## Frontend/backend repository layout

The application currently runs as one Next.js full-stack project. Next.js requires its UI and API route handlers in the same App Router source tree. The deployable copy therefore includes UI and server code in one repository; the separate backend repository is a source reference until a standalone service extraction is completed. See `docs/DECISIONS.md` for the repository split decision.
