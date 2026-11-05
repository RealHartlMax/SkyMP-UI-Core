const { test } = require('node:test'), assert = require('node:assert/strict');
const { fixture, widget, menu, menuState, action, settled } = require('./helpers.cjs');
const { panel, panelState, registerPanel, readyFramework } = require('./framework-fixtures.cjs');
const { menuState: validateState, actionPayload, validateFrame, serialized } = require('../dist/contracts.cjs');
const { UiModel } = require('../dist/model.cjs');
const clean = ({ userId, ...packet }) => packet;
const target = { userId: 0 };
function panelAction(s, view, counter = 1, extra = {}) {
  return action(s, counter, { widgetId: view.definition.id, payload: { revision: view.revision, values: { amount: 2 }, selections: { tasks: 'first' } }, ...extra });
}
const interaction = (owner = 'alpha', id = 'inspect') => ({ owner, id: owner + ':' + id, schemaVersion: 1, label: owner + ' inspect', kinds: ['npc', 'merchant'] });
const subject = { kind: 'npc', referenceId: 'server-reference-42', title: 'Server target' };

test('panel contract accepts bounded tabs, forms, tables, lists, items and progress as data', () => {
  const state = validateState(panel(), panelState());
  assert.equal(state.content.tabs.length, 2); assert.equal(state.content.blocks[0].text, '<img src=x onerror=alert(1)>');
  assert.deepEqual(actionPayload(state, { revision: 7, values: { amount: 2 }, selections: { tasks: 'first', items: 'apple', rows: 'offer' } }, 7).selections, { tasks: 'first', items: 'apple', rows: 'offer' });
  assert.doesNotThrow(() => validateState(panel(), { schemaVersion: 1, actions: [], content: { version: 1, blocks: [] } }));
  assert.throws(() => actionPayload(menuState(), { values: [] }));
});

test('panel validators reject manipulated structures, duplicate IDs, executable fields and bounds', () => {
  const mutations = [
    s => s.content.version = 2,
    s => s.content.html = '<script/>',
    s => s.content.tabs[1].blocks[0].id = 'tasks',
    s => s.content.tabs.push(s.content.tabs[0]),
    s => s.content.tabs[0].blocks[0].items.push({ id: 'first', label: 'Duplicate' }),
    s => s.content.tabs[1].blocks[1].rows[0].cells = ['missing price'],
    s => s.content.tabs[1].blocks[0].items[0].quantity = -1,
    s => s.content.tabs[1].blocks[0].items[0].imageUrl = 'javascript:alert(1)',
    s => s.content.tabs[0].blocks[1].value = 6,
    s => s.content.tabs[0].blocks[0].items = Array.from({length: 33}, (_, i) => ({ id: 'item-' + i, label: 'Item' })),
    s => s.content.blocks = Array.from({length: 13}, (_, i) => ({ id: 'block-' + i, kind: 'text', text: 'x' })),
  ];
  for (const mutate of mutations) { const s = panelState(); mutate(s); assert.throws(() => validateState(panel(), s)); }
  assert.throws(() => validateState(menu(), { ...menuState(), content: { version: 1, blocks: [] } }));
  assert.throws(() => serialized(JSON.parse('{"content":{"__proto__":{}}}')));
});

