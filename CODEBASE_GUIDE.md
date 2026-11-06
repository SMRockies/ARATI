# ARATI Business ERP — Codebase Guide

This guide describes the code currently present in the `ARATI` repository. In the intended two-project system, ARATI is the backend and operational source of truth for products, business inventory, and the rules that determine what the customer-facing ARATI_1 market frontend may display. ARATI_1 is a separate Next.js market website, not the backend or the authority for stock. This guide distinguishes that target boundary from the current code. The public catalogue link between the two projects is implemented (joint Phase 5): ARATI_1's homepage, `/products` and product-detail pages read this repository's public market API from the server. Lead forms, product-image storage, and the ERP prototype screens remain local to ARATI_1. It was prepared by reading the source, project README and implementation skill, phase/architecture documents, workspace scripts, tests, Prisma schema and Android client.

## 1. Executive summary

ARATI is a pnpm workspace intended to become a modular-monolith ERP for distribution, wholesale, retail/POS and inventory, using PostgreSQL as the operational source of truth and TallyPrime as an external accounting integration. The current repository has:

- A NestJS API foundation with startup configuration, health/readiness routes, request IDs, structured logs, global validation/security defaults and normalized HTTP errors.
- An implemented identity and access slice: session login/logout, Argon2 credentials with failure lockout, role/permission checks, organization/branch-scoped authorization guards, user administration endpoints and audit records.
- An implemented Phase 2 catalogue slice: organization-owned categories, brands, products and variants/SKUs with lifecycle and market-publication state, stable market slugs, validated administration endpoints, audit records, and an allowlisted market-projection preview.
- An implemented Phase 3 inventory slice: an append-only stock ledger with postings, derived per-warehouse balances, proof-required receipts, issue/transfer/reservation/damage/adjustment operations, branch-scoped authorization, idempotent retries, ledger reconciliation, and a coarse server-owned market availability label.
- An implemented public market API (joint Phase 4): unauthenticated, read-only `/api/v1/market/*` routes serving an allowlisted product/brand/category projection for one configured organization, with bounded pagination and slug filters, an explicit public cache policy, per-IP rate limiting, and fail-closed organization resolution.
- A Prisma/PostgreSQL foundation schema for organizations, branches, warehouses, warehouse locations, users/roles/permissions/memberships/sessions/audit events, catalogue masters and integration events, plus migrations, a seed and database health command.
- A Next.js web shell showing a designed but fixture-driven dashboard.
- A Kotlin/Jetpack Compose Android stock overview with a local-demo repository or a read-only HTTPS API repository.
- Workspace validation, tests and GitHub Actions CI.

**It is not yet a feature-complete ERP.** There is no procurement receiving/put-away workflow, party master data or pricing, sales/POS posting, payments, returns, fulfillment, reporting backend, background worker or Tally integration. Inventory is ledger-correct but quantity-only: serial/batch tracking and stock reservation against real sales documents are not implemented. Current backend runtime has `/health`, `/ready`, the identity/organization endpoints, authenticated catalogue administration, authenticated inventory operations, and the public read-only market API; web figures/activity and Android demo records are not transactional organization data. The Android's expected stock endpoint is a planned client contract and is not served by the API yet.

## System boundary with ARATI_1

### Intended responsibility split

- **ARATI (`ARATI/`)** owns the canonical product records, business inventory, availability rules, access control, and approved market-facing product data. Its NestJS API is the only application boundary through which other clients should read or change ERP-owned records; PostgreSQL is the authority.
- **ARATI_1 (`ARATI_1/arati-refrigeration-software/`)** is the customer-facing market frontend. It should request a deliberately limited public catalogue from ARATI over HTTPS and render the returned products, categories, brands, and approved availability. It must not connect directly to ARATI's database or decide authoritative stock/visibility rules in browser code.
- The ARATI web and Android clients are separate ERP clients. Their current pages are shells/prototypes; they are not a substitute for the ARATI_1 public storefront or a secure inventory-management workflow.
- Public catalogue responses must be a safe projection, not raw ERP rows: exclude internal costs, supplier/customer data, precise stock counts unless explicitly approved, and unpublished/inactive records. Authentication and server-side organization/role authorization are required for private inventory and write operations.

### Current integration status (important)

There is no ARATI-to-ARATI_1 data connection in the code today. ARATI's Nest application registers `HealthController`, the identity module (`AuthController`, `OrganizationsController`), the catalogue module (`CatalogController`), the inventory module (`InventoryController`) and the public market module (`MarketController`); it serves `GET /health`, `GET /ready`, authentication/session routes, organization-scoped reads and user administration, authenticated catalogue administration, authenticated inventory operations, and the unauthenticated read-only market API (`GET /api/v1/market/products`, `GET /api/v1/market/products/:slug`, `GET /api/v1/market/brands`, `GET /api/v1/market/categories`). Catalogue and inventory routes require an ERP session and an organization membership; the market-projection preview (`GET .../catalog/market-preview`) remains an authenticated operator view of exactly what the public feed returns. The public market routes require no session, are served only for the organization chosen by `MARKET_ORGANIZATION_ID` (or the sole organization when exactly one exists), and fail closed with `503 MARKET_NOT_CONFIGURED` rather than guessing a tenant. ARATI_1's storefront consumes this feed for its catalogue: the homepage store preview, `/products` and `/products/{slug}` call the four market routes through a server-only client and show an explicit unavailable panel instead of substitute data when the API fails. Authenticated inventory operations and a stock read model exist, but the specific Android contract, `GET /api/v1/inventory/stock`, is still only a client expectation and is not served. ARATI_1 currently renders its marketing products from local TypeScript constants and stores lead submissions and uploaded product images in its own SQLite database. Its ERP dashboard, stock, POS, and Tally pages are mockups. Therefore the storefront's product and availability data is live ARATI data whenever those pages render products; only lead submissions, uploaded photos, and the ERP mock screens remain outside ARATI.

The staged integration plan is documented in [JOINT_PHASE.md](../JOINT_PHASE.md), and the per-class persistence boundary (who owns leads, images, catalogue, inventory — with retention, backup, and migration paths) is recorded in [DATA_OWNERSHIP.md](../DATA_OWNERSHIP.md). The public market API exists, is verified, and is consumed by ARATI_1 under Phase 5; keep the API contract versioned and explicit, use public read-only projections for storefront traffic, and keep authenticated ERP reads/writes separate.

## 2. Technology and root structure

- Node.js 20+, Corepack and pnpm 10.15.0 (`packageManager` in root `package.json`).
- TypeScript with a shared strict baseline (`tsconfig.base.json`).
- API: NestJS 11, Express adapter, Prisma Client 6, PostgreSQL, Helmet, RxJS and class-validator/transformer dependencies.
- Web: Next.js 15.5.2 and React 19.1.1.
- Android: Kotlin 2.0.21, Android Gradle Plugin 8.8.2, Gradle wrapper 8.11.1, Jetpack Compose Material 3, Lifecycle ViewModel/Flow and Coroutines.
- Database: PostgreSQL 16 via Docker Compose; Prisma schema/migrations.
- CI: GitHub Actions on push and pull request, with PostgreSQL service and `pnpm verify`.

```text
ARATI/
├── apps/api/                 NestJS HTTP API
├── apps/web/                 Next.js ERP web shell
├── apps/mobile-android/      Kotlin/Compose read-only stock client
├── packages/config/          shared environment loader
├── packages/db/              Prisma schema, migration, seed, commands
├── scripts/                  root workspace checks and dev placeholder
├── tests/                    repository/database foundation tests
├── infra/                    reserved; currently placeholder only
├── .github/workflows/        CI release gate
├── pdf_text/                 extracted requirements/design references
├── *.pdf                     source project documents
└── package.json              workspace command orchestration
```

