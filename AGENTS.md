# AGENTS.md — SkyMP UI Core

## Aktuelle Nutzervorgabe vom 29.10.2026: Plugin Runtime Loader

Die neueste ausdrückliche Nutzervorgabe ersetzt die ältere feste Client-/CEF-Integration: Plugin-eigene native JS-Module und UI/CSS/Assets gehören als Quellcode in dieses Plugin-Repository und werden später als signiertes `Runtime/manifest.json`-Paket ausgeliefert. Nur der generische Bootstrap bleibt in `D:/GitHub/skymp`, der generische Download-/Prüf-/Restorepfad in `D:/GitHub/skymp-client-launcher`. Keine Plugin-Templates mehr in die gemeinsame Runtime kopieren. UI-Core-Consumer bleiben reine Daten-/Server-Plugins. Siehe [docs/PLUGIN_RUNTIME.md](docs/PLUGIN_RUNTIME.md). Der aktuelle Auftrag verbietet Builds, ZIPs, Commit und Push; dafür ist später eine separate Nutzervorgabe erforderlich.

> Arbeitsauftrag für Coding-Agenten. Dieses Dokument gehört in die Wurzel eines **eigenständigen** Repositories für das Plugin `skymp-ui-core`. Es beschreibt zu implementierende Verträge, nicht bereits vorhandene Funktionen.

## 0. Mission und Abgrenzung

Entwickle ein **funktionsfähiges, wiederverwendbares Ingame-UI-Framework** für den SkyMP-Fork von RealHartlMax. Es ist die gemeinsame Infrastruktur für kommende Plugins wie Metabolism, Jobs, Fraktionen, Händler, Inventar und Benachrichtigungen.

- SkyMP-Fork (Quell-/Integrationsprojekt): `https://github.com/RealHartlMax/skymp`.
- Bereits eigenständiges Chat-Projekt: `https://github.com/RealHartlMax/SkyMP-Chat` und **lokal beim Benutzer** `D:\GitHub\SkyMP-Chat`.
- Empfohlenes separates Arbeitsverzeichnis: `D:\GitHub\SkyMP-UI-Core` (nicht voraussetzen; tatsächlichen Checkout ermitteln).
- Plugin-ID: `skymp-ui-core`; Zielinstallationsordner: `Server/Plugins/SkyMPUICore/` relativ zum **tatsächlichen Gameserver-Arbeitsverzeichnis**.
- Sprache: Erklärungen/Anleitungen Deutsch, stabile öffentliche API und Code konsistentes Englisch; UI mindestens Deutsch/Englisch.
- Ergebnis: produktionsnahes Plugin + **nachweislich integrierte** CEF/React-Clientkomponente + Tests + Installations-/Upgradeanleitung. Keine reine Konzeptstudie, kein Dummy-UI als Ersatz für eine funktionierende Integration.

**Nicht in UI Core implementieren:** Chatnachrichten oder Slash-Command-Parser, Vitalwerte/Metabolism-Logik, Inventarregeln, Rollen-/Joblogik, Spieler-Authentifizierung. Das alles gehört in andere Plugins. UI Core darf nur Darstellung, UI-Interaktion und sichere Weiterleitung anbieten.

## 1. Pflicht: Bestandsaufnahme VOR dem Codieren

