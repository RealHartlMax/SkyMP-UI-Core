// Plugin-owned native bridge with simulated SkyrimPlatform callbacks. No game is started.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), { EventEmitter } = require('node:events');
const ts = require('typescript');
const { UiModel } = require('../dist/model.cjs');
const source = fs.readFileSync(path.join(__dirname, '../client/native/uiCoreBridge.ts'), 'utf8');
function nativeHarness(f, userId = 0, legacy = false) {
  let time = 10000, focused = false, codeHandler = null, focusHandler = null;
  const native = new EventEmitter(), emitter = new EventEmitter(), sent = [], scripts = [], focus = [];
  class FakeDate extends Date { static now() { return time; } }
  const exported = {};
  Function('exports', 'Date', ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText)(exported, FakeDate);
  const model = new UiModel((type, data) => native.emit('browserMessage', { arguments: [type, data] }), () => time);
  const controller = { on: native.on.bind(native), once: native.once.bind(native), emitter };
  const dispatch = event => {
    if (event.type === 'skympUi:packet') model.receive(event.detail);
    if (event.type === 'skympUi:probe') model.announce();
    if (event.type === 'skympUi:dismiss') model.dismiss();
  };
  const sp = { browser: { executeJavaScript(code) {
    scripts.push(code);
    if (codeHandler) codeHandler(code);
    else vm.runInNewContext(code, { JSON, window: { dispatchEvent: dispatch }, Event: class { constructor(type) { this.type = type; } }, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } } });
  } } };
  const bridge = new exported.UiCoreBridge(sp, controller, value => { focused = value; focus.push(value); focusHandler?.(value); }, 1);
  const receive = packet => emitter.emit('customPacketMessage', { message: { contentJsonDump: JSON.stringify(packet) } });
  emitter.on('sendMessage', event => {
    const packet = JSON.parse(event.message.contentJsonDump); sent.push(packet);
    if (!legacy || packet.customPacketType !== 'skympUi:framework') f.receive(userId, packet);
  });
  return { bridge, model, sent, scripts, focus, native, emitter, receive,
    get focused() { return focused; }, setExecute(handler) { codeHandler = handler; },
    setFocusHandler(handler) { focusHandler = handler; },
    front(type, data) { native.emit('browserMessage', { arguments: [type, data] }); },
    join() { emitter.emit('connectionAccepted'); model.announce(); emitter.emit('createActorMessage', { message: { isMe: true } }); },
    advance(ms) { time += ms; f.advance(ms); native.emit('update'); },
  };
}
module.exports = { nativeHarness };
