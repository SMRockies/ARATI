# Changelog

All notable repository changes are recorded here in reverse chronological order. Entries describe what changed and why, with enough detail to trace the evolution of the project baseline.

## Entry Format

Use this format for every change:

```markdown
## YYYY-MM-DD - Short change title

- **Type:** Added | Changed | Fixed | Removed | Security | Documentation
- **Scope:** module, folder, document, or system area
- **Summary:** What changed.
- **Reason:** Why the change was made.
- **Impact:** Behavior, structure, migration, or operational impact.
- **Validation:** Test, review, command, or other verification performed.
```

Use one dated section per logical change. Keep entries in reverse chronological order. Record documentation-only changes as well as code, schema, infrastructure, security, and configuration changes. Never place secrets or sensitive operational data in this file.

## 2026-09-06 - Establish repository documentation controls

- **Type:** Documentation
- **Scope:** Repository root
- **Summary:** Added `FOLDER_DESIGN.md` to define the current and target folder structure, ownership boundaries, and placement rules. Added this `CHANGELOG.md` to provide a standard record for every repository change.
- **Reason:** The project needed a shared convention for organizing the planned ERP monorepo and stamping future changes.
- **Impact:** Future top-level folder or module changes must update `FOLDER_DESIGN.md`; future repository changes must add a changelog entry.
- **Validation:** Reviewed against `EXECUTION-PLAN.md` and `PHASE-0-IMPLEMENTATION-PLAN.md`.

## 2026-09-06 - Align folder design with source baselines

- **Type:** Documentation
- **Scope:** Repository structure
- **Summary:** Added explicit locations for background workers, outbox and integration processing, Prisma migrations, and generic development seed data.
- **Reason:** The architecture, database, technology stack, and protection baselines require external work to be asynchronous and retryable, and require schema changes to be version-controlled and tested.
- **Impact:** Integration jobs belong under `apps/worker`; schema and seed ownership belongs under `packages/db/prisma`; external calls must not block core ERP transactions.
- **Validation:** Cross-checked against the extracted architecture, database, technology stack, and protection source documents in `pdf_text/`.

## 2026-09-06 - Start Phase 0.1 workspace foundation

- **Type:** Added
- **Scope:** Repository foundation
- **Summary:** Added pnpm workspace metadata, shared TypeScript configuration, root workflow scripts, environment template, PostgreSQL Docker Compose configuration, repository validation, and a workspace smoke test.
- **Reason:** Started Phase 0.1 to establish a clean-checkout developer foundation before application and database runtime work.
- **Impact:** The repository now has documented setup and verification commands. API, web, Prisma, and worker runtime implementations remain scheduled for later Phase 0 subphases.
- **Validation:** `corepack pnpm install`, `corepack pnpm verify`, `corepack pnpm test`, and `corepack pnpm dev` passed. Docker Compose could not be started because Docker is unavailable on the current PATH.

## 2026-09-06 - Start Phase 0.2 database foundation

- **Type:** Added
- **Scope:** `packages/db`
- **Summary:** Added the Prisma database package, initial organization and warehouse ownership schema, durable integration event table, migration, generic seed data, Prisma client generation, and database health check.
- **Reason:** Started Phase 0.2 with a version-controlled PostgreSQL/Prisma foundation before backend runtime work.
- **Impact:** Database schema validation and client generation run through pnpm. Migration deployment, reset, seed, and live readiness checks require PostgreSQL from Docker Compose.
- **Validation:** Prisma validation, Prisma client generation, workspace verification, and Node smoke tests passed. Live migration and connectivity checks remain pending Docker availability. Root scripts use Corepack so they work with the repository's pinned pnpm version.

## 2026-09-06 - Start Phase 0.3 backend runtime

- **Type:** Added
- **Scope:** `apps/api`
- **Summary:** Added the NestJS API bootstrap, health and readiness endpoints, Prisma readiness adapter, request correlation IDs, structured JSON request logs, normalized HTTP errors, validation/security defaults, and an API smoke test.
- **Reason:** Started Phase 0.3 with a real backend runtime boundary before feature modules are introduced.
- **Impact:** `/health` is available without a database connection; `/ready` reports PostgreSQL availability with a structured `DATABASE_NOT_READY` error when unavailable. Root verification now includes API compilation and HTTP smoke testing.
- **Validation:** API build, typecheck, HTTP smoke test, root verification, and repository tests passed. Live ready state remains dependent on PostgreSQL availability.

## 2026-09-06 - Start Phase 0.4 frontend shell

- **Type:** Added
- **Scope:** `apps/web`
- **Summary:** Added the Next.js ERP shell, responsive navigation and dashboard placeholder, runtime API configuration, web smoke test, and production build workflow.
- **Reason:** Started Phase 0.4 with a usable frontend boundary before module-level UI work begins.
- **Impact:** The web app renders at `/`, defaults to `http://localhost:3001` for the API, and can be overridden with `NEXT_PUBLIC_API_BASE_URL`. Root verification now includes web typecheck, smoke test, and build.
- **Validation:** Web typecheck, smoke test, and production build passed. The initial dependency install required a retry after transient npm registry resets.

## 2026-09-07 - Start Phase 0.5 quality gates

- **Type:** Added
- **Scope:** CI, verification, and release documentation
- **Summary:** Added the GitHub Actions verification workflow and expanded `pnpm verify` to run database migration, seed, and health checks before API, web, and repository tests/builds.
- **Reason:** Started Phase 0.5 with a single reproducible release gate that exercises the complete Phase 0 runtime foundation.
- **Impact:** Local verification now requires PostgreSQL to be running. CI provisions PostgreSQL automatically and runs the same command.
- **Validation:** `corepack pnpm verify` passed, including migration deployment, seed, live database health, API/web builds, smoke tests, and repository tests.

## Unreleased

Add new changes here first, then move completed entries into a dated section when the change is released or otherwise finalized.
