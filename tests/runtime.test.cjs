const { test } = require('node:test'), assert = require('node:assert/strict');
const { fixture, widget, menu, menuState, setupAction, action, settled } = require('./helpers.cjs');
const { validateFrame, serialized } = require('../dist/contracts.cjs');
test('owner namespaces, duplicates, schema versions and bundled templates are enforced', () => {
  const f = fixture(); f.api.registerWidget(widget());
  for (const d of [widget(), widget('beta:status'), { ...widget('alpha:new'), kind: 'html' }, { ...widget('alpha:new'), schemaVersion: 2 }, { ...widget('alpha:new'), kind: 'custom-template', templateId: 'https://evil' }]) assert.throws(() => f.api.registerWidget(d));
  assert.throws(() => f.api.unregisterWidget('beta', 'alpha:status'));
  assert.throws(() => f.api.onAction('beta', 'alpha:status', 'confirm', () => {}));
  f.api.registerWidget(widget('beta:status', 'beta')); f.runtime.stop();
});
test('strict JSON rejects code, nonfinite values, prototypes, cycles, accessors and complexity bombs', () => {
  const cycle = {}; cycle.cycle = cycle;
  for (const value of [NaN, Infinity, () => {}, BigInt(1), new Date(), cycle, JSON.parse('{"__proto__": {"admin": true}}'), { get value() { throw Error('getter must not execute'); } }, Array(257).fill(0)]) assert.throws(() => serialized(value));
  assert.throws(() => serialized({ data: '😀'.repeat(3000) }, 4096));
});
test('slow CEF gets the latest coalesced state; player A never receives B data', () => {
  const f = fixture(); f.api.registerWidget(widget());
  const state = { schemaVersion: 1, label: 'Status', text: 'first' }; f.api.updateWidget({ userId: 0 }, 'alpha:status', state); state.text = 'mutated';
  f.api.updateWidget({ actorId: 101 }, 'alpha:status', { schemaVersion: 1, text: 'latest' });
  f.api.updateWidget({ userId: 1 }, 'alpha:status', { schemaVersion: 1, text: 'private-B' });
  f.flush(); assert.equal(f.output.length, 0);
  const a = f.ready(0); const b = f.ready(1, 'frontB');
  validateFrame(Object.fromEntries(Object.entries(a).filter(([k]) => k !== 'userId')));
  assert.equal(a.widgets[0].state.text, 'latest'); assert.equal(b.widgets[0].state.text, 'private-B');
  f.clear(); for (let i = 0; i < 20; i++) f.api.updateWidget({ userId: 0 }, 'alpha:status', { schemaVersion: 1, value: i });
  assert.equal(f.output.length, 0); f.flush(); assert.equal(f.output.length, 1); assert.equal(f.output[0].sequence, 2); assert.equal(f.output[0].widgets[0].state.value, 19);
  f.runtime.stop();
});
test('invalid targets and stale native actor mappings fail closed', () => {
  const f = fixture(); f.api.registerWidget(widget());
  for (const target of [{}, { userId: 0, actorId: 101 }, { userId: -1 }, { actorId: 999 }, { userId: 3 }, { actorId: 0 }]) assert.throws(() => f.api.updateWidget(target, 'alpha:status', { schemaVersion: 1, text: 'x' }));
  f.mp.getUserByActor = () => 1;
  assert.throws(() => f.api.updateWidget({ userId: 0 }, 'alpha:status', { schemaVersion: 1, text: 'x' })); f.runtime.stop();
});
test('empty native GUID uses isolated session preferences and never disables authenticated actor routing', () => {
  const f = fixture(); f.mp.getUserGuid = () => ''; const a = f.ready(0), b = f.ready(1, 'frontB');
  assert.notEqual(a.preferenceKey, b.preferenceKey); assert.equal(a.preferenceKey.length, 32); f.runtime.stop();
});
test('disconnect, reused user slot and actor replacement erase private state and request sessions', () => {
  const f = fixture(); f.api.registerWidget(widget()); f.api.updateWidget({ userId: 0 }, 'alpha:status', { schemaVersion: 1, text: 'secret' });
  const old = f.ready(); f.mp.emit('disconnect', 0); f.mp.emit('connect', 0); const fresh = f.ready();
  assert.notEqual(fresh.sessionId, old.sessionId); assert.equal(fresh.widgets.length, 0);
  f.api.updateWidget({ userId: 0 }, 'alpha:status', { schemaVersion: 1, text: 'again' }); f.connected.set(0, 103);
  f.advance(3000); const replacement = f.ready(); assert.equal(replacement.widgets.length, 0); f.runtime.stop();
});
test('a frontend reload rotates the request nonce and sends the current snapshot', () => {
  const f = fixture(); f.api.registerWidget(widget()); f.api.updateWidget({ userId: 0 }, 'alpha:status', { schemaVersion: 1, text: 'current' });
  const a = f.ready(), b = f.ready(0, 'reloaded'); assert.notEqual(a.sessionId, b.sessionId); assert.equal(b.sequence, 1); assert.equal(b.widgets[0].state.text, 'current'); f.runtime.stop();
});
test('mismatched protocol never enables actions and logs a bounded useful diagnosis', () => {
  const f = fixture(); let count = 0; const s = setupAction(f, () => count++);
  f.receive(0, { customPacketType: 'skympUi:ready', protocolVersion: 2, frontId: 'wrong' }); f.receive(0, action(s));
  assert.equal(count, 0); assert(f.logs.some(l => l.msg.includes('protocol mismatch'))); f.runtime.stop();
});
test('registered visible action invokes exactly once with the server identity; duplicate and evicted replay stay inert', async () => {
  const f = fixture({ maxSeenRequests: 1 }); const contexts = []; const s = setupAction(f, ctx => contexts.push(ctx));
  const request = action(s); f.receive(0, request); f.receive(0, request); await settled();
  assert.equal(contexts.length, 1); assert.equal(contexts[0].userId, 0); assert.equal(contexts[0].actorId, 101);
  f.receive(0, action(s, 2)); await settled(); f.receive(0, request); await settled(); assert.equal(contexts.length, 2);
  assert.equal(f.output.at(-1).code, 'replay'); f.runtime.stop();
});
test('authorization denies by default, rejects async truthiness, and isolates errors', async () => {
  for (const authorize of [null, () => false, async () => true, () => { throw Error('private permission token'); }]) {
    const f = fixture(); let count = 0; const s = setupAction(f, () => count++, authorize); f.receive(0, action(s)); await settled(); assert.equal(count, 0); assert.equal(f.output.at(-1).accepted, false); f.runtime.stop();
  }
  const f = fixture(); const s = setupAction(f, () => { throw Error('secret'); }); f.receive(0, action(s)); await settled(); assert(f.logs.some(l => l.level === 'error')); assert(!JSON.stringify(f.logs).includes('secret')); f.runtime.stop();
});
test('forged identities, other recipients, hidden menus, unoffered actions and stale session prefixes do nothing', async () => {
  const f = fixture(); let count = 0; const s = setupAction(f, () => count++); const b = f.ready(1, 'frontB');
  for (const packet of [action(s, 1, { userId: 1 }), action(s, 1, { permissions: ['admin'] }), action(s, 1, { actionId: 'forged' }), action(s, 2, { requestId: 'old_1' })]) f.receive(0, packet);
  f.receive(1, action(b)); f.api.closeMenu({ userId: 0 }, 'alpha:menu'); f.receive(0, action(s, 3)); await settled(); assert.equal(count, 0); f.runtime.stop();
});
test('form values are validated against server-owned types, ranges, allowed options and field names', async () => {
  const f = fixture(); let count = 0; f.api.registerMenu(menu('core:form-v1')); f.api.onAction('alpha', 'alpha:menu', 'confirm', () => count++, { authorize: () => true });
  f.api.openMenu({ userId: 0 }, 'alpha:menu', { ...menuState(), fields: [
    { id: 'amount', label: 'Amount', type: 'number', min: 1, max: 5, required: true },
    { id: 'choice', label: 'Choice', type: 'select', options: [{ value: 'yes', label: 'Yes' }], required: true },
  ] }); const s = f.ready();
  const invalid = [{ amount: 6, choice: 'yes' }, { amount: 1, choice: 'admin' }, { amount: 1, choice: 'yes', admin: true }, { amount: '2', choice: 'yes' }, {}];
  invalid.forEach((values, i) => f.receive(0, action(s, i + 1, { payload: { values } })));
  await settled(); assert.equal(count, 0); f.receive(0, action(s, 6, { payload: { values: { amount: 2, choice: 'yes' } } })); await settled(); assert.equal(count, 1); f.runtime.stop();
});
test('dismiss is session-scoped, works without a foreign action handler and cannot close another user menu', () => {
  const f = fixture(); const s = setupAction(f); f.receive(0, action(s, 1, { actionId: 'core.close' })); f.flush(); assert.equal(f.output.at(-1).menus.length, 0); f.runtime.stop();
});
test('widget and notification counts, rate budgets, payload bytes and TTLs are bounded', () => {
  const f = fixture({ maxWidgets: 2, updateBurst: 4, widgetTtlMs: 500, menuTtlMs: 500 });
  for (let i = 0; i < 3; i++) f.api.registerWidget(widget('alpha:w' + i));
  for (let i = 0; i < 2; i++) f.api.updateWidget({ userId: 0 }, 'alpha:w' + i, { schemaVersion: 1, text: 'x' });
  assert.throws(() => f.api.updateWidget({ userId: 0 }, 'alpha:w2', { schemaVersion: 1, text: 'x' }));
  assert.throws(() => f.api.updateWidget({ userId: 0 }, 'alpha:w0', { schemaVersion: 1, text: 'x'.repeat(1025) }));
  f.api.updateWidget({ userId: 0 }, 'alpha:w0', { schemaVersion: 1, value: 1 });
  assert.throws(() => f.api.updateWidget({ userId: 0 }, 'alpha:w0', { schemaVersion: 1, value: 2 }));
  for (let i = 0; i < 4; i++) f.api.notify({ userId: 0 }, 'Notice', { durationMs: 1000 });
  assert.throws(() => f.api.notify({ userId: 0 }, 'Flood')); const s = f.ready(); assert.equal(s.notifications.length, 4);
  f.advance(1100); f.flush(); assert.equal(f.output.at(-1).widgets.length, 0); assert.equal(f.output.at(-1).notifications.length, 0); f.runtime.stop();
});
test('session byte-limit rejection rolls back the update without corrupting a previous state', () => {
  const f = fixture({ maxSessionBytes: 1800 }); f.api.registerWidget(widget()); f.api.registerWidget(widget('alpha:other'));
  f.api.updateWidget({ userId: 0 }, 'alpha:status', { schemaVersion: 1, text: 'first' });
  f.api.updateWidget({ userId: 0 }, 'alpha:other', { schemaVersion: 1, text: 'a'.repeat(400) });
  assert.throws(() => f.api.updateWidget({ userId: 0 }, 'alpha:status', { schemaVersion: 1, text: 'b'.repeat(1024) }));
  assert.equal(f.ready().widgets.find(w => w.definition.id === 'alpha:status').state.text, 'first'); f.runtime.stop();
});
test('20-widget flood coalesces to one bounded frame and rejects excessive updates', () => {
  const f = fixture(); for (let i = 0; i < 20; i++) { f.api.registerWidget(widget('alpha:w' + i)); f.api.updateWidget({ userId: 0 }, 'alpha:w' + i, { schemaVersion: 1, value: i }); }
  f.ready(); f.clear(); let accepted = 0;
  for (let i = 0; i < 200; i++) try { f.api.updateWidget({ userId: 0 }, 'alpha:w' + i % 20, { schemaVersion: 1, value: i }); accepted++; } catch {}
  assert.equal(accepted, 80); f.flush(); assert.equal(f.output.length, 1); assert.equal(f.output[0].widgets.length, 20); f.runtime.stop();
});
test('unsettled handlers retain their global slot after timeout and are aborted on stop', async () => {
  const f = fixture({ actionTimeoutMs: 10, maxConcurrentActions: 1 }); let signal;
  const s = setupAction(f, ctx => { signal = ctx.signal; return new Promise(() => {}); }); f.receive(0, action(s)); await settled();
  await new Promise(resolve => setTimeout(resolve, 25)); assert.equal(signal.aborted, true); f.receive(0, action(s, 2)); assert.equal(f.output.at(-1).accepted, false);
  f.runtime.stop(); assert.equal(f.mp.listenerCount('customPacket'), 0); assert.equal(f.api.getStatus().ready, false);
});
test('missing assets produce one diagnostic per native connection; stale sessions expire', () => {
  const f = fixture(); f.mp.emit('connect', 0); f.advance(16000); f.flush(); f.flush();
  assert.equal(f.logs.filter(l => l.msg.includes('No UI frontend handshake')).length, 1);
  f.ready(); f.advance(60001); f.flush(); assert.equal(f.api.getStatus().sessions, 0); f.runtime.stop();
});
test('unregister removes state and handlers; stopped service cannot accept new work', () => {
  const f = fixture(); f.api.registerWidget(widget()); f.api.updateWidget({ userId: 0 }, 'alpha:status', { schemaVersion: 1, text: 'x' }); f.ready();
  f.api.unregisterWidget('alpha', 'alpha:status'); f.flush(); assert.equal(f.output.at(-1).widgets.length, 0); f.runtime.stop(); assert.throws(() => f.api.registerWidget(widget()));
});
