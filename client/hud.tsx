import React, { useEffect, useRef } from 'react';
import { clamp, isMedallion, meterValue, normalizedPoint, shortLabel, type HudElement, type Placement, type Size } from './layout';
import type { ElementPreference } from './model';
import type { EditorMessages } from './editor-localization';
const RUNES = ['M43 26v48m0-34 18-12M43 53l18-12M43 66 30 55', 'M39 73V27l23 17M39 41l15 10', 'M50 25 31 49l19 24 19-24-19-24M31 49v25m38-25v25'];
function Widget({ element }: { element: HudElement }) {
  const s: any = element.widget.state;
  if (isMedallion(element)) {
    const item = element.item ?? { label: element.label, value: s.value, tone: s.tone };
    const meter = meterValue(item.value), index = element.index ?? 0;
    const detail = meter ? meter.status : element.item ? item.value : s.text;
    const title = [item.label, item.value, !element.item && s.text].filter(value => value !== undefined && value !== false && value !== '').join(' · ');
    return <div className={'ui-status ui-sigil-' + (index % 3) + (!element.item ? ' ui-standalone-status' : '') + ' tone-' + (item.tone ?? 'info')} title={title}>
      <div className="ui-medallion">
        <svg className="ui-meter-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="ui-meter-bezel" cx="50" cy="50" r="48" />
          <path className="ui-meter-engraving" d="M50 0l4 5-4 5-4-5zM50 90l4 5-4 5-4-5zM0 50l5-4 5 4-5 4zM90 50l5-4 5 4-5 4z" />
          <circle className="ui-meter-track" cx="50" cy="50" r="41" />
          {meter && <circle className="ui-meter-fill" cx="50" cy="50" r="41" pathLength="100" strokeDasharray={meter.percent + ' 100'} transform="rotate(-90 50 50)" />}
        </svg>
        <svg className="ui-rune" viewBox="0 0 100 100" aria-hidden="true"><path d={RUNES[index % RUNES.length]} /></svg>
        {meter && <span className="ui-meter-number">{meter.text}<small> / {meter.max}</small></span>}
        {!meter && !element.item && item.value !== undefined && <span className="ui-meter-number ui-status-value">{item.value}</span>}
      </div>
      <span className="ui-status-label">{shortLabel(item.label)}</span>
      <span className="ui-status-detail">{detail}</span>
      {meter && <progress className="ui-sr-only" aria-label={item.label} value={meter.value} max={meter.max} />}
    </div>;
  }
  if (element.widget.definition.kind === 'progress') return <><span>{s.label}</span><progress value={s.value} max={s.max} aria-label={s.label} /><span>{s.value} / {s.max}</span></>;
  return <div className={'tone-' + (s.tone ?? 'info')}>{s.label && <strong>{s.label}</strong>}{s.value !== undefined && <span className="ui-value">{s.value}</span>}{s.text && <p>{s.text}</p>}</div>;
}
interface Props {
  element: HudElement; placement: Placement; preference: ElementPreference; viewport: Size;
  editing: boolean; selected: boolean; hidden: boolean; t: EditorMessages;
  onSelect(key: string): void; onChange(key: string, next: ElementPreference): void; onMeasure(key: string, size: Size): void;
}
export function HudItem({ element, placement, preference, viewport, editing, selected, hidden, t, onSelect, onChange, onMeasure }: Props) {
  const content = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number; left: number; top: number; size: Size; scale: number; resize: boolean } | null>(null);
  useEffect(() => {
    const node = content.current; if (!node) return;
    const measure = () => onMeasure(element.key, { width: node.offsetWidth, height: node.offsetHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure); observer.observe(node); return () => observer.disconnect();
  }, [element.key, onMeasure]);
  return <section className={'ui-layout-item' + (editing ? ' ui-editable' : '') + (selected ? ' ui-selected' : '') + (hidden ? ' ui-hidden-preview' : '')}
    data-widget-id={element.widget.definition.id} data-element-key={element.key} role={editing ? 'button' : 'group'}
    aria-label={(editing ? t.move + ': ' : '') + element.label} aria-pressed={editing ? selected : undefined} tabIndex={editing ? 0 : undefined}
    style={{ left: placement.left, top: placement.top, width: placement.width, height: placement.height }}
    onFocus={() => { if (editing) onSelect(element.key); }}
    onPointerDown={e => {
      if (!editing || e.button !== 0) return; e.preventDefault(); e.currentTarget.focus(); onSelect(element.key);
      const resize = (e.target as HTMLElement).closest('[data-resize]') !== null;
      gesture.current = { x: e.clientX, y: e.clientY, left: placement.left, top: placement.top, size: placement, scale: preference.scale ?? 100, resize };
      e.currentTarget.setPointerCapture(e.pointerId);
    }}
    onPointerMove={e => {
      const start = gesture.current; if (!editing || !start) return;
      if (start.resize) {
        const factor = Math.max((start.size.width + e.clientX - start.x) / start.size.width, (start.size.height + e.clientY - start.y) / start.size.height);
        const scale = clamp(Math.round(start.scale * factor), 75, 150), ratio = scale / start.scale;
        onChange(element.key, { scale, ...normalizedPoint(start.left, start.top, { width: start.size.width * ratio, height: start.size.height * ratio }, viewport) });
      } else onChange(element.key, normalizedPoint(start.left + e.clientX - start.x, start.top + e.clientY - start.y, start.size, viewport));
    }}
    onPointerUp={e => { gesture.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
    onPointerCancel={() => { gesture.current = null; }} onLostPointerCapture={() => { gesture.current = null; }}
    onKeyDown={e => {
      if (!editing) return;
      const delta: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (delta[e.key]) { e.preventDefault(); e.stopPropagation(); const [x, y] = delta[e.key], step = e.shiftKey ? 10 : 1;
        onChange(element.key, normalizedPoint(placement.left + x * step, placement.top + y * step, placement, viewport)); }
      else if (['+', '=', '-', '_'].includes(e.key)) { e.preventDefault(); onChange(element.key, { scale: clamp((preference.scale ?? 100) + (['+', '='].includes(e.key) ? 5 : -5), 75, 150) }); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(element.key); }
    }}>
    <div ref={content} className={isMedallion(element) ? 'ui-item-content ui-meter-content' : 'ui-item-content ui-panel ui-widget'} style={{ transform: 'scale(' + placement.scale + ')' }}><Widget element={element} /></div>
    {editing && <><span className="ui-edit-label">{shortLabel(element.label)}{hidden ? ' · ' + t.hidden : ''}</span>
      <span className="ui-resize-handle" data-resize="true" title={t.resize} aria-hidden="true">⌟</span></>}
  </section>;
}
