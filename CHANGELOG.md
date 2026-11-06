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

## 2026-11-03 - Pass the Phase 7 integrated acceptance gate

- **Type:** Added
- **Scope:** `scripts/phase7-acceptance.mjs`, root `accept` script, `PHASE-7-ACCEPTANCE.md`, `../JOINT_PHASE.md`, `CHANGELOG.md`
- **Summary:** Added an automated acceptance gate that proves the Phase 7 exit criterion across both applications. It creates a throwaway product through the operator's own authenticated routes, publishes it, asserts the market projection exposes only the public allowlist, asserts ARATI_1 renders the approved name/description, drives availability through a real stock receipt and issue (`ENQUIRE` → `IN_STOCK` → `ENQUIRE`), withdraws the product, and unwinds itself. It also checks the live private boundary (anonymous `401`, foreign-origin `403`, no market write routes) and, on a second never-pre-fetched product, that the document head carries the approved summary. Results are recorded in `PHASE-7-ACCEPTANCE.md` with the operator publication workflow, the storefront refresh delay, the operations state, and every defect found.
- **Reason:** Phase 7 required an end-to-end demonstration rather than another module-level test, and the gate had to be repeatable against a clean environment instead of depending on the demo catalogue or on manual curl sequences.
- **Impact:** The gate passes 21/21 against a production storefront build with no limited legs; in `next dev` the two cache legs report as `LIMIT` instead of failing. No API, schema, or storefront code changed. Three findings are recorded rather than fixed: the Turbopack production build of ARATI_1 fails on `src/app/erp/tally-sync` Google Fonts (webpack build succeeds), a slug fetched before publication keeps its not-found document metadata after publishing, and dev-mode fetch cache serves stale renders.
- **Validation:** `scripts/phase7-acceptance.mjs` in production mode against `next build --webpack` + `next start -p 3200` → 21 passed, 0 failed, 0 limited. Supporting suites: repository root `node --test` 96/96, `apps/web` typecheck + 3/3 tests, ARATI_1 typecheck + 17/17 tests + lint 0 errors. Migrations verified 4 applied with none pending.

## 2026-11-02 - Add the operator catalogue console to the web shell

- **Type:** Added
- **Scope:** `apps/web` — `app/login`, `app/catalog`, `lib/api.ts`, `lib/catalog-hints.ts`, `lib/runtime-config.ts`, home navigation, `test/web-shell.test.mjs`
- **Summary:** Added the authenticated operator console. `/login` signs in through the API's `auth/login` route and redirects to `/catalog`; `/catalog` lists the organization's products and edits the approved public fields through the existing permission-checked catalogue routes, with publish/unpublish controls, a storefront preview link, and a per-field hint on every input naming the ARATI_1 display it drives. `lib/api.ts` is the typed session/API client (`apiGet`/`apiSend` with credentials, `login`/`logout`/`fetchSession`, structured `ApiError`), `lib/catalog-hints.ts` holds the field hints/derived notes/permission keys, and `runtime-config` now also exposes `storefrontBaseUrl` (`NEXT_PUBLIC_STOREFRONT_BASE_URL`, default `http://localhost:3000`). The home shell's navigation links Catalogue to `/catalog`.
- **Reason:** Catalogue administration needs an operator-facing surface, and every edit must go through the audited, permission-checked API rather than direct data access; operators also need to see how each approved field appears on the public storefront before changing it.
- **Impact:** The web app gains two client pages, a typed API/session client, and field-hint data. Login is required before catalogue actions and API failures surface the structured `code`/`message`. No API, schema, or environment-template changes; the phase plan documents were not modified.
- **Validation:** `npx tsc -p tsconfig.json --noEmit` and `npm test` in `apps/web` (3/3: shell contract, authenticated catalogue drive, field-hint coverage). End-to-end against running services: bootstrap-admin login 200; `PATCH` summary through the console's catalogue route 200 with the ARATI_1 storefront showing the edited summary after its documented 60 s cache window; unpublish 200 → market detail 404 immediately while the storefront follows its own ~60 s cache (a never-cached slug 404s at once; a previously-cached page keeps serving stale under `next dev` because the dev fetch cache under `.next/dev/cache/fetch-cache` persists across restarts — production ISR follows `revalidate`); re-publish 200 → market detail 200 → storefront served the product again with the edited summary.

