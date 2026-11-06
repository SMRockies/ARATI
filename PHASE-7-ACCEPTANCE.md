# Phase 7 Acceptance Record

## Status

The Phase 7 exit gate passes: **an authorized operator publishes a product in ARATI, approved
inventory changes its market availability, and ARATI_1 displays the approved result** — with no
transaction, product master, or stock balance written by the public frontend.

The gate is automated in `scripts/phase7-acceptance.mjs` (21 legs) and was signed off against a
**production build** of the storefront, not the dev server:

```text
21 passed, 0 failed, 0 limited
Phase 7 integrated acceptance — http://localhost:3001  →  http://localhost:3200 (production)
```

Three defects and limitations were found during acceptance and are recorded below; none of them
blocks the exit gate, and one (the Turbopack production build) blocks a *Turbopack* deployment.

## Running the gate

Start the API and the storefront, then:

```bash
# dev storefront (port 3000): cache legs report as LIMIT, never fail
node scripts/phase7-acceptance.mjs

# production storefront: every leg must pass
STOREFRONT_MODE=production STOREFRONT_BASE_URL=http://localhost:3200 node scripts/phase7-acceptance.mjs
```

| Variable | Default | Purpose |
|---|---|---|
| `API_BASE_URL` | `http://localhost:3001` | ARATI API under test |
| `STOREFRONT_BASE_URL` | `http://localhost:3000` | ARATI_1 storefront under test |
| `STOREFRONT_MODE` | `dev` | `production` makes the cache legs strict |
| `ACCEPT_CACHE_WAIT_MS` | `90000` | cache window budget (use `150000` in production) |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | from `.env` | operator credentials |

The production run used:

```bash
cd ../ARATI_1/arati-refrigeration-software
ARATI_API_BASE_URL=http://localhost:3001 npx next build --webpack
ARATI_API_BASE_URL=http://localhost:3001 npx next start -p 3200
```

## What the gate proves

The gate creates its own throwaway product with a unique slug, drives every write through the same
authenticated, permission-checked routes the operator console uses, and reads the storefront only.

| Leg group | Assertion |
|---|---|
| Preflight | `GET /health` and `GET /ready` healthy; storefront responds |
| Authentication | operator login sets a session cookie; the session exposes the organization scope |
| Private boundary | anonymous catalogue read `401`; foreign-origin write `403`; market `POST`/`PATCH`/`DELETE` unavailable |
| Draft handling | a draft product is `404` on both the market API and the storefront |
| Gate A — publication | activate + publish `200`; market projection carries **only** the public allowlist; the storefront renders the approved name and description |
| Gate A — metadata | a product whose slug is never requested before publication carries the approved summary in its document head |
| Gate B — inventory | zero stock → `ENQUIRE` and **no quantity** in the payload; a receipt of 4 → `IN_STOCK`; the storefront renders "In stock at showroom"; issuing the 4 → `ENQUIRE` again |
| Gate C — withdrawal | unpublish → market `404` immediately; the storefront `404`s within its cache window |
| Cleanup | every acceptance product ends unpublished and deactivated |

## Supporting verification

| Check | Command | Result |
|---|---|---|
| ARATI API + contract + boundary tests | `node --test` (repository root) | **96 passed**, 0 failed |
| ARATI web typecheck | `npx tsc -p tsconfig.json --noEmit` (`apps/web`) | clean |
| ARATI web tests | `npm test` (`apps/web`) | **3 passed** |
| ARATI_1 typecheck | `npx tsc --noEmit` | clean |
| ARATI_1 tests | `node --test "test/*.test.mjs"` | **17 passed** |
| ARATI_1 lint | `npx eslint` | 0 errors (1 pre-existing `no-img-element` warning) |
| ARATI_1 production build | `npx next build --webpack` | succeeded |
| ARATI_1 production build | `npx next build` (Turbopack) | **fails** — see defect 1 |
| Migrations | `_prisma_migrations` | 4 applied, none pending, no drift |

A clean-database `migrate deploy` + `seed` was **not** run: it would destroy the working demo
database. Migration state was verified as fully applied with no drift instead. The first deployment
to a scratch database must run `corepack pnpm verify`, which performs the full clean sequence.

## Defects and limitations

### 1. ARATI_1 production build fails under Turbopack (deployment blocker for Turbopack)

