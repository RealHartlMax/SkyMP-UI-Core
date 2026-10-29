const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { UiModel } = require('../dist/model.cjs');
const { fixture, widget, menu, menuState, settled } = require('./helpers.cjs');
const fork = process.env.SKYMP_FORK || path.resolve(__dirname, '../../skymp');
const available = fs.existsSync(path.join(fork, 'skymp5-client/src/services/services/uiCoreBridge.ts'));
function createClient() {
  const f = fixture(), { clientHarness } = require(path.join(fork, 'skymp5-client/tests/helpers/chatHarness.cjs'));
  const c = clientHarness((p, reliability) => { assert.equal(reliability, 'reliable'); f.receive(0, p); });
  const model = new UiModel((type, data) => c.front(type, data));
  c.setExecute(code => vm.runInNewContext(code, { JSON, window: { dispatchEvent: e => {
    if (e.type === 'skympUi:packet') { model.receive(e.detail); c.front('skympUi:focus', model.visibleMenus().length > 0); }
    if (e.type === 'skympUi:probe') model.announce();
    if (e.type === 'skympUi:dismiss') { model.dismiss(); c.front('skympUi:focus', model.visibleMenus().length > 0); }
    if (e.type === 'skympChat:probe') c.front('skympChat:frontReady', 'chat_front');
    if (e.type === 'skympChat:packet' && e.detail.customPacketType === 'skympChat:close') c.action({ type: 'SKYMP_CHAT_CLOSE' });
    if (e.type === 'skympChat:packet' && e.detail.customPacketType === 'skympChat:open') c.action({ type: 'SKYMP_CHAT_OPEN', data: e.detail });
  } }, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } }, Event: class { constructor(type) { this.type = type; } } }));
  f.mp.sendCustomPacket = (_userId, raw) => c.receive(JSON.parse(raw));
  c.join(); c.update(); return { f, c, model };
}
test('real BrowserService coordinates modal > chat; Escape closes the menu and restores gameplay, then Enter opens chat', { skip: !available }, async () => {
  const { f, c, model } = createClient(); f.api.registerMenu(menu()); f.api.onAction('alpha', 'alpha:menu', 'confirm', () => {}, { authorize: () => true });
  f.api.openMenu({ userId: 0 }, 'alpha:menu', menuState()); f.flush(); assert.equal(model.visibleMenus().length, 1); assert.equal(c.focused, true);
  c.press(c.enums.DxScanCode.Escape); c.release(c.enums.DxScanCode.Escape); f.flush(); await settled();
  assert.equal(model.visibleMenus().length, 0); assert.equal(c.focused, false);
  c.press(c.enums.DxScanCode.Enter); c.release(c.enums.DxScanCode.Enter); assert.equal(c.focused, true); assert.equal(c.state.inputOpen, true); f.runtime.stop();
});
test('Skyrim menus suspend a modal and release native focus; closing restores it; disconnect clears private UI', { skip: !available }, () => {
  const { f, c, model } = createClient(); f.api.registerMenu(menu()); f.api.onAction('alpha', 'alpha:menu', 'confirm', () => {}, { authorize: () => true });
  f.api.openMenu({ userId: 0 }, 'alpha:menu', menuState()); f.flush();
  for (const name of [c.enums.Menu.Inventory, c.enums.Menu.Map, c.enums.Menu.Console, c.enums.Menu.Dialogue, c.enums.Menu.Loading]) {
    c.menus.add(name); c.native.emit('menuOpen', { name }); assert.equal(c.focused, false); assert.equal(model.allowed, false);
    c.press(c.enums.DxScanCode.Enter); c.release(c.enums.DxScanCode.Enter); assert.equal(c.focused, false);
    c.menus.delete(name); c.native.emit('menuClose', { name }); assert.equal(c.focused, true);
  }
  c.emitter.emit('connectionDisconnect', {}); assert.equal(c.focused, false); assert.equal(model.frame, null); f.runtime.stop();
});
test('two modals are stacked, F6 dismisses one, F2 hides and reopens without a stuck cursor', { skip: !available }, () => {
  const { f, c, model } = createClient();
  for (const id of ['alpha:menu', 'alpha:second']) { f.api.registerMenu({ ...menu(), id }); f.api.onAction('alpha', id, 'confirm', () => {}, { authorize: () => true }); f.api.openMenu({ userId: 0 }, id, menuState()); }
  f.flush(); assert.equal(model.visibleMenus().length, 2);
  c.press(c.enums.DxScanCode.F6); c.release(c.enums.DxScanCode.F6); f.flush(); assert.equal(model.visibleMenus().length, 1); assert.equal(c.focused, true);
  c.press(c.enums.DxScanCode.F2); c.release(c.enums.DxScanCode.F2); assert.equal(c.visible, false); assert.equal(c.focused, false);
  c.press(c.enums.DxScanCode.F2); c.release(c.enums.DxScanCode.F2); assert.equal(c.visible, true); assert.equal(c.focused, true); f.runtime.stop();
});
test('Enter restores UI visibility after F2 and chat remains usable', { skip: !available }, () => {
  const { f, c, model } = createClient(); f.api.registerWidget(widget()); f.api.updateWidget({ userId: 0 }, 'alpha:status', { schemaVersion: 1, text: 'widget' }); f.flush();
  c.press(c.enums.DxScanCode.F2); c.release(c.enums.DxScanCode.F2); assert.equal(model.allowed, false);
  c.press(c.enums.DxScanCode.Enter); c.release(c.enums.DxScanCode.Enter); assert.equal(model.allowed, true); assert.equal(c.focused, true); assert.equal(c.state.inputOpen, true); f.runtime.stop();
});
