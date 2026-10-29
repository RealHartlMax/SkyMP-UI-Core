import { check, keys, object } from '../shared/contracts';
export const defaults = Object.freeze({
  maxStateBytes: 8192, maxSessionBytes: 49152, maxPacketBytes: 65536,
  maxRegistrations: 128, maxWidgets: 20, maxMenus: 4, maxNotifications: 8, maxSessions: 512,
  flushMs: 100, updateBurst: 100, updatesPerSecond: 50,
  actionBurst: 8, actionsPerSecond: 4, notificationBurst: 4, notificationsPerSecond: 1,
  widgetTtlMs: 300000, menuTtlMs: 120000, requestTtlMs: 120000,
  sessionTtlMs: 60000, maxSeenRequests: 128, maxConcurrentActions: 64,
  actionTimeoutMs: 5000, handshakeWarningMs: 15000, logLevel: 'info' as 'debug' | 'info' | 'warn' | 'error',
  locale: 'de' as 'de' | 'en',
});
export type Config = typeof defaults;
export function readConfig(value: unknown = {}): Config {
  object(value); keys(value, Object.keys(defaults));
  const result = { ...defaults, ...value };
  for (const [key, v] of Object.entries(result)) {
    if (key === 'logLevel') { check(['debug', 'info', 'warn', 'error'].includes(v as string), 'Invalid logLevel'); continue; }
    if (key === 'locale') { check(v === 'de' || v === 'en', 'Invalid locale: use de or en'); continue; }
    check(Number.isSafeInteger(v) && (v as number) > 0 && (v as number) <= 3600000, 'Invalid config: ' + key);
  }
  check(result.maxWidgets <= 40 && result.maxMenus <= 4 && result.maxNotifications <= 8 && result.maxSessions <= 4096 &&
    result.maxRegistrations <= 512 && result.maxSeenRequests <= 512 && result.maxConcurrentActions <= 256 &&
    result.maxStateBytes <= 8192 && result.maxPacketBytes <= 65536 && result.maxSessionBytes <= result.maxPacketBytes - 4096 &&
    result.flushMs >= 50 && result.sessionTtlMs >= 30000 && result.menuTtlMs >= result.flushMs, 'Config outside protocol bounds');
  return result;
}
export class Bucket {
  private tokens: number; private at: number;
  constructor(private capacity: number, private perSecond: number, now: number) { this.tokens = capacity; this.at = now; }
  take(now: number) {
    this.tokens = Math.min(this.capacity, this.tokens + Math.max(0, now - this.at) * this.perSecond / 1000); this.at = now;
    if (this.tokens < 1) return false; this.tokens--; return true;
  }
}
