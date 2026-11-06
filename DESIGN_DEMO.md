# Arati Business ERP — Product and Design Demonstration

**Status:** Design direction and product walkthrough
**Date:** 2026-09-08
**Product:** Arati Business ERP
**Primary scope:** Distribution, wholesale, retail/POS, inventory, and connected operations
**Accounting boundary:** TallyPrime remains the external accounting platform for the initial release

## 1. Purpose of This Document

This document explains what the Arati Business ERP is today, what it is intended to become, how the complete product should work, and what design direction will make it useful for real business operators.

It is both a product explanation and a design brief. It should help a stakeholder understand the product in a demonstration, help a designer shape the interface, and help the engineering team keep future screens aligned with the program's architecture and business rules.

The central idea is simple:

> Arati should give a distribution and retail business one dependable operational picture: what was bought, where it is, what can be sold, what was sold, what is owed, what must happen next, and who changed it.

The ERP must remain generic and configurable. It should support Arati's business without hard-coding one supplier, brand, product family, branch, or commercial relationship.

## 2. What the Program Is Now

### 2.1 Current product state

The project has completed its Phase 0 foundation. It is a production-shaped technical base, not yet a complete ERP.

Available today:

- A pnpm monorepo with shared TypeScript configuration.
- A Next.js web application shell at `/`.
- A NestJS API runtime with health and readiness endpoints.
- PostgreSQL and Prisma database infrastructure.
- An initial migration and generic development seed workflow.
- Organization, branch, warehouse, warehouse-location, and integration-event database models.
- Environment configuration and a documented local setup path.
- Request IDs, structured request logging, normalized API errors, and basic validation/security defaults.
- A responsive dashboard presentation with navigation, business-summary cards, recent activity, quick actions, and API connection status.
- Repository, API, web, database, build, and CI verification gates through `pnpm verify`.

### 2.2 What the current screen represents

The current web screen is a shell and visual direction. It provides the first impression of the future ERP but does not yet perform the business actions represented by the dashboard.

The following values are presentation placeholders and must not be mistaken for live data:

- Stock on hand.
- Open orders.
- Receivables.
- Recent activity.
- Quick actions such as new invoice, purchase order, stock transfer, and payment.

The current workspace and user labels are also demonstration content. They establish the intended context of an operator working inside a company and branch; they are not yet backed by identity, role, or organization APIs.

### 2.3 What is not implemented yet

The following business capabilities are planned but not available as complete workflows in the current build:

- Authentication, sessions, users, roles, and permissions.
- Organization, branch, warehouse, and location administration screens.
- Product, category, unit, tax, pricing, and stock-policy masters.
- Customer, dealer, supplier, and other party masters.
- Purchase orders and goods receipts.
- Controlled inventory movements, transfers, adjustments, serials, batches, and reconciliation.
- Sales orders, invoices, retail/POS posting, pricing overrides, and credit controls.
- Payment collections, allocation, reversal, receivables, and payables views.
- Sales and purchase returns and corrective transactions.
- Fulfilment, delivery, installation, warranty, and service history.
- Reports, audit search, operational monitoring, and administrative review screens.
- TallyPrime synchronization, retry handling, and reconciliation.

This distinction is important for demonstrations: Phase 0 demonstrates that the platform can run and be verified; later phases demonstrate business transactions.

## 3. What the Program Will Be

Arati will be an operational control system for a business that purchases, stores, distributes, sells, collects money, fulfils customer commitments, and needs reliable history.

It will not be only an accounting screen, only a stock register, or only a point-of-sale application. It will connect the whole operational chain while keeping responsibilities clear:

```text
Supplier and procurement
        -> receipt and stock
        -> warehouse movement
        -> sales or POS
        -> payment and receivable
        -> delivery / installation / warranty
        -> reports, audit, and TallyPrime synchronization
```

PostgreSQL will be the authoritative source of operational truth. The web interface, cached data, queues, and TallyPrime integration will never be allowed to invent or override stock, totals, permissions, or posted history.

The initial architecture should stay a modular monolith. One deployable backend can still have strong module boundaries, explicit application services, database transactions, and independent tests. Services should only be extracted later if scale, ownership, deployment isolation, or reliability makes that necessary.

## 4. Product Principles

### 4.1 Operational truth over visual convenience

A fast screen is valuable only when its answer is correct. Stock, totals, prices, credit decisions, posting, permissions, and status transitions must be validated on the server and protected by database constraints where appropriate.

### 4.2 Every important action has a history

