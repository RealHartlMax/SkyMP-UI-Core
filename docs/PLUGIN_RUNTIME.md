# Plugin Runtime Loader – API 1

Die gemeinsame SkyrimPlatform-Runtime enthält den generischen nativen Loader und den Host im vorhandenen CEF-Browser. Clientcode, UI-Templates, CSS und öffentliche Assets gehören zum jeweiligen Plugin. Nach dem einmaligen Bootstrap benötigen kompatible Plugin-Änderungen keinen neuen Launcher-EXE- oder gemeinsamen Runtime-Build. Native DLLs bleiben im zentralen, zur Skyrim-Version passenden Basispaket.

## Aufbau und Zuständigkeit

```text
Plugins/SkyMPChat/
  plugin.json                 # runtime: "Runtime/manifest.json"
  index.cjs                   # privater Server-Einstieg
  config.json                 # private Server-Konfiguration
  Runtime/
    manifest.json
    client.js                 # optional: nativer JS-Client
    ui.js                     # optional: CEF-Oberfläche
    ui.css                    # optional: Stylesheet
    assets/...
```

Reine Server-Plugins lassen `runtime` weg. UI-Core-Consumer wie Metabolism registrieren nur Daten, Widgets und Menüs bei UI-Core und brauchen weder ein eigenes Runtime-Paket noch einen zweiten Browser. Chat, UI-Core und YACA liefern eigene Runtime-Pakete.

Der Gameserver veröffentlicht ausschließlich die Plugins, die beim aktuellen Start erfolgreich geladen wurden. Dashboard-Häkchen beschreiben weiterhin den nächsten Start. Installation oder Deaktivierung deshalb mit einem Gameserver-Neustart abschließen. Dashboard-/Backend-Änderungen erfordern zusätzlich den entsprechenden Dienstneustart. Beendete Prozess-Plugins werden aus der Veröffentlichung entfernt. Dateien und Manifest gemeinsam ausliefern und danach neu starten.

## Manifest und HTTP-Auslieferung

Das öffentliche Launcher-Manifest verwendet Version `3`, sobald Runtime-Pakete benötigt werden; ältere Launcher lehnen die unbekannte Version ab. Ohne solche Pakete bleibt Version `2` erhalten. `pluginRuntime` enthält `{version:1,revision,packages:[...]}` mit Plugin-ID, Version, SHA-256 und Größe der Manifestdatei sowie ihrem Downloadpfad.

- `GET /api/launcher/plugin-runtime/manifest`: aktiver Paketkatalog.
- `GET /api/launcher/plugin-runtime/manifests/:sha256`: unveränderte Manifestbytes.
- `GET /api/launcher/plugin-runtime/files/:id`: ausdrücklich freigegebene Datei. ID = SHA-256 von `manifestSha256 + "\0" + file.path`.

Es gibt keine öffentliche Verzeichnisauflistung des Plugins. Nur die explizite Dateiliste unter `Runtime/` wird ausgeliefert. Server-Bundle und Konfiguration außerhalb dieses Verzeichnisses erhalten keinen Downloadpfad. Symlinks, Pfadausbrüche, Windows-Gerätenamen, Namenskollisionen ohne Beachtung der Großschreibung und native Binärdateien sind ausgeschlossen. Auch Text wird bytegenau als Binärtransport geliefert.

```json
{
  "formatVersion": 1,
  "pluginId": "skymp-chat",
  "version": "1.2.0",
  "requires": {"clientApi": 1, "uiApi": 1},
  "entrypoints": {"client": "client.js", "ui": "ui.js", "styles": ["ui.css"]},
  "files": [{"path": "client.js", "size": 123, "sha256": "64 kleine Hex-Zeichen"}],
  "signature": {"algorithm": "ed25519", "keyId": "herausgeber", "value": "128 kleine Hex-Zeichen"}
}
```

Das Beispiel ist gekürzt: Jeder Einstieg und jedes Stylesheet muss in der vollständigen Dateiliste vorkommen. Unbekannte Felder werden abgelehnt. Grenzen: 128 aktive Pakete, 256 Dateien/Paket, 16 MiB/Datei, 64 MiB/Paket, 256 MiB aktive Dateien insgesamt, 256 KiB/Manifest, 8 MiB/aktivem Index und 240 Zeichen pro vollständigem Installationspfad relativ zum Spielverzeichnis.

