# Phase 0 Implementation Plan

## 1. Phase purpose

Phase 0 establishes the engineering foundation for the Arati Business ERP so that the project can be built, started, migrated, tested, and demonstrated from a clean checkout. This phase does not deliver business modules; it creates the stable platform on which all ERP features will be built.

The phase should leave behind a real, runnable application with:

- a monorepo structure
- frontend shell
- backend shell
- PostgreSQL connectivity
- Prisma migration support
- health and readiness endpoints
- environment validation
- test and CI gates
- a single verification command

---

## 2. Architecture baseline

Use the project’s approved baseline:

- modular monolith architecture
- PostgreSQL as transactional system of record
- NestJS backend for business logic and APIs
- Next.js/React frontend for ERP shell and later features
- Prisma ORM for schema, migrations, and query access
- Docker Compose for local database and service orchestration
- pnpm as workspace package manager
- security-first defaults for configuration, logging, and runtime behavior

---

## 3. End-state objective for Phase 0

By the end of Phase 0, the project must be capable of the following from a clean workspace:

1. install dependencies
2. start PostgreSQL via Docker
3. run database migrations
4. start the backend
5. verify health/readiness endpoints
6. start the frontend shell
7. run the project verification command
8. build successfully without errors

This is the minimum production-shaped baseline required before feature work begins.

---

## 4. Repository structure

Proposed starter monorepo structure:

```text
arati-erp/
├─ apps/
│  ├─ web/                 # Next.js frontend
│  └─ api/                 # NestJS backend
├─ packages/
│  ├─ config/              # shared ts/eslint config
│  ├─ db/                  # Prisma schema and migrations
│  ├─ types/               # shared DTOs and domain types
│  ├─ logger/              # structured logging helpers
│  └─ ui/                  # shared frontend primitives (optional)
├─ infra/
│  ├─ docker/
│  ├─ scripts/
│  └─ compose/
├─ .github/
│  └─ workflows/
├─ .env.example
├─ .gitignore
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ docker-compose.yml
├─ README.md
└─ .eslintrc.js / .prettierrc
```

---

## 5. Phase 0 subphases

Phase 0 is divided into five smaller, executable subphases. Each subphase must end with a working program slice that runs without errors and is fully testable. No subphase is considered complete until the intended features for that subphase are functioning in a fresh environment.

### Subphase 0.1 — Repository, workspace, and local runtime boot

#### Objective

Create the monorepo foundation and the local developer runtime so the team can install dependencies and run the project from a clean checkout.

#### In-scope features

- pnpm workspace initialization
- shared TypeScript configuration
- root scripts for install, dev, build, lint, typecheck, test, and verify
- environment template and validation setup
- Docker Compose for PostgreSQL and local infrastructure
- basic repository conventions and README onboarding

#### Executable result at end of subphase

A developer can:

1. clone the repo
2. install dependencies
3. copy .env.example to a local config
4. start the supporting services
5. run the root workspace scripts without configuration errors

#### Exit criteria

- `pnpm install` succeeds
- root scripts run without missing-file or config errors
- Docker services are defined and start correctly
- .env template is complete and documented
- there are no broken startup commands

#### Verification

- run `pnpm install`
- run `pnpm lint -- --help` or equivalent smoke check
- start Docker Compose services and confirm they come up cleanly

---

### Subphase 0.2 — PostgreSQL, Prisma, and database migration foundation

#### Objective

Establish the database layer so the application can connect to PostgreSQL and manage schema changes in a reproducible way.

#### In-scope features

- PostgreSQL container configuration
- Prisma schema generation
- Prisma client configuration
- initial schema migration
- migration reset workflow
- database connection configuration and health checks

#### Executable result at end of subphase

The system can:

1. start PostgreSQL from Docker
2. run Prisma migrations from scratch
3. connect the backend to the database
4. report database readiness status without crashing

#### Exit criteria

- empty database can be migrated from scratch
- Prisma client initializes without runtime exceptions
- database connection and pooling are stable
- migration commands are reproducible and documented
- no manual database repair is required

#### Verification

- run the migration command from a clean database state
- run a DB connectivity smoke test
- confirm the app can query the database and return a valid connection status

---

### Subphase 0.3 — Backend runtime and API baseline

#### Objective

Build the backend shell so the API can start cleanly, handle errors consistently, and expose health/readiness endpoints as the first real runtime interface.

#### In-scope features

- NestJS application bootstrap
- modular service structure
- validation pipe and request parsing
- API error conventions
- structured JSON logging
- request correlation ID middleware
- security headers and server hardening defaults
- health and readiness endpoints

#### Executable result at end of subphase

The backend is a real service that can:

1. start successfully
2. respond to health endpoint requests
3. respond to readiness checks
4. return consistent structured errors
5. log requests with correlation IDs

#### Exit criteria

- backend boots without runtime exceptions
- health endpoint returns HTTP success
- readiness endpoint reports service state correctly
- validation errors are normalized and consistent
- security defaults are active

#### Verification

- start backend in dev mode
- curl or call the health endpoint
- call a failing endpoint to confirm standard error formatting
- confirm app startup logs include trace context