Posted stock and financial transactions should not be silently edited or deleted. Corrections use cancellation, reversal, returns, adjustments, or corrective transactions. Sensitive actions record the user, time, organization, branch, resource, and reason.

### 4.3 Context is always visible

A user should always know which organization, branch, warehouse, date range, and role scope they are operating in. A transaction without clear ownership and location context is a risk.

### 4.4 Exceptions deserve attention

The product should make blocked, overdue, low-stock, awaiting-approval, failed-sync, and mismatched records easy to find. The dashboard should not hide difficult work behind attractive averages.

### 4.5 External integrations are recoverable

TallyPrime, messaging, and other external systems must be asynchronous and retryable. An ERP transaction should complete according to ERP rules even when an external system is unavailable. Operators need a visible queue, retry state, and reconciliation view.

### 4.6 Generic configuration, specific execution

The system should let each organization configure its catalog, branches, prices, tax behavior, approval policy, and roles. Once configured, the execution flow should be specific and unambiguous.

## 5. The Complete Functional Product

### 5.1 Identity and access

The user enters through secure authentication and receives access based on role, organization, branch, warehouse, and action scope.

Core capabilities:

- User invitations, activation, deactivation, and session management.
- Roles and permissions with deny-by-default behavior.
- Branch and warehouse scope assignments.
- Approval permissions for discounts, stock adjustments, cancellations, credit, and other sensitive actions.
- User activity and security history.
- Clear handling when authorization cannot be established: fail closed.

Example roles may include administrator, owner/manager, sales operator, procurement officer, warehouse operator, finance operator, service coordinator, and read-only auditor. The final catalog and approval matrix are business decisions and should remain explicitly configurable.

### 5.2 Organization and locations

Administrators manage the structure in which every operational record lives:

- Organization.
- Branches.
- Warehouses.
- Warehouse locations or bins.
- Organization timezone and operational settings.
- Active/inactive lifecycle state.

The interface should make location scope a first-class filter. A manager should be able to view the whole organization, while a warehouse operator should see only authorized locations.

### 5.3 Products and pricing

The product catalog is the shared language between procurement, inventory, sales, and reporting.

Core capabilities:

- Product code/SKU, name, description, brand, category, and unit.
- Alternate codes and barcode scanning support.
- Tax classification and configurable tax rules.
- Purchase and selling prices.
- Customer/dealer price lists and effective dates.
- Minimum, reorder, and maximum stock settings.
- Serial-number or batch tracking when required.
- Product activation and deactivation without destroying history.
- Import/export with validation and error reporting.

Product detail should show current stock by location, open purchase orders, recent sales, pricing history, and related service/warranty records without forcing the operator to search separate systems.

### 5.4 Parties

Parties represent customers, dealers, suppliers, service partners, and other counterparties.

Core capabilities:

- Party type and business relationship.
- Contact, address, tax, and payment terms.
- Credit limit and outstanding balance.
- Branch-specific relationship or service area.
- Contact history and linked transactions.
- Active/inactive state.
- Duplicate detection and controlled editing.

A party page should answer: what has this party bought or supplied, what is outstanding, what is due next, and which operational issues are open?

### 5.5 Procurement

Procurement begins with a requirement and ends with verified stock and a supplier obligation.

Suggested flow:

```text
Purchase request or need
  -> purchase order
  -> supplier confirmation
  -> goods receipt
  -> quantity / quality / serial verification
  -> stock movement
  -> supplier payable and Tally event
```

The purchase order screen should support lines, expected dates, price, tax, discounts, warehouse destination, and approval status. The receipt screen should allow partial receipts and discrepancy recording. Receipt posting must atomically create the controlled inventory effect and durable integration event.

### 5.6 Inventory

Inventory is the operational backbone and must have one controlled owner in the backend.

Core capabilities:

- Stock on hand by organization, branch, warehouse, location, product, serial, or batch.
- Append-oriented stock movement ledger.
- Balance projections for fast operational reads.
- Goods receipt.
- Stock transfer between locations or branches.
- Stock issue and fulfilment allocation.
- Approved stock adjustment with reason.
- Cycle count and reconciliation.
- Reserved, available, damaged, quarantined, and in-transit states where required.
- Serial and batch traceability.
- Stock aging and movement history.

No frontend action should directly mutate a balance. Every change should be a server-side domain action with authorization, validation, concurrency protection, an audit record, and an idempotency strategy where retries are possible.

### 5.7 Sales and POS

Sales must serve both account customers and fast retail transactions without creating two conflicting sources of truth.

Core capabilities:

