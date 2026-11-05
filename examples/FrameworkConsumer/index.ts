import type { SkyMpUiApiV1, UiTarget, UiInteractionTarget } from '../../shared/contracts';

// Bundle this helper into a consumer plugin. Call open only from your server's
// authenticated character/router event; the helper adds no gameplay permission.
export function registerFrameworkExample(ui: SkyMpUiApiV1 | undefined) {
  if (!ui || ui.apiVersion !== 1 || !ui.getStatus().ready || ui.framework?.version !== 1) return null;
  const owner = 'framework-example', id = owner + ':overview', framework = ui.framework;
  ui.registerMenu({ owner, id, schemaVersion: 1, title: 'Plugin overview', layoutId: 'core:panel-v1', modal: true, priority: 10 });
  ui.onAction(owner, id, 'confirm', ctx => {
    if (ctx.signal.aborted) return;
    ui.notify({ userId: ctx.userId }, 'Selection received by the server', { tone: 'success' });
    ui.closeMenu({ userId: ctx.userId }, id);
  }, { authorize: () => true }); // This example only acknowledges UI input.
  framework.registerInteraction({ owner, id: owner + ':inspect', schemaVersion: 1, label: 'Information', kinds: ['npc', 'merchant'] }, ctx => {
    if (ctx.signal.aborted) return;
    ui.notify({ userId: ctx.userId }, ctx.interaction.title);
  }, { authorize: () => true }); // A real consumer must check live server permissions.
  return {
    open(target: UiTarget) {
      if (framework.clientStatus(target).frameworkVersion !== 1) return false;
      ui.openMenu(target, id, { schemaVersion: 1, actions: [{ id: 'confirm', label: 'Confirm' }], content: {
        version: 1, blocks: [], tabs: [
          { id: 'summary', label: 'Summary', blocks: [{ id: 'status', kind: 'text', text: 'Data supplied by a server plugin' }] },
          { id: 'entries', label: 'Entries', blocks: [{ id: 'selection', kind: 'list', label: 'Entries', selectable: true, required: true,
            items: [{ id: 'first', label: 'First entry' }, { id: 'second', label: 'Second entry' }] }] },
        ],
      } }); return true;
    },
    interact(target: UiTarget, subject: UiInteractionTarget) { return framework.openInteraction(target, subject, [owner + ':inspect']); },
    dispose() { framework.unregisterOwner(owner); },
  };
}
