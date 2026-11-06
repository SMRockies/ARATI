# Supplied APK: static architecture notes

These notes describe observable package structure and manifest metadata for the supplied `Business_Central_base.apk`. They are not a source reconstruction. No classes, method bodies, assets, credentials, or proprietary application logic were copied into the ARATI client.

## Artifact identity

- Input: `../../../../Arati_/Business_Central_base.apk`
- SHA-256: `127E1F09F2A062549B3C4C63AFD54C161AEDC6E95B22DCDF65AC35702D5563C4`
- Package: `com.microsoft.dynamics.ProjectMadeira`
- Version: `4.6.9232` (`versionCode` `102774071`)
- Manifest SDK range: minimum API 26, target API 36
- Declared application class: `com.microsoft.applications.telemetry.InstrumentedApplication`
- Main activity: `com.microsoft.dynamics.ProjectMadeira.MainActivity`

## Package inventory (`observed`)

- The APK contains 1,217 ZIP entries and two DEX files (`classes.dex` and `classes2.dex`).
- Native libraries are present for `arm64-v8a`, `armeabi-v7a`, `x86`, and `x86_64`. The included library families are `PDFManipulator`, `PdfJni`, and `Pdfium`.
- The APK bundles a substantial `assets/www/` tree, including JavaScript files such as `mobileApp.js` and `ShimLocalizedStrings.js`, HTML resources, and UI assets.
- DEX reference indexing finds Android `WebView` use in `org.apache.cordova.inappbrowser` and `com.microsoft.dynamics.nav.nativenet.NativeNet`, as well as Microsoft identity and barcode-help classes.
- The manifest requests network access and permissions for location, camera/flashlight, contacts, storage, and NFC. The manifest also declares identity/authentication and document/scan-related Android components.
- The manifest declares a launcher activity and multiple supporting activities, services, and receivers, including Microsoft identity components.

## Architecture interpretation (`inferred`)

At a high level, the package is consistent with this layout:

```text
Android launcher and application wrapper
              |
              v
Native activity + Cordova/WebView integrations
              |
              +---- bundled assets/www UI resources
              +---- Microsoft identity activities
              +---- barcode/camera and device integrations
              +---- native PDF/JNI libraries
              |
              v
       network-backed business services
```

The native activity, Cordova `WebView` references, bundled `assets/www` JavaScript/HTML, and ABI-specific PDF libraries support a hybrid native/web interpretation. The network request is inferred from the declared permission and network-related classes, not verified traffic. The APK contents alone do not prove which screens execute inside a WebView, which assets are active, or the sequence of network calls; that would require authorized runtime observation.

The `InstrumentedApplication` class is a declared application wrapper. Its name alone is not evidence of a packer or an integrity check.

## Limits

- This is static package inspection only: no app was installed or launched, and no device, network, or authentication flow was exercised.
- The resource-backed application label was not resolved to display text.
- The package inventory cannot establish server-side behavior, tenant/account authorization, endpoint contracts, or runtime feature flags.
- The APK is separate from the ARATI Android client. The ARATI client is a clean implementation of the user-owned ARATI stock feature, not a modified or source-derived Business Central app.
