import { createHash } from 'node:crypto';
import { readDiscoveryState, type PluginDiscoveryState } from './pluginDiscoveryState';

type Settings = Record<string, unknown>;
const validName = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
const validOrder = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 512 && value.every(validName) && new Set(value).size === value.length;

export function inspectPluginLoadOrder(settings: Settings, state: PluginDiscoveryState) {
  const configured = settings.pluginsLoadOrder ?? [];
  if (!validOrder(configured)) throw Error('Invalid pluginsLoadOrder in server-settings.json');
  const discovered = Object.keys(state.plugins).sort((a, b) => a.localeCompare(b));
  if (!discovered.every(validName)) throw Error('Invalid plugin discovery names');
  // The existing boot loader loads configured IDs first, then other discovered IDs alphabetically.
  // Keep configured missing IDs so an update does not discard the operator's future ordering.
  const order = [...configured, ...discovered.filter(name => !configured.includes(name))];
  if (order.length > 512) throw Error('Plugin order limit exceeded');
  const revision = createHash('sha256').update(JSON.stringify({ configured, discovered })).digest('hex');
  return { ok: true, revision, pluginsLoadOrder: [...configured], order };
}

export function registerPluginLoadOrder(router: any, dependencies: {
  read: () => Settings;
  write: (value: Settings) => void;
  authorize: (ctx: any, write: boolean) => boolean;
  log: (message: string) => void;
}) {
  router.get('/api/admin/plugins/load-order', (ctx: any) => {
    if (!dependencies.authorize(ctx, false)) return;
    ctx.set('Cache-Control', 'no-store');
    try { ctx.body = inspectPluginLoadOrder(dependencies.read(), readDiscoveryState()); }
    catch { ctx.status = 503; ctx.body = { ok: false, code: 'PLUGIN_ORDER_UNAVAILABLE' }; }
  });
  router.put('/api/admin/plugins/load-order', (ctx: any) => {
    if (!dependencies.authorize(ctx, true)) return;
    ctx.set('Cache-Control', 'no-store');
    let sameOrigin = false;
    try { const origin = new URL(ctx.get('origin')); sameOrigin = ['http:', 'https:'].includes(origin.protocol) && origin.host === ctx.host; } catch {}
    if (!sameOrigin || ctx.get('content-type').split(';')[0].trim() !== 'application/json' || !['', 'same-origin', 'none'].includes(ctx.get('sec-fetch-site'))) {
      ctx.status = 403; ctx.body = { ok: false, code: 'PLUGIN_ORDER_ORIGIN_REQUIRED' }; return;
    }
    const body = ctx.request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some(key => !['revision', 'pluginsLoadOrder'].includes(key)) ||
        typeof body.revision !== 'string' || !/^[a-f0-9]{64}$/.test(body.revision) || !validOrder(body.pluginsLoadOrder)) {
      ctx.status = 400; ctx.body = { ok: false, code: 'INVALID_PLUGIN_ORDER' }; return;
    }
    try {
      const latest = dependencies.read();
      const current = inspectPluginLoadOrder(latest, readDiscoveryState());
      if (body.revision !== current.revision) {
        ctx.status = 409; ctx.body = { ok: false, code: 'STALE_PLUGIN_ORDER' }; return;
      }
      const requested = body.pluginsLoadOrder as string[];
      const known = new Set(current.order);
      if (requested.length !== known.size || !requested.every(name => known.has(name))) {
        ctx.status = 400; ctx.body = { ok: false, code: 'INVALID_PLUGIN_ORDER' }; return;
      }
      // Read the latest settings and replace only this key; preserve auth, mods and discovery flags.
      latest.pluginsLoadOrder = [...requested];
      dependencies.write(latest);
      dependencies.log(`Plugin load order saved (${requested.length} entries); effective at the next game start`);
      ctx.body = { ...inspectPluginLoadOrder(latest, readDiscoveryState()), restartRequired: true };
    } catch { ctx.status = 503; ctx.body = { ok: false, code: 'PLUGIN_ORDER_UNAVAILABLE' }; }
  });
}