- Sales quotation or order.
- Customer and price-list selection.
- Product search, barcode entry, availability, reservation, and substitution handling.
- Discounts and price overrides with permission/approval controls.
- Tax and total calculation on the server.
- Credit sale and immediate sale paths.
- Invoice posting and cancellation.
- Retail/POS mode optimized for keyboard, scanner, and quick payment.
- Print/download/share invoice output through a controlled server-generated document flow.
- Order fulfilment status.

The POS should feel fast, but not careless: the operator should see availability, customer, payment state, and final total before posting. After posting, the invoice becomes a historical record and corrections follow the approved return or reversal path.

### 5.8 Payments and receivables

Payments connect customer collections and supplier obligations to the operational record.

Core capabilities:

- Record cash, bank, UPI, card, cheque, and configured payment methods.
- Allocate a payment to one or more invoices.
- Record unallocated or advance receipts when policy permits.
- Payment reversal with authorization and reason.
- Customer outstanding and aging.
- Supplier payable and aging.
- Collection follow-up list.
- Receipt generation and audit history.
- Idempotency keys for payment creation and retry safety.

Financial decisions must never depend on a browser-supplied total or credit status. The server recalculates and validates the result inside the transaction.

### 5.9 Returns and corrections

Returns are business transactions, not delete buttons.

The return workflow should capture:

- Original invoice, receipt, or transaction reference.
- Returned line items and quantities.
- Reason and condition.
- Inspection outcome.
- Restock, quarantine, damage, or supplier-return decision.
- Credit/refund or payable adjustment.
- Required approval.
- Linked inventory and audit effects.

Users should be able to understand exactly what changed and why after a correction.

### 5.10 Fulfilment, delivery, installation, and warranty

After a sale, the ERP should continue to track the obligation rather than treating the invoice as the end of the story.

Core capabilities:

- Fulfilment queue and picking status.
- Delivery scheduling, assignment, dispatch, and proof of delivery.
- Installation appointment, technician assignment, checklist, and completion evidence.
- Warranty registration linked to product, serial/batch, customer, invoice, and installation.
- Warranty claim intake, status, diagnosis, resolution, and parts usage.
- Service history and customer communication record.
- Ownership and due dates for every open task.

This module should provide a clear operational queue: due today, overdue, blocked, waiting for customer, and completed.

### 5.11 Reporting and audit

Reports should support decisions and investigation, not merely display decorative charts.

Initial report families:

- Sales by period, branch, customer, product, and operator.
- Purchase and supplier performance.
- Stock on hand, movement, aging, low stock, reserved stock, and variance.
- Receivables, payables, collections, and aging.
- Returns and cancellations.
- Delivery, installation, warranty, and service performance.
- Tally synchronization status and reconciliation exceptions.
- Audit search by user, action, entity, branch, date, and reason.

Every report must state its date basis, scope, and whether it reflects posted data, operational projections, or pending work.

### 5.12 TallyPrime integration

TallyPrime remains the accounting system for the initial release. Arati remains the operational system.

The integration should:

- Create a durable outbox/integration event as part of the ERP transaction where required.
- Send approved event types through a worker and explicit adapter.
- Retry safely with backoff and idempotency.
- Expose pending, processing, succeeded, and failed states.
- Preserve the last error without exposing sensitive internals to ordinary users.
- Provide manual retry for authorized operators.
- Support reconciliation between ERP operational records and accounting acknowledgements.
- Never block a valid ERP transaction merely because TallyPrime is unavailable.

## 6. Recommended Information Architecture

The left navigation should reflect business responsibility and work frequency:

1. Overview
2. Sales & POS
3. Inventory
4. Procurement
5. Parties
6. Fulfilment
7. Payments
8. Reports
9. Administration
10. Integrations

The navigation should be permission-aware, but hidden navigation must never be treated as authorization. The API enforces access independently.

Each module should use a consistent pattern:

```text
Module landing page
  -> saved views and filters
  -> list/table with status and scope
  -> create or action drawer
  -> detail page with timeline
  -> controlled actions and audit history
```

The most important screens are:

- Overview dashboard.
- Sales/POS workspace.
- Inventory control tower.
- Purchase order and receipt workspace.
- Party account page.
- Payment allocation screen.
- Fulfilment queue.
- Audit and integration exception center.

## 7. Design Direction

### 7.1 Overall character

The product should feel like a calm, precise operations room: dependable, legible, and quietly confident. It should not resemble a public marketing website, a consumer shopping app, or a dashboard full of ornamental charts.

The existing shell already points in a good direction:

- Deep green navigation rail.
- Warm off-white working canvas.
- White, lightly bordered work surfaces.
- Restrained amber, blue, green, and red status accents.
- Editorial serif headings paired with practical sans-serif interface text.
- Low visual noise and no heavy shadow treatment.

