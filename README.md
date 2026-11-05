# SkyMP UI Core

Gemeinsamer Renderer und UI-Service für unabhängige SkyMP-Plugins: HUD-Widgets,
Notifications, Dialoge, Formulare und deklarative Panels im vorhandenen CEF.
Chat, YACA, Metabolism und Gameplay-Regeln bleiben bei ihren jeweiligen Plugins.

**API V1 · Frontend-Protokoll V1 · optionale Framework-Erweiterung V1.**
Der lokale Entwicklungskandidat heißt **1.2.0-dev.20261104**. Er ist keine
veröffentlichte Version. [Audit](docs/FRAMEWORK_AUDIT.md) und
[Abschlussbericht](docs/FRAMEWORK_REPORT.md) dokumentieren den tatsächlichen Stand.

## Vorhandene und neue Bausteine

- HUD: Status-/Text-/Fortschrittswidgets und getrennte Runenanzeigen aus icon-list.
- `/UiEdit`: Position, individuelle/global verfügbare Skalierung, Sichtbarkeit,
  Speichern, Abbrechen und Zurücksetzen; bisherige Metabolism-/YACA-Schlüssel bleiben gültig.
- Notifications mit Queue, TTL und Drosselung; bisherige Dialoge und Formularfelder.
- Neu: `core:panel-v1` mit Reitern, Listen, Tabellen, Gegenstandslisten,
  Fortschritt/Text und optionaler Einzelauswahl.
- Neu: Menüpriorität, aktuelle Panelrevision, Auswahlvalidierung und explizites
  Aufräumen von Ownern und Action-Handlern.
- Neu: eine gemeinsame Interaktionsregistrierung für NPC, Spieler, Tür, Container,
  Möbel, Sammelobjekt und Händler. Der Server öffnet die Ansicht und autorisiert Actions.

Die neuen Komponenten ergänzen den bestehenden Host. Sie enthalten keine
vorgefertigten Jobs-, Handels- oder Charakter-Gameplayoberflächen. Ein optionaler
Charakterpersistenz-Adapter ist [entworfen](docs/CORE_HOOKS.md), keine neue Datenbank.

## Plugin Runtime

Plugin-eigener nativer JS-Code, React-Komponenten und CSS bleiben in diesem Repo.
Der geprüfte lokale Fork akzeptiert **`runtime: "client/manifest.json"`**;
`Runtime/manifest.json` wäre dort inkompatibel.

```text
Plugins/SkyMPUICore/
  plugin.json
  index.cjs
  config.json
  locales/de.json
  locales/en.json
  client/
    manifest.json
    client.js
    ui.js
    ui.css
```

Der generische Bootstrap bleibt im SkyMP-Fork, Download/Prüfung/Restore im
Launcher. Bei bereits installiertem Bootstrap benötigen diese UI-Erweiterungen
keinen neuen gemeinsamen Client-/CEF-/Launcher-Build. Keine UI-Core-Templates
mehr in die gemeinsame Runtime kopieren. Server- und Clientdateien mit
zusammenpassender Pluginversion ausliefern; Gameserver neu starten, Launcher
erneut vorbereiten und Skyrim neu starten. Operator-Konfiguration erhalten.

Hash-, Versions- und Ed25519-Prüfungen bleiben bestehen. Signaturen sind im
vorhandenen Vertrag optional; konfigurierte vertrauenswürdige Herausgeber
erzwingen sie. Private Schlüssel bleiben außerhalb des öffentlichen Pakets.
[Runtime-Vertrag](docs/PLUGIN_RUNTIME.md) · [Auslieferung](docs/CLIENT_DEPLOYMENT.md).

## Lokal prüfen

Node.js ab 20 und npm im UI-Core-Repository:

```powershell
npm ci
npm run typecheck
npm test
npm run verify:fork
npm run verify:native
```

`npm test` führt zuerst den lokalen Build aus. `npm run build` erzeugt
gebündelte CJS-Entrys, Typdefinitionen, den CEF-Host und das Plugin-Runtime-Paket
unter `dist/` beziehungsweise `release/`. Für den Game-CWD-Loader sind keine
relativen Source-Imports oder installierten node_modules erforderlich.

