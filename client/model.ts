import { validateFrame, PROTOCOL_VERSION, PREFIX, POSITIONS, TOKEN_RE, object, type Frame, type Position } from '../shared/contracts';
export interface ElementPreference { position?: Position; hidden?: boolean; x?: number; y?: number; scale?: number }
export interface Preferences { scale: number; widgets: Record<string, ElementPreference> }
export const emptyPreferences = (): Preferences => ({ scale: 100, widgets: {} });
export function readPreferences(storage: Pick<Storage, 'getItem'> | null, key: string): Preferences {
  try {
    const raw = storage?.getItem('skymp-ui.v1.' + key); if (!raw || raw.length > 65536) return emptyPreferences();
    const p = JSON.parse(raw); object(p); object(p.widgets);
    const result = emptyPreferences();
    if (typeof p.scale === 'number' && p.scale >= 75 && p.scale <= 150) result.scale = p.scale;
    for (const [id, v] of Object.entries(p.widgets).slice(0, 160)) {
      if (!v || typeof v !== 'object' || Array.isArray(v) || !/^[a-z][a-z0-9-]{0,47}:[a-z][a-z0-9._-]{0,46}(?:#(?:[0-9]|1[0-5]))?$/.test(id)) continue;
      const entry = v as Record<string, any>;
      result.widgets[id] = { ...(POSITIONS.includes(entry.position) ? { position: entry.position } : {}), ...(typeof entry.hidden === 'boolean' ? { hidden: entry.hidden } : {}),
        ...(typeof entry.x === 'number' && Number.isFinite(entry.x) && entry.x >= 0 && entry.x <= 1 && typeof entry.y === 'number' && Number.isFinite(entry.y) && entry.y >= 0 && entry.y <= 1 ? { x: entry.x, y: entry.y } : {}),
        ...(typeof entry.scale === 'number' && Number.isFinite(entry.scale) && entry.scale >= 75 && entry.scale <= 150 ? { scale: entry.scale } : {}) };
    }
    return result;
  } catch { return emptyPreferences(); }
}
export class UiModel {
  frame: Frame | null = null;
  status = 'disconnected';
  allowed = true;
  focused = false;
  frontId = this.newId();
  counter = 0;
  offset = 0;
  editorRequests = 0;
  pending = new Map<string, { id: string; close: boolean; at: number }>();
  constructor(private send: (type: string, data?: unknown) => void, private clock = Date.now) {}
  private newId() { return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`; }
  announce() { this.send(PREFIX + 'frontReady', { protocolVersion: PROTOCOL_VERSION, frontId: this.frontId, editorVersion: 1 }); }
  reset(status = 'disconnected', rotate = false) {
    this.frame = null; this.status = status; this.pending.clear(); this.counter = 0; this.editorRequests = 0; this.focused = false;
    if (rotate) this.frontId = this.newId();
  }
  receive(value: any): boolean {
    try {
      object(value);
      if (value.customPacketType === PREFIX + 'reset') { this.reset(value.status === 'connecting' ? 'connecting' : 'disconnected', true); this.announce(); return true; }
      if (value.customPacketType === PREFIX + 'interaction') { if (typeof value.allowed !== 'boolean') return false; this.allowed = value.allowed; return true; }
      if (value.customPacketType === PREFIX + 'status') { this.reset(typeof value.status === 'string' ? value.status : 'unavailable'); return true; }
      if (value.customPacketType === PREFIX + 'edit') {
        if (!this.frame || value.protocolVersion !== PROTOCOL_VERSION || value.sessionId !== this.frame.sessionId || value.frontId !== this.frontId) return false;
        this.editorRequests++; return true;
      }
      if (value.customPacketType === PREFIX + 'ack') {
        if (!this.frame || value.sessionId !== this.frame.sessionId || value.frontId !== this.frontId || !TOKEN_RE.test(this.frontId)) return false;
        // An accepted close is hidden until the authoritative next frame arrives.
        const p = this.pending.get(value.requestId);
        if (p && (!p.close || value.accepted !== true)) this.pending.delete(value.requestId);
        return true;
      }
      const next = validateFrame(value); if (next.frontId !== this.frontId) return false;
      if (!this.frame && next.customPacketType !== PREFIX + 'snapshot') return false;
      if (this.frame && (this.frame.sessionId !== next.sessionId || next.sequence <= this.frame.sequence)) return false;
      this.frame = next; this.status = 'ready'; this.offset = next.serverTime - this.clock();
      for (const [id, pending] of this.pending) if (!next.menus.some(m => m.definition.id === pending.id) || this.clock() - pending.at >= 5000) this.pending.delete(id);
      return true;
    } catch { this.reset('invalid-packet'); return false; }
  }
  serverNow() { return this.clock() + this.offset; }
  visibleMenus() {
    return this.allowed && this.frame ? this.frame.menus.filter(m => m.expiresAt > this.serverNow() && ![...this.pending.values()].some(p => p.close && p.id === m.definition.id)) : [];
  }
  action(id: string, actionId: string, payload: unknown, close = false) {
    if (!this.frame || !this.allowed || this.counter >= 0xffffffff || this.pending.size >= 16 ||
        [...this.pending.values()].some(p => p.id === id)) return false;
    const requestId = this.frame.sessionId + '_' + ++this.counter;
    this.pending.set(requestId, { id, close, at: this.clock() });
    this.send(PREFIX + 'action', { protocolVersion: PROTOCOL_VERSION, widgetId: id, actionId, requestId, payload }); return true;
  }
  dismiss() { const m = this.visibleMenus().slice(-1)[0]; if (m) return this.action(m.definition.id, 'core.close', {}, true); return false; }
  tick() { for (const [id, p] of this.pending) if (this.clock() - p.at >= 5000) this.pending.delete(id); }
}

// Coalesce the native/DOM echo of one key, while allowing the next distinct key.
export function createDismissGuard(clock = Date.now) {
  let previous: { source: string; at: number } | null = null;
  return (source: 'native' | 'dom') => {
    const at = clock();
    if (previous && previous.source !== source && at - previous.at < 150) { previous = null; return false; }
    previous = { source, at }; return true;
  };
}