1. Aktuelles lokales `skymp`-Checkout bestimmen und mit dem GitHub-Fork abgleichen. Der Fork auf GitHub kann hinter dem lokalen Arbeitsstand liegen. **Lokale tatsächliche Implementierung hat Vorrang**, aber Abweichungen dokumentieren.
2. Lies `README-plugins.md`, `docs/docs_serverside_scripting_reference.md`, `docs/docs_clientside_scripting_reference.md`, `docs/docs_events_system.md`, `docs/docs_properties_system.md`, `docs/skyrim_platform/browser.md`, `skymp5-server/ts/index.ts`.
3. Untersuche die realen Integrationspfade in `skymp5-client/src/services/services/browserService.ts`, `gamemodeEventSourceService.ts`, `skymp5-front/src/App.js`, `constructor.js`, `src/utils/Widgets.js` und `src/constructorComponents/chat/`.
4. **Falls lokal zugreifbar**, lies `D:\GitHub\SkyMP-Chat\AGENTS.md`, die tatsächlichen Chat-Quellen, dessen Command-Registry, Browser-Fokusbehandlung und eventuelle UI-Adapter. Öffentlich enthält `RealHartlMax/SkyMP-Chat` bereits eine `AGENTS.md`; dort vorgeschlagene Bezeichner wie `globalThis.skympChat` sind **Designziele, keine garantiert vorhandenen Runtime-APIs**. Laufende Chat-Implementierung nicht überschreiben.
5. Prüfe die vorhandenen Frontend-/Client-Builds, Launcher-/Modpack-Auslieferung, Asset-Versionierung und Tests. Wer rendert die CEF-Root-Komponente, wer verwaltet Fokus und wann sind Netzwerk-/Browser-Verbindungen bereit?
6. Ermittele die **tatsächlichen** Plugin-Startpfade und Verfügbarkeit von `mp` im gemeinsamen Server-Prozess. Nach aktuellem `README-plugins.md` existieren `kind: gamemode` und `kind: process`, aber **keine automatische Installation von Frontend-Code durch Server-Plugins**.
7. Dokumentiere in `docs/ARCHITECTURE.md` die verifizierten Schnittstellen, Unterschiede zur Planungsannahme und den geplanten kleinsten Eingriff in SkyMP. Bestehende AGENTS-/Repo-Vorgaben beachten.

### Bekannte Grenzen, die in der Implementation respektiert werden müssen

- Gamemode-Plugins bekommen das globale `mp` und können gemeinsame Runtime-Dienste anbieten. **Nur der gebündelte Entry** wird aktuell in einen temporären JS-Pfad geladen. Deshalb `index.cjs` als vollständig gebündelte CommonJS-Datei ausliefern; keine Annahme über `require('./local-file')` oder `__dirname` im Plugin-Ordner.
- Process-Plugins bekommen **kein** gemeinsames `mp` und keinen automatischen RPC-Kanal; deshalb UI Core primär als `kind: gamemode` implementieren.
- Neues Plugin wird regulär zunächst deaktiviert; Aktivierung im Dashboard und Gameserver-Neustart nötig. Ein separater **Client-/CEF-Build** braucht seinen eigenen Rollout/Neustart. Keine Hot-Reload-Garantie.
- `skymp5-front` ist bereits React-basiert und enthält einen Chat. **Keinen zweiten Browser und keinen zweiten Chat bauen.** UI Core soll innerhalb desselben CEF-Roots koexistieren.
- `mp.makeEventSource('_...')` ist dokumentiert für Client→Server; `ctx.sendEvent(...)` im Client-Event-Source. `window.skyrimPlatform.sendMessage(...)` ist im CEF dokumentiert. Die vollständige Brücke CEF↔Client↔Server muss **im konkreten Build** nachgewiesen werden.
- Nicht ungeprüft APIs wie `mp.sendToClient`, `mp.broadcast`, `window.skymp.send`, `mp.onChat` oder ein bereits funktionierendes Plugin-Event-Bus voraussetzen.

## 2. Zielarchitektur

```text
[Server-Plugins: Metabolism / Jobs / Händler / ...]
       |  versionierte, serverinterne UI-Core-API
       v
[SkyMP UI Core — Registrierung, Empfängerauswahl, Zustände, Validierung]
       |  verifizierter SkyMP-Transport, serverseitig autorisiert
       v
[SkyrimPlatform-Client-Bridge]  <->  [bestehender CEF / React Root]
                                             |
                             [UI-Core Host: Widget-Layer,
                              Modal-/Menü-Layer,
                              Notifications, Fokuskoordinator]
                                             |
                                  [Spielerinteraktionen]
                                             v
[CEF -> Client Bridge -> serverseitig validierte UI-Aktion -> Plugin]
```

Es gibt **einen** UI-Host und **eine** koordinierte Fokusverwaltung. Die Chat-Oberfläche bleibt Eigentum des Chat-Projekts und wird bei Bedarf über einen schmalen Adapter angebunden.

### 2.1 Plugin-Manifest

Lieferfähiges Manifest unter dem von SkyMP tatsächlich gescannten Installationspfad:

```json
{
  "name": "skymp-ui-core",
  "version": "1.0.0",
  "kind": "gamemode",
  "displayName": "SkyMP UI Core",
  "description": "Shared in-game UI host, widget and menu registry for SkyMP plugins",
  "main": "index.cjs",
  "optional": false
}
```