test('capabilities keep strict legacy V1 frames working and upgrade the current snapshot without a new session', t => {
  const f = fixture(); t.after(f.runtime.stop);
  registerPanel(f); f.api.openMenu(target, 'alpha:panel', panelState());
  f.api.registerMenu({ ...menu(), priority: 20 }); f.api.onAction('alpha', 'alpha:menu', 'confirm', () => {}, { authorize: () => true });
  f.api.openMenu(target, 'alpha:menu', menuState());
  const legacy = f.ready(); assert.equal(legacy.menus.length, 1); assert.equal('priority' in legacy.menus[0].definition, false);
  assert.equal(legacy.menus[0].revision, undefined); validateFrame(clean(legacy));
  assert.deepEqual(f.api.framework.clientStatus(target), { ready: true, frameworkVersion: 0 });
  assert.throws(() => f.api.openMenu(target, 'alpha:panel', panelState()), /framework/);
  f.receive(0, { customPacketType: 'skympUi:framework', protocolVersion: 1, frontId: legacy.frontId, sessionId: legacy.sessionId, frameworkVersion: 1 });
  const upgraded = f.output.at(-1); assert.equal(upgraded.menus.length, 2); assert.equal(upgraded.sessionId, legacy.sessionId); validateFrame(clean(upgraded));
  assert.deepEqual(f.api.framework.clientStatus(target), { ready: true, frameworkVersion: 1 });
  const count = f.output.length;
  f.receive(0, { customPacketType: 'skympUi:framework', protocolVersion: 1, frontId: 'forged', sessionId: legacy.sessionId, frameworkVersion: 1 }); assert.equal(f.output.length, count);
});

test('unsupported framework versions disable actions with a useful diagnosis while absent optional services are discoverable', t => {
  const f = fixture(); t.after(f.runtime.stop); const s = readyFramework(f);
  assert.equal(f.api.apiVersion, 1); assert.equal(f.api.framework.version, 1); assert(Object.isFrozen(f.api.framework));
  f.receive(0, { customPacketType: 'skympUi:framework', protocolVersion: 1, frontId: s.frontId, sessionId: s.sessionId, frameworkVersion: 2 });
  assert.equal(f.output.at(-1).code, 'framework-mismatch'); assert.equal(f.api.framework.clientStatus(target).ready, false);
  assert(f.logs.some(l => l.msg.includes('framework mismatch')));
  f.advance(10000);
  for (let i = 0; i < 3; i++) f.ready(0, s.frontId); // Exhaust the diagnostic/handshake bucket.
  assert.equal(f.api.framework.clientStatus(target).ready, true); const logCount = f.logs.length;
  f.receive(0, { customPacketType: 'skympUi:framework', protocolVersion: 1, frontId: s.frontId, sessionId: s.sessionId, frameworkVersion: 2 });
  assert.equal(f.api.framework.clientStatus(target).ready, false); assert.equal(f.logs.length, logCount);
});

test('panel actions validate revision, current selection, disabled rows, fields and native recipient', async t => {
  const f = fixture(); t.after(f.runtime.stop); const contexts = [];
  registerPanel(f, 'alpha:panel', ctx => contexts.push(ctx)); f.api.openMenu(target, 'alpha:panel', panelState());
  const s = readyFramework(f), view = s.menus[0];
  const payloads = [
    { revision: view.revision - 1, values: { amount: 2 }, selections: { tasks: 'first' } },
    { revision: view.revision, values: { amount: 2 }, selections: { tasks: 'forged' } },
    { revision: view.revision, values: { amount: 2 }, selections: { tasks: 'locked' } },
    { revision: view.revision, values: { amount: 6 }, selections: { tasks: 'first' } },
    { revision: view.revision, values: { amount: 2 }, selections: { tasks: 'first', admin: 'yes' } },
    { revision: view.revision, values: { amount: 2 }, selections: { tasks: 'first' }, userId: 1 },
    { revision: view.revision, values: { amount: 2 } },
  ];
  payloads.forEach((payload, i) => f.receive(0, panelAction(s, view, i + 1, { payload })));
  const b = readyFramework(f, 1); f.receive(1, panelAction(b, view)); await settled(); assert.equal(contexts.length, 0);
  f.advance(2000); const valid = panelAction(s, view, 8); f.receive(0, valid); f.receive(0, valid); await settled();
  assert.equal(contexts.length, 1); assert.equal(contexts[0].userId, 0); assert.equal(contexts[0].actorId, 101);
  f.api.openMenu(target, 'alpha:panel', panelState()); f.flush(); const current = f.output.at(-1).menus[0]; assert(current.revision > view.revision);
  f.receive(0, panelAction(s, view, 9)); f.receive(0, panelAction(s, view, 10, { actionId: 'core.close', payload: { revision: view.revision } }));
  await settled(); assert.equal(contexts.length, 1); f.flush(); assert(f.api.framework.clientStatus(target).ready);
});

