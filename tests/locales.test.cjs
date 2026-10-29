const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { createUiCore } = require('../dist/runtime.cjs'), { validateFrame } = require('../dist/contracts.cjs');
const { fixture } = require('./helpers.cjs');
test('DE and EN files have exactly the same complete set of string keys', () => {
  const de = require('../locales/de.json'), en = require('../locales/en.json'); assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort());
  for (const v of [...Object.values(de), ...Object.values(en)]) assert.equal(typeof v, 'string');
});
test('config locale selects the frontend default and operator JSON overrides are transmitted as text with fallback keys', () => {
  const f = fixture(); f.runtime.stop();
  const runtime = createUiCore(f.mp, { autoFlush: false, config: { locale: 'en' }, locales: { en: { close: '<custom close>' } } });
  f.receive(0, { customPacketType: 'skympUi:ready', protocolVersion: 1, frontId: 'front' });
  const { userId, ...p } = f.output.at(-1); validateFrame(p);
  assert.equal(p.locale, 'en'); assert.equal(p.translations.en.close, '<custom close>'); assert.equal(p.translations.en.display, 'Display'); assert.equal(runtime.api.getStatus().locale, 'en'); runtime.stop();
});
test('invalid locale and unsafe/mistyped translation data fail clearly', () => {
  const f = fixture(); f.runtime.stop();
  for (const options of [{ config: { locale: 'zz' } }, { locales: { de: { close: 123 } } }, { locales: { de: { unknown: 'oops' } } }, { locales: { de: { close: '' } } }]) assert.throws(() => createUiCore(f.mp, options));
});
