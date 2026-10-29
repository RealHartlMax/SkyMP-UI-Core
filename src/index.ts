import fs from 'node:fs';
import path from 'node:path';
import { createUiCore } from './runtime';
import type { SkyMpUiApiV1 } from '../shared/contracts';
export type * from '../shared/contracts';
declare global { var skympUi: SkyMpUiApiV1 | undefined; }
const runtimeKey = Symbol.for('skymp-ui-core.runtime.v1');
const globals = globalThis as any;
if (globals[runtimeKey] || Object.prototype.hasOwnProperty.call(globalThis, 'skympUi'))
  throw new Error('[skymp-ui-core] Runtime/API already occupied; full gameserver restart required');
const configPath = process.env.SKYMP_UI_CONFIG ? path.resolve(process.cwd(), process.env.SKYMP_UI_CONFIG) : path.join(process.cwd(), 'Plugins/SkyMPUICore/config.json');
let config: unknown = {};
if (fs.existsSync(configPath)) {
  if (fs.statSync(configPath).size > 16384) throw new Error('[skymp-ui-core] Config exceeds 16 KiB');
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}
const locales: Record<string, unknown> = {};
for (const language of ['de', 'en']) {
  const filename = path.join(path.dirname(configPath), 'locales', language + '.json');
  if (!fs.existsSync(filename)) { console.warn('[skymp-ui-core] Locale file missing; bundled fallback: ' + language); continue; }
  if (fs.statSync(filename).size > 16384) throw new Error('[skymp-ui-core] Locale exceeds 16 KiB: ' + language);
  locales[language] = JSON.parse(fs.readFileSync(filename, 'utf8'));
}
const runtime = createUiCore(globals.mp, { config, locales, chatGlobals: globals });
Object.defineProperty(globalThis, 'skympUi', { value: runtime.api, writable: false, configurable: false, enumerable: false });
Object.defineProperty(globalThis, runtimeKey, { value: runtime, writable: false, configurable: false });
process.once('exit', () => runtime.stop());
console.info('[skymp-ui-core] Ready: API v1, frontend protocol v1; signed plugin Runtime requires shared client/UI API 1');
