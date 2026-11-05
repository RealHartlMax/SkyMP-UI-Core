# Universelle UI-Verträge – optionale Erweiterung zu API V1

Stand: 04.11.2026, lokaler Entwicklungskandidat `1.2.0-dev.20261104`.
API-Version, Frontend-Protokoll, Runtime-API und Zustands-Schema bleiben `1`.
Die zusätzliche Komponentenfähigkeit hat eine eigene Version `1`.

## Discovery und Kompatibilität

```ts
const ui = globalThis.skympUi;
const framework = ui?.apiVersion === 1 && ui.getStatus().ready
  ? ui.framework : undefined;
if (framework?.version !== 1) {
  // Optional UI disabled; the consumer's server logic can continue.
}
```

Vorhandene Methoden von `SkyMpUiApiV1` bleiben erhalten. Das optionale
`framework`-Serviceobjekt ist eingefroren. Ein API-V2-Bruch ist nicht notwendig.
Alte Verbraucher brauchen keine Migration. Neue Verbraucher prüfen zuerst die
Erweiterung und danach `framework.clientStatus(target)` mit
`{ready:boolean, frameworkVersion:0|1}`. `0` bedeutet keine ausgehandelte
Erweiterung, auch während des noch laufenden Handshakes.

Der CEF-Host kündigt `frameworkVersion:1` der Plugin-eigenen nativen Brücke an.
Diese schickt zuerst den bisherigen strikten `ready`-Vertrag und nach dem ersten
Snapshot ein separates Paket:

```json
{"customPacketType":"skympUi:framework","protocolVersion":1,"frontId":"...","sessionId":"...","frameworkVersion":1}
```

Der Server prüft die native Identität sowie Front-/Session-ID und sendet den
aktuellen vollständigen Snapshot mit höherer Sequenznummer. Alte Server ignorieren
den unbekannten Pakettyp und behalten ihre V1-Widgets/Dialoge. Alte native Brücken
ignorieren die zusätzliche CEF-Fähigkeit und bleiben ebenfalls im Legacy-Vertrag.
Unbekannte ausdrücklich angeforderte Framework-Versionen sperren die Sitzung mit
`framework-mismatch`. Wiederholte identische Upgrade-Pakete senden keinen neuen Frame.

Neue Panels werden vor Ready begrenzt gespeichert, bis ihre Fähigkeit feststeht.
An Legacy-Clients werden sie nicht gesendet. Nach Legacy-Ready lehnt `openMenu`
für neue Panels weitere Aufrufe ausdrücklich ab. Verbraucher sollen neue Panels
erst bei `ready && frameworkVersion === 1` öffnen und sonst einen endlichen
optional gewählten Fallback verwenden. Alte Dialog-/Formularlayouts bleiben
unverändert verfügbar; bei ihnen entfernt der Server `priority` aus Legacy-Frames
und überträgt bereits die richtige Menüreihenfolge.

## Deklaratives Panel

Registrierung über die bestehende API:

```ts
ui.registerMenu({ owner: 'my-plugin', id: 'my-plugin:overview', title: 'Overview',
  schemaVersion: 1, layoutId: 'core:panel-v1', modal: true, priority: 10 });
ui.onAction('my-plugin', 'my-plugin:overview', 'confirm', context => {
  if (context.signal.aborted) return;
  // Perform live server-side permission/domain checks here before changing state.
}, { authorize: context => myServerPermissionCheck(context.userId) === true });
ui.openMenu({ userId }, 'my-plugin:overview', {
  schemaVersion: 1,
  content: { version: 1, blocks: [], tabs: [
    { id: 'summary', label: 'Summary', blocks: [
      { id: 'info', kind: 'text', text: 'Server-owned information' },
      { id: 'skill', kind: 'progress', label: 'Progress', value: 2, max: 5 }
    ] },
    { id: 'entries', label: 'Entries', blocks: [
      { id: 'choice', kind: 'list', label: 'Available entries', selectable: true,
        required: true, items: [{ id: 'first', label: 'First entry' }] }
    ] }
  ] },
  actions: [{ id: 'confirm', label: 'Confirm' }]
});
```

Das Beispiel setzt die normale API-Discovery und authentifizierte Servervariablen
voraus. Ein vollständiger optionaler Adapter steht unter
[`examples/FrameworkConsumer`](../examples/FrameworkConsumer/index.ts).

