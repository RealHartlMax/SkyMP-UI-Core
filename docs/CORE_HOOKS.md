# Integrationspunkte außerhalb von UI Core

Stand 04.11.2026. Dies sind isolierte Vorschläge, keine angewendeten Änderungen
an SkyMP, Chat, Metabolism, YACA oder Launcher.

## Für die implementierten Komponenten

**Keine neuen nativen Engine-Hooks erforderlich.** Der geprüfte lokale Fork
besitzt bereits den generischen Plugin Runtime Loader und CEF-Host. Die neuen
Renderer, Contracts und die native UI-Core-Brücke werden ausschließlich aus dem
Pluginpaket geladen. Verbraucher verwenden die öffentliche UI-Core-API.

| Vorhandener Integrationspunkt | Zuständigkeit |
| --- | --- |
| Server `ts/index.ts`, `pluginRuntimePackages.ts` | Discovery, gebündelter Gamemode-Entry, Veröffentlichung von `client/manifest.json` |
| Client `services/services/pluginRuntimeLoader.ts` | geprüfte native Pluginaktivierung, Listener-Cleanup, Fokus-/UI-Bindings |
| Client `services/services/browserService.ts` | einziger nativer Fokuskoordinator, Skyrim-Menüs/F2/F6/Enter/Escape |
| Frontend `features/pluginRuntime/index.js` und `src/index.js` | generischer Host im vorhandenen CEF, Plugin-Styles und React-Mount |
| Launcher `connection/plugin_runtime.rs` | Hashes, optionale Herausgebersignaturen, Versionsledger, Journal/Restore |

Ein älterer Fork ohne diesen Bootstrap benötigt dessen einmalige Integration als
separaten Auftrag. Historische feste UI-Core-Quellkopien sind kein Updateweg.

## Automatische Weltinteraktion

Der Renderer und die gemeinsame Action-Registry sind implementiert. Die Wahl des
Interaktionsziels wird hier bewusst nicht aus einem CEF-Payload übernommen.
Die Referenzpunkte für einen späteren Gameplay-Router sind tatsächlich vorhanden:

- `skymp5-client/src/services/services/activationService.ts` übersetzt lokale IDs
  über `localIdToRemoteId` und schickt `MsgType.Activate` zuverlässig.
- `server_guest_lib/gamemode_events/ActivateEvent.cpp` liefert
  `onActivate(targetRefrId,casterRefrId)` vor nativer Verarbeitung.
- `MpObjectReference.cpp` berücksichtigt das boolesche Ergebnis von `Fire`.
- Der vorhandene Metabolism-Adapter beobachtet dasselbe Ereignis über seinen
  eigenen vorsichtigen Hub; einfaches Ersetzen von `mp.onActivate` wäre ein Konflikt.

Ein gemeinsamer **Gameplay-Router** sollte deshalb:

1. Den realen Activate-Hook unter Erhalt bestehender Handler/Blockierentscheidungen
   koordinieren. Ein generischer Dispatcher mit Owner-/Disposer-Vertrag wäre eine
   mögliche Fork-Erweiterung; er wird nicht als existierende API bezeichnet.
2. Native Spieler-/Actor-Zuordnung, Charakterstatus, Zieltyp, Existenz, Zellkontext,
   Entfernung und Objektzustand serverseitig feststellen. Client-Hinweise sind
   höchstens Anfragen, keine Autorisierung.
3. Die verfügbaren Plugin-Actions aus `framework.listInteractions(kind)` anhand
   der Gameplay-Regeln einschränken und einmal `openInteraction(target, subject, ids)`
   aufrufen. Die Registry ersetzt die vorherige gemeinsame Ansicht pro Spieler.
4. Bewusst entscheiden, ob für dieses Ziel die native Standardaktivierung erhalten
   oder blockiert wird. UI Core trifft diese Entscheidung nicht. Insbesondere
   darf das Öffnen eines Menüs weder eine Tür entriegeln noch einen Containerzugriff
   oder Kauf implizit erlauben.
5. Die endgültigen Regeln beim registrierten Action-Handler erneut prüfen; ein
   inzwischen entfernter NPC, neuer Schlosszustand oder geänderter Preis muss gelten.

Keine neuen globalen Hotkeys oder generischen Client-Aktivierungs-Hooks wurden
eingebaut. Automatisches Ersetzen sämtlicher Skyrim-Interaktionen ist deshalb
**vorbereitet, nicht implementiert**. Für die manuelle/serverseitige Öffnung der
gemeinsamen Oberfläche ist kein zusätzlicher Core-Hook erforderlich.

## Charakterauswahl und Charakterwechsel

Der bestehende BrowserService sperrt bereits `Menu.RaceSex`; `sessionEnded`
setzt Plugin-Interaktion ebenfalls aus. Disconnect, Actorersetzung und abgelaufene
UI-Sitzungen löschen UI-Core-Daten. Ein zukünftiger Charakterwechsel **bei gleicher
Verbindung und gleicher Actor-ID** kann daraus jedoch nicht zuverlässig erkannt
werden. Ein verbindlicher Character-Service-/Lifecycle-Vertrag ist noch nötig.

Vorgeschlagene Reihenfolge dieses künftigen Hooks: UI-Interaktion aussetzen,
Menüs/Requests des bisherigen Charakters invalidieren, den neuen authentifizierten
Charakter serverseitig binden, optionale Präsentationspräferenzen laden, neue
Snapshots durch die Consumer publizieren, Interaktion freigeben. Ein neuer
Sitzungs-Nonce oder expliziter UI-Reset muss dabei alte Actions unbrauchbar machen.
Die konkrete Server-API dafür wird erst mit dem zentralen Character-Service
festgelegt. Hier gibt es keine angenommene `mp.onCharacterSelected`-Funktion.

## Optionaler Adapter für zentrale Präferenzen – Entwurf

Die derzeitige lokale Speicherung bleibt Standard; Details in
[HUD_PREFERENCES.md](HUD_PREFERENCES.md). Falls ein zentraler Character-Service
eingeführt wird, kann er unter seinem eigenen Charakterdatensatz ausschließlich
einen begrenzten Präsentationswert halten. Kein weiterer Datenbanktreiber in UI Core.

```ts
// Proposed adapter contract, not an exported/implemented UI Core API.
interface CharacterUiPreferenceStoreV1 {
  load(context: ServerCharacterContext, signal: AbortSignal): Promise<{
    revision: string;
    preferences: { scale: number; widgets: Record<string, {
      position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      hidden?: boolean; x?: number; y?: number; scale?: number;
    }> };
  } | null>;
  save(context: ServerCharacterContext, expectedRevision: string,
       preferences: unknown, signal: AbortSignal): Promise<{revision:string}>;
}
```

`ServerCharacterContext` muss vom zentralen Service stammen und enthält den
verifizierten Server-/Account-/Charakterbezug, niemals eine Browser-Charakter-ID.
Vor Speichern/Laden dieselben Grenzen wie lokale Präferenzen anwenden:
75–150 %, normierte Koordinaten, bekannte Positionswerte, höchstens 160 Einträge
und 64 KiB. Compare-and-swap verhindert verlorene parallele Änderungen. Beim
Charakterwechsel laufende Ladevorgänge abbrechen und späte Ergebnisse verwerfen.
Ausfall des Adapters fällt endlich auf lokale Präsentation zurück; keine Spielwerte,
Berechtigungen, Inventare oder Preise aus diesem Datensatz lesen.

Dieser Adapter und der Lifecycle-Hook sind **nur entworfen**. Sie wurden weder
exportiert noch mit einer nicht vorhandenen zentralen Datenbank verbunden.
