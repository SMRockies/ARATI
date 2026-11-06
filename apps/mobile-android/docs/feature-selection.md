# Feature selection and implementation boundary

## Source comparison

### ARATI

ARATI is the ERP program of record: a NestJS API, Prisma/PostgreSQL foundation, and Next.js web shell in a modular-monolith workspace. Its current database schema contains organizations, branches, warehouses, warehouse locations, and integration events. The current API module exposes the health foundation; inventory domain endpoints and product/stock models are not yet implemented.

The ERP requirements identify inventory as a core operational domain. They call for a movement ledger, stock-balance projection, warehouse/location association, availability rules, protection against negative stock, controlled adjustments, immutable history, and concurrency protection. The UI must not be the authority for stock or posting.

### ARATI_1

ARATI_1 is a Next.js site with an internal ERP mockup. The stock screen already demonstrates product search, stock-status filters, warehouse/tracking columns, and reorder indicators, but its records are a static TypeScript array. Its transfer, export, and adjustment controls are presentation-only. The POS screen also uses local fixture data and is not a posted sales workflow. The public contact/dealer/service forms have a separate SQLite-backed API, but that is not an ERP inventory capability.

## Selected feature: read-only stock overview

This is the best first Android slice because it:

1. aligns with the ERP's explicitly core inventory domain and the stock UI already explored in ARATI_1;
2. is useful on a phone for staff who need a quick warehouse stock lookup;
3. can be implemented as a vertical slice without inventing authority for inventory writes;
4. supports a local demo source now and a replaceable organization-API source when the server contract and access controls exist.

The scope intentionally excludes stock adjustments and transfers. The SRS requires those operations to create controlled ledger movements; exposing write controls before the server-side inventory engine and authorization are ready would be unsafe.

## Current data flow

```text
Compose stock screen
        |
        v
StockViewModel (loading, search, filter, refresh)
        |
        v
StockRepository
  |                   |
  | no API URL        | HTTPS API URL configured
  v                   v
Local demo fixture    GET /api/v1/inventory/stock
                          |
                          v
               organization API (future integration)
```

The API adapter is a client contract, not an assertion that the current backend already serves the route. The current server schema/API must first gain the inventory read model, authenticated access, and organization/warehouse scoping. API failures are shown rather than replaced with demo data.

## Additional mobile feature candidates

Static inventories of the supplied ERPNext Mobile and Zoho Inventory APKs identify useful workflow candidates, but are not proof that every workflow succeeds at runtime. The strongest next addition for ARATI is **barcode-assisted item lookup**, followed by a scan-assisted receiving/picking workflow that submits business transactions to the authoritative API.

See [mobile feature comparison](mobile-feature-comparison.md) for the APK identities, observed package evidence, confidence boundaries, and proposed rollout order. Do not add offline inventory writes or client-side stock adjustments based on another app's package contents: ARATI's inventory ledger, authorization, and conflict-handling rules remain authoritative.

## Evidence locations

- `../../../packages/db/prisma/schema.prisma` — current organization/location foundation.
- `../../../apps/api/src/app.module.ts` — current API module wiring.
- `../../../../ARATI_1/arati-refrigeration-software/src/app/erp/(admin)/stock/page.tsx` — stock screen presentation and interactions.
- `../../../../ARATI_1/arati-refrigeration-software/src/lib/data/stock.ts` — static stock fixture and demo threshold logic.
- `../../../pdf_text/Software Requirements Specification (SRS) (1).txt` — inventory rules, including movement-ledger ownership and no direct stock editing.
