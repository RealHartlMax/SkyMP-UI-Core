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
  layoutId: 'core:dialog-v1' | 'core:form-v1'; modal?: boolean;
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
}
export interface WidgetView { definition: UiWidgetDefinition; state: TextState | ProgressState | ListState; visible: boolean; expiresAt: number }
export interface MenuView { definition: UiMenuDefinition; state: MenuState; expiresAt: number }
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
    check(++nodes <= 4096 && depth <= 10, 'JSON complexity limit');
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
  const d = clone(input); object(d); keys(d, ['id', 'owner', 'title', 'schemaVersion', 'layoutId', 'modal']);
  owned(d.owner, d.id); text(d.title, 120); check(d.title.trim() && d.schemaVersion === 1, 'Invalid title/schemaVersion');
  choice(d.layoutId, ['core:dialog-v1', 'core:form-v1']);
  if (d.modal !== undefined) check(typeof d.modal === 'boolean', 'Invalid modal');
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
  const s = clone(value, maxBytes); object(s); keys(s, ['schemaVersion', 'text', 'fields', 'actions']);
  check(s.schemaVersion === d.schemaVersion, 'State schema mismatch'); if (s.text !== undefined) text(s.text, 2048);
  check(Array.isArray(s.actions) && s.actions.length > 0 && s.actions.length <= 8, 'Invalid menu actions');
  const actionIds = new Set();
  for (const action of s.actions) {
    object(action); keys(action, ['id', 'label', 'tone']); text(action.label, 80);
    check(typeof action.id === 'string' && ACTION_RE.test(action.id) && action.id !== 'core.close' && !actionIds.has(action.id), 'Invalid/duplicate action');
    actionIds.add(action.id); if (action.tone !== undefined) choice(action.tone, TONES);
  }
  if (s.fields !== undefined) {
    check(d.layoutId === 'core:form-v1' && Array.isArray(s.fields) && s.fields.length <= 12, 'Invalid form fields');
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
export function actionPayload(state: MenuState, value: unknown) {
  const data = clone(value, 4096); object(data); keys(data, ['values']);
  if (!state.fields?.length) { check(data.values === undefined || Object.keys(data.values).length === 0, 'Unexpected values'); return data; }
  object(data.values); keys(data.values, state.fields.map(f => f.id));
  for (const field of state.fields) { check(data.values[field.id] !== undefined || !field.required, 'Missing field'); if (data.values[field.id] !== undefined) fieldValue(field, data.values[field.id]); }
  return data;
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
    object(m); keys(m, ['definition', 'state', 'expiresAt']); m.definition = menuDefinition(m.definition); m.state = menuState(m.definition, m.state);
    check(!ids.has(m.definition.id) && Number.isSafeInteger(m.expiresAt), 'Invalid menu view'); ids.add(m.definition.id);
  }
  const notices = new Set();
  for (const n of p.notifications) { object(n); keys(n, ['id', 'message', 'tone', 'expiresAt']); text(n.id, 96); text(n.message, 1024); choice(n.tone, TONES); check(Number.isSafeInteger(n.expiresAt) && !notices.has(n.id), 'Invalid notification'); notices.add(n.id); }
  return p as Frame;
}
