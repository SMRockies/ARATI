---
mode: agent
description: "Use when reviewing a requirement, design, API, database model, or module against the Arati ERP project baseline. Produces a structured assessment with risks, rule alignment, and implementation acceptance checks."
---

# Arati ERP Review

Review the provided item as part of the Arati Business ERP project using the official project baseline and constraints.

## Scope

Analyze the following type of work:

- business requirements and scope questions
- API contracts and request/response design
- database schema or relational data model choices
- module boundaries or architecture decisions
- authorization, access scope, and security review
- inventory, sales, purchasing, returns, payments, or delivery flows
- TallyPrime integration and reconciliation concerns
- implementation readiness and production-risk assessment

## Grounding Rules

Use these project principles as the default baseline:

- PostgreSQL is the authoritative transactional source of truth.
- The ERP is the operational source of truth for core business activity.
- TallyPrime is an external accounting system for the initial release.
- The architecture is a modular monolith, not premature microservices.
- Business logic must be enforced on the server, not in the UI.
- Inventory and financial integrity are higher priority than convenience.
- Latest requirements and contracts are grounded in the BRD, SRS, architecture, database, API, security, and technology documents.
- Missing or unclear business policy must be marked as TBD instead of guessed.

## Task

Evaluate the supplied requirement, design, API, or schema based on:

1. business fit with the Arati ERP scope
2. alignment with the project’s architecture and module boundaries
3. correctness of transaction and inventory rules
4. integrity of data and financial operations
5. authorization, access scope, and auditability
6. security and production-readiness concerns
7. TallyPrime integration boundaries and retry/reconciliation behavior

## Output Format

Return the result in this structure:

### 1. Summary
Briefly explain the requirement, design, or issue.

### 2. Alignment with Arati ERP Baseline
State whether it fits the project scope and architecture.

### 3. Risks and Issues
List issues such as:
- rule gaps
- security weaknesses
- inventory or financial integrity risks
- authorization problems
- unbounded business assumptions
- weak integration boundaries

### 4. Required Project Rules to Apply
Reference the relevant ERP principles, e.g.:
- server-side enforcement
- organization/branch/warehouse scope
- transaction atomicity
- auditability
- inventory ledger discipline
- no silent changes to posted history

### 5. Recommended Fix or Design Direction
Provide the concrete fix or design adjustment, if applicable.

### 6. TBD / Confirmation Needed
Call out unclear business policies that require explicit confirmation.

### 7. Acceptance Checks
List the conditions that must be true before implementation is considered ready.

## Quality Bar

Do not produce a generic answer. The output must be project-specific, implementation-aware, and rooted in the ERP documents rather than generic software advice.
