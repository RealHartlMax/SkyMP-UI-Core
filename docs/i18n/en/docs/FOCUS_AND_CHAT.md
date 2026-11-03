<a id="fokus-und-chat-kompatibilität"></a>
# Focus and Chat compatibility

Exactly one browser and native focus owner exist: existing BrowserService. UiCoreBridge accepts only validated focus requests from the host. ChatBridge and the separate Chat repository remain unchanged in content.

Priority: Skyrim menus → top UI menu/presentation → Chat → gameplay. New UI menus close Chat input through existing ChatBridge, preserving its draft. Enter still opens Chat when no UI menu has focus. Enter/Tab remain normal browser keys inside a form. Escape first closes presentation, then top UI menu, then Chat. Multiple menus are a bounded stack with only one active dialog.

F2 hides/shows the same CEF and releases input when hiding. Enter/F6 can show hidden CEF again. F6 closes the top menu when a UI menu is active; otherwise the existing Chat focus toggle remains. No second key registration or new global hotkeys.

Inventory, map, console, dialogue, loading and other fork `badMenus` suspend UI interaction and return mouse/keyboard to Skyrim. Closing them refocuses a still-valid UI menu. Closing HUD/disconnecting releases focus; disconnect/server change clears private widgets/menus. UI-Core timeout, error boundary and plugin deregistration release only focus owned by UI Core, letting independently opened Chat keep working.

Widgets/notifications use pointer-events none. Menus, buttons and explicitly opened presentation options are interactive. Dialogs have semantic labels, keyboard navigation and visible focus outlines. Scaling 75–150%, text alongside color/list cues. Modal dialogs trap Tab inside content. Nonmodal menus use the same deliberate CEF input mode without fullscreen shade.

Automatically checked: actual BrowserService/ChatBridge/KeyboardEventsService sources, nested menus, F2/F6/Enter/Escape, inventory/map/console/dialogue/loading, two production-root browsers plus native Scamp bots and standalone Chat. Harness supplies native SkyrimPlatform browser/keyboard/menu callbacks. Actual keyboard/mouse suppression in Skyrim and real CEF rendering remain manual game acceptance.

<a id="layout-editor-ab-110"></a>
## Layout editor from 1.1.0

/UiEdit comes through unchanged Chat registry and opens only its editor view. It shares presentation options' focus priority, above the current plugin menu. Escape/F6 discards draft and returns to underlying menu/gameplay. Save closes editor under the same focus rules. Skyrim menus suspend/resume editor; disconnect ends it completely. Details/keyboard controls are in UI_EDITOR.md.
