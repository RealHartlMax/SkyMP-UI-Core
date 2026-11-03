<a id="installation-betrieb-und-upgrade"></a>
# Installation, operation and upgrade

<a id="gameserver"></a>
## Game server

Determine actual game CWD from startup script/process; `Plugins/` is searched relative to **that** directory. Common packages use `Server/`. Do not create an extra `Server/` inside the running server's CWD.

```text
<game-cwd>/Plugins/SkyMPUICore/
  plugin.json
  index.cjs
  config.json
  locales/de.json
  locales/en.json
  README.md
```

`SkyMPUICore-1.1.0.zip` contains folder SkyMPUICore; extract under `Plugins/`. Do not leave a ZIP directly there. In `safe` discovery mode start/restart game server once to discover plugin, then **Resources → Server plugins → Enable**, then fully start it again. Known plugins retain activation.

Example existing server-settings key:

```json
{
  "pluginsLoadOrder": ["skymp-ui-core", "skymp-chat", "example-ui-consumer", "second-ui-consumer"]
}
```

Extend existing order; do not replace private server-settings.json. UI Core is independent of Chat. Install examples only for testing. Loader resolves no declarative dependencies. Consumers check API v1 at startup and choose a finite optional fallback.

Dashboard “running” alone does not prove startup with current `requireTemp`: server log must contain `Ready: API v1, frontend protocol v1`, and `globalThis.skympUi.getStatus()` must exist in server process.

<a id="konfiguration-und-sprache"></a>
## Configuration and language

Default: `<game-cwd>/Plugins/SkyMPUICore/config.json`. Alternatively set `SKYMP_UI_CONFIG` before startup to an absolute or game-CWD-relative path. `locales/` is then searched beside precisely that configuration, never relative to temporary loader entry. Maximum configuration size 16 KiB.

```json
{
  "locale": "de",
  "logLevel": "info",
  "maxWidgets": 20,
  "maxMenus": 4,
  "maxNotifications": 8,
  "maxStateBytes": 8192,
  "maxSessionBytes": 49152,
  "flushMs": 100,
  "updatesPerSecond": 50,
  "updateBurst": 100,
  "widgetTtlMs": 300000,
  "menuTtlMs": 120000
}
```

All other defaults/allowed limits: `src/config.ts`. Unknown keys/out-of-protocol values are rejected; do not work around errors by setting arbitrarily large limits. Logs: debug/info/warn/error, normally no payload/token contents. Default info is sufficient.

Languages `de`/`en`. Both JSON files in `locales/` have identical keys. Edit string values only; no code/HTML needed. Missing keys fall back to bundled same-language translation; missing files produce a notice. Invalid JSON, unknown keys or empty/overlong values cause explicit startup errors. Restart game server after text/config changes. Client runtime needs no rebuild for those.

Players open presentation using the button in focused CEF (for example F6 or open UI menu), adjust scale/position/visibility and change view language. Server language remains default. Other plugins localize their widgets/menus/notifications.

<a id="clientdateien-und-neustarts"></a>
## Client files and restarts

Without matching client/CEF files UI Core remains deliberately empty; after 15 seconds with a connected actor, server reports missing frontend handshake. Protocol mismatch blocks actions. This server plugin does not automatically install clients. See CLIENT_DEPLOYMENT.md.

| Change | Restart |
| --- | --- |
| Install/enable/update plugin, change config/locales | full game-server restart |
| Deploy client script or CEF | exit Skyrim, let Launcher prepare, restart Skyrim |
| Change only UI-Core plugin or language | no dashboard/starter restart |
| Change dashboard/server starter itself | its own restart per fork guide |

Server restart disconnects players. UI Core offers no plugin hot reload or carryover of others' registrations across server-process changes.

<a id="upgrade--rückkehr-zum-vorherigen-stand"></a>
## Upgrade / return to previous version

Back up plugin directory, configuration, locale changes and discovery state first. Prefer updating `index.cjs`, manifest and supplied docs/types; never blindly overwrite private config/locales. Adopt new defaults selectively. Plugin name stays `skymp-ui-core`.

For client protocol changes first test a consistent client/server version. Keep old runtime directories; on trouble point catalog at previous verified manifest and load matching server plugin. Restart game server and affected Skyrim clients. Local ZIPs are not live publication. Verify production catalog/transport bytes separately after uploading.