`.gitkeep` directories and target architecture diagrams describe intended future package areas; they are not implemented applications. Generated/ignored `node_modules`, `.next`, `dist`, Android `.gradle` and `build` artifacts are not source modules and are excluded from this guide.

## 3. Runtime overview and data flows

### API startup and request flow

```text
node apps/api/dist/main.js
   ├─ load root .env, falling back to .env.example
   ├─ construct Nest AppModule (global config/Prisma core, auth guards, controllers)
   ├─ validate DATABASE_URL, API_PORT and CORS_ORIGIN entries
   ├─ install Helmet and the credentialed CORS allow list
   ├─ add request-ID middleware
   ├─ install global ValidationPipe, exception filter, request logger
   └─ listen on 0.0.0.0:<API_PORT> (default 3001)
```

`GET /health` means the API process is responding; it does not query PostgreSQL. `GET /ready` executes `SELECT 1` through Prisma, so it checks PostgreSQL reachability. Errors become a structured JSON contract containing code, message, request ID and timestamp.

### Database setup and seed

```text
root env → packages/config/load-env.mjs
          → Prisma schema → committed migration → PostgreSQL
          → repeatable demo seed → DB health check
```

Prisma defines the current schema. The initial migration creates organization/location tables and `integration_events`; the Phase 1 identity migration adds users, roles, permissions, memberships, sessions and audit events; the Phase 2 migration adds catalogue categories, brands, products and variants; the Phase 3 migration adds inventory postings, ledger movements and stock balances plus database-level ledger immutability. None creates purchases, sales or pricing. The seed idempotently upserts a demo organization, main branch and main warehouse, the identity/catalogue/inventory roles and permissions, three demo catalogue products with variants (one intentionally left as an unpublished draft), deterministic opening stock posted through the ledger, and an optional bootstrap administrator.

### Web shell

The Next.js app renders the dashboard shell from arrays/constants in `src/app/page.tsx` — its metrics/activity are still static and it only displays the configured API base URL — and it also serves the operator console: `/login` establishes a session against the API's auth routes and `/catalog` reads and edits the organization-scoped catalogue through the authenticated catalogue routes, using `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:3001`) and `NEXT_PUBLIC_STOREFRONT_BASE_URL` (default `http://localhost:3000`) for the storefront preview link. The dashboard's notifications, quick-action and “new transaction” controls remain visual placeholders with no handlers; of the sidebar entries only Catalogue navigates.

### Android client

```text
MainActivity → StockRepositoryFactory(API_BASE_URL)
             → LocalStockRepository if blank
             → ApiStockRepository if configured
StockViewModel → StateFlow<StockUiState> → Compose StockScreen
```

Blank URL selects four in-memory demo records. Configured URL must be HTTPS and selects a read-only GET to `/api/v1/inventory/stock`. The client decodes JSON, validates decimal quantities as strings and displays API failures; it deliberately does not fall back to fake demo data after selecting the API. The current Nest API has no such route yet (authentication now exists, but the stock route is not served), so the Android API mode cannot fetch production organization stock.

## 4. API source reference (`apps/api/src`)

### `main.ts`

- `bootstrap()`: dynamically imports and invokes the shared env loader; constructs the Nest app with the default logger disabled; resolves and validates `AppConfig`; resolves the JSON logger; installs Helmet; configures credentialed CORS for the `CORS_ORIGIN` allow list; binds `RequestIdMiddleware`; installs the global Nest `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`); installs the normalized exception filter and request completion interceptor; listens on `0.0.0.0`; logs startup. A catch at module entry reports structured startup failure and sets a nonzero process exit code.

### `app.module.ts`

- `AppModule`: root Nest module. Imports the global `CoreModule` and the `AuthModule`, `CatalogModule` and `InventoryModule` feature modules, registers `HealthController`, and provides `JsonLogger`. Party, pricing, procurement and sales modules do not exist yet.

### `core.module.ts`

- `CoreModule`: `@Global` Nest module providing and exporting `AppConfig` and `PrismaService`, so feature modules can inject them without re-importing.

### `config.ts`

- `AppConfig`: exposes `nodeEnv` (default development), `port` (`API_PORT` or 3001), `corsOrigins` (comma-separated `CORS_ORIGIN` allow list, default `http://localhost:3000`), and `databaseUrl` from environment.
- `validate()`: requires `DATABASE_URL`, checks API port is an integer from 1 through 65535, requires at least one configured CORS origin, and rejects entries that are not bare origins (no path or trailing slash).

### `health.controller.ts`

- `HealthController`: receives `PrismaService` by dependency injection.
- `health()`, `GET /health`: returns `{ status: "ok", service: "api" }` without checking database.
- `ready()`, `GET /ready`: awaits `prisma.checkConnection()` and returns `{ status: "ready", service: "api", database: "postgresql" }`; any connection error becomes a 503 `DATABASE_NOT_READY` response.

### `prisma.service.ts`

- `PrismaService`: extends generated `PrismaClient` and implements Nest module-destroy lifecycle.
- `checkConnection()`: executes parameterized raw `SELECT 1` as a connectivity probe.
- `onModuleDestroy()`: disconnects the Prisma client cleanly.

### `request-id.middleware.ts`

- `RequestIdMiddleware.use(request,response,next)`: accepts a non-empty incoming `x-request-id` or creates `req_<UUID>`; stores it on the request header and response locals, adds `X-Request-ID` response header, then passes control to Express/Nest. The current implementation accepts caller-provided IDs as-is after trimming (not a UUID/length validation).

### `request-logging.interceptor.ts`

- `RequestLoggingInterceptor.intercept(context,next)`: captures request/response and start time; on response `finish`, writes `request.completed` JSON log containing request ID, method, original URL, status and elapsed milliseconds; returns `next.handle()` unchanged.

### `http-exception.filter.ts`

- `HttpExceptionResponseFilter.catch(exception,host)`: chooses HTTP status from `HttpException`, otherwise 500; extracts a provided response `code` and `message` if available; maps default 400 to `VALIDATION_ERROR`, 401 to `UNAUTHORIZED`, 403 to `FORBIDDEN`, 404 to `NOT_FOUND`, otherwise `INTERNAL_ERROR`; logs 5xx failures without exposing stack traces; responds with `{ error: { code, message, details?, requestId, timestamp } }`. Array validation messages are replaced with a safe summary and kept in `details`.
- `codeFor(status)`: maps common authorization/not-found statuses; remaining statuses become `INTERNAL_ERROR`.

### `logger.ts`

- `JsonLogger.log(message,context)`: writes an info-level JSON record.
- `JsonLogger.error(message,context)`: writes an error-level JSON record.
- `write(level,message,context)`: emits timestamp, level, fixed service name, message, and supplied context to stdout. Context fields are spread last, so callers should not override reserved fields. Avoid logging secrets or request payloads.

### `auth/` — identity, session and scope (Phase 1)

