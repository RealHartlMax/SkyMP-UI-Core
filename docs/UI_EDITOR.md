# UI-Editor und Fantasy-HUD (1.1.0)

## Benutzung

Im normalen Spiel den vorhandenen Chat mit Enter öffnen, /UiEdit eingeben und
absenden. Die Groß-/Kleinschreibung spielt keine Rolle. Der Befehl ist für alle
verbundenen Spieler zugänglich, nimmt keine Parameter entgegen und öffnet nur das
eigene Layout. SkyMP Chat bleibt unverändert; UI Core registriert uiedit mit
Owner skymp-ui-core in dessen echter v1-Command-Registry. /help kann ihn listen.

- Ein Element anklicken und ziehen: freie Position.
- Die helle Ecke unten rechts ziehen oder „Elementgröße“ ändern: Größe pro Element,
  75–150 %. Die globale Skalierung bleibt zusätzlich verfügbar.
- Auf einem gewählten Element: Pfeiltasten verschieben um 1 Pixel, Umschalt um
  10 Pixel, +/− ändern die Größe in 5-%-Schritten.
- Sichtbarkeit, feste Bildschirmecke, Sprache DE/EN und Reset stehen im Editor.
- „Speichern & schließen“ übernimmt das Layout. „Abbrechen“ bzw. Escape verwirft
  die Änderungen seit Öffnen. „Alles zurücksetzen“ wird erst beim Speichern dauerhaft.

Der Editor verwendet denselben BrowserService-Fokus wie die bestehenden UI-Menüs.
Inventar/Karte/Konsole setzen ihn aus; danach kehrt der Editor zurück. Disconnect
und fehlendes UI Core löschen die Ansicht und geben die Eingabe frei. F6 schließt
den Editor wie Escape. Ohne SkyMP Chat bleibt der Button „Darstellung“ im bewusst
fokussierten CEF (z. B. F6) als Zugang erhalten.

## Metabolism-Darstellung

Der vorhandene, unveränderte Metabolism-Adapter liefert weiterhin genau ein
icon-list-Widget mit Sättigung, Flüssigkeit und Erholung. Der neue generische
Renderer stellt dessen Einträge als drei getrennte Runensiegel mit Metallrahmen,
Füllring, Zahlenwert, Bezeichnung und serverseitigem Statustext dar. Jeder Eintrag
kann unabhängig verschoben, skaliert oder ausgeblendet werden. Auch andere
icon-list-Verbraucher nutzen diese Darstellung ohne Änderung am UI Core.

Der Füllring wird ausschließlich aus einem vollständigen positiven Bruch wie
„85,3/100 · Gut“ abgeleitet. Deutsches Komma und englischer Dezimalpunkt werden
unterstützt. Unbekannte Werte bleiben Text; der Client erfindet keine Spielwerte
oder Metabolism-Regeln. Die Runen sind gebündelte einfache SVG-Geometrien, ohne
externe Bild-/Schriftanfragen oder kostenpflichtigen Dienst.

## Sprachreichweite und Statusanzeigen

Auch normale `status`-Widgets verwenden dieselben Runensiegel, Metallrahmen,
Schriften und Statusfarben. Die Darstellung gehört vollständig zu UI-Core;
YACA liefert für `skymp-yaca-ts:voice-range` nur Reichweite, Mikrofon-/Tonstatus
und Sprechstatus. Der Meterwert steht im Siegel, der Zustand darunter. Mute und
Unmute werden aus YACA-Meldungen übernommen, auch bei gesperrter Reichweite.
Ein Meterwert wie „8 m“ erzeugt keinen erfundenen prozentualen Füllstand.

Das Widget behält seinen bisherigen Layoutschlüssel ohne `#0` und bleibt mit
`/UiEdit` verschiebbar, skalierbar und ausblendbar. Die TeamSpeak-Verbindungswarnung
und die F8-Einstellungen gehören weiterhin zur YACA-Oberfläche. Die Änderung
benötigt später das aktualisierte YACA-Serverplugin und das UI-Core-Runtime-Paket;
sie ist hier nur als Quelle vorbereitet, ohne Build oder Paketierung.

## Speicherung und Sicherheit

