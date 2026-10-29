import type { SkyMpUiApiV1 } from '../../shared/contracts';
const globals = globalThis as any, ui = globals.skympUi as SkyMpUiApiV1 | undefined, mp = globals.mp;
if (ui?.apiVersion === 1 && ui.getStatus().ready) {
  ui.registerWidget({ id: 'second-example:status', owner: 'second-example', kind: 'text', schemaVersion: 1, defaultPosition: 'top-left' });
  mp.on('customPacket', (userId: number, raw: string) => {
    if (typeof raw !== 'string' || raw.length > 512) return;
    try {
      const p = JSON.parse(raw);
      if (p.customPacketType === 'skympUi:ready' && p.protocolVersion === 1)
        ui.updateWidget({ userId }, 'second-example:status', { schemaVersion: 1, label: 'Zweites Plugin / Second plugin', text: 'Eigener Namespace / Independent namespace' });
    } catch { /* Optional consumer; unrelated packets and absent players are ignored. */ }
  });
} else console.warn('[second-ui-consumer] UI Core unavailable; optional example disabled');
