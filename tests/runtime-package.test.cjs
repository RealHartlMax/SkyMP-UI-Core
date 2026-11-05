const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const { createRuntimeManifest, verifyRuntimePackage } = require('../tools/plugin-runtime/package.cjs');
const { validatePackage, signedPayload } = require('../tools/plugin-runtime/contract.cjs');
const fork = path.resolve(process.env.SKYMP_FORK || path.join(__dirname, '../../skymp'));

test('local build declares the audited client path and matches all plugin runtime file hashes and versions', () => {
  const plugin = require('../plugin.json'); assert.equal(plugin.runtime, 'client/manifest.json');
  assert.equal(plugin.version, require('../package.json').version);
  const manifest = verifyRuntimePackage(path.join(__dirname, '../release/SkyMPUICore/client'), plugin);
  assert.equal(manifest.requires.clientApi, 1); assert.equal(manifest.requires.uiApi, 1);
  assert.deepEqual(manifest.files.map(f => f.path), ['client.js', 'ui.css', 'ui.js']);
});

test('producer SDK preserves Ed25519 canonical signing and rejects byte tampering and incompatible versions', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-core-signature-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'client'); fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, 'client.js'), 'exports.apiVersion=1;');
  const pair = crypto.generateKeyPairSync('ed25519'), key = path.join(directory, 'private-test.pem');
  fs.writeFileSync(key, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }));
  const manifest = createRuntimeManifest({ root, pluginId: 'test-plugin', version: '1.0.0-test', files: ['client.js'], entrypoints: { client: 'client.js' }, privateKeyFile: key, keyId: 'temporary-test' });
  assert(crypto.verify(null, Buffer.from(signedPayload(manifest)), pair.publicKey, Buffer.from(manifest.signature.value, 'hex')));
  assert.equal(crypto.verify(null, Buffer.from(signedPayload({ ...manifest, version: '1.0.1' })), pair.publicKey, Buffer.from(manifest.signature.value, 'hex')), false);
  assert.throws(() => verifyRuntimePackage(root, { name: 'test-plugin', version: '2.0.0' }));
  assert.throws(() => validatePackage({ ...manifest, requires: { clientApi: 2, uiApi: 0 } }));
  fs.appendFileSync(path.join(root, 'client.js'), 'tamper'); assert.throws(() => verifyRuntimePackage(root), /integrity/);
});

test('actual local fork publisher accepts the built candidate, rejects Runtime path and manipulated file bytes', { skip: !fs.existsSync(path.join(fork, 'skymp5-server/ts/pluginRuntimePackages.ts')) }, t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-core-publication-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const pluginDir = path.join(directory, 'SkyMPUICore');
  fs.cpSync(path.join(__dirname, '../release/SkyMPUICore'), pluginDir, { recursive: true });
  const publication = require('../tools/load-fork-runtime.cjs')(fork, require('typescript'));
  const plugin = require('../plugin.json'), selection = { name: plugin.name, version: plugin.version, pluginDir };
  const canonical = fs.readFileSync(path.join(fork, 'misc/plugin-runtime/contract.cjs'));
  assert.deepEqual(fs.readFileSync(path.join(__dirname, '../tools/plugin-runtime/contract.cjs')), canonical);
  publication.validatePluginRuntime(selection);
  fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify({ ...plugin, runtime: 'Runtime/manifest.json' }));
  assert.throws(() => publication.validatePluginRuntime(selection), /declaration/);
  fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(plugin));
  fs.appendFileSync(path.join(pluginDir, 'client/ui.js'), 'tamper');
  assert.throws(() => publication.validatePluginRuntime(selection), /integrity/);
});