Keep that identity, but evolve it into a more functional system as real modules arrive.

### 7.2 Visual system

Recommended design tokens:

- **Ink:** near-black green for headings and primary values.
- **Canvas:** warm, pale neutral for the application background.
- **Surface:** white for tables, forms, and focused work areas.
- **Navigation:** deep forest green as the brand anchor.
- **Action:** medium green for safe primary actions.
- **Attention:** amber for pending, due, and review states.
- **Information:** muted blue for informational states.
- **Risk:** restrained red for blocked, failed, reversed, and overdue states.
- **Borders:** thin neutral lines for grouping instead of large cards or shadows.

Use status color with text and icons, never color alone. Keep contrast accessible and ensure status meaning survives grayscale printing.

### 7.3 Typography

Use a purposeful two-family system:

- A distinctive, readable serif for page titles, major figures, and section headings.
- A highly legible sans-serif for navigation, tables, labels, controls, timestamps, and dense operational data.

Keep headings expressive but compact. Tables and forms should prioritize scanning over style. Avoid oversized hero typography inside the ERP.

### 7.4 Layout

The desktop layout should have:

- A persistent navigation rail with current workspace and user scope.
- A compact top bar with breadcrumb, organization/branch context, system status, notifications, and help.
- A constrained content column for dashboards and forms.
- Full-width table areas when comparison needs space.
- Sticky action bars for long forms and posting workflows.

Use cards only for genuinely framed tools, summary metrics, repeated records, and dialogs. Do not put whole page sections inside nested decorative cards.

### 7.5 Tables and dense work

ERP users often compare many records. Tables are a primary product surface, not an afterthought.

Tables should support:

- Strong column hierarchy and compact row height.
- Search, filters, saved views, date range, branch, warehouse, and status.
- Sortable columns and stable column widths.
- Row-level status, owner, due date, and document number.
- Bulk selection only for safe, explicitly authorized actions.
- Export with visible scope and timestamp.
- Empty, loading, partial, and error states.
- Keyboard navigation where operationally useful.

Do not hide important status or financial totals behind hover-only behavior.

### 7.6 Forms and posting flows

Forms should be task-oriented and progressive:

1. Select context and counterparty.
2. Add or scan items.
3. Review calculated quantities, prices, tax, and totals.
4. Resolve warnings and approvals.
5. Confirm the irreversible or posted action.
6. Show the resulting document, audit reference, and next actions.

The final confirmation should state what will change: stock, receivable/payable, fulfilment status, integration event, and document number. Destructive or irreversible actions require explicit reason and permission.

### 7.7 Dashboard design

The dashboard should become a work queue, not a gallery of metrics.

Recommended sections:

- Scope and date controls.
- A small set of authoritative headline metrics.
- Attention queue: low stock, overdue receivables, approvals, failed integrations, delayed deliveries.
- Recent activity with document links and actor.
- Trends only when they help a decision.
- Quick actions based on permission and role.
- System/integration health separated from business performance.

A warehouse operator, sales manager, and administrator should not see identical dashboards. The same design language can support role-specific priorities.

### 7.8 Responsive behavior

Desktop is the primary environment for administration and warehouse work, but the product must remain usable on smaller screens.

- Collapse the navigation into a compact mobile header.
- Keep primary action controls full-width when necessary.
- Turn wide tables into prioritized rows or horizontal scroll with frozen identity columns.
- Preserve document number, status, amount, and next action before secondary metadata.
- Keep touch targets large enough for warehouse and field use.
- Avoid shrinking text until it becomes unreadable.

POS should support keyboard/scanner workflows on desktop and a touch-friendly layout on a tablet.

### 7.9 Motion and feedback

Use motion to communicate state, not decoration:

- Short page-load reveal for the main work area.
- Staggered loading of dashboard queues when data arrives.
- Clear progress for posting, retrying, and long-running exports.
- Immediate confirmation after safe actions.
- Persistent, understandable error states for failed actions.

Do not use animation to disguise slow data or to make critical state changes ambiguous.

## 8. Demonstration Scenarios

### Scenario A — Current Phase 0 demonstration

1. Start PostgreSQL.
2. Apply the migration and seed generic data.
3. Start the API and confirm `/health` and `/ready`.
4. Start the web application.
5. Open the responsive Overview shell.
6. Show navigation, workspace context, placeholder metrics, activity feed, quick actions, and API connection text.
7. Run `corepack pnpm verify`.

The honest conclusion is: the platform foundation is runnable and verified; the dashboard is not yet data-backed.