- `auth.module.ts`: registers `AuthController` and `OrganizationsController` and installs `SessionAuthGuard` followed by `PermissionGuard` as global `APP_GUARD` providers, so every non-public route fails closed by default.
- `auth.decorators.ts`: `@Public()` opts a route out of session authentication; `@RequirePermission(code)` requests a permission/scope check; `@RequireSameOrigin()` marks unsafe routes that must present an allowed browser origin.
- `auth.dto.ts`: `LoginDto` (email, password ≤256 chars) and `CreateOrganizationUserDto` (email, password ≥12 chars, display name, role code, optional branch UUID), enforced by the global `ValidationPipe`.
- `auth-security.ts`: session token creation (`randomBytes(32)`, URL-safe 43 chars) and SHA-256 hashing; environment-specific cookie parsing/building (`arati_session` in development, `__Host-arati_session` plus `Secure` in production, always `HttpOnly` and `SameSite=Strict`, with `Max-Age`); session policy constants (30 min idle, 12 h absolute, 5 min refresh window, 5 failures → 15 min lockout); `hasValidMutationOrigin()` comparing the `Origin` header against the configured allow list; `hasOrganizationScope()` combining permission membership with organization/branch scope.
- `auth.types.ts`: `AuthContext` (user identity plus active memberships with role and permission codes) and `AuthorizationScope` (organization with allowed branch IDs, or `null` for organization-wide access).
- `auth.controller.ts` (`/api/v1/auth`): `POST login` verifies Argon2 credentials (dummy-hash timing equalization for unknown users), rejects locked/inactive accounts, increments failure counters and locks after `MAX_FAILED_LOGINS`, creates the hashed-token session transactionally, writes `auth.login.succeeded`/`auth.login.failed` audit records, and sets the session cookie; `GET me` returns the caller and memberships; `POST logout` revokes the session, clears the cookie and writes an `auth.logout` audit record. Login/logout require an allowed `Origin` header.
- `organizations.controller.ts` (`/api/v1/organizations`): `GET /` lists only the caller's organizations; `GET :organizationId/branches` and `GET :organizationId/users` require `branch.read`/`user.read` and narrow rows to `authorizationScope.branchIds`; `POST :organizationId/users` requires `user.create`, rejects branch-scope escapes and role escalation (the caller must already hold every permission of the assigned role), creates the user plus membership transactionally, and writes an `identity.user.created` audit record.
- `auth.guards.ts`: `SessionAuthGuard` rejects unsafe requests whose `Origin` is not in the allow list (`ORIGIN_REJECTED` 403), resolves the session by token hash (missing/revoked/expired/inactive → 401), refreshes the idle window when close to expiry while setting `Cache-Control: private, no-store`, and attaches `AuthContext` to the request. `PermissionGuard` requires an organization route parameter on permission-protected routes (`ORGANIZATION_SCOPE_REQUIRED`), evaluates `hasOrganizationScope()`, returns `PERMISSION_DENIED` or `SCOPE_DENIED` 403s, and attaches `authorizationScope` for controllers.
- `health.controller.ts` routes are `@Public()`; the only other public routes are the Phase 4 market controller's read-only endpoints. Every catalogue, organization, identity and inventory route still requires a session.

### `catalog/` — product, brand, and category masters (Phase 2)

- `catalog.module.ts`: registers `CatalogController` and `CatalogService`. It relies on the global `CoreModule` for `PrismaService` and on the global auth guards, so every catalogue route requires a session and an organization membership.
- `catalog.dto.ts`: validated create/update DTOs for categories, brands, products and variants, plus paginated filter queries. Codes are uppercase `A-Z0-9_-`; slugs are lowercase single-hyphen words; specifications are `{name, value}` objects capped at 50 entries; image URLs must be absolute http(s) or root-relative; `page`/`limit` are bounded to 100; unknown query parameters are rejected by the global `forbidNonWhitelisted` pipe.
- `slug.ts`: `slugify()` normalizes Unicode, lowercases, collapses separators, trims and caps at 160 characters; `isValidSlug()` enforces the lowercase-hyphen pattern. Slugs are resolved once at creation and never regenerated, so renaming a product does not break its market URL.
- `catalog.rules.ts`: pure Phase 2 rules and projection helpers. `evaluateActivation()` requires at least one active variant; `evaluatePublish()` requires an `ACTIVE` product with an active variant; `deactivationPatch()` clears publication; `marketProductWhere()` limits visibility to published, active products in active categories/brands; `MARKET_PRODUCT_SELECT` is the explicit public field allowlist; `toMarketProduct()` produces the stable public shape without internal identifiers; `readSpecifications()` normalizes stored JSON; `resolvePagination()` bounds page/limit.
- `catalog.service.ts`: organization-scoped reads and writes. It verifies category/brand ownership, derives or validates slugs, maps unique violations to 409 (`CATEGORY_EXISTS`, `BRAND_EXISTS`, `PRODUCT_EXISTS`, `VARIANT_SKU_EXISTS`), enforces lifecycle/publication rules (`PRODUCT_NOT_ACTIVE`, `PRODUCT_REQUIRES_ACTIVE_VARIANT`, `PUBLISHED_PRODUCT_REQUIRES_ACTIVE_VARIANT`), keeps repeated transitions idempotent, and writes audit events in the same transaction as each change. `marketPreview()` reuses the exact filter and select the future public endpoint will use.
- `catalog.controller.ts` (`/api/v1/organizations/:organizationId/catalog`): reads require `catalog.read`, edits require `catalog.write`, and publish/unpublish require `catalog.publish`. Routes cover list/create/edit for categories and brands, list/create/get/edit products, `POST products/:productId/activate|deactivate|publish|unpublish`, `POST products/:productId/variants`, `PATCH variants/:variantId`, and `GET market-preview`.
- Publication lifecycle: products start `DRAFT` and unpublished; activation needs a sellable variant; publishing needs `ACTIVE`; deactivation sets `INACTIVE` and clears `isPublished`/`publishedAt`; unpublishing leaves lifecycle untouched. Delete routes are deliberately absent, so variants and future references are never orphaned. Catalogue masters are organization-wide, not branch-scoped, so branch narrowing does not apply to them. `isEnquiryAllowed` (default true, editable through `PATCH products/:productId`) decides whether an out-of-stock product reads as `ENQUIRE` or `UNAVAILABLE` in the market projection.

### `inventory/` — stock ledger and market availability (Phase 3)

- `inventory.module.ts`: registers `InventoryController` and `InventoryService`, exports the service, and relies on the global `CoreModule`/auth guards. Every route requires an organization membership and an `inventory.*` permission.
- `inventory.rules.ts`: pure inventory and availability policy. `movementEffects()` maps each operation to signed bucket movements (`RECEIPT`/`TRANSFER_IN`/`ADJUSTMENT_INCREASE` → `+ON_HAND`; `ISSUE`/`TRANSFER_OUT`/`ADJUSTMENT_DECREASE` → `-ON_HAND`; `RESERVE`/`RELEASE` → `±RESERVED`; `DAMAGE` → `-ON_HAND` + `+DAMAGED`). `bucketDeltas()` aggregates them, `sellableQuantity()` returns `max(0, onHand - reserved)`, and `evaluateAvailability()`/`evaluateProductAvailability()` produce the coarse `IN_STOCK` / `ENQUIRE` / `UNAVAILABLE` label (`IN_STOCK_THRESHOLD` = 1 sellable unit, any active variant is enough). `auditActionFor()` names the audit event.
- `availability.ts`: `loadSellableByVariant()` sums sellable stock per variant across warehouses with `countsForMarket = true`; `loadProductAvailability()` resolves a product's public label. These are shared by the catalogue preview and the public market API, and they never expose a quantity.
- `inventory.dto.ts`: proof-backed receipts take one warehouse, existing variant, positive integer quantity, optional reference, and idempotency key; issue/reservation/release, transfer, signed adjustment, and damage DTOs retain their existing validations. Query DTOs bound pagination to 100 and allow warehouse/variant/posting/bucket filters only.
- `inventory.service.ts`: the only code allowed to change stock. `postReceipt()` requires stored proof metadata and creates it, the `InventoryPosting`, ledger rows, balance delta, and audit event in one database transaction; `postIssue()`, `postTransfer()`, `postReservation()`, `postRelease()`, `postAdjustment()` and `postDamage()` share the same guarded posting path. The balance update uses `UPDATE ... WHERE` guards (negative or over-reserved results update zero rows → `409 INSUFFICIENT_STOCK`); reads are branch-narrowed and reconciliation reports mismatches without repairing them.
- `proof-storage.service.ts`: accepts JPEG, PNG, and PDF by file signature only, caps files at 10 MiB, stores them under random opaque names in private API-local storage, and records the original safe filename, MIME type, size, and SHA-256. `GET proofs/:postingId` verifies the stored bytes against that hash and streams a proof only after organization, branch, session, and `inventory.read` checks; files are not exposed as static assets.
- `inventory.controller.ts` (`/api/v1/organizations/:organizationId/inventory`): `GET balances|warehouses|receipt-variants|movements|reconciliation|availability/:productId|proofs/:postingId` require `inventory.read`; multipart `POST receipts` requires `inventory.write` and the `proof_file` field; other writes keep their existing permissions. Warehouse reads, SKU selection, receipt posting, and proof retrieval are scoped to the caller's organization and authorized branches.
- Integrity model: balances are derived, never edited through the API; the ledger and proof metadata are append-only. A PostgreSQL trigger rejects receipt ledger rows without matching proof metadata and prevents proof metadata from linking to non-receipt postings; proof metadata and the movement are inserted in the same transaction. Check constraints keep stock buckets non-negative and `reserved <= onHand`; transfers post paired out/in rows.