Jedes Paar `(pluginId, version)` hat unveränderliche Manifestbytes einschließlich Signatur. Geänderte Dateien oder Schlüssel deshalb unter einer neuen Version veröffentlichen. Der Launcher speichert bereits geprüfte Revisionen und lehnt nachträglich geänderte Versionen ab. Der gemeinsame Vertrag liegt in `contract.cjs`; die SDK-Quellen in den Plugin-Projekten unter `tools/plugin-runtime/` müssen damit identisch bleiben.

Alte Server ohne `pluginRuntime` verwenden weiterhin die eingefrorenen Chat-/UI-Core-Brücken. Dafür schreibt der Launcher `plugin-runtime-managed:false`. Aktualisierte Server veröffentlichen eine explizite, gegebenenfalls leere Paketliste. Dort werden die alten Oberflächen ausgehängt und nur die angekündigten Plugin-Oberflächen aktiviert.

## Signieren und Herausgeber freigeben

Launcher und nativer Loader prüfen Ed25519 über kanonisches UTF-8-JSON: Objektschlüssel rekursiv sortieren, Array-Reihenfolge erhalten, keine zusätzlichen Leerzeichen; das gesamte Feld `signature` auslassen. SHA-256, Signatur und öffentliche Schlüssel verwenden kleine Hex-Zeichen. Ein Entwickler-Build darf einen unsignierten Kandidaten erzeugen; der Launcher akzeptiert ihn nicht und die Release-Paketierung verlangt ein signiertes Manifest.

```powershell
# Einmalig, außerhalb des öffentlichen Plugin-/Runtime-Verzeichnisses:
node tools/plugin-runtime/package.cjs keygen --output C:/private/herausgeber.pem --key-id herausgeber
# Die Ausgabe ist eine JSON-Zuordnung Herausgeber-ID -> öffentlicher Schlüssel.
$env:SKYMP_PLUGIN_SIGNING_KEY = 'C:/private/herausgeber.pem'
$env:SKYMP_PLUGIN_KEY_ID = 'herausgeber'
# Bei einem später ausdrücklich beauftragten Plugin-Build wird damit signiert.
# Alternativ einen bereits gebauten Kandidaten signieren:
node tools/plugin-runtime/package.cjs sign --root Runtime --private-key C:/private/herausgeber.pem --key-id herausgeber
```

Den privaten Schlüssel weder in `Runtime/` ablegen noch in öffentliche Archive übernehmen. Spieler tragen nur die unabhängig geprüfte öffentliche JSON-Zuordnung in **Launcher-Einstellungen → Spiel → Vertrauenswürdige Plugin-Herausgeber** ein. Der Gameserver kann sich diesen Vertrauensstatus nicht selbst erteilen. Unbekannte Herausgeber, veränderte Bytes, falsche Signaturen, inkompatible APIs und geänderte vorhandene Versionen brechen die Vorbereitung vor dem Skyrim-Start ab.

Der aktuelle Quellauftrag hat keine dauerhaften Herausgeberschlüssel oder Release-Pakete erzeugt. Automatisierte Quelltests verwenden ausschließlich temporäre Testschlüssel, die anschließend gelöscht werden.

## Download, Installation und Serverwechsel

Der Launcher bereitet zuerst die zur Skyrim-Version passende Basis-Runtime vor. Für Plugin-Pakete muss deren Manifest `pluginRuntimeApi:1` ausweisen. Danach werden die signierten Plugin-Manifeste und alle Dateien geprüft. Die Dateien landen ausschließlich unter `Data/Platform/PluginRuntime/packages/<pluginId>/<manifestSha256>/`. Ein per Hash gebundener `active.json`-Index enthält die komplette Paketliste sowie Zielhost und Spielport.

