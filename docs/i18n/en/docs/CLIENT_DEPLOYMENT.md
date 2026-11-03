<a id="client--und-launcher-auslieferung"></a>
# Client and Launcher delivery

An external server plugin cannot install this interface alone in the current fork. UI Core needs a one-time integration patch in existing SkyMP client/CEF. Further consumers using registered templates then need no more UI Core/client changes.

<a id="geänderte-fork-dateien"></a>
## Changed fork files

- `skymp5-client/src/services/services/browserService.ts`: shared focus coordinator.
- `skymp5-client/src/services/services/uiCoreBridge.ts`: probe/ready, packets, lease/reset.
- `skymp5-front/src/index.js`: host in existing Provider beside App, all normal in-game render paths.
- `skymp5-front/src/features/uiCore/index.js` and `index.css`: host generated from this repository.
- `skymp5-client/tests/helpers/chatHarness.cjs`: new service import in existing regression test.

No changes to `skymp5-server/ts/index.ts`, Chat components/parser, player authentication or separate SkyMP-Chat repository. Server needs no new native Core build for UI Core.

`tools/integrate-fork.cjs` first creates a patch with before/after hashes and backups in `artifacts/fork-integration/`. `--apply` writes only with matching hashes; `--refresh` refreshes the prepared patch from the original local baseline. Example after npm run build:

```powershell
npm run integration:plan
npm run integration:apply
# Nach eigenen Änderungen am Host:
node tools/integrate-fork.cjs --refresh --apply
```

Patch is based on audited local fork with ChatBridge already integrated. Do not blindly apply to public checkout without those changes. `git apply --check`/hash-checking installer must match the baseline. Backups contain prior user changes and stay local.

<a id="erzeugte-clientdateien"></a>
## Generated client files

```powershell
cd D:/GitHub/skymp/skymp5-client
npm run build
cd D:/GitHub/skymp/skymp5-front
npm run build
```

Client target: `skymp/build/dist/client/Data/Platform/Plugins/skymp5-client.js`. Frontend target: `skymp/skymp5-front/dist/`, including `assets-manifest.json`. Launcher additionally uses its existing compatibility builder to retain CEF path/world-start fixes:

```powershell
cd D:/GitHub/skymp-client-launcher
node launcher/scripts/build-client-runtime.mjs --source D:/GitHub/skymp/skymp5-client --output D:/GitHub/SkyMP-UI-Core/artifacts/launcher-client-code
```

Output directory must be new. Clients receive resulting script as `Data/Platform/Plugins/skymp5-client.js`, frontend HTML/JS/CSS/images/fonts/sounds under `Data/Platform/UI/`. No second HTML root/browser. No developer/admin URL or LocalStorage login bypass needed.

<a id="launcher-runtime"></a>
## Launcher runtime

Launcher adapter is prepared/installed from UI-Core repository with `node tools/integrate-launcher.cjs --apply`. Four changes are hash-checked/backed up first. Launcher then contains:

- `launcher/scripts/create-ui-core-runtime.mjs`
- `launcher/scripts/archive-runtime.ps1`
- npm script `package:runtime:ui-core`
- updated `docs/RUNTIME_UPDATES.md`

For final output, browser-verified CEF build was frozen at `artifacts/verified-frontend` and client script rebuilt under `artifacts/launcher-client-code-final`. Thus interim frontend builds from other work cannot replace verified package bytes. Previous local draft remains as `runtime-2026-10-28-ui-core-before-final`; final output uses new release path `ui-core-v2`.

Actual packaging command used:

```powershell
node launcher/scripts/create-ui-core-runtime.mjs --base-runtime-root D:/GitHub/skymp-client-launcher/local-builds/current/runtime-tintfix-2026-10-25/client-runtime --game-version 1.7.104.0 --release client-2026-10-28-ui-core-v2 --client-script D:/GitHub/SkyMP-UI-Core/artifacts/launcher-client-code-final/skymp5-client.js --ui-source D:/GitHub/SkyMP-UI-Core/artifacts/verified-frontend --output D:/GitHub/skymp-client-launcher/local-builds/runtime-2026-10-28-ui-core
```

Builder checks whole base catalog, every baseline byte, client/CEF integration markers. It preserves native DLL/EXE/BIN unchanged, replaces script/CEF as a unit and generates manifest/catalog plus hash-addressed `payloads/*.bin` for text assets. Old UI assets are omitted. Other Skyrim versions in base catalog are retained. Choose new output; existing releases are not overwritten.

Prepared output: 212 installation files, 37 binary text transports, 73 unchanged native files, 251 byte-verified ZIP entries. Snapshot removed unreferenced files from earlier frontend builds. `VALIDATION.json` and `SHA256SUMS` in output are authoritative. ZIP contains `client-runtime/` for runtime webroot, no Launcher EXE/server.

Manual rollout uploads immutable package directory and all `.bin` transports in binary mode first, `catalog.json` last. Reconcile actual live catalog/other versions first. Afterwards verify live manifest, sizes/SHA-256 of actual transports before game tests. No publication/transfer was performed in this task.

Server profile `launcherResources.runtimeSource` must point at this catalog; manual client source in Launcher can override it. Running Skyrim processes need a full restart. Server-plugin updates/language changes separately need game-server restart. Native compatibility, Steam, actual webhost download and two-player gameplay were not checked again here.

<a id="ui-editor-110-29102026"></a>
## UI editor 1.1.0 (29 October 2026)

Currently checked files are artifacts/editor-fork/skymp5-front/dist and artifacts/uiedit-launcher-client/skymp5-client.js in UI-Core repository. Original SkyMP checkout was not written for that. Complete patch is updated; with UI Core already installed, only native uiCoreBridge.ts and features/uiCore/index.js/index.css need updating.

Update server plugin/client/CEF package together. New ready marker editorVersion: 1 is required for /UiEdit. API/frontend protocol stay 1; existing consumers need no changes.

npm run package:client creates separate SkyMP-UI-Core-Client-1.1.0.zip after successful browser tests from exactly hashed verified files. ZIP contains Data/Platform/Plugins/skymp5-client.js and complete CEF build under Data/Platform/UI/. It is a client overlay for matching existing runtime, no server plugin/Launcher EXE. Launcher delivery needs new runtime manifests/catalog hashes; existing catalogs must not keep referencing old client bytes. Complete local runtime can be prepared with existing create-ui-core-runtime.mjs.

Usage: UI_EDITOR.md. Current checks: UI_EDITOR_VALIDATION.md.
