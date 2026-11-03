<a id="ui-editor-und-fantasy-hud-110"></a>
# UI editor and fantasy HUD (1.1.0)

<a id="benutzung"></a>
## Usage

During normal gameplay open existing Chat with Enter, type /UiEdit and send. Case does not matter. Available to all connected players, accepts no parameters and opens only their own layout. SkyMP Chat stays unchanged; UI Core registers uiedit with owner skymp-ui-core in its actual v1 command registry. /help can list it.

- Click/drag an element for free positioning.
- Drag the bright bottom-right corner or change “Element size”: individual 75–150% size. Global scale remains additionally available.
- On a selected element: arrow keys move 1 pixel, Shift moves 10 pixels, +/− changes size in 5% steps.
- Visibility, fixed screen corner, DE/EN language and Reset are available in editor.
- “Save & close” applies layout. “Cancel”/Escape discards changes since opening. “Reset all” becomes permanent only when saving.

Editor uses the same BrowserService focus as existing UI menus. Inventory/map/console suspend it; closing returns to editor. Disconnect/missing UI Core clear view and release input. F6 closes editor like Escape. Without SkyMP Chat, “Presentation” button in deliberately focused CEF (for example F6) remains available.

<a id="metabolism-darstellung"></a>
## Metabolism display

Existing unchanged Metabolism adapter still supplies exactly one icon-list widget with satiety, hydration and rest. Generic renderer displays entries as three independent rune seals: rune and number inside the circle, surrounded by a value ring with metal frame. Label and status text no longer appear below the seal, only as tooltip and screen-reader text, so changing text can never enlarge or move an element. Each entry can move, scale or hide independently. Other icon-list consumers use this display without UI Core changes too.

Value ring derives exclusively from a complete positive fraction such as “85,3/100 · Gut”: the maximum is always the full ring, half of it a half ring. A unit of up to three letters may follow the maximum, e.g. “8/40 m”; the seal then shows “8 / 40 m”. German comma and English decimal point (at most two decimals) are supported. Unknown values stay text inside the seal with an empty ring; client invents no game values or Metabolism rules. State colors rune and ring: orange for `warning`, red for `error`, green for `success` on `status` widgets. Runes are bundled simple SVG geometry with no external image/font requests or paid service.

<a id="sprachreichweite-und-statusanzeigen"></a>
## Voice range and status indicators

Normal `status` widgets use the same rune seals, metal frames, fonts and status colors. Display belongs entirely to UI-Core; for `skymp-yaca-ts:voice-range`, YACA supplies only range, microphone/audio state and speaking state. Range arrives as “8/40 m”: current range and largest range of `voiceRanges.ranges` in YACA `config.json`. The ring shows the share (8 of 40 m = 20 %, 20 m = half ring, 40 m = full ring). Microphone, audio and speaking state from YACA messages (including locked range) appear only as rune and ring color: gold active, green while speaking, orange for muted microphone/audio or no TeamSpeak. Since no status text sits below the seal anymore, the element no longer jumps while speaking. A value without maximum such as “8 m” still creates no invented percentage fill.

Widget retains its previous layout key without `#0` and remains movable/scalable/hideable with `/UiEdit`. TeamSpeak connection warning and F8 settings still belong to YACA interface. Change later requires updated YACA server plugin and UI-Core runtime package; it is prepared here only as source, without build/packaging.

<a id="speicherung-und-sicherheit"></a>
## Storage and security

Existing key skymp-ui.v1.<preferenceKey> stays. Old corner/visibility preferences are adopted. New element preferences contain only normalized x/y position, scale and visibility. They are stored locally per authenticated player using the server-generated preference key. Normalized positions stay visible on resolution changes. Without CEF LocalStorage, layout works for current session; editor visibly reports failed save.

At most 160 layout entries / 64 K characters are read. Invalid/out-of-range coordinates/sizes are ignored. List entries use <widgetId>#0 through #15; consumers must keep order stable. Metabolism already uses satiety, hydration, rest. No layout/game values are written back to server; menu actions remain on the existing validated channel.

<a id="installation--upgrade"></a>
## Installation / upgrade

Update both sides: server plugin 1.1.0 and matching client script/CEF frontend. API v1/frontend protocol v1 stay unchanged; editor support additionally negotiates editorVersion: 1 on actual ready. Without this marker server will not open editor; /UiEdit privately requests current client package. Old clients can still use existing widgets on new server. New clients require server plugin at least 1.1.0.

Chat → UI Core startup recommended; actual bounded skympChatReady queue also supports UI Core → Chat without polling. On command collision existing command stays, UI Core logs conflict, presentation button remains usable. Shutdown removes only owned registration/pending callback. Changes still need game-server/client restart.

Integration patch: integration/skymp-fork/ui-core.patch. Already integrated installations change only uiCoreBridge.ts and generated host files features/uiCore/index.js/index.css. Existing BrowserService/root/Chat hooks stay. See CLIENT_DEPLOYMENT.md. Original SkyMP/Chat/Metabolism/Launcher checkouts are not changed in this work; build/browser checks use artifacts/editor-fork.

<a id="reproduzieren"></a>
## Reproduction

    npm run typecheck
    npm test
    npm run integration:plan -- --refresh
    npm run integration:stage
    $env:NODE_PATH='D:\GitHub\skymp\skymp5-front\node_modules'
    Set-Location artifacts/editor-fork/skymp5-front
    npm run build

Staging copy reads existing fork dependencies through explicit resolution paths. Native tests can set SKYMP_FORK to staging and SKYMP_NATIVE_FORK to actual fork. Native DLLs/game data remain read-only there. Set SKYMP_SOURCE_FORK for another checkout during staging; prepared plan must match it.

Additional tests cover independent geometry, local migration, editor handshake, native player identity, old clients, command ownership and real Chat ready queue. Production-root browser run uses two real Scamp bots, actual client bridges and unchanged Metabolism adapter. SkyrimPlatform menu/browser callbacks remain simulated. A real Skyrim/CEF game session still needs separate acceptance.
