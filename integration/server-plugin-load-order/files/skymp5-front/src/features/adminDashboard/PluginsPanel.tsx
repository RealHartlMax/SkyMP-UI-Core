import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './plugins.scss';

type RuntimeState = 'starting' | 'running' | 'failed' | 'stopped';
type DiscoveryMode = 'safe' | 'prompt' | 'auto';
type PendingWrite = { kind: 'plugin'; name: string } | { kind: 'all' } | { kind: 'mode' } | { kind: 'order' };
interface OrderSnapshot { ok: true; revision: string; pluginsLoadOrder: string[]; order: string[] }
const validNames = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 512 && value.every(name => typeof name === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(name)) && new Set(value).size === value.length;
const isOrder = (value: any): value is OrderSnapshot => value?.ok === true && /^[a-f0-9]{64}$/.test(value.revision) && validNames(value.order) && validNames(value.pluginsLoadOrder);
const isMode = (value: unknown): value is DiscoveryMode => ['safe', 'prompt', 'auto'].includes(value as string);
interface ServerPlugin {
  name: string; pluginPath: string; version: string; startupEnabled: boolean; manifestPresent: boolean;
  runtimeStatus: { status: RuntimeState; pid?: number; message?: string } | null;
}

export function PluginsPanel({ canView, canEdit, active = true }: { canView: boolean; canEdit: boolean; active?: boolean }) {
  const { t } = useTranslation();
  const text = (key: string, options?: Record<string, unknown>) => t(`adminDashboard.plugins.${key}`, options);
  const [plugins, setPlugins] = useState<ServerPlugin[] | null>(null);
  const [loading, setLoading] = useState(true), [loadFailed, setLoadFailed] = useState(false), [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState<PendingWrite | null>(null), [mode, setMode] = useState<DiscoveryMode | null>(null);
  const [snapshot, setSnapshot] = useState<OrderSnapshot | null>(null), [order, setOrder] = useState<string[]>([]);
  const [notice, setNotice] = useState<'saved' | 'allSaved' | 'modeSaved' | 'orderSaved' | 'orderStale' | 'saveFailed' | 'forbidden' | null>(null);
  const [enabledCount, setEnabledCount] = useState(0), [search, setSearch] = useState('');
  const mutation = useRef<AbortController | null>(null), panel = useRef<HTMLElement | null>(null);
  const dirty = Boolean(snapshot && JSON.stringify(order) !== JSON.stringify(snapshot.order));

  useEffect(() => () => { mutation.current?.abort(); mutation.current = null; }, []);
  useEffect(() => {
    if (!active || !canView || saving || dirty) return;
    let closed = false, pending = false;
    let controller: AbortController | undefined;
    const load = async () => {
      if (pending) return;
      pending = true; controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10000);
      try {
        const options = { credentials: 'same-origin' as const, cache: 'no-store' as const, signal: controller.signal };
        const [response, policyResponse, orderResponse] = await Promise.all([
          fetch('/api/admin/plugins', options), fetch('/api/admin/plugins/settings', options), fetch('/api/admin/plugins/load-order', options),
        ]);
        if (!response.ok) throw Error();
        const data: ServerPlugin[] = await response.json(); if (!Array.isArray(data)) throw Error();
        const policy = policyResponse.ok ? await policyResponse.json() : null;
        const loadOrder = orderResponse.ok ? await orderResponse.json() : null;
        if (!closed) {
          setPlugins(data); setMode(isMode(policy?.mode) ? policy.mode : null);
          setSnapshot(isOrder(loadOrder) ? loadOrder : null); setOrder(isOrder(loadOrder) ? loadOrder.order : []);
          setLoadFailed(false);
        }
      } catch { if (!closed) setLoadFailed(true); }
      finally { clearTimeout(timeout); pending = false; if (!closed) setLoading(false); }
    };
    void load(); const interval = setInterval(() => void load(), 5000);
    return () => { closed = true; controller?.abort(); clearInterval(interval); };
  }, [active, canView, saving, refresh, dirty]);

  async function write(pending: PendingWrite, url: string, method: 'PATCH' | 'POST' | 'PUT', body: unknown) {
    if (!canEdit || saving || loading) return;
    const controller = new AbortController(); mutation.current = controller; setSaving(pending); setNotice(null);
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, { method, credentials: 'same-origin', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!response.ok) { setNotice(response.status === 403 ? 'forbidden' : response.status === 409 && pending.kind === 'order' ? 'orderStale' : 'saveFailed'); return; }
      const data = await response.json(); if (data.ok !== true) throw Error(); if (mutation.current !== controller) return;
      if (pending.kind === 'plugin') {
        if (typeof data.startupEnabled !== 'boolean') throw Error();
        setPlugins(previous => previous?.map(entry => entry.name === pending.name ? { ...entry, startupEnabled: data.startupEnabled } : entry) || null); setNotice('saved');
      } else if (pending.kind === 'all') {
        if (!Array.isArray(data.names) || typeof data.count !== 'number') throw Error(); const enabled = new Set(data.names);
        setPlugins(previous => previous?.map(entry => enabled.has(entry.name) ? { ...entry, startupEnabled: true } : entry) || null);
        setEnabledCount(data.count); setNotice('allSaved');
      } else if (pending.kind === 'order') {
        if (!isOrder(data)) throw Error(); setSnapshot(data); setOrder(data.order); setNotice('orderSaved');
      } else { if (!isMode(data.mode)) throw Error(); setMode(data.mode); setNotice('modeSaved'); }
    } catch { if (mutation.current === controller) setNotice('saveFailed'); }
    finally { clearTimeout(timeout); if (mutation.current === controller) { mutation.current = null; setSaving(null); } }
  }
  const busy = loading || Boolean(saving);
  const move = (index: number, delta: number) => {
    if (!canEdit || busy || index + delta < 0 || index + delta >= order.length) return;
    const name = order[index]; setOrder(previous => { const next = [...previous]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; return next; });
    requestAnimationFrame(() => {
      const row = panel.current?.querySelector<HTMLElement>(`[data-plugin="${CSS.escape(name)}"]`);
      const preferred = row?.querySelector<HTMLButtonElement>(`[data-order-move="${delta}"]:not(:disabled)`);
      (preferred || row?.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus();
    });
  };
  const byName = new Map((plugins || []).map(plugin => [plugin.name, plugin]));
  const ordered = (snapshot ? order : [...byName.keys()].sort((a, b) => a.localeCompare(b))).map(name => byName.get(name) || {
    name, pluginPath: '—', version: '—', startupEnabled: false, manifestPresent: false, runtimeStatus: null,
  });
  const matches = ordered.filter(plugin => `${plugin.name} ${plugin.pluginPath}`.toLowerCase().includes(search.trim().toLowerCase()));
  const disabledCount = (plugins || []).filter(plugin => !plugin.startupEnabled && plugin.manifestPresent).length;
  return <section className="server-plugins" data-testid="server-plugins" aria-labelledby="server-plugins-title" ref={panel}>
    <header><div><h2 id="server-plugins-title">{text('title')}</h2><p>{text('intro')}</p></div>
      <div className="server-plugins__actions">
        <button type="button" className="server-plugins__enable-all" disabled={!canView || !canEdit || busy || dirty || disabledCount === 0}
          onClick={() => void write({ kind: 'all' }, '/api/admin/plugins/enable-all', 'POST', {})}>{text('enableAll', { count: disabledCount })}</button>
        <button type="button" disabled={!canView || busy || dirty} onClick={() => { setLoading(true); setRefresh(value => value + 1); }}>{text('refresh')}</button>
      </div>
    </header>
    {!canView ? <p>{text('noPermission')}</p> : <>
      <p className="server-plugins__hint">{text('discoveryHint')} <code>Plugins/&lt;Name&gt;/plugin.json</code></p><p>{text('restartHint')}</p>
      {mode ? <label className="server-plugins__policy">{text('newPlugins')}<select value={mode} disabled={!canEdit || busy || dirty}
        onChange={event => void write({ kind: 'mode' }, '/api/admin/plugins/settings', 'PUT', { mode: event.target.value })}>
        <option value="safe">{text('modeSafe')}</option><option value="auto">{text('modeAuto')}</option><option value="prompt">{text('modePrompt')}</option>
      </select><small>{text('modeHint')}</small></label> : plugins && <p role="alert">{text('modeUnavailable')}</p>}
      {!canEdit && <p>{text('readOnly')}</p>}
      {notice && <p className="server-plugins__notice" role={['saveFailed', 'forbidden', 'orderStale'].includes(notice) ? 'alert' : 'status'}>{text(notice, { count: enabledCount })}</p>}
      {loadFailed && <p className="server-plugins__notice" role="alert">{text('loadFailed')}</p>}
      {loading && !plugins && <p role="status">{text('loading')}</p>}
      {plugins && <>
        <h3>{text('orderTitle')}</h3><p>{text('orderHint')}</p>
        {!snapshot && <p role="alert">{text('orderUnavailable')}</p>}
        <label className="server-plugins__search">{text('search')}<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
        {ordered.length === 0 ? <p>{text('empty')}</p> : matches.length === 0 ? <p>{text('noMatches')}</p> :
          <ol className="server-plugins__list">{matches.map(plugin => {
            const runtime = plugin.runtimeStatus, index = order.indexOf(plugin.name);
            return <li key={plugin.name} className="server-plugins__entry" data-plugin={plugin.name}>
              {snapshot && <div className="server-plugins__moves"><strong aria-label={text('orderPosition', { position: index + 1 })}>{index + 1}</strong>
                <button type="button" data-order-move="-1" disabled={!canEdit || busy || index === 0} aria-label={`${text('orderUp')}: ${plugin.name}`} onClick={() => move(index, -1)}>↑</button>
                <button type="button" data-order-move="1" disabled={!canEdit || busy || index === order.length - 1} aria-label={`${text('orderDown')}: ${plugin.name}`} onClick={() => move(index, 1)}>↓</button>
              </div>}
              <div className="server-plugins__details"><h3>{plugin.name} <span>{text('version', { version: plugin.version })}</span></h3><code>{plugin.pluginPath}</code>
                {!plugin.manifestPresent && <p className="server-plugins__error">{text('missingManifest')}</p>}{runtime?.message && <p className="server-plugins__message">{runtime.message}</p>}
              </div>
              <div className="server-plugins__state"><span>{text('runtime')}</span><strong className={`server-plugins__badge server-plugins__badge--${runtime?.status || 'unknown'}`}>{text(runtime?.status || 'unknown')}</strong>{runtime?.pid && <small>PID {runtime.pid}</small>}</div>
              <div className="server-plugins__startup"><span>{text('startup')}<small>{text(plugin.startupEnabled ? 'enabled' : 'disabled')}</small></span>
                <button type="button" disabled={!canEdit || busy || dirty || (!plugin.manifestPresent && !plugin.startupEnabled)}
                  onClick={() => void write({ kind: 'plugin', name: plugin.name }, `/api/admin/plugins/${encodeURIComponent(plugin.name)}`, 'PATCH', { startupEnabled: !plugin.startupEnabled })}
                  aria-label={`${text(plugin.startupEnabled ? 'disable' : 'enable')}: ${plugin.name}`}>{saving?.kind === 'plugin' && saving.name === plugin.name ? text('saving') : text(plugin.startupEnabled ? 'disable' : 'enable')}</button>
              </div>
            </li>;
          })}</ol>}
        {snapshot && <footer className="server-plugins__order-actions">
          <button type="button" className="server-plugins__enable-all" disabled={!canEdit || busy || !dirty} onClick={() => void write({ kind: 'order' }, '/api/admin/plugins/load-order', 'PUT', { revision: snapshot.revision, pluginsLoadOrder: order })}>{text('orderSave')}</button>
          <button type="button" disabled={busy || !dirty} onClick={() => { setOrder(snapshot.order); setNotice(null); setRefresh(value => value + 1); }}>{text('orderDiscard')}</button>
          {dirty && <span role="status">{text('orderChanged')}</span>}
        </footer>}
      </>}
    </>}
  </section>;
}
