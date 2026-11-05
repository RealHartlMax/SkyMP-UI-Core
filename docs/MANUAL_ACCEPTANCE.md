# Manuelle Zweiclient-Abnahme (offen)

## Zusätzliche Framework-Abnahme ab 04.11.2026

Auch diese Punkte sind offen; automatische Belege stehen in
[FRAMEWORK_REPORT.md](FRAMEWORK_REPORT.md).

- [ ] Zusammengehöriges signiertes beziehungsweise zur Herausgeberpolicy passendes Plugin-Runtime-Paket installieren; beide Clients über den Launcher vorbereiten.
- [ ] Zwei Plugins registrieren Panels mit Reitern/Listen/Tabellen/Gegenständen; höchste modale Priorität wird allein bedienbar.
- [ ] Alte API-V1-Consumer funktionieren unverändert; alter Client bekommt keine unbekannten Paneldaten, neue Clients erhalten nach dem Capability-Upgrade den aktuellen Snapshot.
- [ ] Auswahl, Pflichtfelder, gesperrte Zeilen, falsche Revision und gefälschte Identitäten erreichen keinen unautorisierten Handler.
- [ ] Gleichzeitiges Schließen, Deregistrieren, Frontendreload und Mehrfachklicks erzeugen keine doppelte Aktion.
- [ ] Gemeinsames Interaktionsmenü kombiniert zwei Owner; das authentifizierte Serverziel bleibt bei Zielwechsel und verspäteten Antworten korrekt.
- [ ] Im Gameplay-Router Entfernung, Zellen, aktuelle Besitz-/Schloss-/Handelsregeln und zwischenzeitlich geänderten Zustand erneut prüfen.
- [ ] Skyrim-Menüs einschließlich Charaktererstellung, Inventar, Dialog und Laden setzen Plugin-Interaktion aus; Chat/F2/F6/Escape bleiben nutzbar.
- [ ] Reiter mit Links/Rechts/Home/End und Dialog mit Tab/Shift+Tab bedienen; 75/100/150 % und mehrere Auflösungen prüfen.
- [ ] Metabolism einschließlich optionaler Survival-Werte und YACA-Reichweite behalten ihre HUD-Positionen und Funktion.
- [ ] Disconnect und vom Launcher vorbereiteter Serverwechsel entfernen Panels, Interaktionsangebote und private Daten; kein hängender Fokus.
- [ ] Manipulierte Runtimebytes, falsche APIs, nicht vertrauenswürdige Signatur und veränderte schon bekannte Pluginversion werden vor Spielstart abgewiesen.

## Bisherige Basisabnahme

<!-- plugin-doc-languages -->
[Deutsch](i18n/de/docs/MANUAL_ACCEPTANCE.md) · [English](i18n/en/docs/MANUAL_ACCEPTANCE.md) · [Русский](i18n/ru/docs/MANUAL_ACCEPTANCE.md)
<!-- /plugin-doc-languages -->

Diese Liste ist bewusst nicht als bestanden markiert. Die automatisierten nativen
Bots/Browser sind in VALIDATION.md getrennt beschrieben. Zwei echte Skyrim-Clients
mit identischem Runtimepaket und ein Testgameserver werden benötigt.

Vorbereitung: Plugins SkyMPUICore, ExampleUiConsumer, SecondUiConsumer und den
vorhandenen SkyMP Chat regulär installieren/aktivieren. UI Core zuerst laden.
Gameserver vollständig neu starten. Bei beiden Spielern den neuen Runtime-Katalog
verwenden, Skyrim neu starten und normal verbinden, ohne devUi/Admin-Parameter.
Für private Tests keine realen vertraulichen Werte verwenden.