Index, Schlüssel-Freigaben und Einstellungen gehen über das vorhandene Installationsjournal mit Kollisionsprüfung, Sicherung und Wiederherstellung. Fehlgeschlagene Downloads aktivieren keinen unvollständigen Stand. Beim Serverwechsel ersetzt der Launcher die Paketliste und stellt zuvor verwaltete Dateien über denselben Journalpfad wieder her. Ein direkter Wechsel im Spiel zu einem anderen Host wird abgewiesen, bis dieser Server im Launcher vorbereitet wurde.

Der native Loader prüft Index, Signaturen und sämtliche Dateien erneut, bevor er irgendein heruntergeladenes Clientmodul ausführt. Native JS-Module sind vertrauenswürdiger SkyrimPlatform-Code; die Herausgeberprüfung ist keine Sandbox.

## Entwickler-Einstiege und Aufräumen

`client.js` ist ein eigenständig gebündeltes CommonJS-Modul mit `apiVersion = 1` und `activate(api)`. Es darf eine synchrone Aufräumfunktion zurückgeben. Verwende das injizierte `api.sp`, `api.controller` und `api.constants.CustomPacket`; importiere keine zweite SkyrimPlatform-Instanz. Native Event-Abonnements, Emitter-Listener, Fokuszustände und registrierte Aufräumfunktionen werden bei Disconnect, fehlgeschlagener Aktivierung und Reload entfernt.

`ui.js` registriert sich mit `window.SkyMPPluginRuntime.register({pluginId,apiVersion:1,mount(ctx)})`. `mount` erhält einen eigenen DOM-Bereich, Asset-Auflösung, React/Store/i18n, Reducer-Registrierung, Fokus-, Event- und Aufräumfunktionen. Es darf eine synchrone Aufräumfunktion zurückgeben. Gemeinsame Imports: React, ReactDOM, React Redux, React i18next, React Draggable und React Resizable. Während des Ladens liefert `require('skymp-plugin-host')` den aktuellen Host-Kontext. Verwende den vorhandenen Browser und entferne eigene Timer, Sockets und zusätzliche Listener beim Aufräumen. Doppelte Reducer-Besitzer sind ausgeschlossen; Paketabbau löscht auch deren Zustand. Eine fehlgeschlagene UI-Aktivierung entfernt die Module und stoppt die Verbindung.

Chat und UI-Core verwenden weiterhin ihre vorhandenen serverseitig validierten Nachrichtenpfade. YACA behält den nativen EventSource-/TeamSpeak-Transport, sein Standard-Server-Bundle enthält aber keine eingebettete UI mehr. Die signiert heruntergeladene Oberfläche verwaltet ihren Socket und ihre Timer. Das native YACA-Modul entfernt beim Paketabbau außerdem den EventSource-Browser-Handler und beendet dessen Update-Kette. Dadurch begrenzt die 100-KiB-Grenze nativer EventSource-Funktionskörper nicht mehr die UI-Größe. `dist/ui/overlay.js` bleibt ein Werkzeug-Ausgang für Legacy-Tests; `SKYMP_YACA_LEGACY_OVERLAY=1` nimmt ihn bei einem späteren Build ausdrücklich wieder auf. Das neue Standardpaket benötigt den Bootstrap.

## Spätere Abnahme

Quelltests und `tsc --noEmit` ersetzen keine Installation oder Spielabnahme. Nach den später beauftragten Builds: Plugin-Manifeste signieren, Herausgeber freigeben, Server vorbereiten, Downloadbytes prüfen, Skyrim starten und Chat/UI-Core/Metabolism/YACA benutzen. Reconnect sowie Wechsel zu einem Server mit anderen, weniger oder keinen Plugins prüfen; alte DOM-Bereiche, Listener, Fokus- und Datenzustände müssen verschwinden. Manipulierte Dateien, unbekannte Herausgeber und geänderte vorhandene Versionen müssen abgewiesen werden. Jede unterstützte Skyrim-Version sowie echtes TeamSpeak-Audio und Lipsync separat abnehmen.

Im aktuellen Auftrag wurden ausschließlich Quellen und Dokumentation geändert. Keine neuen Builds, ZIPs, Commits, Pushes oder Veröffentlichungen.
