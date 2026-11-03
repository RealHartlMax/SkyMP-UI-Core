<a id="skymp-ui-core"></a>
# SkyMP UI Core

> As of 29 October 2026: The new [Plugin Runtime Loader](docs/PLUGIN_RUNTIME.md) delivers plugin client code and UI as signed packages from the game server. Shared runtime and Launcher need the generic bootstrap once; compatible updates then stay in the plugin project. The older build/integration description below applies only where consistent with the new contract. This change was implemented in source only; new builds, ZIPs and game acceptance remain outstanding.

Shared in-game UI for the RealHartlMax SkyMP fork: widgets, safe declarative menus, notifications and a versioned server API. The host runs in the existing React/CEF root beside unchanged SkyMP Chat.

**API v1 · frontend protocol v1 · plugin 1.1.0.** Server plugin alone installs no client files. Client script and CEF must be updated separately. Two real Skyrim players remain outstanding manual acceptance; native Scamp bots and production root in browser are automatically checked.

<a id="ui-im-spiel-anpassen"></a>
## Customize the in-game UI

**`/UiEdit`** in existing Chat lets players freely move HUD elements and scale them individually. Save, Cancel, visibility and Reset are available directly in the editor. Metabolism appears as three separate fantasy rune indicators for satiety, hydration and rest. Metabolism plugin and Chat remain unchanged.

Update **both** server plugin and client/CEF package to 1.1.0; a server restart alone delivers no new client files. [Usage and upgrade](docs/UI_EDITOR.md).

<a id="lokal-bauen-und-prüfen"></a>
## Build and check locally

Node.js 20 or newer, npm. In the UI-Core repository:

```powershell
npm ci
npm run typecheck
npm test
npm run verify:fork
npm run verify:native
npm run package
```

`build` bundles TypeScript with esbuild into `dist/index.cjs`. `package` produces installable ZIPs under `artifacts/packages/`; runtime files are also unpacked under `release/`. No npm/node_modules needed on the game server. Fork checks default to `../skymp`; set `SKYMP_FORK` otherwise. Native test requires matching `scam_native.node` and local Skyrim.esm. Linux servers can use the platform-neutral CJS bundle; this run was checked under Windows.

<a id="installation"></a>
## Installation

Copy `release/SkyMPUICore/` to `<game-server-working-directory>/Plugins/SkyMPUICore/`. In distributions with `Server/` as game CWD, this is `Server/Plugins/SkyMPUICore/`. Discover once in safe mode, enable under **Resources → Server plugins** in dashboard, then fully restart game server.

For testing additionally install `ExampleUiConsumer` and `SecondUiConsumer`, loading after `skymp-ui-core`. ExampleUiConsumer opens a dialog after actual frontend readiness; confirming updates its private widget through an authorized server handler. UI Core itself creates no game values, Chat messages or commands. Omit examples on production servers.

The new client runtime is locally at `D:/GitHub/skymp-client-launcher/local-builds/runtime-2026-10-28-ui-core/`. It contains new client/CEF files, matching hashes, binary text transport and a catalog for Skyrim **1.7.104.0 / SKSE 2.3.1**. It is unpublished. Restart Skyrim after client rollout. No new Launcher EXE build is required for this package update.

<a id="sprache-konfigurieren"></a>
## Configure language

In `Plugins/SkyMPUICore/config.json`:

```json
{ "locale": "de", "logLevel": "info" }
```

`locale` accepts `de`/`en`. Text is in `locales/de.json` and `locales/en.json` beside configuration. Missing files/keys fall back to the bundled translation of the same language; unknown keys and invalid JSON/text values are explicitly rejected. Restart game server after changes; language text needs no client build. Players can change language for the current view in UI. Other plugins own their widget/menu text.

<a id="eigenes-plugin-anbinden"></a>
## Connect your plugin

```js
const ui = globalThis.skympUi;
if (!ui || ui.apiVersion !== 1 || !ui.getStatus().ready) {
  console.warn('UI Core v1 unavailable; optional UI disabled');
} else {
  ui.registerWidget({
    owner: 'my-plugin', id: 'my-plugin:status', kind: 'status', schemaVersion: 1
  });
  // userId comes from your authenticated server event, never from CEF JSON.
  // ui.updateWidget({ userId }, 'my-plugin:status', {
  //   schemaVersion: 1, label: 'Status', text: 'Vom Server erzeugt'
  // });
}
```

Action handlers are blocked without explicit `authorize`. Only supplied templates/layout IDs are accepted, no HTML/JS/CSS payloads. Details/executable references: [API](docs/API.md), [ExampleUiConsumer](../../../examples/ExampleUiConsumer/index.ts).

<a id="integration-und-nachweise"></a>
## Integration and evidence

- [Architecture and verified existing state](docs/ARCHITECTURE.md)
- [Installation, activation, configuration, upgrade](docs/INSTALLATION.md)
- [Client build, fork patch, Launcher rollout](docs/CLIENT_DEPLOYMENT.md)
- [Focus and Chat](docs/FOCUS_AND_CHAT.md)
- [Automated checks and outstanding game acceptance](docs/VALIDATION.md)
- [Manual two-client plan](docs/MANUAL_ACCEPTANCE.md)
- [Plugin load order in server dashboard](docs/PLUGIN_LOAD_ORDER.md)

Local fork was adapted using an isolated hash-checked patch. `integration/skymp-fork/ui-core.patch` contains precisely these changes against the audited local Chat state. `integration/launcher/` contains the separate runtime packaging adapter. Backups/hash records are under `artifacts/`. Chat sources under `D:/GitHub/SkyMP-Chat` were not changed.
