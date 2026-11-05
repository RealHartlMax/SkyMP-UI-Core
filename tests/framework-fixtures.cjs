const { menu, menuState } = require('./helpers.cjs');
const panel = (id = 'alpha:panel', priority = 0) => ({ ...menu('core:panel-v1'), id, owner: id.split(':')[0], priority });
const panelState = () => ({ ...menuState(), fields: [{ id: 'amount', type: 'number', label: 'Amount', min: 1, max: 5, required: true }],
  content: { version: 1, blocks: [{ id: 'message', kind: 'text', text: '<img src=x onerror=alert(1)>' }], tabs: [
    { id: 'overview', label: 'Overview', blocks: [
      { id: 'tasks', kind: 'list', label: 'Tasks', selectable: true, required: true, items: [{ id: 'first', label: 'First' }, { id: 'locked', label: 'Locked', disabled: true }] },
      { id: 'skill', kind: 'progress', label: 'Progress', value: 2, max: 5 },
    ] },
    { id: 'inventory', label: 'Inventory', blocks: [
      { id: 'items', kind: 'item-list', label: 'Items', selectable: true, items: [{ id: 'apple', label: 'Apple', quantity: 2, value: '4 gold', detail: 'Server description' }] },
      { id: 'rows', kind: 'table', label: 'Prices', selectable: true, columns: [{ id: 'name', label: 'Name' }, { id: 'price', label: 'Price' }], rows: [{ id: 'offer', cells: ['Offer', 10] }] },
    ] },
  ] },
});
const registerPanel = (f, id = 'alpha:panel', handler = () => {}, authorize = () => true, priority = 0) => {
  const d = panel(id, priority); f.api.registerMenu(d); f.api.onAction(d.owner, id, 'confirm', handler, { authorize }); return d;
};
function readyFramework(f, userId = 0, frontId = userId === 0 ? 'frontA' : 'frontB') {
  const s = f.ready(userId, frontId);
  f.receive(userId, { customPacketType: 'skympUi:framework', protocolVersion: 1, frontId, sessionId: s.sessionId, frameworkVersion: 1 });
  return f.output.filter(p => p.userId === userId && p.customPacketType === 'skympUi:snapshot').at(-1);
}
module.exports = { panel, panelState, registerPanel, readyFramework };