**Build:** TypeScript-Quellen mit esbuild o. ä. `--bundle --platform=node --format=cjs` zu `dist/index.cjs` bündeln; die releasefähige Datei als `index.cjs` beilegen. Ein mehrteiliges Source-Verzeichnis darf vorhanden sein, aber nicht als Runtime-Anforderung an den temporären Loader gelten. Build/Test/Package über echte package.json-Skripte dokumentieren.

### 2.2 Öffentliche API — Entwurf, neu zu implementieren

Die Beispiele sind *vorgeschlagene Verträge*, **keine vorhandenen `mp`-Funktionen**. Für im selben Node-Prozess laufende `gamemode`-Plugins nach Prüfung des tatsächlichen Runtime-Verhaltens einen kollisionsarmen, dokumentierten Registry-Service bereitstellen, z. B. `globalThis.skympUi` als nur lesbare Service-Referenz mit `apiVersion: 1`.

```ts
type UiOwner = string;
type UiId = string; // immer namespaced: "metabolism:status"
type UiTarget = { userId: number } | { actorId: number };

type UiWidgetDefinition = {
  id: UiId;
  owner: UiOwner;
  kind: 'status' | 'progress' | 'text' | 'icon-list' | 'custom-template';
  defaultPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  defaultVisible?: boolean;
  schemaVersion: number;
  templateId?: string; // nur registrierte, gebündelte Client-Templates
};

type UiMenuDefinition = {
  id: UiId;
  owner: UiOwner;
  title: string;
  schemaVersion: number;
  layoutId: string; // erlaubte / getestete Komponenten
  modal?: boolean;
};

type UiActionContext = {
  userId: number;            // authentifizierter Server-Kontext, nicht vom Client
  actorId: number | null;
  widgetId: string;
  actionId: string;
  payload: unknown;
  requestId: string;
};

interface SkyMpUiApiV1 {
  readonly apiVersion: 1;
  registerWidget(def: UiWidgetDefinition): void;
  unregisterWidget(owner: UiOwner, id: UiId): void;
  updateWidget(target: UiTarget, widgetId: UiId, state: unknown): void;
  setWidgetVisible(target: UiTarget, widgetId: UiId, visible: boolean): void;
  registerMenu(def: UiMenuDefinition): void;
  openMenu(target: UiTarget, menuId: UiId, state: unknown): void;
  closeMenu(target: UiTarget, menuId: UiId): void;
  notify(target: UiTarget, message: string, options?: {
    tone?: 'info' | 'success' | 'warning' | 'error'; durationMs?: number;
  }): void;
  onAction(owner: UiOwner, widgetId: UiId, actionId: string,
           handler: (ctx: UiActionContext) => Promise<void> | void): void;
  getStatus(): { ready: boolean; apiVersion: number; frontendProtocol: number };
}
```

Vertragsregeln:

- Owner/Namespace sind verpflichtend. IDs validieren, maximal zulässige Länge definieren. Registrierungen fremder Owner nicht überschreiben; bei Duplikat deterministisch Fehler werfen/loggen.
- API-Version und Frontend-Protokollversion getrennt verwalten. Bei Versionsmismatch **fail closed** und sinnvolle Diagnose, keine stillschweigend falschen UI-Aktionen.
- `target` dient der **serverseitigen** Empfängerauswahl. `userId` ↔ Actor-ID beim tatsächlichen SkyMP-Server nachprüfen; niemals die Identität aus Browserpayloads übernehmen.
- `register*` hält nur sichere, serialisierbare Metadaten vor. **Keine beliebigen React-Komponenten, HTML, CSS- oder JS-Quelltexte über das Netzwerk aus Fremdplugins übertragen.** Das Template muss zum kontrollierten Clientpaket gehören; optionale Registries für zusätzliche geprüfte Templates erfordern einen dokumentierten Asset-Releaseprozess.
- `updateWidget`/`openMenu` validieren Zustandsgröße, Form, Version und Ziel. Max-Payload, Anzahl Widgets, Update-Frequenz und TTL in Konfiguration.
- `onAction` registriert serverseitige Handler, prüft Owner + registrierte Action + Session/User + Berechtigung + Request-ID + Rate Limit; Exceptions isolieren.
- Abmeldung/Cleanup bei Server-Shutdown und optional nachweislich verfügbarem Plugin-Lifecycle. Keine Schein-Hot-Reload-Funktion.