- [ ] Safe-Discovery: neues Plugin bleibt deaktiviert; Aktivierung und zweiter Start laden API v1 tatsächlich.
- [ ] Beide Spieler sehen Statuswidgets aus zwei unabhängigen Plugins im normalen Ingame-CEF.
- [ ] A bestätigt den Dialog: nur A sieht Zähler 1 und Erfolgsnachricht; B bleibt bei 0.
- [ ] Eine serverseitige Widgetänderung wird tatsächlich im Skyrim-Fenster sichtbar.
- [ ] Menübutton ruft genau einen Handler mit der richtigen nativen User-/Actor-ID auf.
- [ ] Verspäteter CEF-Start, CEF-Reload und Reconnect liefern aktuelle Snapshots ohne doppelte Listener/Widgets.
- [ ] Serverwechsel/Disconnect löschen alle privaten Zustände und geben Maus/Tastatur vollständig frei.
- [ ] A sieht keine nur an B gerichteten Widget-/Menü-/Notificationdaten und umgekehrt.
- [ ] HTML-/JS-artiger Text bleibt lesbarer Text, ohne Skriptausführung.
- [ ] Enter öffnet weiterhin Chat; Nachrichten erscheinen bei A/B einmal; private Command-Antworten bleiben privat.
- [ ] Escape schließt Darstellung, oberstes Modal bzw. Chateingabe und gibt Gameplay frei; Chatentwurf bleibt erhalten.
- [ ] F2 aus/ein, F6 bei Chat und bei Modals, gehaltenes Enter und mehrere Modals verlieren keinen Fokus.
- [ ] Inventar, Karte, Konsole, Dialog, Laden und HUD-Wechsel blockieren keine Skyrim-Eingabe dauerhaft.
- [ ] Tab/Shift+Tab bleiben im Dialog; Buttons per Tastatur ausführbar; Text bei 75/100/150 % lesbar.
- [ ] Position/Sichtbarkeit bleiben reine lokale Präferenzen; Speicherverweigerung verursacht keinen Crash.
- [ ] config.locale=de/en und Änderung in locales/de.json bzw. en.json erscheinen nach Gameserver-Neustart ohne Client-Neubau.
- [ ] Fehlender Locale-Key fällt sinnvoll zurück; ungültige Konfiguration erzeugt einen klaren Startfehler.
- [ ] Ohne Server-Plugin bleibt UI Core leer und der bestehende Chat funktionsfähig.
- [ ] Ohne neues Clientpaket erscheint der Handshake-Hinweis im Serverlog, ohne Crash-/Retry-Endlosschleife.
- [ ] Protokollmismatch sperrt Actions; veraltete Request-IDs, fremde Identitäts-/Permissionfelder sind wirkungslos.
- [ ] 20 Widgets mit schnellen Serverupdates bleiben innerhalb der dokumentierten Queue-/Byte-/Frequenzlimits.
- [ ] Tatsächlich heruntergeladene Runtimebytes stimmen mit dem veröffentlichten Katalog/Manifest überein.

Pro Test Ergebnis, Datum, Clientversion, Skyrim-Version, Server-/Pluginversion und
ggf. Log-/Videoausschnitt ergänzen. Erst nach diesen Schritten ist die ursprüngliche
Definition of Done mit realem Spieler vollständig nachgewiesen.


## UI-Editor und Fantasy-HUD 1.1.0

- [ ] Neue Server- und Client-/CEF-Pakete installieren, beide neu starten.
- [ ] /UiEdit (auch /uiedit) über Enter öffnet nur den eigenen Editor.
- [ ] Drei echte Metabolism-Werte erscheinen als Runenringe und ändern sich vom Server aus.
- [ ] YACA-Reichweite: Ring = Reichweite/größte konfigurierte Reichweite (20 von 40 m = halber Ring); Sprechen und Mute ändern nur die Farbe, das Siegel bleibt an seiner Position.
- [ ] Sättigung ziehen/vergrößern; Flüssigkeit und Erholung behalten Position/Größe.
- [ ] Pfeile, Umschalt+Pfeile und +/− funktionieren; sichtbarer Tastaturfokus.
- [ ] Speichern überlebt Reload/Reconnect; Abbrechen/Escape verwirft den Entwurf.
- [ ] Auflösungswechsel hält Elemente sichtbar; Sichtbarkeit/Reset funktionieren.
- [ ] Inventar/Karte/Konsole geben Eingabe frei; Rückkehr stellt Editor wieder her.
- [ ] Escape/F6 bei Editor über einem Plugin-Menü schließt nur die oberste Ebene.
- [ ] F2/Enter und Chat bleiben nach dem Editor vollständig bedienbar.
- [ ] Disconnect/Serverwechsel beim Ziehen lässt keinen Mausfokus zurück.
- [ ] Alter Client erhält bei /UiEdit die private Aktualisierungsdiagnose.