### Scenario B — Procurement to stock

1. Sign in as a procurement user.
2. Select branch and destination warehouse.
3. Create and submit a purchase order.
4. Approve it according to policy.
5. Record a partial goods receipt.
6. Verify quantities and serial/batch details.
7. Post the receipt.
8. Open the product stock view and movement ledger.
9. Confirm the supplier payable and pending Tally event.
10. Temporarily make the integration unavailable and show that the ERP transaction remains recorded and retryable.

### Scenario C — Sale to collection

1. Open Sales or POS.
2. Select a customer or walk-in sale context.
3. Scan products and show available stock.
4. Apply an allowed price list or request an override approval.
5. Review tax, discount, and total calculated by the server.
6. Post the invoice.
7. Record and allocate a payment.
8. Show stock movement, customer outstanding, receipt, audit entry, and integration event.

### Scenario D — Return and correction

1. Find the original invoice.
2. Start a return and select returned quantities and reason.
3. Record inspection outcome.
4. Route the item to restock, quarantine, or damage.
5. Approve and post the return.
6. Show the linked inventory, credit/refund, audit, and integration effects.
7. Demonstrate that the original invoice remains historical.

### Scenario E — Fulfilment and warranty

1. Open the fulfilment queue.
2. Assign a delivery and installation task.
3. Record dispatch and proof of delivery.
4. Complete installation against the serial-numbered product.
5. Register warranty.
6. Open a warranty claim and record diagnosis and resolution.
7. Show the complete service history from the party or product page.

## 9. Phased Design and Delivery Recommendation

### Phase 1 — Foundation and shell

Keep the current visual shell, formalize design tokens, add routing conventions, and establish shared patterns for tables, forms, status, feedback, and permission-aware actions.

### Phase 2 — Identity, organization, and masters

Build administration screens before transactions. Make organization, branch, warehouse, product, party, role, and scope context reliable.

### Phase 3 — Procurement and inventory

Prioritize the inventory control tower, purchase order, goods receipt, stock transfer, adjustment, and movement ledger. This is the first phase where the product proves operational integrity.

### Phase 4 — Sales, POS, payments, and returns

Build the fast sales path alongside the account-sales path. Introduce posting confirmations, server-calculated totals, payment allocation, returns, and approval states.

### Phase 5 — Fulfilment and warranty

Add queues for delivery, installation, warranty, and service. Make ownership and due dates visible.

### Phase 6 — Reports and audit

Replace placeholder dashboard values with trusted read models, reports, and audit search. Show report scope and freshness.

### Phase 7 — Security and Tally integration

Complete authorization review, integration worker, retry controls, reconciliation, and operational monitoring.

### Phase 8 — UAT and go-live

Validate real scenarios, performance, backup/recovery, training, support, and release readiness.

## 10. Decisions That Must Stay Explicit

These items should not be silently guessed in design or code:

- Authentication and session model.
- Exact role, permission, and approval matrix.
- GST/tax and invoice accounting rules.
- SKU uniqueness and product identity policy.
- Money and quantity precision.
- Credit-limit and overdue-sale behavior.
- Return/refund policy and restocking rules.
- Serial/batch requirements by product category.
- Idempotency retention and retry behavior.
- Organization timezone and reporting cut-off rules.
- TallyPrime document mapping and reconciliation ownership.

Each unresolved item should have an owner, decision date, and recorded outcome.

## 11. Design Quality Checklist

Before calling a module ready for demonstration, confirm:

- The screen represents a real executable workflow, not a disconnected mockup.
- The current organization, branch, warehouse, and user scope are visible.
- Empty, loading, error, blocked, and success states exist.
- Permission-sensitive actions are disabled or hidden for usability and enforced again by the API.
- Stock and financial values come from server-authoritative data.
- Posted records are not silently editable or deletable.
- Every sensitive action has an audit trail.
- Tables can be searched, filtered, sorted, and understood without decoration.
- Mobile and desktop layouts keep the primary task usable.
- External integration status is visible, retryable, and separate from core transaction completion.
- Automated tests cover the critical workflow and its failure cases.
- The phase can be started, seeded, demonstrated, and verified from a clean checkout.

## 12. Recommended Design Decision

Adopt a **quiet operations console** direction: deep green navigation, warm neutral workspace, editorial headings, dense but humane tables, compact status language, and action-oriented queues.

This direction fits the current shell, suits long daily working sessions, supports the seriousness of inventory and money, and leaves enough visual distinction for exceptions. The product should feel considered and recognizable, but its design must always serve the operator's next correct action.
