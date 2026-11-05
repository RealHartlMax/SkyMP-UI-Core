import React, { useEffect, useRef, useState } from 'react';
import { actionPayload, type MenuView, type MenuField } from '../shared/contracts';
import type { UiMessages } from '../shared/localization';
import type { UiModel } from './model';
import { PanelContent } from './panels';
import type { FrameworkMessages } from './framework-localization';

export function Menu({ view, model, changed, t, ft }: { view: MenuView; model: UiModel; changed: () => void; t: UiMessages; ft: FrameworkMessages }) {
  const ref = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<Record<string, unknown>>(() => Object.fromEntries((view.state.fields ?? []).map(f => [f.id, f.value ?? (f.type === 'checkbox' ? false : f.type === 'number' ? (f.min ?? 0) : f.type === 'select' ? f.options![0].value : '')])));
  const [selections, setSelections] = useState<Record<string, string>>({}), [invalid, setInvalid] = useState(false);
  const waiting = [...model.pending.values()].some(p => p.id === view.definition.id);
  useEffect(() => { ref.current?.querySelector<HTMLElement>('input:not(:disabled), select:not(:disabled), button:not(:disabled)')?.focus(); }, []);
  function field(f: MenuField) {
    const shared = { id: `ui-field-${view.definition.id}-${f.id}`, disabled: waiting, required: f.required, 'aria-label': f.label };
    if (f.type === 'select') return <select {...shared} value={String(values[f.id])} onChange={e => setValues({ ...values, [f.id]: e.target.value })}>{f.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
    if (f.type === 'checkbox') return <input {...shared} type="checkbox" checked={values[f.id] === true} onChange={e => setValues({ ...values, [f.id]: e.target.checked })} />;
    return <input {...shared} type={f.type} value={values[f.id] as any} maxLength={f.maxLength ?? 256} min={f.min} max={f.max}
      onChange={e => setValues({ ...values, [f.id]: f.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value })} />;
  }
  return <div className={view.definition.modal === false ? 'ui-menu-panel' : 'ui-modal-shade'}>
    <div className="ui-panel ui-menu" ref={ref} role="dialog" aria-modal={view.definition.modal !== false} aria-label={view.definition.title}
      onKeyDown={event => {
        if (event.key === 'Tab') {
          const items = [...(ref.current?.querySelectorAll<HTMLElement>('input:not(:disabled), select:not(:disabled), button:not(:disabled)') ?? [])]
            .filter(item => item.getClientRects().length > 0 && item.tabIndex >= 0);
          const first = items[0], last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <h2>{view.definition.title}</h2>{view.state.text && <p>{view.state.text}</p>}
      <form onSubmit={event => { event.preventDefault(); }}>
        {view.state.content && <PanelContent content={view.state.content} selections={selections} onSelect={(id, row) => { setSelections(previous => ({ ...previous, [id]: row })); setInvalid(false); }} disabled={waiting} namespace={view.definition.id} t={ft} />}
        {(view.state.fields ?? []).map(f => <label className="ui-field" key={f.id} htmlFor={`ui-field-${view.definition.id}-${f.id}`}>{f.label}{field(f)}</label>)}
        <div className="ui-actions">{view.state.actions.map(action => <button type="button" key={action.id} disabled={waiting} className={'tone-' + (action.tone ?? 'info')}
          onClick={e => {
            if (e.currentTarget.form?.reportValidity() === false) return;
            const payload = { values, ...(view.state.content ? { selections, revision: view.revision } : {}) };
            try { actionPayload(view.state, payload, view.revision); }
            catch { setInvalid(true); return; }
            setInvalid(false); model.action(view.definition.id, action.id, payload); changed();
          }}>{action.label}</button>)}
          <button type="button" onClick={() => { model.dismiss(); changed(); }}>{t.close}</button></div>
      </form>{invalid && <p role="alert">{ft.invalid}</p>}{waiting && <p role="status">{t.pending}</p>}
    </div>
  </div>;
}
