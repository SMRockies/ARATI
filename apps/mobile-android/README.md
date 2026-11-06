# ARATI Android stock client

This is a clean-room Android client for the ARATI ERP, implemented in Kotlin and Jetpack Compose. It is based on the ARATI project requirements and the stock-list feature in ARATI_1; it does not contain source recovered from `Business_Central_base.apk`.

## Why this first feature

The selected vertical slice is a **read-only stock overview**: searchable, filterable stock records with reorder status and warehouse/tracking information. Inventory is a core ERP domain in the ARATI SRS, while the existing web stock screen is explicitly a static mock. Read-only scope provides a useful mobile workflow without creating a second authority for stock, bypassing the movement ledger, or guessing adjustment/transfer approval rules.

See [feature selection](docs/feature-selection.md) for the comparison and [APK architecture notes](docs/apk-architecture.md) for the static-only inventory of the supplied APK.

The separate [mobile feature comparison](docs/mobile-feature-comparison.md) documents the static comparison with the supplied ERPNext Mobile and Zoho Inventory APKs and prioritizes clean-room ARATI follow-on features.

## Requirements

- Android 9 (API 28) or newer
- JDK 17 or newer
- Android SDK Platform 35 and Android Build Tools
- Gradle 8.11.1 (pinned by the included wrapper)

## Build and test

From this directory:

```powershell
.\gradlew.bat test
.\gradlew.bat assembleDebug
```

Install the debug build on a connected Android device or emulator with:

```powershell
.\gradlew.bat installDebug
```

The project requires no database or backend to run in its default local-demo mode. Android SDK Platform 35 and Build Tools are required for compilation.

## Data modes

### Local demo

With no API URL configured, the app uses a small in-memory fixture. The fixture is for UI development only; it is not persistent and is not organization data.

### Organization API

Set `aratiApiBaseUrl` in a local Gradle properties file or `ARATI_API_BASE_URL` in the build environment to an HTTPS origin. For example, in the user's `%USERPROFILE%\.gradle\gradle.properties`:

```properties
aratiApiBaseUrl=https://erp-api.example.org
```

The app then issues a read-only request to:

```text
GET {baseUrl}/api/v1/inventory/stock
Accept: application/json
```

Expected response:

```json
{
  "items": [
    {
      "id": "stock-position-id",
      "name": "Split air conditioner 1.5T",
      "brand": "Example brand",
      "sku": "AR-AC-1501",
      "tracking": "SERIAL",
      "warehouse": "Showroom",
      "onHand": "12",
      "reorderPoint": "5"
    }
  ]
}
```

`tracking` accepts `QUANTITY`, `SERIAL`, `BATCH`, or `HYBRID`. Quantities must be JSON strings containing decimal values so parsing does not lose precision. A non-2xx response, network error, malformed payload, unknown tracking type, negative quantity, or non-HTTPS endpoint is shown as an error; the app does not silently fall back to demo data when the API is selected.

The current ARATI NestJS API does **not** yet implement this inventory endpoint or an authentication flow. The adapter and contract are ready for that integration, but production access to organization data is not enabled until the server endpoint, authorization, and organization/warehouse scoping are implemented and reviewed. No credentials or tokens are embedded in this app.

## What this slice does and does not do

- Displays on-hand quantity and reorder point, and derives in-stock / low-stock / out-of-stock labels for the overview.
- Searches product, brand, SKU, and warehouse; filters by derived status; refreshes the selected data source.
- Uses `BigDecimal` for quantities and rejects negative values.
- Does not edit stock, reserve stock, post sales, transfer stock, adjust inventory, or calculate inventory valuation.
- Does not claim that on-hand quantity equals available-to-promise quantity. Reservation and serial/batch allocation rules remain server-owned.
- Does not persist local demo records or provide offline caching.

The server remains authoritative. Inventory writes must go through the approved ARATI inventory service and append-only movement ledger, never through a mobile-side balance update.
