# PHASES.md

## Arati Business ERP — Implementation Phases & Executable Milestones

**Version:** 1.0  
**Status:** Implementation Roadmap Baseline — Draft for Cross-Document Review  
**Priority:** ERP first; public website later

---

## 1. Purpose

This document defines the implementation sequence for the ERP.

The phase plan is intentionally designed so development does **not** produce long periods of non-runnable code.

> **Every completed phase must leave behind a runnable, testable, error-free program that demonstrates all functionality completed up to that phase.**

A phase is complete only when:

1. the program starts successfully;
2. the database can be created/migrated from a clean environment;
3. all functionality promised for that phase is executable;
4. automated tests pass;
5. regression tests for all previous phases pass;
6. lint/type/build checks pass;
7. there are no known release-blocking errors;
8. the phase acceptance scenarios can be demonstrated;
9. the phase is tagged/versioned as a reproducible checkpoint.

---

## 2. Phase Completion Philosophy

### 2.1 Vertical slices

Avoid building the whole frontend first, then backend, then database.

Prefer:

**UI → API → application/domain logic → database → audit/integration boundary → tests**

Each phase should implement a usable vertical slice.

### 2.2 No broken phase checkpoint

During development a phase may contain incomplete work. The committed phase checkpoint must not depend on unfinished functionality.

At phase end:

- unfinished features are excluded or feature-gated;
- broken routes are removed or disabled;
- migrations are reproducible;
- seed/demo data is reproducible;
- automated checks are green;
- known limitations are documented and non-blocking.

### 2.3 Phase-end question

At the end of every phase we must be able to answer:

> **What can I run right now, and what can I demonstrate right now?**

---

# 3. Definition of Phase Done

A phase is **DONE** only if all mandatory gates pass.

### Gate A — Source quality

- TypeScript/type checks pass.
- Lint passes.
- Formatting check passes.
- No build-breaking errors.
- No required-for-this-phase unresolved TODOs.

### Gate B — Application startup

- Backend starts successfully.
- Frontend starts successfully.
- Required workers/processes start successfully.
- Health/readiness checks pass.
- No startup exception is ignored.

### Gate C — Database

- Fresh database can be created.
- All migrations apply successfully.
- Seed/demo data can be loaded.
- Required constraints are active.
- No manual database repair is required.

### Gate D — Functional execution

- Every phase requirement has an executable acceptance scenario.
- Critical workflows can be completed through the application.
- API and UI validation behave consistently.
- Authorization is enforced server-side.

### Gate E — Regression

- All previous phase tests pass.
- Previously accepted workflows are not broken.

### Gate F — Automated tests

Minimum expectation:

| Test type | Phase 0 | Phase 1+ |
|---|---:|---:|
| Unit | Required | Required |
| API/integration | Required | Required |
| Database integrity | Required | Required |
| E2E | Smoke | Required for critical flows |
| Security | Baseline | Required for relevant features |
| Regression | Baseline | Required |

### Gate G — Demonstration

A clean environment can demonstrate the phase without developer-only manual fixes.

### Gate H — Reproducibility

A fresh checkout can reproduce the phase checkpoint using documented commands.

---

# 4. Canonical Verification Command

The project should maintain one canonical verification command:

```bash
pnpm verify
```

It should eventually cover:

```text
dependency/configuration checks
format check
lint
typecheck
unit tests
integration/API tests
database migration tests
database integrity tests
build
E2E critical-path tests
security checks
```

The exact implementation is a technology decision, but the **single-command release gate is mandatory**.

> A phase must not be declared complete if `pnpm verify` fails.

If an external dependency is unavailable, CI must provide a reproducible test environment or an explicitly documented phase-specific substitute.

---

# 5. Executable Phase Requirement

Every phase must leave a real program behind.

For each phase, record:

```text
Phase:
Version/tag:
What is executable:
How to start:
How to seed/demo:
Demo workflow:
Automated verification:
Known limitations:
Deferred work:
Acceptance status:
```

The phase-end program is an increment of the same product, not a disposable demo.

---

# 6. Phase 0 — Engineering Foundation

## Objective

Create the smallest production-shaped application that can be built, started, tested, migrated and reproduced.

## Scope

