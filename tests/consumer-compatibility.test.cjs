const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), esbuild = require('esbuild');
const { fixture } = require('./helpers.cjs');
const { readyFramework } = require('./framework-fixtures.cjs');
const { hudElements, placeElements } = require('../dist/layout.cjs');
const { readPreferences } = require('../dist/model.cjs');
function loadSource(filename) {
  const result = esbuild.buildSync({ entryPoints: [filename], bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent' });
  const module = { exports: {} }; Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports); return module.exports;
}
const metabolism = path.resolve(process.env.SKYMP_METABOLISM || path.join(__dirname, '../../SkyMP-Metabolism'));
const yaca = path.resolve(process.env.SKYMP_YACA || path.join(__dirname, '../../SkyMP-YACA-TS'));
const available = fs.existsSync(path.join(metabolism, 'src/integrations/ui-core/adapter.ts')) && fs.existsSync(path.join(yaca, 'src/uiCoreAdapter.ts'));

test('unchanged real Metabolism and YACA adapters coexist, retain HUD keys and clean up independently', { skip: !available }, t => {
  const f = fixture(); t.after(f.runtime.stop);
  const { UiAdapter } = loadSource(path.join(metabolism, 'src/integrations/ui-core/adapter.ts'));
  const { createLocalizer } = loadSource(path.join(metabolism, 'src/localization.ts'));
  const { createVoiceUi } = loadSource(path.join(yaca, 'src/uiCoreAdapter.ts'));
  const config = { locale: 'de', ui: { enabled: true, widgetId: 'skymp-metabolism:status', updateIntervalSeconds: 1 }, modules: { needs: { enabled: true } }, thresholds: { warning: 60, critical: 30, severe: 10 } };
  const needs = new UiAdapter(() => f.api, config, createLocalizer(), { now: () => 10000 }, { info() {}, warn(message) { throw Error(message); }, error() {} });
  const voice = createVoiceUi({ voiceRanges: { ranges: [3, 8, 40] } }, () => f.api);
  needs.register(); needs.update(0, { schemaVersion: 1, characterId: 'test-character', revision: 1, satiety: 85.3, hydration: 62.1, rest: 23.5 });
  voice.update({ actorId: 101, pluginState: 'IN_INGAME_CHANNEL', clientId: 1, talking: true, microphoneMuted: false, microphoneDisabled: false, soundMuted: false, soundDisabled: false, rangeIndex: 1, rangeChangeAllowed: true });
  const snapshot = readyFramework(f), elements = hudElements(snapshot.widgets);
  assert.equal(elements.length, 4);
  assert.deepEqual(elements.map(e => e.key), ['skymp-metabolism:status#0', 'skymp-metabolism:status#1', 'skymp-metabolism:status#2', 'skymp-yaca-ts:voice-range']);
  assert.equal(snapshot.widgets[1].state.value, '8/40 m');
  const prefs = readPreferences({ getItem: () => JSON.stringify({ scale: 125, widgets: { 'skymp-metabolism:status#1': { x: .4, y: .6, scale: 120 }, 'skymp-yaca-ts:voice-range': { hidden: true } } }) }, snapshot.preferenceKey);
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1024, height: 768 }, { width: 800, height: 600 }]) {
    const placed = placeElements(elements, prefs, viewport);
    assert(Object.values(placed).every(p => p.left >= 16 && p.top >= 16 && p.left + p.width <= viewport.width - 15.9 && p.top + p.height <= viewport.height - 15.9));
  }
  needs.unregister(); f.flush(); assert.deepEqual(f.output.at(-1).widgets.map(w => w.definition.id), ['skymp-yaca-ts:voice-range']);
  voice.dispose(); f.flush(); assert.equal(f.output.at(-1).widgets.length, 0);
});

test('the real optional Metabolism survival adapter renders added values and removes them without new templates', { skip: !fs.existsSync(path.join(metabolism, 'src/integrations/ui-core/survival.ts')) }, t => {
  const f = fixture(); t.after(f.runtime.stop);
  const { SurvivalUiAdapter } = loadSource(path.join(metabolism, 'src/integrations/ui-core/survival.ts'));
  const { createLocalizer } = loadSource(path.join(metabolism, 'src/localization.ts'));
  const adapter = new SurvivalUiAdapter(() => f.api, { ui: { enabled: true, updateIntervalSeconds: 1 } }, createLocalizer(), { now: () => 10000 }, { warn(message) { throw Error(message); } });
  adapter.update(0, { characterId: 'test-character', enabled: { temperature: true, diseases: true, effects: true },
    temperature: { thermalComfort: 20, cause: 'cold', wetness: 75 }, climate: { available: true, wetness: 75 },
    diseases: [{ phase: 'active', labels: { de: 'Testkrankheit', en: 'Test disease' } }], effects: [{}] });
  const snapshot = readyFramework(f), view = snapshot.widgets[0];
  assert.equal(view.definition.id, 'skymp-metabolism:survival'); assert.equal(view.state.items.length, 5);
  assert.equal(hudElements(snapshot.widgets).length, 5); assert(view.state.items.some(item => item.value.includes('Testkrankheit')));
  adapter.remove(0); f.flush(); assert.equal(f.output.at(-1).widgets[0].visible, false);
  adapter.stop(); f.flush(); assert.equal(f.output.at(-1).widgets.length, 0);
});
