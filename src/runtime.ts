import { createHash, randomUUID } from 'node:crypto';
import { setTimeout, clearTimeout, setInterval, clearInterval } from 'node:timers';
import {
  API_VERSION, PROTOCOL_VERSION, PREFIX, TOKEN_RE, ACTION_RE, TONES,
  check, keys, object, text, clone, serialized, owned, widgetDefinition, menuDefinition,
  widgetState, menuState, actionPayload,
  type SkyMpUiApiV1, type UiWidgetDefinition, type UiMenuDefinition, type UiTarget,
  type UiActionContext, type ActionOptions, type WidgetView, type MenuView,
  type NotificationView, type Frame,
} from '../shared/contracts';
import { Bucket, readConfig, type Config } from './config';
import { translations } from '../shared/localization';
import { installUiEditCommand } from './chat-command';

export interface Mp {
  on(event: string, handler: (...args: any[]) => void): unknown;
  removeListener?(event: string, handler: (...args: any[]) => void): unknown;
  isConnected(userId: number): boolean; getUserActor(userId: number): number;
  getUserByActor(actorId: number): number; getUserGuid(userId: number): string;
  sendCustomPacket(userId: number, content: string): void;
}
interface Session {
  userId: number; actorId: number; id: string; frontId: string; sequence: number;
  preferenceKey: string; ready: boolean; editorVersion: number; lastSeen: number; dirty: boolean; lastRequest: number;
  widgets: Map<string, WidgetView>; menus: Map<string, MenuView>; notifications: NotificationView[];
  seen: Map<string, { expires: number; accepted: boolean; code: string }>;
  updates: Bucket; actions: Bucket; notices: Bucket; ingress: Bucket; handshakes: Bucket;
  job: Job | null;
}
interface Job { abort: AbortController; timer: ReturnType<typeof setTimeout>; open: boolean }
interface Action { handler: (ctx: UiActionContext) => void | Promise<void>; options?: ActionOptions }
export function createUiCore(mp: Mp, options: {
  config?: unknown; locales?: unknown; now?: () => number; log?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>; autoFlush?: boolean;
  chatGlobals?: Record<string, any>;
} = {}) {
  for (const method of ['on', 'isConnected', 'getUserActor', 'getUserByActor', 'getUserGuid', 'sendCustomPacket'])
    check(typeof (mp as any)?.[method] === 'function', 'UI Core requires native mp.' + method);
  const config: Config = readConfig(options.config), now = options.now ?? Date.now;
  const localeCatalog = translations(options.locales);
  const logger = options.log ?? console;
  const epoch = randomUUID();
  const widgets = new Map<string, UiWidgetDefinition>(), menus = new Map<string, UiMenuDefinition>();
  const actions = new Map<string, Action>(), sessions = new Map<number, Session>();
  const pending = new Map<number, number>(), jobs = new Set<Job>();
  let stopped = false, notificationSequence = 0;
  function log(level: 'debug' | 'info' | 'warn' | 'error', message: string) {
    if (['debug', 'info', 'warn', 'error'].indexOf(level) >= ['debug', 'info', 'warn', 'error'].indexOf(config.logLevel))
      logger[level]('[skymp-ui-core] ' + message);
  }
  function active() { check(!stopped, 'UI Core stopped'); }
  function identity(userId: number) {
    if (!Number.isInteger(userId) || userId < 0 || userId >= 65535) return null;
    try {
      if (!mp.isConnected(userId)) return null;
      const actorId = mp.getUserActor(userId);
      if (!Number.isSafeInteger(actorId) || actorId <= 0 || actorId > 0xffffffff || mp.getUserByActor(actorId) !== userId) return null;
      return { userId, actorId };
    } catch { return null; }
  }
  function cancel(userId: number) {
    const s = sessions.get(userId);
    if (s?.job) { s.job.open = false; s.job.abort.abort(); clearTimeout(s.job.timer); }
    sessions.delete(userId);
  }
  function valid(s: Session) { return identity(s.userId)?.actorId === s.actorId && sessions.get(s.userId) === s; }
  function getSession(target: UiTarget) {
    active(); object(target); const targetKeys = Object.keys(target);
    check(targetKeys.length === 1 && (targetKeys[0] === 'userId' || targetKeys[0] === 'actorId'), 'Target must select one native identity');
    let userId: number;
    if ('userId' in target) userId = target.userId;
    else { check(Number.isSafeInteger(target.actorId) && target.actorId > 0 && target.actorId <= 0xffffffff, 'Invalid actorId'); userId = mp.getUserByActor(target.actorId); }
    const player = identity(userId); check(player && (!('actorId' in target) || player.actorId === target.actorId), 'Target is not an authenticated player');
    let s = sessions.get(userId);
    if (s && s.actorId !== player.actorId) { cancel(userId); s = undefined; }
    if (!s) {
      check(sessions.size < config.maxSessions, 'Session limit');
      const guid = mp.getUserGuid(userId); text(guid, 256); const sessionId = randomUUID();
      s = { ...player, id: sessionId, frontId: '', sequence: 0, ready: false, editorVersion: 0, lastSeen: now(), dirty: false, lastRequest: 0,
        // Some real native contexts (including createBot) have an empty GUID.
        // Presentation storage then stays session-scoped; it must never block authenticated routing.
        preferenceKey: createHash('sha256').update('skymp-ui-core:v1:' + (guid || sessionId)).digest('hex').slice(0, 32),
        widgets: new Map(), menus: new Map(), notifications: [], seen: new Map(), job: null,
        updates: new Bucket(config.updateBurst, config.updatesPerSecond, now()),
        actions: new Bucket(config.actionBurst, config.actionsPerSecond, now()),
        notices: new Bucket(config.notificationBurst, config.notificationsPerSecond, now()),
        ingress: new Bucket(30, 15, now()), handshakes: new Bucket(3, 0.5, now()) };
      sessions.set(userId, s);
    }
    return s;
  }
  function packet(userId: number, type: string, data: Record<string, unknown>) {
    if (stopped) return false;
    const content = serialized({ customPacketType: PREFIX + type, protocolVersion: PROTOCOL_VERSION, ...data }, config.maxPacketBytes);
    try { mp.sendCustomPacket(userId, content); return true; } catch { return false; }
  }
  function frame(s: Session, initial = false): Frame {
    return { customPacketType: initial ? 'skympUi:snapshot' : 'skympUi:update', protocolVersion: 1, apiVersion: 1,
      frontId: s.frontId, sessionId: s.id, sequence: s.sequence + 1, serverTime: now(), preferenceKey: s.preferenceKey,
      locale: config.locale, translations: localeCatalog,
      widgets: [...s.widgets.values()], menus: [...s.menus.values()], notifications: s.notifications };
  }
  function ensureSize(s: Session) { serialized(frame(s), config.maxSessionBytes); }
  function put<T>(s: Session, map: Map<string, T>, id: string, value: T) {
    const previous = map.get(id); map.set(id, value);
    try { ensureSize(s); } catch (error) { if (previous === undefined) map.delete(id); else map.set(id, previous); throw error; }
    s.dirty = true;
  }
  function expire(s: Session) {
    for (const map of [s.widgets, s.menus]) for (const [id, value] of map) if (value.expiresAt <= now()) { map.delete(id); s.dirty = true; }
    const remaining = s.notifications.filter(n => n.expiresAt > now());
    if (remaining.length !== s.notifications.length) { s.notifications = remaining; s.dirty = true; }
    for (const [id, value] of s.seen) if (value.expires <= now()) s.seen.delete(id);
  }
  function sendFrame(s: Session, initial = false) {
    if (!valid(s) || !s.ready) return;
    expire(s);
    const value = frame(s, initial);
    try {
      // Validate the complete serialized frame before any native send.
      const content = serialized(value, config.maxPacketBytes);
      mp.sendCustomPacket(s.userId, content); s.sequence++; s.dirty = false;
    } catch { log('warn', 'State transport failed for native user ' + s.userId); }
  }
  function definition(id: string) { const d = widgets.get(id) ?? menus.get(id); check(d, 'Unknown UI registration'); return d; }
  function registration(input: unknown, menu: boolean) {
    active(); const d = menu ? menuDefinition(input) : widgetDefinition(input);
    check(!widgets.has(d.id) && !menus.has(d.id), 'Duplicate UI id: ' + d.id);
    check(widgets.size + menus.size < config.maxRegistrations, 'Registration limit');
    if (menu) menus.set(d.id, Object.freeze(d as UiMenuDefinition)); else widgets.set(d.id, Object.freeze(d as UiWidgetDefinition));
  }
  function unregister(owner: string, id: string, menu: boolean) {
    active(); owned(owner, id); const d = menu ? menus.get(id) : widgets.get(id); if (!d) return;
    check(d.owner === owner, 'Owner mismatch'); if (menu) menus.delete(id); else widgets.delete(id);
    for (const s of sessions.values()) if ((menu ? s.menus : s.widgets).delete(id)) s.dirty = true;
    for (const key of actions.keys()) if (key.startsWith(id + '/')) actions.delete(key);
  }
  function updateBudget(s: Session) { check(s.updates.take(now()), 'Player update rate limit'); expire(s); }
  function ack(s: Session, requestId: string, accepted: boolean, code: string) {
    const old = s.seen.get(requestId); const value = old ?? { accepted, code, expires: now() + config.requestTtlMs };
    if (!old) {
      s.seen.set(requestId, value);
      while (s.seen.size > config.maxSeenRequests) s.seen.delete(s.seen.keys().next().value!);
    }
    packet(s.userId, 'ack', { sessionId: s.id, frontId: s.frontId, requestId, accepted: value.accepted, code: value.code });
  }
  function invoke(s: Session, p: Record<string, any>) {
    keys(p, ['customPacketType', 'protocolVersion', 'widgetId', 'actionId', 'requestId', 'payload']);
    check(typeof p.requestId === 'string' && p.requestId.length <= 96 && p.requestId.startsWith(s.id + '_'), 'Invalid request session');
    const counterText = p.requestId.slice(s.id.length + 1);
    check(/^[1-9][0-9]{0,9}$/.test(counterText), 'Invalid request counter');
    const counter = Number(counterText); check(counter <= 0xffffffff, 'Request counter overflow');
    if (s.seen.has(p.requestId)) { ack(s, p.requestId, false, 'duplicate'); return; }
    if (counter <= s.lastRequest) { packet(s.userId, 'ack', { sessionId: s.id, frontId: s.frontId, requestId: p.requestId, accepted: false, code: 'replay' }); return; }
    s.lastRequest = counter;
    if (!s.actions.take(now())) { ack(s, p.requestId, false, 'rate'); return; }
    expire(s);
    try {
      const d = definition(p.widgetId);
      check(typeof p.actionId === 'string' && ACTION_RE.test(p.actionId), 'Invalid action id');
      const menu = s.menus.get(d.id), widget = s.widgets.get(d.id);
      check(menu || widget?.visible, 'UI is not active for this session');
      if (p.actionId === 'core.close') {
        check(menu, 'Only menus can be dismissed'); object(p.payload); keys(p.payload, []);
        s.menus.delete(d.id); s.dirty = true; ack(s, p.requestId, true, 'closed'); return;
      }
      const action = actions.get(d.id + '/' + p.actionId); check(action, 'Unregistered action');
      if (menu) check(menu.state.actions.some(a => a.id === p.actionId), 'Action not offered by this menu');
      const payload = menu ? actionPayload(menu.state, p.payload) : clone(p.payload, 4096);
      check(!s.job && jobs.size < config.maxConcurrentActions, 'Action busy');
      const abort = new AbortController();
      const ctx: UiActionContext = Object.freeze({ userId: s.userId, actorId: s.actorId,
        widgetId: d.id, actionId: p.actionId, requestId: p.requestId, payload, signal: abort.signal });
      let allowed: unknown = action.options?.authorize?.(ctx);
      if (allowed && typeof (allowed as any).then === 'function') { Promise.resolve(allowed).catch(() => {}); allowed = false; }
      check(allowed === true && valid(s), 'Action unauthorized');
      const job: Job = { abort, open: true, timer: setTimeout(() => {
        job.open = false; abort.abort(); log('warn', 'Action timed out: ' + d.id + '/' + p.actionId);
      }, config.actionTimeoutMs) };
      job.timer.unref?.(); s.job = job; jobs.add(job);
      // Record acceptance before scheduling. Reentrant/duplicate packets cannot run twice.
      ack(s, p.requestId, true, 'accepted');
      Promise.resolve().then(() => {
        if (job.open && valid(s) && !abort.signal.aborted) return action.handler(ctx);
      }).catch(() => { log('error', 'Action handler failed: ' + d.id + '/' + p.actionId); }).finally(() => {
        job.open = false; clearTimeout(job.timer); jobs.delete(job); if (s.job === job) s.job = null;
      }).catch(() => {});
    } catch { ack(s, p.requestId, false, 'denied'); }
  }
  function onPacket(userId: number, content: unknown) {
    if (stopped || typeof content !== 'string' || content.length > config.maxPacketBytes) return;
    let p: any;
    try { p = JSON.parse(content); object(p); } catch { return; }
    if (typeof p.customPacketType !== 'string' || !p.customPacketType.startsWith(PREFIX)) return;
    if (!identity(userId)) return;
    const s = getSession({ userId });
    if (!s.ingress.take(now())) return;
    if (p.protocolVersion !== PROTOCOL_VERSION) {
      if (s.handshakes.take(now())) { packet(userId, 'unavailable', { code: 'protocol-mismatch', expected: PROTOCOL_VERSION }); log('warn', 'Frontend protocol mismatch for native user ' + userId); }
      s.ready = false; return;
    }
    if (p.customPacketType === PREFIX + 'ready') {
      keys(p, ['customPacketType', 'protocolVersion', 'frontId', 'editorVersion']); check(typeof p.frontId === 'string' && TOKEN_RE.test(p.frontId), 'Invalid frontend id');
      check(p.editorVersion === undefined || p.editorVersion === 1, 'Unsupported editor version');
      if (!s.handshakes.take(now())) return;
      if (s.frontId !== p.frontId) {
        if (s.job) { s.job.open = false; s.job.abort.abort(); clearTimeout(s.job.timer); }
        s.id = randomUUID(); s.frontId = p.frontId; s.sequence = 0; s.lastRequest = 0; s.seen.clear();
      }
      s.editorVersion = p.editorVersion ?? 0;
      s.lastSeen = now(); s.ready = true; pending.delete(userId); sendFrame(s, true); return;
    }
    if (!s.ready || !valid(s)) return;
    if (p.customPacketType === PREFIX + 'heartbeat') {
      keys(p, ['customPacketType', 'protocolVersion', 'frontId', 'sessionId']);
      if (p.frontId !== s.frontId || p.sessionId !== s.id) return;
      s.lastSeen = now(); packet(userId, 'alive', { frontId: s.frontId, sessionId: s.id, serverTime: now() }); return;
    }
    if (p.customPacketType === PREFIX + 'action') invoke(s, p);
  }
  const listener = (userId: number, content: string) => { try { onPacket(userId, content); } catch { log('debug', 'Rejected malformed UI packet'); } };
  const disconnect = (userId: number) => { cancel(userId); pending.delete(userId); };
  const connect = (userId: number) => { disconnect(userId); if (pending.size < config.maxSessions) pending.set(userId, now()); };
  mp.on('customPacket', listener); mp.on('disconnect', disconnect); mp.on('connect', connect);
  function flush() {
    if (stopped) return;
    for (const s of sessions.values()) {
      if (!valid(s) || now() - s.lastSeen > config.sessionTtlMs) { cancel(s.userId); continue; }
      expire(s); if (s.dirty) sendFrame(s);
    }
    for (const [userId, since] of pending) {
      if (!mp.isConnected(userId)) pending.delete(userId);
      else if (identity(userId) && now() - since >= config.handshakeWarningMs) {
        log('warn', 'No UI frontend handshake for native user ' + userId + '; install matching Client/CEF runtime protocol 1'); pending.delete(userId);
      }
    }
  }
  const timer = options.autoFlush === false ? null : setInterval(flush, config.flushMs); timer?.unref?.();
  const api: SkyMpUiApiV1 = Object.freeze({ apiVersion: API_VERSION,
    registerWidget: (d: UiWidgetDefinition) => registration(d, false),
    unregisterWidget: (owner: string, id: string) => unregister(owner, id, false),
    registerMenu: (d: UiMenuDefinition) => registration(d, true),
    unregisterMenu: (owner: string, id: string) => unregister(owner, id, true),
    updateWidget(target: UiTarget, id: string, state: unknown) {
      const d = widgets.get(id); check(d, 'Unknown widget'); const value = widgetState(d, state, config.maxStateBytes);
      const s = getSession(target); updateBudget(s); check(s.widgets.has(id) || s.widgets.size < config.maxWidgets, 'Player widget limit');
      put(s, s.widgets, id, { definition: d, state: value, visible: s.widgets.get(id)?.visible ?? d.defaultVisible ?? true, expiresAt: now() + config.widgetTtlMs });
    },
    setWidgetVisible(target: UiTarget, id: string, visible: boolean) {
      check(typeof visible === 'boolean' && widgets.has(id), 'Invalid widget/visibility'); const s = getSession(target); updateBudget(s);
      const value = s.widgets.get(id); check(value, 'Initialize widget state before visibility'); put(s, s.widgets, id, { ...value, visible });
    },
    openMenu(target: UiTarget, id: string, state: unknown) {
      const d = menus.get(id); check(d, 'Unknown menu'); const value = menuState(d, state, config.maxStateBytes);
      for (const a of value.actions) check(actions.has(id + '/' + a.id), 'Register action handler before opening menu');
      const s = getSession(target); updateBudget(s); check(s.menus.has(id) || s.menus.size < config.maxMenus, 'Player menu limit');
      put(s, s.menus, id, { definition: d, state: value, expiresAt: now() + config.menuTtlMs });
    },
    closeMenu(target: UiTarget, id: string) { check(menus.has(id), 'Unknown menu'); const s = getSession(target); updateBudget(s); if (s.menus.delete(id)) s.dirty = true; },
    notify(target: UiTarget, message: string, options: { tone?: NotificationView['tone']; durationMs?: number } = {}) {
      text(message, 1024); check(message.trim(), 'Empty notification'); object(options); keys(options, ['tone', 'durationMs']);
      const tone = options.tone ?? 'info', durationMs = options.durationMs ?? 5000;
      check(TONES.includes(tone) && Number.isInteger(durationMs) && durationMs >= 1000 && durationMs <= 30000, 'Invalid notification options');
      const s = getSession(target); expire(s); check(s.notices.take(now()) && s.notifications.length < config.maxNotifications, 'Notification rate/queue limit');
      const previous = s.notifications; s.notifications = [...previous, { id: `${epoch}_${++notificationSequence}`, message, tone, expiresAt: now() + durationMs }];
      try { ensureSize(s); } catch (error) { s.notifications = previous; throw error; } s.dirty = true;
    },
    onAction(owner: string, id: string, actionId: string, handler: Action['handler'], actionOptions?: ActionOptions) {
      active(); owned(owner, id); const d = definition(id); check(d.owner === owner && ACTION_RE.test(actionId) && actionId !== 'core.close', 'Invalid action ownership/id');
      check(typeof handler === 'function' && !actions.has(id + '/' + actionId), 'Invalid/duplicate handler');
      if (actionOptions !== undefined) { object(actionOptions); keys(actionOptions, ['authorize']); check(typeof actionOptions.authorize === 'function', 'Invalid authorizer'); }
      check(actions.size < config.maxRegistrations * 8, 'Action registry limit');
      actions.set(id + '/' + actionId, { handler, options: actionOptions ? { authorize: actionOptions.authorize } : undefined });
    },
    getStatus: () => ({ ready: !stopped, apiVersion: API_VERSION, frontendProtocol: PROTOCOL_VERSION, sessions: sessions.size, locale: config.locale }),
  });
  function openEditor(userId: number) {
    const s = sessions.get(userId);
    if (stopped || !s || !s.ready || !valid(s) || s.editorVersion !== 1 || now() - s.lastSeen > config.sessionTtlMs) return false;
    packet(userId, 'edit', { frontId: s.frontId, sessionId: s.id }); return true;
  }
  const detachCommand = options.chatGlobals ? installUiEditCommand(openEditor, config.locale, options.chatGlobals, logger) : null;
  function stop() {
    if (stopped) return;
    detachCommand?.();
    for (const s of sessions.values()) { if (s.ready && valid(s)) packet(s.userId, 'unavailable', { code: 'shutdown' }); cancel(s.userId); }
    stopped = true; if (timer) clearInterval(timer);
    mp.removeListener?.('customPacket', listener); mp.removeListener?.('connect', connect); mp.removeListener?.('disconnect', disconnect);
    for (const job of jobs) { job.open = false; job.abort.abort(); clearTimeout(job.timer); }
    widgets.clear(); menus.clear(); actions.clear(); pending.clear();
  }
  return { api, stop, flush, config, openEditor };
}