### `market/` — public read-only market API (joint Phase 4)

- `market.module.ts`: registers `MarketController` and `MarketService` and relies on the global `CoreModule` for `PrismaService`/`AppConfig`. No import of the catalogue or inventory module is needed: the module reuses their pure rules and availability helpers directly.
- `market.rules.ts`: pure public-query policy. `marketProductsWhere(organizationId, filters)` always layers the Phase 3 visibility filter (published + `ACTIVE` + active category + null-or-active brand) and optionally narrows by brand slug (replacing the nullable-brand `OR` clause), category slug, or a case-insensitive name/summary/description search — filters can only narrow, never widen. `marketMasterWhere()` lists only active masters that currently carry a visible product. `resolveMarketOrganization()` picks the tenant from `MARKET_ORGANIZATION_ID`, falls back to a sole organization, and otherwise fails closed (`UNCONFIGURED`/`AMBIGUOUS`/`NOT_FOUND`). `MARKET_CACHE_CONTROL`, `MARKET_RATE_LIMIT` (300/min per IP) and `MARKET_PRODUCT_KEYS` are the shared public constants.
- `market.dto.ts`: `MarketProductQueryDto` extends the bounded pagination query (`page ≥ 1`, `limit ≤ 100`, `q ≤ 120` chars) with optional slug-validated `category` and `brand` filters; the global `forbidNonWhitelisted` pipe rejects any other parameter, so unsupported ERP filters fail loudly instead of being ignored.
- `market.service.ts`: resolves the market organization (throwing `503 MARKET_NOT_CONFIGURED` when ambiguous or misconfigured), runs the allowlisted `MARKET_PRODUCT_SELECT` query with stable `name, slug` ordering, aggregates sellable stock across counted warehouses in one query, and maps rows through `toMarketProduct()` — the same projection the authenticated preview serves. `getProduct(slug)` rejects malformed slugs before touching the database and returns `404 MARKET_PRODUCT_NOT_FOUND` for anything unpublished, inactive, foreign, or unknown. Brands/categories return `{slug, name}` only.
- `market.controller.ts` (`/api/v1/market`): class-level `@Public()` (no session) and `@UseGuards(MarketRateLimitGuard)`; four GET routes (`products`, `products/:slug`, `brands`, `categories`) each carry `Cache-Control: public, max-age=60, stale-while-revalidate=300`. There are deliberately no write routes, and public responses never set a session cookie (private ERP routes stay `private, no-store`).
- `market.rate-limit.ts`: in-memory fixed-window limiter per client IP (300 requests/60 s) that returns a structured `429 RATE_LIMITED` and sweeps expired windows so address scans cannot grow the map without bound. It is per-process by design — one API instance serves this storefront, and a new dependency or shared store is not warranted.

## 5. Web shell (`apps/web/src`)

### `app/layout.tsx`

- `metadata`: sets document title and operational-workspace description.
- `RootLayout({children})`: creates the English HTML document, imports global CSS, and renders children. No auth/session providers exist.

### `app/page.tsx`

- `navigation`: constant list for Overview, Catalogue (the only entry with an `href`, pointing at `/catalog`), Inventory, Sales & POS, Procurement and Parties.
- `metrics`: fixed strings for stock, orders and receivables (not API results).
- `HomePage()`: obtains configured API URL and displays the static sidebar, workspace/user shell, status bar, fixed date, sample metrics/activity and shortcuts. Calls `ActivityItem`/`QuickAction` to produce presentational entries. Only the Catalogue entry navigates; the other visible buttons and `href="#"` menu items still have no handler.
- `ActivityItem({marker,color,title,detail,time})`: renders one static activity row.
- `QuickAction({icon,label})`: renders one button-like action; it currently has no behavior.

### `lib/runtime-config.ts`

- `getApiBaseUrl()`: returns trimmed `NEXT_PUBLIC_API_BASE_URL` or `http://localhost:3001`.
- `getStorefrontBaseUrl()`: returns trimmed `NEXT_PUBLIC_STOREFRONT_BASE_URL` or `http://localhost:3000`.
- `getRuntimeConfig()`: wraps and returns `{ apiBaseUrl, storefrontBaseUrl }`; used by the home page for display and by the catalogue console for its storefront preview link.

### `app/login/page.tsx`

- `LoginPage()`: client-side sign-in form. Calls `login()` from `lib/api`, surfaces the API's structured error message on failure, and redirects to `/catalog` on success.

### `app/catalog/page.tsx`

- `CatalogPage()`: the authenticated operator console. Guards on `fetchSession()` and redirects to `/login` when there is no session (or on `401`), lists the organization's products through the paged catalogue routes, and edits the approved public fields (name, summary, description, brand/category, specifications rows, image URL/alt, enquiry flag) through `apiSend` against the existing permission-checked catalogue routes.
- Publish/unpublish buttons call the matching routes and report each outcome through a notice line; publish is gated client-side on `PERMISSIONS.write`/`PERMISSIONS.publish` membership, and the server's own preconditions (product `ACTIVE`, at least one SKU) are echoed when the API rejects the action. A live link opens the product on the ARATI_1 storefront via `storefrontProductUrl(slug)`. Sign out calls `logout()` and returns to `/login`.
- Every editable field renders its `FIELD_HINTS` effect so the operator can see which storefront display the input drives; `DERIVED_NOTES` explains values the server derives rather than accepts.

### `lib/api.ts`

- Typed session/API client shared by both pages: `apiGet`/`apiSend` issue same-origin credential requests to `apiBaseUrl` and throw `ApiError { status, code, message }` parsed from the API's error envelope; `login`/`logout`/`fetchSession` wrap the auth routes; `storefrontProductUrl()` builds the ARATI_1 product link. Also exports the session, catalogue and market types plus `errorMessage`/`isApiError` helpers.

### `lib/catalog-hints.ts`

- `FIELD_HINTS`: per-field effect strings mapping each console input to the ARATI_1 storefront display it changes. `DERIVED_NOTES`: notes for server-derived values. `PERMISSIONS`: the catalogue permission keys the console checks to enable editing and publishing controls.

### Web config and styles

- `next.config.mjs`: enables React strict mode and sets output tracing root to repository root.
- `globals.css`: defines a green/paper visual system, dashboard layout, responsive behavior and component classes.
- `apps/web/.env.example`: template for `NEXT_PUBLIC_API_BASE_URL`.
- Web package `lint` and `typecheck` scripts both run TypeScript with `--noEmit`; no separate ESLint invocation is configured there.

