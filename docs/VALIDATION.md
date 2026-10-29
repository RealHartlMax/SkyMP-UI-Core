# Prüfstand und verbleibende Abnahme

Aktueller Stand **1.1.0 / UI-Editor (29.10.2026)**: [UI_EDITOR_VALIDATION.md](UI_EDITOR_VALIDATION.md).
Die nachfolgende Tabelle dokumentiert den ursprünglichen Stand vom 28.10.2026.

Stand: 28.10.2026, Windows, Node 24.19.0, lokale TypeScript-Version 5.9.3.
API 1, Frontend-Protokoll 1, Plugin 1.0.0. Kein Commit, Push, Upload oder Release.

## Ausgeführte Prüfungen

| Befehl / Prüfung | Ergebnis / Aussage |
| --- | --- |
| UI Core: `npm run typecheck` | fehlerfrei, explizite node/react-Typen und Node16-Auflösung |
| UI Core: `npm test` | 31 Tests: Verträge, Isolierung, Replay, Limits/TTL, Actions, Locale-Dateien, echter Fokusadapter, temporärer Entry |
| `npm run verify:fork` | echter unveränderter Fork-Validator/Discovery/requireTemp; safe/aktiviert; zwei fremde Verbraucher |
| `npm run verify:native` | dieselben Plugins mit echten Scamp-Bots und authentifizierter nativer User-/Actor-Zuordnung; private Aktion genau einmal |
| Fork Client: `npm run build` | Webpack-/TypeScript-Build erfolgreich |
| Fork Client: `npm run test:chat` | 12 bestehende Chat-Regressionstests bestanden |
| Fork Client: `npm run test:server-js` | 4 Signatur-/Konfigurationstests bestanden |
| Fork Client: `npm run test:spawn-location` | 8 Spawn-/Reconnecttests bestanden |
| Fork Frontend: `npm run build` | Produktionsbuild, vorhandenes gzip-Budget eingehalten; allgemeine Webpack-Assetgrößenwarnungen bleiben |
| Fork Frontend: `npm test` | Locale-Struktur, bestehende Unit-Prüfungen und Bundlebudget bestanden |
| Launcher: `build-client-runtime.mjs` | Kompatibilitätsbuild erfolgreich, keine Warnungen |
| `tools/browser-acceptance.cjs` über Playwright | zwei Produktionsroot-Browser + native Bots + unverändertes Chatplugin; keine Page-/Bridgefehler |
| Launcher: `create-ui-core-runtime.mjs` | Basiskatalog und alle Quelldateien gehasht; 212 Installationsdateien, 37 Texttransporte, 73 native Dateien unverändert |
| Windows ZIP-Byteprüfung | alle 251 Runtime-ZIP-Einträge gegen die vorbereiteten Dateien geprüft |
| Launcher: `node --test tests/runtime-packaging.mjs` | 15 Paketierungsfälle, u. a. binäre Texttransporte und Korruptionsabweisung bestanden |

Präzise Ergebnisse/Hashes werden unter `artifacts/{loader,native,browser}-validation.json`
und im Launcher-Ausgabeordner `VALIDATION.json` gespeichert. Package-Ergebnisse
stehen in `artifacts/packages/PACKAGE-VALIDATION.json` und SHA256SUMS.

Der Browserlauf lädt den echten gebauten Root auf `/`, ohne Dev-/Adminmodus.
Ein CEF-Klick läuft über die echten UiCoreBridge-/BrowserService-Quellen, eine
native Botnachricht, den Server-Core und zurück zum React-Host. Der native
Ausgang wird in den echten Client-Controller eingespielt; SkyrimPlatform-Browser-,
Keyboard- und Menücallbacks werden durch das Harness geliefert. Das ist ein
Integrationsnachweis im Browser, keine echte Skyrim-/CEF-Spielsession.

Im Browser geprüft: zwei Consumer-Namespaces, serverseitige Bestätigung und
privater Zähler, Duplicate-Replay, Injection als Text, aktueller Snapshot nach
CEF-Reload, Skalierung/DE-EN, Skyrim-Menü-Suspend/Resume, Chat A/B und private
Fremdcommand-Antwort, F2/Enter, Disconnect und UI-Core-Abwesenheit bei weiter
funktionierendem Chat. Screenshots liegen unter `artifacts/ui-core-*.png`.

## Typfehler im Editor

Die gemeldeten Node-/Timer-/node10-Diagnosen wurden durch explizites
`types: ["node","react"]`, `module/moduleResolution: "Node16"` und Imports aus
`node:timers` behoben. @types/node ist installiert und im Lockfile festgelegt.
`.vscode/settings.json` verweist auf die lokale TypeScript-Version.
Bei veralteten Editoranzeigen `TypeScript: Restart TS Server` ausführen und die
Workspace-Version auswählen; die tatsächlich gelaufene CLI-Typprüfung ist maßgeblich.

## Noch nicht nachgewiesen

- Zwei reale Spieler sehen/interagieren im tatsächlichen Skyrim-/CEF-Prozess.
- Echte Gameplay-Eingabeunterdrückung und Wiederfreigabe bei allen Skyrim-Menüs.
- Steam-/Launcher-Live-Download nach Upload und unveränderte Webhost-Transportbytes.
- Native Kompatibilität für andere Skyrim-Versionen und Linux-Serverbetrieb.
- Veröffentlichung/Hosting/Produktivinstallation: nicht durchgeführt.

Der manuelle Plan steht in MANUAL_ACCEPTANCE.md. Daher ist die technische
Implementierung paketiert und automatisiert integriert, die vollständige
ursprüngliche Definition of Done mit realen Skyrim-Spielern bleibt offen.
