'use strict';
// Ground Markers, Object Markers, Woodcutting, Mining, Loot Tracker and Chat Notifications,
// against fakes.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'src');
const posted = [];
const window = { postMessage: (m) => posted.push(m), addEventListener() {} };
const ctx = vm.createContext({ window, document: { getElementById: () => null }, setInterval() {}, setTimeout() {}, clearTimeout() {}, performance: { now: () => ctx.__now }, Date, Int32Array, Math, String, Array, Object, RegExp, Proxy, Map, Set, JSON, Number, isFinite, parseInt });
ctx.__now = 1e6;
for (const f of ['runtime/runtime.js', 'plugins/infoboxes/page.js', 'plugins/groundmarkers/page.js', 'plugins/objectindicators/page.js', 'plugins/woodcutting/page.js', 'plugins/mining/page.js', 'plugins/loottracker/page.js', 'plugins/cooking/page.js', 'plugins/agility/page.js', 'plugins/fishing/page.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
}
const ll = vm.runInContext('window.__lostlite', ctx);
const plain = (x) => JSON.parse(JSON.stringify(x));
const on = (id, config) => ll.pluginConfig({ id, enabled: true, config });
const impl = (id) => ll.pagePlugins.get(id).impl;
const lastPost = (type) => posted.filter((p) => p.type === type).pop();

// ---- a fake scene: you at scene tile 50,50 of base 3200,3200; tile x,z projects to (x*10, z*10)
const me = { face: -1, anim: -1 };
const client = { lp: me, menuCount: 0, bx: 3200, bz: 3200, lvl: 0 };
Object.assign(ll.fields, { localPlayer: 'lp', faceEntity: 'face', primaryAnim: 'anim', menuCount: 'menuCount', baseX: 'bx', baseZ: 'bz', level: 'lvl' });
ll.client = client;
let locs = {}; // "x,z" -> [{ kind, id, typecode }]
let ground = {}; // "x,z" -> [{ id, count }]
let npcs = [];
const polys = [];
const g = {
  client, baseX: 3200, baseZ: 3200, level: 0,
  player: () => ({ x: 50 * 128 + 64, z: 50 * 128 + 64 }),
  tilePoly: (x, z) => [{ x: x * 10, y: z * 10 }, { x: x * 10 + 10, y: z * 10 }, { x: x * 10 + 10, y: z * 10 + 10 }, { x: x * 10, y: z * 10 + 10 }],
  tileAt: (mx, my) => ({ x: Math.floor(mx / 10), z: Math.floor(my / 10) }),
  project: (x, z) => ({ x: x / 12.8, y: z / 12.8 }),
  polygon: (pts, rgb, o) => polys.push({ pts, rgb, o }),
  hull: (tc) => (tc === 777 ? [{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 5, y: 9 }] : null),
  locs: (x, z) => locs[`${x},${z}`] || [],
  groundItems: (x, z) => ground[`${x},${z}`] || null,
  npcs: () => npcs.map((n) => Object.assign({}, n)),
};
function menu(entries, shift = true) {
  const opt = entries.map((e) => e[0]);
  const arrs = [opt, new Int32Array(50), new Int32Array(50), new Int32Array(50), new Int32Array(50)];
  entries.forEach((e, i) => { arrs[1][i] = e[1] || 0; arrs[2][i] = e[2] || 0; arrs[3][i] = e[3] || 0; arrs[4][i] = e[4] || 0; });
  client.menuCount = entries.length;
  Object.assign(client, { mo: arrs[0], ma: arrs[1], pa: arrs[2], pb: arrs[3], pc: arrs[4] });
  Object.assign(ll.fields, { menuOption: 'mo', menuAction: 'ma', menuParamA: 'pa', menuParamB: 'pb', menuParamC: 'pc' });
  ll.shiftDown = shift;
  return arrs;
}

// ---------------------------------------------------------------- Ground Markers
on('groundmarkers', { markerColor: '#FFFF00', borderWidth: 2, fillOpacity: 50, points: [] });
ll.mouse.x = 455;
ll.mouse.y = 505;
ll.mouse.inView = true;
impl('groundmarkers').frame(g);
let arrs = menu([['Cancel'], ['Walk here']]);
impl('groundmarkers').menuAfter(client, arrs, ll);
assert.deepStrictEqual(plain(arrs[0].slice(0, client.menuCount)), ['Cancel', 'Mark tile', 'Walk here'], 'Mark tile under Walk here');
ll.pluginEntries.get(`Mark tile|${arrs[2][1]}|${arrs[3][1]}|${arrs[4][1]}`)();
assert.deepStrictEqual(plain(lastPost('groundmarkers-points').data), [{ x: 3245, y: 3250, level: 0 }], 'saved as a world tile');
polys.length = 0;
impl('groundmarkers').frame(g);
assert.ok(polys.length === 1 && polys[0].rgb === 0xffff00 && polys[0].o.width === 2 && polys[0].o.fillAlpha === 50, 'drawn in the tile colour');
arrs = menu([['Cancel'], ['Walk here']]);
impl('groundmarkers').menuAfter(client, arrs, ll);
assert.strictEqual(arrs[0][1], 'Unmark tile');
arrs = menu([['Cancel'], ['Walk here']], false);
impl('groundmarkers').menuAfter(client, arrs, ll);
assert.strictEqual(client.menuCount, 2, 'only with Shift');
console.log('ground markers: ok');

// ---------------------------------------------------------------- Object Markers
on('objectindicators', { highlightHull: true, markerColor: '#FFFF00', borderWidth: 2, objects: [] });
const oakTc = 777;
locs['52,51'] = [{ kind: 'scenery', id: 1281, typecode: oakTc }];
arrs = menu([['Cancel'], ['Examine @cya@Oak', 0, (1281 << 14) | 52 | (51 << 7), 52, 51], ['Chop down @cya@Oak']]);
impl('objectindicators').menuAfter(client, arrs, ll);
assert.strictEqual(arrs[0][1], 'Mark object @cya@Oak', 'under Examine');
ll.pluginEntries.get(`Mark object @cya@Oak|${arrs[2][1]}|${arrs[3][1]}|${arrs[4][1]}`)();
assert.deepStrictEqual(plain(lastPost('objectindicators-objects').data), [{ id: 1281, name: 'Oak', x: 3252, y: 3251, level: 0 }]);
polys.length = 0;
impl('objectindicators').frame(g);
assert.ok(polys.length === 1 && polys[0].pts.length === 3 && polys[0].o.fill === 0 && polys[0].o.fillAlpha === 50, 'hull outlined, faint black fill');
console.log('object markers: ok');

// ---------------------------------------------------------------- Woodcutting
const trees = JSON.parse(fs.readFileSync(path.join(root, 'plugins', 'woodcutting', 'trees.json'), 'utf8'));
assert.deepStrictEqual(trees['1281'], { max: 30, min: 30, name: 'oak' }, 'oak from trees.dbrow');
on('woodcutting', { statTimeout: 5, showWoodcuttingStats: true, showRespawnTimers: true, table: trees });
on('infoboxes', { layout: null });
const wc = ll.__woodcutting;
impl('woodcutting').frame(g); // sees the oak
ll.onChat(0, 'You get some oak logs.', '');
me.anim = 879;
let pan = wc.panels(ctx.__now);
assert.deepStrictEqual(plain(pan[0].rows), [{ type: 'title', text: 'Woodcutting', colour: 0x00ff00 }, { type: 'line', left: 'Logs cut:', right: '1' }]);
ll.onChat(0, 'You get some oak logs.', '');
ll.onChat(0, 'You get some logs.', '');
ctx.__now += 60000;
me.anim = -1;
pan = wc.panels(ctx.__now);
assert.deepStrictEqual(plain(pan[0].rows), [{ type: 'title', text: 'NOT woodcutting', colour: 0xff0000 }, { type: 'line', left: 'Logs cut:', right: '3' }, { type: 'line', left: 'Logs/hr:', right: '180' }]);
// the oak is cut down: a pie on it, filling over 30 ticks
locs['52,51'] = [{ kind: 'scenery', id: 1356, typecode: 5 }];
ctx.__now += 700;
impl('woodcutting').frame(g);
ctx.__now += 9000;
let pies = plain(wc.pies(g));
assert.ok(pies.length === 1 && Math.abs(pies[0].progress - 0.5) < 0.01 && pies[0].fill === 'rgba(255,255,0,1)' && pies[0].diameter === 25, `RuneLite's yellow pie: ${JSON.stringify(pies)}`);
// the Info Boxes overlay draws it (and the stats panel)
impl('infoboxes').frame(g);
assert.ok(plain(ll.__infoBoxes.ops()).some((o) => o.op === 'pie'), 'pie on the overlay');
assert.ok(plain(ll.__infoBoxes.ops()).some((o) => o.op === 'text' && o.text === 'Logs cut:' && o.align === 'left'), 'stats panel lines');
locs['52,51'] = [{ kind: 'scenery', id: 1281, typecode: oakTc }];
ctx.__now += 700;
impl('woodcutting').frame(g);
assert.strictEqual(wc.pies(g).length, 0, 'grown back: gone');
ctx.__now += 6 * 60000;
impl('woodcutting').frame(g);
assert.strictEqual(wc.panels(ctx.__now).length, 0, 'reset after 5 minutes without logs');
console.log('woodcutting: ok');

// ---------------------------------------------------------------- Mining
const rocks = JSON.parse(fs.readFileSync(path.join(root, 'plugins', 'mining', 'rocks.json'), 'utf8'));
on('mining', { statTimeout: 5, showMiningStats: true, table: rocks });
const copper = Object.keys(rocks).find((k) => rocks[k].name === 'copper');
locs['49,50'] = [{ kind: 'scenery', id: Number(copper), typecode: 9 }];
ctx.__now += 700;
impl('mining').frame(g);
ll.onChat(0, 'You manage to mine some copper.', '');
assert.deepStrictEqual(plain(ll.__mining.panels(ctx.__now)[0].rows[1]), { type: 'line', left: 'Total mined:', right: '1' });
locs['49,50'] = [{ kind: 'scenery', id: 450, typecode: 9 }];
ctx.__now += 700;
impl('mining').frame(g);
ctx.__now += 3000;
pies = plain(ll.__mining.pies(g));
assert.ok(pies.length === 1 && Math.abs(pies[0].progress - 0.5) < 0.01, 'copper: 10 ticks');
console.log('mining: ok');

// ---------------------------------------------------------------- Loot Tracker
on('loottracker', {});
ll.itemInfo = (id) => ({ id, name: { 526: 'Bones', 995: 'Coins', 1205: 'Bronze dagger' }[id] || '?', cost: { 526: 1, 995: 1, 1205: 10 }[id] || 0 });
ll.itemIcon = () => null;
const said = [];
ll.gameMessage = (t) => said.push(t);
ground['55,55'] = [{ id: 1205, count: 1 }]; // already there before the fight
npcs = [{ index: 4, name: 'Goblin', level: 2, x: 55 * 128 + 64, z: 55 * 128 + 64, size: 1, health: 3, totalHealth: 5 }];
me.face = 4;
ctx.__now += 300;
impl('loottracker').frame(g);
npcs[0].health = 0; // it dies
ctx.__now += 300;
impl('loottracker').frame(g);
ground['55,55'] = [{ id: 1205, count: 1 }, { id: 526, count: 1 }, { id: 995, count: 12 }];
ctx.__now += 2500;
impl('loottracker').frame(g);
ctx.__now += 1500;
impl('loottracker').frame(g);
const loot = lastPost('loot');
assert.ok(loot, 'loot sent');
assert.deepStrictEqual(plain(loot.data.items.map((i) => [i.name, i.quantity])), [['Bones', 1], ['Coins', 12]], 'only what landed after the kill');
assert.ok(!('price' in loot.data.items[0]) && !('ha' in loot.data.items[0]), 'no prices');
assert.strictEqual(loot.data.name, 'Goblin');
// Treasure Trail: the tier from the clue you carried, the items from the reward window
const clues = JSON.parse(fs.readFileSync(path.join(root, 'plugins', 'loottracker', 'clues.json'), 'utf8'));
const mediumClue = Number(Object.keys(clues).find((k) => clues[k] === 'Medium'));
on('loottracker', { clues });
let invNow = [{ id: mediumClue, quantity: 1 }];
let rewardNow = [];
ll.readContainer = (id) => (id === 6963 ? rewardNow : invNow);
ctx.__now += 300;
impl('loottracker').frame(g);
invNow = [];
ll.onChat(0, "Well done you've completed the Treasure Trail!", '');
rewardNow = [{ id: 995, quantity: 450 }, { id: 1205, quantity: 1 }, null];
ctx.__now += 50;
impl('loottracker').frame(g);
let clueLoot = lastPost('loot');
assert.deepStrictEqual(plain([clueLoot.data.name, clueLoot.data.items.map((i) => [i.name, i.quantity])]), ['Clue Scroll (Medium)', [['Coins', 450], ['Bronze dagger', 1]]], 'medium clue reward');
// missed the window: from what landed in your pack
invNow = [{ id: mediumClue, quantity: 1 }];
impl('loottracker').frame(g);
invNow = [];
rewardNow = [];
ll.onChat(0, "Well done you've completed the Treasure Trail!", '');
invNow = [{ id: 995, quantity: 200 }];
ctx.__now += 3000;
impl('loottracker').frame(g);
clueLoot = lastPost('loot');
assert.deepStrictEqual(plain([clueLoot.data.name, clueLoot.data.items.map((i) => [i.name, i.quantity])]), ['Clue Scroll (Medium)', [['Coins', 200]]], 'from the inventory');
// RuneLite's other sources. A tick of history first, so "a tick ago" is known.
const ltFrame = () => impl('loottracker').frame(g);
const step = (ms) => { ctx.__now += ms; ltFrame(); };
const items = (p) => plain([p.data.name, p.data.items.map((i) => [i.id, i.quantity])]);
let modal = null;
ll.modalItems = () => modal;
Object.assign(ll.fields, { entityX: 'ex', entityZ: 'ez' });
const at = (x, y) => { g.baseX = x - 50; g.baseZ = y - 50; me.ex = 50 * 128 + 64; me.ez = 50 * 128 + 64; };
const sent = () => posted.filter((p) => p.type === 'loot').length;
at(3222, 3218); // Lumbridge
invNow = [{ id: 995, quantity: 10 }];
step(300); step(300); step(300);
// pickpocketing: the NPC's name, from what arrives in your pack
ll.onChat(0, "You attempt to pick the man's pocket.", '');
step(600);
invNow = [{ id: 995, quantity: 13 }];
ll.onChat(0, "You pick the man's pocket.", '');
step(300); step(1000);
assert.deepStrictEqual(items(lastPost('loot')), ['Man (pickpocket)', [[995, 3]]], 'pickpocket: Man, 3 coins, apart from kills');
ll.onChat(0, "You pick the master farmer's pocket.", '');
invNow = [{ id: 995, quantity: 13 }, { id: 5318, quantity: 2 }];
step(300); step(1000);
assert.deepStrictEqual(items(lastPost('loot')), ['Master Farmer (pickpocket)', [[5318, 2]]], 'pickpocket: names as RuneLite capitalises them');
// a casket (big net) opened: the casket goes, what it held arrives in the same tick
invNow = [{ id: 995, quantity: 13 }, { id: 5318, quantity: 2 }, { id: 405, quantity: 1 }];
step(300);
invNow = [{ id: 995, quantity: 13 }, { id: 5318, quantity: 2 }, { id: 1623, quantity: 1 }];
step(300);
assert.deepStrictEqual(items(lastPost('loot')), ['Casket', [[1623, 1]]], 'casket');
// a bird's nest (377) searched: the empty nest is part of it, as in RuneLite
invNow = [{ id: 5073, quantity: 1 }];
step(300);
invNow = [{ id: 5075, quantity: 1 }, { id: 5312, quantity: 1 }];
step(300);
assert.deepStrictEqual(items(lastPost('loot')), ['Bird nest', [[5075, 1], [5312, 1]]], 'bird nest');
// not while a window is open: putting a casket in the bank isn't opening it
let before = sent();
invNow = [{ id: 405, quantity: 1 }];
step(300);
modal = { root: 5292, items: [{ id: 405, quantity: 1 }] };
invNow = [{ id: 995, quantity: 5 }];
step(300);
assert.strictEqual(sent(), before, 'banking a casket');
step(300);
modal = null;
step(300);
// the Crystal Chest (Taverley): "You find some treasure in the chest!"
at(2914, 3452);
invNow = [{ id: 989, quantity: 1 }];
step(300); step(300); step(300); step(300);
invNow = [{ id: 1631, quantity: 1 }, { id: 995, quantity: 2000 }];
ll.onChat(0, 'You unlock the chest with your key.', '');
ll.onChat(0, 'You find some treasure in the chest!', '');
step(300); step(1000);
assert.deepStrictEqual(items(lastPost('loot')), ['Crystal Chest', [[1631, 1], [995, 2000]]], 'crystal chest');
// the same message somewhere RuneLite doesn't know a chest: nothing
at(3222, 3218);
step(300);
before = sent();
ll.onChat(0, 'You find some treasure in the chest!', '');
invNow = [{ id: 995, quantity: 9000 }];
step(300); step(3000);
assert.strictEqual(sent(), before, 'chest elsewhere');
// reward windows: Fishing Trawler anywhere, Barrows in the tunnels, Miscellania at Ghrim's
modal = { root: 4564, items: [{ id: 359, quantity: 12 }, { id: 371, quantity: 3 }] };
step(300);
assert.deepStrictEqual(items(lastPost('loot')), ['Fishing Trawler', [[359, 12], [371, 3]]], 'trawler');
before = sent();
step(300);
assert.strictEqual(sent(), before, 'counted once per window');
modal = null;
step(300);
at(3551, 9694);
modal = { root: 11126, items: [{ id: 4740, quantity: 120 }, { id: 565, quantity: 40 }] };
step(300);
assert.deepStrictEqual(items(lastPost('loot')), ['Barrows', [[4740, 120], [565, 40]]], 'barrows');
modal = null;
step(300);
before = sent();
modal = { root: 5292, items: [{ id: 995, quantity: 1 }] };
step(300);
assert.strictEqual(sent(), before, 'a bank is not a reward');
modal = null;
step(300);
at(2502, 3860);
modal = { root: 11126, items: [{ id: 1513, quantity: 40 }] };
step(300);
assert.deepStrictEqual(items(lastPost('loot')), ['Kingdom of Miscellania', [[1513, 40]]], 'miscellania');
modal = null;
step(300);
// PvP: a player you were fighting dies, their drop is the loot (RuneLite's player kills)
at(3222, 3218);
me.face = 32768 + 7;
let players = [{ kind: 'player', index: 7, name: 'Zezima', level: 90, x: 53 * 128 + 64, z: 53 * 128 + 64, size: 1, health: 10, totalHealth: 99 }];
g.players = () => players.map((p) => Object.assign({}, p));
step(300);
players[0].health = 0;
step(300);
ground['53,53'] = [{ id: 1333, count: 1 }];
step(2000); step(1500);
assert.deepStrictEqual(plain([lastPost('loot').data.name, lastPost('loot').data.level, lastPost('loot').data.items.map((i) => i.id)]), ['Zezima', 90, [1333]], 'pvp kill');
delete g.players;
me.face = -1;
at(3250, 3250);
ll.readContainer = () => null;
console.log('loot tracker page: ok');

// sidebar side: adds it up per monster and remembers it per account
const store = {};
let reported = null;
const listeners = [];
const lctx = {
  config: (k) => ({ syncPanel: true }[k]),
  state: (k, d) => (k in store ? store[k] : d), setState: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
  sendToGame() {}, report: (r) => { reported = r; }, onRuntime: (fn) => { listeners.push(fn); return () => {}; },
};
const lt = require('../src/plugins/loottracker/game')(lctx);
lt.start();
const emit = (t, d) => listeners.forEach((fn) => fn(t, d));
emit('player', { name: 'Tester' });
emit('loot', loot.data);
emit('loot', loot.data);
assert.ok(reported.records.Goblin.kills === 2 && reported.records.Goblin.items[995].quantity === 24, 'two kills added up');
assert.strictEqual(store.records.tester.Goblin.kills, 2, 'remembered for the account');
emit('loot-icon', { id: 995, step: 1, url: 'data:image/png;base64,AAA' });
assert.strictEqual(reported.icons['995:1'], 'data:image/png;base64,AAA', 'icons kept for the panel');
// a stack's own picture: 24 coins is the 10 step (coins' piles change at 2-5, 10, 25, 100 ...)
emit('loot-icon', { id: 995, step: 10, url: 'data:image/png;base64,BBB' });
assert.strictEqual(reported.icons['995:10'], 'data:image/png;base64,BBB', 'stack pictures kept apart');
// different easy clue steps are one item, as RuneLite counts them
emit('loot', { name: 'Guard', level: 21, items: [{ id: 2678, name: 'Clue scroll', quantity: 1 }] });
emit('loot', { name: 'Guard', level: 21, items: [{ id: 2690, name: 'Clue scroll', quantity: 1 }] });
assert.deepStrictEqual(Object.values(reported.records.Guard.items).map((i) => [i.id, i.name, i.quantity]), [[2677, 'Clue scroll (easy)', 2]], 'clue scrolls stack');
console.log('loot tracker: ok');

// ---------------------------------------------------------------- Cooking
on('cooking', { statTimeout: 5, fermentTimer: true, messages: require('../src/plugins/cooking/cooking.json') });
const cookChat = (t) => ll.onChat(0, t, '');
cookChat('You cook the shrimps on the fire...');
assert.strictEqual(ll.__cooking.session(), null, 'starting to cook is not a result');
cookChat('The shrimps are now nicely cooked.');
cookChat('You accidentally burn the shrimps.');
cookChat('You successfully bake a pizza.');
ctx.__now += 1000;
let cp = plain(ll.__cooking.panels(ctx.__now))[0];
assert.deepStrictEqual(cp.rows.map((r) => r.text || `${r.left} ${r.right}`), ['Cooking', 'Cooked: 2 (7200/hr)', 'Burnt: 1 (33.3%)'], JSON.stringify(cp.rows));
ctx.__now += 4000;
assert.strictEqual(plain(ll.__cooking.panels(ctx.__now))[0].rows[0].text, 'NOT cooking', 'after 3 s without cooking');
ctx.__now += 6 * 60000;
assert.strictEqual(ll.__cooking.panels(ctx.__now).length, 0, 'reset after 5 minutes');
cookChat('You squeeze the grapes into the jug. The wine begins to ferment.');
let fb = plain(ll.__cooking.boxes(ctx.__now));
assert.ok(fb.length === 1 && fb[0].text === '12' && fb[0].name === 'Wine ferment', 'ferment timer: 20 ticks');
ctx.__now += 10000;
assert.strictEqual(plain(ll.__cooking.boxes(ctx.__now))[0].colour, 0xff0000, 'red in the last 3 seconds');
ctx.__now += 3000;
assert.strictEqual(ll.__cooking.boxes(ctx.__now).length, 0, 'gone when it is wine');
console.log('cooking: ok');

// ---------------------------------------------------------------- Agility
const agData = require('../src/plugins/agility/agility.json');
const gnome = agData.courses.find((c) => c.name === 'Gnome Stronghold');
const shortcutId = Number(Object.keys(agData.shortcuts)[0]);
on('agility', { showClickboxes: true, showLapCount: true, lapTimeout: 5, lapsToLevel: true, lapsPerHour: true, overlayColor: '#00FF00', highlightShortcuts: true, data: agData });
const agVarps = new Int32Array(2000);
const agXp = new Int32Array(25);
const agLvl = new Int32Array(25).fill(1);
agLvl[16] = 10;
agXp[16] = 1200;
Object.assign(ll.fields, { varps: 'agv', statXP: 'agx', statBaseLevel: 'agl' });
Object.assign(client, { agv: agVarps, agx: agXp, agl: agLvl });
locs = { '51,50': [{ kind: 'scenery', id: gnome.locs[0], typecode: 777 }], '49,50': [{ kind: 'wall', id: shortcutId, typecode: 777 }] };
polys.length = 0;
ctx.__now += 1000;
ll.__agility.frame(g);
assert.strictEqual(polys.length, 2, 'an obstacle and a shortcut outlined');
assert.ok(polys.some((p) => p.rgb === 0x00ff00 && p.o.fillAlpha === 51), 'obstacle in the overlay colour with a faint fill');
assert.ok(polys.some((p) => p.rgb === 0xff0000) === (agData.shortcuts[shortcutId] > 10), 'shortcut red when your level is too low');
// a lap: obstacle XP, then the last obstacle with the lap bonus (46.5 XP at the gnome course)
for (let i = 1; i <= 6; i++) { agXp[16] += 7; ctx.__now += 600; ll.__agility.frame(g); }
assert.strictEqual(ll.__agility.panels(ctx.__now).length, 0, 'no lap yet');
agXp[16] += 47;
ctx.__now += 600; ll.__agility.frame(g);
let ap = plain(ll.__agility.panels(ctx.__now));
assert.ok(ap.length && ap[0].rows[0].right === '1' && /until goal/.test(ap[0].rows[1].left), JSON.stringify(ap));
// a second lap gives laps per hour
for (let i = 1; i <= 6; i++) { agXp[16] += 5; ctx.__now += 10000; ll.__agility.frame(g); }
agXp[16] += 46;
ctx.__now += 600; ll.__agility.frame(g);
ap = plain(ll.__agility.panels(ctx.__now));
assert.ok(ap[0].rows[0].right === '2' && ap[0].rows.some((r) => r.left === 'Laps per hour:'), JSON.stringify(ap[0].rows));
assert.strictEqual(ll.__agility.xpFor(2), 83, 'level 2 at 83 xp');
locs = {};
console.log('agility: ok');

// ---------------------------------------------------------------- Fishing
const fishData = require('../src/plugins/fishing/fishing.json');
const lobsterSpot = Number(Object.keys(fishData).find((k) => fishData[k].fish.some((f) => f.name === 'Lobster')));
const netSpot = Number(Object.keys(fishData).find((k) => fishData[k].fish.some((f) => f.name === 'Shrimps')));
assert.ok(lobsterSpot && netSpot && fishData[lobsterSpot].icon === 377, 'lobster spots show the raw lobster icon');
on('fishing', { onlyCurrent: false, showTiles: true, showIcons: true, iconSize: 50, showNames: false, overlayColor: '#00FFFF', statTimeout: 5, showFishingStats: true, spots: fishData });
const drawn = [];
const icon = { w: 32, h: 32, px: new Int32Array(1024) };
const fishIcon = ll.itemIcon;
ll.itemIcon = (id) => (drawn.push(['icon', id]), icon);
Object.assign(g, { image: (img, x, y) => drawn.push(['image', img.w, img.h]), text: (str) => drawn.push(['text', str]), textWidth: (str) => str.length * 5 });
npcs = [{ index: 4, id: lobsterSpot, x: 52 * 128 + 64, z: 50 * 128 + 64, height: 0 }, { index: 5, id: netSpot, x: 48 * 128 + 64, z: 50 * 128 + 64, height: 0 }, { index: 6, id: 1, x: 6464, z: 6464 }];
polys.length = 0;
ll.__fishing.frame(g);
assert.strictEqual(polys.filter((p) => p.rgb === 0x00ffff).length, 2, 'both spots outlined in cyan, not the other npc');
assert.ok(drawn.some((d) => d[0] === 'icon' && d[1] === 377) && !drawn.some((d) => d[0] === 'text'), 'icons, no names by default');
assert.deepStrictEqual(drawn.filter((d) => d[0] === 'image').map((d) => d[1] + 'x' + d[2]), ['16x16', '16x16'], 'one half-size icon per spot');
on('fishing', { onlyCurrent: true, showTiles: true, showIcons: false, showNames: true, overlayColor: '#00FFFF', statTimeout: 5, showFishingStats: true });
polys.length = 0; drawn.length = 0;
ll.__fishing.frame(g);
assert.strictEqual(polys.length, 0, 'only currently fished: nothing while not fishing');
me.face = 4;
ll.__fishing.frame(g);
assert.ok(polys.length === 1 && drawn.length === 1 && /Lobster/.test(drawn[0][1]), 'only the lobster spot, by name: ' + JSON.stringify(drawn));
me.face = -1;
ll.itemIcon = fishIcon;
npcs = [];
const fishChat = (t) => ll.onChat(0, t, '');
fishChat('You catch a lobster.');
fishChat('You catch some shrimps.');
fishChat('You catch a tuna.');
me.anim = 619;
ctx.__now += 60000;
let fp = plain(ll.__fishing.panels(ctx.__now))[0];
assert.deepStrictEqual(fp.rows.map((r) => r.text || `${r.left} ${r.right}`), ['Fishing', 'Caught fish: 3', 'Fish/hr: 180'], JSON.stringify(fp.rows));
me.anim = -1;
assert.strictEqual(plain(ll.__fishing.panels(ctx.__now))[0].rows[0].text, 'NOT fishing');
ctx.__now += 6 * 60000;
assert.strictEqual(ll.__fishing.panels(ctx.__now).length, 0, 'reset after 5 minutes');
console.log('fishing: ok');

// ---------------------------------------------------------------- Chat Notifications
const notes = [];
const cfgN = { notifyOnOwnName: true, notifyOnHighlight: true, highlightWordsString: 'rune, dragon', notifyOnTrade: true, notifyOnPM: false };
const nl = [];
const cn = require('../src/plugins/chatnotifications/game')({ config: (k) => cfgN[k], notify: (t, b) => notes.push(b), onRuntime: (fn) => { nl.push(fn); return () => {}; } });
cn.start();
const chat = (m) => nl.forEach((fn) => fn('chat', m));
nl.forEach((fn) => fn('player', { name: 'Tester' }));
chat({ kind: 'public', name: 'Bob', text: 'hi tester how are you' });
chat({ kind: 'public', name: 'Bob', text: 'testers are great' });
chat({ kind: 'public', name: 'Ann', text: 'selling rune scimitar' });
chat({ kind: 'public', name: 'Ann', text: 'selling runes' });
chat({ kind: 'trade', name: 'Cat', text: 'wishes to trade with you.' });
chat({ kind: 'private', name: 'Dan', text: 'yo' });
chat({ kind: 'game', text: 'Ann: selling rune scimitar', own: true });
chat({ kind: 'public', name: 'Tester', text: 'rune dragon' });
assert.deepStrictEqual(notes, ['Bob: hi tester how are you', 'Ann: selling rune scimitar', 'Cat wishes to trade with you.'], `notifications: ${notes.join(' | ')}`);
console.log('chat notifications: ok');

// ---------------------------------------------------------------- Farming tracker
{
  const farming = require('../src/plugins/farming/game');
  const D = farming.DATA;
  const potato0 = Number(Object.keys(D.decode.allotment).find((k) => D.decode.allotment[k] === 1100));
  assert.deepStrictEqual(farming.decodePatch(D.patches[0], { 504: potato0 }), { raw: potato0, crop: 1, kind: 1, stage: 0 });
  // the second Falador patch is the next 8 bits of the same varp
  assert.strictEqual(farming.decodePatch(D.patches[1], { 504: potato0 << 8 }).crop, 1);
  const reps = [];
  const fl = [];
  const store = {};
  const fp = farming({ config: () => false, state: (k, d) => store[k] ?? d, setState: (k, v) => { store[k] = v; }, onRuntime: (fn) => { fl.push(fn); return () => {}; }, report: (d) => reps.push(d) });
  fp.start();
  fl.forEach((fn) => fn('player', { name: 'Tester' }));
  fl.forEach((fn) => fn('farming-varps', { varps: { 504: potato0, 505: 0, 506: 0, 508: 0, 515: 0 } }));
  const r = reps[reps.length - 1];
  const pot = r.patches[0];
  assert.strictEqual(pot.crop, 'potato');
  assert.strictEqual(pot.status, 'growing');
  // potatoes: 4 growth ticks of 10 minutes (wiki: 40 minutes)
  assert.strictEqual(pot.total, 40 * 60000);
  assert.strictEqual(r.patches[1].status, 'weeds');
  assert.ok(store.saves && store.saves.tester, 'saved per account');
  fp.stop();
  console.log('farming tracker: ok');
}
