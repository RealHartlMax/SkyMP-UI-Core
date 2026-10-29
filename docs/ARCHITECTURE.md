# Verifizierte Architektur

> Architektur-Update 29.10.2026: [PLUGIN_RUNTIME.md](PLUGIN_RUNTIME.md) ersetzt die feste Client-/CEF-Quellkopie durch ein Plugin-eigenes, signiertes Runtime-Paket. Die generischen Loader-Quellen liegen im Fork und Launcher. Alle nachfolgenden Befunde zum alten Kopier-/Paketweg sind historische Integrationsnachweise. Für diesen neuen Stand wurden keine Builds oder ZIPs erstellt.

Audit: 28.10.2026. Arbeitsrepository `D:/GitHub/SkyMP-UI-Core`, Integrationsquelle
`D:/GitHub/skymp`, Chat nur lesend `D:/GitHub/SkyMP-Chat`, Runtime-Auslieferung
`D:/GitHub/skymp-client-launcher`.

## Befunde vor der Implementierung

Der lokale SkyMP-HEAD und der über den GitHub-Connector abgefragte neueste Commit
auf `RealHartlMax/skymp` sind `5a70479f1944c32837c58592fd4fcbf308564b68`.
Der lokale Arbeitsbaum enthält darüber hinaus uncommittete Chat-, Fokus-,
Frontend-Build-, Spawn- und Runtime-Anpassungen. Diese sind Integrationsbasis;
ein Patch gegen den öffentlichen Commit allein würde diese Änderungen verlieren.
Chat ist lokal bereits implementiert; seine AGENTS.md beschreibt teilweise ältere
Zielverträge. Maßgeblich sind `Plugins/SkyMPChat/src/{runtime,registry,entry}.cjs`
und die tatsächlich vorhandene Client-/CEF-Brücke.

Gelesen: `README-plugins.md`, Server-/Client-Scripting-Referenz, Events-/Properties-
Dokumentation, `docs/skyrim_platform/browser.md`, Server `ts/index.ts`, Client
`browserService.ts`, `gamemodeEventSourceService.ts`, `chatBridge.ts`, Frontend
`App.js`, `constructor.js`, `utils/Widgets.js`, Chat-Komponenten, Redux-/Chat-Bridge,
Client-/Frontend-Webpack-Konfiguration und Launcher-Runtime-Paketierung.

## Loader und Serveridentität

`skymp5-server/ts/index.ts` entdeckt direkte Unterordner von `process.cwd()/Plugins`.
`kind: gamemode` setzt `globalThis.mp` auf den gemeinsamen ScampServer und lädt
über `requireTemp` ausschließlich den Entry in einen temporären `.js`-Pfad.
Es gibt keine Plugin-Abhängigkeitsauflösung, keinen Frontend-Installer und keinen
verlässlichen Plugin-Hot-Reload. Neue Plugins bleiben im safe-Modus deaktiviert;
Aktivierung und vollständiger Gameserver-Neustart sind nötig. `requireTemp` fängt
Ladefehler intern ab: der Dashboardstatus allein beweist daher keinen API-Start.

Die existierenden nativen Methoden sind in `ts/scampNative.ts` und
`cpp/addon/ScampServer.cpp` nachgewiesen: `isConnected`, `getUserActor`,
`getUserByActor`, `sendCustomPacket`. `ScampServerListener::OnCustomPacket`
liefert die authentifizierte native User-ID getrennt vom JSON. UI Core prüft
die bidirektionale User-/Actor-Zuordnung für jedes Ziel und jede Anfrage.

## Tatsächlicher Transport

UI Core verwendet wie der vorhandene Chat zuverlässige CustomPackets:

1. CEF `window.skyrimPlatform.sendMessage('skympUi:…', data)`.
2. Native `browserMessage` im bestehenden BrowserService/UiCoreBridge.
3. Controller `sendMessage`, `MsgType.CustomPacket`, `reliability: 'reliable'`.
4. Scamp `customPacket(userId, content)` und serverseitige Validierung.
5. `mp.sendCustomPacket(userId, JSON.stringify(packet))` nur an diesen User.
6. Client `customPacketMessage` -> korrekt JSON-maskierter `CustomEvent` im CEF.
7. React-Host validiert erneut und rendert ausschließlich Text/feste Komponenten.

`makeEventSource/ctx.sendEvent` wäre ebenfalls vorhanden, ist für diesen Build
aber unnötig. UI Core verteilt weder fremden Scriptcode noch neue EventSources
und hängt nicht von deren Signaturkonfiguration ab. Es verwendet keine erfundenen
`mp.sendToClient`, `mp.broadcast` oder `window.skymp.send`-APIs.

