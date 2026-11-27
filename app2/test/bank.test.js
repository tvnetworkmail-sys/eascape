'use strict';
// Bank search: the filtered view, withdraws going to the real slot, server updates landing
// in the real bank while searching, drag locked, and everything restored afterwards.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const runtime = fs.readFileSync(path.join(__dirname, '..', 'src', 'runtime', 'runtime.js'), 'utf8');
const posted = [];
const handlers = {};
const timers = [];
const window = { postMessage: (m) => posted.push(m), addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); } };
const ctx = vm.createContext({ window, setInterval: (fn) => timers.push(fn), setTimeout() {}, clearTimeout() {}, performance: { now: () => 0 }, Int32Array, Math, String, Array, Object, RegExp, Proxy, Map, isFinite });
vm.runInContext(runtime, ctx);
const ll = vm.runInContext('window.__lostlite', ctx);
const cmd = (c) => handlers.message.forEach((fn) => fn({ source: window, data: { __lostliteCmd: c } }));

// Items: id -> name (the bank stores id + 1)
const NAMES = { 995: 'Coins', 1925: 'Bucket', 2722: 'Clue scroll (hard)', 2801: 'Clue scroll (medium)', 952: 'Spade', 1712: 'Amulet of glory(4)' };
const bankItems = [995, 1925, 2722, 952, 2801, 1712];
const inv = { Al: new Int32Array(240), vl: new Int32Array(240), Hl: true, Uk: false };
bankItems.forEach((id, i) => { inv.Al[i] = id + 1; inv.vl[i] = (i + 1) * 10; });
const title = { Ml: 'The Bank of 2007RS', colour: 0xff981f };
const layer = { Ul: 120 };
const list = []; list[5382] = inv; list[5383] = title; list[5385] = layer;
const client = { GD: 5292, n: 0, o: [], act: new Int32Array(500), a: new Int32Array(500), b: new Int32Array(500), c: new Int32Array(500) };

ll.configure({ fields: { mainModal: 'GD', invObj: 'Al', invCount: 'vl', objName: 'Jj', objSwap: 'Hl', objReplace: 'Uk', scrollPos: 'Ul',
  closeModal: 'zD', sideModal: 'AD', chatModal: 'ED', redrawChat: 'FD', dialogInputOpen: 'jG', socialInputOpen: 'kG',
  menuCount: 'n', menuOption: 'o', menuAction: 'act', menuParamA: 'a', menuParamB: 'b', menuParamC: 'c' }, features: {} });
ll.setApi({ ifList: () => list, obj: (id) => ({ Jj: NAMES[id] }) });
ll.tick(client);
timers.forEach((t) => t()); // poll: logged in
timers.forEach((t) => t()); // bank check: open
assert.ok(posted.some((m) => m.type === 'bank-open' && m.data === true), 'bank detected');

// Search "clue"
cmd({ type: 'bank-search', query: 'Clue' });
const view = inv.Al;
assert.notStrictEqual(view, undefined);
assert.strictEqual(view[0] - 1, 2722, 'first match shown first');
assert.strictEqual(view[1] - 1, 2801);
assert.strictEqual(view[2], 0, 'nothing after the matches');
assert.strictEqual(inv.vl[1], 50, 'counts follow their items');
assert.strictEqual(posted.filter((m) => m.type === 'bank-count').pop().data, 2);
assert.strictEqual(title.Ml, 'Showing items: @red@clue');
assert.strictEqual(inv.Hl, false, 'drag off while searching');
assert.strictEqual(layer.Ul, 0, 'scrolled to top');

// The game builds "Withdraw-1 Clue scroll (medium)" for displayed slot 1 -> real slot 4
function menuFor(slot) {
  client.n = 2;
  client.o = ['Cancel', 'Withdraw 1 @lre@Clue scroll (medium)'];
  client.a[1] = view[slot] - 1; client.b[1] = slot; client.c[1] = 5382;
  ll.menuBuilt(client);
  assert.strictEqual(client.b[1], slot, 'the menu keeps the shown slot (the game drags by it)');
  ll.menuClick(client, 1);
  return client.b[1];
}
assert.strictEqual(menuFor(1), 4, 'withdraw goes to the real slot');
assert.strictEqual(client.a[1], 2801, 'and the right item');

// Server update while searching: real slot 2 (hard clue) withdrawn and emptied
inv.Al[2] = 0;
inv.vl[2] = 0;
assert.strictEqual(view[0] - 1, 2801, 'view updates: only the medium clue left');
assert.strictEqual(menuFor(0), 4);

// Clear: originals back, untouched by the filter
cmd({ type: 'bank-search', query: '' });
assert.ok(inv.Al instanceof Int32Array, 'real array restored');
assert.deepStrictEqual([...inv.Al.slice(0, 6)].map((x) => x - 1), [995, 1925, -1, 952, 2801, 1712], 'server write kept in the real slot');
assert.strictEqual(inv.Hl, true, 'drag restored');
assert.strictEqual(title.Ml, 'The Bank of 2007RS');

// Closing the bank clears the search
cmd({ type: 'bank-search', query: 'spade' });
assert.strictEqual(inv.Al[0] - 1, 952);
client.GD = -1;
timers.forEach((t) => t());
assert.ok(inv.Al instanceof Int32Array, 'restored on close');
assert.strictEqual(title.Ml, 'The Bank of 2007RS');
console.log('bank: ok');

// Chat prompt: drawn by the game, and the chatbox is asked to redraw when it changes
cmd({ type: 'chat-prompt', lines: ['Show items whose names contain the following text:', 'rune*'] });
assert.deepStrictEqual([...ll.chatPrompt], ['Show items whose names contain the following text:', 'rune*']);
assert.strictEqual(client.FD, true, 'chatbox redraw requested');
client.FD = false;
cmd({ type: 'chat-prompt', lines: null });
assert.strictEqual(ll.chatPrompt, null);
assert.strictEqual(client.FD, true);

// Esc: closes the open interface through the game's own close, not while typing an amount
let closed = 0;
client.zD = () => { closed++; client.GD = -1; client.AD = -1; };
client.GD = 5292; client.AD = 2005; client.jG = true;
cmd({ type: 'close-interface' });
assert.strictEqual(closed, 0, 'not while the game is asking for an amount');
client.jG = false;
cmd({ type: 'close-interface' });
assert.strictEqual(closed, 1, 'closed');
cmd({ type: 'close-interface' });
assert.strictEqual(closed, 1, 'nothing open: nothing sent');
console.log('chat prompt and esc: ok');