`verify:fork` liest den tatsächlichen lokalen Fork-Loader, standardmäßig
`../skymp` (alternativ `SKYMP_FORK`). `verify:native` benötigt dessen
passendes `scam_native.node` und lokale Spieldaten; es startet Scamp-Bots.
Keine Referenzrepository-Quellen werden verändert. ZIP-/Release-Befehle werden
im aktuellen Auftrag nicht ausgeführt. Lokale Buildbytes dürfen keine bereits
verteilte unveränderliche Runtime-Version ersetzen.

Die Tests prüfen auch die unveränderten lokalen Metabolism-/YACA-Adapter, wenn
deren Checkouts verfügbar sind. Fehlende optionale Referenzcheckouts werden als
Skip ausgewiesen. Eine echte Skyrim-/CEF-/TeamSpeak-Abnahme bleibt separat offen.

## Eigenes Plugin anbinden

```js
const ui = globalThis.skympUi;
if (!ui || ui.apiVersion !== 1 || !ui.getStatus().ready) {
  console.warn('UI Core v1 unavailable; optional UI disabled');
} else {
  ui.registerWidget({
    owner: 'my-plugin', id: 'my-plugin:status', kind: 'status', schemaVersion: 1
  });
  // Call updateWidget from your authenticated server event.
}
```

Vorhandene API-V1-Consumer bleiben unverändert. Für neue Panels/Interaktionen
zusätzlich `ui.framework?.version === 1` und nach dem Handshake
`ui.framework.clientStatus(target)` prüfen. Alte Clients erhalten ihre bisherigen
Widgets und Dialoge. Kein frei übertragenes HTML, CSS, JavaScript oder React-Code.

Actions sind ohne expliziten synchronen Authorizer gesperrt. UI Core prüft native
Identität, offene Komponenten, aktuelle Revisionen/Auswahlen, Replay und Limits.
Gameplay-Plugins prüfen weiterhin die aktuellen fachlichen Regeln und beachten
`ctx.signal` bei asynchroner Arbeit.

[API V1](docs/API.md) · [Framework-Verträge und Beispiele](docs/FRAMEWORK.md) ·
[ExampleUiConsumer](examples/ExampleUiConsumer/index.ts) ·
[Optionaler FrameworkConsumer](examples/FrameworkConsumer/index.ts).

## Betrieb und Dokumentation

In `Plugins/SkyMPUICore/config.json` beispielsweise
`{"locale":"de","logLevel":"info"}` setzen. Die bisherigen
Server-Locale-Dateien bleiben nutzbar; Fachtexte übersetzen die Consumer.
Neue Framework-Bedienhinweise sind in DE/EN mitgebündelt.
Neu entdeckte Plugins im Dashboard aktivieren und den Gameserver vollständig
neu starten. UI Core vor seinen Consumern laden; Abhängigkeiten werden nicht
automatisch aufgelöst.

- [Installation und Upgrade](docs/INSTALLATION.md)
- [Architektur und aktueller Audit](docs/ARCHITECTURE.md)
- [Fokus und Chat](docs/FOCUS_AND_CHAT.md)
- [HUD und Spielerpräferenzen](docs/HUD_PREFERENCES.md)
- [Vorhandene und vorgeschlagene Core-Hooks](docs/CORE_HOOKS.md)
- [Plugin-Ladereihenfolge](docs/PLUGIN_LOAD_ORDER.md)
- [Aktuelle Prüfung und offene Funktionen](docs/FRAMEWORK_REPORT.md)
- [Manuelle Zweiclient-Abnahme](docs/MANUAL_ACCEPTANCE.md)

Ältere Übersetzungen und Integrationsnachweise unter `docs/i18n/` beziehungsweise
`integration/` beschreiben teilweise den früheren festen Kopierweg.
Maßgeblich sind die aktuellen Dokumente oben.