## 6. Shared environment package (`packages/config`)

- `loadEnvironment()` (`src/load-env.mjs`): calculates repository root relative to this package; tries root `.env`, then `.env.example`; reads the first accessible file; parses simple `UPPER_SNAKE_CASE=value` lines; sets values only if the process environment does not already define them; removes one pair of surrounding single/double quotes; returns the selected path. It skips unreadable candidates and throws if neither file is found.
- `load-env.d.ts`: declares the async helper return type (`Promise<string>`).
- `package.json`: marks this package as ESM and exports `@arati/config/load-env.mjs`.

**Inference/caveat:** this is a deliberately small line parser, not a full dotenv implementation; comments, multiline values, escapes and `export KEY=...` are not interpreted. A real `.env` should be used for sensitive local values; `.env.example` must not be treated as a place for secrets. The loader fills only values not already supplied by the runtime environment.

## 7. Database package (`packages/db`)

### Prisma schema

`prisma/schema.prisma` configures Prisma Client and PostgreSQL using `DATABASE_URL`.

- `IntegrationEventStatus`: `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED` lifecycle values.
- `Organization`: UUID, unique business code, name, timezone (default UTC), timestamps; owns branches and integration events.
- `Branch`: belongs to organization; code unique within organization; owns warehouses.
- `Warehouse`: belongs to branch; code unique within branch; owns locations, stock balances and ledger movements. `countsForMarket` (default true) decides whether its stock may contribute to the public availability label.
- `WarehouseLocation`: belongs to warehouse; code unique within warehouse.
- `User`, `Role`, `Permission`, `RolePermission`, `OrganizationMembership`, `AuthSession`, `AuditEvent`: identity/access records — Argon2 password hashes with failed-login counters and lock time, system roles with permission grants, organization/branch-scoped memberships, hashed session tokens with idle/absolute expiry and revocation, and append-only audit events indexed by user and organization.
- `ProductCategory`, `ProductBrand`, `Product`, `ProductVariant`: Phase 2 catalogue masters. Categories and brands are organization-owned with unique `(organizationId, code)` and `(organizationId, slug)`. Products reference a category, optional brand, and carry lifecycle status (`DRAFT`/`ACTIVE`/`INACTIVE`), publication flags (`isPublished`, `publishedAt`), tracking mode (`QUANTITY`/`SERIAL`/`BATCH`/`HYBRID`), approved public text/specifications/image fields, and unique code/slug per organization. Variants hold a SKU unique per organization, unit of measure, JSON attributes and an active flag. Products also carry `isEnquiryAllowed` (default true), the operator decision behind the out-of-stock market label.
- `InventoryPosting`: one controlled inventory operation (type, optional idempotency key unique per organization, reference type/id, reason, actor, timestamp) that groups the ledger rows written by a single API call.
- `InventoryMovement`: append-only ledger row (posting, organization, warehouse, variant, operation type, bucket, signed integer quantity, reference, reason, actor, occurrence/creation timestamps); indexed by organization/variant/date and posting. `InventoryBucket` is `ON_HAND`, `RESERVED` or `DAMAGED`; `InventoryMovementType` covers receipt, issue, transfer out/in, adjustment increase/decrease, reserve/release and damage.
- `ProofAttachment`: immutable receipt-proof metadata (organization/posting, opaque storage key, safe file name, MIME type, byte size, SHA-256, uploader and timestamp); one-to-one with its receipt posting. PostgreSQL triggers require it before a receipt movement can be inserted.
- `StockBalance`: current `onHand`/`reserved`/`damaged` per warehouse and variant with a version counter; unique on `(warehouseId, variantId)`. Invariants (no negative bucket, `reserved <= onHand`) are database check constraints, and the row is written only by applying ledger deltas.
- `IntegrationEvent`: event ID plus primary idempotency key, organization, event type, status, JSON payload, attempts, availability/process timestamps, last error and audit timestamps; indexed for pending-work retrieval and organization/event type.

Foreign keys use restrictive deletes and cascade updates where specified, preventing deletion of parents with dependent records. PostgreSQL triggers additionally reject updates and deletes on inventory postings and movements, so inventory history is append-only at the storage layer. There are currently no party, pricing, purchase or sales entities. Organization/location scoping, identity records and catalogue masters now exist; authorization and publication rules are enforced in the API, not by the schema alone.

### Migration and seed

- `prisma/migrations/20260906120000_initial_foundation/migration.sql`: creates the enum and the five tables, unique/index constraints, and foreign keys represented in the schema. The SQL is version-controlled and applied via Prisma migrate.
- `prisma/migrations/20261029090000_identity_access/migration.sql`: creates the Phase 1 identity/access tables (users, roles, permissions, role_permissions, organization_memberships, auth_sessions, audit_events) with their unique constraints, indexes and foreign keys.
- `prisma/migrations/20261030100000_catalog_masters/migration.sql`: creates the Phase 2 catalogue tables (product_categories, product_brands, products, product_variants), the lifecycle/tracking enums, unique organization code/slug/SKU constraints and restrictive foreign keys.
- `prisma/migrations/20261030120000_inventory_ledger/migration.sql`: adds `warehouses.countsForMarket` and `products.isEnquiryAllowed`, creates `inventory_postings`, `inventory_movements` and `stock_balances` with their enums, indexes, restrictive foreign keys, the non-negative/over-reservation and non-zero-quantity check constraints, and the `arati_reject_inventory_ledger_mutation()` trigger that makes both ledger tables append-only.
- `prisma/seed.mjs`: calls `loadEnvironment()`, constructs Prisma and Argon2, `upsert`s the `DEMO` organization (timezone Asia/Kolkata), `MAIN` branch and `MAIN` warehouse, the seed permissions (`branch.*`, `user.*`, `catalog.read/write/publish`, `inventory.read/write/adjust`) and system roles (`ORG_ADMIN`, `BRANCH_MANAGER`, `BRANCH_STAFF`) with their role grants, three demo categories, one brand, three demo products with variants (one left as an unpublished draft to demonstrate exclusion), idempotent opening-stock postings for the two published variants, and — only when both `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` (≥12 characters) are set outside production — a bootstrap administrator with an organization-wide `ORG_ADMIN` membership; disconnects in `finally`. It is safe to rerun: `update: {}` preserves operator edits and publication state.
- `src/healthcheck.mjs`: loads environment, queries `SELECT 1`, prints JSON ready/not-ready, sets exit code 1 on failure, always disconnects.
- `scripts/prisma-command.mjs`: loads environment, spawns the local Prisma CLI with requested arguments (uses `cmd.exe`/`prisma.cmd` on Windows), inherits stdio and environment, propagates exit status or termination signal.
- `package.json`: wraps generate/validate/format/dev migrate/deploy/reset, seed, health and Studio commands.

## 8. Android stock client (`apps/mobile-android`)

### Startup and domain

- `MainActivity.stockRepository`: lazy repository creation using generated `BuildConfig.API_BASE_URL`.
- `MainActivity.onCreate(savedInstanceState)`: installs Compose content; creates a Material 3 theme; obtains a `StockViewModel` using a repository-backed factory; renders `StockRoute`.
- `TrackingType`: quantity, serial, batch or hybrid tracking.
- `StockStatus`: labels for in-stock, low-stock and out-of-stock.
- `StockItem`: immutable stock display record. Constructor validates nonblank ID/name/SKU/warehouse and nonnegative on-hand/reorder-point quantities; `status` returns OUT when quantity is zero, LOW when quantity is less than or equal to reorder threshold, otherwise IN. BigDecimal avoids floating-point quantity loss.

### Repository and API adapter (`data/StockRepository.kt`)

