# Database Package

`@arati/db` owns the Prisma schema, version-controlled migrations, development seed data, and database connectivity checks.

## Commands

Run these from the repository root:

```powershell
corepack pnpm --filter @arati/db validate
corepack pnpm --filter @arati/db generate
corepack pnpm --filter @arati/db migrate:dev --name initial_foundation
corepack pnpm --filter @arati/db migrate:reset
corepack pnpm --filter @arati/db seed
corepack pnpm --filter @arati/db health
```

The migration and seed commands require PostgreSQL from `docker compose up -d postgres`. The health command returns a JSON readiness result and exits nonzero when the database cannot be reached.

All schema changes must be made through a reviewed migration. Do not edit production tables manually as a normal deployment process.
