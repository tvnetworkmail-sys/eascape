'use strict';
// Info Boxes (page side) against a fake client: the boxes, their layout and RuneLite's
// Alt-drag moving, the prayer potion reminder and the Opponent Information panel.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'src');
const posted = [];
const handlers = {};
const window = { postMessage: (m) => posted.push(m), addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); } };
const ctx = vm.createContext({ window, document: { getElementById: () => null }, setInterval() {}, setTimeout() {}, clearTimeout() {}, performance: { now: () => ctx.__now }, Date, Int32Array, Math, String, Array, Object, RegExp, Proxy, Map, Set, JSON, Number, isFinite, parseInt });
ctx.__now = 1000000;
vm.runInContext(fs.readFileSync(path.join(root, 'runtime', 'runtime.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'plugins', 'infoboxes', 'page.js'), 'utf8'), ctx);
const ll = vm.runInContext('window.__lostlite', ctx);
const ib = ll.__infoBoxes;
const plain = (x) => JSON.parse(JSON.stringify(x));

const texts = [];
const font = { tag(str, x, y, rgb) { texts.push({ str, x, y, rgb }); }, wid(str) { return String(str).length * 6; } };
// skills in the client's order (attack, defence, strength, hitpoints, ranged, prayer, magic, ...)
const xp = new Int32Array(25);
const base = new Int32Array(25).fill(50);
const boosted = new Int32Array(25).fill(50);
const varps = new Int32Array(2000);
const client = { lp: {}, xp, base, boosted, varps, it: 0, b12: font, p11: font, p12: font, menuCount: 0 };
const pixels = new Int32Array(512 * 334);
ll.configure({ fields: {
  localPlayer: 'lp', statXP: 'xp', statBaseLevel: 'base', statEffectiveLevel: 'boosted', varps: 'varps', idleTimer: 'it',
  fontB12: 'b12', fontP11: 'p11', fontP12: 'p12', fontDrawTag: 'tag', fontWidth: 'wid',
}, features: {} });
ll.setApi({ pix: () => ({ pixels, width: 512, height: 334 }), loopCycle: () => 0 });
ll.client = client;
const icons = JSON.parse(fs.readFileSync(path.join(root, 'plugins', 'infoboxes', 'icons.json'), 'utf8'));
assert.strictEqual(icons.prayers.length, 15, '15 prayer icons');
assert.ok(icons.skills.attack && icons.misc.hourglass && icons.misc.boostup, 'skill and own icons');
const defaults = {};
for (const it of require('../src/plugins/infoboxes/descriptor').config.items) defaults[it.key] = it.default;
const configure = (over) => ll.pluginConfig({ id: 'infoboxes', enabled: true, config: Object.assign({}, defaults, { icons, layout: null }, over) });
configure({});

const frame = () => { texts.length = 0; ll.frame(client, 0); ll.frame(client, 1); return texts.map((t) => t.str); };
const items = () => ib.drawn().flatMap((x) => x.boxes || []);
const group = (name) => ib.drawn().find((x) => x.name === name);
const names = () => plain(items().map((p) => p.box.name));

// ---- nothing to show at first
frame();
assert.deepStrictEqual(names(), [], 'no boxes with nothing boosted');

// ---- boosts: attack up 5 (green), strength drained (red); hitpoints never; combat only by default
boosted[0] = 55;
boosted[2] = 47;
boosted[3] = 30; // hitpoints after a fight
boosted[10] = 55; // fishing (non-combat)
frame();
assert.deepStrictEqual(names(), ['Boost Attack', 'Boost Strength', 'Next boost drop'], `boxes: ${names()}`);
const attack = items()[0];
assert.strictEqual(attack.box.text, '55');
assert.strictEqual(attack.box.colour, 0x00ff00, 'above the threshold: green');
assert.strictEqual(items()[1].box.colour, 0xee3333, 'drained: red');
assert.deepStrictEqual([attack.x, attack.y, attack.s], [2, 2, 35], 'top left, 35 px');
assert.strictEqual(items()[1].x, 2 + 36, 'next to it with a 1 px gap');
configure({ relativeBoost: true, displayBoosts: 'both', boostThreshold: 5 });
frame();
assert.ok(names().includes('Boost Fishing'), 'both: fishing too');
assert.strictEqual(items()[0].box.text, '+5', 'relative');
assert.strictEqual(items()[0].box.colour, 0xffff00, 'at the threshold: yellow');
console.log('boosts: ok');

// ---- next boost drop: a minute after login, then from the drop it sees
let t = items().find((p) => p.box.name === 'Next boost drop').box;
assert.strictEqual(t.text, '1:00');
ctx.__now += 25000;
boosted[0] = 54; // dropped back by one: the timer just ran
frame();
t = items().find((p) => p.box.name === 'Next boost drop').box;
assert.strictEqual(t.text, '1:00', 'restarts from the drop it saw');
ctx.__now += 15000;
frame();
t = items().find((p) => p.box.name === 'Next boost drop').box;
assert.strictEqual(t.text, '0:45');
console.log('next boost drop: ok');

// ---- logout timer: last 30 s of the 90 s
configure({});
client.it = ctx.__now - 50000;
frame();
assert.ok(!names().includes('Logout timer'), 'not at 50 s idle');
client.it = ctx.__now - 70000;
frame();
const lo = items().find((p) => p.box.name === 'Logout timer');
assert.ok(lo && lo.box.text === '0:20' && lo.box.colour === 0xffffff, 'shows 0:20 at 70 s');
assert.strictEqual(ib.drawn()[0].name, 'Logout timer', 'its own group, first at the top left');
client.it = ctx.__now - 85000;
frame();
assert.strictEqual(items()[0].box.colour, 0xff4040, 'red near the end');
client.it = ctx.__now;
console.log('logout timer: ok');

// ---- prayers
varps[83 + 12] = 1; // Protect from Magic
varps[83] = 1; // Thick Skin
frame();
assert.ok(names().includes('Prayer Protect from Magic') && names().includes('Prayer Thick Skin'), `prayers: ${names()}`);
assert.deepStrictEqual(plain(ib.drawn().map((g) => g.name)), ['Boosts', 'Prayer'], 'each kind in its own group');
assert.deepStrictEqual([group('Prayer').x, group('Prayer').y], [2, 2 + 35 + 2], 'the prayer group is its own row under the boosts');
console.log('prayers: ok');

// ---- choosing which boxes (the sidebar's tick boxes)
configure({ show_prayers: false, show_boostTimer: false });
frame();
assert.deepStrictEqual(names(), ['Boost Attack', 'Boost Strength']);
configure({});

// ---- drawing: RuneLite's box (fill + two edges), the image centred at its own size, text at the bottom
const ops = plain(ib.ops());
const img = ops.find((o) => o.op === 'image');
assert.ok(img && img.w === 25 && img.h === 25 && img.x === 2 + 5 && img.y === 2 + 5, `25 px icon centred in 35 px: ${JSON.stringify(img && { x: img.x, y: img.y, w: img.w })}`);
const txt = ops.find((o) => o.op === 'text');
assert.ok(txt && txt.y === 2 + 35 - 3 && /LLRunescape,/.test(txt.font), 'text at the bottom in the RuneScape font');
assert.strictEqual(ops.filter((o) => o.op === 'stroke').length, 2 * items().length, 'two edge lines per box');
configure({ size: 20 });
frame();
const small = plain(ib.ops()).find((o) => o.op === 'image');
assert.ok(small.w === 20 && small.h === 20, 'shrunk to fit a smaller box');
assert.ok(/LLRunescapeSmall/.test(plain(ib.ops()).find((o) => o.op === 'text').font), 'small font under 32 px');
configure({});

// ---- tooltip when hovering a box
ll.mouse.x = 10;
ll.mouse.y = 10;
ll.mouse.inView = true;
frame();
const tips = plain(ib.ops()).filter((o) => o.op === 'text').map((o) => o.text);
assert.ok(tips.includes('Attack boost: 54/50'), `tooltip: ${tips.join(' | ')}`);


// ---- prayer potion: pops up when a dose won't be wasted (7 + 25% of the level, Lost City)
const PR = 5; // prayer in the client's skill order
base[PR] = 43;
boosted[PR] = 27;
let inventory = [{ id: 2434, quantity: 1 }];
ll.readContainer = () => inventory.slice();
ll.itemIcon = (id) => ({ w: 32, h: 32, px: new Array(1024).fill(id === 2434 ? 0xff00ff00 : 0xffff0000) });
frame();
assert.ok(!names().includes('Prayer potion'), 'missing 16 of a 17 point dose: not yet');
boosted[PR] = 26;
frame();
let pp = items().find((p) => p.box.name === 'Prayer potion');
assert.ok(pp && pp.box.text === '26' && pp.box.colour === 0xff3333 && pp.box.image.px[0] === 0xff00ff00, 'shows the prayer potion with the points left');
assert.strictEqual(pp.box.tooltip, 'Drink a prayer potion: +17 prayer (26/43)');
inventory = [{ id: 3026, quantity: 1 }];
boosted[PR] = 25;
frame();
pp = items().find((p) => p.box.name === 'Prayer potion');
assert.ok(pp && /super restore: \+18/.test(pp.box.tooltip), 'super restore: 8 + 25%');
inventory = [];
frame();
assert.ok(!names().includes('Prayer potion'), 'no potion with you: hidden');
configure({ prayerWithout: true });
frame();
assert.ok(names().includes('Prayer potion'), 'unless asked');
configure({ prayerMode: 'level', prayerLevel: 10, prayerWithout: true });
frame();
assert.ok(!names().includes('Prayer potion'), 'below a level: not at 26');
boosted[PR] = 10;
frame();
assert.ok(names().includes('Prayer potion'), 'at 10');
boosted[PR] = 43;
configure({});
console.log('prayer potion: ok');

// ---- Opponent Information: a panel above the boxes, RuneLite's colours and "16/30"
vm.runInContext(fs.readFileSync(path.join(root, 'plugins', 'opponentinfo', 'page.js'), 'utf8'), ctx);
ll.pluginConfig({ id: 'opponentinfo', enabled: true, config: { hitpointsDisplayStyle: 'hitpoints', showOpponentHealthOverlay: true } });
Object.assign(ll.fields, { faceEntity: 'face' });
const npcs = [{ index: 7, name: 'King Scorpion', health: 16, totalHealth: 30, inCombat: true }];
ll.readNpcs = () => npcs.map((n) => Object.assign({}, n));
ll.readPlayers = () => [];
client.lp = { face: 7 };
frame();
const panel = ib.drawn().find((x) => x.panel);
assert.ok(panel && panel.x === 2 && panel.y === 2 && panel.panel.width === 129 && panel.panel.height === 38, `panel at the top left, 129 x 38: ${panel && JSON.stringify({ x: panel.x, y: panel.y, w: panel.panel.width, h: panel.panel.height })}`);
let pops = plain(ib.ops());
assert.ok(pops.some((o) => o.op === 'text' && o.text === 'King Scorpion') && pops.some((o) => o.op === 'text' && o.text === '16/30'), 'name and hitpoints');
assert.ok(pops.some((o) => o.op === 'fill' && o.colour === 'rgba(0,146,54,0.902)' && o.w === Math.floor(125 * 16 / 30)), 'green part 16/30 of the bar');
assert.strictEqual(items()[0].y, 2 + 38 + 2, 'the boxes start under it');
ll.pluginConfig({ id: 'opponentinfo', enabled: true, config: { hitpointsDisplayStyle: 'both' } });
frame();
assert.ok(plain(ib.ops()).some((o) => o.text === '16/30 (53.3%)'), 'both');
// stops fighting: kept 5 s (RuneLite's WAIT), then gone
client.lp = { face: -1 };
npcs[0].inCombat = false;
frame();
assert.ok(ib.drawn().some((x) => x.panel), 'still there');
ctx.__now += 5100;
frame();
assert.ok(!ib.drawn().some((x) => x.panel), 'gone after 5 s');
console.log('opponent info: ok');

// ---- moving: Alt + drag a group; the other groups move up; Alt + right-click puts it back
const p = ll.pagePlugins.get('infoboxes').impl;
client.lp = {};
boosted[0] = 55;
varps[83] = 1;
frame();
const boostsAt = [group('Boosts').x, group('Boosts').y];
const prayer = group('Prayer');
ll.altDown = true;
assert.strictEqual(p.mouseDown(prayer.x + 5, prayer.y + 5, 0), true, 'Alt + click on a group picks it up (the game never sees it)');
p.mouseMove(300 + 5, 100 + 5);
frame();
assert.ok(plain(ib.ops()).some((o) => o.op === 'stroke' && /^rgba\(255,255,0,/.test(o.colour)), 'yellow outlines');
let moved = group('Prayer');
assert.deepStrictEqual([moved.x, moved.y], [300, 100], 'follows the mouse');
assert.deepStrictEqual([moved.boxes[0].x, moved.boxes[0].y], [300, 100], 'its boxes with it');
p.mouseUp(305, 105, 0);
frame();
assert.deepStrictEqual(plain(ib.layout().pos.Prayer), { x: 300, y: 100 }, 'position saved');
assert.deepStrictEqual([group('Boosts').x, group('Boosts').y], boostsAt, 'the boosts stay put');
p.mouseDown(305, 105, 2);
frame();
moved = group('Prayer');
assert.ok(moved.x === 2 && moved.y !== 100, 'Alt + right-click: back at the top left');
ll.altDown = false;
assert.strictEqual(p.mouseDown(10, 10, 0), false, 'without Alt clicks go to the game');
// saved positions come back, kept inside the view
configure({ layout: { pos: { Boosts: { x: 600, y: 900 } } } });
frame();
const g2 = group('Boosts');
assert.deepStrictEqual([g2.x + g2.w, g2.y + g2.h], [512, 334], 'clamped to the view');
configure({ layout: { layers: { x: 'y' }, groups: {} } }); // a 0.18 layout: starts again
frame();
assert.deepStrictEqual([items()[0].x, items()[0].y], [2, 2]);
client.lp = null;
frame();
assert.deepStrictEqual(names(), []);
console.log('moving: ok');

// ---- off-screen hint arrow (3.3)
Object.assign(ll.fields, { hintType: 'ht', hintTileX: 'hx', hintTileZ: 'hz', hintNpc: 'hn', project: 'proj', projectX: 'px', projectY: 'py', baseX: 'bx', baseZ: 'bz', cameraYaw: 'yaw', entityX: 'ex', entityZ: 'ez' });
client.lp = { ex: 50 * 128 + 64, ez: 50 * 128 + 64 };
Object.assign(client, { bx: 3200, bz: 3200, yaw: 0, ht: 2, hx: 3260, hz: 3250, px: -1, py: -1 });
let shown = null;
client.proj = function (x, z) { if (shown) { this.px = shown.x; this.py = shown.y; } else { this.px = -1; this.py = -1; } };
const arrows = () => ib.ops().filter((o) => o.op === 'arrow');
shown = { x: 200, y: 150 };
frame();
assert.strictEqual(arrows().length, 0, 'no arrow while you can see it');
shown = { x: 900, y: 167 };
frame();
let a = arrows()[0];
assert.ok(a && Math.abs(a.angle) < 0.01 && Math.round(a.x / ib.scale()) === 512 - 16, 'off to the right: arrow at the right edge pointing right');
shown = null; // behind the camera: the way from you, turned with the camera
frame();
a = arrows()[0];
assert.ok(a && Math.abs(a.angle) < 0.01, 'east of you with the camera facing north: pointing right');
client.yaw = 512; // a quarter turn
frame();
a = arrows()[0];
assert.ok(a && Math.abs(Math.abs(a.angle) - Math.PI / 2) < 0.01, 'turned with the camera');
configure({ showHintArrow: false });
frame();
assert.strictEqual(arrows().length, 0, 'switched off');
client.ht = 0;
console.log('hint arrow: ok');

// ---- Panel size scales every panel
ll.addOverlayPanel('testpanel', () => [{ name: 'Test', rows: [{ type: 'title', text: 'Goblin' }, { type: 'bar', fraction: 0.5, fg: '#0f0', bg: '#f00', text: '5/10' }] }]);
client.lp = { ex: 64, ez: 64 };
configure({});
frame();
const pw = () => ib.drawn().find((x) => x.name === 'Test');
const p100 = pw();
assert.ok(p100 && p100.panel.width === 129 && p100.panel.height === 38, `RuneLite size: ${p100 && p100.panel.width}x${p100 && p100.panel.height}`);
configure({ panelSize: 200 });
frame();
assert.ok(pw().panel.width === 258 && pw().panel.height === 76, 'twice the size');
const barFill = ib.ops().filter((o) => o.op === 'fill' && o.colour === '#0f0')[0];
assert.ok(barFill && barFill.h === 32, 'the bar grows with it');
console.log('panel size: ok');

// ---- a plugin's own Panel size, times the one for every panel
ll.addOverlayPanel('testpanel2', () => [{ name: 'Own', size: 150, rows: [{ type: 'title', text: 'Goblin' }] }]);
configure({ panelSize: 100 });
frame();
const own = ib.drawn().find((x) => x.name === 'Own');
assert.ok(own && own.panel.width === Math.round(129 * 1.5), `plugin's own size: ${own && own.panel.width}`);
configure({ panelSize: 200 });
frame();
assert.strictEqual(ib.drawn().find((x) => x.name === 'Own').panel.width, Math.round(129 * 3), 'both together');
console.log('own panel size: ok');
