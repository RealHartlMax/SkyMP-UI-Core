<a id="öffentliche-server-api-v1"></a>
# Public server API v1

`globalThis.skympUi` is a non-overwritable reference to a frozen service object in the shared gamemode process. `kind: process` has no access. `getStatus().ready` means initialized server service, not an already connected CEF client. `frontendProtocol` is independent of `apiVersion`.

Machine-checkable contracts/validators are in `shared/contracts.ts`, localization in `shared/localization.ts`. After building: `dist/types/shared/contracts.d.ts`, with related type/JSON files under `dist/types/`. Example plugins use only `SkyMpUiApiV1`, no internal runtime objects.

<a id="registrierung-und-identität"></a>
## Registration and identity

Owner: `[a-z][a-z0-9-]{0,47}`. IDs: `owner:local-id`, at most 96 characters total; local IDs start with a letter and allow `a-z0-9._-`. All definitions/states use `schemaVersion: 1`. Duplicate IDs, mismatched owners and unknown fields/versions/templates throw.

All server plugins are trusted code in the same process. Owner names prevent accidental overwrites, not malicious Node plugins that can access `mp` directly. API callers cannot supply browser identity: UI Core resolves `{userId}`/`{actorId}` and checks `isConnected`, `getUserActor` and reverse native mapping.

```ts
registerWidget(definition): void
unregisterWidget(owner, id): void
updateWidget(target, id, state): void
setWidgetVisible(target, id, visible): void
registerMenu(definition): void
unregisterMenu(owner, id): void
openMenu(target, id, state): void
closeMenu(target, id): void
notify(target, message, { tone?, durationMs? }?): void
onAction(owner, id, actionId, handler, { authorize }?): void
getStatus(): { ready, apiVersion, frontendProtocol, sessions, locale }
```

`setWidgetVisible` requires an initialized state. `unregister*` also removes player states/action handlers. Registrations live only in the process; updates/registrations after shutdown throw. No promised plugin hot reload. Existing consumers load after UI Core, choosing a one-time optional fallback when absent.

<a id="feste-templates"></a>
## Fixed templates

| Widget kind | State besides schemaVersion |
| --- | --- |
| status, text | label? (160 characters), text? (1024), value? (string/finite number), tone? |
| progress | label, value, max; `0 <= value <= max`, positive max |
| icon-list | items: up to 16 `{label, value?, tone?}`; fixed text markers |
| custom-template | only templateId `core:status-v1`, state like status |

For status/text at least label/text/value must exist. Positions: `top-left`, `top-right`, `bottom-left`, `bottom-right`. `defaultVisible` is optional. Widget layers are noninteractive. No dynamic HTML/JS/CSS/URL templates.

`status` widgets and icon-list entries appear as rune seals: only `value` is shown inside the circle; `label` and `text` are tooltip/screen-reader text. A `value` written as a complete fraction “current/max”, optionally with a unit (“85,3/100 · Gut”, “8/40 m”), fills the ring around the seal proportionally; `max` is the full ring.

Menus: `{owner,id,title,schemaVersion,layoutId,modal?}`. Layouts: `core:dialog-v1` (text/buttons), `core:form-v1` (also form fields). State: `{schemaVersion:1,text?,actions:[{id,label,tone?}],fields?}`. At most 8 actions/12 fields. Fields contain `id,label,type`, optional `required,value`; text has `maxLength` up to 512, numbers `min/max`, selects `options:[{value,label}]` up to 24 entries. Types: text/number/checkbox/select. UI Core validates supplied values against the exact server-opened state. Plugin checks domain rules such as price, stock and permission.

<a id="actions-und-freigaben"></a>
## Actions and authorization

Register handlers before `openMenu`. Full reference: `examples/ExampleUiConsumer/index.ts`. Minimal:

```js
ui.onAction('shop', 'shop:trade', 'buy', async ctx => {
  if (ctx.signal.aborted) return;
  // Recheck live server prices, stock and the player's money here.
}, { authorize: ctx => serverPermissionCheck(ctx.userId, 'shop.buy') === true });
```

`authorize` must synchronously return exactly `true`. Missing function, errors, promises or other truthy values deny. Handlers receive `userId,actorId,widgetId,actionId,payload,requestId,signal` from verified server context. Payload is a JSON data copy; forms provide `{values:{...}}`. No handler executes for unavailable/expired/closed menus. Browser flags for user/role/permissions are not part of the contract.

Browser actions contain only protocol version, widget/action ID, request ID and payload, wrapped in namespaced CustomPacket type. Request ID: `<server-session-UUID>_<monotonic-counter>`. A fresh frontend handshake rotates session key; stale/evicted requests never execute again. ACK confirms acceptance/rejection, not successful completion of a business action. Errors log no payload/token content. `core.close` is reserved session-bound menu dismissal without an external handler.

One handler per player, at most 64 concurrent. AbortSignal is set after 5 seconds. A never-ending handler retains its bounded slot until actual completion. Async plugins must honor signal and current player/game state; UI Core cannot forcibly stop other Node code or roll back database transactions.

<a id="transport-limits-und-lokale-einstellungen"></a>
## Transport, limits and local settings

At most 128 definitions, 20 widgets/4 menus/8 notifications per player, 512 sessions. State at most 8 KiB UTF-8; complete player frame 48 KiB, transport 64 KiB. JSON depth 10, at most 4096 values, arrays up to 256. 50 updates/s, burst 100, flush every 100 ms. Actions 4/s burst 8, notifications 1/s burst 4, duration 1–30 s. Widget TTL 5 min, menu TTL 2 min; consumers refresh needed state before expiration. API throws on limits; plugins should handle/coalesce budget errors.

Ready/snapshot and every sequenced update include the complete current authorized state only for that player. Slow CEF/reload gets latest state. Heartbeat 10 s, client lease 30 s, server session 60 s. Widget values are not saved to SkyMP database. Disconnect/actor change removes in-memory state.

Scale 75–150%, positions and local visibility are presentation data. CEF LocalStorage is read only through bounded validated preferences. Storage keys are hashed native GUIDs; persistence across game restarts is not promised. Empty GUID uses a random session key; without storage, settings stay only in React memory. No game values, roles or authorization are persisted locally.

`config.json` controls default language; `locales/{de,en}.json` override fixed bundled keys. Both validated dictionaries arrive as safe frame text data. New templates/protocol versions require controlled client/CEF releases; pure translations only game-server restart.
