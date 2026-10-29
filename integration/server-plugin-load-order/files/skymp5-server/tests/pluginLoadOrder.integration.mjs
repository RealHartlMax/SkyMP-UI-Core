// Real dashboard API, disposable settings and the actual game's boot sorter.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), esbuild = require('../node_modules/esbuild'), ts = require('../node_modules/typescript');
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-plugin-order-')), previous = process.cwd(), checks = [];
let listener;
try {
  const bundle = path.join(dir, 'dashboard.cjs');
  await esbuild.build({ stdin: { contents: "export {createApp, adminAuthParse} from './ts/ui';", resolveDir: serverRoot, loader: 'ts' }, outfile: bundle,
    absWorkingDir: serverRoot, bundle: true, platform: 'node', target: 'es2022', logLevel: 'silent', alias: { '@opentelemetry/api': './ts/shims/opentelemetry-api.js' },
    plugins: [{ name: 'test-router-exports', setup(build) { build.onLoad({ filter: /[\\/]ts[\\/]ui\.ts$/ }, args => ({ contents: fs.readFileSync(args.path, 'utf8') + '\nexport {createApp, adminAuthParse};', loader: 'ts' })); } }] });
  esbuild.stop(); process.chdir(dir);
  const api = require(bundle), ids = ['example-ui-consumer', 'second-ui-consumer', 'skymp-chat', 'skymp-ui-core'];
  const config = { name: 'Load-order fixture', port: 7777, maxPlayers: 8, loadOrder: ['Skyrim.esm'], pluginsLoadOrder: [], dataDir: path.join(dir, 'data'),
    offlineMode: true, adminApi: { enabled: true }, adminUiAuth: { user: 'owner', password: crypto.randomBytes(24).toString('hex') },
    adminUiUsers: { owner: { role: 'admin' } }, masterKey: 'PRIVATE_ORDER_FIXTURE', pluginDiscovery: { mode: 'safe' } };
  fs.mkdirSync(config.dataDir); fs.mkdirSync(path.join(dir, 'Plugins'));
  const settingsFile = path.join(dir, 'server-settings.json'), stateFile = path.join(dir, 'Plugins/.discovery-state.json');
  fs.writeFileSync(settingsFile, JSON.stringify(config));
  const state = { version: 1, plugins: Object.fromEntries(ids.map(name => [name, { pluginPath: 'Plugins/' + name, fingerprint: 'fixture', version: '1.0.0', startupEnabled: name === 'skymp-ui-core', discoveredAt: '2026-10-28', updatedAt: '2026-10-28' }])) };
  fs.writeFileSync(stateFile, JSON.stringify(state));
  for (const name of ids) {
    const plugin = path.join(dir, 'Plugins', name); fs.mkdirSync(plugin);
    fs.writeFileSync(path.join(plugin, 'plugin.json'), JSON.stringify({ name, version: '1.0.0', kind: 'gamemode' }));
    fs.writeFileSync(path.join(plugin, 'index.cjs'), "throw Error('Listing/reordering must never execute a plugin');");
  }
  const settings = { ...config, allSettings: config }; api.adminAuthParse(settings);
  const app = api.createApp(settings, () => listener.address().port); listener = http.createServer(app.callback());
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve)); const base = `http://127.0.0.1:${listener.address().port}`;
  const authorization = 'Basic ' + Buffer.from(`owner:${config.adminUiAuth.password}`).toString('base64');
  const request = (init = {}) => fetch(base + '/api/admin/plugins/load-order', { ...init, headers: { authorization, ...init.headers } });
  const put = (body, headers = {}) => ({ method: 'PUT', headers: { 'Content-Type': 'application/json', origin: base, ...headers }, body: JSON.stringify(body) });
  let response = await request(); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const initial = await response.json(); assert.deepEqual(initial.order, ids); assert.deepEqual(initial.pluginsLoadOrder, []);
  assert(!JSON.stringify(initial).includes(config.masterKey)); checks.push('Empty preference exposes the actual alphabetical boot order without executing plugins or disclosing settings');
  const order = ['skymp-ui-core', 'skymp-chat', 'example-ui-consumer', 'second-ui-consumer'];
  const external = { ...config, externallyEdited: { keep: 'disk-value' } }; fs.writeFileSync(settingsFile, JSON.stringify(external));
  const stateBefore = fs.readFileSync(stateFile, 'utf8');
  response = await request(put({ revision: initial.revision, pluginsLoadOrder: order })); assert.equal(response.status, 200);
  let saved = await response.json(); assert.equal(saved.restartRequired, true); assert.deepEqual(saved.order, order);
  assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile)), { ...external, pluginsLoadOrder: order }); assert.equal(fs.readFileSync(stateFile, 'utf8'), stateBefore);
  assert.deepEqual((await (await request()).json()).order, order);
  checks.push('Order persists and reloads, preserving private/external settings, mod order, activation flags and discovery state');
  const written = fs.readFileSync(settingsFile, 'utf8');
  assert.equal((await request(put({ revision: initial.revision, pluginsLoadOrder: order.slice().reverse() }))).status, 409);
  for (const invalid of [order.slice(1), [...order, 'unknown-plugin'], [...order.slice(1), order[1]], ['../escape', ...order.slice(1)], Array(513).fill('x'), null])
    assert.equal((await request(put({ revision: saved.revision, pluginsLoadOrder: invalid }))).status, 400);
  assert.equal((await request(put({ revision: saved.revision, pluginsLoadOrder: order, role: 'admin' }))).status, 400);
  assert.equal(fs.readFileSync(settingsFile, 'utf8'), written); checks.push('Stale, incomplete, duplicate, excessive, unknown and malformed orders cannot overwrite settings');
  assert.equal((await request({ headers: { authorization: '' } })).status, 401);
  assert.equal((await request(put({ revision: saved.revision, pluginsLoadOrder: order }, { authorization: '' }))).status, 401);
  assert.equal((await request(put({ revision: saved.revision, pluginsLoadOrder: order }, { origin: 'https://untrusted.invalid' }))).status, 403);
  settings.allSettings.adminUiCapabilities = { canViewLogs: true, canConsole: false };
  assert.equal((await request()).status, 200); assert.equal((await request(put({ revision: saved.revision, pluginsLoadOrder: order }))).status, 403);
  settings.allSettings.adminUiCapabilities.canViewLogs = false; assert.equal((await request()).status, 403);
  settings.allSettings.adminUiCapabilities = { canViewLogs: true, canConsole: true };
  assert.equal(fs.readFileSync(settingsFile, 'utf8'), written); checks.push('Read/edit capabilities, authentication and same-origin protection are enforced');
  const oldRevision = saved.revision; state.plugins['new-plugin'] = { ...state.plugins['skymp-ui-core'], pluginPath: 'Plugins/new-plugin' }; fs.writeFileSync(stateFile, JSON.stringify(state));
  assert.equal((await request(put({ revision: oldRevision, pluginsLoadOrder: order }))).status, 409);
  saved = await (await request()).json(); assert.deepEqual(saved.order, [...order, 'new-plugin']); checks.push('Discovery changes invalidate old edits; newly discovered IDs follow configured plugins');
  const pending = JSON.parse(fs.readFileSync(settingsFile)); pending.pluginsLoadOrder = ['not-installed', ...order]; fs.writeFileSync(settingsFile, JSON.stringify(pending));
  saved = await (await request()).json(); assert.deepEqual(saved.order, ['not-installed', ...order, 'new-plugin']);
  response = await request(put({ revision: saved.revision, pluginsLoadOrder: saved.order })); assert.equal(response.status, 200); saved = await response.json();
  assert.equal(JSON.parse(fs.readFileSync(settingsFile)).pluginsLoadOrder[0], 'not-installed'); checks.push('Configured missing IDs remain editable and survive saves');
  const indexFile = path.join(serverRoot, 'ts/index.ts'), index = ts.createSourceFile(indexFile, fs.readFileSync(indexFile, 'utf8'), ts.ScriptTarget.Latest, true);
  const node = index.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(index) === 'buildPluginSortOrder'));
  assert(node); const code = ts.transpileModule(node.getText(index), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  const sort = new Function(code + '\nreturn buildPluginSortOrder;')();
  const present = [...ids, 'new-plugin', 'later-z', 'later-a'].map(name => ({ manifest: { name } }));
  assert.deepEqual(sort(present, saved.order).map(p => p.manifest.name), [...order, 'new-plugin', 'later-a', 'later-z']);
  checks.push('The unchanged real game bootstrap sorter consumes the persisted API order with UI Core before both consumers');
  fs.writeFileSync(settingsFile, '{broken JSON'); assert.equal((await request()).status, 503);
  assert.equal((await request(put({ revision: saved.revision, pluginsLoadOrder: saved.order }))).status, 503);
  assert.equal(fs.readFileSync(settingsFile, 'utf8'), '{broken JSON'); checks.push('Damaged settings fail closed without rewriting the file');
  const report = { passed: true, checks, skyrimStarted: false };
  if (process.env.SKYMP_PLUGIN_ORDER_REPORT) fs.writeFileSync(process.env.SKYMP_PLUGIN_ORDER_REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  esbuild.stop(); if (listener?.listening) await new Promise(resolve => listener.close(resolve)); process.chdir(previous);
  assert.equal(path.dirname(dir), path.resolve(os.tmpdir())); assert(path.basename(dir).startsWith('skymp-plugin-order-')); fs.rmSync(dir, { recursive: true, force: true });
}