test('two plugin menus respect modal priority, deterministic ties and the shared parallel-dialog limit', async t => {
  const f = fixture({ maxMenus: 3 }); t.after(f.runtime.stop); const called = [];
  for (const [id, priority] of [['alpha:panel', 50], ['beta:panel', 1], ['beta:extra', 100]]) registerPanel(f, id, ctx => called.push(ctx.widgetId), () => true, priority);
  f.api.openMenu(target, 'alpha:panel', panelState()); f.api.openMenu(target, 'beta:panel', panelState());
  const s = readyFramework(f); assert.equal(s.menus.at(-1).definition.id, 'alpha:panel');
  const model = new UiModel(() => {}, () => 10000); model.frontId = s.frontId; assert(model.receive(clean(s)));
  assert.equal(model.action('beta:panel', 'confirm', {}), false);
  f.receive(0, panelAction(s, s.menus[0])); await settled(); assert.deepEqual(called, []);
  f.api.openMenu(target, 'beta:extra', panelState());
  f.api.registerMenu({ ...menu(), id: 'beta:nonmodal', owner: 'beta', modal: false, priority: 100 });
  f.api.onAction('beta', 'beta:nonmodal', 'confirm', () => {}, { authorize: () => true });
  assert.throws(() => f.api.openMenu(target, 'beta:nonmodal', menuState()), /limit/);
  f.api.closeMenu(target, 'beta:extra'); f.api.openMenu(target, 'beta:nonmodal', menuState()); f.flush();
  assert.equal(f.output.at(-1).menus.at(-1).definition.id, 'alpha:panel');
  f.api.closeMenu(target, 'alpha:panel'); f.flush(); assert.equal(f.output.at(-1).menus.at(-1).definition.id, 'beta:panel');
});

test('owner cleanup preserves foreign widgets and removes only owned components and handlers', t => {
  const f = fixture(); t.after(f.runtime.stop);
  for (const owner of ['alpha', 'beta']) {
    f.api.registerWidget(widget(owner + ':status', owner)); f.api.updateWidget(target, owner + ':status', { schemaVersion: 1, text: owner });
    registerPanel(f, owner + ':panel'); f.api.openMenu(target, owner + ':panel', panelState());
    f.api.framework.registerInteraction(interaction(owner), () => {}, { authorize: () => true });
  }
  readyFramework(f); assert.throws(() => f.api.framework.unregisterInteraction('beta', 'alpha:inspect'));
  assert.throws(() => f.api.framework.offAction('beta', 'alpha:panel', 'confirm'));
  f.api.framework.unregisterOwner('alpha'); f.flush(); const frame = f.output.at(-1);
  assert.deepEqual(frame.widgets.map(w => w.definition.owner), ['beta']); assert.deepEqual(frame.menus.map(m => m.definition.owner), ['beta']);
  assert.deepEqual(f.api.framework.listInteractions('npc').map(d => d.owner), ['beta']);
  f.api.framework.unregisterOwner('alpha'); assert.throws(() => f.api.framework.unregisterOwner('bad owner'));
  registerPanel(f); // Old registrations and handlers have really been removed.
});

test('action deregistration and menu replacement abort queued work; asynchronous handlers receive cancellation', async t => {
  const f = fixture(); t.after(f.runtime.stop); let calls = 0;
  registerPanel(f, 'alpha:panel', () => calls++); f.api.openMenu(target, 'alpha:panel', panelState());
  const s = readyFramework(f); f.receive(0, panelAction(s, s.menus[0])); f.api.framework.offAction('alpha', 'alpha:panel', 'confirm'); await settled(); assert.equal(calls, 0);
  let signal, finish;
  f.api.onAction('alpha', 'alpha:panel', 'confirm', ctx => { signal = ctx.signal; return new Promise(resolve => finish = resolve); }, { authorize: () => true });
  f.api.openMenu(target, 'alpha:panel', panelState()); f.flush(); const view = f.output.at(-1).menus[0];
  f.receive(0, panelAction(s, view, 2)); await settled(); assert.equal(signal.aborted, false);
  f.api.openMenu(target, 'alpha:panel', panelState()); assert.equal(signal.aborted, true); finish(); await settled();
  f.api.closeMenu(target, 'alpha:panel'); f.flush(); assert.equal(f.output.at(-1).menus.length, 0);
});

