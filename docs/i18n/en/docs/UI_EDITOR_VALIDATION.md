<a id="ui-editor-110-aktueller-prüfstand"></a>
# UI editor 1.1.0: current validation

As of 29 October 2026, Windows, Node 24.19.0. API 1, frontend protocol 1, negotiated editor 1. No commit/push/upload/deployment.

| Check | Actually executed result |
| --- | --- |
| npm run typecheck | no errors |
| npm test | 41 passed, none skipped |
| npm run verify:fork | plugin 1.1.0 passed real manifest validator, safe discovery, activation, requireTemp |
| npm run verify:native | two native Scamp bots, authenticated targets, isolated action/replay passed |
| Isolated fork client: webpack-cli | full TypeScript/Webpack build successful |
| Isolated fork client: tests/chatBridge.test.cjs | 15 existing Chat regression tests passed |
| Isolated fork frontend: npm run build | production root successful; custom bundle budget met, existing asset-size warnings |
| Isolated fork frontend: npm test | existing unit/locale/bundle-budget checks passed |
| Launcher build-client-runtime.mjs on isolated source | compatibility build successful, no warnings |
| tools/browser-acceptance.cjs with Playwright | 14 integration checks passed with two production-root browsers, two native bots, unchanged Chat/Metabolism adapter; no page/bridge errors |

Browser evidence: /UiEdit passes real Chat parser/registry/client bridges. Three independent Metabolism indicators visible only to intended player. Drag/corner resize/individual 150% scale/arrows/saved normalized position/cancel/CEF reload/server value changes/1024×768 and 1920×1080/visibility/reset work. Inventory suspends/resumes editor. Duplicate native/DOM Escape closes one layer. Disconnect/plugin absence releases focus; Chat remains usable. Layout changes send no menu actions/game values.

Browser uses real Metabolism UiAdapter with server test values, no source/rule changes. SkyrimPlatform browser/menu/keyboard callbacks come from existing harness. This does not prove an actual Skyrim/CEF gameplay session.

Machine-readable evidence:

- artifacts/browser-validation.json (14 checks, browser errors, build hashes)
- artifacts/loader-validation.json and native-validation.json
- artifacts/editor-build-plan.json (unchanged baseline bytes, isolated target bytes)
- artifacts/uiedit-launcher-client/build-report.json
- artifacts/packages/ for byte-verified ZIPs and SHA256SUMS

Screenshot previews from normal production root without dev/admin flags: artifacts/uiedit-hud.png, uiedit-editor.png and uiedit-hud-custom.png. Browser test captures, not Skyrim screenshots.

Verified byte identities:

- Server bundle: f47e9ee6780b9bba1485266d288ae5b86d7bf4726238a63c86df57be4e2f5f9e
- Frontend build.js: 46dd62b584fed750c4469927ee1228bb4dd3561accc2e30868d45be5b195dc02
- Launcher client script: 1e12ca7fbe55264401e1c7c1939ad5865be4b27a5ddca37e4f0d76ce7b1dad6c
- Native UI bridge source: 64af8462bc8ba1af3a62d0a293f2b7ea0cabc83e26131309b07f120ba35e9dd0

Real Skyrim input/CEF acceptance with two players and actual Launcher/webhost rollout with verification of live transport bytes remain outstanding. Original SkyMP/Chat/Metabolism/Launcher checkouts were not changed.