- `StockRepository`: abstraction exposing a source label and suspend `loadStock()`.
- `StockLoadResult.Success` / `Failure`: explicit result types to represent a fetched item list or user-safe error.
- `StockRepositoryFactory.create(apiBaseUrl)`: blank config selects local demo; nonblank config constructs HTTPS API repository and validates its URL.
- `LocalStockRepository.loadStock()`: returns four hardcoded, in-memory demo records. It does not persist or represent organization stock.
- `ApiStockRepository.loadStock()`: performs request work on `Dispatchers.IO`; GETs the stock URL with 10s connect/15s read timeout, no redirects, and JSON Accept header; non-2xx becomes failure; successful response is parsed; IO, JSON and argument failures become visible failures; always disconnects.
- `buildStockEndpoint(apiBaseUrl)`: parses a URI; requires HTTPS, a host, no userinfo/query/fragment; appends `/api/v1/inventory/stock` and converts to URL.
- `parseStockItems(payload)`: reads top-level `items` array and maps objects to domain items.
- `JSONObject.toStockItem()`: normalizes tracking type uppercase, matches a known enum, reads required text fields and quantities.
- `JSONObject.getDecimal(name)`: requires the JSON value be a String, then parses `BigDecimal`; this enforces decimal-as-string contract.

The API contract is documented in the Android README: `GET /api/v1/inventory/stock`, returning `{ items: [{ id, name, brand, sku, tracking, warehouse, onHand, reorderPoint }] }`, tracking enums as `QUANTITY|SERIAL|BATCH|HYBRID`, quantities as decimal strings. Current API lacks this route (session authentication exists, but no inventory endpoint). The Android adapter sends no credentials and is read-only.

### UI state (`ui/StockViewModel.kt`)

- `StockFilter`: all/in-stock/low/out-of-stock filter values and display labels.
- `StockUiState.visibleItems`: derived list filtered case-insensitively over name, brand, SKU, warehouse and by derived stock status.
- `StockUiState.count(status)`: counts all records of a derived status (not only currently filtered ones).
- `StockViewModel`: owns a `MutableStateFlow`, exposes a read-only `StateFlow`, and initializes with a refresh.
- `updateQuery(query)`: copies the current state with changed search query.
- `updateFilter(filter)`: copies state with selected filter.
- `refresh()`: clears displayed rows, sets loading and clears error, then launches repository fetch in `viewModelScope`. Success replaces items and clears loading/error; failure leaves items empty and sets the failure message.
- `StockViewModel.Factory.create(modelClass)`: verifies requested type is compatible and constructs the view model with its repository; otherwise throws.

### Compose screen (`ui/StockScreen.kt`)

- `StockRoute(viewModel)`: collects StateFlow using lifecycle-aware collection and connects query/filter/refresh events.
- `StockScreen(...)`: composes title/source, refresh button, summary cards, search field, filter chips and content state. Chooses loading/error/empty/no-match/list rendering based on the state.
- `StockSummary(state)`: shows total records and counts by status.
- `SummaryCard(label,value,modifier)`: small count tile.
- `StockItemCard(item)`: displays product identity, warehouse, tracking kind, quantity/reorder point and a status-color badge.
- `LoadingState()`: centered progress indicator.
- `ErrorState(message,onRefresh)`: failure message and retry action.
- `EmptyState(message)`: centered no-data/no-match message.
- `BigDecimal.displayQuantity()`: strips trailing zeroes and formats a non-scientific quantity string.

### Android configuration and tests

`app/build.gradle.kts` resolves API URL from Gradle property `aratiApiBaseUrl` first or environment `ARATI_API_BASE_URL` second, escapes it into `BuildConfig`, and configures API 28 minimum, API 35 compile/target and Java/Kotlin 17. Root Android Gradle configuration pins AGP/Kotlin. Unit tests cover demo/API repository selection and HTTP rejection, stock threshold/negative quantity, and case-insensitive search/status filtering. The README states no credentials are embedded and local mode needs no backend.

## 9. Root scripts, verification and CI

### `scripts/verify-workspace.mjs`

- Parses `--all`, `--build`, `--lint`, `--typecheck` flags.
- Verifies required files/directories exist.
- Parses root `package.json`; requires setup/dev/build/lint/typecheck/test/verify scripts.
- Checks required env-template keys and PostgreSQL Compose image/healthcheck.
- Prints workspace-validation success, optionally listing requested check labels.

Important: this script's `--lint`, `--typecheck`, and `--build` flags currently only influence the displayed labels after path/config checks; the script itself does not lint/typecheck/build code. The real package commands later in root `verify` do invoke database, API and web checks.

### `scripts/dev-placeholder.mjs`

Prints a Phase 0.1 readiness message. Root `pnpm dev` does not start the API or web server; use the separate `api:dev` and `web:dev` commands.

### `scripts/phase7-acceptance.mjs`

The Phase 7 integrated acceptance gate (`pnpm accept`). Requires a running API and ARATI_1 storefront, signs in as the bootstrap operator, creates a throwaway product through the same permission-checked routes the console uses, and asserts the full publication → inventory-availability → withdrawal flow across both applications, plus the live private boundary (anonymous `401`, foreign-origin `403`, no market write routes). `STOREFRONT_MODE=production` makes the two cache-propagation legs strict; in `next dev` they report `LIMIT` instead of failing. It unwinds every product it creates. Results and the defects it found are recorded in `PHASE-7-ACCEPTANCE.md`.

### Tests

- `tests/workspace.test.mjs`: confirms required root scripts exist.
- `tests/database-foundation.test.mjs`: reads the Prisma schema/migration and asserts expected models, status enum, index and event table.
- `apps/api/test/api-smoke.test.mjs`: starts compiled API on a test port with intentionally invalid DB URL; checks `/health` 200, generated request ID, `/ready` 503 code and normalized `/missing` 404.
- `apps/api/test/auth-security.test.mjs`: unit tests for token format/hashing, environment-specific cookie parsing and flags, origin allow-list validation, and organization/branch permission scope predicates.
- `apps/api/test/phase1-authorization.test.mjs`: end-to-end Phase 1 gate against live PostgreSQL; spawns the compiled API, provisions an isolated two-organization fixture, and asserts fail-closed 401s, foreign-origin 403 `ORIGIN_REJECTED`, failed/successful login audit records, membership-scoped organization listing, branch-scope narrowing, cross-organization denial, role-escalation denial on user creation, and audit records for privileged changes; removes its fixture afterwards.
- `apps/api/test/catalog-rules.test.mjs`: unit tests for slug generation/validation, activation/publication rules, deactivation behaviour, market visibility filters, the public projection allowlist shape, specification normalization and bounded pagination.
- `apps/api/test/phase2-catalog.test.mjs`: end-to-end Phase 2 gate against live PostgreSQL; creates category/brand/product/variant as an administrator, proves draft and unpublished products are excluded from the market projection, checks the public field allowlist and the no-stock `ENQUIRE` label, slug stability across renames, duplicate/invalid-input errors, deactivation preserving variants, category/brand deactivation hiding products, permission enforcement (write vs publish vs read-only), organization isolation, normalized pagination/404 errors, last-sellable-variant protection and audit records; removes its fixture afterwards.
- `tests/catalog-foundation.test.mjs`: reads the Phase 2 schema/migration and asserts catalogue models, stable identifiers, publication columns, and restrictive foreign keys.
- `apps/api/test/inventory-rules.test.mjs`: unit tests for movement effects and bucket deltas, positive-integer enforcement, sellable-quantity flooring, the three availability labels, product-level aggregation and audit action naming.
- `apps/api/test/phase3-inventory.test.mjs`: end-to-end Phase 3 gate against live PostgreSQL; proves proof-required multipart receipts, file signature validation, private proof retrieval, database-level proof enforcement, idempotent replay, balance/market-label flow, existing reservation/issue/damage/transfer/adjustment behaviours, scope/isolation, concurrency, reconciliation, append-only ledgers, and audit records; removes fixture rows and temporary proof files afterwards.
- `tests/inventory-foundation.test.mjs`: reads the Phase 3 schema/migration and asserts the ledger/balance tables, market-counting and enquiry columns, non-negative/over-reservation checks, the append-only triggers and restrictive foreign keys.
- `apps/api/test/market-rules.test.mjs`: unit tests for fail-closed market-organization resolution, the always-present visibility clauses under every filter combination, master listing conditions, the fixed public key allowlist and the public cache policy.
- `apps/api/test/phase4-market.test.mjs`: end-to-end Phase 4 gate against live PostgreSQL; proves sessionless access with no cookie and a public cache header, publication/lifecycle/master-activity/tenant visibility, the exact public field allowlist with no internal ids, ledger-derived `IN_STOCK`/`ENQUIRE`/`UNAVAILABLE` labels with no quantities, bounded pagination and 400s for invalid/unknown query parameters, narrowing-only filters, 404 fail-closed detail for unpublished/foreign/malformed slugs, `{slug, name}`-only navigation, absence of any write route, CORS limited to the configured storefront origin, `503 MARKET_NOT_CONFIGURED` for unresolvable organization configuration, and a structured `429` under a request burst; removes its fixture afterwards.
- `apps/web/test/web-shell.test.mjs`: source-level assertions that expected dashboard shell text, API config default and mobile CSS breakpoint exist.
- Android JUnit tests described above.

