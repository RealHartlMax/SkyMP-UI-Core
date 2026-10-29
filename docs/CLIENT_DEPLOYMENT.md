# Client- und Launcher-Auslieferung

Ein externes Server-Plugin kann diese Oberfläche im aktuellen Fork nicht allein
installieren. UI Core benötigt einmalig den Integrationspatch im bestehenden
SkyMP-Client und CEF. Weitere Verbraucher mit registrierten Templates benötigen
danach keine neuen Änderungen an UI Core oder am Client.

## Geänderte Fork-Dateien

- `skymp5-client/src/services/services/browserService.ts`: gemeinsamer Fokuskoordinator.
- `skymp5-client/src/services/services/uiCoreBridge.ts`: Probe/Ready, Pakete, Lease/Reset.
- `skymp5-front/src/index.js`: Host im vorhandenen Provider neben App, in allen normalen Ingame-Renderpfaden.
- `skymp5-front/src/features/uiCore/index.js` und `index.css`: aus diesem Repository erzeugter Host.
- `skymp5-client/tests/helpers/chatHarness.cjs`: neuer Serviceimport im bestehenden Regressionstest.

Keine Änderungen an `skymp5-server/ts/index.ts`, Chat-Komponenten, Chat-Parser,
Spieler-Authentifizierung oder dem separaten SkyMP-Chat-Repository. Der Server
benötigt für UI Core keinen neuen nativen Core-Build.

`tools/integrate-fork.cjs` erzeugt zuerst einen Patch mit Ausgangs-/Zielhashes
und Backups in `artifacts/fork-integration/`. `--apply` schreibt nur bei passenden
Hashes; `--refresh` erneuert den vorbereiteten Patch aus der ursprünglichen
lokalen Basis. Beispiel (nach npm run build):

```powershell
npm run integration:plan
npm run integration:apply
# Nach eigenen Änderungen am Host:
node tools/integrate-fork.cjs --refresh --apply
```

Der Patch basiert auf dem auditierten lokalen Fork mit bereits integrierter
ChatBridge. Auf einem öffentlichen Checkout ohne diese Vorarbeiten nicht blind
anwenden. `git apply --check` bzw. der hashgeprüfte Installer müssen zur jeweiligen
Basis passen. Backups enthalten vorherige Benutzeränderungen und sind lokal.

## Erzeugte Clientdateien

```powershell
cd D:/GitHub/skymp/skymp5-client
npm run build
cd D:/GitHub/skymp/skymp5-front
npm run build
```

Clientziel: `skymp/build/dist/client/Data/Platform/Plugins/skymp5-client.js`.
Frontendziel: `skymp/skymp5-front/dist/` samt `assets-manifest.json`. Der Launcher
verwendet zusätzlich seinen bestehenden Kompatibilitätsbuilder, damit dessen
CEF-Pfad-/Weltstart-Korrekturen erhalten bleiben:

```powershell
cd D:/GitHub/skymp-client-launcher
node launcher/scripts/build-client-runtime.mjs --source D:/GitHub/skymp/skymp5-client --output D:/GitHub/SkyMP-UI-Core/artifacts/launcher-client-code
```

Der Ausgabeordner muss neu sein. Clients erhalten das resultierende Skript als
`Data/Platform/Plugins/skymp5-client.js` sowie HTML/JS/CSS/Bilder/Fonts/Sounds des
Frontendbuilds unter `Data/Platform/UI/`. Keine zweite HTML-Root und kein zweiter
Browser. Keine Dev-/Admin-URL oder LocalStorage-Loginfreigabe nötig.

## Launcher-Runtime

Der Launcher-Adapter wird mit `node tools/integrate-launcher.cjs --apply` aus dem
UI-Core-Repo vorbereitet/installiert. Die vier Änderungen werden vorher mit
Hashes geprüft und gesichert. Im Launcher sind danach vorhanden:

- `launcher/scripts/create-ui-core-runtime.mjs`
- `launcher/scripts/archive-runtime.ps1`
- npm-Skript `package:runtime:ui-core`
- ergänzte `docs/RUNTIME_UPDATES.md`

Für die Abschlussausgabe wurde der im Browser geprüfte CEF-Build nach
`artifacts/verified-frontend` eingefroren und das Clientskript nochmals unter
`artifacts/launcher-client-code-final` gebaut. So können zwischenzeitliche
Frontend-Builds aus anderen Arbeiten die geprüften Paketbytes nicht austauschen.
Der vorherige lokale Runtime-Entwurf bleibt als `runtime-2026-10-28-ui-core-before-final`
erhalten; die abschließende Ausgabe verwendet den neuen Releasepfad `ui-core-v2`.

