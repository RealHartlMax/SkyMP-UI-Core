# SkyMP UI Core

> Stand 29.10.2026: Der neue [Plugin Runtime Loader](docs/PLUGIN_RUNTIME.md) liefert Plugin-Clientcode und UI über signierte Pakete vom Gameserver. Die gemeinsame Runtime und der Launcher benötigen einmalig den generischen Bootstrap; danach bleiben kompatible Plugin-Updates im Plugin-Projekt. Die folgende ältere Build-/Integrationsbeschreibung gilt nur, soweit sie dem neuen Vertrag nicht widerspricht. Diese Änderung wurde ausschließlich im Quellcode umgesetzt; neue Builds, ZIPs und Spielabnahmen stehen noch aus.

Gemeinsame Ingame-UI für den RealHartlMax-SkyMP-Fork: Widgets, sichere deklarative
Menüs, Notifications und eine versionierte Server-API. Der Host läuft im bereits
vorhandenen React-/CEF-Root neben dem unveränderten SkyMP Chat.

**API v1 · Frontend-Protokoll v1 · Plugin 1.1.0.** Das Server-Plugin allein
installiert keine Clientdateien. Clientskript und CEF müssen separat aktualisiert
werden. Zwei echte Skyrim-Spieler bleiben als manuelle Abnahme offen; native
Scamp-Bots und der Produktionsroot im Browser sind automatisiert geprüft.

## UI im Spiel anpassen

Mit **`/UiEdit`** im vorhandenen Chat lassen sich HUD-Elemente frei verschieben
und einzeln skalieren. Speichern, Abbrechen, Sichtbarkeit und Reset sind direkt
im Editor verfügbar. Metabolism erscheint als drei getrennte Fantasy-Runenanzeigen
für Sättigung, Flüssigkeit und Erholung. Metabolism-Plugin und Chat bleiben unverändert.

Server-Plugin **und** Client-/CEF-Paket auf 1.1.0 aktualisieren; ein bloßer
Server-Neustart verteilt keine neuen Clientdateien. [Bedienung und Upgrade](docs/UI_EDITOR.md).

## Lokal bauen und prüfen

Node.js ab 20, npm. Im UI-Core-Repository:

```powershell
npm ci
npm run typecheck
npm test
npm run verify:fork
npm run verify:native
npm run package
```

`build` bündelt TypeScript mit esbuild zu `dist/index.cjs`. `package` erzeugt
installierbare ZIPs unter `artifacts/packages/`; Laufzeitdateien liegen außerdem
entpackt in `release/`. Kein npm/node_modules auf dem Gameserver erforderlich.
Die Fork-Prüfungen verwenden standardmäßig `../skymp`; abweichend `SKYMP_FORK`
setzen. Der native Test benötigt dessen passenden `scam_native.node` und lokale
Skyrim.esm. Linux-Server können das plattformneutrale CJS-Bundle verwenden;
dieser Lauf wurde unter Windows geprüft.

## Installation

`release/SkyMPUICore/` nach `<Gameserver-Arbeitsverzeichnis>/Plugins/SkyMPUICore/`
kopieren. In einer Distribution mit `Server/` als Game-CWD ist das
`Server/Plugins/SkyMPUICore/`. Im safe-Modus einmal entdecken lassen, im Dashboard
unter **Ressourcen → Server-Plugins** aktivieren, Gameserver vollständig neu starten.

Für den Test zusätzlich `ExampleUiConsumer` und `SecondUiConsumer` installieren
und nach `skymp-ui-core` laden. ExampleUiConsumer öffnet nach echtem Frontend-Ready
einen Dialog; Bestätigen aktualisiert das private Widget durch einen autorisierten
Server-Handler. UI Core selbst erzeugt keine Spielwerte, Chatnachrichten oder
Commands. Auf Produktivservern die Beispiele weglassen.

Die neue Client-Runtime liegt lokal unter
`D:/GitHub/skymp-client-launcher/local-builds/runtime-2026-10-28-ui-core/`.
Sie enthält neue Client-/CEF-Dateien, passende Hashes, binäre Texttransporte und
einen Katalog für Skyrim **1.7.104.0 / SKSE 2.3.1**. Sie ist nicht veröffentlicht.
Nach Client-Rollout Skyrim neu starten. Ein neuer Launcher-EXE-Build ist für dieses
Paketupdate nicht erforderlich.

## Sprache konfigurieren

In `Plugins/SkyMPUICore/config.json`:

```json
{ "locale": "de", "logLevel": "info" }
```

`locale` akzeptiert `de` oder `en`. Texte stehen in `locales/de.json` und
`locales/en.json` neben der Konfiguration. Fehlende Dateien/Keys erhalten die
mitgebündelte Übersetzung derselben Sprache als Fallback; unbekannte Keys,
ungültige JSON-/Textwerte werden ausdrücklich abgewiesen. Nach Änderungen den
Gameserver neu starten; für Sprachtexte ist kein Clientbuild nötig. In der UI
kann der Spieler die Sprache für die laufende Ansicht umstellen.
Widget-/Menütexte fremder Plugins bleiben Eigentum dieser Plugins.

## Eigenes Plugin anbinden

```js
const ui = globalThis.skympUi;
if (!ui || ui.apiVersion !== 1 || !ui.getStatus().ready) {
  console.warn('UI Core v1 unavailable; optional UI disabled');
} else {
  ui.registerWidget({
    owner: 'my-plugin', id: 'my-plugin:status', kind: 'status', schemaVersion: 1
  });
  // userId comes from your authenticated server event, never from CEF JSON.
  // ui.updateWidget({ userId }, 'my-plugin:status', {
  //   schemaVersion: 1, label: 'Status', text: 'Vom Server erzeugt'
  // });
}
```

Action-Handler sind ohne explizite `authorize`-Funktion gesperrt. Es werden nur
mitgelieferte Templates/Layout-IDs akzeptiert, keine HTML-/JS-/CSS-Payloads.
Details und ausführbare Referenzen: [API](docs/API.md),
[ExampleUiConsumer](examples/ExampleUiConsumer/index.ts).

## Integration und Nachweise

- [Architektur und verifizierter Istzustand](docs/ARCHITECTURE.md)
- [Installation, Aktivierung, Konfiguration und Upgrade](docs/INSTALLATION.md)
- [Clientbuild, Fork-Patch und Launcher-Rollout](docs/CLIENT_DEPLOYMENT.md)
- [Fokus und Chat](docs/FOCUS_AND_CHAT.md)
- [Automatische Prüfung und offene Spielabnahme](docs/VALIDATION.md)
- [Manueller Zweiclient-Testplan](docs/MANUAL_ACCEPTANCE.md)
- [Plugin-Ladereihenfolge im Server-Dashboard](docs/PLUGIN_LOAD_ORDER.md)

Der lokale Fork wurde mit einem isolierten, hashgeprüften Patch angepasst.
`integration/skymp-fork/ui-core.patch` enthält genau diese Änderungen gegen den
auditierten lokalen Chat-Stand. `integration/launcher/` enthält den separaten
Runtime-Paketierungsadapter. Backups und Hashprotokolle liegen in `artifacts/`.
Der Chat-Quellcode unter `D:/GitHub/SkyMP-Chat` wurde nicht verändert.
