# Audit und Erweiterungsauftrag vom 04.11.2026

## Ausgangsstand

UI Core: `main`, HEAD `903c0e6bf9af8ab415c094039ce6facb675d8a4d`, vor der
Bearbeitung sauberer Arbeitsbaum. Lokaler SkyMP-Fork: HEAD und gespeicherte
`origin/main` beide `0bb7697dd0b92888244db12698a37fe477a34131`. Kein Fetch und
kein Abgleich mit dem aktuell veröffentlichten GitHub-Stand. Der Fork enthält
zahlreiche fremde Änderungen, unter anderem am Runtime-Publisher, Loader,
Dashboard, Sessionende und Datenbankpfad. Diese Quellen wurden nur gelesen.

Gelesen wurden AGENTS, README, ARCHITECTURE, API, PLUGIN_RUNTIME,
PLUGIN_LOAD_ORDER, FOCUS_AND_CHAT, UI_EDITOR, Contracts, Server-Runtime,
Host/Model/Layout, native Brücke, Build-/Paketwerkzeuge und vorhandene Tests.
Im Fork wurden Plugin-Discovery, Runtime-Publisher und Vertrag, BrowserService,
Frontend-Root, Chatpfad, EventSource-Transport und Scripting-/Browserreferenzen
geprüft. Chat-Registry sowie die tatsächlichen Metabolism-/YACA-Adapter sind die
Kompatibilitätsbasis. Keine Dateien in Referenzrepositories werden geändert.

Baseline: `npm run typecheck` und `npm test` erfolgreich, 42 Tests, kein Skip.
`npm test` enthält den lokalen Plugin-Build. Der neue Auftrag erlaubt lokale
Builds/Tests ausdrücklich und ersetzt damit das frühere Buildverbot. ZIPs,
Commits, Pushes und Veröffentlichungen bleiben außerhalb des Auftrags.

## Vorhandene Bausteine und Lücken

| Bereich | Verifizierter Ausgangsstand | Maßnahme |
| --- | --- | --- |
| HUD | status/text/progress/icon-list, feste Templates, Runensiegel | Beibehalten; Consumer-Kompatibilität testen |
| Layout | /UiEdit, normierte Position, 75–150 %, Sichtbarkeit, Reset, lokale Präferenzen | Beibehalten; kein Gameplayzustand in Präferenzen |
| Menüs | Dialog, Formular, Text/Zahl/Checkbox/Select, Buttons | Deklaratives Panel mit Reitern, Listen, Tabellen, Gegenständen ergänzen |
| Aktionen | Native User-/Actor-Prüfung, synchroner Authorizer, Rate-/Replay-Limits | Auswahl gegen aktuellen Snapshot, Priorität und Deregistrierung absichern |
| Registry | Namespaces, Widget-/Menü-Deregistrierung | Owner-Cleanup und Action-Deregistrierung ergänzen |
| Interaktionen | Keine gemeinsame Registry und kein universeller Ziel-Hook | Gemeinsame serverseitig geöffnete Oberfläche; Zielerkennung als isolierten Hook beschreiben |
| Fokus | Ein BrowserService, Skyrim-Menüs vor UI vor Chat | Bestehende Policy weiterverwenden, suspendierte Menüs nicht bedienbar |

Bestätigungen und Kontextmenüs benötigen keine eigene Gameplayoberfläche:
bestehende Dialoge beziehungsweise die gemeinsame Interaktionsoberfläche genügen.
Character-Creator, Jobs, Handel usw. bleiben externe Consumer.

## Tatsächlicher Plugin-Runtime-Vertrag

Der lokale `skymp5-server/ts/index.ts` akzeptiert ausschließlich
`runtime: "client/manifest.json"`. `pluginRuntimePackages.ts` prüft genau diesen
Pfad und veröffentlicht nur explizit gelistete Dateien unter `client/`.
`Runtime/manifest.json` wird in diesem Checkout abgewiesen. Daher erfolgt hier
keine spekulative Migration auf `Runtime/`.

Die SDK-Vertragskopie `tools/plugin-runtime/contract.cjs` ist bytegleich mit
`skymp/misc/plugin-runtime/contract.cjs`, SHA-256:
`076bb89785c1be888458e9661c9eb9f42f135ab55f00f325efcb43b30824215a`.
Der Launcher prüft in `launcher/src-tauri/src/connection/plugin_runtime.rs`
Format/API, Größen/Hashes, optionale Ed25519-Signatur und unveränderliche
Pluginversionen. Konfigurierte Herausgeberschlüssel erzwingen Signaturen.
Diese Prüfungen und die Journal-/Restorepfade bleiben bestehen.

## Kompatibilitätsentscheidung

API und Frontend-Protokoll bleiben V1. Neue Funktionen werden über die optionale
`framework`-Erweiterung und ein separates, an Ready anschließendes
`frameworkVersion: 1`-Upgrade entdeckt. So bleibt der alte strikte Ready-Vertrag
auch gegenüber älteren Servern gültig.
Neue Paneldaten dürfen keinen alten strikten V1-Validator erreichen. Legacy-Clients
erhalten weiterhin Widgets und alte Dialog-/Formularlayouts. Eine fehlende
Erweiterung deaktiviert ausschließlich die optionalen neuen Oberflächen.

Buildausgaben sind lokale Kandidaten. Eine geänderte Runtime darf niemals unter
einem bereits verteilten unveränderlichen Versionspaar veröffentlicht werden.
Eine neue Veröffentlichungsnummer und Herausgebersignatur werden beim späteren
Release vergeben. Automatisierte Tests sind keine Skyrim-/CEF-/Audio-Abnahme.
