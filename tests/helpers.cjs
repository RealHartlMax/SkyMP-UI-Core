const { EventEmitter } = require('node:events');
const { createUiCore } = require('../dist/runtime.cjs');
function fixture(config = {}) {
  const mp = new EventEmitter(), output = [], logs = [], connected = new Map([[0, 101], [1, 102]]);
  let time = 10000;
  mp.isConnected = id => connected.has(id); mp.getUserActor = id => connected.get(id) ?? 0;
  mp.getUserByActor = actor => [...connected].find(([, a]) => a === actor)?.[0] ?? -1;
  mp.getUserGuid = id => 'native-guid-' + id;
  mp.sendCustomPacket = (userId, data) => output.push({ userId, ...JSON.parse(data) });
  const log = Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, msg => logs.push({ level, msg })]));
  const runtime = createUiCore(mp, { config, autoFlush: false, now: () => time, log });
  const receive = (userId, data) => mp.emit('customPacket', userId, JSON.stringify(data));
  const ready = (userId = 0, frontId = 'frontA') => {
    receive(userId, { customPacketType: 'skympUi:ready', protocolVersion: 1, frontId });
    return output.filter(p => p.userId === userId && p.customPacketType === 'skympUi:snapshot').at(-1);
  };
  return { mp, output, logs, connected, runtime, api: runtime.api, receive, ready,
    advance: ms => { time += ms; }, clear: () => { output.length = 0; }, flush: runtime.flush };
}
const widget = (id = 'alpha:status', owner = 'alpha', kind = 'status') => ({ id, owner, kind, schemaVersion: 1 });
const menu = (layoutId = 'core:dialog-v1') => ({ id: 'alpha:menu', owner: 'alpha', title: 'Menu', schemaVersion: 1, layoutId });
const menuState = () => ({ schemaVersion: 1, text: 'Private', actions: [{ id: 'confirm', label: 'Confirm' }] });
function setupAction(f, handler = () => {}, authorize = () => true) {
  f.api.registerMenu(menu()); f.api.onAction('alpha', 'alpha:menu', 'confirm', handler, authorize === null ? undefined : { authorize });
  f.api.openMenu({ userId: 0 }, 'alpha:menu', menuState());
  return f.ready();
}
const action = (snapshot, counter = 1, extra = {}) => ({ customPacketType: 'skympUi:action', protocolVersion: 1, widgetId: 'alpha:menu', actionId: 'confirm', requestId: snapshot.sessionId + '_' + counter, payload: {}, ...extra });
module.exports = { fixture, widget, menu, menuState, setupAction, action, settled: () => new Promise(setImmediate) };
