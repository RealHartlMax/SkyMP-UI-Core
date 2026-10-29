// Prepare and apply isolated server/dashboard changes without overwriting other work.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), fork = path.resolve(process.env.SKYMP_FORK || path.join(root, '../skymp'));
const planRoot = path.join(root, 'artifacts/plugin-load-order'), manifest = path.join(planRoot, 'plan.json');
const sourceRoot = path.join(root, 'integration/server-plugin-load-order/files');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = name => fs.readFileSync(path.join(fork, name), 'utf8').replace(/\r\n/g, '\n');
const replace = (source, before, after) => { assert.equal(source.split(before).length, 2, 'Integration anchor changed: ' + before.slice(0, 60)); return source.replace(before, after); };
let plan;
if (fs.existsSync(manifest)) plan = JSON.parse(fs.readFileSync(manifest));
else {
  const files = new Map();
  for (const name of ['skymp5-server/ts/pluginLoadOrder.ts', 'skymp5-front/src/features/adminDashboard/PluginsPanel.tsx']) files.set(name, fs.readFileSync(path.join(sourceRoot, name), 'utf8'));
  let ui = read('skymp5-server/ts/ui.ts');
  ui = replace(ui, "import * as crypto from 'crypto';", "import * as crypto from 'crypto';\nimport { registerPluginLoadOrder } from './pluginLoadOrder';");
  ui = replace(ui, '    // ── Plugin management ───────────────────────────────────────────────', `    registerPluginLoadOrder(router, {
      read: readServerSettingsJson,
      write: value => { writeServerSettingsJson(value); settings.allSettings = value; },
      authorize: (ctx, write) => ensureAdminCapability(settings, ctx, write ? 'canConsole' : 'canViewLogs'),
      log: message => addAdminLog('console', message),
    });

    // ── Plugin management ───────────────────────────────────────────────`);
  files.set('skymp5-server/ts/ui.ts', ui);
  const styles = 'skymp5-front/src/features/adminDashboard/plugins.scss';
  files.set(styles, read(styles) + `\n.server-plugins__moves { display: grid; grid-template-columns: repeat(2, 36px); gap: 5px; align-items: center; justify-items: stretch; }
.server-plugins__moves > strong { grid-column: 1 / -1; text-align: center; color: #d8c39c; font-variant-numeric: tabular-nums; }
.server-plugins__moves > button { padding: 5px; min-height: 36px; font-size: 20px; }
.server-plugins__order-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 20px; }
.server-plugins__order-actions > span { color: #e8d3a4; }
`);
  const messages = {
    de: { orderTitle: 'Plugin-Ladereihenfolge', orderHint: 'Dienste wie UI Core vor den Plugins laden, die sie benötigen. Die Reihenfolge gilt ab dem nächsten Gameserver-Start.', orderSave: 'Ladereihenfolge speichern', orderDiscard: 'Änderungen verwerfen', orderChanged: 'Ungespeicherte Ladereihenfolge.', orderSaved: 'Reihenfolge gespeichert. Gameserver neu starten, um sie anzuwenden.', orderStale: 'Reihenfolge oder Pluginliste wurde inzwischen geändert. Änderungen verwerfen, neu laden und erneut speichern.', orderUnavailable: 'Ladereihenfolge nicht verfügbar. Dashboard/Serverpaket aktualisieren oder die gespeicherte Konfiguration prüfen.', orderUp: 'Nach oben', orderDown: 'Nach unten', orderPosition: 'Position {{position}}' },
    en: { orderTitle: 'Plugin load order', orderHint: 'Load services such as UI Core before plugins that use them. The order takes effect at the next game-server start.', orderSave: 'Save load order', orderDiscard: 'Discard changes', orderChanged: 'Unsaved load order.', orderSaved: 'Order saved. Restart the game server to apply it.', orderStale: 'The order or plugin list changed. Discard changes, refresh and save again.', orderUnavailable: 'Load order unavailable. Update the dashboard/server package or check the saved settings.', orderUp: 'Move up', orderDown: 'Move down', orderPosition: 'Position {{position}}' },
    ru: { orderTitle: 'Порядок загрузки плагинов', orderHint: 'Загружайте службы, например UI Core, до использующих их плагинов. Порядок применяется при следующем запуске игрового сервера.', orderSave: 'Сохранить порядок', orderDiscard: 'Отменить изменения', orderChanged: 'Порядок не сохранён.', orderSaved: 'Порядок сохранён. Перезапустите игровой сервер.', orderStale: 'Порядок или список плагинов изменён. Отмените изменения, обновите список и сохраните снова.', orderUnavailable: 'Порядок загрузки недоступен. Обновите панель/сервер или проверьте настройки.', orderUp: 'Выше', orderDown: 'Ниже', orderPosition: 'Позиция {{position}}' },
    es: { orderTitle: 'Orden de carga de plugins', orderHint: 'Carga servicios como UI Core antes de los plugins que los utilizan. Se aplica al próximo inicio del servidor de juego.', orderSave: 'Guardar orden de carga', orderDiscard: 'Descartar cambios', orderChanged: 'Orden de carga sin guardar.', orderSaved: 'Orden guardado. Reinicia el servidor de juego para aplicarlo.', orderStale: 'El orden o la lista de plugins cambió. Descarta los cambios, actualiza y guarda de nuevo.', orderUnavailable: 'Orden no disponible. Actualiza el panel/servidor o revisa la configuración.', orderUp: 'Subir', orderDown: 'Bajar', orderPosition: 'Posición {{position}}' },
    fr: { orderTitle: 'Ordre de chargement des plugins', orderHint: 'Chargez les services comme UI Core avant les plugins qui les utilisent. Application au prochain démarrage du serveur de jeu.', orderSave: 'Enregistrer l’ordre', orderDiscard: 'Annuler les modifications', orderChanged: 'Ordre non enregistré.', orderSaved: 'Ordre enregistré. Redémarrez le serveur de jeu.', orderStale: 'L’ordre ou la liste des plugins a changé. Annulez les modifications, actualisez puis enregistrez.', orderUnavailable: 'Ordre indisponible. Mettez à jour le tableau de bord/serveur ou vérifiez la configuration.', orderUp: 'Monter', orderDown: 'Descendre', orderPosition: 'Position {{position}}' },
    it: { orderTitle: 'Ordine di caricamento dei plugin', orderHint: 'Carica servizi come UI Core prima dei plugin che li usano. Si applica al prossimo avvio del server di gioco.', orderSave: 'Salva ordine', orderDiscard: 'Annulla modifiche', orderChanged: 'Ordine non salvato.', orderSaved: 'Ordine salvato. Riavvia il server di gioco.', orderStale: 'L’ordine o l’elenco dei plugin è cambiato. Annulla le modifiche, aggiorna e salva di nuovo.', orderUnavailable: 'Ordine non disponibile. Aggiorna pannello/server o controlla la configurazione.', orderUp: 'Sposta su', orderDown: 'Sposta giù', orderPosition: 'Posizione {{position}}' },
  };
  for (const [language, texts] of Object.entries(messages)) {
    const name = `skymp5-front/src/locales/${language}.json`, value = JSON.parse(read(name));
    Object.assign(value.adminDashboard.plugins, texts); files.set(name, JSON.stringify(value, null, 2) + '\n');
  }
  const docs = 'README-plugins.md';
  files.set(docs, read(docs) + `\n## Plugin-Ladereihenfolge im Dashboard\n\nUnter **Ressourcen → Server-Plugins** zeigen Positionsnummern die Reihenfolge fuer\nden naechsten Gameserver-Start. Mit den Pfeilen nach oben/unten verschieben und\n**Ladereihenfolge speichern** waehlen. Aktivierung bleibt eine getrennte Einstellung.\nUngespeicherte Aenderungen koennen verworfen werden. Suchfilter entfernen keine\nPlugins aus der gespeicherten Liste. Gleichzeitige Aenderungen werden mit einem\nKonflikthinweis abgewiesen.\n\nDie Auswahl wird als Plugin-IDs in pluginsLoadOrder der server-settings.json\ngespeichert; private Einstellungen, Mod-Reihenfolge und Discovery-State bleiben\nerhalten. Dienste muessen vor ihren Verbrauchern stehen, beispielsweise\nskymp-ui-core vor example-ui-consumer und second-ui-consumer. Ohne explizite\nReihenfolge greift weiterhin die alphabetische Sortierung des bestehenden Loaders.\nNicht aufgefuehrte neue Plugins folgen alphabetisch. Bereits konfigurierte,\nvoruebergehend fehlende Plugin-IDs bleiben erhalten. Keine automatische\nAbhaengigkeitsaufloesung und kein einzelner Plugin-Hot-Reload.\n\nGET /api/admin/plugins/load-order liefert Reihenfolge und Revision (canViewLogs).\nPUT mit {revision, pluginsLoadOrder} speichert die vollstaendige Liste (canConsole).\nVeraltete Revision: 409; ungueltige/unvollstaendige Liste: 400. Aenderungen gelten\nab dem naechsten Gameserver-Start. Fuer die Installation dieses neuen Dashboard-/\nBackend-Builds einmal den Starter/Dashboarddienst neu starten; beim spaeteren\nUmordnen genuegt ein Gameserver-Neustart.\n`);
  fs.mkdirSync(planRoot, { recursive: true }); const entries = [];
  for (const [name, content] of files) {
    const target = path.join(fork, name), previous = fs.existsSync(target) ? fs.readFileSync(target) : null;
    const data = Buffer.from(previous?.toString().includes('\r\n') ? content.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n') : content);
    for (const [folder, bytes] of [['before', previous], ['after', data]]) if (bytes) { const file = path.join(planRoot, folder, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); }
    entries.push({ path: name, before: previous ? hash(previous) : null, after: hash(data) });
  }
  plan = { fork, entries }; fs.writeFileSync(manifest, JSON.stringify(plan, null, 2) + '\n');
}
assert.equal(plan.fork, fork);
for (const entry of plan.entries) {
  const file = path.join(fork, entry.path), actual = fs.existsSync(file) ? hash(fs.readFileSync(file)) : null;
  assert(actual === entry.before || actual === entry.after, 'File changed since plan: ' + entry.path);
  assert.equal(hash(fs.readFileSync(path.join(planRoot, 'after', entry.path))), entry.after);
}
if (process.argv.includes('--refresh')) {
  for (const entry of plan.entries) {
    const blueprint = path.join(sourceRoot, entry.path); if (!fs.existsSync(blueprint)) continue;
    const target = path.join(fork, entry.path), previous = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    const raw = fs.readFileSync(blueprint, 'utf8').replace(/\r\n/g, '\n');
    const data = Buffer.from(previous.includes('\r\n') ? raw.replace(/\n/g, '\r\n') : raw);
    fs.writeFileSync(path.join(planRoot, 'after', entry.path), data); entry.after = hash(data);
  }
  fs.writeFileSync(manifest, JSON.stringify(plan, null, 2) + '\n');
}
if (process.argv.includes('--apply')) for (const entry of plan.entries) { const target = path.join(fork, entry.path); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(planRoot, 'after', entry.path), target); }
console.log(JSON.stringify({ applied: process.argv.includes('--apply'), ...plan }, null, 2));