`npx next build` (Next.js 16.3.5, Turbopack) fails with 15 errors resolving
`@vercel/turbopack-next/internal/font/google/font`, all originating from
`src/app/erp/tally-sync/page.tsx`, which loads `Playfair_Display`, `DM_Sans`, `Montserrat`, and
`JetBrains_Mono` through `next/font/google`. The webpack builder (`next build --webpack`) succeeds,
and `next dev` is unaffected.

Impact: deploy with the webpack builder, or self-host/remove the fonts on that page, until the
Turbopack font resolver is fixed. Not an ARATI defect.

### 2. Metadata caching when a slug is requested before publication

If a product's storefront URL is fetched **while the product is still unpublished**, the response is
a `404`; after publication the page body correctly shows the product, but the cached document head
keeps the not-found/listing values. Observed in a production build:

```text
t+15..75s  name: false  | title: "Store — Arati Refrigeration"   (still 404)
t+90s      name: true   description: true
           title: "Store — Arati Refrigeration"        <- expected the product name
           meta:  "Browse every air conditioner..."    <- expected the approved summary
```

Reproduction: create a draft, request `/products/{slug}` (404), publish, then poll the page.
A product first requested *after* publication renders its metadata correctly — the gate asserts
that path in the "freshly published product carries its approved metadata" leg.

Impact: an operator who checks the storefront before publishing gets a page whose title and social
preview stay wrong until the cache is invalidated or the server restarts. Body content is correct.
Owner: ARATI_1 (`generateMetadata` calls `notFound()`, and the cached 404 metadata is not replaced
when the route later succeeds). Suggested fix: return the metadata from the page body's data path
without throwing in `generateMetadata`, or revalidate the route on publish.

### 3. Dev-server fetch cache serves stale renders

Under `next dev`, a cached product page keeps serving its previous render past the 60 s window —
including an unpublished product. The fetch cache lives in `.next/dev/cache/fetch-cache` and
survives restarts. Production ISR honours `revalidate` correctly (all cache legs pass in the
production run). Treat dev-mode cache behaviour as non-authoritative.

### 4. The gate leaves inactive product records behind

The API exposes no hard delete for products, so each acceptance run leaves deactivated,
unpublished products in the catalogue (12 rows after several runs; seeded catalogue holds 3).
They are never publicly visible. Run the gate against a scratch database in a deployment, or prune
inactive `P7-`/`P7M-` codes manually.

## Operator workflow and refresh delay

1. Sign in at `/login` on the console (`localhost:3002`) and open **Catalogue**.
2. Edit the approved public fields — name, summary, description, brand/category, specifications,
   image reference, enquiry flag. Each input names the storefront display it drives.
3. Click **Publish**. The API re-validates the preconditions: the product must be `ACTIVE` and have
   at least one SKU.
4. The public market API reflects the change immediately (`Cache-Control: public, max-age=60,
   stale-while-revalidate=300`). The storefront revalidates on its own 60 s window and may serve a
   stale render for up to that window; a *new* product slug renders on first request.
5. To withdraw a product, click **Unpublish**: the market API `404`s at once, and the storefront
   follows within its cache window.

Operators should expect up to ~60 s between publishing and the storefront showing it, and should
not treat a brief mismatch as data loss. Availability is derived server-side from the stock ledger
(`IN_STOCK` when any sellable unit exists, otherwise `ENQUIRE` when the product allows enquiries,
else `UNAVAILABLE`); the storefront never receives a quantity.

## Operations

| Area | Current state |
|---|---|
| Readiness | `GET /health` (liveness) and `GET /ready` (database reachable) exist on the API |
| Configuration | `ARATI/.env` (API/console) and `ARATI_1/.env` (`ARATI_API_BASE_URL`) are ignored by git; `.env.example` files are the committed templates |
| Cache invalidation | Time-based only (60 s + `stale-while-revalidate=300`); no publish-triggered invalidation — the propagation window in defect 2 follows from this |
| Rollback | Both applications deploy independently; rollback is redeploying the previous build of the affected app. No database down-migrations are provided, so schema rollback is restore-based |
| Backup/restore | PostgreSQL is authoritative for catalogue, inventory, identity and audit; `pg_dump`/restore is the recovery path. ARATI_1's SQLite file (leads, images) is gitignored and needs its own copy. No automated backup job exists yet |
| TLS | Terminated by the deployment front end for both apps; CORS is pinned to the configured storefront/console origins |
| Monitoring | Structured request/exception logging with request ids; no metrics or alerting yet |

Open gaps for go-live: automated backups, publish-triggered revalidation, metrics/alerting, and a
scratch-database acceptance run in the target environment.
