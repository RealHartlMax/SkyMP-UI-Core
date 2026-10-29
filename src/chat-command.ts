// Optional adapter for the verified SkyMP-Chat v1 registry. No command parser here.
interface CommandContext { userId: number; args: string[]; reply(message: string): void; error(message: string): void }
interface ChatApi {
  apiVersion: number;
  registerCommand(definition: { owner: string; name: string; description: string; usage: string; execute(ctx: CommandContext): void }): void;
  unregisterCommand(owner: string, name: string): void;
}
export function installUiEditCommand(openEditor: (userId: number) => boolean, locale: 'de' | 'en',
  globals: Record<string, any> = globalThis, log: Pick<Console, 'warn' | 'info'> = console) {
  const owner = 'skymp-ui-core';
  let registered: ChatApi | null = null, stopped = false;
  const attach = (candidate: unknown) => {
    if (stopped || registered) return;
    const chat = candidate as ChatApi | undefined;
    if (chat?.apiVersion !== 1 || typeof chat.registerCommand !== 'function' || typeof chat.unregisterCommand !== 'function') {
      log.warn('[skymp-ui-core] /UiEdit unavailable: SkyMP-Chat API v1 required; display button remains available'); return;
    }
    try {
      chat.registerCommand({ owner, name: 'uiedit', usage: '/UiEdit',
        description: locale === 'de' ? 'HUD-Elemente verschieben und ihre Größe ändern.' : 'Move and resize your HUD elements.',
        execute(ctx) {
          if (stopped) return;
          if (ctx.args.length) { ctx.error('/UiEdit'); return; }
          // The authenticated chat context supplies userId. The UI runtime rechecks it.
          if (!openEditor(ctx.userId)) ctx.error(locale === 'de'
            ? 'UI-Editor nicht bereit. Bitte das aktuelle UI-Core-Clientpaket installieren und neu verbinden.'
            : 'UI editor is not ready. Install the current UI Core client package and reconnect.');
        } });
      registered = chat; log.info('[skymp-ui-core] /UiEdit registered through SkyMP-Chat API v1');
    } catch { log.warn('[skymp-ui-core] /UiEdit registration conflict; existing command retained, display button remains available'); }
  };
  if (globals.skympChat !== undefined) attach(globals.skympChat);
  else {
    if (globals.skympChatReady === undefined) globals.skympChatReady = [];
    if (Array.isArray(globals.skympChatReady) && globals.skympChatReady.length < 64) globals.skympChatReady.push(attach);
    else log.warn('[skymp-ui-core] /UiEdit readiness queue unavailable; load SkyMP-Chat first');
  }
  return () => {
    if (stopped) return; stopped = true;
    if (Array.isArray(globals.skympChatReady)) {
      const index = globals.skympChatReady.indexOf(attach); if (index >= 0) globals.skympChatReady.splice(index, 1);
    }
    try { registered?.unregisterCommand(owner, 'uiedit'); } catch { log.warn('[skymp-ui-core] /UiEdit cleanup failed'); }
    registered = null;
  };
}