## Kleinster Integrationseingriff

`skymp5-front/src/index.js` mountet den neuen Host als Geschwister des vorhandenen
App im selben Provider/CEF-Root. Damit funktioniert er auch im normalen, nicht
eingeloggten Ingame-Renderpfad von App, ohne devUi/Admin/LocalStorage-Tricks.
`constructor.js`, `Widgets.js` und Chat-Komponenten werden nicht geändert.

Der BrowserService bleibt alleiniger Besitzer des nativen Browserfokus. Eine
kleine UiCoreBridge ergänzt Ready/Probe, Verbindungsreset, Action-Transport und
Fokusanfragen. Die zentrale Policy koordiniert Skyrim-Menüs, UI-Menüs, Chat,
Enter/Escape und bestehende F2/F6-Bindings. Das eigenständige Chat-Repository
bleibt unverändert. Der Integrationsinstaller prüft Ausgangshashes und erzeugt
isolierte Änderungen/Backups statt fremde uncommittete Änderungen zu ersetzen.

API v1 und Frontend-Protokoll v1 werden getrennt geprüft. Handshake erst nach
React-Mount und eigenem Actor-Spawn; aktuelle Snapshots auch bei langsamem CEF,
Reload und Reconnect. Vollständige, sequenzierte und gedrosselte Zustandsframes
ersetzen verlorene Teilupdates; Warteschlangen, Zustände, Replaydaten und TTLs
sind begrenzt. Ein serverseitiger Sitzungspräfix mit monotonem Requestzähler
verhindert Wiederholung auch nach Verdrängung eines alten Ack-Eintrags.

## Distribution und Nachweisgrenze

Server: vollständig gebündeltes `release/SkyMPUICore/index.cjs`.
Client: `Data/Platform/Plugins/skymp5-client.js` und alle erzeugten Dateien aus
`skymp5-front/dist` nach `Data/Platform/UI/`. Der Launcher bezieht diese aus
einem separat versionierten Runtime-Katalog. Native DLLs sind für UI Core
nicht zu ändern. Textdateien benötigen die bereits vorhandenen hashadressierten
`.bin`-Downloadtransporte; Katalog, Manifest, Installationsdatei und Transport
müssen zueinander passende SHA-256 und Größen besitzen.

Automatische Loader-/native Bot-/Browsertests sind mögliche Integrationsbelege,
aber kein Ersatz für zwei echte Skyrim-Clients mit CEF, Gameplay und Chat.
Eine echte Spielsession wird nur als bestanden markiert, wenn sie tatsächlich
durchgeführt wurde. Eine lokale Runtime ist weder veröffentlicht noch auf dem
Update-Webserver ausgerollt. Siehe VALIDATION.md und manuellen Testplan.


## Erweiterung 1.1.0: Editor und Status-HUD (29.10.2026)

Lokaler und öffentlicher Fork-HEAD wurden erneut auf
5a70479f1944c32837c58592fd4fcbf308564b68 abgeglichen; der vorhandene lokale
Arbeitsbaum bleibt die Integrationsbasis. Die unveränderten Chat-Quellen
registerCommand/unregisterCommand, case-insensitive CommandRegistry sowie die
begrenzt geleerte skympChatReady-Queue wurden tatsächlich gelesen. Der UI-Core-
Adapter nutzt diese Schnittstellen und prüft vor dem privaten Edit-Paket erneut
native User-/Actor-Zuordnung, Ready-Lease und editorVersion. Die Server-API bleibt
v1. Das Wire-Übersetzungsformat bleibt identisch; zusätzliche Editor-DE/EN-Texte
sind separat im Client gebündelt, damit alte Clients am neuen Server nicht wegen
neuer Locale-Keys abgewiesen werden.

Der reale Metabolism-Adapter unter src/integrations/ui-core/adapter.ts registriert
kind=icon-list und liefert drei lokalisierte Brüche mit Status/Hint. Er bleibt
unverändert. Der generische Renderer zerlegt ausschließlich die Präsentation
solcher Listen. Einzelne lokale Änderungen verschieben andere Elemente nicht mit.

Produktionsbuilds werden in einer privaten Kopie unter artifacts/editor-fork
geprüft. Die Originalcheckouts SkyMP, SkyMP-Chat, SkyMP-Metabolism und Launcher
werden dafür nicht beschrieben. Dependency-Pfade in dieser Kopie dienen nur dem
lokalen Build und werden nicht ausgeliefert.