- Repository/monorepo structure.
- TypeScript configuration.
- Next.js/React frontend shell.
- NestJS backend shell.
- PostgreSQL connection.
- Prisma setup.
- Initial migration infrastructure.
- Environment configuration/validation.
- Health and readiness endpoints.
- Structured logging foundation.
- Request/correlation ID foundation.
- API error conventions.
- Basic security headers/configuration.
- Docker development environment.
- Test framework.
- Canonical `verify` command.
- Basic CI.
- README/run instructions.

## Executable Program at End

The application can:

1. start frontend;
2. start backend;
3. connect to PostgreSQL;
4. report health/readiness;
5. execute API smoke tests;
6. run `pnpm verify`;
7. build successfully.

## Demo

```text
Start database
→ migrate
→ start backend
→ health check succeeds
→ start frontend
→ open application shell
→ run pnpm verify
→ all checks pass
```

## Exit Criteria

- Clean checkout works.
- Clean database migration works.
- Build works.
- Tests work.
- CI works.
- `pnpm verify` is green.

---

# 7. Phase 1 — Identity, Organization & Authorization

## Objective

Establish who can use the ERP and what organizational scope they can access.

## Scope

- Organization.
- Branch.
- Warehouse/location foundations.
- User accounts.
- Roles.
- Permissions.
- Authentication.
- Login/logout.
- Session revocation.
- Organization scoping.
- Branch/location authorization.
- Server-side object-level authorization.
- Security-sensitive audit foundation.
- Basic user administration.

## Executable Program at End

A user can:

1. log in;
2. log out;
3. be rejected with invalid credentials;
4. access only authorized organization/branch data;
5. reach an authorized dashboard;
6. manage permitted users;
7. demonstrate an authorization denial.

## Demo

```text
Seed organization + admin
→ login
→ view organization/branch
→ create restricted user
→ login as restricted user
→ authorized action succeeds
→ unauthorized action is rejected
→ audit record exists
```

## Exit Criteria

Authentication, authorization, organization isolation, role/permission, and session tests pass, with full regression green.

---

# 8. Phase 2 — Master Data & Product Catalog

## Objective

Create the core masters required by purchasing, inventory and sales.

## Scope

- Product categories.
- Brands.
- Products.
- Product variants/SKUs.
- Units of measure.
- Product tracking mode.
- Serial/batch configuration.
- Parties.
- Customer/supplier/dealer/distributor roles.
- Addresses/contact information.
- Product/party activation and deactivation.
- Search/filter/pagination.
- Basic price lists and entries.
- Master-data audit trail.

## Executable Program at End

A permitted user can:

1. create a product and SKU;
2. configure quantity/serial/batch/hybrid tracking;
3. create customer/supplier/dealer parties;
4. create/search/deactivate masters;
5. configure basic pricing;
6. use search/filtering;
7. demonstrate authorization boundaries.

## Demo

```text
Create category
→ create brand
→ create product
→ create variant
→ configure tracking
→ create supplier
→ create customer
→ create price list
→ assign price
→ search masters
→ deactivate a master
→ verify historical-safe behavior
```

## Exit Criteria

Master CRUD, historical protection, tracking configuration, pricing, search, and regression tests pass.

---

# 9. Phase 3 — Procurement & Inventory

## Objective

Make inventory real, traceable and transactionally safe.

## Scope

- Purchase workflow foundation.
- Goods receipt.
- Purchase invoice linkage.
- Purchase lines.
- Batch receipt.
- Serial receipt.
- Serial movement history.
- Inventory movement ledger.
- Inventory balance projection.
- Warehouse/location stock.
- Stock availability.
- Stock adjustments.
- Stock transfers.
- Concurrency protection.
- Negative-stock policy enforcement.
- Inventory audit trail.

## Executable Program at End

A user can:

1. receive purchased stock;
2. assign required batch/serial information;
3. see stock increase;
4. inspect movement history;
5. transfer stock between authorized locations;
6. perform an authorized adjustment;
7. see serial availability;
8. be prevented from creating invalid/negative stock states.

## Demo

```text
Create supplier
→ receive purchase
→ commit receipt
→ stock increases
→ inspect movement ledger
→ transfer stock
→ stock moves between locations
→ attempt invalid negative-stock operation
→ operation is rejected
→ verify stock remains consistent
```

