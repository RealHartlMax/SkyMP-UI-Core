import type { ListState, Position, WidgetView } from '../shared/contracts';
import type { ElementPreference, Preferences } from './model';
export interface Size { width: number; height: number }
export interface Point { x: number; y: number }
export interface HudElement { key: string; widget: WidgetView; label: string; item?: ListState['items'][number]; index?: number }
export interface Placement { left: number; top: number; width: number; height: number; scale: number }
export function isMedallion(element: HudElement): boolean {
  return element.item !== undefined || element.widget.definition.kind === 'status';
}
export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const MARGIN = 16, GAP = 12;
export function hudElements(widgets: WidgetView[]): HudElement[] {
  return widgets.flatMap(widget => widget.definition.kind === 'icon-list'
    ? (widget.state as ListState).items.map((item, index) => ({ key: widget.definition.id + '#' + index, label: item.label, widget, item, index }))
    : [{ key: widget.definition.id, label: ('label' in widget.state && widget.state.label) || widget.definition.id, widget }]);
}
export function elementPreference(preferences: Preferences, element: HudElement): ElementPreference {
  const group = preferences.widgets[element.widget.definition.id] ?? {};
  return { ...group, ...preferences.widgets[element.key], hidden: preferences.widgets[element.key]?.hidden ?? group.hidden };
}
export function shortLabel(label: string) { return label.split(' (')[0]; }
// The existing API sends localized fractions as text. Only a complete fraction is
// interpreted for the decorative fill; the server's original value stays accessible.
export function meterValue(value: unknown): { value: number; max: number; percent: number; text: string; status: string } | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,4}(?:[.,]\d{1,2})?)\s*\/\s*(\d{1,4}(?:[.,]\d{1,2})?)(?:\s*·\s*(.{0,160}))?$/.exec(value.trim());
  if (!match) return null;
  const current = Number(match[1].replace(',', '.')), max = Number(match[2].replace(',', '.'));
  if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0 || current > max) return null;
  return { value: current, max, percent: current / max * 100, text: match[1], status: match[3] ?? '' };
}
export function normalizedPoint(left: number, top: number, size: Size, viewport: Size): Point {
  return { x: clamp((left - MARGIN) / Math.max(1, viewport.width - size.width - 2 * MARGIN), 0, 1),
    y: clamp((top - MARGIN) / Math.max(1, viewport.height - size.height - 2 * MARGIN), 0, 1) };
}
export function placeElements(elements: HudElement[], preferences: Preferences, viewport: Size, measured: Record<string, Size> = {}): Record<string, Placement> {
  const result: Record<string, Placement> = {}, offsets: Record<Position, number> = { 'top-left': 12, 'top-right': 12, 'bottom-left': 16, 'bottom-right': 16 };
  const groups: HudElement[][] = [];
  for (const element of elements) {
    const previous = groups[groups.length - 1];
    if (element.item && previous?.[0].widget.definition.id === element.widget.definition.id) previous.push(element);
    else groups.push([element]);
  }
  for (const group of groups) {
    const rows: Partial<Record<Position, { x: number; y: number; height: number }>> = {};
    for (const element of group) {
      const preference = elementPreference(preferences, element), position = preference.position ?? element.widget.definition.defaultPosition ?? 'top-right';
      const intrinsic = measured[element.key] ?? { width: isMedallion(element) ? 112 : 300, height: isMedallion(element) ? 150 : 120 };
      const requestedScale = preferences.scale * (preference.scale ?? 100) / 10000;
      const scale = Math.min(requestedScale, Math.max(.1, (viewport.width - 2 * MARGIN) / intrinsic.width), Math.max(.1, (viewport.height - 2 * MARGIN) / intrinsic.height));
      const width = intrinsic.width * scale, height = intrinsic.height * scale;
      // Individual edits never push other elements out of their original slots.
      const flowWidth = Math.min(intrinsic.width * preferences.scale / 100, viewport.width - 2 * MARGIN);
      const flowHeight = Math.min(intrinsic.height * preferences.scale / 100, viewport.height - 2 * MARGIN);
      const flowPosition = preferences.widgets[element.widget.definition.id]?.position ?? element.widget.definition.defaultPosition ?? 'top-right';
      const row = rows[flowPosition] ??= { x: 0, y: offsets[flowPosition], height: 0 };
      if (row.x > 0 && row.x + flowWidth > viewport.width - 2 * MARGIN) { row.x = 0; row.y += row.height + GAP; row.height = 0; }
      let left = position.endsWith('right') ? viewport.width - MARGIN - width - row.x : MARGIN + row.x;
      let top = position.startsWith('bottom') ? viewport.height - MARGIN - height - row.y : MARGIN + row.y;
      if (preference.x !== undefined && preference.y !== undefined) {
        left = MARGIN + preference.x * Math.max(0, viewport.width - width - 2 * MARGIN);
        top = MARGIN + preference.y * Math.max(0, viewport.height - height - 2 * MARGIN);
      }
      result[element.key] = { left: clamp(left, MARGIN, Math.max(MARGIN, viewport.width - width - MARGIN)),
        top: clamp(top, MARGIN, Math.max(MARGIN, viewport.height - height - MARGIN)), width, height, scale };
      row.height = Math.max(row.height, flowHeight);
      if (element.item) row.x += flowWidth + GAP;
      else { row.y += flowHeight + GAP; row.height = 0; }
    }
    for (const [position, row] of Object.entries(rows)) offsets[position as Position] = row!.y + row!.height + GAP;
  }
  return result;
}
