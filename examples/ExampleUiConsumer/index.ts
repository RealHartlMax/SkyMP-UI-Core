import type { SkyMpUiApiV1 } from '../../shared/contracts';
const globals = globalThis as any;
const ui: SkyMpUiApiV1 | undefined = globals.skympUi;
const mp = globals.mp;
if (!ui || ui.apiVersion !== 1 || !ui.getStatus().ready) {
  console.warn('[example-ui-consumer] UI Core v1 unavailable; example disabled until full restart');
} else {
  const owner = 'example', counts = new Map<number, number>(), documents = new Map<number, string>();
  ui.registerWidget({ id: 'example:status', owner, kind: 'status', schemaVersion: 1, defaultPosition: 'top-right' });
  ui.registerMenu({ id: 'example:welcome', owner, title: 'Willkommen / Welcome', schemaVersion: 1, layoutId: 'core:dialog-v1', modal: true });
  ui.onAction(owner, 'example:welcome', 'confirm', ctx => {
    if (ctx.signal.aborted) return;
    const count = (counts.get(ctx.userId) ?? 0) + 1; counts.set(ctx.userId, count);
    ui.updateWidget({ userId: ctx.userId }, 'example:status', { schemaVersion: 1, label: 'UI Core · Beispiel / Example', text: 'Serveraktion bestätigt / Server action confirmed', value: count, tone: 'success' });
    ui.notify({ userId: ctx.userId }, 'Aktion vom Server bestätigt / Action confirmed by server', { tone: 'success' });
    ui.closeMenu({ userId: ctx.userId }, 'example:welcome');
  }, { authorize: ctx => mp.isConnected(ctx.userId) && mp.getUserActor(ctx.userId) === ctx.actorId && mp.getUserByActor(ctx.actorId) === ctx.userId });
  mp.on('customPacket', (userId: number, raw: string) => {
    if (typeof raw !== 'string' || raw.length > 512) return;
    try {
      const p = JSON.parse(raw);
      if (p.customPacketType !== 'skympUi:ready' || p.protocolVersion !== 1 || typeof p.frontId !== 'string' ||
        documents.get(userId) === p.frontId || !mp.isConnected(userId) || !mp.getUserActor(userId)) return;
      documents.set(userId, p.frontId);
      ui.updateWidget({ userId }, 'example:status', { schemaVersion: 1, label: 'UI Core · Beispiel / Example', text: 'Vom Gameserver erzeugt / Created by game server', value: counts.get(userId) ?? 0 });
      ui.openMenu({ userId }, 'example:welcome', { schemaVersion: 1, text: 'Dieser Button ruft einen autorisierten Server-Handler auf. / This button invokes an authorized server handler.', actions: [{ id: 'confirm', label: 'Bestätigen / Confirm' }] });
    } catch { /* Ignore unrelated packets and a disconnect between identity and target selection. */ }
  });
  for (const event of ['connect', 'disconnect']) mp.on(event, (id: number) => { counts.delete(id); documents.delete(id); });
}