### `pnpm verify`

Root script chains the workspace path/config checks, Prisma schema validation/client generation/migration deployment/seed/health check, API build and HTTP smoke test, web typecheck/test/build and root Node tests. It requires PostgreSQL running. GitHub Actions starts a disposable PostgreSQL 16 service, installs with frozen lockfile and runs this same command.

### `docker-compose.yml`

Defines only PostgreSQL 16 Alpine, a named data volume, environment-backed credentials/port and `pg_isready` healthcheck. It does not run API, web or worker containers.

## 10. Important project documents

- `README.md`: setup, root scripts, database commands, release-gate description and component commands.
- `FOLDER_DESIGN.md`: ownership principles and target module layout; target directories/modules are design intent, not necessarily present code.
- `EXECUTION-PLAN.md`, `PHASES_v1.0.md`, `PHASE-0-IMPLEMENTATION-PLAN.md`: delivery sequence and phase requirements.
- `PHASE-0-CLOSEOUT.md`: asserts a completed Phase 0 checkpoint and lists verification evidence. Treat this as recorded project evidence; it does not replace rerunning checks in the current working environment.
- `.github/skills/arati-erp-implementation/SKILL.md`: project-specific constraints for future ERP work (PostgreSQL authority, modular monolith, server-side rules, inventory/financial integrity, asynchronous integrations, authorization and TBD policies).
- `pdf_text/`: extracted requirements/API/database/security/architecture baselines; PDFs remain original source documents.

## 11. Roadmap versus current implementation

| Area | Intended by roadmap/docs | Present implementation |
|---|---|---|
| Modular monolith | Capability-based backend modules | Nest root module with health, identity and catalogue modules; no inventory/party/pricing modules |
| Identity/access | Authentication, roles, object/organization scope | Implemented in API (sessions, roles/permissions, organization/branch guards, user administration, audit); web shell still has no login UI |
| Organization | Multi-organization and branch ownership | Schema models and sample organization/branch/warehouse/location |
| Master data | Products, parties, pricing | Catalogue masters implemented (categories, brands, products, variants/SKUs, lifecycle, publication); parties and pricing not implemented |
| Procurement/inventory | Receiving, movement ledger, balances, transfers, adjustments, serial/batch | Ledger, postings, balances, receipts, issues, transfers, reservations, adjustments, damage and reconciliation implemented with branch scope and availability projection; no purchase orders/receiving documents, serial/batch tracking, or Android stock route |
| Sales/POS/payments | Server-authoritative posting, allocation, reversals | Web dashboard shortcuts only; no transaction implementation |
| Integration/outbox | Durable async, retryable Tally events | `IntegrationEvent` persistence schema exists; no worker, producer, consumer or Tally adapter |
| Web dashboard | Live operational metrics/modules | Static local data and decorative controls |
| Mobile stock | Read-only stock overview | Implemented with demo source and API adapter; production route/auth missing |
| CI/release checks | One release gate | Implemented and wired in CI; it needs PostgreSQL; workspace validator itself is a shape/config check |

## 12. Security, data and operational boundaries

- PostgreSQL is intended as the authoritative source. Android local fixture and web figures are presentation/demo state only.
- The current mobile API adapter only reads and requires HTTPS, but does not authenticate; do not point it at sensitive production stock until a server route, authentication and organization/warehouse authorization exist.
- CORS permits only the configured origin allow list (`CORS_ORIGIN`, comma-separated bare origins) with credentials; the same list gates unsafe request origins in `SessionAuthGuard`.
- Private routes fail closed: no session → 401, missing permission or out-of-scope organization/branch → 403. Session cookies are `HttpOnly`, `SameSite=Strict`, and `Secure` with the `__Host-` prefix in production; authenticated responses send `Cache-Control: private, no-store`.
- Privileged changes (login success/failure, logout, user creation, catalogue create/edit/activate/deactivate/publish/unpublish/variant changes, and every inventory posting) write `audit_events` rows keyed by user and organization.
- Market visibility is server-owned: only published, `ACTIVE` products in active categories (and a null-or-active brand) can enter `marketProductWhere()`; the authenticated `market-preview` response is built from an explicit select allowlist and contains no organization IDs, internal codes, lifecycle flags, costs or stock quantities. It does contain one coarse `availability` label derived from counted warehouses only; exact quantities, reservations and warehouse names stay behind `inventory.read`.
- Inventory writes are branch-scoped for branch members, idempotent on request key, atomic against concurrent postings, and audited. Balances cannot be edited through the API: adjustments require `inventory.adjust` plus a written reason, and the ledger rejects `UPDATE`/`DELETE` in PostgreSQL. Public market routes do not exist yet; when added they must reuse this projection and must not accept an ERP session or credentials from the browser.
- Helmet is installed in the API process.
- Request IDs connect response metadata, normalized errors and request logs; user-provided IDs are currently accepted.
- Global DTO validation is configured and exercised by the auth and organization DTOs.
- Prisma schema includes foreign keys and uniqueness constraints for organization/location relationships. Integration event schema has unique idempotency key and processing-state fields; asynchronous semantics are not implemented merely by having the table.
- `.gitignore` excludes `.env` and `.env.*` except `.env.example`, generated builds and local database data. Never commit real secrets.

## 13. Known issues and caveats observed in source

