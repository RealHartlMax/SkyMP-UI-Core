# Abschlussbericht: Universelles Plugin-UI-Framework

Stand **04.11.2026**, lokaler Kandidat `1.2.0-dev.20261104`. Ausgangsaudit:
[FRAMEWORK_AUDIT.md](FRAMEWORK_AUDIT.md). Keine Quellen in Referenzrepositories
geändert, keine vorhandenen Änderungen zurückgesetzt. Keine ZIPs, Commits,
Pushes, Tags, Uploads oder Releases erstellt. Keine fremden Repositories gebaut.

## Implementiert

- API V1 und Frontend-Protokoll V1 bleiben erhalten. Die optionale eingefrorene
  `framework`-Erweiterung V1 ist über Feature-Discovery verfügbar.
- `core:panel-v1` ergänzt Reiter, Text, Fortschritt, Listen, Tabellen und
  Gegenstandslisten. Vorhandene Formulare, Dialoge, Bestätigungen, Notifications
  und Widgets werden weiterverwendet. Neue Bedienhinweise sind DE/EN lokalisiert.
- Alle neuen Zustände und Action-Payloads werden auf beiden Seiten geprüft.
  Panels verwenden aktuelle serverseitige Revisionen; Auswahlen werden gegen
  angebotene, nicht gesperrte Zeilen geprüft. Keine Client-Identitäts-/Permissiondaten.
- Modale Priorität, begrenzte parallele Dialoge und dieselbe Ordnung auf Server
  und Client verhindern bedienbare verdeckte Menüs. Unregister/Close/TTL/Replace/
  Disconnect brechen zugehörige Arbeit ab; Handler erhalten ein AbortSignal.
- Owner-Cleanup und Action-Deregistrierung entfernen eigene Registrierungen,
  Spielerzustände und Handler, ohne fremde Namespaces zu übernehmen.
- Die gemeinsame Interaktionsregistry kombiniert Actions verschiedener Plugins
  in einer Ansicht pro Spieler. Ziele und Actionzuordnung bleiben serverseitig;
  finale Freigaben kommen vom jeweiligen Plugin. Ein angenommenes Angebot ist
  nur einmal ausführbar. Es werden keine Welt-/Handels-/Inventarregeln implementiert.
- Die native Brücke kündigt neue Fähigkeiten nach dem alten strikten Ready an.
  Alte Server ignorieren die Erweiterung; alte Clients erhalten ihre bisherigen
  Widgets und Dialoge. Unbekannte Framework-Versionen werden kontrolliert abgewiesen.
- HUD-Editor, lokale Präferenzen, Elementschlüssel und Metabolism-/YACA-Renderpfade
  bleiben erhalten. Menübreite berücksichtigt jetzt auch hohe Skalierung bei
  kleinen Auflösungen. Unerwarteter Fokusverlust wird über den vorhandenen
  Fokuspfad korrigiert, während native Interaktionssperren Vorrang haben.
- Sequenznummern werden vor dem nativen Versand reserviert, damit unmittelbar
  verschachtelte Capability-Antworten keine identischen Snapshotnummern erhalten.
- Ein innerhalb eines Frames geschlossenes und neu geöffnetes Panel behält keine
  ausstehende Schließanfrage der alten Revision. Versionsmismatch bricht auch
  bereits angenommene beziehungsweise laufende Action-Jobs ab.

## Automatische Prüfungen

| Prüfung | Ergebnis und Aussagegrenze |
| --- | --- |
| `npm run typecheck` | TypeScript ohne Fehler, einschließlich neuem Beispiel |
| `npm test` | lokaler Build und 66 Tests; kein Fehler/Skip im vorhandenen Workspace |
| `npm run verify:fork` | echter lokaler Manifestvalidator, safe Discovery, Aktivierung, requireTemp, zwei unabhängige Consumer |
| `npm run verify:native` | zwei echte Scamp-Bots, native User-/Actor-Zuordnung und private, autorisierte V1-Aktion; Skyrim nicht gestartet |
| Plugin-native Brücke | Capability-Upgrade, Legacy-Fallback, maskierter CEF-Transport, Revision beim Schließen, Timeout/Disconnect |
| Consumer-Kompatibilität | unveränderte lokale Metabolism-, Survival- und YACA-Adapter im Speicher gebündelt und mit dem UI-Service ausgeführt |
| Runtime | gebaute Dateihashes/Versionen, Ed25519 mit temporärem Testschlüssel, Manipulationsabweisung; echter Fork-Publisher akzeptiert `client/` und weist `Runtime/` ab |
| Browser | 11 Bedienprüfungen mit zwei isolierten Chromium-Clients, keine Page-/Bridgefehler |

Der Browserlauf verwendet den echten aktuellen React-Host, UI-Core-Server und die
Plugin-eigene native Brückenquelle in einer lokalen Renderer-Fixture. Native
Browser-/Menücallbacks werden simuliert. Es ist kein neuer Produktionsroot und
kein Nachweis des aktuellen gesamten SkyMP-Frontend-Builds. Die gesonderten
bestehenden Fokustests lesen den realen BrowserService, ChatBridge und
KeyboardEventsService aus dem Fork. Alle Spieleingabe-/CEF-/Audiotests bleiben
als reale Abnahme getrennt.