## 2026-10-30 - Record the Phase 6 data-ownership decision

- **Type:** Documentation
- **Scope:** Repository root `DATA_OWNERSHIP.md`, `../JOINT_PHASE.md`, `CODEBASE_GUIDE.md`, `../ARATI_1/arati-refrigeration-software/README.md` and its codebase guide
- **Summary:** Recorded the Phase 6 ownership decision for every persisted data class. Catalogue masters, inventory, identity/audit, and the approved public image reference stay ARATI-owned (PostgreSQL); contact messages, dealer applications, service requests, and product image bytes stay ARATI_1-owned (SQLite `data/website.db`), each with documented access control, retention, backup procedure, and a reconciliation-based migration path if ownership ever moves. The public market API's exposure was verified to contain only the allowlisted catalogue keys, with `image: null` for all seeded products.
- **Reason:** Phase 6 requires each data class to have exactly one documented owner, and permits either a migration or an explicit decision to keep data local. Migration was rejected for now because ARATI has no lead/media schema or admin workflow, the image store and all lead tables are empty (0 rows), and mixing customer submissions into the public allowlisted catalogue API is precisely what the boundary forbids.
- **Impact:** The former "ownership decision still needed" language in both guides and the roadmap baseline checklist is replaced by the recorded decision; the migration checklist in `DATA_OWNERSHIP.md` governs any future move. No runtime code, schema, or configuration changed.
- **Validation:** Document cross-links checked for existence; `corepack pnpm lint` passed; market endpoint re-checked live (`slug, name, brand, category, summary, description, specifications, image, availability` only, `image: null`); table row counts confirmed 0 before deciding no reconciliation is needed today.

## 2026-10-30 - Document the no-Docker setup path and add a migration status command

- **Type:** Added | Documentation
- **Scope:** `README.md`, root `package.json`, `packages/db/package.json`
- **Summary:** Added `corepack pnpm db:status` (Prisma `migrate status` through the existing env-loading wrapper) and documented how to run the workspace against an already-running native PostgreSQL — such as the Windows `postgresql-x64-18` service — instead of Docker Compose. Also documented the `P3014` shadow-database limitation of `db:migrate` with its two workarounds, and clarified that bare `pnpm setup` is a pnpm built-in that does not install workspace dependencies.
- **Reason:** The documented setup assumed Docker Desktop and a working `db:migrate`, which is not the environment this project is developed on; following the README verbatim produced a false impression that the database or migrations were broken when the schema was in fact fully applied.
- **Impact:** New `db:status` root script reports committed-migration count and schema currency. README prerequisites mark Docker as optional, give a native-PostgreSQL option B, and steer local schema changes to `db:deploy` (or a one-time `ALTER ROLE ... CREATEDB`) when a shadow database cannot be created. No runtime code changed.
- **Validation:** `corepack pnpm db:status` exits 0 and reports "4 migrations found ... Database schema is up to date!"; `corepack pnpm lint` passed after the `package.json` edits.

## 2026-10-30 - Record joint Phase 5 storefront integration

- **Type:** Documentation
- **Scope:** `CODEBASE_GUIDE.md` system-boundary sections, shared `../JOINT_PHASE.md`
- **Summary:** Recorded the completed joint Phase 5: the ARATI_1 storefront now consumes this repository's public market API (`/api/v1/market/products`, `products/:slug`, `brands`, `categories`) through a server-only client, replacing its local catalogue fixtures. The guide's boundary sections and the roadmap's Phase 5 status, contract heading, and baseline checklist were updated to match, and the stale "not integrated" / "ARATI_1 does not consume this feed" claims were removed.
- **Reason:** The roadmap requires status and checklist entries to track only verified implementation; the guides previously described a connection that now exists, which would mislead readers about what is live.
- **Impact:** No ARATI code, schema, or configuration changed in this entry — the Phase 5 implementation itself lives in the sibling `ARATI_1/arati-refrigeration-software` workspace (market client, API-backed home/products/detail pages, unavailable states, slug-keyed photos, tests). ARATI's market API remains the single source for storefront catalogue data; lead forms, image storage and the ERP mock screens stay local to ARATI_1 pending the Phase 6 ownership decision.
- **Validation:** ARATI_1 `npx tsc --noEmit` and `npm test` (17/17); ARATI `corepack pnpm --filter @arati/api test` (85/85) and `corepack pnpm verify` (94/94); live check against a running API — production storefront returned `404` for unknown/bad slugs, `200` with seeded catalogue content for known products, and the admin photo cycle (upload by slug → public serve → delete) passed.

