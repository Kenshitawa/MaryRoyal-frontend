# Frontend source map

Mary Royal uses Next.js App Router as a full-stack application. The active browser UI is in `../src/app` and `../src/components`; styles, design tokens and shared navigation are in `../src/app/globals.css`, `../src/components`, and `../src/lib/navigation.ts`.

These folders are source maps for the requested repository split, not copied application code. Next.js App Router binds page rendering and HTTP route handlers under the same `src/app` tree; copying pages into this folder would create a second, stale implementation. For reliable builds, run scripts from the repository root. A true standalone frontend extraction requires moving the API to a separate service and changing the client/server integration first.
