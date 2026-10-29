// Production frontend + real Scamp bots + real BrowserService/ChatBridge/UiCoreBridge.
// SkyrimPlatform browser callbacks and menu/key events are supplied by the harness.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { loader, installFixture, nativeServer, root, fork } = require('./verify-fork.cjs');
async function runBrowserChecks(chromium) {
  const dir = installFixture(), previous = process.cwd(), clients = [], users = [], actors = [], errors = [], checks = [], packets = [];
  let browser, server, tick, runtime, chat, metabolismUi, mp, closing = false;
  const confirm = description => { checks.push(description); console.log('[browser] ' + description); };
  const waitFocus = async (client, expected) => {
    const deadline = Date.now() + 3000;
    while (client.native.focused !== expected && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(client.native.focused, expected, 'Native focus must reach its expected state');
  };
  try {
    process.chdir(dir); mp = nativeServer(); mp.on('connect', id => users.push(id)); globalThis.mp = mp;
    const l = loader([]), options = { mode: 'auto', loadOrder: ['skymp-ui-core', 'example-ui-consumer', 'second-ui-consumer'], abortOnPluginError: true, processCommandAllowlist: [] };
    await l.bootstrapPlugins(mp, options); runtime = globalThis[Symbol.for('skymp-ui-core.runtime.v1')];
    // Load the existing standalone chat unchanged in this disposable game process.
    require(path.resolve(process.env.SKYMP_CHAT || path.join(root, '../SkyMP-Chat'), 'Plugins/SkyMPChat/index.cjs'));
    chat = globalThis[Symbol.for('skymp-chat.runtime.v1')].runtime;
    globalThis.skympChat.registerCommand({ owner: 'ui-acceptance', name: 'uiping', description: 'UI acceptance interop', execute: ctx => ctx.reply('UI Pong!') });
    const originalSend = mp.sendCustomPacket.bind(mp);
    Object.defineProperty(mp, 'sendCustomPacket', { value: (userId, raw) => {
      const p = JSON.parse(raw); packets.push({ userId, ...p }); originalSend(userId, raw);
      clients.find(c => c.userId === userId)?.native.receive(p);
    } });
    const frontend = path.join(fork, 'skymp5-front/dist');
    assert(fs.readFileSync(path.join(frontend, 'build.js'), 'utf8').includes('data-ui-protocol'), 'Build the integrated production frontend');
    server = http.createServer((req, res) => {
      const name = decodeURIComponent(req.url.split('?')[0]); const file = path.resolve(frontend, '.' + (name === '/' ? '/index.html' : name));
      if (!file.startsWith(frontend + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
      const ext = path.extname(file); res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' })[ext] || 'application/octet-stream');
      fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const url = `http://127.0.0.1:${server.address().port}/`;
    browser = await chromium.launch({ headless: false });
    const { clientHarness } = require(path.join(fork, 'skymp5-client/tests/helpers/chatHarness.cjs'));
    for (let i = 0; i < 2; i++) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await context.newPage();
      const entry = { context, page, bot: mp.createBot(), userId: null, native: null, requests: [], evaluations: Promise.resolve() };
      mp.tick(); entry.userId = users.at(-1);
      const actor = mp.createActor(0, [i, 0, 0], 0, 0x3c); actors.push(actor); mp.setUserActor(entry.userId, actor);
      entry.native = clientHarness((packet, reliability) => {
        assert.equal(reliability, 'reliable'); entry.requests.push(packet);
        entry.bot.send({ t: 1, contentJsonDump: JSON.stringify(packet) }); mp.tick();
      });
      entry.native.setExecute(code => { entry.evaluations = entry.evaluations.then(() => closing ? undefined : page.evaluate(code)).catch(e => { if (!closing) errors.push(String(e)); }); });
      page.on('pageerror', e => errors.push(e.message));
      await page.exposeFunction('__uiNativeMessage', args => entry.native.front(...args));
      await page.addInitScript(() => { window.skyrimPlatform = { sendMessage: (...args) => { window.__uiNativeMessage(args); } }; });
      clients.push(entry); await page.goto(url); entry.native.join(); entry.native.update();
      await page.locator('[data-widget-id="example:status"]').waitFor();
      await page.getByRole('button', { name: 'Bestätigen / Confirm', exact: true }).waitFor();
    }
    tick = setInterval(() => { mp.tick(); for (const c of clients) c.native.update(); }, 20);
    const [a, b] = clients;
    await a.page.screenshot({ path: path.join(root, 'artifacts/ui-core-menu.png'), fullPage: true });
    confirm('Two production-root browsers show widgets from two independent plugins without dev/admin flags');
    assert(clients.every(c => c.native.focused));
    await a.page.getByRole('button', { name: 'Bestätigen / Confirm', exact: true }).click();
    await a.page.locator('[data-widget-id="example:status"] .ui-value').filter({ hasText: /^1$/ }).waitFor();
    await a.page.locator('.ui-menu').waitFor({ state: 'detached' }); await waitFocus(a, false);
    assert.equal(await b.page.locator('[data-widget-id="example:status"] .ui-value').innerText(), '0');
    assert.equal(await b.page.locator('.ui-menu').count(), 1);
    const request = a.requests.find(p => p.customPacketType === 'skympUi:action' && p.actionId === 'confirm');
    a.bot.send({ t: 1, contentJsonDump: JSON.stringify(request) }); mp.tick(); await a.evaluations;
    assert.equal(await a.page.locator('[data-widget-id="example:status"] .ui-value').innerText(), '1');
    confirm('CEF click crosses both real bridges and native ingress; authorized handler runs once and private state stays on A');
    globalThis.skympUi.registerWidget({ id: 'audit:private', owner: 'audit', kind: 'text', schemaVersion: 1 });
    globalThis.skympUi.updateWidget({ userId: a.userId }, 'audit:private', { schemaVersion: 1, label: 'Private A', text: '<img src=x onerror="window.__uiXss=1">', value: 17 }); runtime.flush();
    await a.page.getByText('<img src=x onerror="window.__uiXss=1">', { exact: true }).waitFor();
    assert.equal(await a.page.locator('[data-widget-id="audit:private"] img').count(), 0); assert.equal(await a.page.evaluate(() => window.__uiXss), undefined);
    assert.equal(await b.page.locator('[data-widget-id="audit:private"]').count(), 0);
    await a.page.reload(); await a.page.locator('[data-widget-id="audit:private"]').waitFor();
    assert.equal(await a.page.locator('[data-widget-id="audit:private"] .ui-value').innerText(), '17');
    confirm('Injection is rendered as text; CEF reload receives the current private snapshot');
    await b.page.getByRole('button', { name: 'Darstellung', exact: true }).click();
    await b.page.getByLabel('UI-Skalierung').focus(); await b.page.keyboard.press('End');
    assert.equal(await b.page.getByLabel('UI-Skalierung').inputValue(), '150'); assert.equal(b.native.focused, true);
    await b.page.getByLabel('Sprache / Language').selectOption('en');
    await b.page.getByRole('button', { name: 'Save & close', exact: true }).click();
    assert.equal(b.native.focused, true);
    confirm('Editor preferences scale to 150%, switch DE/EN and preserve modal focus');
    await b.page.getByRole('button', { name: 'Display', exact: true }).click();
    await b.page.evaluate(() => { window.dispatchEvent(new Event('skympUi:dismiss')); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    await b.page.locator('.ui-editor-panel').waitFor({ state: 'detached' }); assert.equal(await b.page.locator('.ui-menu').count(), 1);
    confirm('Duplicate native/DOM Escape closes only the editor and preserves the underlying plugin menu');
    for (const name of [a.native.enums.Menu.Inventory, a.native.enums.Menu.Map, a.native.enums.Menu.Console, a.native.enums.Menu.Dialogue, a.native.enums.Menu.Loading]) {
      a.native.menus.add(name); a.native.native.emit('menuOpen', { name }); await a.evaluations;
      await waitFocus(a, false); await a.page.locator('.skymp-ui-core').waitFor({ state: 'detached' });
      a.native.menus.delete(name); a.native.native.emit('menuClose', { name }); await a.page.locator('.ui-menu').waitFor();
      await a.page.waitForFunction(() => document.activeElement?.closest('.ui-menu') !== null); await waitFocus(a, true);
    }
    confirm('Inventory, map, console, dialogue and loading suspend UI, release native focus and restore the active modal');
    for (const c of clients) { c.native.press(c.native.enums.DxScanCode.Escape); c.native.release(c.native.enums.DxScanCode.Escape); }
    await Promise.all(clients.map(c => c.page.locator('.ui-menu').waitFor({ state: 'detached' })));
    for (const c of clients) { c.native.press(c.native.enums.DxScanCode.Enter); c.native.release(c.native.enums.DxScanCode.Enter); await c.page.locator('#chatInput').waitFor(); }
    await a.page.locator('#chatInput').fill('Hallo UI Core'); await a.page.locator('#chatInput').press('Enter');
    for (const c of clients) await c.page.locator('#chat .msg span').filter({ hasText: /^Hallo UI Core$/ }).waitFor();
    await a.page.locator('#chatInput').fill('/uiping'); await a.page.locator('#chatInput').press('Enter');
    await a.page.getByText('UI Pong!', { exact: true }).waitFor(); assert.equal(await b.page.getByText('UI Pong!', { exact: true }).count(), 0);
    confirm('Unchanged standalone Chat: Enter opens, A/B receive one message and a foreign command reply remains private');
    for (const c of clients) { c.native.press(c.native.enums.DxScanCode.Escape); c.native.release(c.native.enums.DxScanCode.Escape); await c.evaluations; assert.equal(c.native.focused, false); }
    // The actual unchanged Metabolism adapter feeds the generic icon-list contract.
    const metabolism = require(path.resolve(process.env.SKYMP_METABOLISM || path.join(root, '../SkyMP-Metabolism'), 'dist/library.cjs'));
    const metabolismConfig = metabolism.readConfig({});
    metabolismUi = new metabolism.UiAdapter(() => globalThis.skympUi, metabolismConfig, metabolism.createLocalizer('de'), { now: Date.now, wallNow: Date.now }, console);
    metabolismUi.register();
    const supplies = { schemaVersion: 1, characterId: 'session:ui-editor-acceptance', revision: 1, satiety: 85.3, hydration: 62.1, rest: 23.5 };
    metabolismUi.update(a.userId, supplies, true); runtime.flush();
    const item = index => a.page.locator('[data-element-key="skymp-metabolism:status#' + index + '"]');
    await item(0).waitFor(); assert.equal(await a.page.locator('[data-widget-id="skymp-metabolism:status"]').count(), 3);
    assert.equal(await b.page.locator('[data-widget-id="skymp-metabolism:status"]').count(), 0);
    assert.equal(await item(0).locator('progress').getAttribute('value'), '85.3');
    await a.page.screenshot({ path: path.join(root, 'artifacts/uiedit-hud.png'), fullPage: true });
    confirm('Unchanged real Metabolism adapter renders three separate server-owned rune meters only on the intended player');
    let lastUiCommand = 0;
    const openEditor = async () => {
      const delay = 2100 - (Date.now() - lastUiCommand); if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay)); lastUiCommand = Date.now();
      a.native.press(a.native.enums.DxScanCode.Enter); a.native.release(a.native.enums.DxScanCode.Enter);
      await a.page.locator('#chatInput').waitFor(); await a.page.locator('#chatInput').fill('/UiEdit'); await a.page.locator('#chatInput').press('Enter');
      await a.page.getByRole('dialog', { name: 'UI bearbeiten', exact: true }).waitFor();
      await waitFocus(a, true); assert.equal(await a.page.locator('#chatInput').count(), 0);
      assert.equal(await b.page.locator('.ui-editor-panel').count(), 0);
    };
    const drag = async (locator, dx, dy) => {
      const rect = await locator.boundingBox(); await a.page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await a.page.mouse.down(); await a.page.mouse.move(rect.x + rect.width / 2 + dx, rect.y + rect.height / 2 + dy, { steps: 12 }); await a.page.mouse.up();
    };
    const nativeActionsBefore = a.requests.filter(p => p.customPacketType === 'skympUi:action').length;
    await openEditor();
    const untouched = await item(1).boundingBox(), original = await item(0).boundingBox();
    await drag(item(0), 320, -220); const moved = await item(0).boundingBox(); assert(Math.abs(moved.x - original.x - 320) < 2); assert(Math.abs(moved.y - original.y + 220) < 2);
    const handle = item(0).locator('[data-resize]'), grip = await handle.boundingBox();
    await a.page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await a.page.mouse.down(); await a.page.mouse.move(grip.x + grip.width / 2 + 20, grip.y + grip.height / 2 + 30, { steps: 8 }); await a.page.mouse.up();
    assert((await item(0).boundingBox()).width > moved.width);
    await a.page.getByLabel('Elementgröße', { exact: true }).focus(); await a.page.keyboard.press('End');
    assert.equal(await a.page.getByLabel('Elementgröße', { exact: true }).inputValue(), '150');
    const after = await item(1).boundingBox(); assert(Math.abs(after.x - untouched.x) < 1); assert(Math.abs(after.width - untouched.width) < 1);
    await item(0).focus(); const beforeArrow = await item(0).boundingBox(); await a.page.keyboard.press('Shift+ArrowRight'); assert(Math.abs((await item(0).boundingBox()).x - beforeArrow.x - 10) < 2);
    const saveButton = await a.page.getByRole('button', { name: 'Speichern & schließen', exact: true }).boundingBox(); assert(saveButton && saveButton.y + saveButton.height <= 900);
    await a.page.screenshot({ path: path.join(root, 'artifacts/uiedit-editor.png'), fullPage: true });
    a.native.menus.add(a.native.enums.Menu.Inventory); a.native.native.emit('menuOpen', { name: a.native.enums.Menu.Inventory });
    await a.page.locator('.skymp-ui-core').waitFor({ state: 'detached' }); await waitFocus(a, false);
    a.native.menus.delete(a.native.enums.Menu.Inventory); a.native.native.emit('menuClose', { name: a.native.enums.Menu.Inventory });
    await a.page.locator('.ui-editor-panel').waitFor(); await waitFocus(a, true);
    await a.page.getByRole('button', { name: 'Speichern & schließen', exact: true }).click(); await a.page.locator('.ui-editor-panel').waitFor({ state: 'detached' });
    await waitFocus(a, false); const savedRect = await item(0).boundingBox();
    assert.equal(a.requests.filter(p => p.customPacketType === 'skympUi:action').length, nativeActionsBefore);
    const savedLayout = await a.page.evaluate(() => Object.entries(localStorage).find(([key]) => key.startsWith('skymp-ui.v1.'))?.[1]); assert(savedLayout && JSON.parse(savedLayout).widgets['skymp-metabolism:status#0'].scale === 150);
    confirm('/UiEdit crosses unchanged Chat parser, real native bridges and the server; independent drag/resize/keyboard edits stay local and inventory restores editor focus');
    await openEditor(); await drag(item(0), 80, -40); await a.page.keyboard.press('Escape');
    await a.page.locator('.ui-editor-panel').waitFor({ state: 'detached' }); await waitFocus(a, false);
    const cancelled = await item(0).boundingBox(); assert(Math.abs(cancelled.x - savedRect.x) < 1); assert(Math.abs(cancelled.y - savedRect.y) < 1);
    await a.page.reload(); await item(0).waitFor(); const reloaded = await item(0).boundingBox(); assert(Math.abs(reloaded.x - savedRect.x) < 1); assert(Math.abs(reloaded.width - savedRect.width) < 1);
    // The real example consumer reopens its menu in the first coalesced frame after Ready.
    await a.page.locator('.ui-menu').waitFor();
    a.native.press(a.native.enums.DxScanCode.Escape); a.native.release(a.native.enums.DxScanCode.Escape); await a.page.locator('.ui-menu').waitFor({ state: 'detached' }); await waitFocus(a, false);
    metabolismUi.update(a.userId, { ...supplies, revision: 2, satiety: 41.7 }, true); runtime.flush(); await item(0).locator('progress[value="41.7"]').waitFor({ state: 'attached' });
    for (const viewport of [{ width: 1024, height: 768 }, { width: 1920, height: 1080 }]) {
      await a.page.setViewportSize(viewport);
      await a.page.waitForFunction(() => [...document.querySelectorAll('.ui-layout-item')].every(element => { const rect = element.getBoundingClientRect(); return rect.left >= 15 && rect.top >= 15 && rect.right <= innerWidth - 15 && rect.bottom <= innerHeight - 15; }));
    }
    await a.page.screenshot({ path: path.join(root, 'artifacts/uiedit-hud-custom.png'), fullPage: true });
    confirm('Cancel restores the saved layout; reload and resolution changes preserve it; live server values still update the customized meter');
    await openEditor();
    await a.page.getByLabel('Element auswählen', { exact: true }).selectOption('skymp-metabolism:status#2');
    await a.page.getByLabel('Sichtbar', { exact: true }).uncheck();
    await a.page.getByRole('button', { name: 'Speichern & schließen', exact: true }).click(); await item(2).waitFor({ state: 'detached' }); await waitFocus(a, false);
    await openEditor(); await a.page.getByLabel('Element auswählen', { exact: true }).selectOption('skymp-metabolism:status#2');
    await a.page.getByRole('button', { name: 'Element zurücksetzen', exact: true }).click();
    assert.equal(await a.page.getByLabel('Sichtbar', { exact: true }).isChecked(), true);
    await a.page.getByRole('button', { name: 'Speichern & schließen', exact: true }).click(); await item(2).waitFor(); await waitFocus(a, false);
    confirm('Individual visibility and reset affect presentation only; editor save controls stay visible without scrolling');
    await openEditor(); a.native.emitter.emit('connectionDisconnect', {}); await a.page.locator('.skymp-ui-core').waitFor({ state: 'detached' }); await waitFocus(a, false);
    confirm('Disconnect while editing releases native focus and clears all private UI');
    // Continue F2/Enter and missing-plugin checks on player B after A disconnects.
    b.native.press(b.native.enums.DxScanCode.F2); b.native.release(b.native.enums.DxScanCode.F2); await b.page.locator('.skymp-ui-core').waitFor({ state: 'detached' });
    b.native.press(b.native.enums.DxScanCode.Enter); b.native.release(b.native.enums.DxScanCode.Enter); await b.page.locator('.skymp-ui-core').waitFor();
    assert.equal(b.native.focused, true);
    b.native.press(b.native.enums.DxScanCode.Escape); b.native.release(b.native.enums.DxScanCode.Escape); await b.evaluations;
    await a.page.screenshot({ path: path.join(root, 'artifacts/ui-core-desktop.png'), fullPage: true });
    await b.page.screenshot({ path: path.join(root, 'artifacts/ui-core-player-b.png'), fullPage: true });
    confirm('F2/Enter visibility continues working after independent editor changes');
    runtime.stop(); await b.page.locator('.skymp-ui-core').waitFor({ state: 'detached' });
    b.native.press(b.native.enums.DxScanCode.Enter); b.native.release(b.native.enums.DxScanCode.Enter); await b.page.locator('#chatInput').waitFor();
    await b.page.locator('#chatInput').fill('Chat remains available'); await b.page.locator('#chatInput').press('Enter');
    await b.page.getByText('Chat remains available', { exact: true }).waitFor();
    confirm('Unavailable UI Core clears its host while the unchanged Chat continues working');
    assert.deepEqual(errors, [], 'Production browser must have no page/bridge errors');
    const report = { passed: true, timestamp: new Date().toISOString(), url, productionRoot: true, nativeBots: 2,
      skyrimStarted: false, nativeBrowserApiSimulated: true, chatSourceChanged: false, checks, browserErrors: errors,
      frontendBytes: fs.statSync(path.join(frontend, 'build.js')).size, screenshots: ['uiedit-hud.png', 'uiedit-editor.png', 'uiedit-hud-custom.png', 'ui-core-player-b.png'], editorVersion: 1, metabolismAdapter: 'unchanged local UiAdapter' };
    const hashFile = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    report.pluginSHA256 = hashFile(path.join(root, 'release/SkyMPUICore/index.cjs'));
    report.frontendSHA256 = hashFile(path.join(frontend, 'build.js'));
    report.nativeBridgeSHA256 = hashFile(path.join(fork, 'skymp5-client/src/services/services/uiCoreBridge.ts'));
    fs.writeFileSync(path.join(root, 'artifacts/browser-validation.json'), JSON.stringify(report, null, 2) + '\n'); return report;
  } catch (error) {
    for (let i = 0; i < clients.length; i++) await clients[i].page.screenshot({ path: path.join(root, `artifacts/browser-failure-${i}.png`) }).catch(() => {});
    console.error(JSON.stringify({ browserErrors: errors, completed: checks, lastUiPackets: packets.filter(p => p.customPacketType.startsWith('skympUi:')).slice(-5).map(p => ({ userId: p.userId, type: p.customPacketType, code: p.code, sequence: p.sequence, widgets: p.widgets?.length })) }, null, 2));
    throw error;
  } finally {
    if (tick) clearInterval(tick); closing = true; metabolismUi?.unregister(); runtime?.stop(); chat?.stop();
    await Promise.all(clients.map(c => c.evaluations)); await browser?.close();
    for (const c of clients) c.bot.destroy(); for (const actor of actors) mp?.destroyActor(actor);
    if (server) await new Promise(resolve => server.close(resolve)); process.chdir(previous);
  }
}
module.exports = { runBrowserChecks };
