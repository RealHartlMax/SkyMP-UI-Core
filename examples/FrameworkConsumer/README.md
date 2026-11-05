# Optionaler Framework-Consumer

`registerFrameworkExample(ui)` in den eigenen gebündelten Server-Entry importieren.
Bei fehlendem UI Core oder fehlender Erweiterung liefert es `null`. Es registriert
ein Panel und eine Interaktion ohne Änderung an UI Core. `open(target)` erst nach
dem Frontend-Handshake aus einem authentifizierten Serverereignis aufrufen.
`interact(target, subject)` benötigt ein vom Server ermitteltes Interaktionsziel.
Beim eigenen Plugin-Cleanup `dispose()` aufrufen. Es gibt keine automatische
Hot-Reload-Zusage und keinen zusätzlichen Browser.

Die Freigaben des Beispiels erlauben nur eine UI-Bestätigung und Information.
Gameplay-Plugins müssen ihre eigenen serverseitigen Authorizer einsetzen und
Berechtigung, Entfernung, Identität und Objektzustand bei der Aktion erneut prüfen.
Siehe [Framework-Vertrag](../../docs/FRAMEWORK.md).