Tatsächlich verwendeter Paketbefehl:

```powershell
node launcher/scripts/create-ui-core-runtime.mjs --base-runtime-root D:/GitHub/skymp-client-launcher/local-builds/current/runtime-tintfix-2026-10-25/client-runtime --game-version 1.7.104.0 --release client-2026-10-28-ui-core-v2 --client-script D:/GitHub/SkyMP-UI-Core/artifacts/launcher-client-code-final/skymp5-client.js --ui-source D:/GitHub/SkyMP-UI-Core/artifacts/verified-frontend --output D:/GitHub/skymp-client-launcher/local-builds/runtime-2026-10-28-ui-core
```

Der Builder prüft den ganzen Basiskatalog, jedes Basisbyte und die Client-/CEF-
Integrationsmarker. Er übernimmt native DLL/EXE/BIN-Dateien unverändert, ersetzt
Clientskript/CEF als Einheit und erzeugt Manifest/Katalog sowie hashadressierte
`payloads/*.bin` für Textassets. Alte UI-Assets werden nicht übernommen. Weitere
Skyrim-Versionen aus dem Basiskatalog bleiben erhalten. Neue Ausgabe wählen;
bestehende Releases werden nicht überschrieben.

Vorbereitete Ausgabe: 212 Installationsdateien, 37 binäre Texttransporte,
73 unveränderte native Dateien, 251 bytegenau geprüfte ZIP-Einträge. Nicht mehr
referenzierte Dateien früherer Frontend-Builds wurden durch den Snapshot entfernt. Maßgeblich
sind `VALIDATION.json` und `SHA256SUMS` im Ausgabeordner. Das ZIP enthält
`client-runtime/` für den Runtime-Webroot, keine Launcher-EXE und keinen Server.

Ein manueller Rollout lädt zuerst das neue unveränderliche Paketverzeichnis und
alle `.bin`-Transporte im Binärmodus hoch, zuletzt `catalog.json`. Den tatsächlichen
Live-Katalog vorher mit seinen weiteren Versionen abgleichen. Danach Live-Manifest,
Größen und SHA-256 der tatsächlichen Downloadtransporte prüfen, erst dann Spieltests.
Keine Veröffentlichung oder Übertragung wurde in diesem Arbeitsauftrag ausgeführt.

Serverprofil `launcherResources.runtimeSource` muss auf diesen Runtime-Katalog
zeigen; eine manuelle Clientquelle im Launcher kann den automatischen Katalog
übersteuern. Bereits laufende Skyrim-Prozesse benötigen einen vollständigen
Neustart. Server-Pluginupdates/Sprachänderungen benötigen separat den Gameserver-
Neustart. Native Kompatibilität, Steam, tatsächlicher Download vom Webhost und
Zweispieler-Gameplay wurden hier nicht erneut geprüft.


## UI-Editor 1.1.0 (29.10.2026)

Die aktuell geprüften Dateien liegen in artifacts/editor-fork/skymp5-front/dist
und artifacts/uiedit-launcher-client/skymp5-client.js im UI-Core-Repository.
Der ursprüngliche SkyMP-Checkout wurde dafür nicht beschrieben. Der vollständige
Patch ist aktualisiert; bei bereits installiertem UI Core sind nur die native
uiCoreBridge.ts und features/uiCore/index.js/index.css neu zu übernehmen.

Server-Plugin und Client-/CEF-Paket gemeinsam aktualisieren. Der neue Ready-
Marker editorVersion: 1 ist für /UiEdit erforderlich. API und Frontend-Protokoll
bleiben 1, bestehende Verbraucher benötigen keine Änderungen.

npm run package:client erstellt nach bestandenem Browserlauf ein separates
SkyMP-UI-Core-Client-1.1.0.zip aus den exakt gehashten geprüften Dateien. Das ZIP
enthält Data/Platform/Plugins/skymp5-client.js und den vollständigen CEF-Build
unter Data/Platform/UI/. Es ist ein Client-Overlay für eine passende vorhandene
Runtime, kein Server-Plugin und keine Launcher-EXE. Für Launcher-Auslieferung
müssen neue Runtime-Manifeste/-Kataloghashes erstellt werden; bestehende Kataloge
dürfen nicht weiter auf die alten Clientbytes zeigen. Eine vollständige lokale
Runtime kann mit dem vorhandenen create-ui-core-runtime.mjs vorbereitet werden.

Bedienung: UI_EDITOR.md. Aktuelle Prüfergebnisse: UI_EDITOR_VALIDATION.md.
