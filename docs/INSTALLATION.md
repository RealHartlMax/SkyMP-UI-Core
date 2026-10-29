# Installation, Betrieb und Upgrade

## Gameserver

Den tatsächlichen Game-CWD aus Startskript/Prozess bestimmen; `Plugins/` wird
relativ zu **diesem** Verzeichnis gesucht. Bei den üblichen Paketen heißt es
`Server/`. Kein zusätzliches `Server/` im laufenden Server-CWD anlegen.

```text
<game-cwd>/Plugins/SkyMPUICore/
  plugin.json
  index.cjs
  config.json
  locales/de.json
  locales/en.json
  README.md
```

`SkyMPUICore-1.1.0.zip` enthält den Ordner SkyMPUICore; unter `Plugins/` entpacken.
Keine ZIP direkt liegen lassen. Beim `safe`-Discovery-Modus zuerst einmal den
Gameserver starten/neustarten, damit das neue Plugin erscheint. Anschließend
Dashboard **Ressourcen → Server-Plugins → Aktivieren**, dann Gameserver erneut
vollständig starten. Bereits bekannte Plugins behalten ihre Aktivierung.

Beispiel für den vorhandenen server-settings-Schlüssel:

```json
{
  "pluginsLoadOrder": ["skymp-ui-core", "skymp-chat", "example-ui-consumer", "second-ui-consumer"]
}
```

Vorhandene Reihenfolge ergänzen, nicht die private server-settings.json ersetzen.
UI Core ist unabhängig vom Chat. Die Beispielplugins nur für Tests installieren.
Der Loader löst keine deklarativen Abhängigkeiten auf. Konsumenten prüfen API v1
beim Start und wählen einen endlichen optionalen Fallback.

Ein Dashboardstatus "running" allein reicht beim aktuellen `requireTemp` nicht
als Startnachweis: im Gameserverlog muss `Ready: API v1, frontend protocol v1`
stehen und im Serverprozess `globalThis.skympUi.getStatus()` verfügbar sein.

## Konfiguration und Sprache

Standardpfad: `<game-cwd>/Plugins/SkyMPUICore/config.json`. Alternativ vor dem
Start `SKYMP_UI_CONFIG` auf einen absoluten oder Game-CWD-relativen Pfad setzen.
`locales/` wird dann neben genau dieser Konfigurationsdatei gesucht, nie relativ
zum temporären Loader-Entry. Die maximale Konfigurationsdatei ist 16 KiB groß.

```json
{
  "locale": "de",
  "logLevel": "info",
  "maxWidgets": 20,
  "maxMenus": 4,
  "maxNotifications": 8,
  "maxStateBytes": 8192,
  "maxSessionBytes": 49152,
  "flushMs": 100,
  "updatesPerSecond": 50,
  "updateBurst": 100,
  "widgetTtlMs": 300000,
  "menuTtlMs": 120000
}
```

Alle weiteren Defaults und zulässigen Grenzen: `src/config.ts`. Unbekannte Keys
und außerhalb des Protokolls liegende Werte werden abgewiesen; Fehler nicht durch
Umbenennen zu beliebigen großen Grenzwerten umgehen. Logs: debug/info/warn/error,
normalerweise keine Payload-/Token-Inhalte. Info-Default ist ausreichend.

Sprachen `de` oder `en`. Beide JSON-Dateien in `locales/` besitzen dieselben Keys.
Nur Stringwerte bearbeiten, keine Codeschnipsel oder HTML erforderlich. Fehlende
Keys fallen auf die gebündelte Übersetzung derselben Sprache zurück, fehlende
Dateien erzeugen einen Hinweis. Ungültiges JSON, unbekannte Keys oder leere/zu
lange Werte führen zu einem ausdrücklichen Startfehler. Nach Text-/Konfigänderung
den Gameserver neu starten. Die Client-Runtime muss dafür nicht neu gebaut werden.

Spieler öffnen Darstellung über den Button im fokussierten CEF (z. B. F6 oder
geöffnetes UI-Menü), stellen Skalierung/Position/Sichtbarkeit ein und können die
Ansichtssprache wechseln. Die Serversprache bleibt die Voreinstellung.
Texte fremder Widgets/Menüs/Notifications lokalisiert deren eigenes Plugin.

## Clientdateien und Neustarts

Ohne passende Client-/CEF-Dateien bleibt UI Core kontrolliert leer; der Server
meldet bei verbundenem Actor nach 15 Sekunden den fehlenden Frontend-Handshake.
Bei Protokollmismatch werden Actions gesperrt. Es gibt keine automatische
Clientinstallation durch dieses Server-Plugin. Siehe CLIENT_DEPLOYMENT.md.

| Änderung | Neustart |
| --- | --- |
| Plugin installieren/aktivieren/aktualisieren, config/locales ändern | vollständiger Gameserver-Neustart |
| Clientskript oder CEF ausrollen | Skyrim beenden, Launcher vorbereiten lassen, Skyrim neu starten |
| Nur UI-Core-Plugin oder Sprache ändern | kein Dashboard-/Starter-Neustart erforderlich |
| Dashboard-/Serverstarter selbst ändern | dessen eigener Neustart laut Fork-Anleitung |

Ein Serverneustart trennt Spieler. UI Core bietet keinen Plugin-Hot-Reload und
keine Übernahme fremder Registrierungen über einen Serverprozesswechsel hinweg.

## Upgrade / Rückkehr zum vorherigen Stand

Vorher Pluginordner, Konfiguration, lokale Sprachänderungen und Discovery-State
sichern. Für ein Update bevorzugt `index.cjs`, Manifest und gelieferte Docs/Types
aktualisieren; private config/locales nicht blind überschreiben. Neue Defaults
gezielt übernehmen. Pluginname bleibt `skymp-ui-core`.

Bei Client-Protokollwechsel erst einen konsistenten Client-/Serverstand testen.
Alte Runtime-Verzeichnisse erhalten; bei Problemen den Katalog auf das vorherige
geprüfte Manifest zurückstellen und den dazugehörigen Server-Pluginstand laden.
Danach Gameserver und betroffene Skyrim-Clients neu starten. Lokale ZIPs sind
keine Live-Veröffentlichung. Produktionskatalog und Transportbytes nach einem
Upload separat prüfen.
