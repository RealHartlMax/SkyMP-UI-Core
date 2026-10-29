const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), version = require('../package.json').version;
require('./plugin-runtime/package.cjs').verifyRuntimePackage(path.join(root, 'release/SkyMPUICore/Runtime'), require('../plugin.json'));
const directory = path.join(root, 'artifacts/packages'); fs.mkdirSync(directory, { recursive: true });
const stage = fs.mkdtempSync(path.join(root, 'artifacts/package-stage-'));
const copy = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.cpSync(from, to, { recursive: true }); };
for (const name of ['SkyMPUICore', 'ExampleUiConsumer', 'SecondUiConsumer']) {
  const destination = path.join(stage, name); copy(path.join(root, 'release', name), destination);
  if (name === 'SkyMPUICore') {
    copy(path.join(root, 'docs'), path.join(destination, 'docs'));
    copy(path.join(root, 'dist/types'), path.join(destination, 'types'));
    if (fs.existsSync(path.join(root, 'LICENSE'))) copy(path.join(root, 'LICENSE'), path.join(destination, 'LICENSE'));
  }
}
const integration = path.join(stage, 'integration-source');
for (const name of ['integration', 'src', 'client', 'shared', 'locales', 'examples', 'tools', 'tests', 'docs', '.vscode', 'AGENTS.md', 'README.md', 'LICENSE', 'config.json', 'plugin.json', 'package.json', 'package-lock.json', 'tsconfig.json']) copy(path.join(root, name), path.join(integration, name));
const results = [];
const pwsh = process.platform === 'win32' ? path.join(process.env.ProgramFiles, 'PowerShell/7/pwsh.exe') : null;
function zip(source, filename) {
  assert(!fs.existsSync(filename), 'Archive exists; choose a new version or preserve the previous output separately: ' + filename);
  if (pwsh) for (const action of ['Create', 'Verify']) {
    const result = spawnSync(pwsh, ['-NoProfile', '-NonInteractive', '-File', path.join(root, 'integration/launcher/archive-runtime.ps1'), '-Action', action, '-Source', source, '-Destination', filename], { encoding: 'utf8', timeout: 120000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message); if (result.stdout.trim()) console.log(result.stdout.trim());
  } else {
    const result = spawnSync('zip', ['-qr', filename, '.'], { cwd: source, encoding: 'utf8', timeout: 120000 }); assert.equal(result.status, 0, result.stderr);
    assert.equal(spawnSync('unzip', ['-t', filename], { encoding: 'utf8' }).status, 0);
  }
  const bytes = fs.readFileSync(filename); results.push({ file: path.basename(filename), size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
}
for (const name of ['SkyMPUICore', 'ExampleUiConsumer', 'SecondUiConsumer']) {
  const wrapper = path.join(stage, 'archives', name); copy(path.join(stage, name), path.join(wrapper, name));
  zip(wrapper, path.join(directory, `${name}-${version}.zip`));
}
const full = path.join(stage, 'all'); fs.mkdirSync(full);
copy(path.join(stage, 'SkyMPUICore'), path.join(full, 'Plugins/SkyMPUICore'));
for (const name of ['ExampleUiConsumer', 'SecondUiConsumer']) copy(path.join(stage, name), path.join(full, 'examples', name));
copy(integration, path.join(full, 'integration-source')); copy(path.join(root, 'README.md'), path.join(full, 'README.md'));
zip(full, path.join(directory, `SkyMP-UI-Core-${version}.zip`));
const report = { passed: true, createdAt: new Date().toISOString(), version, apiVersion: 1, frontendProtocol: 1,
  standaloneEntry: true, localeFiles: ['SkyMPUICore/locales/de.json', 'SkyMPUICore/locales/en.json'],
  skyrimStarted: false, published: false, packages: results };
fs.writeFileSync(path.join(directory, 'PACKAGE-VALIDATION.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(directory, 'SHA256SUMS'), results.map(r => `${r.sha256}  ${r.file}`).join('\n') + '\n');
console.log(JSON.stringify(report, null, 2));
