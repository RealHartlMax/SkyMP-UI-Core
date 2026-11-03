<a id="prüfstand-und-verbleibende-abnahme"></a>
# Validation status and remaining acceptance

Current **1.1.0 / UI editor (29 October 2026)**: [UI_EDITOR_VALIDATION.md](UI_EDITOR_VALIDATION.md). Table below records original state of 28 October 2026.

As of 28 October 2026, Windows, Node 24.19.0, local TypeScript 5.9.3. API 1, frontend protocol 1, plugin 1.0.0. No commit/push/upload/release.

<a id="ausgeführte-prüfungen"></a>
## Checks performed

| Command / check | Result / meaning |
| --- | --- |
| UI Core: `npm run typecheck` | no errors, explicit node/react types and Node16 resolution |
| UI Core: `npm test` | 31 tests: contracts, isolation, replay, limits/TTL, actions, locale files, real focus adapter, temporary entry |
| `npm run verify:fork` | real unchanged fork validator/discovery/requireTemp; safe/enabled; two external consumers |
| `npm run verify:native` | same plugins with real Scamp bots/authenticated native user/actor mapping; private action exactly once |
| Fork client: `npm run build` | Webpack/TypeScript build successful |
| Fork client: `npm run test:chat` | 12 existing Chat regression tests passed |
| Fork client: `npm run test:server-js` | 4 signature/configuration tests passed |
| Fork client: `npm run test:spawn-location` | 8 spawn/reconnect tests passed |
| Fork frontend: `npm run build` | production build, existing gzip budget met; general asset-size warnings remain |
| Fork frontend: `npm test` | locale structure, existing unit checks, bundle budget passed |
| Launcher: `build-client-runtime.mjs` | compatibility build successful, no warnings |
| `tools/browser-acceptance.cjs` through Playwright | two production-root browsers + native bots + unchanged Chat; no page/bridge errors |
| Launcher: `create-ui-core-runtime.mjs` | base catalog/all sources hashed; 212 installation files, 37 text transports, 73 native files unchanged |
| Windows ZIP byte check | all 251 runtime-ZIP entries checked against prepared files |
| Launcher: `node --test tests/runtime-packaging.mjs` | 15 cases including binary text transport/corruption rejection passed |

Precise results/hashes are in `artifacts/{loader,native,browser}-validation.json` and Launcher output `VALIDATION.json`. Package results: `artifacts/packages/PACKAGE-VALIDATION.json`, SHA256SUMS.

Browser run loads actual built root at `/`, without dev/admin mode. A CEF click travels through real UiCoreBridge/BrowserService sources, a native bot message, server Core and back to React host. Native output is fed into actual client controller; harness supplies SkyrimPlatform browser/keyboard/menu callbacks. This proves browser integration, not an actual Skyrim/CEF game session.

Browser checked: two consumer namespaces, server confirmation/private counter, duplicate replay, injection as text, latest snapshot after CEF reload, scale/DE-EN, menu suspend/resume, Chat A/B/private external command reply, F2/Enter, disconnect, UI Core absent with Chat still working. Screenshots: `artifacts/ui-core-*.png`.

<a id="typfehler-im-editor"></a>
## Editor type errors

Reported Node/timer/node10 diagnostics were fixed with explicit `types: ["node","react"]`, `module/moduleResolution: "Node16"` and `node:timers` imports. @types/node is installed/pinned in lockfile. `.vscode/settings.json` points to local TypeScript. For stale editor diagnostics run `TypeScript: Restart TS Server`, select workspace version; actual CLI type check is authoritative.

<a id="noch-nicht-nachgewiesen"></a>
## Not yet demonstrated

- Two real players see/interact in actual Skyrim/CEF process.
- Real gameplay input suppression/release in all Skyrim menus.
- Steam/Launcher live download after upload, unchanged webhost transport bytes.
- Native compatibility with other Skyrim versions and Linux server operation.
- Publication/hosting/production installation: not performed.

Manual plan: MANUAL_ACCEPTANCE.md. Technical implementation is therefore packaged/automatically integrated, but original complete definition of done with real Skyrim players remains outstanding.