## Exit Criteria

- Ledger is authoritative.
- Balance projection matches ledger.
- Serial/batch constraints pass.
- Concurrent stock operations are protected.
- No partial transaction state is possible.
- Inventory regression suite passes.

---

# 10. Phase 4 — Sales Engine & Retail POS

## Objective

Turn inventory into a complete transactional sales workflow.

## Scope

- Quotations.
- Sales orders.
- Sales invoices.
- Retail/POS.
- Wholesale/dealer sales using the same sales engine.
- Pricing resolution.
- Discounts.
- Tax calculation framework.
- Stock validation.
- Serial/batch allocation.
- Invoice posting.
- Stock deduction.
- Customer balance creation.
- Cancellation/reversal foundation.
- Invoice display/print representation.

## Executable Program at End

A user can:

1. search products;
2. create a retail sale;
3. create a wholesale/dealer sale;
4. resolve applicable price;
5. apply permitted discount;
6. select serial/batch;
7. post the invoice;
8. see stock decrease;
9. see a receivable if unpaid;
10. view/print the invoice representation.

## Demo

```text
Existing stock
→ open POS
→ search product
→ add item
→ select customer
→ resolve price
→ select serial/batch if required
→ post invoice
→ stock decreases
→ receivable created
→ invoice displayed
→ repeat with wholesale/dealer customer
```

## Exit Criteria

- Retail and wholesale use one authoritative sales engine.
- Stock and invoice posting are atomic.
- Duplicate serial sale is prevented.
- Pricing is server-authoritative.
- Critical POS flow has E2E coverage.
- Full regression passes.

---

# 11. Phase 5 — Payments, Receivables, Returns & Financial Operations

## Objective

Complete the core money lifecycle around purchases and sales.

## Scope

- Customer receipts.
- Supplier payments.
- Payment allocations.
- Partial payments.
- Multiple allocations.
- Receivables.
- Payables.
- Outstanding balances.
- Payment reversal.
- Sales returns.
- Purchase returns.
- Return eligibility.
- Return disposition.
- Approved credit/debit adjustments.
- Financial audit trail.

## Executable Program at End

A user can:

1. record customer payment;
2. allocate it to invoices;
3. see outstanding balance reduce;
4. record supplier payment;
5. process valid sales return;
6. process valid purchase return;
7. verify stock/financial effects;
8. reverse an eligible payment under controlled rules.

## Demo

```text
Post sale on credit
→ record partial receipt
→ allocate receipt
→ outstanding reduces
→ record second receipt
→ invoice closes
→ process sales return
→ stock/financial effect recorded
→ inspect audit trail
```

## Exit Criteria

Payment allocation, receivable/payable, return, reversal, atomicity, and regression tests pass.

---

# 12. Phase 6 — Fulfilment, Delivery, Installation & Warranty

## Objective

Track what happens after a sale.

## Scope

- Delivery orders.
- Partial delivery.
- Delivery item tracking.
- Delivery status.
- Installation jobs.
- Installation status/history.
- Technician/assignee foundation.
- Warranty records.
- Serial-linked warranty.
- Approved warranty start-date policy.
- Attachments/documents where required.
- Notifications for relevant events.

## Executable Program at End

A user can:

1. create delivery work from a sale;
2. fulfil all or part of a sale;
3. track delivery status;
4. create/complete installation work;
5. view warranty information;
6. trace a serial from purchase → stock → sale → delivery → installation → warranty.

## Demo

```text
Posted sale
→ create delivery
→ partial delivery
→ complete remaining delivery
→ create installation
→ complete installation
→ view serial history
→ view warranty
→ inspect traceability
```

## Exit Criteria

Partial fulfilment, delivery limits, installation traceability, warranty traceability, and regression tests pass.

---

# 13. Phase 7 — Reporting, Search & Operational Intelligence

## Objective

Make the operational system useful for daily management without creating a second source of truth.

## Scope

- Dashboard.
- Sales reports.
- Purchase reports.
- Stock reports.
- Stock movement report.
- Serial/batch reports.
- Receivable report.
- Payable report.
- Return report.
- Delivery/installation status.
- Approved profitability/reporting definitions.
- Advanced filtering.
- Export.
- Pagination.
- Query performance improvements.
- Report authorization.

