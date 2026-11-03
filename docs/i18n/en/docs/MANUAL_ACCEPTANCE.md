<a id="manuelle-zweiclient-abnahme-offen"></a>
# Manual two-client acceptance (outstanding)

This list is deliberately not marked passed. Automated native bots/browsers are described separately in VALIDATION.md. Two real Skyrim clients with identical runtime packages and a test game server are required.

Preparation: normally install/enable SkyMPUICore, ExampleUiConsumer, SecondUiConsumer and existing SkyMP Chat. Load UI Core first. Fully restart game server. Both players use new runtime catalog, restart Skyrim and connect normally without devUi/admin parameters. Use no real confidential values for private tests.

- [ ] Safe discovery: new plugin stays disabled; activation/second start really loads API v1.
- [ ] Both players see status widgets from two independent plugins in normal in-game CEF.
- [ ] A confirms dialog: only A sees counter 1/success; B stays at 0.
- [ ] Server-side widget change actually appears in Skyrim window.
- [ ] Menu button invokes exactly one handler with correct native user/actor ID.
- [ ] Late CEF startup/reload/reconnect provide current snapshots without duplicate listeners/widgets.
- [ ] Server change/disconnect clears private state and fully releases mouse/keyboard.
- [ ] A never sees widget/menu/notification data addressed only to B and vice versa.
- [ ] HTML/JS-like text remains readable text, with no execution.
- [ ] Enter still opens Chat; messages appear once for A/B; private command replies stay private.
- [ ] Escape closes presentation/top modal/Chat input and frees gameplay; Chat draft stays.
- [ ] F2 off/on, F6 for Chat/modals, held Enter and multiple modals do not lose focus.
- [ ] Inventory/map/console/dialogue/loading/HUD changes never permanently block Skyrim input.
- [ ] Tab/Shift+Tab stay in dialog; buttons keyboard-accessible; text readable at 75/100/150%.
- [ ] Position/visibility remain local preferences; denied storage causes no crash.
- [ ] config.locale=de/en and edits to locales/de.json/en.json appear after server restart without client rebuild.
- [ ] Missing locale key sensibly falls back; invalid config produces clear startup error.
- [ ] Without server plugin UI Core stays empty and existing Chat works.
- [ ] Without new client package server logs missing handshake, no crash/infinite retry.
- [ ] Protocol mismatch blocks actions; old request IDs and foreign identity/permission fields have no effect.
- [ ] 20 widgets with fast server updates stay within documented queue/byte/rate limits.
- [ ] Actually downloaded runtime bytes match published catalog/manifest.

For each test record result/date/client version/Skyrim version/server/plugin version and relevant log/video. Only then is the original real-player definition of done fully evidenced.

<a id="ui-editor-und-fantasy-hud-110"></a>
## UI editor and fantasy HUD 1.1.0

- [ ] Install new server/client/CEF packages, restart both.
- [ ] /UiEdit (also /uiedit) through Enter opens only own editor.
- [ ] Three real Metabolism values appear as rune rings and change from server.
- [ ] YACA range: ring = range/largest configured range (20 of 40 m = half ring); speaking and mute only change the color, the seal stays in place.
- [ ] Drag/resize satiety; hydration/rest retain position/size.
- [ ] Arrows, Shift+arrows and +/− work; visible keyboard focus.
- [ ] Save survives reload/reconnect; Cancel/Escape discards draft.
- [ ] Resolution changes keep elements visible; visibility/reset work.
- [ ] Inventory/map/console release input; returning restores editor.
- [ ] Escape/F6 with editor above plugin menu closes only top layer.
- [ ] F2/Enter/Chat stay fully usable after editor.
- [ ] Disconnect/server change during drag leaves no mouse focus.
- [ ] Old client gets private update diagnostic on /UiEdit.
