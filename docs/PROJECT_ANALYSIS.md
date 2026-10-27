# Project analysis

## Initial state
The workspace was empty: no source code, Git history, package manifest, or existing database.

## Stack and structure
Next.js App Router with strict TypeScript, Tailwind, Prisma (SQLite local / PostgreSQL deployment), credentials sessions, Zod, Vitest and Playwright. `src/app` contains routes, `src/lib` shared security and domain logic, `prisma` schema/seed, `docs` project decisions and guides, `public` static assets.

## Core data model plan
User + role grants; learner profile; guardian-to-learner links; academic year/term/class/stream/subject; teacher assignments; attendance; assessment and version history; report card approval/release; fee structure/invoice/payment/version history/receipt; audit event; timetable, discipline, notices, lesson plans and homework. People are archived rather than hard deleted when history exists. Scope relationships are explicit.

## Execution plan
Phase 0 establish rules/docs. Then establish authentication, role matrix, dashboard shell and audit; add academic records and attendance; assessment and controlled release; finance with immutable receipt references; operations; role portals and analytics; final security and quality pass. Due to the empty starting point and turn budget, this is an incremental roadmap: do not describe unimplemented modules as complete.