## Executable Program at End

Management can:

1. view dashboard;
2. inspect sales/purchases;
3. inspect stock;
4. inspect outstanding receivables/payables;
5. trace serial/batch history;
6. export authorized report data.

## Exit Criteria

Reports reconcile to authoritative transaction data, respect authorization, handle large result sets, and pass regression.

---

# 14. Phase 8 — TallyPrime Integration

## Objective

Connect ERP operational data to TallyPrime without making Tally availability a dependency for ERP operations.

## Scope

- Tally connection configuration.
- Mapping configuration.
- Integration event/outbox processing.
- Queue/worker execution where justified.
- Sync attempts.
- Retry.
- Idempotency.
- Failure isolation.
- Sync status.
- Reconciliation.
- Authorized retry/replay.
- Integration audit trail.
- Agreed master/document mappings and direction.

## Executable Program at End

The ERP can:

1. complete normal transactions while Tally is unavailable;
2. create durable integration events;
3. attempt synchronization;
4. retry failures safely;
5. prevent duplicate posting;
6. show sync status;
7. reconcile ERP vs Tally;
8. recover through authorized retry.

## Demo

```text
Post ERP transaction
→ integration event created
→ simulate Tally unavailable
→ ERP transaction remains successful
→ sync fails safely
→ restore connectivity
→ retry
→ sync succeeds
→ duplicate replay is prevented
→ reconciliation is visible
```

## Exit Criteria

ERP independence, idempotency, retry, reconciliation, failure isolation, and security tests pass.

---

# 15. Phase 9 — Production Security Hardening

## Objective

Raise the ERP from development-ready to production-ready.

## Scope

- Full security configuration.
- MFA if approved.
- Session hardening.
- Rate limiting.
- WAF/edge configuration.
- Security headers.
- CORS/CSRF validation.
- File upload security.
- Export security.
- Secrets management.
- Admin protection.
- Audit protection.
- Security event monitoring.
- Dependency/security scanning.
- Container hardening.
- Database hardening.
- Backup protection.
- Restore testing.
- Disaster recovery procedures.
- Ransomware recovery procedures.
- Incident response runbook.
- Security testing/assessment.

## Executable Program at End

The production candidate can:

1. start in production-like configuration;
2. pass security tests;
3. reject unauthorized access;
4. protect sensitive operations;
5. generate security/audit events;
6. create backups;
7. restore a tested backup;
8. recover from documented failure scenarios.

## Exit Criteria

Protection baseline is implemented, security acceptance tests pass, backup restore is demonstrated, and critical vulnerabilities are resolved or formally accepted.

---

# 16. Phase 10 — Production Deployment & Operational Readiness

## Objective

Operate the ERP reliably for real business use.

## Scope

- Production infrastructure.
- TLS/domain.
- Production database.
- Monitoring.
- Logging.
- Alerting.
- Backup scheduling.
- Restore procedure.
- Deployment pipeline.
- Rollback procedure.
- Migration procedure.
- Incident response.
- Operational runbooks.
- Performance baseline.
- Production smoke tests.
- User onboarding.
- Initial data import.
- Go-live checklist.

## Executable Program at End

A production-like environment can:

1. deploy a tagged release;
2. run migrations safely;
3. start required services;
4. pass health/readiness checks;
5. perform core ERP transactions;
6. produce logs/metrics;
7. execute backup;
8. demonstrate restore;
9. roll back according to the documented procedure.

## Exit Criteria

Production smoke suite, backup/restore, monitoring/alerting, rollback, and go-live checks pass.

---

# 17. Phase 11 — Public Website Boundary & Website MVP

## Objective

Build the public website only after the ERP operational core is stable.

## Scope

- Public website shell.
- Business information.
- Approved product/catalog presentation.
- Contact/inquiry flow.
- Distributor/dealer information where approved.
- SEO basics.
- Performance/accessibility.
- Public API boundary.
- Security isolation.

## Executable Program at End

A visitor can:

1. open the website;
2. browse approved public information;
3. submit an inquiry;
4. receive confirmation;
5. remain isolated from internal ERP operations.

