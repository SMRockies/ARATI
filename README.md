# Arati Business ERP

Arati Business ERP is a modular monolith for distribution, wholesale, retail/POS, inventory, and related operations. PostgreSQL is the operational source of truth; TallyPrime remains an external accounting integration for the initial release.

## Phase 0.1 Setup

### Prerequisites

- Node.js 20 or newer
- Corepack-enabled pnpm 10
- PostgreSQL 14 or newer — **Docker Desktop is optional** (see below)
- Git

Enable pnpm if Corepack is available:

```powershell
corepack enable
corepack prepare pnpm@10.15.0 --activate
```

> Note: run dependency installation as `corepack pnpm install` (or `corepack pnpm run setup`).
> Bare `pnpm setup` is a **pnpm built-in** that only configures pnpm's own shell PATH — it does
> not install this workspace's dependencies.

### PostgreSQL: two equivalent options

**Option A — Docker Compose** (matches CI):

```powershell
docker compose up -d postgres
docker compose ps
```

**Option B — an existing local PostgreSQL** (no Docker required), e.g. a Windows service
installation such as `postgresql-x64-18`. If `pg_isready -h localhost -p 5432` reports
`accepting connections`, Docker is unnecessary: point `.env`'s `DATABASE_URL` at your server
and database (`arati_erp`, creating it once with `CREATE DATABASE arati_erp;` if it does not
exist), then continue with the migration/seed commands below.

Stop the Docker service without deleting its data:

```powershell
docker compose down
```

Feature modules and the remaining worker runtime are introduced in later phases. `pnpm verify` validates the Phase 0.1 workspace foundation, Phase 0.2 Prisma schema/client and live database workflow, Phase 0.3 API, and Phase 0.4 web shell.

## Phase 0.5 Release Verification

Phase 0.5 makes `pnpm verify` the release gate. PostgreSQL must be running before it is executed because the command validates migrations, seed execution, and database health in addition to source checks, builds, and tests. Any reachable PostgreSQL matching `.env` works — Docker is one way to provide it, not a requirement.

```powershell
docker compose up -d postgres   # skip if PostgreSQL is already running (e.g. a native Windows service)
corepack pnpm verify
```

GitHub Actions runs the same verification command against a disposable PostgreSQL service on pushes and pull requests. The dashboard values remain Phase 0.4 presentation placeholders until data-backed module work begins.

## Phase 0.2 Database Commands

After PostgreSQL is running (Docker or native), apply the committed migrations and seed generic development data:

```powershell
corepack pnpm db:deploy
corepack pnpm db:seed
corepack pnpm db:health
corepack pnpm db:status
```

`corepack pnpm db:status` reports how many migrations exist and whether the database schema is up to date — use it as the quick check that a database is migrated.

Inventory receipts use `POST /api/v1/organizations/{organizationId}/inventory/receipts` as an authenticated `multipart/form-data` request with `warehouseId`, `variantId`, positive-integer `quantity`, optional `reference`/`referenceId`/`idempotencyKey`, and required `proof_file`. It uses ARATI's existing session-cookie and `inventory.write` permission model; select an existing catalogue SKU rather than creating a product as part of a stock receipt. JPEG, PNG, or PDF proof is limited to 10 MB. The API validates the file signature, stores the file outside the public web root, and records its SHA-256 and metadata with the receipt posting in the same database transaction. Proofs are downloaded through `GET /api/v1/organizations/{organizationId}/inventory/proofs/{postingId}` after organization/branch and `inventory.read` checks. By default, files are stored in `var/inventory-proofs` relative to the API process working directory; configure `INVENTORY_PROOF_STORAGE_DIR` and mount private durable storage at that location in deployments. Back up the proof directory along with PostgreSQL so ledger evidence remains available.

For local schema development, use `corepack pnpm db:migrate --name descriptive_change`. **`db:migrate` (Prisma `migrate dev`) needs to create a shadow database**, so the connecting role must be allowed to `CREATE DATABASE`. On a native PostgreSQL where the role lacks that permission this fails with `P3014: permission denied to create database`. Either:

- apply already-committed migrations without a shadow database — `corepack pnpm db:deploy` (recommended for native/local servers), or
- grant the permission once — `ALTER ROLE <user> CREATEDB;` — after which `db:migrate` works normally.

To recreate the local database from migrations, use `corepack pnpm db:reset`. All of these commands use the `DATABASE_URL` from `.env`.

## Root Commands

| Command | Purpose |
| --- | --- |
| `pnpm run setup` | Install workspace dependencies (equivalently `corepack pnpm install`; bare `pnpm setup` is a pnpm built-in and does not install this workspace) |
| `pnpm dev` | Show the current development-stage status |
| `pnpm lint` | Validate repository conventions and JSON configuration |
| `pnpm typecheck` | Validate TypeScript configuration and workspace shape |
| `pnpm test` | Run repository tests |
| `pnpm build` | Validate the build-stage workspace shape |
| `pnpm verify` | Run the complete Phase 0.5 release gate, including database migration, seed, health, tests, and builds |
| `pnpm db:validate` | Validate the Prisma schema |
| `pnpm db:generate` | Generate the Prisma client |
| `pnpm db:deploy` | Apply committed migrations |
| `pnpm db:status` | Report migration status (counts committed migrations, confirms the schema is up to date) |
| `pnpm db:health` | Check PostgreSQL connectivity |
| `pnpm api:build` | Compile the NestJS API |
| `pnpm api:test` | Run the API HTTP smoke test |
| `pnpm api:dev` | Start the API development runtime |
| `pnpm web:build` | Build the Next.js web shell |
| `pnpm web:typecheck` | Typecheck the web shell |
| `pnpm web:test` | Run the web shell smoke test |
| `pnpm web:dev` | Start the Next.js development runtime |

## Project References

- [Folder design](FOLDER_DESIGN.md)
- [Execution plan](EXECUTION-PLAN.md)
- [Phase 0 implementation plan](PHASE-0-IMPLEMENTATION-PLAN.md)
- [Changelog](CHANGELOG.md)
