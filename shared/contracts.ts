// This module runs on both sides of the boundary. No HTML, URLs or executable templates.
import { translations, type Locale, type UiTranslations } from './localization';
export const API_VERSION = 1 as const;
export const PROTOCOL_VERSION = 1 as const;
export const PREFIX = 'skympUi:';
export const POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
export const TONES = ['info', 'success', 'warning', 'error'] as const;
export type Position = typeof POSITIONS[number];
export type Tone = typeof TONES[number];
export type UiTarget = { userId: number } | { actorId: number };
export type UiOwner = string;
export type UiId = string;
export interface UiWidgetDefinition {
  id: UiId; owner: UiOwner; kind: 'status' | 'progress' | 'text' | 'icon-list' | 'custom-template';
  defaultPosition?: Position; defaultVisible?: boolean; schemaVersion: number; templateId?: string;
}
export interface UiMenuDefinition {
  id: UiId; owner: UiOwner; title: string; schemaVersion: number;
  layoutId: 'core:dialog-v1' | 'core:form-v1' | 'core:panel-v1'; modal?: boolean;
  priority?: number;
}
export interface UiActionContext {
  readonly userId: number; readonly actorId: number | null; readonly widgetId: string;
  readonly actionId: string; readonly payload: unknown; readonly requestId: string;
  readonly signal: AbortSignal;
}
export interface ActionOptions {
  // Deliberately deny by default. A plugin must explicitly authorize every invocation.
  authorize: (context: UiActionContext) => boolean;
}
export interface SkyMpUiApiV1 {
  readonly apiVersion: 1;
  // Optional discovery keeps consumers compatible with older API V1 services.
  readonly framework?: SkyMpUiFrameworkV1;
  registerWidget(def: UiWidgetDefinition): void;
  unregisterWidget(owner: UiOwner, id: UiId): void;
  updateWidget(target: UiTarget, widgetId: UiId, state: unknown): void;
  setWidgetVisible(target: UiTarget, widgetId: UiId, visible: boolean): void;
  registerMenu(def: UiMenuDefinition): void;
  unregisterMenu(owner: UiOwner, id: UiId): void;
  openMenu(target: UiTarget, menuId: UiId, state: unknown): void;
  closeMenu(target: UiTarget, menuId: UiId): void;
  notify(target: UiTarget, message: string, options?: { tone?: Tone; durationMs?: number }): void;
  onAction(owner: UiOwner, widgetId: UiId, actionId: string,
    handler: (ctx: UiActionContext) => void | Promise<void>, options?: ActionOptions): void;
  getStatus(): { ready: boolean; apiVersion: number; frontendProtocol: number; sessions: number; locale: Locale };
}
export interface TextState { schemaVersion: 1; label?: string; text?: string; value?: number | string; tone?: Tone }
export interface ProgressState { schemaVersion: 1; label: string; value: number; max: number }
export interface ListState { schemaVersion: 1; items: Array<{ label: string; value?: string | number; tone?: Tone }> }
export interface MenuField {
  id: string; label: string; type: 'text' | 'number' | 'checkbox' | 'select';
  required?: boolean; maxLength?: number; min?: number; max?: number;
  options?: Array<{ value: string; label: string }>; value?: string | number | boolean;
}
export interface MenuState {
  schemaVersion: 1; text?: string; fields?: MenuField[];
  actions: Array<{ id: string; label: string; tone?: Tone }>;
  content?: UiPanelContent;
}
export interface UiListItem { id: string; label: string; detail?: string; value?: string | number; disabled?: boolean }
export interface UiInventoryItem extends UiListItem { quantity?: number }
interface SelectableBlock { id: string; label: string; selectable?: boolean; required?: boolean }
export type UiContentBlock =
  | { id: string; kind: 'text'; text: string; label?: string; tone?: Tone }
  | { id: string; kind: 'progress'; label: string; value: number; max: number }
  | (SelectableBlock & { kind: 'list'; items: UiListItem[] })
  | (SelectableBlock & { kind: 'item-list'; items: UiInventoryItem[] })
  | (SelectableBlock & { kind: 'table'; columns: Array<{ id: string; label: string }>; rows: Array<{ id: string; cells: Array<string | number>; disabled?: boolean }> });
