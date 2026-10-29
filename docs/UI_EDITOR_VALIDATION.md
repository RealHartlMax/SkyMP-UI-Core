# UI-Editor 1.1.0: aktueller Prüfstand

Stand: 29.10.2026, Windows, Node 24.19.0. API 1, Frontend-Protokoll 1,
ausgehandelter Editor 1. Kein Commit, Push, Upload oder Deployment.

| Prüfung | Tatsächlich ausgeführtes Ergebnis |
| --- | --- |
| npm run typecheck | fehlerfrei |
| npm test | 41 Tests bestanden, keine übersprungen |
| npm run verify:fork | Plugin 1.1.0 mit echtem Manifestvalidator, safe-Discovery, Aktivierung und requireTemp bestanden |
| npm run verify:native | zwei native Scamp-Bots, authentifizierte Ziele, isolierte Aktion und Replay bestanden |
| Isolierter Fork-Client: webpack-cli | vollständiger TypeScript-/Webpack-Build erfolgreich |
| Isolierter Fork-Client: tests/chatBridge.test.cjs | 15 bestehende Chat-Regressionstests bestanden |
| Isolierter Fork-Frontend: npm run build | Produktionsroot erfolgreich; eigenes Bundlebudget eingehalten, bestehende Webpack-Assetgrößenwarnungen |
| Isolierter Fork-Frontend: npm test | bestehende Unit-, Locale- und Bundlebudget-Prüfungen bestanden |
| Launcher build-client-runtime.mjs auf der isolierten Quelle | Kompatibilitätsbuild erfolgreich, keine Warnungen |
| tools/browser-acceptance.cjs mit Playwright | 14 Integrationsprüfungen mit zwei Produktionsroot-Browsern, zwei nativen Bots und unverändertem Chat-/Metabolism-Adapter bestanden; keine Page-/Bridgefehler |

Im Browser nachgewiesen: /UiEdit durchläuft den echten Chat-Parser/Registry und
die tatsächlichen Client-Brücken. Drei getrennte Metabolism-Anzeigen sind nur für
den vorgesehenen Spieler sichtbar. Ziehen, Ecken-Resize, Einzelgröße 150 %,
Pfeiltasten, gespeicherte normierte Positionen, Abbrechen, CEF-Reload, Serverwert-
änderung, Auflösungen 1024×768 und 1920×1080, Sichtbarkeit und Reset funktionieren.
Inventar setzt den Editor aus und stellt ihn wieder her. Doppeltes natives/DOM-
Escape schließt eine Ebene. Disconnect und Plugin-Abwesenheit geben Fokus frei;
Chat bleibt bedienbar. Layoutänderungen senden keine Menüaktionen oder Spielwerte.

Die Browserprüfung verwendet das reale Metabolism-UiAdapter-Modul mit
serverseitigen Testwerten, keine Änderung an dessen Quellen oder Regeln.
Die SkyrimPlatform-Browser-/Menü-/Tastaturcallbacks stammen aus dem vorhandenen
Harness. Eine echte Skyrim-/CEF-Spielsession mit Gameplay ist damit nicht bewiesen.

Maschinenlesbare Nachweise:

- artifacts/browser-validation.json (14 Checks, Browserfehlerliste und Buildhashes)
- artifacts/loader-validation.json und native-validation.json
- artifacts/editor-build-plan.json (unveränderte Ausgangsbytes und isolierte Zielbytes)
- artifacts/uiedit-launcher-client/build-report.json
- artifacts/packages/ für bytegeprüfte ZIPs und SHA256SUMS

Screenshot-Vorschauen aus dem normalen Produktionsroot ohne Dev-/Adminflags:
artifacts/uiedit-hud.png, uiedit-editor.png und uiedit-hud-custom.png.
Dies sind Browser-Testaufnahmen, keine Skyrim-Spielbilder.

Geprüfte Byteidentitäten:

- Server-Bundle: f47e9ee6780b9bba1485266d288ae5b86d7bf4726238a63c86df57be4e2f5f9e
- Frontend build.js: 46dd62b584fed750c4469927ee1228bb4dd3561accc2e30868d45be5b195dc02
- Launcher-Clientskript: 1e12ca7fbe55264401e1c7c1939ad5865be4b27a5ddca37e4f0d76ce7b1dad6c
- Native UI-Bridge-Quelle: 64af8462bc8ba1af3a62d0a293f2b7ea0cabc83e26131309b07f120ba35e9dd0

Offen bleiben reale Skyrim-Eingabe-/CEF-Abnahme mit zwei Spielern und ein tatsächlicher
Launcher-/Webhost-Rollout samt Prüfung der live ausgelieferten Transportbytes.
Die Originalcheckouts von SkyMP, Chat, Metabolism und Launcher wurden nicht verändert.