## Exit Criteria

- Website has no direct database access.
- Public APIs expose only approved data.
- Security boundary tests pass.
- ERP remains operationally independent.

---

# 18. Phase 12 — Post-MVP Enhancements

Only after the core system is stable.

Possible candidates:

- advanced analytics;
- additional integrations;
- mobile application;
- offline POS;
- customer portal;
- dealer portal;
- advanced notification channels;
- workflow customization;
- additional automation.

Every candidate requires explicit business value and architecture review.

No feature is added merely because it is technically interesting.

---

# 19. Cross-Phase Regression Rule

## Non-negotiable

When Phase N is completed:

> **The complete executable program must contain the accepted functionality of Phases 0 through N, and the complete regression suite for Phases 0 through N must pass.**

We do not create disconnected phase demos.

The phase-end artifact is an increment of the real ERP.

---

# 20. Acceptance Test Structure

Each phase should maintain:

### Unit tests

Examples:

- pricing;
- tax;
- stock validation;
- payment allocation;
- state transitions.

### Integration/API tests

Validate:

- API validation;
- authorization;
- database interaction;
- transactions;
- idempotency;
- audit generation.

### Database integrity tests

Validate:

- foreign keys;
- unique/check constraints;
- serial uniqueness;
- batch consistency;
- inventory invariants;
- payment allocation invariants.

### E2E tests

Complete user journeys such as:

```text
Login
→ create product
→ receive stock
→ sell product
→ collect payment
→ inspect balance
```

Later:

```text
Purchase
→ inventory
→ sale
→ delivery
→ installation
→ warranty
```

### Security tests

Examples:

- unauthorized access;
- cross-branch access;
- privilege escalation;
- replay;
- invalid object access;
- malicious file upload;
- unsafe export.

---

# 21. Phase-End Demo Data

Every phase requiring business data must have deterministic demo/seed data.

Seed data must be:

- safe to rerun;
- version controlled;
- non-production;
- representative;
- sufficient for the phase demo;
- compatible with migrations.

The demo must not depend on manually prepared developer data.

---

# 22. Phase-End Release Artifacts

Every completed phase produces:

```text
1. Working source code
2. Database migrations
3. Seed/demo data
4. Automated tests
5. Phase acceptance checklist
6. Verification output
7. Short accomplishment report
8. Known limitations/deferred items
9. Updated documentation
10. Git tag/release checkpoint
```

Suggested tags:

```text
erp-phase-00
erp-phase-01
erp-phase-02
...
```

---

# 23. Phase-End Completion Report

At the end of every phase, record:

```markdown
# Phase N Completion Report

## Status
PASS / FAIL

## Version / Git Tag
...

## What Was Delivered
- ...

## What Can Be Demonstrated
- ...

## Verification
- Lint: PASS/FAIL
- Typecheck: PASS/FAIL
- Unit: PASS/FAIL
- Integration/API: PASS/FAIL
- Database integrity: PASS/FAIL
- E2E: PASS/FAIL
- Security: PASS/FAIL
- Build: PASS/FAIL
- Full verify: PASS/FAIL

## Regression
All previous phase tests: PASS/FAIL

## Known Non-Blocking Limitations
- ...

## Deferred to Later Phase
- ...

## Release Decision
APPROVED / NOT APPROVED
```

---

# 24. No False "Complete" Status

A phase must be **FAIL / NOT APPROVED** if:

- the program does not start;
- migrations fail;
- build fails;
- required tests fail;
- a critical acceptance flow fails;
- previous phase functionality is broken;
- security-critical controls can be bypassed;
- data integrity can be violated;
- the demo requires undocumented manual database changes;
- a release-blocking error is known.

"Almost finished" is not DONE.

---

# 25. Meaning of "Error-Free"

"Error-free" means operationally stable, not a claim that software can never contain a bug.

At phase completion there must be:

### Mandatory

- no known release-blocking defects;
- no failing required automated tests;
- no build/type/lint failures;
- no broken accepted workflow;
- no known data-integrity violation;
- no known critical/high security defect left unresolved without formal acceptance;
- no runtime exception in accepted flows.

### Permitted

