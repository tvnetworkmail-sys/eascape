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
const title = { Ml: 'The Bank of RuneScape', colour: 0xff981f };
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
assert.strictEqual(title.Ml, 'The Bank of RuneScape');

// Closing the bank clears the search
cmd({ type: 'bank-search', query: 'spade' });
assert.strictEqual(inv.Al[0] - 1, 952);
client.GD = -1;
timers.forEach((t) => t());
assert.ok(inv.Al instanceof Int32Array, 'restored on close');
assert.strictEqual(title.Ml, 'The Bank of RuneScape');
console.log('bank: ok');

// Placeholders: LostLite keeps the layout; an emptied item keeps its place
ll.info.features.drag = true;
client.GD = 5292;
timers.forEach((t) => t());
cmd({ type: 'bank-layout', placeholders: true, layout: [] });
timers.forEach((t) => t());
const pv = inv.Al;
const shown = () => [...Array(7)].map((_, i) => pv[i] - 1);
assert.deepStrictEqual(shown(), [995, 1925, 952, 2801, 1712, -1, -1], 'laid out without the gap');
assert.strictEqual(JSON.stringify(posted.filter((m) => m.type === 'bank-layout').pop().data), '[995,1925,952,2801,1712]', 'layout saved');
assert.strictEqual(inv.Hl, true, 'rearranging allowed');
inv.Al[1] = 0; inv.vl[1] = 0; // all buckets withdrawn
assert.deepStrictEqual(shown(), [995, -1, 952, 2801, 1712, -1, -1], 'placeholder keeps the bucket\'s place');
assert.strictEqual(ll.bank.ph[1], 1925);
inv.Al[6] = 1926; inv.vl[6] = 3; // deposited: the server puts it at the end
assert.deepStrictEqual(shown(), [995, 1925, 952, 2801, 1712, -1, -1], 'back in its place');
assert.strictEqual(inv.vl[1], 3);
assert.strictEqual(menuFor(1), 6, 'withdraw from the real slot');
// drag spade onto coins (swap), then insert-mode drag amulet to the front
assert.strictEqual(ll.invDrag(5382, 2, 0, 0), true, 'handled by LostLite');
assert.deepStrictEqual(shown().slice(0, 5), [952, 1925, 995, 2801, 1712]);
ll.invDrag(5382, 4, 0, 1);
assert.deepStrictEqual(shown().slice(0, 5), [1712, 952, 1925, 995, 2801]);
assert.strictEqual(ll.invDrag(1234, 0, 1, 0), false, 'other inventories are the game\'s');
// release a placeholder
inv.Al[6] = 0; inv.vl[6] = 0;
assert.strictEqual(shown()[2], -1);
ll.bankRelease(1925);
assert.deepStrictEqual(shown().slice(0, 5), [1712, 952, 995, 2801, -1]);
// where the slots are: root (0, 0 on the view) > layer at 37,55 (scrolled 76) > inv at 38,3
Object.assign(ll.fields, { comChildren: 'kids', comChildX: 'cx', comChildY: 'cy', comType: 'type', comWidth: 'w', comHeight: 'h', comX: 'x', comY: 'y', comHide: 'hide', mouseX: 'mx', mouseY: 'my' });
list[5292] = { kids: [5385], cx: [37], cy: [55], type: 0, w: 512, h: 334 };
Object.assign(layer, { kids: [5382], cx: [38], cy: [3], type: 0, w: 427, h: 229, Ul: 76 });
Object.assign(inv, { type: 2 });
const at = ll.bankSlots();
assert.deepStrictEqual([at.x, at.y, at.clip.y0, at.clip.y1], [75, -18, 55, 284], JSON.stringify(at));
assert.strictEqual(ll.bankSlotAt(75 + 47 * 2 + 5, -18 + 38 * 3 + 5), 26, 'row 3, column 2');
assert.strictEqual(ll.bankSlotAt(75 + 40, 100), -1, 'between slots');
assert.strictEqual(ll.bankSlotAt(80, 40), -1, 'above the scroll area');
// "Release" under Cancel on a placeholder
inv.Al[5] = 0; inv.vl[5] = 0; // amulet withdrawn: placeholder at display slot 0
layer.Ul = 0;
client.n = 1; client.o = ['Cancel']; client.mx = 4 + 75 + 5; client.my = 4 + 58 + 5;
ll.menuBuilt(client);
assert.strictEqual(client.n, 2);
assert.ok(/^Release @lre@Amulet of glory\(4\)$/.test(client.o[0]) && client.o[1] === 'Cancel', JSON.stringify(client.o));
ll.menuClick(client, 0);
assert.strictEqual(inv.Al[0] - 1, 952, 'released');
// drawn: the faded icon and "0"
const drawn = [];
ll.itemIcon = () => ({ w: 32, h: 32, px: new Int32Array(1024) });
inv.Al[3] = 0; inv.vl[3] = 0; // spade withdrawn: placeholder at display slot 0
ll.bankDrawPlaceholders({ image: (img, x, y, a) => drawn.push(['image', x, y, a, img.h]), text: (s, x, y) => drawn.push(['text', s, x, y]) });
assert.strictEqual(JSON.stringify(drawn), JSON.stringify([['image', 75, 58, 96, 32], ['text', '0', 75, 67]]), JSON.stringify(drawn));
// searching with placeholders: no rearranging, then back
cmd({ type: 'bank-search', query: 'clue' });
assert.deepStrictEqual(shown().slice(0, 2), [2801, -1]);
assert.strictEqual(inv.Hl, false);
assert.strictEqual(ll.invDrag(5382, 0, 1, 0), true, 'drags ignored while searching');
cmd({ type: 'bank-search', query: '' });
assert.strictEqual(inv.Hl, true);
assert.deepStrictEqual(shown().slice(0, 4), [-1, 995, 2801, -1], 'spade placeholder still first');
// switched off: the game's own bank again
cmd({ type: 'bank-layout', placeholders: false });
assert.ok(inv.Al instanceof Int32Array, 'restored');
client.GD = -1;
timers.forEach((t) => t());
console.log('bank placeholders: ok');

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
