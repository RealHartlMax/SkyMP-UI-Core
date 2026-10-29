import React, { useCallback, useEffect, useRef, useState } from 'react';
import { UiModel, readPreferences, emptyPreferences, createDismissGuard, type Preferences, type ElementPreference } from './model';
import { POSITIONS, type MenuView, type MenuField, type Position } from '../shared/contracts';
import { bundledTranslations, type Locale, type UiMessages } from '../shared/localization';
import { editorTranslations } from './editor-localization';
import { elementPreference, hudElements, placeElements, shortLabel, type Size } from './layout';
import { HudItem } from './hud';
declare global { interface Window { skyrimPlatform?: any } }
const send = (type: string, data?: unknown) => { try { window.skyrimPlatform?.sendMessage?.(type, data); } catch { /* Native bridge may be absent. */ } };
function Menu({ view, model, changed, t }: { view: MenuView; model: UiModel; changed: () => void; t: UiMessages }) {
  const ref = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<Record<string, unknown>>(() => Object.fromEntries((view.state.fields ?? []).map(f => [f.id, f.value ?? (f.type === 'checkbox' ? false : f.type === 'number' ? (f.min ?? 0) : f.type === 'select' ? f.options![0].value : '')])));
  const waiting = [...model.pending.values()].some(p => p.id === view.definition.id);
  useEffect(() => { ref.current?.querySelector<HTMLElement>('input, select, button')?.focus(); }, []);
  function field(f: MenuField) {
    const shared = { id: `ui-field-${f.id}`, disabled: waiting, required: f.required, 'aria-label': f.label };
    if (f.type === 'select') return <select {...shared} value={String(values[f.id])} onChange={e => setValues({ ...values, [f.id]: e.target.value })}>{f.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
    if (f.type === 'checkbox') return <input {...shared} type="checkbox" checked={values[f.id] === true} onChange={e => setValues({ ...values, [f.id]: e.target.checked })} />;
    return <input {...shared} type={f.type} value={values[f.id] as any} maxLength={f.maxLength ?? 256} min={f.min} max={f.max}
      onChange={e => setValues({ ...values, [f.id]: f.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value })} />;
  }
  return <div className={view.definition.modal === false ? 'ui-menu-panel' : 'ui-modal-shade'}>
    <div className="ui-panel ui-menu" ref={ref} role="dialog" aria-modal={view.definition.modal !== false} aria-label={view.definition.title}
      onKeyDown={event => {
        if (event.key === 'Tab') {
          const items = [...(ref.current?.querySelectorAll<HTMLElement>('input:not(:disabled), select:not(:disabled), button:not(:disabled)') ?? [])];
          const first = items[0], last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <h2>{view.definition.title}</h2>{view.state.text && <p>{view.state.text}</p>}
      <form onSubmit={event => { event.preventDefault(); }}>
        {(view.state.fields ?? []).map(f => <label className="ui-field" key={f.id} htmlFor={'ui-field-' + f.id}>{f.label}{field(f)}</label>)}
        <div className="ui-actions">{view.state.actions.map(action => <button type="button" key={action.id} disabled={waiting} className={'tone-' + (action.tone ?? 'info')}
          onClick={e => { if (e.currentTarget.form?.reportValidity() === false) return; model.action(view.definition.id, action.id, { values }); changed(); }}>{action.label}</button>)}
          <button type="button" onClick={() => { model.dismiss(); changed(); }}>{t.close}</button></div>
      </form>{waiting && <p role="status">{t.pending}</p>}
    </div>
  </div>;
}
function Host() {
  const modelRef = useRef<UiModel>(); if (!modelRef.current) modelRef.current = new UiModel(send);
  const model = modelRef.current;
  const [, render] = useState(0); const changed = () => render(n => n + 1);
  const [preferences, setPreferences] = useState<Preferences>(emptyPreferences);
  const preferencesRef = useRef(preferences); preferencesRef.current = preferences;
  const [editing, setEditing] = useState(false), editingRef = useRef(false), beforeEdit = useRef(preferences);
  const [selected, setSelected] = useState(''), [language, setLanguage] = useState<Locale | null>(null);
  const [feedback, setFeedback] = useState('');
  const [viewport, setViewport] = useState<Size>({ width: window.innerWidth, height: window.innerHeight });
  const [measured, setMeasured] = useState<Record<string, Size>>({});
  const onMeasure = useCallback((key: string, size: Size) => setMeasured(previous => previous[key]?.width === size.width && previous[key]?.height === size.height ? previous : { ...previous, [key]: size }), []);
  const preferenceKey = model.frame?.preferenceKey;
  const menus = model.visibleMenus(), top = menus[menus.length - 1];
  const wantsFocus = model.status === 'ready' && model.allowed && (editing || menus.length > 0);
  const effectiveLanguage = language ?? model.frame?.locale ?? 'de';
  const t = model.frame?.translations[effectiveLanguage] ?? bundledTranslations[effectiveLanguage];
  const et = editorTranslations[effectiveLanguage];
  const openEditor = () => {
    if (!model.frame || editingRef.current) return;
    beforeEdit.current = preferencesRef.current; editingRef.current = true; setEditing(true); setFeedback('');
  };
  const finishEditor = (save: boolean) => {
    if (save) {
      let persisted = false;
      try { if (preferenceKey) { window.localStorage.setItem('skymp-ui.v1.' + preferenceKey, JSON.stringify(preferencesRef.current)); persisted = true; } } catch { /* Session layout remains usable without CEF storage. */ }
      setFeedback(persisted ? et.saved : et.notSaved);
    } else setPreferences(beforeEdit.current);
    editingRef.current = false; setEditing(false);
  };
  const controls = useRef({ openEditor, finishEditor }); controls.current = { openEditor, finishEditor };
  useEffect(() => {
    const receive = (event: Event) => {
      const requests = model.editorRequests;
      model.receive((event as CustomEvent).detail);
      if (!model.frame) { editingRef.current = false; setEditing(false); setSelected(''); setMeasured({}); setFeedback(''); }
      else if (model.editorRequests > requests) controls.current.openEditor();
      changed();
    };
    const probe = () => model.announce();
    const focused = () => { model.focused = true; changed(); };
    const unfocused = () => { model.focused = false; changed(); };
    const acceptDismiss = createDismissGuard();
    const dismiss = (source: 'native' | 'dom') => {
      if (!acceptDismiss(source)) return;
      if (editingRef.current) controls.current.finishEditor(false); else model.dismiss(); changed();
    };
    const nativeDismiss = () => dismiss('native');
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (model.visibleMenus().length || editingRef.current)) { event.preventDefault(); event.stopImmediatePropagation(); if (!event.repeat) dismiss('dom'); }
      if (event.key === 'Tab' && editingRef.current) {
        const items = [...document.querySelectorAll<HTMLElement>('.skymp-ui-core .ui-editable, .ui-editor-panel input:not(:disabled), .ui-editor-panel select:not(:disabled), .ui-editor-panel button:not(:disabled)')];
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1]?.focus(); }
        else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0]?.focus(); }
      }
    };
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('skympUi:packet', receive); window.addEventListener('skympUi:probe', probe);
    window.addEventListener('skympUi:dismiss', nativeDismiss); window.addEventListener('keydown', key, true); window.addEventListener('resize', resize);
    window.addEventListener('skymp5-client:browserFocused', focused); window.addEventListener('skymp5-client:browserUnfocused', unfocused);
    model.announce(); const tick = setInterval(() => { model.tick(); changed(); }, 250);
    return () => { clearInterval(tick); window.removeEventListener('skympUi:packet', receive); window.removeEventListener('skympUi:probe', probe);
      window.removeEventListener('skympUi:dismiss', nativeDismiss); window.removeEventListener('keydown', key, true); window.removeEventListener('resize', resize);
      window.removeEventListener('skymp5-client:browserFocused', focused); window.removeEventListener('skymp5-client:browserUnfocused', unfocused);
      send('skympUi:focus', false); };
  }, [model]);
  useEffect(() => { send('skympUi:focus', wantsFocus); }, [wantsFocus, model.frame?.sessionId]);
  useEffect(() => {
    editingRef.current = false; setEditing(false); setLanguage(null);
    if (!preferenceKey) { setPreferences(emptyPreferences()); return; }
    let storage: Storage | null = null; try { storage = window.localStorage; } catch { /* CEF can disable storage. */ }
    setPreferences(readPreferences(storage, preferenceKey));
  }, [preferenceKey, model.frame?.sessionId]);
  const registryKeys = model.frame?.widgets.map(widget => widget.definition.id + ':' + (widget.definition.kind === 'icon-list' ? (widget.state as any).items.length : 1)).join('|');
  useEffect(() => {
    const active = new Set(hudElements(model.frame?.widgets ?? []).map(element => element.key));
    setMeasured(previous => Object.keys(previous).every(key => active.has(key)) ? previous : Object.fromEntries(Object.entries(previous).filter(([key]) => active.has(key))));
  }, [registryKeys]);
  useEffect(() => { if (!feedback) return; const timer = setTimeout(() => setFeedback(''), 5000); return () => clearTimeout(timer); }, [feedback]);
  function updateElement(key: string, next: ElementPreference) {
    setPreferences(previous => {
      const widgets = { ...previous.widgets, [key]: { ...previous.widgets[key], ...next } };
      // Bound persisted layout entries even if a server rotates widget IDs over time.
      let excess = Math.max(0, Object.keys(widgets).length - 160);
      for (const old of Object.keys(widgets)) if (excess > 0 && old !== key) { delete widgets[old]; excess--; }
      return { ...previous, widgets };
    });
  }
  if (!model.frame || !model.allowed) return null;
  const elements = hudElements(model.frame.widgets.filter(widget => widget.visible && widget.expiresAt > model.serverNow()));
  const placements = placeElements(elements, preferences, viewport, measured);
  const selection = elements.find(element => element.key === selected), current = selection ? elementPreference(preferences, selection) : null;
  return <div className={'skymp-ui-core' + (editing ? ' ui-edit-mode' : '')} data-ui-protocol="1" style={{ '--ui-scale': preferences.scale / 100 } as React.CSSProperties}>
    {editing && <div className="ui-editor-grid" aria-hidden="true" />}
    {elements.map(element => {
      const pref = elementPreference(preferences, element); if (pref.hidden && !editing) return null;
      return <HudItem key={element.key} element={element} placement={placements[element.key]} preference={pref} viewport={viewport} editing={editing}
        selected={editing && selected === element.key} hidden={!!pref.hidden} t={et} onSelect={setSelected} onChange={updateElement} onMeasure={onMeasure} />;
    })}
    <div className="ui-notifications" role="log" aria-live="polite">{model.frame.notifications.filter(n => n.expiresAt > model.serverNow()).slice(-4).map(n => <div key={n.id} className={'ui-panel ui-notice tone-' + n.tone}><strong>{t[n.tone]}</strong> {n.message}</div>)}</div>
    {!editing && top && <Menu key={top.definition.id + ':' + top.expiresAt} view={top} model={model} changed={changed} t={t} />}
    {model.focused && !editing && <button className="ui-display-button" type="button" onClick={openEditor}>{t.display}</button>}
    {editing && <aside className="ui-panel ui-editor-panel" role="dialog" aria-modal="false" aria-label={et.edit}>
      <span className="ui-editor-eyebrow">SKYMP · HUD</span><h2>{et.edit}</h2><p className="ui-editor-hint">{et.hint}</p><div className="ui-editor-scroll">
      <label className="ui-field">{et.selectElement}<select autoFocus aria-label={et.selectElement} value={selection?.key ?? ''} onChange={event => setSelected(event.target.value)}>
        <option value="">—</option>{elements.map(element => <option key={element.key} value={element.key}>{shortLabel(element.label)}</option>)}
      </select></label>
      {!elements.length && <p role="status">{et.noElements}</p>}
      {selection && current ? <fieldset><legend>{shortLabel(selection.label)}</legend>
        <label className="ui-field">{et.elementScale} <output>{current.scale ?? 100}%</output><input type="range" min="75" max="150" step="1" aria-label={et.elementScale} value={current.scale ?? 100} onChange={event => updateElement(selection.key, { scale: Number(event.target.value) })} /></label>
        <label className="ui-checkbox"><input type="checkbox" checked={!current.hidden} onChange={event => updateElement(selection.key, { hidden: !event.target.checked })} />{t.visible}</label>
        <label className="ui-field">{t.position}<select aria-label={t.position + ' ' + selection.key} value={current.position ?? selection.widget.definition.defaultPosition ?? 'top-right'} onChange={event => {
          updateElement(selection.key, { position: event.target.value as Position, x: undefined, y: undefined });
        }}>{POSITIONS.map(position => <option key={position} value={position}>{t[position]}</option>)}</select></label>
        <button type="button" onClick={() => setPreferences(previous => { const widgets = { ...previous.widgets }; delete widgets[selection.key]; return { ...previous, widgets }; })}>{et.resetElement}</button>
      </fieldset> : <p className="ui-editor-hint">{et.emptySelection}</p>}
      <label className="ui-field">{et.globalScale} <output>{preferences.scale}%</output><input aria-label={t.scale} type="range" min="75" max="150" step="5" value={preferences.scale} onChange={event => setPreferences(previous => ({ ...previous, scale: Number(event.target.value) }))} /></label>
      <label className="ui-field">{t.language}<select aria-label={t.language} value={effectiveLanguage} onChange={event => setLanguage(event.target.value as Locale)}><option value="de">Deutsch</option><option value="en">English</option></select></label>
      <p className="ui-editor-keyboard">{et.keyboard}</p><p className="ui-editor-hint">{et.localOnly}</p></div>
      <div className="ui-actions"><button type="button" className="ui-primary" onClick={() => finishEditor(true)}>{et.save}</button><button type="button" onClick={() => finishEditor(false)}>{et.cancel}</button><button type="button" onClick={() => setPreferences(emptyPreferences())}>{et.reset}</button></div>
    </aside>}
    {feedback && <p className="ui-layout-feedback ui-panel" role="status">{feedback}</p>}
  </div>;
}
class HostBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { send('skympUi:focus', false); }
  render() { return this.state.failed ? null : this.props.children; }
}
export function UiCoreHost() { return <HostBoundary><Host /></HostBoundary>; }
