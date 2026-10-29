# Fokus und Chat-Kompatibilität

Es gibt genau einen Browser und einen nativen Fokusbesitzer: den vorhandenen
BrowserService. UiCoreBridge nimmt nur überprüfte Fokuswünsche des Hosts an.
Die ChatBridge und das eigenständige Chat-Repository bleiben inhaltlich unverändert.

Priorität: Skyrim-Menüs → oberstes UI-Menü/Darstellung → Chat → Gameplay.
Neue UI-Menüs schließen die Chateingabe über die bestehende ChatBridge; deren
Entwurf bleibt erhalten. Enter öffnet weiterhin Chat, wenn kein UI-Menü fokussiert
ist. Im Formular bleiben Enter/Tab normale Browser-Tasten. Escape schließt zuerst
Darstellung, danach das oberste UI-Menü, danach Chat. Mehrere Menüs werden als
begrenzter Stack mit nur einer aktiven Dialogoberfläche gezeigt.

F2 blendet denselben CEF aus/ein und gibt beim Ausblenden Eingabe frei. Enter/F6
können den ausgeblendeten CEF wieder zeigen. F6 schließt bei aktivem UI-Menü das
oberste Menü; sonst bleibt das bestehende Chat-Fokustoggle erhalten. Keine zweite
Registrierung für diese Tasten und keine neuen globalen Hotkeys.

Inventar, Karte, Konsole, Dialoge, Laden und die weiteren badMenus des Forks
setzen UI-Interaktion aus und geben Maus/Tastatur an Skyrim zurück. Beim Schließen
wird ein noch gültiges UI-Menü wieder fokussiert. HUD-Schließen und Disconnect
geben Fokus frei; Disconnect/Serverwechsel löschen private Widgets/Menüs.
UI-Core-Timeout, Fehlergrenze und Plugin-Abmeldung geben nur den von UI Core
besessenen Fokus frei, sodass ein unabhängig geöffneter Chat weiterarbeiten kann.

Widgets/Notifications haben pointer-events none. Menüs, Buttons und explizit
geöffnete Darstellungsoptionen sind interaktiv. Dialoge haben semantische Labels,
Tastaturnavigation und sichtbare Fokusränder. Skalierung 75–150 %, Text neben
Farb-/Listensignalen. Modale Dialoge fangen Tab innerhalb ihres Inhalts ab.
Nichtmodale Menüs verwenden denselben bewussten CEF-Eingabemodus ohne Vollbildshade.

Automatisch geprüft: reale BrowserService/ChatBridge/KeyboardEventsService-
Quellen, verschachtelte Menüs, F2/F6/Enter/Escape, Inventar/Karte/Konsole/Dialog/
Laden, zwei Produktionsroot-Browser plus native Scamp-Bots und eigenständiger Chat.
Die nativen SkyrimPlatform-Browser-/Tastatur-/Menücallbacks werden dabei vom
Harness geliefert. Die tatsächliche Tastatur-/Mausunterdrückung im Skyrim-Prozess
und die echte CEF-Darstellung bleiben Teil der manuellen Spielabnahme.


## Layout-Editor ab 1.1.0

/UiEdit kommt aus der unveränderten Chat-Registry und öffnet nur die eigene
Editoransicht. Sie hat dieselbe Fokuspriorität wie die bisherigen Darstellungs-
optionen, oberhalb des aktuellen Plugin-Menüs. Escape/F6 verwirft den Entwurf und
kehrt zum darunterliegenden Menü bzw. Gameplay zurück. Speichern schließt den
Editor mit denselben Fokusregeln. Skyrim-Menüs setzen den Editor aus und stellen
ihn beim Schließen wieder her; Disconnect beendet ihn vollständig. Details und
Tastatursteuerung stehen in UI_EDITOR.md.
