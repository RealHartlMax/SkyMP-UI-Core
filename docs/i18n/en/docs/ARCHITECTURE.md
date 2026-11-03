<a id="verifizierte-architektur"></a>
# Verified architecture

> Architecture update, 29 October 2026: [PLUGIN_RUNTIME.md](PLUGIN_RUNTIME.md) replaces the fixed client/CEF source copy with a plugin-owned signed runtime package. Generic loader sources live in fork/Launcher. Findings below about the old copying/package route are historical integration evidence. No builds/ZIPs were produced for this new state.

Audit: 28 October 2026. Working repository `D:/GitHub/SkyMP-UI-Core`, integration source `D:/GitHub/skymp`, Chat read-only `D:/GitHub/SkyMP-Chat`, runtime delivery `D:/GitHub/skymp-client-launcher`.

<a id="befunde-vor-der-implementierung"></a>
## Findings before implementation

Local SkyMP HEAD and latest commit queried through GitHub connector on `RealHartlMax/skymp` are `5a70479f1944c32837c58592fd4fcbf308564b68`. Local working tree additionally has uncommitted Chat/focus/frontend-build/spawn/runtime changes. They form the integration baseline; a patch against public commit alone would lose them. Chat is already implemented locally; its AGENTS.md partly describes older target contracts. Actual `Plugins/SkyMPChat/src/{runtime,registry,entry}.cjs` and client/CEF bridge are authoritative.

Read: `README-plugins.md`, server/client scripting reference, events/properties documentation, `docs/skyrim_platform/browser.md`, server `ts/index.ts`, client `browserService.ts`, `gamemodeEventSourceService.ts`, `chatBridge.ts`, frontend `App.js`, `constructor.js`, `utils/Widgets.js`, Chat components, Redux/Chat bridge, client/frontend Webpack configuration and Launcher runtime packaging.

<a id="loader-und-serveridentität"></a>
## Loader and server identity

`skymp5-server/ts/index.ts` discovers direct subdirectories of `process.cwd()/Plugins`. `kind: gamemode` sets `globalThis.mp` to shared ScampServer and loads only the entry via `requireTemp` into a temporary `.js` path. No plugin dependency resolution, frontend installer or reliable plugin hot reload. New plugins stay disabled in safe mode; activation/full restart required. `requireTemp` catches loading errors internally, so dashboard status alone does not prove API startup.

Native methods verified in `ts/scampNative.ts` and `cpp/addon/ScampServer.cpp`: `isConnected`, `getUserActor`, `getUserByActor`, `sendCustomPacket`. `ScampServerListener::OnCustomPacket` provides authenticated native user ID separately from JSON. UI Core checks bidirectional user/actor mapping for every target/request.

<a id="tatsächlicher-transport"></a>
## Actual transport

Like existing Chat, UI Core uses reliable CustomPackets:

1. CEF `window.skyrimPlatform.sendMessage('skympUi:…', data)`.
2. Native `browserMessage` in existing BrowserService/UiCoreBridge.
3. Controller `sendMessage`, `MsgType.CustomPacket`, `reliability: 'reliable'`.
4. Scamp `customPacket(userId, content)` and server validation.
5. `mp.sendCustomPacket(userId, JSON.stringify(packet))` only to that user.
6. Client `customPacketMessage` -> correctly JSON-escaped `CustomEvent` in CEF.
7. React host validates again and renders only text/fixed components.

`makeEventSource/ctx.sendEvent` also exists, but is unnecessary for this build. UI Core distributes neither external script code nor new EventSources and is independent of their signature configuration. It uses no invented `mp.sendToClient`, `mp.broadcast`, `window.skymp.send` APIs.

<a id="kleinster-integrationseingriff"></a>
## Smallest integration change

`skymp5-front/src/index.js` mounts new host as sibling of existing App in the same Provider/CEF root. Thus it works in normal nonlogged-in in-game App rendering without devUi/admin/LocalStorage tricks. `constructor.js`, `Widgets.js` and Chat components are unchanged.

BrowserService remains sole owner of native focus. A small UiCoreBridge adds ready/probe, connection reset, action transport and focus requests. Central policy coordinates Skyrim/UI menus, Chat, Enter/Escape and existing F2/F6. Separate Chat repository stays unchanged. Integration installer checks baseline hashes, producing isolated changes/backups rather than replacing other uncommitted changes.

API v1/frontend protocol v1 are checked separately. Handshake only after React mount and own actor spawn; current snapshots also with slow CEF, reload, reconnect. Complete sequenced throttled frames replace lost partial updates; queues/state/replay data/TTLs are bounded. Server-side session prefix plus monotonic request counter prevents replay even after evicting an old ACK entry.

<a id="distribution-und-nachweisgrenze"></a>
## Distribution and evidence limits

Server: fully bundled `release/SkyMPUICore/index.cjs`. Client: `Data/Platform/Plugins/skymp5-client.js` and every generated file from `skymp5-front/dist` under `Data/Platform/UI/`. Launcher downloads them from a separately versioned runtime catalog. UI Core needs no native DLL changes. Text files need existing hash-addressed `.bin` transport; catalog, manifest, installed file and transport must have matching SHA-256/sizes.

Automatic loader/native-bot/browser tests can prove integration, but do not replace two real Skyrim clients with CEF/gameplay/Chat. A real game session passes only if actually performed. Local runtime is neither published nor deployed to update webserver. See VALIDATION.md and manual plan.

<a id="erweiterung-110-editor-und-status-hud-29102026"></a>
## Extension 1.1.0: editor and status HUD (29 October 2026)

Local/public fork HEADs were checked again against 5a70479f1944c32837c58592fd4fcbf308564b68; existing working tree remains baseline. Unchanged Chat `registerCommand/unregisterCommand`, case-insensitive CommandRegistry and bounded drained skympChatReady queue were actually read. UI-Core adapter uses them and rechecks native user/actor mapping, ready lease and editorVersion before private edit packet. Server API remains v1. Wire translation format is identical; extra editor DE/EN strings are bundled separately in client so old clients on new server do not reject new locale keys.

Actual Metabolism adapter at src/integrations/ui-core/adapter.ts registers kind=icon-list and supplies three localized fractions with status/hint. It stays unchanged. Generic renderer splits only presentation of such lists. Local changes to one element do not move others.

Production builds are checked in a private copy under artifacts/editor-fork. Original SkyMP, SkyMP-Chat, SkyMP-Metabolism and Launcher checkouts are not written for that. Dependency paths in the copy are only for local building and are not delivered.