- explicitly documented non-blocking limitations;
- intentionally deferred features;
- low-priority issues that do not affect accepted functionality, provided they do not violate security or data integrity.

---

# 26. Definition of an Executable Phase

A developer or reviewer must be able to follow the documented setup instructions and reach a working application without undocumented intervention.

Minimum:

```text
checkout/tag
→ install dependencies
→ configure environment
→ start dependencies
→ migrate database
→ seed demo data
→ start application
→ execute phase demo
→ run verification
```

---

# 27. Business Decision Gate

Some phases depend on business decisions identified in the Business Rules baseline.

Relevant decisions include:

- GST/tax behavior;
- document numbering;
- credit limit behavior;
- negative stock policy;
- stock valuation;
- warranty start;
- return limits;
- approval thresholds;
- branch access;
- purchase workflow;
- order reservation;
- overpayment;
- Tally mappings/direction;
- retention;
- cancellation/reversal policies.

A phase must not silently invent an unresolved business policy.

---

# 28. High-Risk Phase Controls

The strongest acceptance evidence is required for:

1. Inventory
2. Sales posting
3. Payments
4. Returns
5. Authorization/isolation
6. Tally synchronization
7. Backup/restore
8. Production deployment

These areas require automated tests plus explicit demonstration.

---

# 29. Recommended Development Loop

For each feature:

```text
Requirement
→ business rule
→ database/API design
→ implementation
→ unit test
→ integration test
→ E2E test where applicable
→ security test where applicable
→ documentation
→ phase demo
→ full regression
```

For each phase:

```text
Plan
→ implement vertical slices
→ integrate
→ test continuously
→ stabilize
→ run full verification
→ perform phase demo
→ record completion report
→ tag stable checkpoint
→ start next phase
```

---

# 30. Phase-to-Document Traceability

| Phase | Primary documents |
|---|---|
| 0 | TECHSTACK, ARCHITECTURE, PROTECTION |
| 1 | SRS, BUSINESS-RULES, PROTECTION, DATABASE |
| 2 | SRS, BUSINESS-RULES, DATABASE |
| 3 | SRS, BUSINESS-RULES, DATABASE, ARCHITECTURE, PROTECTION |
| 4 | SRS, BUSINESS-RULES, DATABASE, ARCHITECTURE, PROTECTION |
| 5 | SRS, BUSINESS-RULES, DATABASE, ARCHITECTURE, PROTECTION |
| 6 | SRS, BUSINESS-RULES, DATABASE |
| 7 | SRS, DATABASE, ARCHITECTURE |
| 8 | SRS, ARCHITECTURE, DATABASE, PROTECTION |
| 9 | PROTECTION, ARCHITECTURE, TECHSTACK |
| 10 | PROTECTION, ARCHITECTURE, TECHSTACK |
| 11 | SRS, ARCHITECTURE, PROTECTION |
| 12 | All relevant documents |

---

# 31. Current Status

The project is currently at the **documentation/architecture baseline stage**.

The next implementation milestone is:

> **Phase 0 — Engineering Foundation**

No business functionality should be considered implemented until the Phase 0 executable checkpoint exists.

---

# 32. Phase 0 First Coding Checklist

The first coding checkpoint should establish:

- repository structure;
- package manager;
- TypeScript;
- Next.js frontend shell;
- NestJS backend shell;
- PostgreSQL;
- Prisma;
- environment validation;
- health/readiness endpoints;
- logging;
- error handling;
- testing;
- Docker development setup;
- CI;
- `pnpm verify`;
- README/run instructions.

The Phase 0 demo must be repeatable from a clean environment.

---

# 33. Final Non-Negotiable Rule

## Every phase ends with a working program.

Not a screenshot.  
Not a partial module.  
Not code that "should work."  
Not a frontend with mocked business logic.  
Not a database without usable workflows.

The end-of-phase deliverable is:

> **A runnable increment of the real ERP, containing everything accepted so far, verified by automated tests and a repeatable demo.**

If the current phase cannot be run cleanly, **the phase is not complete**.

---

## Status

**Version:** 1.0  
**Status:** Implementation Roadmap Baseline — Ready for Cross-Document Review

**Next artifact:** Use Cases / User Stories → ERD/API alignment