---

### Subphase 0.4 — Frontend shell and application startup

#### Objective

Create the minimal UI shell so a user can open the ERP application, confirm the frontend renders, and the UI can later integrate to backend APIs.

#### In-scope features

- Next.js app bootstrapping
- app shell layout and navigation shell
- environment configuration for API target
- design-system baseline or minimal styling container
- dashboard placeholder page
- frontend startup smoke validation

#### Executable result at end of subphase

The frontend can:

1. start successfully
2. render without runtime crash
3. display an ERP shell or landing page
4. communicate with runtime configuration without missing env values

#### Exit criteria

- frontend loads in browser without errors
- shell renders correctly on first load
- no blank page, hydration crash, or broken provider startup
- app is ready for module-level feature work in later phases

#### Verification

- run frontend dev server
- load the app in browser
- confirm page renders and dev console has no blocking runtime errors
- check API base URL configuration resolves correctly

---

### Subphase 0.5 — Quality gates, CI, and release verification

#### Objective

Turn the project into a clean, reproducible release candidate by enforcing automated checks and a single verification command.

#### In-scope features

- unit test framework
- backend smoke tests
- database smoke tests
- frontend render smoke tests
- CI workflow for lint, typecheck, test, and build
- canonical `pnpm verify` command
- final build validation

#### Executable result at end of subphase

The project can be run and verified as a complete phase checkpoint:

1. install dependencies
2. start database
3. run migrations
4. start backend
5. start frontend
6. run `pnpm verify`
7. build successfully
8. all checks pass without manual intervention

#### Exit criteria

- lint passes
- typecheck passes
- test suite passes
- build succeeds
- CI mirrors local verification
- all phase 0 functionality is demonstrable in a clean environment

#### Verification

- run `pnpm verify`
- run production build
- confirm the project is runnable from a fresh checkout
- confirm no build-breaking, test-breaking, or startup-breaking errors remain

---

## 6. Subphase completion rule

Each subphase must satisfy the same rule:

> At the end of that subphase, the feature set for that subphase must be executable, error-free, and demonstrable without hand fixes or hidden setup steps.

This ensures Phase 0 is not a single large, fragile block. It is a sequence of stable checkpoints, each leaving behind a runnable increment of the same product.

---

## 7. Final Phase 0 completion gate

Phase 0 is complete only when all five subphases are finished and the complete program can do the following from a clean environment:

1. install dependencies
2. start PostgreSQL
3. migrate the database
4. start backend and confirm health/readiness
5. start frontend shell
6. run `pnpm verify`
7. build successfully
8. no runtime, migration, or test errors remain

This is the minimum standard for any phase in the ERP roadmap.

## 6. Formal acceptance scenarios

The phase is complete only when these scenarios can be demonstrated successfully:

1. Clone repository and install dependencies.
2. Start PostgreSQL using Docker Compose.
3. Run migrations successfully.
4. Start backend and confirm health endpoint is returning success.
5. Start frontend shell and confirm it renders without errors.
6. Run `pnpm verify` and confirm all checks pass.
7. Run production build and confirm it completes successfully.

---

## 7. Security and quality guardrails for Phase 0

Even though business features are not yet implemented, the foundation must include baseline controls:

- environment variables are validated at startup
- secrets are not committed to source control
- CORS is restricted and explicit
- security headers are enabled by default
- logs are structured and request-aware
- debug and permissive settings are disabled in production-safe mode
- database credentials are managed via environment configuration

---

## 8. Definition of done for Phase 0

Phase 0 is done only when all of the following are met:

- the repository installs cleanly from a fresh checkout
- PostgreSQL is startable and migratable
- backend starts and responds to health/check endpoints
- frontend shell loads without runtime errors
- automated tests pass for the foundation layer
- `pnpm verify` passes
- build succeeds
- README contains setup, start, migrate, and verification instructions
- known phase limits are documented as deferred work rather than hidden problems

---

## 9. Deferred work after Phase 0

These are intentionally not in scope for Phase 0 and should be tracked separately:

- RBAC and organization model
- products, parties, and master data
- procurement workflows
- inventory and stock movement logic
- sales, POS, and payment processing
- returns, delivery, installation, and warranty workflows
- reporting and audit dashboards
- TallyPrime integration and reconciliation

---

## 10. Recommended timeline

### Week 1

- repo initialization
- TypeScript and workspace config
- linting, formatting, env template
- Docker and PostgreSQL setup

### Week 2

- backend foundation
- Prisma schema and migrations
- health endpoints
- logging and request correlation
- security baseline

### Week 3

- frontend shell
- smoke tests
- CI pipeline
- canonical verification command
- README and demo runbook

This sequence provides a clean, verifiable foundation without overlapping the business feature work that belongs to later phases.

---

## 11. Phase 0 summary

Phase 0 is the launch platform for the ERP. It turns the project from an idea into a real, runnable system that can be built, migrated, tested, and demonstrated. Once this phase is complete, the team can move into identity, organization, and master-data work with a stable base and known engineering quality gates.
