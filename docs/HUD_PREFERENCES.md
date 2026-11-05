# HUD und lokale Spielerpräferenzen

Der vorhandene Editor `/UiEdit` bleibt erhalten. Er wird über die optionale
Chat-Command-Registry geöffnet; UI Core hat keinen zweiten Command-Parser.
Der geprüfte Metabolism-Adapter liefert eine `icon-list`, YACA ein `status`-Widget.
Die neuen Panel-Komponenten ändern deren Daten oder Elementschlüssel nicht.

| Bedarf | Aktueller Vertrag |
| --- | --- |
| Position | Drag/Pfeiltasten, normierte x/y von 0 bis 1, Bildschirmrand-Clamping |
| Skalierung | 75–150 % global und pro Element, begrenzt auf den sichtbaren Viewport |
| Sichtbarkeit | lokale ausgeblendete Darstellung plus serverseitiges `setWidgetVisible` |
| Gruppierung | gemeinsame Voreinstellung pro Widget; icon-list-Einträge erben sie und können einzeln abweichen |
| Kontext | Consumer setzt Sichtbarkeit/Zustand serverseitig; UI Core autorisiert keine Gameplay-Kontexte lokal |
| Speicher | `localStorage['skymp-ui.v1.' + preferenceKey]`, nur geprüfte Präsentationsdaten |
| Reset | einzelnes Element oder alle Präferenzen; Abbrechen stellt den Entwurf vor Bearbeitung wieder her |

Der `preferenceKey` ist ein serverseitig erzeugter Hash des nativen GUID; fehlt
dieser, verwendet UI Core einen Sitzungswert. Er ist keine Charakteridentität und
keine Spielberechtigung. Bei gleichem GUID können bestehende Layoutpräferenzen auf
mehreren Servern wiederverwendet werden. Eine neue Charakterdatenbank wird nicht
angelegt. Ein optionaler Adapter für zukünftige zentrale Charakterpräferenzen
steht als Entwurf in [CORE_HOOKS.md](CORE_HOOKS.md).

Die Speicherung akzeptiert bis zu 160 Elementpräferenzen und 64 KiB. Unbekannte
Spielwertfelder werden nicht übernommen. Bei gesperrtem CEF-Speicher bleibt der
Sitzungsentwurf benutzbar und der Editor zeigt den fehlgeschlagenen Speichervorgang.
Widgets können lokal keine vom Server ausgeblendeten Daten wieder sichtbar machen.

Eine neue beliebige Gruppen-/Ankerhierarchie wird nicht eingeführt: Die bestehende
Widgetvererbung deckt aktuelle Consumer ab, ohne ihre gespeicherten Positionen zu
verschieben. Server-/Charakterprofile und gruppenweises Dragging über mehrere
Owner bleiben mögliche spätere Erweiterungen mit eigener Migration.

Die vorhandenen Geometrietests prüfen kleine Viewports und Auflösungswechsel.
Der Framework-Browserlauf prüft 1920×1080, 1024×768 und 800×600, lokale Speicherung,
Reload und Menüs bei 150 %. Umfang und reale Spielabnahme:
[FRAMEWORK_REPORT.md](FRAMEWORK_REPORT.md).
