// Local renderer fixture only; production still mounts through the shared Runtime host.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), esbuild = require('esbuild');
const { fixture } = require('../tests/helpers.cjs');
const { panelState, registerPanel } = require('../tests/framework-fixtures.cjs');
const { nativeHarness } = require('../tests/native-harness.cjs');
const root = path.resolve(__dirname, '..');
module.exports = async function startFixture() {
  const f = fixture(), clients = [], calls = [], errors = [];
  let closing = false;
  const fork = process.env.SKYMP_FORK || path.resolve(root, '../skymp');
  const reactDom = require.resolve('react-dom/client', { paths: [path.join(fork, 'skymp5-front')] });
  const built = esbuild.buildSync({ stdin: { contents: `import React from 'react'; import {createRoot} from ${JSON.stringify(reactDom)}; import {UiCoreHost} from './client/host'; createRoot(document.getElementById('fixture')).render(React.createElement(UiCoreHost));`, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', alias: { react: require.resolve('react') }, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' }).outputFiles[0].text;
  const html = '<!doctype html><html lang="de"><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><body style="margin:0;background:linear-gradient(135deg,#263535,#0a101a);min-height:100vh"><div id="fixture"></div><script src="/fixture.js"></script></body></html>';
  const server = http.createServer((req, res) => {
    const item = req.url === '/' ? ['text/html', html] : req.url === '/fixture.js' ? ['text/javascript', built] : req.url === '/style.css' ? ['text/css', fs.readFileSync(path.join(root, 'client/style.css'))] : null;
    if (!item) { res.writeHead(404); res.end(); return; } res.setHeader('Content-Type', item[0]); res.end(item[1]);
  });
  f.api.registerWidget({ id: 'skymp-metabolism:status', owner: 'skymp-metabolism', kind: 'icon-list', schemaVersion: 1, defaultPosition: 'bottom-left' });
  f.api.registerWidget({ id: 'skymp-yaca-ts:voice-range', owner: 'skymp-yaca-ts', kind: 'status', schemaVersion: 1, defaultPosition: 'bottom-right' });
  for (const userId of [0, 1]) {
    f.api.updateWidget({ userId }, 'skymp-metabolism:status', { schemaVersion: 1, items: [{ label: 'Sättigung', value: '85,3/100 · Gut' }, { label: 'Flüssigkeit', value: '62,1/100 · Gut' }, { label: 'Erholung', value: '23,5/100 · Kritisch' }] });
    f.api.updateWidget({ userId }, 'skymp-yaca-ts:voice-range', { schemaVersion: 1, label: 'Stimme', value: '8/40 m', text: 'Mikrofon aktiv' });
  }
  for (const [owner, priority] of [['alpha', 10], ['beta', 50]]) {
    const id = owner + ':panel';
    registerPanel(f, id, ctx => { calls.push(ctx); f.api.closeMenu({ userId: ctx.userId }, id); }, () => true, priority);
    f.api.framework.registerInteraction({ owner, id: owner + ':inspect', schemaVersion: 1, label: owner + ' inspect', kinds: ['npc'] }, ctx => calls.push(ctx), { authorize: () => true });
  }
  const originalSend = f.mp.sendCustomPacket;
  f.mp.sendCustomPacket = (id, raw) => { originalSend(id, raw); clients.find(c => c.userId === id)?.native.receive(JSON.parse(raw)); };
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const tick = setInterval(() => f.flush(), 100);
  return { f, url, calls, errors, clients,
    openPanel(owner, userId = 0) { f.api.openMenu({ userId }, owner + ':panel', panelState()); f.flush(); },
    async attach(page, userId) {
      const native = nativeHarness(f, userId), entry = { userId, page, native, evaluations: Promise.resolve() }; clients.push(entry);
      native.setExecute(code => { entry.evaluations = entry.evaluations.then(() => closing ? undefined : page.evaluate(code)).catch(e => { if (!closing) errors.push(String(e)); }); });
      const execute = code => { entry.evaluations = entry.evaluations.then(() => closing ? undefined : page.evaluate(code)).catch(e => { if (!closing) errors.push(String(e)); }); };
      native.setFocusHandler(focused => execute(`window.dispatchEvent(new Event('${focused ? 'skymp5-client:browserFocused' : 'skymp5-client:browserUnfocused'}'))`));
      await page.exposeFunction('fixtureNativeSend', (type, data) => native.front(type, data));
      await page.addInitScript(() => { window.skyrimPlatform = { sendMessage: (type, data) => window.fixtureNativeSend(type, data) }; });
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url); native.emitter.emit('connectionAccepted'); native.emitter.emit('createActorMessage', { message: { isMe: true } });
      await page.waitForSelector('[data-element-key="skymp-yaca-ts:voice-range"]');
      return entry;
    },
    async settle() { await Promise.all(clients.map(c => c.evaluations)); },
    async close() { closing = true; clearInterval(tick); f.runtime.stop(); await new Promise(resolve => server.close(resolve)); },
  };
};
