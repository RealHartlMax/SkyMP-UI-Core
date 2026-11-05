import React, { useRef, useState } from 'react';
import type { UiContentBlock, UiPanelContent } from '../shared/contracts';
import type { FrameworkMessages } from './framework-localization';

export function PanelContent({ content, selections, onSelect, disabled, namespace, t }: {
  content: UiPanelContent; selections: Record<string, string>; onSelect: (block: string, row: string) => void;
  disabled: boolean; namespace: string; t: FrameworkMessages;
}) {
  const [tabId, setTabId] = useState(content.tabs?.[0]?.id);
  const tabsRef = useRef<HTMLDivElement>(null);
  const tab = content.tabs?.find(tab => tab.id === tabId) ?? content.tabs?.[0];
  function choice(block: Extract<UiContentBlock, { kind: 'list' | 'item-list' | 'table' }>, row: {id: string; disabled?: boolean}, label: string) {
    return block.selectable && <input type="radio" name={namespace + ':' + block.id} aria-label={t.select + ' ' + label}
      checked={selections[block.id] === row.id} disabled={disabled || row.disabled}
      onChange={() => onSelect(block.id, row.id)} />;
  }
  function block(b: UiContentBlock) {
    const labelId = namespace + ':block:' + b.id;
    if (b.kind === 'text') return <section key={b.id} className={'ui-content-block tone-' + (b.tone ?? 'info')}>
      {b.label && <h3>{b.label}</h3>}<p>{b.text}</p></section>;
    if (b.kind === 'progress') return <section key={b.id} className="ui-content-block"><h3>{b.label}</h3>
      <progress aria-label={b.label} value={b.value} max={b.max} /><output>{b.value} / {b.max}</output></section>;
    if (b.kind === 'table') return <section key={b.id} className="ui-content-block" aria-labelledby={labelId}>
      <h3 id={labelId}>{b.label}</h3>{!b.rows.length ? <p>{t.empty}</p> : <div className="ui-table-scroll"><table aria-label={b.label}>
        <thead><tr>{b.selectable && <th scope="col">{t.select}</th>}{b.columns.map(c => <th key={c.id} scope="col">{c.label}</th>)}</tr></thead>
        <tbody>{b.rows.map(row => <tr key={row.id} className={selections[b.id] === row.id ? 'ui-row-selected' : undefined}>
          {b.selectable && <td>{choice(b, row, row.cells.map(String).join(' · '))}</td>}{row.cells.map((cell, i) => <td key={b.columns[i].id}>{cell}</td>)}
        </tr>)}</tbody></table></div>}</section>;
    return <section key={b.id} className="ui-content-block" aria-labelledby={labelId}><h3 id={labelId}>{b.label}</h3>
      {!b.items.length ? <p>{t.empty}</p> : <ul className="ui-content-list">{b.items.map(row => <li key={row.id}>
        <label className="ui-content-row">{choice(b, row, row.label)}<span>{row.label}</span>
          {'quantity' in row && row.quantity !== undefined && <span className="ui-item-quantity">× {String(row.quantity)}</span>}
          {row.value !== undefined && <span className="ui-row-value">{row.value}</span>}
        </label>{row.detail && <p className="ui-row-detail">{row.detail}</p>}
      </li>)}</ul>}</section>;
  }
  return <div className="ui-panel-content">
    {content.blocks.map(block)}
    {content.tabs && <><div ref={tabsRef} className="ui-tabs" role="tablist" aria-label={t.tabs} onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const tabs = content.tabs!, current = tabs.findIndex(t => t.id === tab?.id);
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      setTabId(tabs[index].id); tabsRef.current?.querySelectorAll<HTMLElement>('[role=tab]')[index]?.focus();
    }}>{content.tabs.map(item => <button key={item.id} id={namespace + ':tab:' + item.id} type="button" role="tab"
      aria-selected={item.id === tab?.id} aria-controls={namespace + ':tabpanel:' + item.id} tabIndex={item.id === tab?.id ? 0 : -1}
      onClick={() => setTabId(item.id)}>{item.label}</button>)}</div>
      {content.tabs.map(item => <div key={item.id} id={namespace + ':tabpanel:' + item.id} role="tabpanel"
        aria-labelledby={namespace + ':tab:' + item.id} hidden={item.id !== tab?.id}>{item.blocks.map(block)}</div>)}
    </>}
  </div>;
}