### 2.3 Optionaler Service-Discovery-/Dependency-Adapter

Andere Plugins brauchen einen stabilen Weg, `skympUi` zu finden. Bei heutiger gemeinsamer Gamemode-Runtime kann eine wohlbekannte globale Registry **nach verifizierter Prüfung** genügen. Laderreihenfolge z. B.:

```json
{ "pluginsLoadOrder": ["skymp-ui-core", "skymp-chat", "skymp-metabolism"] }
```

Diese Reihenfolge ist ein **Beispiel**, abhängig von der realen Start-/Abhängigkeitsstruktur. Der Loader besitzt laut Dokumentation keine deklarative Abhängigkeitsauflösung. Das UI Core ist unabhängig vom Chat; Chat soll weiterhin ohne UI Core funktionieren. Bei nicht verfügbarem UI Core muss ein konsumierendes Plugin einen expliziten optionalen Fallback erhalten, nicht crashen oder unendlich pollend warten.

## 3. Client-UI und Integration in den Fork

### 3.1 Ein UI-Host im vorhandenen React-Frontend

- React-/CEF-Root erweitern statt zweite Weboberfläche starten. Neue Komponenten vorzugsweise `UiCoreProvider`, `WidgetHost`, `MenuHost`, `NotificationHost`, `FocusManager` oder repo-konforme Äquivalente.
- In der normalen Ingame-Ansicht sichtbar, **ohne** `?devUi`, `?admin`, LocalStorage-Login-Hacks oder anonyme Debug-URLs.
- Widget-Layer noninteractive/`pointer-events: none`, wo angemessen; echte Interaktion nur bei explizit freigegebener UI. Modale Menüs sollen Eingaben abfangen und Gameplay wieder freigeben, sobald geschlossen.
- Chat-Priorität berücksichtigen: Enter öffnet/fokussiert weiterhin Chat; Escape schließt zuerst aktives Modal/Chat-Eingabe entsprechend abgestimmter Fokuspolicy. F2/F6 des bestehenden BrowserService nicht unkoordiniert neu registrieren.
- Skyrim-Menüs (Inventar, Karte, Dialoge, Konsole, Laden) respektieren; beim Wechsel kein dauerhaft hängender Mausfokus. Bei Disconnect/Serverwechsel Eingabe und stale Widgets zurücksetzen.
- UI-Komponenten in konsistentem Fantasy-/Skyrim-Stil; Barrierefreiheit: Skalierung (z. B. 75–150 %), gute Lesbarkeit, Farbkontraste, alternative Text-/Icon-Signale, Tastaturnavigation.
- Widget-Positions-/Sichtbarkeitseinstellungen als reine **lokale Präsentationspräferenz** je Spieler speichern, sofern eine sichere Speicherquelle existiert; keine Spielwerte lokal autorisieren.
- Lokalisierungskeys für DE/EN; Fallback auf Deutsch oder English nach bestehendem i18n-System.

### 3.2 Echte bidirektionale Brücke

Implementiere ausschließlich auf Basis nachgewiesener Browser-/SkyrimPlatform-/SkyMP-APIs:

1. Client-Ready-Handshake erst nach erfolgreichem Laden des realen Frontends; identifizierte Verbindung auf Serverseite.
2. Server→Client: registrierte Widgets + zustandsbezogene Snapshots + sequenzierte Updates. Kein verlorenes Erstinitialisieren bei langsamem CEF-Start oder Reconnect.
3. Client→Server: nur `{protocolVersion, widgetId, actionId, requestId, payload}`. Spieler-ID und Permission-Daten werden serverseitig ermittelt.
4. Replays/Duplikate durch Request-ID/TTL und serverseitige Validierung behandeln, ohne unendliche Buffers.
5. Sichere Serialisierung bei `executeJavaScript`: niemals untrusted Payload in unescaped JS-String einsetzen. Nach Möglichkeit bereits vorhandenen strukturierten Message-Transport verwenden; andernfalls transportieren über streng JSON-serialisierte und korrekt maskierte Daten.
6. Updates pro Spieler coalescen/debouncen; keine Browser-Execute-Aufrufe pro Spieltick für jedes Widget. Keine unbeschränkten Arrays/Listener; bounded queues und Cleanup.

