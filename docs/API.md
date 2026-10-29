# Öffentliche Server-API v1

`globalThis.skympUi` ist eine nicht überschreibbare Referenz auf ein eingefrorenes
Serviceobjekt im gemeinsamen Gamemode-Prozess. `kind: process` hat keinen Zugriff.
`getStatus().ready` bezeichnet den initialisierten Server-Service, nicht einen
bereits verbundenen CEF-Client. `frontendProtocol` ist unabhängig von `apiVersion`.

Die maschinenprüfbaren Verträge und Validatoren stehen in
`shared/contracts.ts`, die Lokalisierung in `shared/localization.ts`.
Nach Build: `dist/types/shared/contracts.d.ts`, einschließlich der zugehörigen
Typ-/JSON-Dateien in `dist/types/`. Beispielplugins verwenden ausschließlich
`SkyMpUiApiV1`, keine internen Runtime-Objekte.

## Registrierung und Identität

Owner: `[a-z][a-z0-9-]{0,47}`. IDs: `owner:local-id`, insgesamt höchstens 96
Zeichen; lokale IDs beginnen mit einem Buchstaben und erlauben `a-z0-9._-`.
Alle Definitionen und Zustände verwenden `schemaVersion: 1`. Doppelte IDs,
unpassende Owner, unbekannte Felder/Versionen/Templates werfen Fehler.

Alle Serverplugins sind vertrauenswürdiger Code desselben Prozesses. Ownernamen
verhindern versehentliches Überschreiben; sie sind keine Sandbox gegenüber einem
bösartigen Node-Plugin, das auch `mp` direkt erreichen könnte. API-Aufrufer können
keine Browseridentität einsetzen: UI Core löst `{userId}` oder `{actorId}` auf
und prüft `isConnected`, `getUserActor` und die umgekehrte native Zuordnung.

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

`setWidgetVisible` setzt einen bereits initialisierten Zustand voraus.
`unregister*` entfernt auch Spielerzustände und Action-Handler. Registrierungen
leben nur im Prozess; Updates/Registrierungen nach Shutdown werfen Fehler.
Es gibt keinen zugesagten Plugin-Hot-Reload. Vorhandene Verbraucher laden nach
UI Core; bei Abwesenheit einmalig einen optionalen Fallback wählen.

## Feste Templates

| Widget-Kind | Zustand neben schemaVersion |
| --- | --- |
| status, text | label? (160 Zeichen), text? (1024), value? (String/finite Zahl), tone? |
| progress | label, value, max; `0 <= value <= max`, max positiv |
| icon-list | items: bis 16 `{label, value?, tone?}`; feste Textmarker |
| custom-template | nur templateId `core:status-v1`, Zustand wie status |

Mindestens label/text/value muss bei status/text vorhanden sein. Positionen:
`top-left`, `top-right`, `bottom-left`, `bottom-right`. `defaultVisible` ist optional.
Widget-Layer sind nicht interaktiv. Keine dynamischen HTML-/JS-/CSS-/URL-Templates.

Menüs: `{owner,id,title,schemaVersion,layoutId,modal?}`. Layouts:
`core:dialog-v1` (Text und Buttons), `core:form-v1` (zusätzlich Formularfelder).
Zustand: `{schemaVersion:1,text?,actions:[{id,label,tone?}],fields?}`.
Bis 8 Actions und 12 Felder. Felder enthalten `id,label,type`, optionale
`required,value`; Text hat `maxLength` bis 512, Zahlen `min/max`, Selects
`options:[{value,label}]` mit bis 24 Einträgen. Typen: text/number/checkbox/select.
UI Core prüft die übermittelten Werte gegen genau den serverseitig geöffneten
Zustand. Domainregeln wie Preis, Inventarmenge oder Berechtigung prüft das Plugin.

## Actions und Freigaben

Handler vor `openMenu` registrieren. Die vollständige Referenz ist
`examples/ExampleUiConsumer/index.ts`. Minimal:

```js
ui.onAction('shop', 'shop:trade', 'buy', async ctx => {
  if (ctx.signal.aborted) return;
  // Recheck live server prices, stock and the player's money here.
}, { authorize: ctx => serverPermissionCheck(ctx.userId, 'shop.buy') === true });
```

`authorize` muss synchron ausdrücklich `true` liefern. Fehlende Funktion, Fehler,
Promises oder andere wahrheitsähnliche Werte bedeuten Ablehnung. Handler erhalten
`userId,actorId,widgetId,actionId,payload,requestId,signal` aus dem verifizierten
Serverkontext. Payload ist JSON-Datenkopie; Formulare liefern `{values:{...}}`.
Kein Handler läuft für nicht angebotene/abgelaufene/geschlossene Menüs.
Browserflags für User/Rollen/Permissions sind nicht Bestandteil des Vertrags.

Browseraktionen enthalten nur Protokollversion, Widget-/Action-ID, Request-ID und
Payload, umschlossen vom namespaced CustomPacket-Typ. Request-ID:
`<server-session-UUID>_<monotonic-counter>`. Ein neuer Frontend-Handshake rotiert
den Sitzungsschlüssel; alte und verdrängte Requests werden nie erneut ausgeführt.
Ein Ack bestätigt Annahme oder Ablehnung, nicht den erfolgreichen Abschluss der
Geschäftsaktion. Fehler werden ohne Payload-/Token-Inhalt protokolliert.
`core.close` ist eine reservierte, sitzungsbezogene Menüabmeldung ohne Fremdhandler.

Ein Handler pro Spieler; maximal 64 gleichzeitig. Nach 5 Sekunden wird das
AbortSignal gesetzt. Ein nie endender Handler behält seinen begrenzten Slot bis
zum tatsächlichen Abschluss. Das Plugin muss bei asynchroner Arbeit Signal und
aktuelle Spieler-/Spielzustände beachten; UI Core kann fremden Node-Code nicht
zwangsweise stoppen oder eine Datenbanktransaktion zurückrollen.

## Transport, Limits und lokale Einstellungen

Maximal 128 Definitionen, 20 Widgets/4 Menüs/8 Notifications je Spieler und 512
Sitzungen. Zustände maximal 8 KiB UTF-8; kompletter Spielerframe maximal 48 KiB,
Transport maximal 64 KiB. JSON-Tiefe 10, maximal 4096 Werte, Arrays bis 256.
50 Updates/s mit Burst 100, Flush alle 100 ms. Actions 4/s Burst 8,
Notifications 1/s Burst 4, Dauer 1–30 s. Widgets 5 min TTL, Menüs 2 min;
Verbraucher erneuern benötigte Zustände vor Ablauf. Bei Grenzen wirft die API
einen Fehler; fremde Plugins sollen Budgetfehler behandeln/coalescen.

Ready/Snapshot und jedes sequenzierte Update enthalten den vollständigen,
aktuellen autorisierten Zustand ausschließlich dieses Spielers. Langsames CEF
und Reload erhalten den letzten Stand. Heartbeat alle 10 s, clientseitige Lease
30 s, serverseitige Sitzung 60 s. Widgetwerte werden nicht in der SkyMP-Datenbank
gespeichert. Disconnect/Actor-Wechsel entfernen den Speicherzustand.

Skalierung 75–150 %, Positionen und lokale Sichtbarkeit sind Präsentationsdaten.
CEF-LocalStorage wird nur über begrenzte, validierte Präferenzen gelesen.
Speicherschlüssel sind gehashte native GUIDs; deren Beständigkeit über Spielstarts
ist nicht zugesagt. Bei leerer GUID gilt ein zufälliger Sitzungsschlüssel, bei
fehlendem Storage bleiben Einstellungen nur im React-Speicher. Keine Spielwerte,
Rollen oder Autorisierung werden lokal persistiert.

`config.json` steuert die Standardsprache; `locales/{de,en}.json` überlagern feste
mitgebündelte Keys. Beide geprüften Wörterbücher kommen als sichere Textdaten im
Frame an. Neue Templates oder Protokollversionen benötigen einen kontrollierten
Client-/CEF-Release; reine Übersetzungen nur Gameserver-Neustart.
