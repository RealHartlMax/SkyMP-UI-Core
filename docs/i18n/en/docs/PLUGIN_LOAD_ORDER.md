<a id="plugin-ladereihenfolge-und-fehlende-beispiel-ui"></a>
# Plugin load order and missing example UI

Reported logs show ExampleUiConsumer/SecondUiConsumer loaded before skymp-ui-core. They choose their documented optional fallback and register no UI for that process. UI Core's later ready message does not start those older consumers afterwards.

Fork already had `pluginsLoadOrder` and startup sorting. An empty list caused alphabetical order and this case. Order is now visibly controllable under **Resources → Server plugins**: numbered positions, Move up/down, Save load order and Discard. `skymp-ui-core` must precede `example-ui-consumer`/`second-ui-consumer`. Restart game server afterwards. Activation/order are separate.

Search filters do not change the complete saved list. On concurrent changes UI requires discard/reload; server does not overwrite newer order. Known temporarily absent IDs are preserved. New unconfigured IDs follow alphabetically. Dependencies are not automatically resolved; process plugins gain no shared mp/RPC channel.

GET `/api/admin/plugins/load-order`: canViewLogs, current order/revision. PUT: canConsole, same-origin JSON, `{revision,pluginsLoadOrder}`. Only that settings field is saved. Invalid/incomplete lists reject with 400, stale lists with 409. Private settings, mod list, startup flags and discovery state stay intact. API loads no plugin entry.

Changed fork files: `skymp5-server/ts/pluginLoadOrder.ts`, `ts/ui.ts`, `tests/pluginLoadOrder.integration.mjs`, frontend `PluginsPanel.tsx`, `plugins.scss`, six locale files and `README-plugins.md`. Existing startup sorter in `ts/index.ts` stays unchanged and is checked against saved order. Backups/hashes: `artifacts/plugin-load-order/`. Prepare/apply: `node tools/integrate-plugin-load-order.cjs [--apply]` in UI-Core repository.

Built locally: server `npm run build-ts`, production CEF at `artifacts/plugin-order-frontend/`. API/existing-plugin/locale/unit/bundle-budget and authenticated browser checks pass. Browser tests save/reload, search, conflicts, narrow view and read access. Evidence: `artifacts/plugin-load-order-{api,browser}.json`.

Per explicit request, user builds server separately in server repository. A previously started local build had completed before that instruction; no further server builds are run. Sources under `D:/GitHub/skymp` are authoritative. Installing self-built backend/dashboard requires one starter/dashboard restart. Later order changes need only game-server restart. Built client/CEF runtime is prepared separately in Launcher repository: `local-builds/runtime-2026-10-28-plugin-load-order/`. Server package changes no private configuration and contains no native binaries.

This dashboard check does not confirm a real Skyrim game session. No publication/production restart was performed.