**Distributionspflicht:** Normale SkyMP-Server-Plugins verteilen keinen Frontend-Build. Deshalb:

- Quellcode für den **kleinstmöglichen** Client-Integrationspatch/Adapter im UI-Core-Repo ablegen (`integration/skymp-fork/` oder als sauber dokumentierte Patch-Serie).
- README nennt exakt, welche Dateien im SkyMP-Fork geändert/gebaut werden und welche CEF-/Client-Dateien Clients per Launcher/Modpack erhalten.
- Wenn ein rein externes Server-Plugin ohne Kern-/Clientänderung nicht realistisch ist: offen dokumentieren. Keine behauptete Plug-and-play-UI ohne installierte Clientintegration.
- Schnittstellen so gestalten, dass andere Plugins **keine weitere Core-/Clientänderung** brauchen, solange sie registrierte Templates nutzen.

## 4. MVP-Funktionen in dieser Reihenfolge

**P0 — Nachweis der Integration:** UI-Core-Plugin bootet, veröffentlichte API-Version sichtbar, CEF-Handshake in echter normaler Spielsession, einfacher registrierter Status-Widget erscheint. Echte Server→Client-Änderung wird sichtbar.

**P1 — Widget-Registry:** `registerWidget`, `updateWidget`, `setWidgetVisible`, Owners, lokale Layout-/Skalierungseinstellungen, mehrfach registrierte Widgets (verschiedene Plugins), Limits.

**P2 — Notification-Service:** Info/Erfolg/Warnung/Fehler, Queuing, TTL, Throttling, sichere Textdarstellung.

**P3 — Menüs und Actions:** deklarative, sichere Form-/Dialog-/Button-Komponenten, Modal/Nonmodal, serverseitige Action-Handler, Fokus und Esc-Verhalten. Keine direkt aus Client-JS ausführbaren Spielaktionen.

**P4 — Chat-Kompatibilität:** Laufendes `D:\GitHub\SkyMP-Chat` nur lesen, tatsächliche Commands/Fokus beobachten und per separatem Adapter kompatibel bleiben. Kein Umschreiben des funktionierenden Chat-Plugins ohne ausdrückliche Notwendigkeit.

**P5 — Referenzintegration:** kleines separates `ExampleUiConsumer`-Testplugin registriert ein Widget und eine Menüaktion, ohne UI Core intern anzupassen; später kann Metabolism dasselbe API verwenden.

## 5. Qualitäts- und Sicherheitskriterien

- UI-Daten sind Daten, nie auszuführender Code: keine Fremd-HTML-Injektion, kein `dangerouslySetInnerHTML`, kein `eval`/`new Function` aus UI-Payloads, keine frei akzeptierten CSS-URLs.
- Validierung in beiden Richtungen; **serverseitig** sind Authorization, ownership, amount/limits, Session und Action erlaubt/nicht erlaubt zu entscheiden.
- Keine direkte Kopplung zwischen Metabolism-Logik und UI-Core-Interna; lediglich `SkyMpUiApiV1`.
- Pro Spieler Zustandsisolation; kein Leck privater Menüdaten an Nachbarspieler, keine Vermischung bei Reconnect.
- Fokus-Regressionstests für Chat, Skyrim-Menüs, Disconnect und gleichzeitige Modals. Beim Fehler darf nicht dauerhaft die Kontrolle über Skyrim verloren gehen.
- Konfigurierbare Logging-Level; im Normalfall keine unkontrollierten Payload-/Token-Logs.
- Client-UI ohne serverseitiges UI-Core-Plugin: kein Absturz, UI-Leerzustand korrekt, Chat funktioniert weiter.
- Server-Plugin ohne aktualisierte Client-Assets: aussagekräftiger Versions-/Handshake-Fehler im Log, keine Endlosschleife.
- Keine kostenpflichtigen Dienste notwendig; Windows/Linux-Server berücksichtigen, soweit vom Fork unterstützt.
- Versionskontrolle/Branch/Backup respektieren, fremde Repos nicht ohne Freigabe verändern; stattdessen Patch/PR erstellen, wenn Integrationsquelle außerhalb des Arbeitsrepos liegt.

## 6. Tests und explizite Abnahme

Automatisiere Unit-/Integrationstests soweit möglich; ergänze einen manuellen Zweiclient-Testplan:

