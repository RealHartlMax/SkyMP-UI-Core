const fs = require('node:fs'), path = require('node:path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
async function main() {
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  for (const [entry, outfile, platform] of [
    ['src/index.ts', 'dist/index.cjs', 'node'], ['src/runtime.ts', 'dist/runtime.cjs', 'node'],
    ['shared/contracts.ts', 'dist/contracts.cjs', 'node'], ['client/model.ts', 'dist/model.cjs', 'node'],
    ['client/layout.ts', 'dist/layout.cjs', 'node'], ['src/chat-command.ts', 'dist/chat-command.cjs', 'node'],
    ['client/host.tsx', 'dist/client/index.js', 'browser'],
    ['examples/ExampleUiConsumer/index.ts', 'dist/ExampleUiConsumer/index.cjs', 'node'],
    ['examples/SecondUiConsumer/index.ts', 'dist/SecondUiConsumer/index.cjs', 'node'],
  ]) await esbuild.build({ absWorkingDir: root, entryPoints: [entry], outfile, bundle: true, platform,
    format: platform === 'browser' ? 'esm' : 'cjs', target: 'es2020', external: platform === 'browser' ? ['react'] : [],
    legalComments: 'none', logLevel: 'warning' });
  fs.copyFileSync(path.join(root, 'client/style.css'), path.join(root, 'dist/client/index.css'));
  await require('./build-runtime.cjs')(root);
  const ts = require('typescript');
  const declaration = ts.createProgram(['shared/contracts.ts'], { declaration: true, emitDeclarationOnly: true,
    rootDir: root, outDir: path.join(root, 'dist/types'), target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.Node16,
    moduleResolution: ts.ModuleResolutionKind.Node16, types: ['node'], skipLibCheck: true, resolveJsonModule: true, esModuleInterop: true });
  const declarationErrors = ts.getPreEmitDiagnostics(declaration).filter(d => d.category === ts.DiagnosticCategory.Error);
  if (declarationErrors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(declarationErrors, {
    getCanonicalFileName: p => p, getCurrentDirectory: () => root, getNewLine: () => '\n' }));
  declaration.emit();
  fs.rmSync(path.join(root, 'dist/types/contracts.d.ts'), { force: true });
  fs.cpSync(path.join(root, 'locales'), path.join(root, 'dist/types/locales'), { recursive: true });
  for (const name of ['SkyMPUICore', 'ExampleUiConsumer', 'SecondUiConsumer']) {
    const dir = path.join(root, 'release', name); fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(root, name === 'SkyMPUICore' ? 'plugin.json' : `examples/${name}/plugin.json`), path.join(dir, 'plugin.json'));
    fs.copyFileSync(path.join(root, name === 'SkyMPUICore' ? 'dist/index.cjs' : `dist/${name}/index.cjs`), path.join(dir, 'index.cjs'));
    const readme = path.join(root, name === 'SkyMPUICore' ? 'README.md' : `examples/${name}/README.md`);
    if (fs.existsSync(readme)) fs.copyFileSync(readme, path.join(dir, 'README.md'));
  }
  fs.cpSync(path.join(root, 'Runtime'), path.join(root, 'release/SkyMPUICore/Runtime'), { recursive: true });
  fs.copyFileSync(path.join(root, 'config.json'), path.join(root, 'release/SkyMPUICore/config.json'));
  fs.cpSync(path.join(root, 'locales'), path.join(root, 'release/SkyMPUICore/locales'), { recursive: true });
  fs.cpSync(path.join(root, 'docs'), path.join(root, 'release/SkyMPUICore/docs'), { recursive: true });
  fs.cpSync(path.join(root, 'dist/types'), path.join(root, 'release/SkyMPUICore/types'), { recursive: true });
  fs.mkdirSync(path.join(root, 'release/SkyMPUICore/docs/examples'), { recursive: true });
  fs.copyFileSync(path.join(root, 'examples/ExampleUiConsumer/index.ts'), path.join(root, 'release/SkyMPUICore/docs/examples/ExampleUiConsumer.ts'));
  fs.writeFileSync(path.join(root, 'release/SkyMPUICore/README.md'), fs.readFileSync(path.join(root, 'README.md'), 'utf8').replace('(examples/ExampleUiConsumer/index.ts)', '(docs/examples/ExampleUiConsumer.ts)'));
  if (fs.existsSync(path.join(root, 'LICENSE'))) fs.copyFileSync(path.join(root, 'LICENSE'), path.join(root, 'release/SkyMPUICore/LICENSE'));
  console.log('Built standalone server, existing-CEF host, contract types and two independent consumers.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
