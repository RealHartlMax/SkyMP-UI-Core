const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), fork = path.resolve(process.env.SKYMP_FORK || path.join(root, '../skymp'));
async function runPluginOrderBrowser(chromium) {
  const esbuild = require(path.join(fork, 'skymp5-server/node_modules/esbuild'));
  const dir = fs.mkdtempSync(path.join(root, 'artifacts/order-browser-')), previous = process.cwd(), errors = [], checks = [];
  let server, browser, page;
  const pass = name => { checks.push(name); console.log('[plugin-order-browser] ' + name); };
  try {
    const serverRoot = path.join(fork, 'skymp5-server'), bundle = path.join(dir, 'dashboard.cjs');
    await esbuild.build({ stdin: { contents: "export {createApp,adminAuthParse} from './ts/ui';", resolveDir: serverRoot, loader: 'ts' }, outfile: bundle, absWorkingDir: serverRoot,
      bundle: true, platform: 'node', target: 'es2022', logLevel: 'silent', alias: { '@opentelemetry/api': './ts/shims/opentelemetry-api.js' },
      plugins: [{ name: 'fixture-router-exports', setup(build) { build.onLoad({ filter: /[\\/]ts[\\/]ui\.ts$/ }, args => ({ contents: fs.readFileSync(args.path, 'utf8') + '\nexport {createApp,adminAuthParse};', loader: 'ts' })); } }] });
    esbuild.stop(); process.chdir(dir);
    const frontend = path.join(root, 'artifacts/plugin-order-frontend'); fs.cpSync(frontend, path.join(dir, 'ui'), { recursive: true });
    const ids = ['example-ui-consumer', 'second-ui-consumer', 'skymp-chat', 'skymp-ui-core'];
    const config = { name: 'Plugin load order acceptance', port: 7777, maxPlayers: 8, loadOrder: ['Skyrim.esm'], pluginsLoadOrder: [], dataDir: path.join(dir, 'data'),
      offlineMode: true, adminApi: { enabled: true }, adminUiAuth: { user: 'owner', password: crypto.randomBytes(24).toString('hex') },
      adminUiUsers: { owner: { role: 'admin' } }, pluginDiscovery: { mode: 'safe' }, fixturePrivate: { preserved: true } };
    fs.mkdirSync(config.dataDir); fs.mkdirSync(path.join(dir, 'Plugins'));
    const settingsFile = path.join(dir, 'server-settings.json'), stateFile = path.join(dir, 'Plugins/.discovery-state.json');
    fs.writeFileSync(settingsFile, JSON.stringify(config));
    const state = { version: 1, plugins: Object.fromEntries(ids.map(name => [name, { pluginPath: 'Plugins/' + name, fingerprint: 'fixture', version: '1.0.0', startupEnabled: true, discoveredAt: '2026-10-28', updatedAt: '2026-10-28' }])) };
    fs.writeFileSync(stateFile, JSON.stringify(state));
    for (const name of ids) { const directory = path.join(dir, 'Plugins', name); fs.mkdirSync(directory); fs.writeFileSync(path.join(directory, 'plugin.json'), JSON.stringify({ name, version: '1.0.0', kind: 'gamemode' })); }
    const api = require(bundle), settings = { ...config, allSettings: config }; api.adminAuthParse(settings);
    const app = api.createApp(settings, () => server.address().port); server = http.createServer(app.callback());
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const base = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: false }); const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, locale: 'de-DE' });
    const login = await context.request.post(base + '/api/admin/session/login', { data: config.adminUiAuth }); assert.equal(login.status(), 200);
    page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    const open = async () => {
      await page.goto(base + '/?admin=1');
      await page.locator('#admin-tab-resources').click();
      await page.getByTestId('resource-tab-plugins').click();
      await page.locator('[data-testid="server-plugins"] [data-plugin="skymp-ui-core"]').waitFor();
    };
    await open(); const panel = page.getByTestId('server-plugins');
    const names = () => panel.locator('li[data-plugin]').evaluateAll(rows => rows.map(row => row.getAttribute('data-plugin')));
    assert.deepEqual(await names(), ids);
    for (let i = 0; i < 3; i++) await panel.getByRole('button', { name: 'Nach oben: skymp-ui-core', exact: true }).click();
    const save = async expectedStatus => {
      const response = page.waitForResponse(r => r.url().endsWith('/api/admin/plugins/load-order') && r.request().method() === 'PUT');
      await panel.getByRole('button', { name: 'Ladereihenfolge speichern', exact: true }).click(); assert.equal((await response).status(), expectedStatus);
    };
    await save(200); const expected = ['skymp-ui-core', ...ids.slice(0, 3)];
    assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile)).pluginsLoadOrder, expected);
    assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile)).fixturePrivate, { preserved: true });
    assert.deepEqual(JSON.parse(fs.readFileSync(stateFile)), state);
    await open(); assert.deepEqual(await names(), expected); pass('Real authenticated dashboard moves UI Core first, saves only plugin order and reloads the persisted sequence');
    await panel.getByRole('searchbox').fill('skymp-ui-core');
    await panel.getByRole('button', { name: 'Nach unten: skymp-ui-core', exact: true }).click(); await save(200);
    const filteredOrder = [expected[1], expected[0], ...expected.slice(2)]; assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile)).pluginsLoadOrder, filteredOrder);
    await panel.getByRole('searchbox').fill(''); assert.deepEqual(await names(), filteredOrder); pass('Moving through a search filter preserves every hidden plugin in the full saved order');
    await panel.getByRole('button', { name: 'Nach oben: skymp-ui-core', exact: true }).click();
    const current = await (await context.request.get(base + '/api/admin/plugins/load-order')).json();
    const externalOrder = current.order.slice().reverse();
    assert.equal((await context.request.put(base + '/api/admin/plugins/load-order', { data: { revision: current.revision, pluginsLoadOrder: externalOrder }, headers: { origin: base } })).status(), 200);
    await save(409); await panel.getByRole('alert').filter({ hasText: 'inzwischen geändert' }).waitFor();
    await panel.getByRole('button', { name: 'Änderungen verwerfen', exact: true }).click();
    await page.waitForFunction(expected => JSON.stringify([...document.querySelectorAll('[data-testid="server-plugins"] li[data-plugin]')].map(e => e.getAttribute('data-plugin'))) === JSON.stringify(expected), externalOrder);
    pass('Concurrent edits produce a conflict; discard reloads the newer server order without overwriting it');
    const fresh = await (await context.request.get(base + '/api/admin/plugins/load-order')).json();
    const finalOrder = ['skymp-ui-core', 'skymp-chat', 'example-ui-consumer', 'second-ui-consumer'];
    assert.equal((await context.request.put(base + '/api/admin/plugins/load-order', { data: { revision: fresh.revision, pluginsLoadOrder: finalOrder }, headers: { origin: base } })).status(), 200);
    await open(); await panel.screenshot({ path: path.join(root, 'artifacts/plugin-load-order-desktop.png') });
    await page.setViewportSize({ width: 760, height: 1000 });
    assert(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 2)); pass('Order controls fit the narrower resource panel without horizontal overflow');
    settings.allSettings.adminUiCapabilities = { canViewLogs: true, canConsole: false };
    await open(); assert(await panel.locator('[data-order-move]').evaluateAll(buttons => buttons.length > 0 && buttons.every(button => button.disabled)));
    pass('Read-only dashboard sessions show the sequence with all move controls disabled');
    assert.deepEqual(errors, []);
    const hash = filename => crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
    const report = { passed: true, checks, browserErrors: errors, productionBuild: true, authenticatedSession: true,
      frontendSHA256: hash(path.join(frontend, 'build.js')), skyrimStarted: false, fixtureSettingsOnly: true };
    fs.writeFileSync(path.join(root, 'artifacts/plugin-load-order-browser.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); return report;
  } catch (error) {
    if (page) { await page.screenshot({ path: path.join(root, 'artifacts/plugin-load-order-failure.png'), fullPage: true }).catch(() => {}); console.log(JSON.stringify({ title: await page.title().catch(() => ''), buttons: await page.getByRole('button').allTextContents().catch(() => []), errors, completed: checks })); }
    throw error;
  } finally { esbuild.stop(); await browser?.close(); if (server?.listening) await new Promise(resolve => server.close(resolve)); process.chdir(previous); }
}
module.exports = { runPluginOrderBrowser };
