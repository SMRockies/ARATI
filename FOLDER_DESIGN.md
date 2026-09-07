# Folder Design

This document defines how the Arati Business ERP repository is organized. It is the reference for placing application code, shared packages, infrastructure, documentation, and project evidence.

## Repository Principles

- Keep the ERP as a modular monolith until a documented scaling or ownership reason justifies extraction.
- Keep PostgreSQL and the backend domain layer authoritative for transactional state.
- Organize code by business capability inside the backend rather than by technical utility alone.
- Keep shared packages small and dependency-light; do not move domain behavior into generic shared folders.
- Keep generated output, secrets, local data, and build artifacts out of version control.
- Every new top-level folder must have a clear owner and purpose documented here.

## Current Root Layout

The repository currently contains the project planning and source-document baseline:

```text
ARATI/
├─ .github/
│  └─ skills/                         # Project-specific implementation guidance
├─ pdf_text/                          # Extracted text used to inspect source documents
├─ scripts/                           # Root validation and developer workflow scripts
├─ tests/                             # Repository-level and cross-module test suites
├─ *.pdf                              # Approved project source documents
├─ EXECUTION-PLAN.md                  # Program-wide delivery phases and gates
├─ PHASE-0-IMPLEMENTATION-PLAN.md     # Foundation implementation plan
├─ PHASES_v1.0.md                     # Versioned phase definitions
├─ FOLDER_DESIGN.md                   # This folder and ownership reference
└─ CHANGELOG.md                       # Chronological record of repository changes
```

The `pdf_text/` directory is a working reference derived from the PDFs. The PDFs remain the source documents unless a decision record explicitly says otherwise.

## Target Application Layout

The implementation should grow toward this structure:

```text
ARATI/
├─ apps/
│  ├─ api/                            # NestJS API and server-side business logic
│  │  └─ src/
│  │     ├─ common/                   # Cross-cutting pipes, errors, guards, logging
│  │     ├─ config/                   # Runtime configuration and environment mapping
│  │     ├─ health/                   # Health and readiness endpoints
│  │     ├─ auth/                     # Authentication, sessions, roles, permissions
│  │     ├─ organization/             # Organizations, branches, warehouses, locations
│  │     ├─ parties/                  # Customers, dealers, suppliers, counterparties
│  │     ├─ products/                 # Products, categories, units, taxes, pricing
│  │     ├─ procurement/              # Purchase orders, receipts, supplier workflows
│  │     ├─ inventory/                # Stock ledger, balances, transfers, adjustments
│  │     ├─ sales/                    # Sales orders, invoices, POS, posting
│  │     ├─ payments/                 # Collections, allocations, reversals
│  │     ├─ returns/                  # Sales and purchase returns, corrections
│  │     ├─ fulfilment/               # Delivery, installation, warranty workflows
│  │     ├─ reporting/                # Operational reports and read models
│  │     ├─ audit/                    # Append-only audit history and traceability
│  │     └─ integrations/             # TallyPrime and other external boundaries
│  ├─ worker/                         # Background jobs and retryable integration processing
│  └─ web/                            # Next.js ERP user interface
│     └─ src/
│        ├─ app/                      # Routes and page composition
│        ├─ features/                 # UI grouped by business capability
│        ├─ components/               # Reusable UI components
│        ├─ lib/                      # API client, session, and UI utilities
│        └─ styles/                   # Global styles and design tokens
├─ packages/
│  ├─ config/                         # Shared TypeScript, lint, and formatting config
│  ├─ db/                             # Prisma schema, migrations, seeds, and database client
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma             # Authoritative Prisma schema definition
│  │  │  ├─ migrations/               # Version-controlled schema changes
│  │  │  └─ seed/                     # Generic development-only seed data
│  ├─ types/                          # Stable shared contracts and transport types
│  ├─ logger/                          # Shared structured logging primitives
│  └─ ui/                             # Optional reusable frontend primitives
├─ infra/
│  ├─ compose/                        # Docker Compose definitions
│  ├─ docker/                         # Dockerfiles and container support
│  └─ scripts/                        # Setup, migration, backup, and verification scripts
├─ tests/
│  ├─ integration/                    # Cross-module and database-backed tests
│  ├─ e2e/                            # End-to-end API and browser workflows
│  └─ fixtures/                       # Safe, deterministic test data
├─ docs/
│  ├─ decisions/                      # Approved architectural and business decisions
│  ├─ api/                            # API usage and contract documentation
│  ├─ operations/                     # Runbooks, deployment, backup, and recovery
│  └─ security/                       # Security controls and review evidence
├─ .github/
│  └─ workflows/                      # CI/CD workflows
├─ .env.example                       # Documented non-secret environment template
├─ docker-compose.yml                 # Local service orchestration entry point
├─ package.json                       # Root scripts and workspace metadata
├─ pnpm-workspace.yaml                # Workspace package declarations
└─ tsconfig.base.json                 # Shared TypeScript baseline
```

## Ownership Rules

### Backend modules

Each module owns its domain use cases, validation, authorization checks, persistence orchestration, and module-level tests. Modules may call another module through an explicit service or application contract, not by reaching into another module's internal files.

Inventory and payment state are especially controlled:

- Only the inventory module may create stock-affecting movements or balances.
- Only the payments and sales domain flows may create or reverse payment effects.
- Posted financial and stock transactions are corrected through cancellation, reversal, return, or adjustment workflows rather than silent deletion or mutation.

### Database package

`packages/db` owns the Prisma schema, version-controlled migrations, generic development seed data, database client setup, and database-level integrity constraints. Migration tests must run before application integration tests. Business workflows remain in `apps/api`; the database package must not become an unstructured dumping ground for domain logic.

### Background workers and integrations

`apps/worker` owns asynchronous job execution, retry handling, reconciliation jobs, and outbox processing. An API transaction writes the durable integration or outbox record; a worker then invokes the external adapter. TallyPrime and other external systems must not be called directly as a prerequisite for completing the core ERP transaction.

### Frontend

`apps/web` owns presentation and user interaction. It may validate input for usability, but it must never be the authority for permissions, prices, stock, totals, posting, or other critical business rules.

### Infrastructure and documentation

- `infra/` contains reproducible runtime and operational automation.
- `scripts/` contains lightweight root workflow checks; domain or deployment scripts belong under the owning application or `infra/scripts/`.
- `tests/` contains repository-level, integration, and end-to-end test suites; module unit tests may remain next to their owning module.
- `docs/` contains durable decisions and operational guidance.
- Root Markdown files contain repository-wide orientation, plans, and change history.
- `.github/` contains automation and project guidance, not application runtime code.

## Placement Rules

- Put a new business capability under the owning backend module and matching frontend feature area.
- Put reusable code in `packages/` only after at least two consumers need the same stable contract or implementation.
- Put database migrations only under `packages/db`.
- Put generic development seed data only under `packages/db/prisma/seed`; never use production data as seed data.
- Put asynchronous job handlers and retry policies under `apps/worker`; keep external adapters behind the integration boundary.
- Put tests near the code when they are unit or module tests; put cross-module and end-to-end tests under `tests/`.
- Put temporary investigation output outside the repository or remove it before merging.
- Never commit `.env` files, credentials, local database volumes, build output, coverage output, or dependency directories.
- Update this file when adding or changing a top-level directory or a module boundary.
- Add a `CHANGELOG.md` entry for every committed repository change.
