const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict'), { EventEmitter } = require('node:events');
const ts = require('typescript');
const root = path.resolve(__dirname, '..'), fork = path.resolve(process.env.SKYMP_FORK || path.join(root, '../skymp'));
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const transpile = src => ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
function loader(statuses) {
  const source = fs.readFileSync(path.join(fork, 'skymp5-server/ts/index.ts'), 'utf8');
  const ast = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
  const wanted = new Set(['pluginsLog', 'pluginsWarn', 'pluginsError', 'SAFE_PLUGIN_NAME_RE', 'SAFE_VERSION_RE',
    'toAbsolutePath', 'getAlternativeNtfsAliasPath', 'resolveExistingPath', 'sha256', 'ensureMainPath', 'isRelativePathSafe',
    'readPluginManifest', 'fingerprintPlugin', 'discoverPlugins', 'buildPluginSortOrder', 'requireTemp', 'runGamemodePlugin', 'bootstrapPlugins']);
  const selected = [];
  for (const node of ast.statements) {
    const declared = ts.isFunctionDeclaration(node) && node.name ? [node.name.text] : ts.isVariableStatement(node) ? node.declarationList.declarations.map(d => d.name.getText(ast)) : [];
    if (declared.some(name => wanted.has(name))) { selected.push(node.getFullText(ast)); declared.forEach(name => wanted.delete(name)); }
  }
  assert.equal(wanted.size, 0, 'Fork loader changed: ' + [...wanted]);
  const module = { exports: {} };
  new Function('require', 'module', 'exports', transpile(fs.readFileSync(path.join(fork, 'skymp5-server/ts/pluginDiscoveryState.ts'), 'utf8')))(require, module, module.exports);
  const state = module.exports;
  const publication = require('./load-fork-runtime.cjs')(fork, ts);
  const actual = new Function('fs', 'os', 'path', 'crypto', 'ui', 'readDiscoveryState', 'writeDiscoveryState', 'PLUGINS_DIR',
    'installShutdownHooks', 'askToEnablePlugin', 'runProcessPlugin', 'publishPluginRuntimeSelection', 'publishStartedPluginRuntime', 'validatePluginRuntime', 'require', transpile(selected.join('\n')) + '\nreturn {discoverPlugins,bootstrapPlugins: (server, options) => bootstrapPlugins(server, {dataDir: path.join(process.cwd(), "data"), ...options})};')(
    fs, os, path, crypto, { updatePluginRuntimeStatus: (name, status) => statuses.push({ name, status }) }, state.readDiscoveryState, state.writeDiscoveryState,
    state.PLUGINS_DIR, () => {}, () => { throw Error('Unexpected prompt'); }, () => { throw Error('Unexpected process plugin'); }, publication.publishPluginRuntimeSelection, publication.publishStartedPluginRuntime, publication.validatePluginRuntime, require);
  return { ...state, ...actual, sourceHash: digest(source) };
}
function installFixture() {
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true }); const dir = fs.mkdtempSync(path.join(root, 'artifacts/loader-'));
  for (const name of ['SkyMPUICore', 'ExampleUiConsumer', 'SecondUiConsumer']) {
    fs.mkdirSync(path.join(dir, 'Plugins', name), { recursive: true });
    for (const file of ['plugin.json', 'index.cjs']) fs.copyFileSync(path.join(root, 'release', name, file), path.join(dir, 'Plugins', name, file));
    if (name === 'SkyMPUICore') {
      fs.cpSync(path.join(root, 'release', name, 'Runtime'), path.join(dir, 'Plugins', name, 'Runtime'), { recursive: true });
      fs.copyFileSync(path.join(root, 'release', name, 'config.json'), path.join(dir, 'Plugins', name, 'config.json'));
      fs.cpSync(path.join(root, 'release', name, 'locales'), path.join(dir, 'Plugins', name, 'locales'), { recursive: true });
    }
  }
  return dir;
}
function nativeServer() {
  const nativeFork = path.resolve(process.env.SKYMP_NATIVE_FORK || fork);
  const { ScampServer } = require(path.join(nativeFork, 'build/dist/server/scam_native.node'));
  const mp = new ScampServer(JSON.stringify({ port: 0, listenHost: '127.0.0.1', maxPlayers: 4,
    dataDir: path.join(nativeFork, 'build/dist/server/data'), loadOrder: ['Skyrim.esm'], npcEnabled: false, itemsEnabled: false, logLevel: 'error' }));
  mp._setSelf(mp); return mp;
}
async function main() {
  const native = process.argv.includes('--native'), dir = installFixture(), previous = process.cwd(); process.chdir(dir);
  const output = [], statuses = [], users = [], bots = [], actors = [];
  let mp;
  if (native) {
    mp = nativeServer(); mp.on('connect', id => users.push(id));
    const send = mp.sendCustomPacket.bind(mp);
    Object.defineProperty(mp, 'sendCustomPacket', { value: (userId, raw) => { output.push({ userId, ...JSON.parse(raw) }); send(userId, raw); } });
  } else {
    mp = new EventEmitter(); mp.isConnected = id => [0, 1].includes(id); mp.getUserActor = id => id + 101;
    mp.getUserByActor = actor => actor - 101; mp.getUserGuid = id => 'native-guid-' + id;
    mp.sendCustomPacket = (userId, raw) => output.push({ userId, ...JSON.parse(raw) });
  }
  const l = loader(statuses), options = { mode: 'safe', loadOrder: ['skymp-ui-core', 'example-ui-consumer', 'second-ui-consumer'], abortOnPluginError: true, processCommandAllowlist: [] };
  globalThis.mp = mp; assert.equal(l.discoverPlugins().length, 3); await l.bootstrapPlugins(mp, options); assert.equal(globalThis.skympUi, undefined);
  const state = l.readDiscoveryState(); for (const value of Object.values(state.plugins)) { assert.equal(value.startupEnabled, false); value.startupEnabled = true; }
  l.writeDiscoveryState(state); await l.bootstrapPlugins(mp, options);
  const api = globalThis.skympUi; assert.equal(api?.getStatus().ready, true); assert.equal(api.apiVersion, 1);
  assert.equal(Object.getOwnPropertyDescriptor(globalThis, 'skympUi').writable, false); assert(Object.isFrozen(api));
  if (native) {
    for (let i = 0; i < 2; i++) bots.push(mp.createBot()); mp.tick(); assert.equal(users.length, 2);
    for (let i = 0; i < 2; i++) { const actor = mp.createActor(0, [i, 0, 0], 0, 0x3c); actors.push(actor); mp.setUserActor(users[i], actor); }
  } else users.push(0, 1);
  const ingress = (index, p) => { if (native) { bots[index].send({ t: 1, contentJsonDump: JSON.stringify(p) }); mp.tick(); } else mp.emit('customPacket', users[index], JSON.stringify(p)); };
  for (let i = 0; i < 2; i++) ingress(i, { customPacketType: 'skympUi:ready', protocolVersion: 1, frontId: 'document_' + i });
  const runtime = globalThis[Symbol.for('skymp-ui-core.runtime.v1')]; runtime.flush();
  if (!output.some(p => p.customPacketType === 'skympUi:update')) console.log(JSON.stringify({ diagnostic: 'No UI state frame', users: users.map(id => ({ userId: id, actorId: mp.getUserActor(id), connected: mp.isConnected(id), guidType: typeof mp.getUserGuid(id), guidLength: String(mp.getUserGuid(id)).length })), status: api.getStatus(), packetTypes: output.map(p => p.customPacketType) }));
  for (const userId of users) {
    const p = output.filter(p => p.userId === userId && p.customPacketType === 'skympUi:update').at(-1);
    assert.deepEqual(p.widgets.map(w => w.definition.owner).sort(), ['example', 'second-example']); assert.equal(p.menus.length, 1);
  }
  const snapshot = output.find(p => p.userId === users[0] && p.customPacketType === 'skympUi:snapshot');
  const request = { customPacketType: 'skympUi:action', protocolVersion: 1, widgetId: 'example:welcome', actionId: 'confirm', requestId: snapshot.sessionId + '_1', payload: {} };
  output.length = 0; ingress(0, request); ingress(0, request); await new Promise(setImmediate); runtime.flush();
  const a = output.filter(p => p.userId === users[0] && p.customPacketType === 'skympUi:update').at(-1);
  assert.equal(a.widgets.find(w => w.definition.id === 'example:status').state.value, 1); assert.equal(a.menus.length, 0); assert.equal(a.notifications.length, 1);
  assert.equal(output.filter(p => p.userId === users[1]).length, 0, 'Private UI change must not leak to B');
  const checks = ['actual manifest validator/discovery', 'new plugins disabled in safe mode', 'state activation and actual requireTemp',
    'standalone bundled entry without relative modules', 'read-only API shared with two independent consumer plugins',
    'per-user snapshots and private authorized action', 'duplicate request invokes consumer once'];
  if (native) checks.push('real Scamp native bots, authenticated native user/actor routing and reliable packet send');
  const report = { passed: true, nativeRuntime: native, skyrimStarted: false, fork, forkLoaderSHA256: l.sourceHash,
    pluginSHA256: digest(fs.readFileSync(path.join(root, 'release/SkyMPUICore/index.cjs'))), checks, statuses };
  runtime.stop(); bots.forEach(bot => bot.destroy()); actors.forEach(actor => mp.destroyActor(actor)); process.chdir(previous);
  fs.writeFileSync(path.join(root, native ? 'artifacts/native-validation.json' : 'artifacts/loader-validation.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
module.exports = { loader, installFixture, nativeServer, fork, root };
if (require.main === module) main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