1. Root README says copy `.env.example` to `.env`; the repository loader chooses the real `.env` if available and otherwise loads `.env.example` directly. Keep the template non-secret.
2. The root `dev` command is explicitly a placeholder. `pnpm api:dev` and `pnpm web:dev` start individual apps.
3. Root verification requires local PostgreSQL and Prisma migration/seed. Running only `node --test` does not exercise these live DB steps.
4. `scripts/verify-workspace.mjs --all` reports requested check labels but only verifies repository shape/config; actual package-specific lint/type/build/test scripts are separate steps in `verify`.
5. API registers `HealthController`, the identity, catalogue and inventory modules. Party/pricing masters, procurement documents, sales and public market routes are still absent, and `/ready` is a database probe, not a feature API.
6. Catalogue publication is an approval/lifecycle flag only: there is no multi-step approval workflow, scheduled publication, or public cache/revalidation layer yet. Public endpoints, cache headers and rate limiting belong to the joint Phase 4.
7. Catalogue masters are organization-wide; branch scope does not narrow them. Product deactivation is the supported "retire" path (no delete route), which preserves variants and future historical references.
8. Inventory is quantity-only. `trackingMode` accepts `SERIAL`/`BATCH`/`HYBRID`, but nothing enforces serial numbers or batch expiry yet, and reservations are not tied to sales documents. Transfers are direct two-warehouse postings with no approval or in-transit state, and the seeded opening stock is demo data.
9. The market label reflects stored stock only. There is no scheduled recomputation, cache, or stale-data policy yet; those belong to the public API phase.
10. The phase closeout document records passing verification, but this guide does not itself constitute a test run.

## 14. Where to change things

- **Add an API route/domain:** create a Nest feature module/controller/service in `apps/api/src`, register it in `AppModule`, define validated DTOs and server-side authorization/business rules; add focused API/database tests.
- **Change environment configuration:** `packages/config/src/load-env.mjs`, `.env.example`, `apps/api/src/config.ts`, and/or `apps/web/src/lib/runtime-config.ts` according to the consumer.
- **Change database structure:** edit `packages/db/prisma/schema.prisma`, create a migration via the documented Prisma command, review migration SQL, update seed/tests, then apply migrations.
- **Change catalogue rules or the public projection:** `apps/api/src/catalog/catalog.rules.ts` (visibility filter, allowlist, lifecycle rules), `catalog.service.ts` (organization-scoped operations and audit), `catalog.dto.ts` (accepted fields/validation), and `catalog.controller.ts` (route/permission mapping). Keep the market projection free of internal fields and update the Phase 2/4 tests with any contract change.
- **Change inventory behaviour:** `apps/api/src/inventory/inventory.rules.ts` (movement effects, availability policy), `inventory.service.ts` (posting path, guarded balance update, reconciliation), `inventory.dto.ts` (accepted operations), `inventory.controller.ts` (routes/permissions), `availability.ts` (which warehouses contribute). Any new stock-changing operation must post ledger rows and apply deltas through the existing path — never update `stock_balances` directly.
- **Change what the market may promise:** adjust `countsForMarket` on warehouses, `isEnquiryAllowed` on products, or the threshold/labels in `inventory.rules.ts`. Keep exact quantities out of the public projection.
- **Add pricing or parties:** add new Prisma models/migrations and Nest modules; do not widen catalogue models with internal cost/party fields that could leak through the market projection.
- **Change web shell:** `apps/web/src/app/page.tsx` and shared styles in `apps/web/src/app/globals.css`. Replace presentation data with API-backed data only after corresponding backend API/auth contracts exist.
- **Change Android stock rules/UI:** domain in `apps/mobile-android/app/src/main/java/com/arati/mobile/domain/StockItem.kt`, repository/API mapping in `data/StockRepository.kt`, state/filtering in `ui/StockViewModel.kt`, Compose presentation in `ui/StockScreen.kt`.
- **Add Android API capability:** extend the read contract only with backend-owned, authorized data; never add stock writes as client-side balance mutations.
- **Change workflow/CI:** root scripts and `.github/workflows/ci.yml`; keep the release-gate command reproducible and ensure flags really execute checks rather than only reporting them.
- **Place future modules:** use `FOLDER_DESIGN.md` and `.github/skills/arati-erp-implementation/SKILL.md` for ownership boundaries, inventory/financial integrity, and integration policies.

## 15. Concise function index

| Area | Functions/classes and role |
|---|---|
| API lifecycle | `bootstrap()` initializes runtime; `AppModule` wires services; `AppConfig.validate()` checks required settings |
| API health | `HealthController.health()` liveness; `ready()` PostgreSQL readiness; `PrismaService.checkConnection()` probe; `onModuleDestroy()` cleanup |
| Identity | `AuthController.login()/me()/logout()` session lifecycle; `OrganizationsController.list()/branches()/users()/createUser()` scoped administration; `SessionAuthGuard.canActivate()` session/origin gate; `PermissionGuard.canActivate()` permission/scope gate; `hasOrganizationScope()`/`hasValidMutationOrigin()` predicates; `setSessionCookie()`/`readSessionToken()` cookie handling |
| Catalogue | `CatalogController` category/brand/product/variant/publish routes; `CatalogService.listCategories()/createCategory()/updateCategory()`, brand equivalents, `listProducts()/getProduct()/createProduct()/updateProduct()`, `activateProduct()/deactivateProduct()/publishProduct()/unpublishProduct()`, `createVariant()/updateVariant()`, `marketPreview()`; `evaluateActivation()`/`evaluatePublish()`/`deactivationPatch()` rules; `marketProductWhere()`/`MARKET_PRODUCT_SELECT`/`toMarketProduct()` projection; `slugify()`/`isValidSlug()` identifiers |
| Inventory | `InventoryController` balance/movement/reconciliation/availability reads, proof retrieval, proof-required receipt, and issue/transfer/reservation/release/adjustment/damage postings; `ProofStorageService` private file validation/storage; `InventoryService` transaction and authorization scope; database trigger requires proof on receipt movements |
| API middleware | `RequestIdMiddleware.use()` correlation ID; `RequestLoggingInterceptor.intercept()` request timing; `HttpExceptionResponseFilter.catch()` normalized failure contract; `codeFor()` default error code |
| Logging | `JsonLogger.log()`, `.error()`, `.write()` structured output |
| Shared config | `loadEnvironment()` reads runtime variables from root env sources |
| DB workflow | Prisma schema/migration define storage; `seed.mjs` upserts demo org/location; `healthcheck.mjs` probes PostgreSQL; `prisma-command.mjs` delegates CLI/exit status |
| Web | `RootLayout()` document shell; `HomePage()` static dashboard; `ActivityItem()` and `QuickAction()` presentation; `getApiBaseUrl()` and `getRuntimeConfig()` runtime API address |
| Android | `MainActivity.onCreate()` app composition; `StockItem.status` inventory label; repository factory/source `loadStock()`; `buildStockEndpoint()` and JSON parsing; `StockUiState.visibleItems/count()` derived state; ViewModel update/refresh/factory; Compose route/screen/cards/loading/error/empty components; `displayQuantity()` formatting |
| Workspace | `verify-workspace.mjs` repo shape/config checks; `dev-placeholder.mjs` prints readiness placeholder; Node tests assert workspace/schema/API/web contracts |

## 16. Overall inference

The repository is a foundation checkpoint rather than a finished ERP. Its strongest architectural direction is explicit: PostgreSQL owns operational state; NestJS is meant to enforce business and authorization rules; web and mobile are clients; inventory should be ledger-controlled; Tally should be asynchronous and recoverable. The currently executable business-facing slices are an Android read-only stock overview over local demo data, the Phase 1 login → scoped administration → audit flow, the Phase 2 catalogue → lifecycle → publication → market-projection flow, the Phase 3 stock ledger → balance → availability-label flow, and the Phase 4 public read-only market API. The server schema owns organization/location ownership, identity/access records, catalogue masters, inventory history and integration-event durability, while the API/web establish runtime shells. With the public market API in place, the storefront fixture catalogue has been replaced by that feed (joint Phase 5, implemented in ARATI_1). The next meaningful joint work is the Phase 7 end-to-end acceptance run; the Phase 6 media/lead ownership decision is recorded in [DATA_OWNERSHIP.md](../DATA_OWNERSHIP.md) (both classes stay in ARATI_1 with a documented migration path). Do not treat mock screens, or the integration-event table, as implemented public business behaviour.