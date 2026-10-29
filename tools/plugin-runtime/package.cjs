'use strict';
// Producer SDK. Imported by plugin build tools; importing this file writes nothing.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { validatePackage, signedPayload, runtimePath } = require('./contract.cjs');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function sourceFile(root, relative) {
  runtimePath(relative);
  let filename = path.resolve(root);
  if (fs.lstatSync(filename).isSymbolicLink()) throw Error('Runtime root cannot be a link');
  for (const segment of relative.split('/')) { filename = path.join(filename, segment); if (fs.lstatSync(filename).isSymbolicLink()) throw Error('Runtime files cannot be links'); }
  if (!fs.statSync(filename).isFile()) throw Error('Runtime files must be regular files');
  return filename;
}
function createRuntimeManifest(options) {
  const root = path.resolve(options.root), privateKeyFile = options.privateKeyFile ?? process.env.SKYMP_PLUGIN_SIGNING_KEY;
  const keyId = options.keyId ?? process.env.SKYMP_PLUGIN_KEY_ID;
  if (!Array.isArray(options.files) || !options.files.length) throw Error('Explicit public runtime files are required');
  const files = [...options.files].sort().map(relative => {
    const filename = sourceFile(root, relative), bytes = fs.readFileSync(filename);
    return { path: relative, size: bytes.length, sha256: sha256(bytes) };
  });
  const manifest = validatePackage({ formatVersion: 1, pluginId: options.pluginId, version: options.version,
    requires: { clientApi: 1, uiApi: options.entrypoints.ui ? 1 : 0 }, entrypoints: options.entrypoints, files });
  if (privateKeyFile) {
    const absoluteKey = path.resolve(privateKeyFile);
    if (absoluteKey === root || absoluteKey.startsWith(root + path.sep)) throw Error('Private signing keys must stay outside the public Runtime directory');
    if (fs.statSync(absoluteKey).size > 16384) throw Error('Invalid signing key');
    const key = crypto.createPrivateKey(fs.readFileSync(absoluteKey));
    if (key.asymmetricKeyType !== 'ed25519') throw Error('Only Ed25519 publisher keys are supported');
    manifest.signature = { algorithm: 'ed25519', keyId, value: crypto.sign(null, Buffer.from(signedPayload(manifest)), key).toString('hex') };
    validatePackage(manifest);
  } else if (!options.allowUnsigned) throw Error('Set SKYMP_PLUGIN_SIGNING_KEY and SKYMP_PLUGIN_KEY_ID before publishing a runtime package');
  const destination = path.join(root, 'manifest.json');
  fs.writeFileSync(destination, JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
function verifyRuntimePackage(root, expected = {}) {
  const bytes = fs.readFileSync(path.join(root, 'manifest.json'));
  const manifest = validatePackage(JSON.parse(bytes.toString('utf8')));
  if (!manifest.signature) throw Error('Sign the runtime manifest before packaging a release');
  if (expected.name && (manifest.pluginId !== expected.name || manifest.version !== expected.version)) throw Error('Runtime and server plugin versions differ');
  for (const file of manifest.files) {
    const actual = fs.readFileSync(sourceFile(root, file.path));
    if (actual.length !== file.size || sha256(actual) !== file.sha256) throw Error('Runtime file integrity failed: ' + file.path);
  }
  return manifest;
}
function keygen(filename, keyId) {
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(keyId || '')) throw Error('Use a publisher key ID (a-z, 0-9, underscore, dash)');
  const destination = path.resolve(filename);
  if (destination.split(path.sep).some(part => part.toLowerCase() === 'runtime')) throw Error('Keep signing keys outside Runtime');
  const pair = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(destination, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { flag: 'wx', mode: 0o600 });
  const publicKey = pair.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
  return { [keyId]: publicKey };
}
module.exports = { createRuntimeManifest, verifyRuntimePackage, keygen };
if (require.main === module) {
  const [action, ...args] = process.argv.slice(2), options = {};
  for (let at = 0; at < args.length; at += 2) { if (!args[at].startsWith('--') || !args[at + 1]) throw Error('Expected --option value'); options[args[at].slice(2)] = args[at + 1]; }
  if (action === 'keygen') console.log(JSON.stringify(keygen(options.output, options['key-id']), null, 2));
  else if (action === 'sign') {
    const root = path.resolve(options.root), old = validatePackage(JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')));
    createRuntimeManifest({ root, pluginId: old.pluginId, version: old.version, entrypoints: old.entrypoints, files: old.files.map(file => file.path), privateKeyFile: options['private-key'], keyId: options['key-id'] });
    console.log('Signed plugin runtime manifest.');
  } else throw Error('Use keygen --output PRIVATE.pem --key-id PUBLISHER, or sign --root Runtime --private-key PRIVATE.pem --key-id PUBLISHER');
}
