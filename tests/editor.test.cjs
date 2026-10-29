const { test } = require('node:test'), assert = require('node:assert/strict');
const { UiModel, readPreferences } = require('../dist/model.cjs');
const { hudElements, elementPreference, placeElements, normalizedPoint, meterValue } = require('../dist/layout.cjs');
const { installUiEditCommand } = require('../dist/chat-command.cjs');
const { fixture, widget } = require('./helpers.cjs');
const fs = require('node:fs'), path = require('node:path');
const registryPath = path.join(process.env.SKYMP_CHAT || path.resolve(__dirname, '../../SkyMP-Chat'), 'Plugins/SkyMPChat/src/registry.cjs');
const chatAvailable = fs.existsSync(registryPath), CommandRegistry = chatAvailable ? require(registryPath).CommandRegistry : null;
const quiet = { warn() {}, info() {}, error() {} };
function registryFixture() {
  const registry = new CommandRegistry(quiet);
  const api = { apiVersion: 1, registerCommand: definition => registry.register(definition), unregisterCommand: (owner, name) => registry.unregister(owner, name) };
  return { registry, api };
}
function list() { return { definition: widget('supply:status', 'supply', 'icon-list'), visible: true, expiresAt: 99999, state: { schemaVersion: 1, items: [
  { label: 'Sättigung (0 = ausgehungert, 100 = satt)', value: '85,3/100 · Gut', tone: 'success' },
  { label: 'Flüssigkeit (0 = dehydriert, 100 = gut versorgt)', value: '62,1/100 · Gut', tone: 'success' },
  { label: 'Erholung (0 = erschöpft, 100 = ausgeruht)', value: '23,5/100 · Kritisch', tone: 'warning' },
] } }; }
test('generic icon-list becomes independent presentation elements without changing server state', () => {
  const source = list(), before = JSON.stringify(source), elements = hudElements([source]);
  assert.deepEqual(elements.map(e => e.key), ['supply:status#0', 'supply:status#1', 'supply:status#2']);
  assert.equal(JSON.stringify(source), before); assert.equal(elements[1].item.value, '62,1/100 · Gut');
  const prefs = { scale: 100, widgets: { 'supply:status': { hidden: true }, 'supply:status#1': { hidden: false, x: .4, y: .6, scale: 125 } } };
  assert.equal(elementPreference(prefs, elements[0]).hidden, true); assert.equal(elementPreference(prefs, elements[1]).hidden, false);
});
test('localized fractions are decorative only and arbitrary text is never interpreted as markup or a percentage', () => {
  assert.deepEqual(meterValue('85,3/100 · Gut'), { value: 85.3, max: 100, percent: 85.3, text: '85,3', status: 'Gut' });
  assert.equal(meterValue('23.5/100 · Critical').percent, 23.5);
  for (const value of ['<img src=x onerror=alert(1)>', '90%', '10/0', '-1/100', '101/100', 'Infinity/100', '12/100x', 50]) assert.equal(meterValue(value), null);
});
test('legacy preferences migrate and free positions/individual size are bounded presentation data', () => {
  const preferences = { scale: 125, widgets: { 'supply:status#1': { x: .4, y: .8, scale: 120, actorId: 99 },
    'supply:status#2': { x: -1, y: .2, scale: 999 }, 'supply:status#15': { x: 0, y: 1 }, 'supply:status#16': { hidden: true },
    'supply:status': { position: 'bottom-left', hidden: true }, 'supply:bad': null } };
  const read = readPreferences({ getItem: () => JSON.stringify(preferences) }, 'key');
  assert.deepEqual(read.widgets['supply:status#1'], { x: .4, y: .8, scale: 120 });
  assert.deepEqual(read.widgets['supply:status#2'], {}); assert.equal(read.widgets['supply:status#16'], undefined);
  assert.deepEqual(read.widgets['supply:status'], { position: 'bottom-left', hidden: true });
  const many = Object.fromEntries(Array.from({ length: 200 }, (_, i) => ['supply:item' + i, { x: 0, y: 0 }]));
  assert.equal(Object.keys(readPreferences({ getItem: () => JSON.stringify({ scale: 100, widgets: many }) }, 'key').widgets).length, 160);
});
test('default meters are separate; dragging and scaling retain safe viewport bounds after resolution changes', () => {
  const source = list(); source.definition.defaultPosition = 'bottom-left'; const elements = hudElements([source]);
  const defaults = placeElements(elements, { scale: 100, widgets: {} }, { width: 1920, height: 1080 });
  assert(defaults[elements[1].key].left >= defaults[elements[0].key].left + defaults[elements[0].key].width);
  const preferences = { scale: 150, widgets: { 'supply:status#0': { x: 1, y: 1, scale: 150 } } };
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 800, height: 600 }, { width: 320, height: 240 }]) {
    const placed = placeElements(elements, preferences, viewport);
    for (const item of Object.values(placed)) { assert(item.left >= 16); assert(item.top >= 16); assert(item.left + item.width <= viewport.width - 15.9); assert(item.top + item.height <= viewport.height - 15.9); }
  }
  assert.deepEqual(normalizedPoint(-999, 9000, { width: 100, height: 100 }, { width: 800, height: 600 }), { x: 0, y: 1 });
});
test('editor requests require the current ready native identity and negotiated editor support', () => {
  const f = fixture(); try {
    assert.equal(f.runtime.openEditor(0), false); f.ready(); assert.equal(f.runtime.openEditor(0), false);
    f.advance(2000); f.receive(0, { customPacketType: 'skympUi:ready', protocolVersion: 1, frontId: 'editorFront', editorVersion: 1 });
    const snapshot = f.output.at(-1); f.clear(); assert.equal(f.runtime.openEditor(0), true);
    assert.deepEqual(f.output.map(p => p.userId), [0]); assert.equal(f.output[0].frontId, 'editorFront'); assert.equal(f.output[0].sessionId, snapshot.sessionId);
    assert.equal(f.runtime.openEditor(1), false); f.connected.set(0, 103); assert.equal(f.runtime.openEditor(0), false);
    f.connected.set(0, 101); f.advance(999999); assert.equal(f.runtime.openEditor(0), false);
  } finally { f.runtime.stop(); }
});
test('CEF rejects editor requests from old sessions, other fronts and mismatched protocols', () => {
  const f = fixture(), sent = [], model = new UiModel((...message) => sent.push(message)); model.frontId = 'frontA';
  const { userId, ...snapshot } = f.ready(); const edit = { customPacketType: 'skympUi:edit', protocolVersion: 1, frontId: snapshot.frontId, sessionId: snapshot.sessionId };
  try {
    assert.equal(model.receive(edit), false); model.receive(snapshot);
    for (const changed of [{ frontId: 'B' }, { sessionId: 'old' }, { protocolVersion: 2 }]) assert.equal(model.receive({ ...edit, ...changed }), false);
    assert.equal(model.editorRequests, 0); assert.equal(model.receive(edit), true); assert.equal(model.editorRequests, 1); assert.equal(sent.length, 0);
    model.reset(); assert.equal(model.editorRequests, 0); assert.equal(model.frame, null);
  } finally { f.runtime.stop(); }
});
test('/UiEdit uses the real optional Chat registry, preserves foreign commands and unregisters on shutdown', { skip: !chatAvailable }, () => {
  const { registry, api } = registryFixture(), calls = [], replies = [];
  const globals = { skympChat: api }, detach = installUiEditCommand(user => { calls.push(user); return user === 0; }, 'de', globals, quiet);
  const command = registry.names.get('uiedit'); assert(command); assert.equal(command.permission, undefined);
  const context = userId => ({ userId, args: [], reply: value => replies.push(value), error: value => replies.push(value) });
  command.execute(context(0)); assert.deepEqual(calls, [0]); assert.deepEqual(replies, []);
  command.execute({ ...context(0), args: ['other-player'] }); assert.deepEqual(calls, [0]);
  command.execute(context(1)); assert(replies.at(-1).includes('Clientpaket'));
  const duplicate = installUiEditCommand(() => { throw Error('wrong owner'); }, 'en', globals, quiet); duplicate(); assert.equal(registry.names.get('uiedit'), command);
  detach(); assert.equal(registry.names.has('uiedit'), false); command.execute(context(0)); assert.deepEqual(calls, [0, 1]);
});
test('verified Chat readiness queue works in either load order and stays bounded without polling', { skip: !chatAvailable }, () => {
  const { registry, api } = registryFixture(), globals = {};
  const detach = installUiEditCommand(() => true, 'en', globals, quiet); assert.equal(globals.skympChatReady.length, 1);
  const callback = globals.skympChatReady[0]; globals.skympChatReady = []; callback(api); assert(registry.names.has('uiedit'));
  detach(); callback(api); assert.equal(registry.names.size, 0);
  const missing = {}; const clean = installUiEditCommand(() => true, 'de', missing, quiet); clean(); assert.equal(missing.skympChatReady.length, 0);
  const full = { skympChatReady: Array(64).fill(() => {}) }; installUiEditCommand(() => true, 'de', full, quiet)(); assert.equal(full.skympChatReady.length, 64);
});
test('editor translations have complete DE/EN keys and remain separate from the v1 wire catalog', () => {
  const de = require('../client/locales/de.json'), en = require('../client/locales/en.json'); assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort());
  for (const value of [...Object.values(de), ...Object.values(en)]) assert.equal(typeof value, 'string');
  assert.equal(require('../locales/de.json').edit, undefined);
});