export interface UiPanelContent {
  version: 1;
  blocks: UiContentBlock[];
  tabs?: Array<{ id: string; label: string; blocks: UiContentBlock[] }>;
}
export const INTERACTION_KINDS = ['npc', 'player', 'door', 'container', 'furniture', 'gathering', 'merchant'] as const;
export type InteractionKind = typeof INTERACTION_KINDS[number];
// Supplied by a server router. It is never accepted as client action payload.
export interface UiInteractionTarget { kind: InteractionKind; referenceId: string; title: string }
export interface UiInteractionDefinition { id: UiId; owner: UiOwner; schemaVersion: 1; label: string; kinds: InteractionKind[]; priority?: number }
export interface UiInteractionActionContext extends UiActionContext { readonly interaction: Readonly<UiInteractionTarget> }
export interface SkyMpUiFrameworkV1 {
  readonly version: 1;
  clientStatus(target: UiTarget): { ready: boolean; frameworkVersion: 0 | 1 };
  unregisterOwner(owner: UiOwner): void;
  offAction(owner: UiOwner, componentId: UiId, actionId: string): void;
  registerInteraction(def: UiInteractionDefinition, handler: (ctx: UiInteractionActionContext) => void | Promise<void>,
    options?: { authorize: (ctx: UiInteractionActionContext) => boolean }): void;
  unregisterInteraction(owner: UiOwner, id: UiId): void;
  listInteractions(kind: InteractionKind): UiInteractionDefinition[];
  // Omit actionIds to offer all matching registrations. Gameplay routers should
  // pass their own available set; authorization is still checked on every click.
  openInteraction(target: UiTarget, interaction: UiInteractionTarget, actionIds?: UiId[]): boolean;
  closeInteraction(target: UiTarget): void;
}
export interface WidgetView { definition: UiWidgetDefinition; state: TextState | ProgressState | ListState; visible: boolean; expiresAt: number }
export interface MenuView { definition: UiMenuDefinition; state: MenuState; expiresAt: number; revision?: number }
export interface NotificationView { id: string; message: string; tone: Tone; expiresAt: number }
export interface Frame {
  customPacketType: 'skympUi:snapshot' | 'skympUi:update'; protocolVersion: 1; apiVersion: 1;
  frontId: string; sessionId: string; sequence: number; serverTime: number; preferenceKey: string;
  locale: Locale; translations: UiTranslations;
  widgets: WidgetView[]; menus: MenuView[]; notifications: NotificationView[];
}
export const OWNER_RE = /^[a-z][a-z0-9-]{0,47}$/;
export const ID_RE = /^[a-z][a-z0-9-]{0,47}:[a-z][a-z0-9._-]{0,46}$/;
export const TOKEN_RE = /^[a-zA-Z0-9_-]{1,64}$/;
export const ACTION_RE = /^[a-z][a-z0-9._-]{0,47}$/;