## 2026-10-30 - Start Phase 4 public market API

- **Type:** Added
- **Scope:** `apps/api` market module (controller/service/DTOs/rules/rate limiter), app config and `.env.example`, tests, codebase guide
- **Summary:** Implemented the JOINT_PHASE.md Phase 4 slice: unauthenticated, read-only `GET /api/v1/market/products`, `GET /api/v1/market/products/:slug`, `GET /api/v1/market/brands` and `GET /api/v1/market/categories` serving the Phase 2/3 allowlisted projection for one configured organization, with slug-based category/brand filters, bounded pagination, stable ordering, an explicit `public` cache policy, per-IP rate limiting and fail-closed organization resolution (`MARKET_ORGANIZATION_ID`, single-organization fallback, `503 MARKET_NOT_CONFIGURED` otherwise).
- **Reason:** The storefront needs a deliberate, safe read contract before ARATI_1 can replace its local catalogue fixtures; every returned field must be intentionally public and every visibility rule must stay server-owned.
- **Impact:** The market API has no session requirement, no write routes and no internal identifiers in responses; filters can only narrow the always-present publication/tenant visibility clauses; unknown or malformed product slugs return `404 MARKET_PRODUCT_NOT_FOUND` without reaching the database; unsupported query parameters are rejected with `400 VALIDATION_ERROR`; foreign browser origins receive no CORS grant; sustained bursts receive a structured `429 RATE_LIMITED`. Multi-tenant deployments must set `MARKET_ORGANIZATION_ID`, otherwise the public feed fails closed instead of guessing a tenant.
- **Validation:** `@arati/api` build, `market-rules` unit tests, the live-database Phase 4 integration gate (13 subtests covering visibility, allowlist, availability labels, pagination bounds, filters, detail fail-closed behavior, navigation, no-write routes, CORS, unresolvable configuration and rate limiting), Phase 1–3 regression tests, and the full `corepack pnpm verify` release gate.

## 2026-10-30 - Start Phase 3 inventory authority and market availability

- **Type:** Added
- **Scope:** `apps/api` inventory module and catalogue availability projection, `packages/db` schema/migration/seed, tests, codebase guide
- **Summary:** Implemented the JOINT_PHASE.md Phase 3 slice: an append-only stock ledger (`inventory_postings`, `inventory_movements`) with derived per-warehouse `stock_balances`; controlled receipt, issue, transfer, reservation, release, adjustment and damage operations; organization- and branch-scoped authorization with `inventory.read`/`inventory.write`/`inventory.adjust`; idempotent posting keys; guarded atomic balance updates that prevent overselling and over-reservation under concurrency; ledger-to-balance reconciliation with tamper detection; and a coarse server-owned market availability label (`IN_STOCK`/`ENQUIRE`/`UNAVAILABLE`) computed only from warehouses flagged `countsForMarket`. Added `isEnquiryAllowed` to products as the operator decision for out-of-stock display, and seeded inventory permissions plus deterministic opening stock posted through the ledger.
- **Reason:** Phase 3 requires trustworthy inventory state before the storefront can promise availability, and its exit gate requires inventory invariants and availability decisions to be server-owned, transactional and tested.
- **Impact:** Stock can no longer be edited as a bare count: every change is a posting with ledger rows, a mandatory reason for adjustments/damage, and an audit event. PostgreSQL rejects `UPDATE`/`DELETE` on ledger tables. Availability excludes reserved, damaged and uncounted-warehouse stock and never exposes quantities publicly. Concurrent issues against one balance cannot oversell. Transfers post paired out/in movements in one transaction. The market preview now returns an `availability` label alongside the unchanged public field allowlist.
- **Validation:** Prisma validate/generate/migrate/seed against PostgreSQL, `@arati/api` build, inventory rule unit tests, the live-database Phase 3 integration test (16 subtests, including a deliberate concurrency race and tamper detection), the Phase 3 schema test, Phase 2/catalogue regression tests, and the full `corepack pnpm verify` release gate.

