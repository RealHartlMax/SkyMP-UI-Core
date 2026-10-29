// Plugin-owned native module, loaded by the shared Runtime API in the existing browser.

export class UiCoreBridge {
  private playing = false;
  private frontId: string | null = null;
  private editorVersion = 0;
  private sessionId: string | null = null;
  private ready = false;
  private sequence = 0;
  private attempts = 0;
  private deadline = 0;
  private heartbeat = 0;
  private lastAlive = 0;
  private allowed = true;
  constructor(private sp: any, private controller: any, private requestFocus: (focused: boolean) => void, private customPacketType: number) {
    controller.on('browserMessage', (e: any) => {
      const [type, data] = e.arguments;
      if (type === 'skympUi:frontReady' && data?.protocolVersion === 1 && typeof data.frontId === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(data.frontId)) {
        if (this.frontId === data.frontId) return;
        this.frontId = data.frontId; this.editorVersion = data.editorVersion === 1 ? 1 : 0; this.clearSession(); this.attempts = 0;
        this.dispatch({ customPacketType: 'skympUi:interaction', allowed: this.allowed }); this.handshake();
      } else if (type === 'skympUi:focus' && typeof data === 'boolean') this.requestFocus(data && this.ready && this.allowed);
      else if (type === 'skympUi:action' && this.ready && this.allowed && data?.protocolVersion === 1 &&
        typeof data.widgetId === 'string' && data.widgetId.length <= 96 && typeof data.actionId === 'string' && data.actionId.length <= 48 &&
        typeof data.requestId === 'string' && data.requestId.startsWith(this.sessionId + '_') && data.requestId.length <= 96) {
        try {
          const safe = { protocolVersion: 1, widgetId: data.widgetId, actionId: data.actionId, requestId: data.requestId, payload: data.payload };
          if (JSON.stringify(safe).length <= 8192) this.send('action', safe);
        } catch { /* Malformed CEF data cannot reach the server. */ }
      }
    });
    controller.emitter.on('browserWindowLoaded', () => this.probe());
    controller.emitter.on('createActorMessage', (e: any) => { if (e.message.isMe && !this.playing) { this.playing = true; this.handshake(); } });
    for (const event of ['connectionAccepted', 'connectionDisconnect', 'connectionFailed', 'connectionDenied'])
      controller.emitter.on(event, () => this.reset(event === 'connectionAccepted' ? 'connecting' : 'disconnected'));
    controller.emitter.on('customPacketMessage', (e: any) => {
      const raw = e.message.contentJsonDump;
      if (!this.playing || typeof raw !== 'string' || raw.length > 65536) return;
      try {
        const p = JSON.parse(raw);
        if (typeof p?.customPacketType !== 'string' || !p.customPacketType.startsWith('skympUi:')) return;
        if (p.protocolVersion !== 1 || p.customPacketType === 'skympUi:unavailable') { this.unavailable(); return; }
        if (p.frontId !== this.frontId) return;
        if (p.customPacketType === 'skympUi:snapshot') {
          if (p.apiVersion !== 1 || typeof p.sessionId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(p.sessionId) ||
              !Number.isSafeInteger(p.sequence) || p.sequence <= this.sequence || !Array.isArray(p.widgets) || !Array.isArray(p.menus)) return;
          if (this.ready && p.sessionId !== this.sessionId) return;
          this.sessionId = p.sessionId; this.ready = true; this.deadline = 0; this.sequence = p.sequence;
          this.lastAlive = Date.now(); this.heartbeat = Date.now() + 10000; this.dispatch(p);
        } else if (this.ready && p.sessionId === this.sessionId) {
          if (p.customPacketType === 'skympUi:update') {
            if (!Number.isSafeInteger(p.sequence) || p.sequence <= this.sequence) return;
            this.sequence = p.sequence; this.lastAlive = Date.now(); this.dispatch(p);
          } else if (p.customPacketType === 'skympUi:ack') this.dispatch(p);
          else if (p.customPacketType === 'skympUi:alive') this.lastAlive = Date.now();
          else if (p.customPacketType === 'skympUi:edit' && this.editorVersion === 1) this.dispatch(p);
        }
      } catch { /* Isolate unrelated native packets. */ }
    });
    controller.on('update', () => {
      const now = Date.now();
      if (this.deadline && now >= this.deadline) { if (this.attempts < 3) this.handshake(); else this.unavailable(); }
      if (this.ready && now - this.lastAlive > 30000) this.unavailable();
      if (this.ready && now >= this.heartbeat) { this.heartbeat = now + 10000; this.send('heartbeat', { frontId: this.frontId, sessionId: this.sessionId }); }
    });
    controller.once('update', () => this.probe());
  }
  isActive() { return this.ready; }
  dismiss() { this.sp.browser.executeJavaScript("window.dispatchEvent(new Event('skympUi:dismiss'))"); }
  setAllowed(allowed: boolean) {
    this.allowed = allowed; if (!allowed) this.requestFocus(false);
    this.dispatch({ customPacketType: 'skympUi:interaction', allowed });
  }
  private probe() { this.sp.browser.executeJavaScript("window.dispatchEvent(new Event('skympUi:probe'))"); }
  private send(type: string, data: any = {}) {
    this.controller.emitter.emit('sendMessage', { message: { t: this.customPacketType,
      contentJsonDump: JSON.stringify({ customPacketType: 'skympUi:' + type, protocolVersion: 1, ...data }) }, reliability: 'reliable' });
  }
  private dispatch(data: any) {
    const json = JSON.stringify(JSON.stringify(data)).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    this.sp.browser.executeJavaScript(`window.dispatchEvent(new CustomEvent('skympUi:packet',{detail:JSON.parse(${json})}))`);
  }
  private clearSession() { this.ready = false; this.sessionId = null; this.sequence = 0; this.deadline = 0; this.requestFocus(false); }
  private handshake() {
    if (!this.playing || !this.frontId) return;
    this.attempts++; this.deadline = Date.now() + 2000;
    this.send('ready', { frontId: this.frontId, ...(this.editorVersion === 1 ? { editorVersion: 1 } : {}) });
  }
  private unavailable() { this.clearSession(); this.dispatch({ customPacketType: 'skympUi:status', status: 'unavailable' }); }
  private reset(status: string) {
    this.playing = false; this.frontId = null; this.attempts = 0; this.clearSession();
    this.dispatch({ customPacketType: 'skympUi:reset', status }); this.probe();
  }
}
