<a id="plugin-runtime-loader--api-1"></a>
# Plugin Runtime Loader – API 1

The shared SkyrimPlatform runtime contains the generic native loader and the host in the existing CEF browser. Client code, UI templates, CSS and public assets belong to each plugin. After the one-time bootstrap, compatible plugin changes require no new Launcher EXE or shared runtime build. Native DLLs remain in the central base package matching the Skyrim version.

<a id="aufbau-und-zuständigkeit"></a>
## Layout and ownership

```text
Plugins/SkyMPChat/
  plugin.json                 # runtime: "client/manifest.json"
  index.cjs                   # privater Server-Einstieg
  config.json                 # private Server-Konfiguration
  client/
    manifest.json
    client.js                 # optional: nativer JS-Client
    ui.js                     # optional: CEF-Oberfläche
    ui.css                    # optional: Stylesheet
    assets/...
```

Server-only plugins omit `runtime`. UI-Core consumers such as Metabolism register only data, widgets and menus with UI-Core and need neither their own runtime package nor a second browser. Chat, UI-Core and YACA deliver their own runtime packages.

The game server advertises only plugins successfully loaded during its current boot. Dashboard checkboxes still describe the next start. Finish installation/deactivation with a game-server restart. Dashboard/backend changes additionally require restarting the corresponding service. Exited process plugins are removed from publication. Deploy files and manifest together and restart afterwards.

<a id="manifest-und-http-auslieferung"></a>
## Manifest and HTTP delivery

The public Launcher manifest uses version `3` when runtime packages are required; older Launchers reject the unknown version. Without such packages, version `2` remains. `pluginRuntime` contains `{version:1,revision,packages:[...]}` with plugin ID, version, SHA-256 and size of the manifest file and its download path.

- `GET /api/launcher/plugin-runtime/manifest`: active package catalog.
- `GET /api/launcher/plugin-runtime/manifests/:sha256`: unchanged manifest bytes.
- `GET /api/launcher/plugin-runtime/files/:id`: explicitly public file. ID = SHA-256 of `manifestSha256 + "\0" + file.path`.

There is no public plugin directory listing. Only the explicit file list under `client/` is served. Server bundle and configuration outside that directory receive no download path. Symlinks, traversal, Windows device names, case-insensitive name collisions and native binaries are excluded. Text is also delivered byte-for-byte using binary transport.

```json
{
  "formatVersion": 1,
  "pluginId": "skymp-chat",
  "version": "1.2.0",
  "requires": {"clientApi": 1, "uiApi": 1},
  "entrypoints": {"client": "client.js", "ui": "ui.js", "styles": ["ui.css"]},
  "files": [{"path": "client.js", "size": 123, "sha256": "64 kleine Hex-Zeichen"}],
  "signature": {"algorithm": "ed25519", "keyId": "herausgeber", "value": "128 kleine Hex-Zeichen"}
}
```

The example is abbreviated: every entrypoint and stylesheet must appear in the complete file list. Unknown fields are rejected. Limits: 128 active packages, 256 files/package, 16 MiB/file, 64 MiB/package, 256 MiB of active files total, 256 KiB/manifest, 8 MiB/active index, and 240 characters per complete installation path relative to the game directory.

Each `(pluginId, version)` pair has immutable manifest bytes including its signature. Publish changed files/keys under a new version. The Launcher records verified revisions and rejects subsequently modified versions. The shared contract is in `contract.cjs`; SDK sources under `tools/plugin-runtime/` in plugin projects must stay identical to it.

Old servers without `pluginRuntime` continue using frozen Chat/UI-Core bridges. The Launcher writes `plugin-runtime-managed:false` for them. Updated servers advertise an explicit package list, possibly empty. Legacy surfaces are unmounted there and only advertised plugin surfaces are activated.

<a id="signieren-und-herausgeber-freigeben"></a>
## Signing and approving publishers

**Signatures are optional.** Without keys, the manifest with each file's size and SHA-256 is sufficient; this protects against damaged downloads, not against a malicious server. Only when a player configures trusted publishers in the Launcher do valid signatures from those publishers become mandatory.

Launcher and native loader verify Ed25519 over canonical UTF-8 JSON: recursively sort object keys, preserve array order, no extra whitespace, omit the entire `signature` field. SHA-256, signatures and public keys use lowercase hex. 

