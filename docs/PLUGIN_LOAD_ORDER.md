# Plugin-Ladereihenfolge und fehlende Beispiel-UI

Die gemeldeten Logs zeigen: ExampleUiConsumer und SecondUiConsumer wurden vor
skymp-ui-core geladen. Sie wählen dann ihren dokumentierten optionalen Fallback
und registrieren für diesen Prozess keine UI. Die spätere Ready-Meldung von
UI Core startet diese alten Verbraucher nicht nachträglich.

Der Fork besaß bereits `pluginsLoadOrder` und einen entsprechenden Startsortierer.
Eine leere Liste führte zur alphabetischen Reihenfolge und damit zu diesem Fall.
Nun ist die Reihenfolge sichtbar unter **Ressourcen → Server-Plugins** bedienbar:
Positionsnummern, Nach oben/unten, Ladereihenfolge speichern und Verwerfen.
`skymp-ui-core` muss vor `example-ui-consumer` und `second-ui-consumer` stehen.
Danach Gameserver neu starten. Aktivierung und Reihenfolge sind getrennt.

Suchfilter verändern die vollständige gespeicherte Liste nicht. Bei gleichzeitigen
Änderungen verlangt die UI Verwerfen/Neuladen; der Server überschreibt keine
neuere Reihenfolge. Bekannte, vorübergehend fehlende IDs bleiben erhalten. Neue,
nicht konfigurierte IDs folgen alphabetisch. Abhängigkeiten werden nicht automatisch
aufgelöst, Prozessplugins erhalten dadurch keinen gemeinsamen mp/RPC-Kanal.

GET `/api/admin/plugins/load-order`: canViewLogs, aktuelle Reihenfolge/Revision.
PUT: canConsole, JSON vom selben Ursprung, `{revision,pluginsLoadOrder}`. Es wird
nur dieses Settingsfeld gespeichert. Ungültige/unvollständige Listen werden mit
400, veraltete mit 409 abgewiesen. Private Settings, Mod-Liste, Startup-Flags und
Discovery-State bleiben erhalten. Keine Pluginentries werden durch das API geladen.

Geänderte Fork-Dateien: `skymp5-server/ts/pluginLoadOrder.ts`, `ts/ui.ts`,
`tests/pluginLoadOrder.integration.mjs`, Frontend `PluginsPanel.tsx`, `plugins.scss`,
sechs Locale-Dateien und `README-plugins.md`. Der bestehende Startsortierer in
`ts/index.ts` bleibt unverändert und ist gegen die gespeicherte Reihenfolge geprüft.
Backups/Hashes: `artifacts/plugin-load-order/`. Vorbereitung/Anwendung:
`node tools/integrate-plugin-load-order.cjs [--apply]` im UI-Core-Repository.

Lokal gebaut: `npm run build-ts` im Server, Produktions-CEF unter
`artifacts/plugin-order-frontend/`. API-, bestehende Plugin-, Locale-/Unit-/
Bundlebudgettests und authentifizierte Browserprüfung bestehen. Der Browsertest
prüft Speichern/Reload, Suche, Konfliktbehandlung, schmale Ansicht und Leserechte.
Belege: `artifacts/plugin-load-order-{api,browser}.json`.

Der Server wird auf ausdrücklichen Wunsch vom Benutzer separat im Server-Repo
gebaut. Ein zuvor bereits gestarteter lokaler Build war vor diesem Hinweis
abgeschlossen; weitere Server-Builds werden nicht ausgeführt. Maßgeblich sind
die Quelländerungen unter `D:/GitHub/skymp`. Nach Installation des selbst gebauten
Backend-/Dashboard-Stands ist einmal ein Starter-/Dashboard-Neustart nötig.
Für spätere Reihenfolgeänderungen reicht ein Gameserver-Neustart. Die gebaute
Client-/CEF-Runtime wird separat im Launcher-Repository vorbereitet:
`local-builds/runtime-2026-10-28-plugin-load-order/`. Das Serverpaket verändert
keine private Konfiguration und enthält keine nativen Binärdateien.

Eine echte Skyrim-Spielsession ist durch diese Dashboardprüfung nicht bestätigt.
Keine Veröffentlichung und kein Produktionsneustart wurden durchgeführt.