Im Browser geprüft: vier erhaltene Metabolism-/YACA-Elemente; private Panels und
Injection nur als Text; Pflichtauswahl, Reitertasten, Inventar-/Tabellenauswahl und
Tab-Fokus; drei Auflösungen; richtige native Identität am Server; Modalpriorität/
Escape; Fokusverlust und Suspend/Resume; gemeinsame Interaktion; `/UiEdit` mit
lokaler Speicherung und 150 %; Frontendreload; Disconnect/Reconnect ohne stale UI.
Die Screenshots wurden visuell geprüft.

Lokale Belege (durch Git ignorierte Build-/Prüfausgaben):

- `artifacts/framework-browser/validation.json` und `panel-*.png`
- `artifacts/loader-validation.json`
- `artifacts/native-validation.json`
- `dist/` und `release/SkyMPUICore/` einschließlich Clientmanifest und Typen

`tools/framework-browser-fixture.cjs` bereitet nur die lokale Renderer-Fixture vor;
Playwright-Automation wurde aus einer temporären Datei ausgeführt. Die Unit-/
Integrationstests sind über `npm test` reproduzierbar. Referenzcheckouts sind für
einige Prüfungen optional; fehlen sie, weist der Testrunner einen Skip aus.

## Vorbereitet und von externen Verträgen abhängig

| Funktion | Stand |
| --- | --- |
| Automatisches universelles Weltinteraktionsmenü | Registry und serverseitiges Öffnen fertig; geprüfte Aktivierungspunkte und Routervorschlag dokumentiert. Automatische Zielauflösung/Ersetzen nativer Aktionen nicht implementiert. |
| Eigene Charakterauswahl mit gleicher Actor-ID | Bestehende Skyrim-Menüs sperren Fokus bereits; zusätzlicher zentraler Character-Lifecycle-/Reset-Vertrag noch festzulegen. |
| Zentrale Charakterpräferenzen | Optionaler CAS-/Abort-Adapter entworfen; keine zusätzliche Datenbank oder angenommene Persistenz-API eingebaut. |
| Beliebige Gruppen-/Ankerhierarchie | Vorhandene Widgetvererbung und einzelne Elementpräferenzen bleiben. Gruppen über mehrere Owner/Charakterprofile brauchen eine spätere Migration. |
| Geplante Gameplayoberflächen | Mit den Bausteinen darstellbar; Fachlogik/Oberflächen für Jobs, Housing, Handel, Justice usw. bleiben bei künftigen Plugins. |
| Vollständiger Ingame-Nachweis | Offen: zwei echte Spieler, Skyrim/CEF, Gameplay-Eingabe, Launcher-Rollout, Serverwechsel, TeamSpeak/Audio. |

Es besteht kein technischer Blocker für die lokal implementierten Komponenten.
Die obigen externen Funktionen wurden als Vorschläge abgegrenzt, statt nicht
vorhandene Core-/Charakterverträge anzunehmen. Die ursprüngliche Definition of
Done mit einem realen Spieler wird daher ausdrücklich noch nicht als erreicht
ausgegeben. [Manueller Abnahmeplan](MANUAL_ACCEPTANCE.md).

## API, Hooks und geänderte Dateien

- [API V1](API.md), [Framework-Vertrag](FRAMEWORK.md) und
  [FrameworkConsumer](../examples/FrameworkConsumer/index.ts) erklären Discovery,
  Komponenten, Limits, Priorität, Interaktionen und Cleanup.
- [CORE_HOOKS.md](CORE_HOOKS.md) listet vorhandenen Bootstrap und isolierte
  Vorschläge für Gameplay-Router, Character-Lifecycle und optionale Persistenz.
  Für die neuen Panels selbst ist im bereits vorbereiteten Fork kein neuer
  Engine-Hook nötig.
- `shared/contracts.ts`, `src/runtime.ts`, `src/index.ts`: öffentliche Typen,
  Validatoren, Registries, Capability-/Action-/Sessionverhalten und Diagnose.
- `client/{host,menu,panels}.tsx`, `client/model.ts`,
  `client/framework-localization.ts`, `client/native/uiCoreBridge.ts`, `style.css`:
  Renderer, Fokus, Reiter/Auswahl, Revisionen und reaktionsfähige Geometrie.
- `tests/*framework*`, `tests/runtime-package.test.cjs`,
  `tests/consumer-compatibility.test.cjs`, `tools/framework-browser-fixture.cjs`:
  neue Testfälle und begrenzte Test-Harnesses.
- README, AGENTS, Architektur/API/Runtime/Fokus/Installation/Deployment/Load-Order/
  Abnahme und die neuen Audit-/Framework-/HUD-/Hook-Dokumente: aktueller Vertrag;
  alte feste Kopierwege sind als historisch markiert.
- `package.json`, Lockfile und `plugin.json`: eigener lokaler Versionskandidat,
  damit geänderte Runtimebytes nicht als schon verteilte 1.1.0 erscheinen.

## Auslieferungsgrenze

Der lokale Fork erwartet weiterhin **`client/manifest.json`**. Diese Abweichung
zur angenommenen neueren `Runtime/manifest.json`-Dokumentation wurde am Quellcode
und im Publisher-Test bestätigt. Signatur-/Hash-/Versions-/Restoreprüfungen
wurden nicht abgeschwächt. Es wurden keine dauerhaften Herausgeberschlüssel
angelegt. Der lokale Kandidat ist unsigniert; die Signaturtests nutzen temporäre
Testschlüssel. Ein späterer Release benötigt zusammengehörige Server-/Clientdateien,
eine noch nicht verteilte unveränderliche Version und eine zur Herausgeberpolicy
passende Signatur. Lokaler Build ist keine Veröffentlichung oder Installation.
