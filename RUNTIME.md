# SkyMP UI Core runtime placement

[Deutsch](RUNTIME.de.md) · [Русский](RUNTIME.ru.md)

UI Core owns its native-JS bridge and CEF host. Edit `client/runtime.ts`, `client/native/uiCoreBridge.ts`, `client/runtime-ui.tsx`, `client/host.tsx` and `client/style.css` in this repository. `tools/build-runtime.cjs`, called by `tools/build.cjs`, prepares root `client/`; the build copies it into `release/SkyMPUICore/client/`. On a later authorized build, the output is:

```text
release/SkyMPUICore/client/
  manifest.json
  client.js
  ui.js
  ui.css
release/SkyMPUICore/
  plugin.json
  index.cjs
  config.json
  client/
```

On the **game server**, install that complete plugin folder under `<game-cwd>/Plugins/SkyMPUICore/`. Its `plugin.json` declares `"runtime": "client/manifest.json"`; the runtime manifest belongs directly inside that directory. Do not put it in the Launcher repository, the server webroot or a second `Server/` below the actual game CWD. `<game-cwd>` is the process working directory containing `server-settings.json`.

Only explicitly declared public files in `client/` are downloadable. Keep `index.cjs`, server configuration, locale sources, credentials and signing keys outside it. Do not place DLL/EXE/PEX/native plugins there. Extra public assets must be added to the manifest's explicit file list; copying an undeclared file does not publish it.

**Signatures are optional.** Without keys, the manifest with each file's size and SHA-256 is sufficient; this protects against damaged downloads, not against a malicious server. Only when a player configures trusted publishers in the Launcher do valid signatures from those publishers become mandatory.

Use the producer SDK in `tools/plugin-runtime/` to produce SHA-256/size entries and an Ed25519 signature. Set `SKYMP_PLUGIN_SIGNING_KEY` to a private key outside the public tree and `SKYMP_PLUGIN_KEY_ID` to its publisher ID for a later build, or sign the built directory with the SDK. Use a new plugin version whenever package bytes or signing key change; `(pluginId, version)` is immutable. Manifest/plugin ID is `skymp-ui-core`.

Enable the plugin and restart the **game server** after deployment. Only successfully started plugins are advertised. The server serves manifests/files through `/api/launcher/plugin-runtime/`; Launcher downloads them into `Data/Platform/PluginRuntime/packages/<pluginId>/<manifestSha256>/` and maintains the server-bound active index. Players must use a base client/Launcher with Runtime API 1. Install the generic bootstrap once; later compatible UI Core updates require only the plugin build/deployment, without rebuilding Launcher EXE or shared runtime.

Client module API 1 uses `activate(api)` and cleanup; UI API 1 mounts inside the existing CEF host and disposes listeners/timers/state. UI-Core consumers such as Metabolism register widgets and menus through the existing server API; they do not need another host or their own runtime package merely to use those templates. Full contract, signing and later acceptance: [Plugin Runtime Loader](docs/PLUGIN_RUNTIME.md).

This guide prepares source layout only. No new build, ZIP, key publication or game acceptance was performed for this documentation task.
