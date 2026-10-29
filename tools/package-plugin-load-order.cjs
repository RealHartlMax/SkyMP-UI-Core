const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), fork = path.resolve(process.env.SKYMP_FORK || path.join(root, '../skymp'));
const output = path.join(root, 'artifacts/plugin-load-order-release'), stage = path.join(output, 'staging');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const browser = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/plugin-load-order-browser.json')));
const api = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/plugin-load-order-api.json')));
assert(browser.passed && api.passed, 'Run API/browser acceptance first');
assert(!fs.existsSync(output), 'Choose a fresh release output; existing packages are retained');
const front = path.join(root, 'artifacts/plugin-order-frontend'); assert.equal(hash(path.join(front, 'build.js')), browser.frontendSHA256);
for (const name of ['skymp5-admin.js', 'skymp5-server.js']) assert(fs.readFileSync(path.join(fork, 'build/dist/server/dist_back', name), 'utf8').includes('PLUGIN_ORDER_ORIGIN_REQUIRED'), 'Rebuild final backend: ' + name);
fs.mkdirSync(stage, { recursive: true }); const entries = [];
const copy = (from, relative) => { const target = path.join(stage, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(from, target); entries.push({ path: relative, size: fs.statSync(target).size, sha256: hash(target) }); };
for (const name of ['skymp5-admin.js', 'skymp5-admin.js.map', 'skymp5-server.js', 'skymp5-server.js.map']) copy(path.join(fork, 'build/dist/server/dist_back', name), 'Server/dist_back/' + name);
const assets = JSON.parse(fs.readFileSync(path.join(front, 'assets-manifest.json')));
for (const name of [...assets.assets, 'assets-manifest.json']) {
  assert(!name.includes('..') && !path.isAbsolute(name) && !name.includes('\\'), 'Unsafe frontend asset');
  copy(path.join(front, name), 'Server/ui/' + name);
}
copy(path.join(fork, 'README-plugins.md'), 'README-plugins.md');
const instruction = `# Plugin-Ladereihenfolge: lokales Server-Update\n\nDieses Paket stammt aus dem aktuellen lokalen SkyMP-Arbeitsstand mit dessen weiteren vorhandenen Aenderungen.\nEs ersetzt nur Server/dist_back und die gebauten Server/ui-Dateien. Keine Einstellungen,\nPlugins, Discovery-Flags, Spielstaende, Masterkeys, DLLs oder scam_native.node werden mitgeliefert.\n\n1. Den Starter/Dashboarddienst und Gameserver geordnet beenden. Vorhandene dist_back/ui-Dateien sichern.\n2. Den ZIP-Ordner Server mit dem bestehenden Server-Ordner zusammenfuehren. Server muss der tatsaechliche Game-CWD sein.\n3. Starter/Dashboard wieder starten und die Browserseite neu laden.\n4. Ressourcen -> Server-Plugins: skymp-ui-core vor example-ui-consumer und second-ui-consumer verschieben.\n5. Ladereihenfolge speichern. Danach den Gameserver neu starten; spaetere Reihenfolgeaenderungen brauchen keinen Dashboard-Neustart.\n\nDas Speichern betrifft ausschliesslich pluginsLoadOrder in server-settings.json.\nAktivierung bleibt getrennt. Neue Plugins muessen weiterhin regulär entdeckt/aktiviert werden.\nEs gibt keine automatische Abhaengigkeitsaufloesung oder Plugin-Hot-Reload.\n\nBeispiel fuer die bereits gemeldeten Plugins:\n["skymp-ui-core","skymp-chat","skymp-chat-ping","example-ui-consumer","second-ui-consumer","skymp-yaca-ts"]\n\nDie neue Client-/CEF-Runtime ist im Launcher-Repository separat vorbereitet unter\nlocal-builds/runtime-2026-10-28-plugin-load-order/. Sie wird nicht durch Server-Plugins verteilt.\nKein Upload, kein Commit/Push, kein Produktionsneustart und keine echte Skyrim-Spielsession durchgefuehrt.\n`;
fs.writeFileSync(path.join(stage, 'INSTALLATION.de.md'), instruction); entries.push({ path: 'INSTALLATION.de.md', size: Buffer.byteLength(instruction), sha256: hash(path.join(stage, 'INSTALLATION.de.md')) });
const archive = path.join(output, 'SkyMP-Server-plugin-load-order-update.zip');
assert(entries.every(entry => !/server-settings|discovery-state|admin-auth|master\.key|\.node$|\.dll$/.test(entry.path)), 'Protected server file entered update');
const pwsh = path.join(process.env.ProgramFiles, 'PowerShell/7/pwsh.exe');
for (const action of ['Create', 'Verify']) {
  const result = spawnSync(pwsh, ['-NoProfile', '-NonInteractive', '-File', path.join(root, 'integration/launcher/archive-runtime.ps1'), '-Action', action, '-Source', stage, '-Destination', archive], { encoding: 'utf8', timeout: 300000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message); if (result.stdout.trim()) console.log(result.stdout.trim());
}
const report = { passed: true, createdAt: new Date().toISOString(), archive: path.basename(archive), archiveSHA256: hash(archive),
  frontendSHA256: browser.frontendSHA256, apiChecks: api.checks, browserChecks: browser.checks, files: entries,
  protectedServerFilesIncluded: false, deployed: false, published: false, skyrimStarted: false };
fs.writeFileSync(path.join(output, 'VALIDATION.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(output, 'SHA256SUMS'), `${report.archiveSHA256}  ${report.archive}\n`);
console.log(JSON.stringify({ passed: true, output, archive: report.archive, files: entries.length, archiveSHA256: report.archiveSHA256 }, null, 2));
