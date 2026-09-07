---
name: arati-erp-implementation
description: "Use when analyzing, validating, implementing, or reviewing the Arati Business ERP across business requirements, module design, database modeling, API contracts, security controls, and production-readiness checks."
---

# Arati ERP Implementation Skill

## Purpose

This skill turns the Arati Business ERP project documents into an implementation-ready workflow. It is meant for requirement review, design validation, API and database checks, security review, and delivery planning for a distribution + wholesale + retail ERP with TallyPrime accounting integration.

## Core Project Context

Use the following facts as the default baseline when analyzing the system:

- Product: Arati Business ERP
- Primary scope: distribution, wholesale, retail/POS, inventory, and ERP operations
- Accounting boundary: TallyPrime remains the accounting platform for the initial release
- Architecture style: modular monolith, not premature microservices
- Transactional source of truth: PostgreSQL
- Core priorities: transaction correctness, inventory integrity, financial integrity, security, auditability, maintainability, and operational simplicity
- Principle: the ERP is the operational source of truth; frontend state, caches, queues, and external systems are not authoritative

## Workflow

### 1. Confirm business scope before implementation

Start by validating the business boundary and scope.

- Confirm the operating model is generic and configurable, not tied to a brand, supplier, customer, or product-specific rule.
- Confirm the ERP covers procurement, inventory, sales, payments, returns, fulfilment, delivery, installation, warranty, reporting, and integration orchestration.
- Confirm that TallyPrime is an external accounting system and not the ERP’s operational core.
- Treat any missing business rule as TBD unless the business explicitly confirms it.

### 2. Map the domain modules and ownership

Break the solution into the relevant modules and ensure responsibilities are explicit.

- Auth and identity
- Organization and locations
- Parties and customers/dealers/suppliers
- Products and pricing
- Procurement and purchasing
- Inventory and stock movements
- Sales and POS
- Payments and receivables/payables
- Returns and corrections
- Fulfilment, delivery, installation, and warranty
- Reporting and audit
- Integrations and Tally sync
- Settings and configuration

Important: inventory must not be changed by arbitrary modules; all stock-affecting operations must pass through controlled inventory logic.

### 3. Validate the requirements against business rules

Check each requirement against the project rule set before coding.

- Requirements must be traceable to the BRD and SRS.
- Critical rules are server-enforced, not frontend-only.
- Important posted transactions must not be silently deleted or edited.
- Corrections must use approved mechanisms such as cancellation, reversal, returns, adjustments, or corrective transactions.
- Transactions must belong to an organization and, where relevant, a branch and warehouse.
- Users must only operate inside authorized scope.
- Master data should use controlled lifecycle management; prefer deactivation over deletion.

### 4. Design the architecture around integrity and reliability

Use the architecture baseline as the guardrail for implementation choices.

- Prefer a modular monolith initially.
- Keep one transactional source of truth: PostgreSQL.
- Keep business logic server-side.
- Keep external systems isolated behind explicit integration boundaries.
- Treat Tally, email, SMS, object storage, and other integrations as asynchronous and retryable, never as core dependencies for transaction completion.
- Use background jobs/outbox patterns for integration work where appropriate.
- Do not add microservices unless there is a clear reason such as scaling, deployment isolation, team ownership, or reliability boundary.

### 5. Model the database with integrity first

Design persistence using the documented database rules.

- Use PostgreSQL as the authoritative operational database.
- Use UUIDs for application entities and human-readable document numbers separately.
- Use timestamptz for event and audit times; preserve organization timezone separately.
- Use numeric(19,4) or an approved equivalent for money; never float for financial values.
- Use numeric(19,6) as a general quantity baseline unless the unit model requires more precision.
- Use foreign keys, unique constraints, and check constraints for important integrity rules.
- Keep inventory movements append-oriented and balances as transactional projections.
- Maintain audit records as append-only and protected from ordinary modification.
- Scope data by organization_id and support multi-branch and multi-warehouse structures without redesign.