test('status widgets use the same medallion size as list items and retain their saved layout key', () => {
  const voice = { definition: { ...widget('skymp-yaca-ts:voice-range', 'skymp-yaca-ts'), defaultPosition: 'bottom-right' },
    visible: true, expiresAt: 99999, state: { schemaVersion: 1, label: 'Stimme', value: '8 m', text: 'Mikrofon stumm', tone: 'warning' } };
  const elements = hudElements([list(), voice]), key = voice.definition.id;
  assert.equal(elements.at(-1).key, key);
  const prefs = { scale: 100, widgets: { [key]: { x: .3, y: .7, scale: 125 } } };
  assert.deepEqual(elementPreference(prefs, elements.at(-1)), { ...prefs.widgets[key], hidden: undefined });
  const defaults = placeElements(elements, { scale: 100, widgets: {} }, { width: 1920, height: 1080 });
  assert.equal(defaults[key].width, defaults['supply:status#0'].width);
  assert.equal(defaults[key].height, defaults['supply:status#0'].height);
  assert.equal(meterValue(voice.state.value), null); // Metres do not invent a percentage fill.
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 375, height: 667 }]) {
    const p = placeElements(elements, prefs, viewport)[key];
    assert.equal(p.width, 140);
    assert.ok(p.left >= 16 && p.top >= 16 && p.left + p.width <= viewport.width - 16 && p.top + p.height <= viewport.height - 16);
  }
});

test('one Escape echo closes one layer; the next deliberate native Escape still works immediately', () => {
  const { createDismissGuard } = require('../dist/model.cjs'); let now = 1000; const accept = createDismissGuard(() => now);
  assert.equal(accept('native'), true); assert.equal(accept('dom'), false); assert.equal(accept('native'), true);
  now += 200; assert.equal(accept('dom'), true); assert.equal(accept('native'), false); assert.equal(accept('dom'), true);
});