export function check(value: unknown, message: string): asserts value {
  if (!value) throw new TypeError(message);
}
export function object(value: unknown): asserts value is Record<string, any> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null), 'Expected plain object');
}
export function keys(value: object, allowed: readonly string[]) {
  check(Object.keys(value).every(key => allowed.includes(key)), 'Unexpected field');
}
export function text(value: unknown, maximum = 1024): asserts value is string {
  check(typeof value === 'string' && value.length <= maximum && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value), 'Invalid text');
}
export function finite(value: unknown): asserts value is number {
  check(typeof value === 'number' && Number.isFinite(value), 'Expected finite number');
}
export function choice(value: unknown, values: readonly unknown[]) { check(values.includes(value), 'Unsupported value'); }
export function owned(owner: unknown, id: unknown) {
  check(typeof owner === 'string' && OWNER_RE.test(owner) && typeof id === 'string' && ID_RE.test(id) && id.startsWith(owner + ':'), 'Invalid owner/namespace');
}
export function serialized(value: unknown, maxBytes = 8192): string {
  let nodes = 0;
  const visit = (v: any, depth: number) => {
    check(++nodes <= 4096 && depth <= 16, 'JSON complexity limit');
    if (v === null || typeof v === 'boolean') return;
    if (typeof v === 'string') { text(v, 4096); return; }
    if (typeof v === 'number') { finite(v); return; }
    check(typeof v === 'object', 'Only JSON data is allowed');
    if (Array.isArray(v)) { check(v.length <= 256, 'Array limit'); v.forEach(item => visit(item, depth + 1)); }
    else {
      object(v);
      for (const key of Object.keys(v)) {
        check(key.length <= 96 && !['__proto__', 'constructor', 'prototype'].includes(key) && !Object.getOwnPropertyDescriptor(v, key)?.get, 'Unsafe JSON key');
        visit(v[key], depth + 1);
      }
    }
  };
  visit(value, 0);
  const result = JSON.stringify(value);
  // UTF-8 without a Node/Buffer dependency (CEF also imports this module).
  check(new TextEncoder().encode(result).length <= maxBytes, 'Payload byte limit');
  return result;
}
export function clone<T>(value: T, maximum = 8192): T { return JSON.parse(serialized(value, maximum)); }
export function widgetDefinition(input: unknown): UiWidgetDefinition {
  const d = clone(input); object(d); keys(d, ['id', 'owner', 'kind', 'schemaVersion', 'defaultPosition', 'defaultVisible', 'templateId']);
  owned(d.owner, d.id); check(d.schemaVersion === 1, 'Unsupported schemaVersion');
  choice(d.kind, ['status', 'progress', 'text', 'icon-list', 'custom-template']);
  if (d.defaultPosition !== undefined) choice(d.defaultPosition, POSITIONS);
  if (d.defaultVisible !== undefined) check(typeof d.defaultVisible === 'boolean', 'Invalid visibility');
  if (d.kind === 'custom-template') check(d.templateId === 'core:status-v1', 'Template is not bundled');
  else check(d.templateId === undefined, 'templateId only for custom-template');
  return d as UiWidgetDefinition;
}
export function menuDefinition(input: unknown): UiMenuDefinition {
  const d = clone(input); object(d); keys(d, ['id', 'owner', 'title', 'schemaVersion', 'layoutId', 'modal', 'priority']);
  owned(d.owner, d.id); text(d.title, 120); check(d.title.trim() && d.schemaVersion === 1, 'Invalid title/schemaVersion');
  choice(d.layoutId, ['core:dialog-v1', 'core:form-v1', 'core:panel-v1']);
  if (d.modal !== undefined) check(typeof d.modal === 'boolean', 'Invalid modal');
  priority(d.priority);
  return d as UiMenuDefinition;
}
export function widgetState(d: UiWidgetDefinition, value: unknown, maxBytes = 8192): WidgetView['state'] {
  const s = clone(value, maxBytes); object(s); check(s.schemaVersion === d.schemaVersion, 'State schema mismatch');
  if (d.kind === 'progress') {
    keys(s, ['schemaVersion', 'label', 'value', 'max']); text(s.label, 160); finite(s.value); finite(s.max);
    check(s.max > 0 && s.value >= 0 && s.value <= s.max, 'Invalid progress range');
  } else if (d.kind === 'icon-list') {
    keys(s, ['schemaVersion', 'items']); check(Array.isArray(s.items) && s.items.length <= 16, 'Invalid items');
    for (const item of s.items) {
      object(item); keys(item, ['label', 'value', 'tone']); text(item.label, 160); scalar(item.value);
      if (item.tone !== undefined) choice(item.tone, TONES);
    }
  } else {
    keys(s, ['schemaVersion', 'label', 'text', 'value', 'tone']);
    if (s.label !== undefined) text(s.label, 160); if (s.text !== undefined) text(s.text); scalar(s.value);
    if (s.tone !== undefined) choice(s.tone, TONES);
    check(s.label !== undefined || s.text !== undefined || s.value !== undefined, 'Empty widget');
  }
  return s as WidgetView['state'];
}
function scalar(v: unknown) { if (v !== undefined) { if (typeof v === 'number') finite(v); else text(v, 160); } }
export function menuState(d: UiMenuDefinition, value: unknown, maxBytes = 8192): MenuState {
  const s = clone(value, maxBytes); object(s); keys(s, ['schemaVersion', 'text', 'fields', 'actions', 'content']);
  check(s.schemaVersion === d.schemaVersion, 'State schema mismatch'); if (s.text !== undefined) text(s.text, 2048);
  if (d.layoutId === 'core:panel-v1') panelContent(s.content);
  else check(s.content === undefined, 'Content requires core:panel-v1');
  check(Array.isArray(s.actions) && (s.actions.length > 0 || d.layoutId === 'core:panel-v1') && s.actions.length <= 8, 'Invalid menu actions');
  const actionIds = new Set();
  for (const action of s.actions) {
    object(action); keys(action, ['id', 'label', 'tone']); text(action.label, 80);
    check(typeof action.id === 'string' && ACTION_RE.test(action.id) && action.id !== 'core.close' && !actionIds.has(action.id), 'Invalid/duplicate action');
    actionIds.add(action.id); if (action.tone !== undefined) choice(action.tone, TONES);
  }
  if (s.fields !== undefined) {
    check(d.layoutId !== 'core:dialog-v1' && Array.isArray(s.fields) && s.fields.length <= 12, 'Invalid form fields');
    const ids = new Set();
    for (const f of s.fields) {
      object(f); keys(f, ['id', 'label', 'type', 'required', 'maxLength', 'min', 'max', 'options', 'value']);
      check(typeof f.id === 'string' && ACTION_RE.test(f.id) && !['__proto__', 'constructor', 'prototype'].includes(f.id) && !ids.has(f.id), 'Invalid/duplicate field'); ids.add(f.id);
      text(f.label, 120); choice(f.type, ['text', 'number', 'checkbox', 'select']);
      if (f.required !== undefined) check(typeof f.required === 'boolean', 'Invalid required');
      if (f.maxLength !== undefined) check(f.type === 'text' && Number.isInteger(f.maxLength) && f.maxLength >= 1 && f.maxLength <= 512, 'Invalid maxLength');
      if (f.min !== undefined) { check(f.type === 'number', 'min requires number'); finite(f.min); }
      if (f.max !== undefined) { check(f.type === 'number', 'max requires number'); finite(f.max); }
      if (f.min !== undefined && f.max !== undefined) check(f.min <= f.max, 'Invalid range');
      if (f.type === 'select') {
        check(Array.isArray(f.options) && f.options.length > 0 && f.options.length <= 24, 'Invalid select options');
        const values = new Set();
        for (const option of f.options) { object(option); keys(option, ['value', 'label']); text(option.value, 80); text(option.label, 120); check(!values.has(option.value), 'Duplicate option'); values.add(option.value); }
      } else check(f.options === undefined, 'Unexpected options');
      if (f.value !== undefined) fieldValue(f as MenuField, f.value);
    }
  }
  return s as MenuState;
}
function fieldValue(field: MenuField, value: unknown) {
  if (field.type === 'text') { text(value, field.maxLength ?? 256); if (field.required) check(value.trim().length > 0, 'Required text'); }
  if (field.type === 'number') { finite(value); check((field.min === undefined || value >= field.min) && (field.max === undefined || value <= field.max), 'Number outside range'); }
  if (field.type === 'checkbox') { check(typeof value === 'boolean' && (!field.required || value), 'Invalid checkbox'); }
  if (field.type === 'select') check(field.options?.some(o => o.value === value), 'Invalid selection');
}
export function actionPayload(state: MenuState, value: unknown, revision?: number) {
  const data = clone(value, 4096); object(data); keys(data, state.content ? ['values', 'selections', 'revision'] : ['values']);
  if (state.content) {
    check(Number.isSafeInteger(revision) && data.revision === revision, 'Stale panel revision');
    const blocks = contentBlocks(state.content).filter(b => 'selectable' in b && b.selectable);
    if (data.selections === undefined) data.selections = {};
    object(data.selections); keys(data.selections, blocks.map(b => b.id));
    for (const block of blocks) {
      const selected = data.selections[block.id];
      check(selected !== undefined || !('required' in block && block.required), 'Missing selection');
      if (selected !== undefined) {
        const rows = block.kind === 'table' ? block.rows : block.kind === 'list' || block.kind === 'item-list' ? block.items : [];
        check(typeof selected === 'string' && rows.some(row => row.id === selected && !row.disabled), 'Invalid selection');
      }
    }
  }
  if (data.values !== undefined) object(data.values);
  if (!state.fields?.length) check(data.values === undefined || Object.keys(data.values).length === 0, 'Unexpected values');
  else {
    if (data.values === undefined) data.values = {};
    keys(data.values, state.fields.map(f => f.id));
    for (const field of state.fields) { check(data.values[field.id] !== undefined || !field.required, 'Missing field'); if (data.values[field.id] !== undefined) fieldValue(field, data.values[field.id]); }
  }
  return data;
}
function localId(value: unknown) {
  check(typeof value === 'string' && ACTION_RE.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value), 'Invalid local id');
}
function priority(value: unknown) { if (value !== undefined) check(Number.isInteger(value) && (value as number) >= -100 && (value as number) <= 100, 'Invalid priority'); }
export function contentBlocks(content: UiPanelContent): UiContentBlock[] { return [...content.blocks, ...(content.tabs ?? []).flatMap(tab => tab.blocks)]; }
function panelContent(value: unknown) {
  object(value); keys(value, ['version', 'blocks', 'tabs']);
  check(value.version === 1 && Array.isArray(value.blocks), 'Invalid panel content version/blocks');
  if (value.tabs !== undefined) {
    check(Array.isArray(value.tabs) && value.tabs.length > 0 && value.tabs.length <= 6, 'Invalid tabs');
    const ids = new Set();
    for (const tab of value.tabs) {
      object(tab); keys(tab, ['id', 'label', 'blocks']); localId(tab.id); text(tab.label, 80);
      check(!ids.has(tab.id) && Array.isArray(tab.blocks), 'Invalid/duplicate tab'); ids.add(tab.id);
    }
  }
  const blocks = contentBlocks(value as UiPanelContent), ids = new Set();
  check(blocks.length <= 12, 'Panel block limit');
  let rows = 0;
  for (const b of blocks) {
    object(b); localId(b.id); check(!ids.has(b.id), 'Duplicate block'); ids.add(b.id);
    if (b.kind === 'text') {
      keys(b, ['id', 'kind', 'label', 'text', 'tone']); text(b.text, 2048);
      if (b.label !== undefined) text(b.label, 160); if (b.tone !== undefined) choice(b.tone, TONES);
      continue;
    }
    text(b.label, 160);
    if (b.kind === 'progress') {
      keys(b, ['id', 'kind', 'label', 'value', 'max']); finite(b.value); finite(b.max);
      check(b.max > 0 && b.value >= 0 && b.value <= b.max, 'Invalid progress range'); continue;
    }
    choice(b.kind, ['list', 'item-list', 'table']);
    keys(b, ['id', 'kind', 'label', 'selectable', 'required', ...(b.kind === 'table' ? ['columns', 'rows'] : ['items'])]);
    if (b.selectable !== undefined) check(typeof b.selectable === 'boolean', 'Invalid selectable');
    if (b.required !== undefined) check(typeof b.required === 'boolean' && (!b.required || b.selectable === true), 'Required selection must be selectable');
    if (b.kind === 'table') {
      check(Array.isArray(b.columns) && b.columns.length > 0 && b.columns.length <= 8, 'Invalid columns');
      const columns = new Set();
      for (const column of b.columns) { object(column); keys(column, ['id', 'label']); localId(column.id); text(column.label, 120); check(!columns.has(column.id), 'Duplicate column'); columns.add(column.id); }
    }
    const items: unknown = b.kind === 'table' ? b.rows : (b as Extract<UiContentBlock, {kind: 'list' | 'item-list'}>).items;
    check(Array.isArray(items) && items.length <= 32 && (rows += items.length) <= 128, 'Panel row limit');
    const itemIds = new Set();
    for (const item of items) {
      object(item); localId(item.id); check(!itemIds.has(item.id), 'Duplicate row'); itemIds.add(item.id);
      if (item.disabled !== undefined) check(typeof item.disabled === 'boolean', 'Invalid disabled');
      if (b.kind === 'table') {
        keys(item, ['id', 'cells', 'disabled']); check(Array.isArray(item.cells) && item.cells.length === b.columns.length, 'Invalid cells');
        for (const cell of item.cells) { check(cell !== undefined, 'Missing cell'); scalar(cell); }
      } else {
        keys(item, ['id', 'label', 'detail', 'value', 'disabled', ...(b.kind === 'item-list' ? ['quantity'] : [])]);
        text(item.label, 160); if (item.detail !== undefined) text(item.detail, 512); scalar(item.value);
        if (item.quantity !== undefined) check(Number.isSafeInteger(item.quantity) && item.quantity >= 0 && item.quantity <= 1e9, 'Invalid quantity');
      }
    }
  }
}
export function interactionDefinition(input: unknown): UiInteractionDefinition {
  const d = clone(input); object(d); keys(d, ['id', 'owner', 'schemaVersion', 'label', 'kinds', 'priority']);
  owned(d.owner, d.id); text(d.label, 80); priority(d.priority);
  check(d.schemaVersion === 1 && d.label.trim() && Array.isArray(d.kinds) && d.kinds.length > 0 && d.kinds.length <= INTERACTION_KINDS.length && new Set(d.kinds).size === d.kinds.length, 'Invalid interaction');
  for (const kind of d.kinds) choice(kind, INTERACTION_KINDS);
  return d as UiInteractionDefinition;
}
export function interactionTarget(input: unknown): UiInteractionTarget {
  const d = clone(input); object(d); keys(d, ['kind', 'referenceId', 'title']); choice(d.kind, INTERACTION_KINDS);
  text(d.referenceId, 96); text(d.title, 120); check(d.referenceId.trim() && d.title.trim(), 'Empty interaction target');
  return d as UiInteractionTarget;
}
// Stable insertion order breaks equal-priority ties; modal menus outrank nonmodals.
export function orderMenus(menus: MenuView[]): MenuView[] {
  return [...menus].sort((a, b) => Number(a.definition.modal !== false) - Number(b.definition.modal !== false) || (a.definition.priority ?? 0) - (b.definition.priority ?? 0));
}
export function validateFrame(value: unknown): Frame {
  const p = clone(value, 65536); object(p);
  keys(p, ['customPacketType', 'protocolVersion', 'apiVersion', 'frontId', 'sessionId', 'sequence', 'serverTime', 'preferenceKey', 'locale', 'translations', 'widgets', 'menus', 'notifications']);
  choice(p.customPacketType, [PREFIX + 'snapshot', PREFIX + 'update']);
  check(p.protocolVersion === 1 && p.apiVersion === 1, 'Protocol/API mismatch');
  choice(p.locale, ['de', 'en']); object(p.translations); p.translations = translations(p.translations);
  check(typeof p.frontId === 'string' && TOKEN_RE.test(p.frontId) && typeof p.sessionId === 'string' && TOKEN_RE.test(p.sessionId), 'Invalid session');
  check(Number.isSafeInteger(p.sequence) && p.sequence > 0 && Number.isSafeInteger(p.serverTime), 'Invalid sequence/time');
  check(typeof p.preferenceKey === 'string' && /^[a-f0-9]{32}$/.test(p.preferenceKey), 'Invalid preference key');
  check(Array.isArray(p.widgets) && p.widgets.length <= 40 && Array.isArray(p.menus) && p.menus.length <= 4 && Array.isArray(p.notifications) && p.notifications.length <= 8, 'Frame item limit');
  const ids = new Set();
  for (const w of p.widgets) {
    object(w); keys(w, ['definition', 'state', 'visible', 'expiresAt']); w.definition = widgetDefinition(w.definition); w.state = widgetState(w.definition, w.state);
    check(!ids.has(w.definition.id) && typeof w.visible === 'boolean' && Number.isSafeInteger(w.expiresAt), 'Invalid widget view'); ids.add(w.definition.id);
  }
  for (const m of p.menus) {
    object(m); keys(m, ['definition', 'state', 'expiresAt', 'revision']); m.definition = menuDefinition(m.definition); m.state = menuState(m.definition, m.state);
    if (m.definition.layoutId === 'core:panel-v1') check(Number.isSafeInteger(m.revision) && m.revision > 0, 'Invalid panel revision');
    else check(m.revision === undefined, 'Revision requires panel layout');
    check(!ids.has(m.definition.id) && Number.isSafeInteger(m.expiresAt), 'Invalid menu view'); ids.add(m.definition.id);
  }
  const notices = new Set();
  for (const n of p.notifications) { object(n); keys(n, ['id', 'message', 'tone', 'expiresAt']); text(n.id, 96); text(n.message, 1024); choice(n.tone, TONES); check(Number.isSafeInteger(n.expiresAt) && !notices.has(n.id), 'Invalid notification'); notices.add(n.id); }
  return p as Frame;
}
