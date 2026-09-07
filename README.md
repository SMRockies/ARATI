# Arati Business ERP

Arati Business ERP is a modular monolith for distribution, wholesale, retail/POS, inventory, and related operations. PostgreSQL is the operational source of truth; TallyPrime remains an external accounting integration for the initial release.

## Phase 0.1 Setup

### Prerequisites

- Node.js 20 or newer
- Corepack-enabled pnpm 10
- Docker Desktop with Docker Compose
- Git

Enable pnpm if Corepack is available:

```powershell
corepack enable
corepack prepare pnpm@10.15.0 --activate
```

### First checkout

```powershell
Copy-Item .env.example .env
pnpm install
pnpm verify
```

Start the local PostgreSQL service:

```powershell
docker compose up -d postgres
docker compose ps
```

Stop the service without deleting its data:

```powershell
docker compose down
```

Feature modules and the remaining worker runtime are introduced in later phases. `pnpm verify` validates the Phase 0.1 workspace foundation, Phase 0.2 Prisma schema/client and live database workflow, Phase 0.3 API, and Phase 0.4 web shell.

## Phase 0.5 Release Verification

Phase 0.5 makes `pnpm verify` the release gate. PostgreSQL must be running before it is executed because the command validates migrations, seed execution, and database health in addition to source checks, builds, and tests.

```powershell
docker compose up -d postgres
corepack pnpm verify
```

GitHub Actions runs the same verification command against a disposable PostgreSQL service on pushes and pull requests. The dashboard values remain Phase 0.4 presentation placeholders until data-backed module work begins.

## Phase 0.2 Database Commands

After PostgreSQL is running, apply the initial migration and seed generic development data:

```powershell
corepack pnpm db:deploy
corepack pnpm db:seed
corepack pnpm db:health
```

For local schema development, use `corepack pnpm db:migrate --name descriptive_change`. To recreate the local database from migrations, use `corepack pnpm db:reset`. These commands require Docker PostgreSQL and use the `DATABASE_URL` from `.env`.

## Root Commands

| Command | Purpose |
| --- | --- |
| `pnpm setup` | Install workspace dependencies |
| `pnpm dev` | Show the current development-stage status |
| `pnpm lint` | Validate repository conventions and JSON configuration |
| `pnpm typecheck` | Validate TypeScript configuration and workspace shape |
| `pnpm test` | Run repository tests |
| `pnpm build` | Validate the build-stage workspace shape |
| `pnpm verify` | Run the complete Phase 0.5 release gate, including database migration, seed, health, tests, and builds |
| `pnpm db:validate` | Validate the Prisma schema |
| `pnpm db:generate` | Generate the Prisma client |
| `pnpm db:deploy` | Apply committed migrations |
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