Der bestehende Schlüssel skymp-ui.v1.<preferenceKey> bleibt erhalten. Alte
Ecken-/Sichtbarkeitspräferenzen werden übernommen. Neue Elementpräferenzen
enthalten nur Position (normiertes x/y), Skalierung und Sichtbarkeit. Sie werden
je authentifiziertem Spieler aus dem serverseitig erzeugten Preference-Key lokal
abgelegt. Normierte Positionen bleiben bei Auflösungswechsel im sichtbaren Bereich.
Ohne verfügbares CEF-LocalStorage funktioniert das Layout für die laufende Sitzung;
der Editor meldet den fehlgeschlagenen Speicherversuch sichtbar.

Maximal 160 Layout-Einträge / 64 K Zeichen werden eingelesen. Ungültige oder außerhalb
der Grenzen liegende Koordinaten/Größen werden ignoriert. Einträge für Listen
verwenden <widgetId>#0 bis #15; Verbraucher müssen die Reihenfolge stabil halten.
Metabolism verwendet bereits Sättigung, Flüssigkeit, Erholung. Es werden keine
Layoutdaten oder Spielerwerte an den Server zurückgeschrieben; Menüaktionen
bleiben im vorhandenen validierten Kanal.

## Installation / Upgrade

Beide Seiten aktualisieren: Server-Plugin 1.1.0 sowie das dazu gebaute Clientskript
und CEF-Frontend. API v1 / Frontend-Protokoll v1 bleiben erhalten; Editor-Unterstützung
wird zusätzlich mit editorVersion: 1 beim tatsächlichen Ready ausgehandelt. Ohne
diesen Marker öffnet der Server den Editor nicht und /UiEdit antwortet privat mit
einem Hinweis auf das aktuelle Clientpaket. Ein alter Client kann am neuen Server
weiterhin seine bisherigen Widgets nutzen. Für den neuen Client wird Server-Plugin
mindestens 1.1.0 benötigt.

Startreihenfolge Chat → UI Core wird empfohlen; die tatsächlich vorhandene begrenzte
skympChatReady-Queue unterstützt auch UI Core → Chat ohne Polling. Bei Command-
Kollision bleibt der vorhandene Befehl erhalten, UI Core protokolliert den Konflikt
und der Darstellungsbutton bleibt nutzbar. Shutdown entfernt nur die eigene
Registrierung und den eigenen wartenden Callback. Änderungen benötigen weiterhin
Gameserver- bzw. Client-Neustart.

Der Integrationspatch liegt unter integration/skymp-fork/ui-core.patch. Für bereits
integrierte Installationen ändern sich nur uiCoreBridge.ts und die erzeugten
Hostdateien features/uiCore/index.js und index.css. Die bestehenden BrowserService-/
Root-/Chat-Hooks bleiben erhalten. Siehe CLIENT_DEPLOYMENT.md.
Die Originalcheckouts von SkyMP, Chat, Metabolism und Launcher werden in diesem
Arbeitsgang nicht verändert; Build und Browserprüfung verwenden artifacts/editor-fork.

## Reproduzieren

    npm run typecheck
    npm test
    npm run integration:plan -- --refresh
    npm run integration:stage
    $env:NODE_PATH='D:\GitHub\skymp\skymp5-front\node_modules'
    Set-Location artifacts/editor-fork/skymp5-front
    npm run build

Die Staging-Kopie liest vorhandene Fork-Abhängigkeiten über explizite Auflösungspfade.
Native Tests können SKYMP_FORK auf die Staging-Kopie und SKYMP_NATIVE_FORK auf den
tatsächlichen Fork setzen. Native DLLs und Spieldaten bleiben dort nur lesend.
Für einen anderen Checkout SKYMP_SOURCE_FORK beim Staging setzen; der vorbereitete
Plan muss zu diesem Fork passen.

Die zusätzlichen Tests prüfen unabhängige Geometrie, lokale Migration, Editor-
Handshake, native Spielerzuordnung, alte Clients, Command-Ownership und die reale
Chat-Readiness-Queue. Der Produktionsroot-Browserlauf verwendet zwei echte Scamp-Bots,
die realen Client-Brücken und den unveränderten Metabolism-Adapter. SkyrimPlatform-
Menü-/Browsercallbacks bleiben simuliert. Eine tatsächliche Skyrim-/CEF-Spielsession
ist weiterhin gesondert abzunehmen.
