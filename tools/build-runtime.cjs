const fs = require('node:fs'), path = require('node:path'), esbuild = require('esbuild');
const { createRuntimeManifest } = require('./plugin-runtime/package.cjs');
module.exports = async function(root) {
  const out = path.join(root,'Runtime'), manifest = require(path.join(root,'plugin.json'));
  fs.mkdirSync(out, { recursive: true });
  await esbuild.build({ absWorkingDir: root, entryPoints: ['client/runtime.ts'], outfile: path.join(out,'client.js'), bundle: true, platform: 'node', format: 'cjs', target: 'node20', legalComments: 'none' });
  await esbuild.build({ absWorkingDir: root, entryPoints: ['client/runtime-ui.tsx'], outfile: path.join(out,'ui.js'), bundle: true, platform: 'browser', format: 'iife', target: 'es2020', external: ['react'], legalComments: 'none', banner: {js: '(function(require){'}, footer: {js: '})(window.SkyMPPluginRuntime.require);'} });
  fs.copyFileSync(path.join(root,'client/style.css'),path.join(out,'ui.css'));
  createRuntimeManifest({ root: out, pluginId: manifest.name, version: manifest.version, files: ['client.js','ui.js','ui.css'], entrypoints: {client:'client.js',ui:'ui.js',styles:['ui.css']}, allowUnsigned: true });
};
