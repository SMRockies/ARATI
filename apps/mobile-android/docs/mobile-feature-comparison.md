# Mobile ERP feature comparison

## Scope and evidence boundary

This is a high-level, static comparison of the supplied APK package metadata, file inventories, manifest declarations, resource names, and indexed DEX references. It does not reconstruct or reproduce either app's source code, UI assets, or proprietary implementation. No app was installed, launched, or tested against a service.

### Compared artifacts

| APK | Package / version | Minimum / target SDK | SHA-256 |
|---|---|---|---|
| `ERPNext_Mobile_base.apk` | `com.codessoft.erpnextmob.android`, 4.7.4 (code 74) | 26 / 36 | `01e696fb65fb06c55e39cf6cd057ae7690263a6d2e545d5fe627e120983639e5` |
| `Zoho_Inventory_base.apk` | `com.zoho.inventory`, 2.21.0 (code 134) | 26 / 35 | `2460fd7408bab0c1a7f3f043b362ecb4cf75a12b23fc1a31684fffe53413c09b` |

Inputs are in the parent workspace's `Arati_` directory. These hashes identify the analyzed inputs; they are not ARATI build artifacts.

## Static findings

### ERPNext Mobile

**Observed:**

- The APK contains one DEX and a Flutter asset bundle under `assets/flutter_assets/`.
- The asset bundle contains a `no_wifi` animation and an `employee_hub.jpg` asset.
- The DEX includes a generic HTTP-client message for when a device is offline.
- The package requests network, location, camera, microphone, media/storage, notification, and background-service capabilities.

**Limit:** these observations show a bundled no-network visual/error path and an asset named for an employee hub; they do not establish offline inventory access, an offline transaction queue, or which ERP workflows are available. The package has Flutter assets but no `lib/` entries in this APK, so the runtime composition cannot be fully classified from this archive alone.

### Zoho Inventory

**Observed:**

- The APK contains eight DEX files and 5,087 ZIP entries.
- It includes on-device ML Kit barcode model assets, including `barcode_ssd_mobilenet_v1_dmp25_quant.tflite`.
- Resource names include item scan/barcode layouts and scanned-item detail layouts.
- Resource names include inventory-adjustment and transfer-order flows, warehouse selection, serial-number and batch-detail UI, purchase-order receiving, sales-order-linked picking, packages, and shipment creation/status screens.
- Indexed DEX strings include barcode-scan references associated with package and receiving code; purchase-order identifiers in receiving references; shipment/package creation strings; transfer-order routes with source and destination warehouse fields; adjustment references; and item serial/batch-number fields.
- Network, camera, Bluetooth/NFC, contacts, account, and biometric capabilities are declared in the manifest.

These are strong **feature-surface indicators**, not runtime verification of permissions, server contracts, business rules, or successful task completion.

## What the APKs do not establish

- **Offline inventory:** ERPNext's no-Wi-Fi resource and generic network error are not proof of offline business transactions. Zoho string matches for `offline_mode` are in Stripe Terminal/payment SDK classes, so they are not evidence of offline inventory operations. Do not enable local stock writes on this basis.
- **Cycle counting:** a Zoho `stock_count_error` resource name exists, but the inspected evidence is not enough to establish a complete cycle-count workflow. Treat cycle counting as an ARATI requirements-driven candidate, not as a confirmed capability of these APKs.
- **Approval, reservation, or conflict rules:** these need authoritative requirements and backend contracts; names in a package do not reveal the policy.

## Recommended ARATI follow-on order

| Priority | Feature | Why it fits ARATI | Safe implementation boundary |
|---|---|---|---|
| 1 | **Barcode-assisted item lookup** | Zoho's scan resources provide a concrete usability precedent; a quick SKU lookup extends the current stock screen. | Add camera permission only when requested; allow manual SKU search fallback. Resolve scanned codes through the authorized ARATI API and show warehouse-scoped stock as read-only. |
| 2 | **Scan-assisted receiving and picking** | Receiving and fulfilment connect product identity to ERP operations and are in ARATI's documented scope. | Capture a draft scan list on mobile; let the backend validate the purchase/sales order, warehouse, quantities, serials/batches, and permissions before posting. |
| 3 | **Serial/batch lookup and history** | ARATI explicitly requires serialized and batch-tracked inventory with lifecycle and movement traceability. | Display server-provided identity, eligibility, and movement history. Do not infer that a serial can be sold or transferred from a stale client copy. |
| 4 | **Transfer workflow** | Zoho's resource/API surface indicates source/destination warehouse transfer workflows; ARATI also requires transfer integrity. | Add only after server-side atomic transfer posting, authorization, idempotency, and an auditable movement pair exist. |
| 5 | **Shipment/package status** | Zoho has package and shipment surfaces associated with sales orders; ARATI includes delivery/fulfilment operations. | Read server-owned order and delivery state. Keep shipment posting and external carrier integrations in the backend. |
| 6 | **Offline read cache, then queued drafts** | Could support poor connectivity, but the compared APK evidence does not prove offline stock transactions. | First show cached read-only data with its last-sync time. Queue only drafts until the server supports idempotent submission, stale-version checks, and explicit conflict resolution. Never queue blind balance edits. |
| 7 | **Cycle count and controlled adjustment** | Useful warehouse operations and directly supported by ARATI's inventory requirements, though not confirmed as a full feature in these package samples. | Require count session, reason, authorization/approval as decided by the business, server reconciliation, and append-only ledger movements. |

### Suggested next slice

Implement **barcode-assisted stock lookup** next, while keeping the existing manual search and read-only API boundary. A later receiving/picking slice can reuse the scanner, but should not post until the ARATI API owns transaction validation and inventory-ledger updates.

