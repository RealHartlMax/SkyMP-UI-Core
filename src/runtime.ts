import { createHash, randomUUID } from 'node:crypto';
import { setTimeout, clearTimeout, setInterval, clearInterval } from 'node:timers';
import {
  API_VERSION, PROTOCOL_VERSION, PREFIX, TOKEN_RE, ACTION_RE, TONES,
  check, keys, object, text, clone, serialized, owned, widgetDefinition, menuDefinition,
  widgetState, menuState, actionPayload,
  interactionDefinition, interactionTarget, orderMenus, INTERACTION_KINDS, OWNER_RE,
  type SkyMpUiApiV1, type UiWidgetDefinition, type UiMenuDefinition, type UiTarget,
  type UiActionContext, type ActionOptions, type WidgetView, type MenuView,
  type NotificationView, type Frame,
  type SkyMpUiFrameworkV1, type UiInteractionDefinition, type UiInteractionTarget, type UiInteractionActionContext,
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
  preferenceKey: string; ready: boolean; editorVersion: number; frameworkVersion: 0 | 1; menuRevision: number; lastSeen: number; dirty: boolean; lastRequest: number;
  widgets: Map<string, WidgetView>; menus: Map<string, MenuView>; notifications: NotificationView[];
  seen: Map<string, { expires: number; accepted: boolean; code: string }>;
  updates: Bucket; actions: Bucket; notices: Bucket; ingress: Bucket; handshakes: Bucket;
  job: Job | null;
  interaction: { target: UiInteractionTarget; offered: Map<string, string> } | null;
}
interface Job { abort: AbortController; timer: ReturnType<typeof setTimeout>; open: boolean; userId: number; componentId: string; actionId: string; interactionId?: string }
interface Action { handler: (ctx: UiActionContext) => void | Promise<void>; options?: ActionOptions }
interface Interaction {
  definition: UiInteractionDefinition;
  handler: (ctx: UiInteractionActionContext) => void | Promise<void>;
  options?: { authorize: (ctx: UiInteractionActionContext) => boolean };
}
const INTERACTION_MENU_ID = 'skymp-ui-core:interaction';
const interactionOrder = (a: UiInteractionDefinition, b: UiInteractionDefinition) =>
  (b.priority ?? 0) - (a.priority ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
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
  const interactions = new Map<string, Interaction>();
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
  function disable(s: Session) {
    s.ready = false;
    if (s.job) { s.job.open = false; s.job.abort.abort(); clearTimeout(s.job.timer); }
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
    if (s && (s.actorId !== player.actorId || now() - s.lastSeen > config.sessionTtlMs)) { cancel(userId); s = undefined; }
    if (!s) {
      check(sessions.size < config.maxSessions, 'Session limit');
      const guid = mp.getUserGuid(userId); text(guid, 256); const sessionId = randomUUID();
      s = { ...player, id: sessionId, frontId: '', sequence: 0, ready: false, editorVersion: 0, frameworkVersion: 0, menuRevision: 0, lastSeen: now(), dirty: false, lastRequest: 0,
        // Some real native contexts (including createBot) have an empty GUID.
        // Presentation storage then stays session-scoped; it must never block authenticated routing.
        preferenceKey: createHash('sha256').update('skymp-ui-core:v1:' + (guid || sessionId)).digest('hex').slice(0, 32),
        widgets: new Map(), menus: new Map(), notifications: [], seen: new Map(), job: null, interaction: null,
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
  function versionMismatch(s: Session, kind: 'protocol' | 'framework') {
    // Disable independently of the diagnostic budget: throttling must never
    // leave an incompatible session/action running.
    disable(s);
    if (!s.handshakes.take(now())) return;
    packet(s.userId, 'unavailable', { code: kind + '-mismatch', expected: 1 });
    log('warn', 'Frontend ' + kind + ' mismatch for native user ' + s.userId);
  }
  function frame(s: Session, initial = false): Frame {
    return { customPacketType: initial ? 'skympUi:snapshot' : 'skympUi:update', protocolVersion: 1, apiVersion: 1,
      frontId: s.frontId, sessionId: s.id, sequence: s.sequence + 1, serverTime: now(), preferenceKey: s.preferenceKey,
      locale: config.locale, translations: localeCatalog,
      widgets: [...s.widgets.values()], menus: offeredMenus(s).map(menu => {
        if (s.frameworkVersion === 1) return menu;
        // Legacy validators reject even unknown optional definition keys.
        const { priority: _priority, ...definition } = menu.definition;
        return { ...menu, definition };
      }), notifications: s.notifications };
  }
  function offeredMenus(s: Session) { return orderMenus([...s.menus.values()].filter(m => s.frameworkVersion === 1 || m.definition.layoutId !== 'core:panel-v1')); }
  function ensureSize(s: Session) {
    // Count queued panels before a frontend has negotiated its capabilities too.
    serialized({ ...frame(s), menus: [...s.menus.values()] }, config.maxSessionBytes);
  }
  function abortJobs(componentId: string, userId?: number, actionId?: string) {
    for (const job of jobs) if (job.componentId === componentId && (userId === undefined || job.userId === userId) && (actionId === undefined || job.actionId === actionId)) {
      job.open = false; job.abort.abort(); clearTimeout(job.timer);
    }
  }
  function dropMenu(s: Session, id: string) {
    abortJobs(id, s.userId);
    if (s.menus.delete(id)) s.dirty = true;
    if (id === INTERACTION_MENU_ID) s.interaction = null;
  }
  function put<T>(s: Session, map: Map<string, T>, id: string, value: T) {
    const previous = map.get(id); map.set(id, value);
    try { ensureSize(s); } catch (error) { if (previous === undefined) map.delete(id); else map.set(id, previous); throw error; }
    s.dirty = true;
  }
  function expire(s: Session) {
    for (const [id, value] of s.widgets) if (value.expiresAt <= now()) { s.widgets.delete(id); abortJobs(id, s.userId); s.dirty = true; }
    for (const [id, value] of s.menus) if (value.expiresAt <= now()) dropMenu(s, id);
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
      // Reserve the sequence before entering native code. A synchronous reply or
      // plugin callback may send a newer full snapshot while this call is open.
      s.sequence = value.sequence; s.dirty = false; mp.sendCustomPacket(s.userId, content);
    } catch { s.dirty = true; log('warn', 'State transport failed for native user ' + s.userId); }
  }
  function definition(id: string) { const d = widgets.get(id) ?? menus.get(id); check(d, 'Unknown UI registration'); return d; }
  function registration(input: unknown, menu: boolean) {
    active(); const d = menu ? menuDefinition(input) : widgetDefinition(input);
    check(d.id !== INTERACTION_MENU_ID && !widgets.has(d.id) && !menus.has(d.id) && !interactions.has(d.id), 'Duplicate/reserved UI id: ' + d.id);
    check(widgets.size + menus.size + interactions.size < config.maxRegistrations, 'Registration limit');
    if (menu) menus.set(d.id, Object.freeze(d as UiMenuDefinition)); else widgets.set(d.id, Object.freeze(d as UiWidgetDefinition));
  }
  function unregister(owner: string, id: string, menu: boolean) {
    active(); owned(owner, id); const d = menu ? menus.get(id) : widgets.get(id); if (!d) return;
    check(d.owner === owner, 'Owner mismatch'); if (menu) menus.delete(id); else widgets.delete(id);
    abortJobs(id);
    for (const s of sessions.values()) { if (menu) dropMenu(s, id); else if (s.widgets.delete(id)) s.dirty = true; }
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
      const d = p.widgetId === INTERACTION_MENU_ID ? s.menus.get(INTERACTION_MENU_ID)?.definition : definition(p.widgetId);
      check(d, 'Unknown UI registration');
      check(typeof p.actionId === 'string' && ACTION_RE.test(p.actionId), 'Invalid action id');
      const menu = s.menus.get(d.id), widget = s.widgets.get(d.id);
      check(menu || widget?.visible, 'UI is not active for this session');
      if (menu) check(offeredMenus(s).slice(-1)[0] === menu, 'Menu is suspended by another menu');
      if (p.actionId === 'core.close') {
        check(menu, 'Only menus can be dismissed'); object(p.payload); keys(p.payload, menu.revision === undefined ? [] : ['revision']);
        if (menu.revision !== undefined) check(p.payload.revision === menu.revision, 'Stale panel dismissal');
        dropMenu(s, d.id); ack(s, p.requestId, true, 'closed'); return;
      }
      const interactionId = d.id === INTERACTION_MENU_ID ? s.interaction?.offered.get(p.actionId) : undefined;
      const interaction = interactionId ? interactions.get(interactionId) : undefined;
      const action = actions.get(d.id + '/' + p.actionId);
      check(d.id === INTERACTION_MENU_ID ? interaction : action, 'Unregistered action');
      if (menu) check(menu.state.actions.some(a => a.id === p.actionId), 'Action not offered by this menu');
      const payload = menu ? actionPayload(menu.state, p.payload, menu.revision) : clone(p.payload, 4096);
      check(!s.job && jobs.size < config.maxConcurrentActions, 'Action busy');
      const abort = new AbortController();
      const ctx: UiActionContext = Object.freeze({ userId: s.userId, actorId: s.actorId,
        widgetId: interactionId ?? d.id, actionId: interaction ? 'interact' : p.actionId, requestId: p.requestId, payload, signal: abort.signal,
        ...(interaction && s.interaction ? { interaction: Object.freeze(clone(s.interaction.target)) } : {}) });
      const stillActive = () => s.ready && valid(s) && now() - s.lastSeen <= config.sessionTtlMs &&
        (menu ? s.menus.get(d.id) === menu && menu.expiresAt > now() && offeredMenus(s).slice(-1)[0] === menu : s.widgets.get(d.id) === widget && widget?.visible && widget.expiresAt > now()) &&
        (interactionId ? interactions.get(interactionId) === interaction : actions.get(d.id + '/' + p.actionId) === action);
      let allowed: unknown = interaction ? interaction.options?.authorize?.(ctx as UiInteractionActionContext) : action!.options?.authorize?.(ctx);
      if (allowed && typeof (allowed as any).then === 'function') { Promise.resolve(allowed).catch(() => {}); allowed = false; }
      check(allowed === true && stillActive(), 'Action unauthorized');
      const job: Job = { abort, open: true, userId: s.userId, componentId: d.id, actionId: p.actionId, interactionId, timer: setTimeout(() => {
        job.open = false; abort.abort(); log('warn', 'Action timed out: ' + d.id + '/' + p.actionId);
      }, config.actionTimeoutMs) };
      job.timer.unref?.(); s.job = job; jobs.add(job);
      // Record acceptance before scheduling. Reentrant/duplicate packets cannot run twice.
      ack(s, p.requestId, true, 'accepted');
      Promise.resolve().then(() => {
        if (job.open && stillActive() && !abort.signal.aborted) {
          // An interaction offer is single-use. Capture server context before closing;
          // do not abort the job which is now executing against that captured context.
          if (interaction) { s.menus.delete(INTERACTION_MENU_ID); s.interaction = null; s.dirty = true; return interaction.handler(ctx as UiInteractionActionContext); }
          return action!.handler(ctx);
        }
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
      versionMismatch(s, 'protocol'); return;
    }
    if (p.customPacketType === PREFIX + 'ready') {
      keys(p, ['customPacketType', 'protocolVersion', 'frontId', 'editorVersion', 'frameworkVersion']); check(typeof p.frontId === 'string' && TOKEN_RE.test(p.frontId), 'Invalid frontend id');
      check(p.editorVersion === undefined || p.editorVersion === 1, 'Unsupported editor version');
      if (p.frameworkVersion !== undefined && p.frameworkVersion !== 1) {
        versionMismatch(s, 'framework'); return;
      }
      if (!s.handshakes.take(now())) return;
      if (s.frontId !== p.frontId) {
        if (s.job) { s.job.open = false; s.job.abort.abort(); clearTimeout(s.job.timer); }
        s.id = randomUUID(); s.frontId = p.frontId; s.sequence = 0; s.lastRequest = 0; s.seen.clear();
      }
      s.editorVersion = p.editorVersion ?? 0;
      s.frameworkVersion = p.frameworkVersion ?? 0;
      s.lastSeen = now(); s.ready = true; pending.delete(userId); sendFrame(s, true); return;
    }
    if (!s.ready || !valid(s)) return;
    if (p.customPacketType === PREFIX + 'framework') {
      keys(p, ['customPacketType', 'protocolVersion', 'frontId', 'sessionId', 'frameworkVersion']);
      if (p.frontId !== s.frontId || p.sessionId !== s.id) return;
      if (p.frameworkVersion !== 1) {
        versionMismatch(s, 'framework'); return;
      }
      if (s.frameworkVersion === 1) return;
      s.frameworkVersion = 1; sendFrame(s, true); return;
    }
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
  function removeInteraction(owner: string, id: string) {
    active(); owned(owner, id); const entry = interactions.get(id); if (!entry) return;
    check(entry.definition.owner === owner, 'Owner mismatch'); interactions.delete(id);
    for (const job of jobs) if (job.interactionId === id) { job.open = false; job.abort.abort(); clearTimeout(job.timer); }
    for (const s of sessions.values()) if ([...(s.interaction?.offered.values() ?? [])].includes(id)) dropMenu(s, INTERACTION_MENU_ID);
  }
  const framework: SkyMpUiFrameworkV1 = Object.freeze({ version: 1,
    clientStatus(target: UiTarget) { const s = getSession(target); return { ready: s.ready, frameworkVersion: s.frameworkVersion }; },
    unregisterOwner(owner: string) {
      active(); check(OWNER_RE.test(owner), 'Invalid owner');
      for (const d of widgets.values()) if (d.owner === owner) unregister(owner, d.id, false);
      for (const d of menus.values()) if (d.owner === owner) unregister(owner, d.id, true);
      for (const d of interactions.values()) if (d.definition.owner === owner) removeInteraction(owner, d.definition.id);
    },
    offAction(owner: string, id: string, actionId: string) {
      active(); owned(owner, id); check(ACTION_RE.test(actionId), 'Invalid action id');
      if (!actions.delete(id + '/' + actionId)) return;
      abortJobs(id, undefined, actionId);
      for (const s of sessions.values()) if (s.menus.get(id)?.state.actions.some(a => a.id === actionId)) dropMenu(s, id);
    },
    registerInteraction(input: UiInteractionDefinition, handler: Interaction['handler'], actionOptions?: Interaction['options']) {
      active(); const d = interactionDefinition(input);
      check(d.id !== INTERACTION_MENU_ID && !widgets.has(d.id) && !menus.has(d.id) && !interactions.has(d.id), 'Duplicate/reserved UI id');
      check(widgets.size + menus.size + interactions.size < config.maxRegistrations, 'Registration limit');
      check(typeof handler === 'function', 'Invalid interaction handler');
      if (actionOptions !== undefined) { object(actionOptions); keys(actionOptions, ['authorize']); check(typeof actionOptions.authorize === 'function', 'Invalid authorizer'); }
      Object.freeze(d.kinds); Object.freeze(d);
      interactions.set(d.id, { definition: d, handler, options: actionOptions ? { authorize: actionOptions.authorize } : undefined });
    },
    unregisterInteraction: removeInteraction,
    listInteractions(kind: UiInteractionTarget['kind']) {
      active(); check(INTERACTION_KINDS.includes(kind), 'Invalid interaction kind');
      return [...interactions.values()].map(entry => entry.definition).filter(d => d.kinds.includes(kind))
        .sort(interactionOrder).map(d => clone(d));
    },
    openInteraction(target: UiTarget, input: UiInteractionTarget, actionIds?: string[]) {
      const context = interactionTarget(input), s = getSession(target);
      if (!s.ready || s.frameworkVersion !== 1) return false;
      updateBudget(s);
      if (actionIds !== undefined) check(Array.isArray(actionIds) && actionIds.length <= 8 && new Set(actionIds).size === actionIds.length, 'Invalid interaction offers');
      const definitions = framework.listInteractions(context.kind);
      const offers = actionIds === undefined ? definitions : actionIds.map(id => {
        const d = definitions.find(d => d.id === id); check(d, 'Unknown interaction offer/kind'); return d;
      }).sort(interactionOrder);
      check(offers.length <= 8, 'Interaction offer limit');
      if (!offers.length) { dropMenu(s, INTERACTION_MENU_ID); return false; }
      check(s.menus.has(INTERACTION_MENU_ID) || s.menus.size < config.maxMenus, 'Player menu limit');
      const view: MenuView = { definition: { id: INTERACTION_MENU_ID, owner: 'skymp-ui-core', title: context.title, schemaVersion: 1, layoutId: 'core:panel-v1', modal: true, priority: 0 },
        state: { schemaVersion: 1, content: { version: 1, blocks: [] }, actions: offers.map((d, i) => ({ id: 'entry-' + i, label: d.label })) },
        revision: ++s.menuRevision, expiresAt: now() + config.menuTtlMs };
      put(s, s.menus, INTERACTION_MENU_ID, view); abortJobs(INTERACTION_MENU_ID, s.userId);
      s.interaction = { target: context, offered: new Map(offers.map((d, i) => ['entry-' + i, d.id])) }; return true;
    },
    closeInteraction(target: UiTarget) { const s = getSession(target); updateBudget(s); dropMenu(s, INTERACTION_MENU_ID); },
  });
  const api: SkyMpUiApiV1 = Object.freeze({ apiVersion: API_VERSION,
    framework,
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
      if (!visible) abortJobs(id, s.userId);
    },
    openMenu(target: UiTarget, id: string, state: unknown) {
      const d = menus.get(id); check(d, 'Unknown menu'); const value = menuState(d, state, config.maxStateBytes);
      for (const a of value.actions) check(actions.has(id + '/' + a.id), 'Register action handler before opening menu');
      const s = getSession(target); updateBudget(s); check(s.menus.has(id) || s.menus.size < config.maxMenus, 'Player menu limit');
      if (d.layoutId === 'core:panel-v1') check(!s.ready || s.frameworkVersion === 1, 'Client requires UI framework version 1');
      put(s, s.menus, id, { definition: d, state: value, expiresAt: now() + config.menuTtlMs,
        ...(d.layoutId === 'core:panel-v1' ? { revision: ++s.menuRevision } : {}) });
      abortJobs(id, s.userId);
    },
    closeMenu(target: UiTarget, id: string) { check(menus.has(id), 'Unknown menu'); const s = getSession(target); updateBudget(s); dropMenu(s, id); },
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
    widgets.clear(); menus.clear(); actions.clear(); interactions.clear(); pending.clear();
  }
  return { api, stop, flush, config, openEditor };
}