## 2026-10-30 - Start Phase 2 canonical product, brand and category masters

- **Type:** Added
- **Scope:** `apps/api` catalogue module, `packages/db` schema/migration/seed, tests, codebase guide
- **Summary:** Implemented the JOINT_PHASE.md Phase 2 catalogue slice: organization-owned categories, brands, products and variants/SKUs with lifecycle (`DRAFT`/`ACTIVE`/`INACTIVE`), explicit market publication state, stable immutable market slugs, approved public summary/description/specifications/image fields, tracking mode, unit of measure and audited administration routes. Added `catalog.read`/`catalog.write`/`catalog.publish` permissions with role grants (staff read, manager edit, admin publish), and an authenticated `market-preview` route that uses the same allowlisted projection the future public API will serve.
- **Reason:** Phase 2 requires ERP-owned catalogue records and publication rules before any market feed can be exposed, and its exit gate requires proof that inactive/unpublished records are excluded and that deactivation does not break references.
- **Impact:** All catalogue routes are organization-scoped and fail closed; publishing requires an `ACTIVE` product with at least one active variant; deactivation clears publication and hides the product while preserving variants. Slugs are generated once at creation and never regenerated on rename, so market URLs stay stable. Delete routes are intentionally not exposed. Demo seed data includes three products, one deliberately left as an unpublished draft.
- **Validation:** Prisma validate/generate/migrate/seed against PostgreSQL, `@arati/api` build, unit tests for slugs/rules/projection, the live-database Phase 2 integration test (17 subtests), the Phase 2 schema test, and the full `corepack pnpm verify` release gate.

## 2026-10-29 - Start Phase 1 identity, organization scope and audit

- **Type:** Added
- **Scope:** `apps/api` identity module, `packages/db` seed/dependencies, environment configuration, tests, codebase guide
- **Summary:** Implemented the JOINT_PHASE.md Phase 1 identity and access slice: session `login`/`logout`/`me` endpoints with Argon2 credentials, failure lockout and hashed session cookies; global `SessionAuthGuard`/`PermissionGuard` enforcing organization/branch scope and an origin allow list on unsafe requests; organization/branch/user reads plus guarded user creation with role-escalation protection; audit records for login success/failure, logout and user creation; a multi-origin `CORS_ORIGIN` allow list validated at startup and documented in `.env.example`; a seed that provisions identity roles/permissions and an optional bootstrap administrator. Added unit tests for the security helpers and an end-to-end Phase 1 authorization/isolation/audit test, and refreshed `CODEBASE_GUIDE.md` to match the implemented reality.
- **Reason:** Phase 1 requires ERP-owned data to be manageable safely before catalogue administration exists, and its exit gate requires authentication, authorization, organization-isolation and audit tests to pass.
- **Impact:** Private API routes fail closed without a session and are scoped by organization/branch membership. `CORS_ORIGIN` now accepts a comma-separated list of bare origins (ARATI web plus ARATI_1 frontend); startup rejects invalid entries. `packages/db` now depends on Argon2 for seeding. A branch-scoped member passes organization-level permission checks while controllers narrow results to their branches.
- **Validation:** `corepack pnpm --filter @arati/api build`, `corepack pnpm --filter @arati/api test` (18 tests including the live-database Phase 1 gate), `corepack pnpm db:seed`, and the full `corepack pnpm verify` release gate.

## 2026-09-08 - Add product and design demonstration brief

- **Type:** Documentation
- **Scope:** Product design and repository root
- **Summary:** Added `DESIGN_DEMO.md` describing the current Phase 0 foundation, the planned ERP product, complete module functionality, demonstration scenarios, and recommended interface direction.
- **Reason:** The project needed a shared, implementation-aware explanation of the product and a concrete design direction for future ERP screens.
- **Impact:** Product demonstrations can distinguish runnable foundation behavior from planned functionality; future frontend work has a documented operations-console design reference.
- **Validation:** Checked required sections, document length, and whitespace with a focused PowerShell validation and `git diff --check`.

Add new changes here first, then move completed entries into a dated section when the change is released or otherwise finalized.
