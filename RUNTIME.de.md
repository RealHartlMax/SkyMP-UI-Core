# Ablage der SkyMP-UI-Core-Runtime

[English](RUNTIME.md) · [Русский](RUNTIME.ru.md)

UI Core besitzt seine native JS-Brücke und den CEF-Host. Quellen in diesem Repository: `client/runtime.ts`, `client/native/uiCoreBridge.ts`, `client/runtime-ui.tsx`, `client/host.tsx` und `client/style.css`. `tools/build-runtime.cjs` wird von `tools/build.cjs` aufgerufen und erzeugt `client/` an der Repository-Wurzel; der Build kopiert es nach `release/SkyMPUICore/client/`. Bei einem später beauftragten Build entsteht:

```text
release/SkyMPUICore/client/
  manifest.json
  client.js
  ui.js
  ui.css
release/SkyMPUICore/
  plugin.json
  index.cjs
  config.json
  client/
```

Auf dem **Gameserver** den vollständigen Pluginordner unter `<game-cwd>/Plugins/SkyMPUICore/` installieren. `plugin.json` enthält `"runtime": "client/manifest.json"`; das Runtime-Manifest gehört direkt in diesen Ordner. Nicht im Launcher-Repository, Server-Webroot oder einem zweiten `Server/` unterhalb des tatsächlichen Game-CWD ablegen. `<game-cwd>` ist das Prozess-Arbeitsverzeichnis mit `server-settings.json`.

Herunterladbar sind nur ausdrücklich deklarierte öffentliche Dateien unter `client/`. `index.cjs`, Serverkonfiguration, Locale-Quellen, Zugangsdaten und Signierschlüssel bleiben außerhalb. DLL/EXE/PEX/native Plugins gehören dort nicht hinein. Zusätzliche öffentliche Assets in die explizite Manifest-Dateiliste aufnehmen; bloßes Kopieren veröffentlicht nichts.

**Signaturen sind optional.** Ohne Schlüssel reicht das Manifest mit Größe und SHA-256 jeder Datei; das schützt vor beschädigten Downloads, nicht vor einem böswilligen Server. Erst wenn ein Spieler im Launcher vertrauenswürdige Herausgeber einträgt, sind gültige Signaturen dieser Herausgeber Pflicht.

Das Producer-SDK in `tools/plugin-runtime/` erzeugt SHA-256/Größen und Ed25519-Signatur. Für einen späteren Build `SKYMP_PLUGIN_SIGNING_KEY` auf einen privaten Schlüssel außerhalb des öffentlichen Baums und `SKYMP_PLUGIN_KEY_ID` auf dessen Herausgeber-ID setzen oder den gebauten Ordner mit dem SDK signieren. Unsignierte Entwicklerkandidaten werden weder vom Launcher akzeptiert noch als Release paketiert. Bei geänderten Paketbytes oder Schlüsseln neue Pluginversion verwenden; `(pluginId, version)` bleibt unveränderlich. Manifest-/Plugin-ID: `skymp-ui-core`.

Nach Auslieferung aktivieren und den **Gameserver** neu starten. Nur erfolgreich gestartete Plugins werden angekündigt. Der Server liefert Manifeste/Dateien über `/api/launcher/plugin-runtime/`; der Launcher installiert unter `Data/Platform/PluginRuntime/packages/<pluginId>/<manifestSha256>/` und verwaltet den servergebundenen aktiven Index. Spieler benötigen Basis-Client/Launcher mit Runtime API 1 und müssen den öffentlichen Herausgeberschlüssel unabhängig freigeben. Der generische Bootstrap wird einmal installiert; kompatible spätere UI Core-Updates brauchen nur Plugin-Build/-Auslieferung, keinen Launcher-EXE- oder gemeinsamen Runtime-Neubau.

Clientmodul API 1 verwendet `activate(api)` mit Aufräumen; UI API 1 läuft im vorhandenen CEF-Host und entfernt Listener/Timer/Zustand beim Abbau. UI-Core-Consumer wie Metabolism registrieren Widgets und Menüs über die bestehende Server-API; dafür benötigen sie weder einen weiteren Host noch allein wegen dieser Templates ein eigenes Runtime-Paket. Vollständiger Vertrag, Signierung und spätere Abnahme: [Plugin Runtime Loader](docs/PLUGIN_RUNTIME.md).

Diese Anleitung bereitet nur die Quellstruktur vor. Kein neuer Build, ZIP, veröffentlichter Schlüssel oder Spieltest in diesem Dokumentationsauftrag.