`content` gehört ausschließlich zu `core:panel-v1`. Es enthält gemeinsame
`blocks` und optional bis zu sechs `tabs:{id,label,blocks}`. Es gibt keine
rekursiven Layouts und keine programmierbaren Templates. Formularfelder und
Buttons nutzen die bereits vorhandenen Verträge; sie stehen außerhalb der Reiter.
Ein Panel ohne fachliche Aktionen (`actions:[]`) bleibt über Schließen/Escape bedienbar.

| Block | Daten |
| --- | --- |
| text | `id,kind,text,label?,tone?` – nur Text |
| progress | `id,kind,label,value,max` – positive Maximalzahl, `0 <= value <= max` |
| list | `id,kind,label,items:[{id,label,detail?,value?,disabled?}],selectable?,required?` |
| item-list | wie list, zusätzlich `quantity?` je Eintrag; keine Inventarregeln |
| table | `id,kind,label,columns:[{id,label}],rows:[{id,cells,disabled?}],selectable?,required?` |

Tab-/Block-/Zeilen-/Spalten-IDs verwenden die bestehenden lokalen Action-ID-Regeln.
Block-IDs sind über alle Reiter eindeutig, Zeilen-IDs innerhalb ihres Blocks.
Jede Tabellenzeile enthält genau einen String-/Zahlwert je Spalte. `disabled`
verhindert Auswahl und wird auch serverseitig geprüft. `quantity` ist eine ganze
Zahl von 0 bis 1.000.000.000 und hat nur Darstellungsbedeutung. Keine freien
Bild-URLs, CSS-Regeln, HTML oder JavaScript. Plugins liefern ihre eigenen
lokalisierten Fachtexte; zusätzliche Bedienhinweise sind in DE/EN gebündelt.

Grenzen pro Panel: insgesamt 12 Blöcke, höchstens 32 Einträge je Liste/Tabelle,
128 Einträge insgesamt, 8 Tabellenspalten, bisherige 12 Formularfelder/8 Actions.
Zusätzlich gelten weiterhin 8 KiB Zustand, 4 KiB Action-Payload und das begrenzte
Gesamtbudget je Sitzung. Komplexität: maximal 4096 JSON-Knoten und Tiefe 16, auch
für komplette Frames. Daher sind nicht alle Einzelgrenzen gleichzeitig ausreizbar.

## Auswahl, Revisionsschutz und Autorisierung

Jeder `openMenu`-Aufruf eines Panels erzeugt eine neue, sitzungsbezogene
`MenuView.revision`. Der Host sendet:

```json
{"revision":7,"values":{"amount":2},"selections":{"choice":"first"}}
```

`revision` wird auch beim Schließen benötigt. Die native Brücke übernimmt keine
Spieleridentität aus diesen Daten. Der Server prüft die aktuelle Revision,
angebotene Zeilen, Sperrflags, Pflichtauswahlen, Feldtypen und Wertebereiche gegen
seinen aktuellen Zustand. Neue Register-/Row-IDs aus dem Browser werden abgelehnt.
Ein Reiterwechsel ist nur eine lokale Darstellung und autorisiert keine Aktion.

Für `core:dialog-v1` und `core:form-v1` gilt weiterhin `{values?}` ohne Revision;
deren Wire-Vertrag bleibt erhalten. Request-Sessionpräfix, monotoner Zähler,
Replay-/Rate-/Timeoutlimits und die explizite synchrone `authorize === true`-Regel
gelten für alle Layouts. Wiederholte Requests werden nicht erneut ausgeführt.
Ein neuer Request ist eine neue Benutzeraktion; Domain-Idempotenz und atomare
Transaktionen bleiben Aufgabe des Gameplay-Plugins.

Beim zusammengefassten Schließen/Neuöffnen einer Component invalidiert eine neue
Panelrevision sofort ausstehende UI-Anfragen der alten Ansicht. Ein nachträglicher
Protokoll-/Framework-Mismatch bricht bereits angenommene Action-Jobs ab.

Verdeckte Menüs nehmen auch bei manipulierten Paketen keine Aktionen an. Die
Freigabe wird nach einem synchronen Authorizer erneut auf aktiven Zustand geprüft,
ebenso vor der geplanten Handlerausführung. Schließen, Ersetzen, Ablaufen,
Deregistrierung und Disconnect brechen zugehörige Jobs über `signal` ab.
Ein bereits laufender Handler muss das Signal selbst beachten und vor fachlichen
Mutationen erneut autorisieren. Ignorierender Node-Code kann nicht zwangsweise
gestoppt werden; ein unbeendeter Job behält seinen begrenzten Slot.

