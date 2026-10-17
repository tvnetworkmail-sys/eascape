'use strict';
// Ground Items (page side) and the overlay core: labels, colours, the Alt boxes and list
// toggles, double-tap, tile highlights and the menu changes, against a fake client.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'src');
const runtime = fs.readFileSync(path.join(root, 'runtime', 'runtime.js'), 'utf8');
const page = fs.readFileSync(path.join(root, 'plugins', 'grounditems', 'page.js'), 'utf8');
const posted = [];
const handlers = {};
let now = 1000;
const window = { postMessage: (m) => posted.push(m), addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); } };
const ctx = vm.createContext({ window, document: { getElementById: () => null }, setInterval() {}, setTimeout() {}, clearTimeout() {}, performance: { now: () => now }, Int32Array, Math, String, Array, Object, RegExp, Proxy, Map, Set, JSON, Number, isFinite, parseInt });
vm.runInContext(runtime, ctx);
vm.runInContext(page, ctx);
const ll = vm.runInContext('window.__lostlite', ctx);
const gi = ll.__groundItems;
const cmd = (c) => handlers.message.forEach((fn) => fn({ source: window, data: { __lostliteCmd: c } }));

// ---- fake client: items on two tiles, flat ground, a projection that maps tile x,z to the view
const ITEMS = { 526: ['Bones', 1, false], 995: ['Coins', 1, true], 1319: ['Rune 2h sword', 128000, false], 1333: ['Rune scimitar', 25600, false], 314: ['Feather', 2, true] };
function list(objs) {
  let k = 0;
  return { head() { k = 0; return objs[k++] || null; }, next() { return objs[k++] || null; } };
}
const ground = [Array.from({ length: 104 }, () => new Array(104).fill(null))];
ground[0][50][50] = list([{ id: 526, n: 1 }, { id: 995, n: 250 }, { id: 995, n: 50 }, { id: 1319, n: 1 }]);
ground[0][52][50] = list([{ id: 314, n: 1500 }, { id: 1333, n: 1 }]);
const texts = [];
const font = { tag(str, x, y, rgb, shadow) { texts.push({ str, x, y, rgb, shadow }); }, wid(str) { return String(str).replace(/@[~a-z0-9]{3}@/g, '').length * 6; } };
const client = {
  lp: { px: 50 * 128 + 64, pz: 50 * 128 + 64 }, lvl: 0, bx: 3200, bz: 3200, go: ground,
  p11: font, p12: font, b12: font,
  px: -1, py: -1,
  proj(x, z, h) { this.px = 256 + (x - 50 * 128) / 4; this.py = 200 - (z - 50 * 128) / 4 - h; },
  n: 0, o: [], act: new Int32Array(500), a: new Int32Array(500), b: new Int32Array(500), c: new Int32Array(500),
};
const pixels = new Int32Array(512 * 334);
ll.configure({ fields: {
  localPlayer: 'lp', entityX: 'px', entityZ: 'pz', level: 'lvl', baseX: 'bx', baseZ: 'bz', groundObj: 'go',
  listHead: 'head', listNext: 'next', objId: 'id', objCount: 'n', objName: 'nm', objCost: 'cost', objStackable: 'st',
  fontP11: 'p11', fontP12: 'p12', fontB12: 'b12', fontDrawTag: 'tag', fontWidth: 'wid', project: 'proj', projectX: 'px', projectY: 'py',
  actions: { walk: 718, obj: [139, 778, 617, 224, 662, 1152, 370, 111], objTake: [139, 778, 617, 224, 662, 370, 111], objExamine: 1152, npc: [], npcExamine: -1 },
  menuCount: 'n', menuOption: 'o', menuAction: 'act', menuParamA: 'a', menuParamB: 'b', menuParamC: 'c',
}, features: {} });
// The entity x/z fields share names with the projection outputs in this fake; keep them apart.
ll.fields.entityX = 'ex';
ll.fields.entityZ = 'ez';
client.lp = { ex: 50 * 128 + 64, ez: 50 * 128 + 64 };
ll.setApi({ obj: (id) => ({ nm: ITEMS[id][0], cost: ITEMS[id][1], st: ITEMS[id][2] }), pix: () => ({ pixels, width: 512, height: 334 }), loopCycle: () => 0 });

const defaults = {};
for (const it of require('../src/plugins/grounditems/descriptor').config.items) defaults[it.key] = it.default;
function configure(over) {
  cmd({ type: 'plugin-config', id: 'grounditems', enabled: true, config: Object.assign({}, defaults, over) });
}
function frame() {
  texts.length = 0;
  pixels.fill(0);
  ll.frame(client);
  return texts.map((t) => t.str);
}