### 6. Design the API contract and server-side validation model

Validate all API behavior against the documented contract and security expectations.

- Use REST + JSON + HTTPS + versioned endpoints.
- Keep the base path at /api/v1.
- Enforce authentication, authorization, request validation, business validation, and database constraints.
- Reject invalid client input; do not trust browser state or UI-supplied IDs/values.
- Enforce permissions server-side independent of frontend visibility.
- Do not expose SQL errors, stack traces, internal file paths, or sensitive integration details.
- Use idempotency keys for payment creation, invoice posting, returns, stock transfer posting, and integration retries.
- Prefer domain actions for posting/canceling instead of direct delete operations on financial or stock transactions.

### 7. Review security and protection controls before release

The security model is critical to the project and must be treated as a full system requirement.

Check for:

- least privilege for users, services, APIs, workers, and integrations
- deny-by-default access controls
- strong authentication and session management
- role-based and object-scoped authorization
- no trust of the browser or frontend for critical decisions
- defense in depth across network, application, and database layers
- auditability of important actions with user, time, organization, branch, and resource metadata
- fail-closed handling when authorization or integrity cannot be safely established
- isolation of external systems and secure configuration defaults

### 8. Validate delivery against acceptance-quality checks

Before considering the implementation ready, verify all of the following:

- The requirement can be traced from BRD → SRS → design → API/database/security decisions.
- The public website is intentionally deferred and does not distort ERP scope.
- Inventory and financial logic are not circumvented by UI or client-side rules.
- PostgreSQL remains the authoritative transactional record.
- TallyPrime integration is isolated, retryable, and reconciliable without blocking ERP operations.
- Authorization is enforced on the backend.
- Audit logs exist for sensitive actions.
- No sensitive or operationally critical actions are possible through unauthorized state.
- Missing business policies are explicitly marked TBD, not guessed.

## Decision Points and Branching

### If the requirement impacts stock or money

- Require server-side validation and atomic transactions.
- Route the operation through the inventory and accounting rules, not direct UI state changes.
- Preserve historical records and use reversal/cancellation/adjustment patterns for corrections.

### If the requirement crosses into TallyPrime

- Treat the ERP as the operational source of truth.
- Keep Tally synchronization asynchronous, idempotent, and recoverable.
- Never let Tally availability block ERP transaction completion.

### If a business policy is unclear

- Do not assume behavior.
- Mark the item as TBD and request business confirmation.
- Keep the design generic until the policy is confirmed.

### If a module seems to own inventory or financial state directly

- Stop and review the domain boundaries.
- Ensure the stock, payment, and ledger logic flows through the central ERP domain, not a local shortcut.

## Quality Criteria

A solution is considered aligned with this project when it satisfies all of the following:

- It respects the modular monolith architecture and does not introduce unnecessary services.
- It keeps PostgreSQL authoritative for ERP state.
- It enforces business rules at the server and database boundary.
- It protects inventory and financial integrity.
- It keeps auditability and user traceability complete.
- It supports multi-branch, multi-warehouse, and future growth without redesign.
- It secures access using role/permission plus object-level scope checks.
- It treats integrations as external and recoverable, not core blockers.
- It preserves business history instead of silently mutating posted transactions.

## Example Prompts

- Review this ERP requirement for integrity, security, and architectural compliance.
- Check whether this API follows Arati ERP authorization and validation rules.
- Propose the missing database schema for the inventory and sales flow in this project.
- Identify any security or transaction risks in this sales/purchase implementation.
- Compare this design against the Arati ERP architecture and business rules.
- Draft a test checklist for an ERP posting flow based on the project documents.

## Suggested Follow-On Customizations

- Create a project-specific instruction file for database and transaction integrity.
- Create a security review prompt for ERP API and authorization checks.
- Create a requirements-to-implementation checklist for new ERP modules.
- Create an integration-review skill for TallyPrime and external service boundaries.