```powershell
# Einmalig, außerhalb des öffentlichen Plugin-/Runtime-Verzeichnisses:
node tools/plugin-runtime/package.cjs keygen --output C:/private/herausgeber.pem --key-id herausgeber
# Die Ausgabe ist eine JSON-Zuordnung Herausgeber-ID -> öffentlicher Schlüssel.
$env:SKYMP_PLUGIN_SIGNING_KEY = 'C:/private/herausgeber.pem'
$env:SKYMP_PLUGIN_KEY_ID = 'herausgeber'
# Bei einem später ausdrücklich beauftragten Plugin-Build wird damit signiert.
# Alternativ einen bereits gebauten Kandidaten signieren:
node tools/plugin-runtime/package.cjs sign --root client --private-key C:/private/herausgeber.pem --key-id herausgeber
```

Never put private keys in `client/` or public archives. Players enter only the independently verified public JSON key map in **Launcher settings → Game → Trusted plugin publishers**. The game server cannot grant itself trust. Unknown publishers, modified bytes, wrong signatures, incompatible APIs and altered existing versions stop preparation before Skyrim starts.

The current source task created no persistent publisher keys or release packages. Automated source tests use only temporary test keys that are deleted afterwards.

<a id="download-installation-und-serverwechsel"></a>
## Download, installation and switching servers

The Launcher first prepares the base runtime matching the Skyrim version. Plugin packages require its manifest to declare `pluginRuntimeApi:1`. Signed plugin manifests and all files are then verified. Files go exclusively under `Data/Platform/PluginRuntime/packages/<pluginId>/<manifestSha256>/`. A hash-bound `active.json` index contains the complete package set, target host and game port.

Index, publisher pins and settings use the existing installation journal with collision checks, backups and restoration. Failed downloads never activate an incomplete state. Switching servers replaces the package set and restores previously managed files through the same journal path. Direct in-game switching to another host is rejected until that server has been prepared in the Launcher.

The native loader rechecks index, signatures and every file before evaluating any downloaded client module. Native JS modules are trusted SkyrimPlatform code; publisher verification is not a sandbox.

<a id="entwickler-einstiege-und-aufräumen"></a>
## Developer entrypoints and cleanup

`client.js` is a self-contained bundled CommonJS module with `apiVersion = 1` and `activate(api)`. It may return a synchronous cleanup function. Use injected `api.sp`, `api.controller` and `api.constants.CustomPacket`; do not import a second SkyrimPlatform instance. Native subscriptions, emitter listeners, focus states and registered cleanup functions are removed on disconnect, failed activation and reload.

`ui.js` registers with `window.SkyMPPluginRuntime.register({pluginId,apiVersion:1,mount(ctx)})`. `mount` receives an owned DOM area, asset resolution, React/store/i18n, reducer registration, focus/event/cleanup functions. It may return a synchronous cleanup function. Shared imports: React, ReactDOM, React Redux, React i18next, React Draggable and React Resizable. During loading, `require('skymp-plugin-host')` provides the current host context. Use the existing browser and remove owned timers, sockets and extra listeners during cleanup. Duplicate reducer owners are forbidden; unloading also removes their state. Failed UI activation unloads modules and stops the connection.

Chat and UI-Core retain existing server-validated message paths. YACA retains native EventSource/TeamSpeak transport, but its default server bundle no longer embeds UI. The signed downloaded UI owns its socket and timers. During package teardown the native YACA module also removes the EventSource browser handler and stops its update chain. This avoids the native EventSource function body's 100 KiB limit restricting UI size. `dist/ui/overlay.js` remains a tooling output for legacy tests; `SKYMP_YACA_LEGACY_OVERLAY=1` explicitly includes it in a later build. The new default package needs the bootstrap.

<a id="spätere-abnahme"></a>
## Later acceptance

Source tests and `tsc --noEmit` do not replace installation/game acceptance. After later authorized builds: prepare a server, verify download bytes, start Skyrim and exercise Chat/UI-Core/Metabolism/YACA. Check reconnect and switching to a server with different/fewer/no plugins; old DOM areas, listeners, focus and data state must disappear. Modified files, unknown publishers and changed existing versions must be rejected. Verify each supported Skyrim version, real TeamSpeak audio and lipsync separately.

The current task changed only sources and documentation. No new builds, ZIPs, commits, pushes or publication.