test('reentrant authorization cannot run an action after replacing its server-owned menu', async t => {
  const f = fixture(); t.after(f.runtime.stop); let calls = 0;
  registerPanel(f, 'alpha:panel', () => calls++, () => { f.api.closeMenu(target, 'alpha:panel'); return true; });
  f.api.openMenu(target, 'alpha:panel', panelState()); const s = readyFramework(f);
  f.receive(0, panelAction(s, s.menus[0])); await settled(); assert.equal(calls, 0); assert.equal(f.output.at(-1).accepted, false);
});

test('interaction registry merges two owners into one single-use menu and keeps target identity on the server', async t => {
  const f = fixture(); t.after(f.runtime.stop); const contexts = [];
  f.api.framework.registerInteraction(interaction(), ctx => contexts.push(ctx), { authorize: ctx => ctx.userId === 0 && ctx.interaction.referenceId === subject.referenceId });
  f.api.framework.registerInteraction({ ...interaction('beta'), priority: 10 }, ctx => contexts.push(ctx), { authorize: () => true });
  const entries = f.api.framework.listInteractions('npc'); entries[0].label = 'mutated'; assert.equal(f.api.framework.listInteractions('npc')[0].label, 'beta inspect');
  assert.equal(f.api.framework.openInteraction(target, subject), false); const s = readyFramework(f);
  assert(f.api.framework.openInteraction(target, subject)); assert(f.api.framework.openInteraction(target, subject)); f.flush();
  const menu = f.output.at(-1).menus[0]; assert.equal(f.output.at(-1).menus.length, 1); assert.equal(menu.state.actions.length, 2); assert.equal(menu.state.actions[0].label, 'beta inspect');
  assert(!JSON.stringify(menu).includes(subject.referenceId));
  const packet = action(s, 1, { widgetId: menu.definition.id, actionId: 'entry-1', payload: { revision: menu.revision } });
  f.receive(0, { ...packet, payload: { ...packet.payload, referenceId: 'forged' } }); await settled(); assert.equal(contexts.length, 0);
  const valid = { ...packet, requestId: s.sessionId + '_2' }; f.receive(0, valid); f.receive(0, valid); await settled();
  assert.equal(contexts.length, 1); assert.equal(contexts[0].widgetId, 'alpha:inspect'); assert.equal(contexts[0].actionId, 'interact'); assert.deepEqual(contexts[0].interaction, subject);
  f.receive(0, { ...packet, requestId: s.sessionId + '_3' }); await settled(); assert.equal(contexts.length, 1);
  f.flush(); assert.equal(f.output.at(-1).menus.length, 0);
});

test('interaction offers enforce kinds, registration ownership, counts and live authorization', async t => {
  const f = fixture(); t.after(f.runtime.stop); let calls = 0, allowed = false;
  f.api.framework.registerInteraction(interaction(), () => calls++, { authorize: () => allowed });
  assert.throws(() => f.api.framework.registerInteraction(interaction(), () => {}));
  assert.throws(() => f.api.registerWidget(widget('alpha:inspect')));
  const s = readyFramework(f);
  for (const ids of [['missing:action'], ['alpha:inspect', 'alpha:inspect']]) assert.throws(() => f.api.framework.openInteraction(target, subject, ids));
  assert.throws(() => f.api.framework.openInteraction(target, { ...subject, kind: 'door' }, ['alpha:inspect']));
  f.api.framework.openInteraction(target, subject); f.flush(); const view = f.output.at(-1).menus[0];
  f.receive(0, action(s, 1, { widgetId: view.definition.id, actionId: 'entry-0', payload: { revision: view.revision } })); await settled(); assert.equal(calls, 0);
  allowed = true; f.receive(0, action(s, 2, { widgetId: view.definition.id, actionId: 'entry-0', payload: { revision: view.revision } })); await settled(); assert.equal(calls, 1);
  for (let i = 0; i < 8; i++) f.api.framework.registerInteraction(interaction('beta', 'entry-' + i), () => {}, { authorize: () => true });
  assert.throws(() => f.api.framework.openInteraction(target, subject), /limit/);
});

