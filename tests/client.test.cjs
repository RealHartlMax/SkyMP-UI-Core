const { test } = require('node:test'), assert = require('node:assert/strict');
const { UiModel, readPreferences } = require('../dist/model.cjs');
const { fixture, widget } = require('./helpers.cjs');
function model() {
  const f = fixture(), sent = [], m = new UiModel((type, data) => sent.push({ type, data }), () => 10000); m.frontId = 'frontA';
  f.api.registerWidget(widget()); f.api.updateWidget({ userId: 0 }, 'alpha:status', { schemaVersion: 1, text: '<script>window.injection=1</script>' });
  const { userId, ...packet } = f.ready(); f.runtime.stop(); return { m, packet, sent };
}
test('CEF accepts only the matching ready snapshot and increasing sequence', () => {
  const { m, packet } = model(); assert.equal(m.receive({ ...packet, frontId: 'someoneElse' }), false);
  assert.equal(m.receive({ ...packet, customPacketType: 'skympUi:update' }), false);
  assert.equal(m.receive(packet), true); assert.equal(m.receive(packet), false); assert.equal(m.receive({ ...packet, sequence: 2, customPacketType: 'skympUi:update' }), true);
  assert.equal(m.frame.widgets[0].state.text, '<script>window.injection=1</script>');
});
test('reset rotates frontend identity, clears private state and announces a fresh handshake', () => {
  const { m, packet, sent } = model(); m.receive(packet); m.receive({ customPacketType: 'skympUi:reset', status: 'connecting' });
  assert.equal(m.frame, null); assert.notEqual(m.frontId, packet.frontId); assert.equal(sent.at(-1).type, 'skympUi:frontReady'); assert.equal(m.receive(packet), false);
});
test('malformed frames fail closed and cannot authorize UI state', () => {
  const { m, packet } = model(); m.receive(packet);
  assert.equal(m.receive({ ...packet, sequence: 2, widgets: [{ ...packet.widgets[0], state: { schemaVersion: 1, text: 'x', html: '<img>' } }] }), false); assert.equal(m.frame, null);
});
test('local preferences accept only scale, visibility and predefined positions; storage failures are harmless', () => {
  const p = readPreferences({ getItem: () => JSON.stringify({ scale: 125, admin: true, widgets: { 'alpha:status': { position: 'bottom-right', hidden: true, value: 999 } } }) }, 'id');
  assert.deepEqual(p, { scale: 125, widgets: { 'alpha:status': { position: 'bottom-right', hidden: true } } });
  assert.equal(readPreferences({ getItem() { throw Error('CEF unavailable'); } }, 'id').scale, 100);
  assert.equal(readPreferences({ getItem: () => '{"scale":99999,"widgets":{}}' }, 'id').scale, 100);
});