## Menüpriorität und Aufräumen

Es gibt höchstens `config.maxMenus` (Default 4, Protokollgrenze 4) offene Menüs pro
Spieler, einschließlich des Interaktionsmenüs. Gezeigt und bedient wird nur eines:
modale Menüs vor nichtmodalen, dann höhere ganzzahlige `priority` von -100 bis 100,
dann die spätere erstmalige Öffnung. Ersetzen eines offenen Menüs behält seine
Position bei gleicher Priorität. Standardpriorität ist 0. Priorität ist eine
UI-Konvention zwischen vertrauenswürdigen Serverplugins, keine Permission.

```ts
framework.offAction(owner, componentId, actionId);
framework.unregisterOwner(owner);
```

`offAction` entfernt genau den eigenen Handler, bricht dessen Arbeit ab und schließt
die betroffenen offenen Menüs. `unregisterOwner` entfernt eigene Widgets, Menüs,
Interaktionen und Handler über alle Sitzungen. Fremde Namespaces werden nicht
übernommen. `unregisterWidget`, `unregisterMenu` und alle bisherigen APIs bleiben
erhalten. Diese Helfer sind expliziter Cleanup, keine Hot-Reload-Garantie.

## Gemeinsame Interaktionen

```ts
framework.registerInteraction({ owner: 'my-plugin', id: 'my-plugin:inspect',
  schemaVersion: 1, label: 'Information', kinds: ['npc', 'merchant'], priority: 10
}, context => {
  if (context.signal.aborted) return;
  // context.interaction is captured from the server router, never from the click.
}, { authorize: context => checkLiveServerInteraction(context) === true });

framework.listInteractions('npc'); // Server metadata only, returned as copies.
framework.openInteraction({ userId }, {
  kind: 'npc', referenceId: 'server-owned-reference', title: 'NPC'
}, ['my-plugin:inspect']);
framework.closeInteraction({ userId });
framework.unregisterInteraction('my-plugin', 'my-plugin:inspect');
```

Unterstützte Kinds: `npc`, `player`, `door`, `container`, `furniture`, `gathering`,
`merchant`. `referenceId` ist ein opaker, vom Server stammender Identifikator mit
maximal 96 Zeichen; UI Core löst ihn nicht als Spielform auf. Alle Definitionen
haben Owner, Namespace und `schemaVersion:1`. Auch Interaktionen zählen zum
bestehenden Registrierungsbudget. Die Auswahlreihenfolge ist absteigende Priorität,
danach lexikografische ID.

Ein Serverrouter stellt die verfügbare Action-ID-Liste zusammen. Wird sie
weggelassen, werden alle registrierten Actions des Kinds angeboten. Mehr als acht
Angebote werden abgelehnt, nicht still abgeschnitten. Ein Router muss dann
fachlich einschränken. Keine Angebote schließt das vorherige Interaktionsmenü und
liefert `false`. Ohne ausgehandelte Fähigkeit liefert Öffnen ebenfalls `false`.

Alle beteiligten Plugins teilen **ein** Menü `skymp-ui-core:interaction` pro
Spieler; diese Component-ID ist für externe Registrierungen reserviert.
Erneutes Öffnen ersetzt den bisherigen Kontext mit neuer Revision. Zum Client
gehen Titel und Buttondaten, keine Autorisierungsdaten oder Zielreferenzen.
Beim Klick löst der Server die interne Button-ID wieder zur registrierten
Plugin-Action auf und prüft den aktuellen Authorizer. Der Handler erhält seine
registrierte ID als `widgetId`, `actionId:'interact'` und zusätzlich
`interaction:{kind,referenceId,title}` aus dem Serverkontext. Das Angebot wird
vor Handleraufruf verbraucht; Replay und frische Mehrfachklicks können es nicht
erneut ausführen. Deregistrieren eines Angebots schließt die gemeinsame Ansicht
und bricht bereits laufende zugehörige Arbeit ab.

Zielerkennung, Aktivierungstaste, Entfernung, Objektbesitz, Schlosszustand,
Durchsuchen, Preise und Inventartransaktionen sind externe Gameplay-/Serverregeln.
Hier wird kein allgemeines Skyrim-Aktivierungsereignis abgefangen. Die isolierten
Integrationsvorschläge stehen in [CORE_HOOKS.md](CORE_HOOKS.md).
