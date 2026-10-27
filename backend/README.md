# Backend source map

The active backend is part of the Next.js application. Route handlers live under `../src/app/api`; authorization and permission scopes are centralized in `../src/lib/permissions.ts`; session/auth code and feature rules are in `../src/lib`; the Prisma schema and migrations are in `../prisma`.

This folder intentionally contains no duplicate route implementation. Next.js requires App Router handlers to remain under `src/app/api`. A standalone backend repository requires a deliberate API-service extraction and frontend API-base configuration before it can be uploaded as an independent, runnable backend.
