'use strict';
// Shared by the server, package tools and the client loader. No filesystem access.
const API_VERSION = 1;
const MAX_FILES = 256, MAX_FILE_BYTES = 16 * 1024 * 1024, MAX_PACKAGE_BYTES = 64 * 1024 * 1024;
const idPattern = /^[a-z][a-z0-9_-]{0,63}$/;
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[a-zA-Z0-9.-]+)?$/;
const extensions = new Set(['js', 'cjs', 'json', 'css', 'html', 'png', 'jpg', 'jpeg', 'svg', 'webp', 'gif', 'ttf', 'otf', 'woff', 'woff2', 'ogg', 'wav']);
function check(condition, message) { if (!condition) throw Error('Plugin runtime: ' + message); }
function object(value) { check(value && typeof value === 'object' && !Array.isArray(value), 'expected object'); }
function keys(value, allowed) { object(value); check(Object.keys(value).every(key => allowed.includes(key)), 'unknown manifest field'); }
function runtimePath(value) {
  check(typeof value === 'string' && value.length > 0 && value.length <= 180 && /^[a-zA-Z0-9_./-]+$/.test(value), 'invalid file path');
  for (const part of value.split('/')) check(part && !part.startsWith('.') && !/[. ]$/.test(part) && !/^(?:con|prn|aux|nul|com\d|lpt\d)(?:\.|$)/i.test(part), 'unsafe Windows file path');
  check(extensions.has(value.split('.').pop().toLowerCase()), 'unsupported file type; native binaries belong to the central runtime');
  return value;
}
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}
function signedPayload(manifest) {
  const payload = {};
  for (const key of Object.keys(manifest)) if (key !== 'signature') payload[key] = manifest[key];
  return canonical(payload);
}
function validatePackage(manifest) {
  keys(manifest, ['formatVersion', 'pluginId', 'version', 'requires', 'entrypoints', 'files', 'signature']);
  check(manifest.formatVersion === 1 && typeof manifest.pluginId === 'string' && idPattern.test(manifest.pluginId), 'unsupported format or plugin ID');
  check(typeof manifest.version === 'string' && versionPattern.test(manifest.version), 'invalid package version');
  keys(manifest.requires, ['clientApi', 'uiApi']);
  check(manifest.requires.clientApi === 1 && [0, 1].includes(manifest.requires.uiApi), 'unsupported client/UI API');
  keys(manifest.entrypoints, ['client', 'ui', 'styles']);
  check(typeof manifest.entrypoints.client === 'string' || typeof manifest.entrypoints.ui === 'string', 'no entrypoint');
  check(Array.isArray(manifest.files) && manifest.files.length > 0 && manifest.files.length <= MAX_FILES, 'invalid file count');
  let total = 0; const paths = new Map();
  for (const file of manifest.files) {
    keys(file, ['path', 'size', 'sha256']); runtimePath(file.path);
    check(packageRoot(manifest.pluginId, '0'.repeat(64)).length + file.path.length <= 240, 'installed file path exceeds launcher limit');
    check(Number.isSafeInteger(file.size) && file.size >= 0 && file.size <= MAX_FILE_BYTES, 'invalid file size');
    check(typeof file.sha256 === 'string' && /^[a-f0-9]{64}$/.test(file.sha256), 'invalid SHA-256');
    check(!paths.has(file.path.toLowerCase()), 'duplicate Windows destination'); paths.set(file.path.toLowerCase(), file.path);
    total += file.size; check(total <= MAX_PACKAGE_BYTES, 'package exceeds 64 MiB');
  }
  for (const name of ['client', 'ui']) if (manifest.entrypoints[name] !== undefined) {
    const entry = runtimePath(manifest.entrypoints[name]);
    check(paths.get(entry.toLowerCase()) === entry && /\.(?:js|cjs)$/.test(entry), 'entrypoint is absent from signed file list');
  }
  if (manifest.entrypoints.ui) check(manifest.requires.uiApi === 1, 'UI entrypoint requires UI API 1');
  const styles = manifest.entrypoints.styles ?? [];
  check(Array.isArray(styles) && styles.length <= 16 && new Set(styles).size === styles.length, 'invalid styles');
  for (const entry of styles) check(runtimePath(entry).endsWith('.css') && paths.get(entry.toLowerCase()) === entry, 'style is absent from signed file list');
  if (manifest.signature !== undefined) {
    keys(manifest.signature, ['algorithm', 'keyId', 'value']);
    check(manifest.signature.algorithm === 'ed25519' && typeof manifest.signature.keyId === 'string' && idPattern.test(manifest.signature.keyId) && typeof manifest.signature.value === 'string' && /^[a-f0-9]{128}$/.test(manifest.signature.value), 'invalid publisher signature');
  }
  return manifest;
}
function packageRoot(pluginId, revision) {
  check(typeof pluginId === 'string' && idPattern.test(pluginId) && typeof revision === 'string' && /^[a-f0-9]{64}$/.test(revision), 'invalid package identity');
  return 'Data/Platform/PluginRuntime/packages/' + pluginId + '/' + revision + '/';
}
module.exports = { API_VERSION, MAX_FILES, MAX_FILE_BYTES, MAX_PACKAGE_BYTES, idPattern, runtimePath, canonical, signedPayload, validatePackage, packageRoot };