// ---- formatting
assert.strictEqual(gi.stackSize(9999), '9,999');
assert.strictEqual(gi.stackSize(10000), '10K');
assert.strictEqual(gi.stackSize(128000), '128K');
assert.strictEqual(gi.stackSize(1500000), '1.5M');

// ---- default settings: Bones and Coins hidden, same-id coins merged
configure({});
let shown = frame();
assert.deepStrictEqual(shown, ['Rune 2h sword', 'Feather (1,500)', 'Rune scimitar'], 'names and amounts, no prices');
const sword = texts[0];
assert.ok(texts.every((t) => t.rgb === 0xffffff), 'no price colours: all in the default colour');
assert.strictEqual(sword.shadow, true);

// ---- highlighted only
configure({ hiddenItems: '' });
shown = frame();
assert.ok(shown.includes('Coins (300)'), 'coins merged');
assert.strictEqual(shown.indexOf('Coins (300)') - shown.indexOf('Bones'), 1, 'stacked labels on one tile');
const bones = texts.find((t) => t.str === 'Bones');
const coins = texts.find((t) => t.str === 'Coins (300)');
assert.strictEqual(bones.y - coins.y, 15, 'labels stack 15px apart like RuneLite');
configure({ hiddenItems: '', highlightedItems: 'rune*', showHighlightedOnly: true });
shown = frame();
assert.deepStrictEqual(shown, ['Rune 2h sword', 'Rune scimitar'], 'wildcard highlight + highlighted only');
assert.ok(texts.every((t) => t.rgb === 0xaa00ff), 'highlight colour');
configure({ hiddenItems: 'Feather < 2000', highlightedItems: '' });
shown = frame();
assert.ok(!shown.includes('Feather (1,500)'), 'quantity threshold hides 1,500 feathers');
configure({ hiddenItems: 'Feather < 1000', highlightedItems: '' });
assert.ok(frame().includes('Feather (1,500)'), 'but not when over it');