test('deregistering an interaction aborts an already-running handler after its single-use offer closed', async t => {
  const f = fixture(); t.after(f.runtime.stop); let signal, finish;
  f.api.framework.registerInteraction(interaction(), ctx => { signal = ctx.signal; return new Promise(resolve => finish = resolve); }, { authorize: () => true });
  const s = readyFramework(f); f.api.framework.openInteraction(target, subject); f.flush(); const m = f.output.at(-1).menus[0];
  f.receive(0, action(s, 1, { widgetId: m.definition.id, actionId: 'entry-0', payload: { revision: m.revision } })); await settled();
  f.api.framework.unregisterInteraction('alpha', 'alpha:inspect'); assert(signal.aborted); finish(); await settled();
});

test('disconnect, server switch and an expired ready lease erase private panel and interaction state', t => {
  const f = fixture(); t.after(f.runtime.stop); registerPanel(f); f.api.openMenu(target, 'alpha:panel', panelState());
  const a = readyFramework(f); f.api.framework.registerInteraction(interaction(), () => {}, { authorize: () => true });
  f.api.framework.openInteraction(target, subject); f.mp.emit('disconnect', 0); f.mp.emit('connect', 0);
  const b = readyFramework(f); assert.notEqual(a.sessionId, b.sessionId); assert.equal(b.menus.length, 0);
  const model = new UiModel(() => {}, () => 10000); model.frontId = a.frontId; model.receive(clean(a));
  model.receive({ customPacketType: 'skympUi:reset', status: 'connecting' }); assert.equal(model.frame, null); assert.equal(model.receive(clean(a)), false);
  f.advance(60001); assert.equal(f.api.framework.clientStatus(target).ready, false);
});

test('a coalesced close and reopen clears only the old revision pending state immediately', t => {
  const f = fixture(); t.after(f.runtime.stop); registerPanel(f); f.api.openMenu(target, 'alpha:panel', panelState());
  const s = readyFramework(f), sent = [], model = new UiModel((type, data) => sent.push({ type, data }), () => 10000);
  model.frontId = s.frontId; assert(model.receive(clean(s))); assert(model.dismiss()); assert.equal(model.visibleMenus().length, 0);
  f.api.closeMenu(target, 'alpha:panel'); f.api.openMenu(target, 'alpha:panel', panelState()); f.flush();
  assert(model.receive(clean(f.output.at(-1)))); assert.equal(model.pending.size, 0); assert.equal(model.visibleMenus().length, 1);
  assert(model.visibleMenus()[0].revision > s.menus[0].revision);
});

test('protocol or framework mismatch cancels accepted queued work and signals already-running handlers', async t => {
  for (const mode of ['protocol', 'framework']) for (const started of [false, true]) {
    const f = fixture(); t.after(f.runtime.stop); let calls = 0, signal, finish;
    registerPanel(f, 'alpha:panel', ctx => { calls++; signal = ctx.signal; return new Promise(resolve => finish = resolve); });
    f.api.openMenu(target, 'alpha:panel', panelState()); const s = readyFramework(f);
    f.receive(0, panelAction(s, s.menus[0])); if (started) await settled();
    f.receive(0, mode === 'protocol' ? { customPacketType: 'skympUi:heartbeat', protocolVersion: 2 } :
      { customPacketType: 'skympUi:framework', protocolVersion: 1, frontId: s.frontId, sessionId: s.sessionId, frameworkVersion: 2 });
    await settled(); assert.equal(calls, started ? 1 : 0); if (started) { assert(signal.aborted); finish(); await settled(); }
    assert.equal(f.api.framework.clientStatus(target).ready, false);
  }
});