- [ ] `plugin.json` wird vom echten Loader erkannt; deaktiviert/aktiviert entsprechend Discovery-State; Neustarts dokumentiert.
- [ ] Bundled `index.cjs` funktioniert **ohne** relative `require`-Auflösung aus dem Plugin-Verzeichnis.
- [ ] Zwei unterschiedliche fremde Plugins können Widgets registrieren, ohne die UI-Core-Quelle zu bearbeiten.
- [ ] Duplikat-IDs/Owner-Missbrauch werden korrekt abgewiesen.
- [ ] Ingame-CEF zeigt eine vom Gameserver erzeugte Statusanzeige **ohne Dev-/Admin-Modus**.
- [ ] Nach initialem Ready und nach Reconnect erscheint der **korrekte aktuelle Snapshot**; stale UI wird gelöscht.
- [ ] Spieler A sieht keine nur für Spieler B bestimmten Daten.
- [ ] Klick auf eine registrierte Menüaktion ruft exakt einen autorisierten Server-Handler auf; gefälschte Client-IDs/Berechtigungen wirkungslos.
- [ ] HTML-/JS-Injection-Payload wird ausschließlich als Text gezeigt.
- [ ] Chat kann weiterhin mit Enter geöffnet, verwendet und mit Escape geschlossen werden; F2/F6 und Skyrim-Menüs funktionieren ohne Fokusverlust.
- [ ] Kein UI-Core-Plugin und fehlendes Clientpaket erzeugen kontrollierte Fehlerszenarien, keine Crashloops.
- [ ] Widget-Flut (z. B. 20 Widgets, schnelle Updates) bleibt durch definierte Rate-/Queue-/Größenlimits begrenzt.
- [ ] Build, Tests, Installationsschritte und Client-/Server-Versionskompatibilität dokumentiert.

## 7. Erwartete Repo-Struktur und Deliverables

```text
SkyMP-UI-Core/
  AGENTS.md
  README.md
  package.json
  tsconfig.json
  src/                 # Server-Core und Runtime-API
  client/              # React-Komponenten, sicherer CEF-Bridge-Adapter
  integration/         # minimaler Patch für SkyMP-Fork, falls notwendig
  examples/            # ExampleUiConsumer-Plugin
  tests/
  docs/
    ARCHITECTURE.md
    API.md
    FOCUS_AND_CHAT.md
    INSTALLATION.md
    CLIENT_DEPLOYMENT.md
  dist/                # gebaute Artefakte nach Build
  release/
    SkyMPUICore/
      plugin.json
      index.cjs
      README.md
```

Dateinamen/Pfade dürfen repo-konform angepasst werden; der funktionale Umfang und die klare Trennung Server/Core vs Clientintegration sind verbindlich. Verändere nicht den bestehenden SkyMP-Chat-Code, um UI-Core bequem einbauen zu können. Entsprechende Anpassungen zunächst als klar isolierten Patch oder PR vorschlagen.

## 8. Ablauf für den Coding-Agenten

1. **Audit**: alle Istschnittstellen prüfen; insbesondere die reale aktuelle Chat-Integration unter `D:\GitHub\SkyMP-Chat`; Machbarkeit der CEF-Anbindung belegen.
2. **API-Freeze v1**: serverinterne Contract-Types und Events/Schemas festlegen; maschinenprüfbare Contracts erstellen.
3. **Plugin-Implementierung**: loaderkompatibles Server-Bundle und echte Widget-/Menü-/Notification-Registry.
4. **Clientintegration**: minimaler Host im vorhandenen React/CEF + Fokuskoordination; getrennte Deployment-Anweisungen.
5. **Referenzkonsument**: Test-Plugin mit Statusanzeige und autorisierter Buttonaktion.
6. **Tests**: automatisierte und manuelle Tests; echte Build-/Startbefehle protokollieren.
7. **Abschluss**: Ist-/Soll-Abgleich, Dateiliste, geprüfte/ungeprüfte Funktionen, notwendige Fork-/Client-Patches, Build/Installation, Risiken. Nicht getestete Integration explizit kennzeichnen.

**Definition of Done:** Ein zweites Plugin kann ohne Änderungen am UI-Core-Code ein Widget und eine Aktion registrieren; ein realer Spieler sieht das Widget im normalen SkyMP-Client, die Aktion erreicht nach serverseitiger Validierung den richtigen Handler, und der bestehende Chat bleibt vollständig benutzbar.