// ---- Alt: hidden items show grey, boxes appear, clicks toggle lists
configure({}); // Bones and Coins hidden by default
const key = (k, down, extra = {}) => handlers[down ? 'keydown' : 'keyup'].forEach((fn) => fn(Object.assign({ key: k, repeat: false, preventDefault() { this.prevented = true; } }, extra)));
const altDown = { key: 'Alt', repeat: false, preventDefault() { this.prevented = true; } };
handlers.keydown.forEach((fn) => fn(altDown));
assert.ok(altDown.prevented, 'Alt is kept from the window menu');
shown = frame();
assert.ok(shown.includes('Bones') && shown.includes('Coins (300)'), 'hidden items shown while Alt is held');
assert.strictEqual(texts.find((t) => t.str === 'Bones').rgb, 0x808080, 'in the hidden colour');
// Hover the sword label's + box, click it
const sw = texts.find((t) => t.str === 'Rune 2h sword');
const w = font.wid('Rune 2h sword');
const plusX = sw.x - 2 + w + 4 + 2 + 8 + 2 + 4;
const boxY = sw.y - 10 + 4;
ll.mouse.x = plusX; ll.mouse.y = boxY;
frame();
const down = (button) => {
  const ev = { button, clientX: 0, clientY: 0, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
  // viewPoint needs the canvas; call the plugin path directly with the mouse position
  return ll.activePlugins[0].impl.mouseDown(ll.mouse.x, ll.mouse.y, button) ? ev : null;
};
assert.ok(down(0), 'click on + is eaten');
let lists = posted.filter((m) => m.type === 'grounditems-lists').pop().data;
assert.strictEqual(lists.highlightedItems, 'Rune 2h sword');
// The page side keeps its own copy until the settings come back; clicking - moves it to hidden
const minusX = sw.x - 2 + w + 4 + 2 + 4;
ll.mouse.x = minusX;
frame();
assert.ok(down(0));
lists = posted.filter((m) => m.type === 'grounditems-lists').pop().data;
assert.strictEqual(lists.highlightedItems, '', 'taken off highlighted');
assert.ok(/Rune 2h sword/.test(lists.hiddenItems), 'and put on hidden');
// Right-click the name: toggles hidden off again
ll.mouse.x = sw.x + 5; ll.mouse.y = sw.y - 5;
frame();
assert.ok(down(2));
lists = posted.filter((m) => m.type === 'grounditems-lists').pop().data;
assert.ok(!/Rune 2h sword/.test(lists.hiddenItems));
key('Alt', false);
ll.mouse.x = plusX;
frame();
assert.strictEqual(down(0), null, 'no clicks eaten without Alt');

// ---- double-tap Alt hides everything, next press shows again
now += 1000; key('Alt', true); key('Alt', false);
now += 100; key('Alt', true); key('Alt', false);
assert.strictEqual(gi.state().hideAll, true, 'double tap');
assert.deepStrictEqual(frame(), [], 'all hidden');
now += 1000; key('Alt', true);
assert.strictEqual(gi.state().hideAll, false);
key('Alt', false);
assert.ok(frame().length > 0);

// ---- tile highlight draws into the view
configure({ highlightTiles: true });
frame();
assert.ok(pixels.some((p) => p !== 0), 'tile polygons drawn');

// ---- menu: quantities, recolour, deprioritise, collapse
function menu(entries) {
  client.n = entries.length;
  entries.forEach((e, i) => { client.o[i] = e[0]; client.act[i] = e[1]; client.a[i] = e[2] || 0; client.b[i] = e[3] || 0; client.c[i] = e[4] || 0; });
  ll.menuBuilt(client);
  return client.o.slice(0, client.n);
}
configure({ deprioritizeHiddenItems: true, collapseEntries: true, highlightedItems: 'Rune 2h sword' });
const m = menu([
  ['Cancel', 1106],
  ['Walk here', 718],
  ['Examine @lre@Coins', 1152, 995, 50, 50],
  ['Take @lre@Coins', 617, 995, 50, 50],
  ['Take @lre@Coins', 617, 995, 50, 50],
  ['Take @lre@Rune 2h sword', 617, 1319, 50, 50],
  ['Take @lre@Bones', 617, 526, 50, 50],
]);
assert.strictEqual(m[m.length - 1].startsWith('Take '), true);
assert.ok(/^Take @~[0-9a-z]{2}@Rune 2h sword$/.test(m[m.length - 1]), `highlighted name recoloured and now the left click: ${m[m.length - 1]}`);
assert.strictEqual(ll.tagColour(/@(~[0-9a-z]{2})@/.exec(m[m.length - 1])[1]), 0xaa00ff, 'tag maps to the highlight colour');
const walkAt = m.indexOf('Walk here');
const coinsTake = m.findIndex((t) => t.startsWith('Take @lre@Coins'));
assert.ok(coinsTake < walkAt && coinsTake > 0, 'hidden coins below Walk here');
assert.strictEqual(m.filter((t) => t.startsWith('Take @lre@Coins')).length, 1, 'duplicates collapsed');
assert.ok(m.some((t) => t === 'Take @lre@Coins (300) x 2'), `quantity and count shown: ${m.join(' | ')}`);
console.log('ground items: ok');

// ---- switching off stops drawing and menu changes
cmd({ type: 'plugin-config', id: 'grounditems', enabled: false });
assert.deepStrictEqual(frame(), []);
const plain = menu([['Cancel', 1106], ['Take @lre@Coins', 617, 995, 50, 50]]);
assert.deepStrictEqual(plain, ['Cancel', 'Take @lre@Coins']);
console.log('ground items off: ok');

// ---- despawn timers: an item you drop gets 3:00 (300 ticks), loot where a monster died 2:00
ITEMS[1061] = ['Leather boots', 6, false];
ITEMS[1205] = ['Bronze dagger', 10, false];
let inv = [{ id: 1061, quantity: 1 }];
let npcs = [{ index: 7, x: 52 * 128 + 64, z: 52 * 128 + 64, size: 1, health: 3, totalHealth: 10 }];
ll.readContainer = () => inv.slice();
ll.readNpcs = () => npcs.map((n) => Object.assign({}, n));
configure({});
now += 5000;
frame();
now += 200;
inv = [];
ground[0][50][50] = list([{ id: 1061, n: 1 }]);
shown = frame();
assert.ok(shown.includes('Leather boots (3:00)'), `drop timer shown: ${shown.join(' | ')}`);
now += 200;
npcs[0].health = 0;
frame();
now += 200;
ground[0][52][52] = list([{ id: 1205, n: 1 }]);
shown = frame();
assert.ok(shown.includes('Bronze dagger (2:00)'), `loot timer shown: ${shown.join(' | ')}`);
now += 61000;
shown = frame();
assert.ok(shown.includes('Leather boots (1:59)') && shown.includes('Bronze dagger (0:59)'), `counting down: ${shown.join(' | ')}`);
configure({ despawnTimer: 'ticks' });
now += 200;
shown = frame();
assert.ok(shown.some((t) => /^Leather boots \(\d+\)$/.test(t)), `ticks mode: ${shown.join(' | ')}`);
configure({ despawnTimer: 'off' });
now += 200;
assert.ok(frame().includes('Leather boots'), 'timer off');
console.log('despawn timers: ok');
