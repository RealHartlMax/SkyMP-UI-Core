const { test } = require('node:test'), assert = require('node:assert/strict');
const { fixture, widget, settled } = require('./helpers.cjs');
const { registerPanel, panelState } = require('./framework-fixtures.cjs');
const { nativeHarness } = require('./native-harness.cjs');
function wire(f, h) {
  const original = f.mp.sendCustomPacket;
  f.mp.sendCustomPacket = (id, raw) => { original(id, raw); h.receive(JSON.parse(raw)); };
}

test('plugin native bridge negotiates extensions after a legacy-shaped ready and delivers the current panel', t => {
  const f = fixture(); t.after(f.runtime.stop); registerPanel(f); f.api.openMenu({ userId: 0 }, 'alpha:panel', panelState());
  const h = nativeHarness(f); wire(f, h); h.join();
  const ready = h.sent.find(p => p.customPacketType === 'skympUi:ready');
  assert.equal('frameworkVersion' in ready, false); assert.equal(h.model.frame.menus[0].definition.id, 'alpha:panel');
  assert.deepEqual(f.api.framework.clientStatus({ userId: 0 }), { ready: true, frameworkVersion: 1 });
  assert.equal(h.sent.filter(p => p.customPacketType === 'skympUi:framework').length, 1);
  h.front('skympUi:focus', true); assert(h.focused);
  h.bridge.setAllowed(false); assert.equal(h.focused, false); assert.equal(h.model.allowed, false);
  assert.equal(h.model.action('alpha:panel', 'confirm', {}), false);
  h.bridge.setAllowed(true); assert.equal(h.model.visibleMenus().length, 1);
});

test('a server ignoring extension announcements still receives a strict V1 ready and displays legacy widgets', t => {
  const f = fixture(); t.after(f.runtime.stop); f.api.registerWidget(widget()); f.api.updateWidget({ userId: 0 }, 'alpha:status', { schemaVersion: 1, text: 'legacy' });
  const h = nativeHarness(f, 0, true); wire(f, h); h.join();
  assert.equal(h.model.frame.widgets[0].state.text, 'legacy'); assert.equal(h.bridge.isActive(), true);
  assert.equal(f.api.framework.clientStatus({ userId: 0 }).frameworkVersion, 0);
});

test('native/CEF dispatch escapes script text and panel dismissals carry the current revision', async t => {
  const f = fixture(); t.after(f.runtime.stop); registerPanel(f); const state = panelState();
  state.content.blocks[0].text = "</script>\u2028\u2029';window.injection=1;//";
  f.api.openMenu({ userId: 0 }, 'alpha:panel', state); const h = nativeHarness(f); wire(f, h); h.join();
  assert.equal(h.model.frame.menus[0].state.content.blocks[0].text, state.content.blocks[0].text);
  assert(h.scripts.filter(code => code.includes('detail:JSON.parse')).every(code => !code.includes('</script>') && !code.includes('\u2028') && !code.includes('\u2029')));
  const revision = h.model.frame.menus[0].revision; h.bridge.dismiss(); await settled(); f.flush();
  const close = h.sent.find(p => p.actionId === 'core.close'); assert.equal(close.payload.revision, revision); assert.equal(h.model.visibleMenus().length, 0);
});

test('native disconnect and a lost server heartbeat release focus, clear data and reject old snapshots', t => {
  const f = fixture(); t.after(f.runtime.stop); registerPanel(f); f.api.openMenu({ userId: 0 }, 'alpha:panel', panelState());
  const h = nativeHarness(f); wire(f, h); h.join(); h.front('skympUi:focus', true); const old = h.model.frame;
  h.emitter.emit('connectionDisconnect'); assert.equal(h.focused, false); assert.equal(h.model.frame, null); assert.equal(h.model.receive(old), false);
  f.mp.emit('disconnect', 0); f.mp.emit('connect', 0); h.join(); assert.equal(h.model.frame.menus.length, 0);
  f.mp.sendCustomPacket = () => {}; h.front('skympUi:focus', true); h.advance(30001);
  assert.equal(h.bridge.isActive(), false); assert.equal(h.focused, false); assert.equal(h.model.frame, null);
});
