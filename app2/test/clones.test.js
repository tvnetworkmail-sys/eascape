'use strict';
// RuneLite clones on the RuneLite core (plugins/runelite/api.js), against fakes: the core's Experience,
// QuantityFormatter, menus and panel channel, and the XP Tracker clone.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'src');
const posted = [];
const intervals = [];
const fakeCanvas = () => ({ getContext: () => ({ measureText: (s) => ({ width: String(s).length * 6 }) }), style: { setProperty() {} } });
const window = { postMessage: (m) => posted.push(m), addEventListener() {}, removeEventListener() {} };
const ctx = vm.createContext({
  window, document: { getElementById: () => null, createElement: fakeCanvas, body: { appendChild() {} } },
  setInterval: (fn) => { intervals.push(fn); return intervals.length; }, clearInterval() {}, setTimeout() {}, clearTimeout() {}, queueMicrotask: (f) => f(),
  performance: { now: () => Date.now() }, Date, Int32Array, Uint32Array, Math, String, Array, Object, RegExp, Proxy, Map, Set, WeakMap, JSON, Number, isFinite, parseInt, Error,
});
for (const f of ['runtime/runtime.js', 'plugins/runelite/api.js', 'plugins/xptracker/page.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
const ll = vm.runInContext('window.__lostlite', ctx);
const rl = ll.rl;

// ---- core
assert.strictEqual(rl.Experience.getXpForLevel(99), 13034431);
assert.strictEqual(rl.Experience.getLevelForXp(13034430), 98);
assert.strictEqual(rl.Experience.getLevelForXp(83), 2);
const q = (n) => rl.QuantityFormatter.quantityToRSDecimalStack(n, true);
assert.strictEqual(q(9999), '9999');
assert.strictEqual(q(12345), '12.3K');
assert.strictEqual(q(1234567), '1.234M');
assert.strictEqual(rl.QuantityFormatter.quantityToRSDecimalStack(1234567, false), '1.2M');
console.log('runelite core: ok');

// ---- XP Tracker: a logged-in fake with stats
const SKILLS = ['attack', 'defence', 'strength', 'hitpoints', 'ranged', 'prayer', 'magic', 'cooking', 'woodcutting', 'fletching', 'fishing',
  'firemaking', 'crafting', 'smithing', 'mining', 'herblore', 'agility', 'thieving', 'slayer', 'farming', 'runecraft', 'hunter', 'construction'];
const stats = SKILLS.map((s) => ({ skill: s, xp: s === 'hitpoints' ? 1154 : 0, level: s === 'hitpoints' ? 10 : 1, boosted: s === 'hitpoints' ? 10 : 1 }));
let tick = 0;
ll.readStats = () => stats.map((s) => Object.assign({}, s));
ll.api = { tickCount: () => tick, view: () => ({ x: 4, y: 4, w: 512, h: 334 }) };
ll.client = { lp: { name: 'Tester' } };
Object.assign(ll.fields, { localPlayer: 'lp', playerName: 'name' });
ll.entityInfo = (p, o) => o;
ll.loggedIn = true;
ll.readNpcs = () => [];
ll.readPlayers = () => [];
const core = ll.pagePlugins.get('runelite').impl;
core.configure({ values: { runelite: {} } });
ll.pluginConfig({ id: 'runelite', enabled: true, config: {} });
const items = require('../src/plugins/xptracker/descriptor').config.items;
ll.pluginConfig({ id: 'xptracker', enabled: true, config: { __items: items } });
const step = () => { tick++; rl._test.pollEvents(); };
const panel = () => JSON.parse(JSON.stringify(posted.filter((m) => m.type === 'plugin-state' && m.data.id === 'xptracker').pop().data.state));
for (let i = 0; i < 3; i++) step();
assert.strictEqual(panel().overallVisible, false, 'nothing gained yet');
// 25 xp in woodcutting, twice
stats[8].xp = 25; step();
stats[8].xp = 50; step();
let st = panel();
assert.strictEqual(st.overallVisible, true);
assert.strictEqual(st.overall[0], '50');
assert.strictEqual(st.boxes.length, 1);
const wc = st.boxes[0];
assert.strictEqual(wc.skill, 'WOODCUTTING');
assert.deepStrictEqual(wc.labels[0], ['XP Gained: ', '50']);
assert.deepStrictEqual(wc.labels[1], ['XP Left: ', '33']);
assert.deepStrictEqual(wc.labels[2], ['XP/hr: ', '3000']); // a minute at least: 50 xp/min
assert.deepStrictEqual(wc.labels[3], ['Actions: ', '2']);
assert.strictEqual(wc.bar.left, 'Lvl. 1');
assert.strictEqual(wc.bar.right, 'Lvl. 2');
assert.strictEqual(wc.bar.center, '60.24%');
// a combat skill hides its action labels
stats[0].xp = 40; step();
st = panel();
assert.strictEqual(st.boxes[1].skill, 'ATTACK');
assert.strictEqual(st.boxes[1].labels[3], null);
// the panel's menu: pause, compact, canvas, reorder, reset
const panelAct = (data) => core && ll.pagePlugins.get('xptracker').impl.panel(data);
panelAct({ action: 'pause', skill: 'WOODCUTTING' });
assert.strictEqual(panel().boxes[0].paused, true);
assert.strictEqual(panel().boxes[0].pauseText, 'Unpause');
panelAct({ action: 'compact', skill: 'WOODCUTTING' });
assert.strictEqual(panel().boxes[0].compact, true);
panelAct({ action: 'canvas', skill: 'ATTACK' });
assert.strictEqual(panel().boxes[1].canvas, true);
assert.ok(rl.overlayManager.overlays.some((o) => o.getName() === 'XpInfoBoxOverlayAttack'));
panelAct({ action: 'reorder', skill: 'ATTACK', position: 0 });
assert.deepStrictEqual(panel().boxes.map((b) => b.skill), ['ATTACK', 'WOODCUTTING']);
panelAct({ action: 'reset', skill: 'ATTACK' });
assert.deepStrictEqual(panel().boxes.map((b) => b.skill), ['WOODCUTTING']);
assert.ok(!rl.overlayManager.overlays.some((o) => o.getName() === 'XpInfoBoxOverlayAttack'));
// saved per RuneScape profile
const plugin = ll.rl.pluginManager;
intervals[intervals.length - 1](); // tickStateSave
const saved = posted.filter((m) => m.type === 'rl-config' && m.data.key === 'rsprofile.tester.state').pop();
assert.ok(saved, 'state saved');
assert.strictEqual(JSON.parse(saved.data.value).skills.WOODCUTTING.ar, 50);
assert.ok(plugin);
console.log('xp tracker clone: ok');

// ---- Stretched Mode
vm.runInContext(fs.readFileSync(path.join(root, 'plugins/stretchedmode/page.js'), 'utf8'), ctx);
const stretches = [];
ll.api.stretch = (o) => stretches.push(JSON.parse(JSON.stringify(o)));
const smItems = require('../src/plugins/stretchedmode/descriptor').config.items;
ll.pluginConfig({ id: 'stretchedmode', enabled: true, config: { __items: smItems } });
assert.deepStrictEqual(stretches.pop(), { enabled: true, fast: false, integerScaling: false, keepAspectRatio: false, scalingFactor: 50, increasedResolution: true });
ll.pluginConfig({ id: 'stretchedmode', enabled: true, config: { keepAspectRatio: true, integerScaling: true, increasedPerformance: true } });
assert.deepStrictEqual(stretches.pop(), { enabled: true, fast: true, integerScaling: true, keepAspectRatio: true, scalingFactor: 50, increasedResolution: true });
ll.pluginConfig({ id: 'stretchedmode', enabled: false, config: {} });
assert.strictEqual(stretches.pop().enabled, false);
console.log('stretched mode clone: ok');

// ---- Loot Tracker, on the core's ItemSpawned events and LootManager
vm.runInContext(fs.readFileSync(path.join(root, 'plugins/loottracker/page.js'), 'utf8'), ctx);
const ITEMS = { 526: { name: 'Bones', cost: 1 }, 995: { name: 'Coins', cost: 1 }, 1965: { name: 'Cabbage', cost: 10 } };
ll.itemInfo = (id) => Object.assign({ id, stackable: false }, ITEMS[id] || { name: 'null', cost: 0 });
ll.ITEMS = { inventory: 93, equipment: 94 };
let invItems = new Array(28).fill(null);
ll.readContainer = (id) => (id === 93 ? invItems.slice() : new Array(14).fill(null));
let itemEvents = [];
ll.api.itemEvents = () => { const e = itemEvents; itemEvents = []; return e; };
const goblin = { index: 5, typecode: 0x20000000 + (5 << 14), id: 100, name: 'Goblin', level: 2, x: 50 * 128 + 64, z: 50 * 128 + 64, size: 1, health: 0, totalHealth: 5, actions: [null, 'Attack', null, null, null], animation: -1 };
ll.readNpcs = () => [goblin];
const ltItems = require('../src/plugins/loottracker/descriptor').config.items;
ll.pluginConfig({ id: 'loottracker', enabled: true, config: { __items: ltItems } });
const ltPanel = () => JSON.parse(JSON.stringify(posted.filter((m) => m.type === 'plugin-state' && m.data.id === 'loottracker').pop().data.state));
assert.strictEqual(ltPanel().hasBoxes, false, 'no loot yet');
step();
// the goblin dies: gone from the scene, its drop on its tile in the same tick
ll.readNpcs = () => [];
itemEvents = [{ type: 'spawn', id: 526, quantity: 1, level: 0, wx: 50, wz: 50 }, { type: 'spawn', id: 995, quantity: 12, level: 0, wx: 50, wz: 50 }];
step();
let lt = ltPanel();
assert.strictEqual(lt.boxes.length, 1);
assert.strictEqual(lt.boxes[0].title, 'Goblin');
assert.strictEqual(lt.boxes[0].subTitle, '(lvl-2)');
assert.deepStrictEqual(lt.boxes[0].items.map((i) => i.id), [995, 526], 'most valuable first');
assert.strictEqual(lt.boxes[0].price, ' 13 gp');
assert.strictEqual(lt.boxes[0].prices, false, 'no prices until the game has a market');
assert.strictEqual(lt.boxes[0].items[0].tooltip.length, 1, 'no price lines');
assert.strictEqual(lt.overall.kills, '1');
step();
const ltSaved = posted.filter((m) => m.type === 'rl-config' && m.data.key === 'rsprofile.tester.drops_NPC_Goblin').pop();
assert.ok(ltSaved, 'loot remembered');
assert.deepStrictEqual(JSON.parse(ltSaved.data.value).drops, [526, 1, 995, 12]);
// a second goblin: grouped into the same box, "x 2"
ll.readNpcs = () => [goblin]; step();
ll.readNpcs = () => []; itemEvents = [{ type: 'spawn', id: 526, quantity: 1, level: 0, wx: 50, wz: 50 }]; step();
lt = ltPanel();
assert.strictEqual(lt.boxes.length, 1);
assert.strictEqual(lt.boxes[0].subTitle, 'x 2');
// an item spawning with no NPC death (a player's drop) isn't loot
itemEvents = [{ type: 'spawn', id: 1965, quantity: 1, level: 0, wx: 51, wz: 50 }]; step();
assert.strictEqual(ltPanel().overall.kills, '2');
// pickpocketing: the message, then the pack changes
core.chat({ type: 0, text: "You pick the man's pocket.", time: Date.now() });
invItems[0] = { id: 995, count: 3 }; step();
lt = ltPanel();
assert.strictEqual(lt.boxes[0].title, 'Man');
assert.strictEqual(lt.boxes[0].subTitle, '(pickpocket)');
// the panel's menus: hide the source, then each kill separately
ll.pagePlugins.get('loottracker').impl.panel({ action: 'toggleEvent', id: lt.boxes[0].id });
assert.deepStrictEqual(ltPanel().boxes.map((b) => b.title), ['Goblin']);
ll.pagePlugins.get('loottracker').impl.panel({ action: 'group', group: false });
assert.strictEqual(ltPanel().boxes.length, 2, 'two goblin kills');
assert.strictEqual(rl.QuantityFormatter.quantityToStackSize(123456), '123K');
assert.strictEqual(rl.QuantityFormatter.quantityToStackSize(1234567), '1.23M');
console.log('loot tracker clone: ok');

// ---- Loot Tracker: MenuOptionClicked (opening a casket) and WidgetLoaded (the Barrows reward window)
ll.pagePlugins.get('loottracker').impl.panel({ action: 'group', group: true });
ll.menuArrays = () => [['Open @lre@Casket'], [28], [405], [0], [9764864]];
invItems = new Array(28).fill(null); invItems[0] = { id: 405, count: 1 }; step();
ll.menuClicked(ll.client, 0);
invItems[0] = { id: 995, count: 120 }; step();
assert.strictEqual(ltPanel().boxes[0].title, 'Casket');
assert.deepStrictEqual(ltPanel().boxes[0].items.map((i) => i.id), [995], 'what the casket held (not the casket)');
ll.api.inv = (id) => (id === 141 ? { ids: [1127, 995, -1], counts: [1, 500, 0] } : null);
const realLp = rl.client.getLocalPlayer;
ll.widgetLoaded(364); // (the clue reward window, outside the Barrows tunnels: not Barrows)
assert.strictEqual(ltPanel().boxes[0].title, 'Casket');
rl.client.getLocalPlayer = () => ({ getWorldLocation: () => new rl.WorldPoint(3551, 9695, 0), getName: () => 'Tester' });
ll.widgetLoaded(364);
rl.client.getLocalPlayer = realLp;
assert.strictEqual(ltPanel().boxes[0].title, 'Barrows');
assert.deepStrictEqual(ltPanel().boxes[0].items.map((i) => i.id).sort(), [1127, 995].sort(), 'the reward window\'s items');
console.log('loot tracker events: ok');

// ---- Ground Items: menu recolouring, quantities and deprioritized hidden items (no prices while the switch is off)
vm.runInContext(fs.readFileSync(path.join(root, 'plugins/grounditems/page.js'), 'utf8'), ctx);
ITEMS[1965].stackable = false;
const giItems = require('../src/plugins/grounditems/descriptor').config.items;
ll.pluginConfig({ id: 'grounditems', enabled: true, config: { __items: giItems, highlightedItems: 'Cabbage', deprioritizeHiddenItems: true } });
itemEvents = [{ type: 'spawn', id: 1965, quantity: 1, level: 0, wx: 50, wz: 50 }, { type: 'spawn', id: 526, quantity: 1, level: 0, wx: 50, wz: 50 }];
step();
Object.assign(ll.fields, { menuCount: 'mc' });
const giMenu = [['Walk here', 'Take @lre@Cabbage', 'Take @lre@Bones'], [10, 41, 41], [0, 1965, 526], [0, 50, 50], [0, 50, 50]];
ll.menuArrays = () => giMenu;
ll.client.mc = 3;
ll.colourTag = (rgb) => (rgb === 0xaa00ff ? '@~p1@' : '');
ll.pagePlugins.get('runelite').impl.menu(ll.client);
assert.deepStrictEqual(giMenu[0].slice(0, 3), ['Take @lre@Bones', 'Walk here', 'Take @~p1@Cabbage'], 'highlighted recoloured, hidden below Walk here');
assert.deepStrictEqual(giMenu[1].slice(0, 3), [2041, 10, 41]);
ll.pluginConfig({ id: 'grounditems', enabled: false, config: {} });
console.log('ground items clone: ok');

// ---- Camera: Control function (reset / hold to zoom) over the core's emulated zoom
vm.runInContext(fs.readFileSync(path.join(root, 'plugins/camera/page.js'), 'utf8'), ctx);
const zooms = [];
const runtimeCommand = ll.command; // (the runtime's own, for the Login Screen 2007RS test)
ll.command = (cmd) => { if (cmd.type === 'zoom') zooms.push(cmd.value); };
const camItems = require('../src/plugins/camera/descriptor').config.items;
ll.pluginConfig({ id: 'camera', enabled: true, config: { __items: camItems, controlFunction: 'CONTROL_TO_RESET', ctrlZoomValue: 256 } });
const coreKey = (key, down) => ll.pagePlugins.get('runelite').impl.key({ key }, down);
coreKey('Control', true); coreKey('Control', false);
assert.strictEqual(rl.client.getVarcIntValue(rl.VarClientID.CAMERA_ZOOM_SMALL), 256, 'Ctrl released: zoom reset to 256');
assert.strictEqual(zooms.pop(), 2, 'camera distance x 512 / 256');
ll.pluginConfig({ id: 'camera', enabled: true, config: { controlFunction: 'CONTROL_TO_ZOOM' } });
assert.strictEqual(rl.client.getVarcIntValue(rl.VarClientID.CAMERA_ZOOM_SMALL), 256);
ll.pluginConfig({ id: 'camera', enabled: false, config: {} });
console.log('camera clone: ok');

// ---- NPC Indicators on the core's NpcOverlayService: name list, menu recolouring, Shift+Examine tagging
vm.runInContext(fs.readFileSync(path.join(root, 'plugins/npcindicators/page.js'), 'utf8'), ctx);
const niItems = require('../src/plugins/npcindicators/descriptor').config.items;
const imp = { index: 7, typecode: 0x20000000 + (7 << 14), id: 708, name: 'Imp', level: 2, x: 52 * 128 + 64, z: 50 * 128 + 64, size: 1, health: 0, totalHealth: 0, actions: [null, 'Attack'], animation: -1 };
goblin.health = 5;
ll.readNpcs = () => [goblin, imp];
ll.pluginConfig({ id: 'npcindicators', enabled: true, config: { __items: niItems, npcToHighlight: 'Goblin', highlightMenuStyle: 'NAME' } });
const svc = rl.npcOverlayService;
assert.deepStrictEqual([...svc.highlightedNpcs.keys()], [5], 'the goblin highlighted by name');
assert.strictEqual(svc.highlightedNpcs.get(5).hull, true);
const niMenu = [['Walk here', 'Examine @yel@Goblin@gre@  (level-2)', 'Attack @yel@Goblin@gre@  (level-2)'], [10, 1002, 38], [0, 5, 5], [0, 0, 0], [0, 0, 0]];
ll.menuArrays = () => niMenu;
const inserted = [];
ll.insertMenuEntry = (c, at, text, fn) => { inserted.push({ at, text, fn }); };
ll.client.mc = 3;
ll.pagePlugins.get('runelite').impl.menu(ll.client);
assert.strictEqual(niMenu[0][2], 'Attack @cya@Goblin@gre@  (level-2)', 'name recoloured, level kept');
ll.shiftDown = true;
ll.client.mc = 3; niMenu[0][2] = 'Attack @yel@Goblin@gre@  (level-2)';
ll.pagePlugins.get('runelite').impl.menu(ll.client);
const opts = inserted.map((e) => e.text.split(' @')[0].replace(/@[a-z0-9~]{3}@/g, ''));
assert.strictEqual(opts[opts.length - 1], 'Tag', 'Tag on top');
assert.strictEqual(opts[opts.length - 2], 'Un-tag-All');
ll.shiftDown = false;
// Tag the imp by index
inserted.length = 0;
const impMenu = [['Walk here', 'Examine @yel@Imp@gre@  (level-2)'], [10, 1002], [0, 7], [0, 0], [0, 0]];
ll.menuArrays = () => impMenu; ll.client.mc = 2; ll.shiftDown = true;
ll.pagePlugins.get('runelite').impl.menu(ll.client);
ll.shiftDown = false;
const tagE = inserted.find((e) => /^Tag /.test(e.text));
tagE.fn();
assert.deepStrictEqual([...svc.highlightedNpcs.keys()].sort(), [5, 7], 'the imp tagged');
ll.pluginConfig({ id: 'npcindicators', enabled: false, config: {} });
assert.strictEqual(svc.highlightedNpcs.size, 0, 'cleared when switched off');
console.log('npc indicators clone: ok');

// ---- Object Markers on the core's loc events (GameObjectSpawned ...): Shift+Examine, Mark object, saved per region
vm.runInContext(fs.readFileSync(path.join(root, 'plugins/objectindicators/page.js'), 'utf8'), ctx);
Object.assign(ll.fields, { baseX: 'bx', baseZ: 'bz', level: 'lv' });
Object.assign(ll.client, { bx: 3200, bz: 3200, lv: 0 });
let locEvs = [{ k: 2, level: 0, sx: 52, sz: 51, wx: 3252, wz: 3251, id: 1281, tag: 99n, shape: 10, angle: 0, spawned: true }];
ll.api.locEvents = () => { const e = locEvs; locEvs = []; return e; };
ll.api.loc = (id) => ({ name: id === 1281 ? 'Oak' : 'null', width: 1, length: 1, op: ['Chop down'] });
step();
const oiItems = require('../src/plugins/objectindicators/descriptor').config.items;
ll.pluginConfig({ id: 'objectindicators', enabled: true, config: { __items: oiItems } });
const oiMenu = [['Walk here', 'Examine @cya@Oak'], [10, 1005], [0, 1281], [0, 52], [0, 51]];
ll.menuArrays = () => oiMenu; ll.client.mc = 2; inserted.length = 0; ll.shiftDown = true;
ll.pagePlugins.get('runelite').impl.menu(ll.client);
ll.shiftDown = false;
assert.deepStrictEqual(inserted.map((e) => e.text), ['Mark object @cya@Oak']);
inserted[0].fn();
const oiSaved = posted.filter((m) => m.type === 'rl-config' && m.data.group === 'objectindicators').pop().data;
assert.strictEqual(oiSaved.key, 'region_' + ((50 << 8) | 50));
assert.deepStrictEqual(JSON.parse(oiSaved.value).map((p) => [p.id, p.name, p.regionX, p.regionY, p.color]), [[1281, 'Oak', 52, 51, '#ffffff00']]);
// the oak is cut down (despawns) and grows back: marked again from the saved point
locEvs = [{ k: 2, level: 0, sx: 52, sz: 51, wx: 3252, wz: 3251, id: 1281, tag: 99n, spawned: false }]; step();
locEvs = [{ k: 2, level: 0, sx: 52, sz: 51, wx: 3252, wz: 3251, id: 1281, tag: 99n, shape: 10, angle: 0, spawned: true }]; step();
inserted.length = 0; ll.shiftDown = true; ll.client.mc = 2;
ll.pagePlugins.get('runelite').impl.menu(ll.client);
ll.shiftDown = false;
assert.strictEqual(inserted[inserted.length - 1].text, 'Unmark object @cya@Oak', 'marked after growing back, Unmark on top');
ll.pluginConfig({ id: 'objectindicators', enabled: false, config: {} });
console.log('object markers clone: ok');

// ---- Ground Markers: Shift + Walk here on the tile under the mouse
vm.runInContext(fs.readFileSync(path.join(root, 'plugins/groundmarkers/page.js'), 'utf8'), ctx);
rl._test.setFrame({ tileAt: () => ({ x: 45, z: 50 }), project: () => null, tilePoly: () => null, hull: () => null });
ll.mouse.inView = true;
const gmItems = require('../src/plugins/groundmarkers/descriptor').config.items;
ll.pluginConfig({ id: 'groundmarkers', enabled: true, config: { __items: gmItems } });
const gmMenu = [['Cancel', 'Walk here'], [1007, 10], [0, 0], [0, 0], [0, 0]];
ll.menuArrays = () => gmMenu; ll.client.mc = 2; inserted.length = 0; ll.shiftDown = true;
ll.pagePlugins.get('runelite').impl.menu(ll.client);
assert.deepStrictEqual(inserted.map((e) => e.text), ['Mark Tile']);
inserted[0].fn();
const gmSaved = posted.filter((m) => m.type === 'rl-config' && m.data.group === 'groundMarker').pop().data;
assert.deepStrictEqual(JSON.parse(gmSaved.value), [{ regionId: (50 << 8) | 50, regionX: 45, regionY: 50, z: 0, color: '#ffffff00' }]);
inserted.length = 0; ll.client.mc = 2;
ll.pagePlugins.get('runelite').impl.menu(ll.client);
assert.deepStrictEqual(inserted.map((e) => e.text), ['Label Tile', 'Unmark Tile'], 'Unmark on top, then Label');
ll.shiftDown = false;
ll.pluginConfig({ id: 'groundmarkers', enabled: false, config: {} });
console.log('ground markers clone: ok');

// ---- Idle Notifier: chop, stop, the idle notification after the delay; the logout warning 20 s before the 90 s logout
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/idlenotifier/page.js'), 'utf8'), ctx);
  const inItems = require('../src/plugins/idlenotifier/descriptor').config.items;
  let idle = { keyboard: 100, mouse: 100, lastPressed: 0, timeout: 4500 };
  ll.api.idle = () => idle;
  const me = ll.client.lp;
  const realNow = Date.now; let now = 1e6; Date.now = () => now;
  const realInfo = ll.entityInfo;
  ll.entityInfo = (p, o) => Object.assign(o, { x: 64, z: 64, animation: p.anim === undefined ? -1 : p.anim, interacting: null });
  ll.pluginConfig({ id: 'idlenotifier', enabled: true, config: { __items: inItems, hitpointsNotification: true, hitpoints: 5 } });
  const notes = () => posted.filter((m) => m.type === 'rl-notify').map((m) => m.data);
  const before = notes().length;
  me.anim = 879; now += 600; step();
  me.anim = -1; now += 600; step();
  for (let i = 0; i < 9; i++) { now += 600; step(); }
  assert.deepStrictEqual(notes().slice(before), ['You are now idle!'], 'idle 5 s after the axe stops');
  idle = { keyboard: 3600, mouse: 3600, lastPressed: 0, timeout: 4500 }; now += 600; step(); now += 600; step();
  assert.deepStrictEqual(notes().slice(before + 1), ['You are about to log out from idling too long!'], 'once, at 70 s idle');
  stats[3].level = 10; stats[3].boosted = 4; now += 600; step();
  assert.strictEqual(notes().pop(), 'You have low hitpoints!');
  Date.now = realNow; ll.entityInfo = realInfo;
  ll.pluginConfig({ id: 'idlenotifier', enabled: false, config: {} });
  console.log('idle notifier clone: ok');
}

// ---- Clue Scroll: RuneLite's clue lists trimmed to our server's clues; identified by item id and by the scroll's text
for (const f of ['plugins/cluescrolls/data.js', 'plugins/cluescrolls/page.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
const cs = ll.cluescrolls;
const csItems = require('../src/plugins/cluescrolls/descriptor').config.items;
ll.pluginConfig({ id: 'cluescrolls', enabled: true, config: { __items: csItems } });
const csP = cs.plugin;
const duke = cs.ClueScrollPlugin.findClueScroll(2677);
assert.ok(duke instanceof cs.CrypticClue && /Duke of Lumbridge/.test(duke.text) && duke.getSolution(), 'easy simple001 by item id');
assert.strictEqual(csP.findClueScrollText('This anagram reveals who to speak to next:<br>OK CO').npc, 'Cook', 'anagram by text (2007 lines joined)');
assert.strictEqual(csP.findClueScrollText('How many cannons does Lumbridge Castle have?').getAnswer(), '9', 'challenge scroll: its anagram\'s question');
const coord = csP.findClueScrollText('02 degrees 48 minutes North 22 degrees 30 minutes East');
assert.ok(coord instanceof cs.CoordinateClue && coord.location.x === 3160 && coord.location.y === 3251, 'coordinate from the text');
const emote = csP.findClueScrollText('Dance in the shack in Lumbridge Swamp. Equip a bronze dagger, iron full helmet and a gold ring.');
assert.ok(emote instanceof cs.EmoteClue && emote.getFirstEmote().getName() === 'Dance' && emote.getItemRequirements().length === 3, 'emote clue');
const csIt = (id) => ({ getId: () => id, getQuantity: () => 1 });
assert.ok(emote.getItemRequirements().some((r) => r.fulfilledBy([csIt(1205)])), 'bronze dagger requirement');
// every clue is found again by its own text / item id, and nothing in the lists is after the 2007 cache's objs
for (const c of cs.CrypticClue.CLUES) assert.strictEqual(cs.CrypticClue.forText(c.text.toLowerCase()), c, c.text);
for (const c of cs.EmoteClue.CLUES) assert.strictEqual(cs.EmoteClue.forText(c.text.toLowerCase()), c, c.text);
for (const c of cs.MapClue.CLUES) assert.strictEqual(cs.ClueScrollPlugin.findClueScroll(c.itemId), c);
for (const c of cs.CoordinateClue.CLUES.values()) assert.strictEqual(cs.ClueScrollPlugin.findClueScroll(c.itemId), c);
const allIds = JSON.stringify(ll.cluescrollsData).match(/"(itemIds?|id)":\[?\d+/g).map((s) => +s.replace(/^\D+/, ''));
assert.ok(allIds.length > 200 && allIds.every((id) => id < 11772), 'only 2007 objs (and our own 11764-11771 emote scrolls)');
assert.strictEqual(cs.javaHash('Hello'), 69609650, 'String.hashCode');
// reading the scroll: 2007's interface 345 (eight lines) opens -> the clue, its hint arrow and world map point
const csLines = { 1: 'Search the chest in the Duke of', 2: "Lumbridge's bedroom." };
ll.api.com = (packed) => ((packed >>> 16) === 345 ? { text: csLines[packed & 0xffff] || '', x: 0, y: 0, width: 10, height: 10 } : null);
const csHints = []; ll.setHint = (c, h) => csHints.push(h);
csP.resetClue(true);
csP.onWidgetLoaded({ getGroupId: () => 345 });
assert.strictEqual(csP.getClue(), duke, 'the scroll\'s text gives the clue');
Object.assign(ll.fields, { baseX: 'csBaseX', baseZ: 'csBaseZ', level: 'csLvl' }); Object.assign(ll.client, { csBaseX: 3200, csBaseZ: 3200, csLvl: 1 });
csP.onGameTick();
assert.deepStrictEqual(JSON.parse(JSON.stringify(csHints.pop())), { x: 3209, z: 3218, height: 0 }, 'hint arrow on the chest');
{ const wmp = rl.worldMapPointManager.getWorldMapPoints().map((p) => [p.getWorldPoint().x, p.getWorldPoint().y, p.getWorldPoint().plane, p.getName(), p.isJumpOnClick(), p.isSnapToEdge()]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(wmp)), [[3209, 3218, 1, 'Clue Scroll', true, true]], 'world map point'); }
csP.resetClue(true);
assert.strictEqual(rl.worldMapPointManager.getWorldMapPoints().length, 0, 'reset clears the point');
ll.pluginConfig({ id: 'cluescrolls', enabled: false, config: {} });
console.log('clue scroll clone: ok');

// ---- Timers & Buffs: varp timers (antipoison, Charge), chat timers, freezes from graphics, death
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/timersandbuffs/page.js'), 'utf8'), ctx);
  const tbItems = require('../src/plugins/timersandbuffs/descriptor').config.items;
  const varps = new Int32Array(400);
  Object.assign(ll.fields, { varps: 'vp' }); ll.client.vp = varps;
  let gfx = -1;
  const realInfo = ll.entityInfo;
  ll.entityInfo = (p, o) => Object.assign(o, { x: 64, z: 64, animation: -1, graphic: gfx, interacting: null });
  step();
  ll.pluginConfig({ id: 'timersandbuffs', enabled: true, config: { __items: tbItems } });
  const boxes = () => Array.from(rl.infoBoxManager.getInfoBoxes().filter((b) => b.getTimer), (b) => b.getName());
  varps[102] = -5; step();
  assert.deepStrictEqual(boxes(), ['ANTIPOISON']);
  const ap = rl.infoBoxManager.getInfoBoxes().find((b) => b.getName() === 'ANTIPOISON');
  assert.ok(Math.abs(ap.left() - (30 + 4 * 30) * 600) < 1000, 'antipoison: next cycle + 4 more cycles');
  varps[272] = 350; step();
  const ch = rl.infoBoxManager.getInfoBoxes().find((b) => b.getName() === 'CHARGE');
  assert.ok(/^(7:00|6:59)$/.test(ch.getText()));
  varps[102] = 0; varps[272] = 0; step();
  assert.deepStrictEqual(boxes(), [], 'cleared when the varps go back to 0');
  core.chat({ type: 0, text: 'You drink some of your dragon potion.', time: Date.now() });
  core.chat({ type: 0, text: "You fail to pick the man's pocket.", time: Date.now() });
  core.chat({ type: 0, text: 'You need to wait another 12 minutes to cast this spell.', time: Date.now() });
  assert.deepStrictEqual(boxes().sort(), ['ANTIFIRE', 'HOME_TELEPORT', 'PICKPOCKET_STUN']);
  assert.ok(/^(6:00|5:59)$/.test(rl.infoBoxManager.getInfoBoxes().find((b) => b.getName() === 'ANTIFIRE').getText()));
  gfx = 369; step();
  assert.ok(boxes().includes('ICEBARRAGE'), 'frozen by ice barrage');
  stats[3].level = 10; stats[3].boosted = 10; step();
  stats[3].boosted = 0; step();
  assert.deepStrictEqual(boxes().sort(), ['ANTIFIRE', 'HOME_TELEPORT'], 'freeze and stun go on death');
  ll.pluginConfig({ id: 'timersandbuffs', enabled: false, config: {} });
  assert.deepStrictEqual(boxes(), []);
  ll.entityInfo = realInfo;
  console.log('timers & buffs clone: ok');
}

// ---- core: overlay menu entries (Shift over an overlay) and varbits / VarbitChanged
{
  const R = rl._test.R;
  const ov = new rl.Overlay();
  let fired = 0; const clicked = [];
  ov.addMenuEntry('RUNELITE_OVERLAY', 'Reset', 'Test overlay', () => fired++);
  ov.addMenuEntry(rl.MenuAction.RUNELITE_OVERLAY, 'Other', 'Test overlay');
  ov.addMenuEntry('RUNELITE_OVERLAY', 'Gone', 'Test overlay');
  ov.removeMenuEntry('RUNELITE_OVERLAY', 'Gone', 'Test overlay');
  assert.strictEqual(ov.getMenuEntries().length, 2);
  const sub = { onOverlayMenuClicked: (e) => clicked.push(e.getEntry().getOption()) };
  rl.eventBus.register(sub);
  const menu = [['Cancel', 'Walk here'], [1006, 10], [0, 0], [0, 0], [0, 0]];
  ll.menuArrays = () => menu;
  const ins = [];
  ll.insertMenuEntry = (c, at, text, fn) => { ins.push({ at, text, fn }); menu.forEach((a) => a.splice(at, 0, a === menu[0] ? text : 0)); ll.client.mc++; };
  R.lastHovered = ov; ll.shiftDown = false; ll.client.mc = 2;
  ll.pagePlugins.get('runelite').impl.menu(ll.client);
  assert.strictEqual(ins.length, 0, 'nothing without Shift');
  ll.shiftDown = true;
  ll.pagePlugins.get('runelite').impl.menu(ll.client);
  assert.ok(menu[0].length === 4 && /^Reset /.test(menu[0][2]) && /^Other /.test(menu[0][1]) && menu[0][3] === 'Walk here', 'under the top entry, first entry highest: ' + menu[0]);
  ins.find((e) => /^Reset/.test(e.text)).fn(); ins.find((e) => /^Other/.test(e.text)).fn();
  assert.strictEqual(fired, 1, 'callback'); assert.deepStrictEqual(clicked, ['Other'], 'OverlayMenuClicked');
  rl.eventBus.unregister(sub);
  R.lastHovered = null; ll.shiftDown = false;
  // varbits: [id, basevar, startbit, endbit]
  ll.api.varbitDefs = () => Int32Array.from([5, 7, 4, 6, 9, 7, 0, 0]);
  Object.assign(ll.fields, { varps: 'vps' }); ll.client.vps = new Int32Array(10);
  const vb = [];
  rl.eventBus.register({ onVarbitChanged: (e) => vb.push([e.getVarpId(), e.getVarbitId(), e.getValue()]) });
  step();
  ll.client.vps[7] = (5 << 4) | 1; step();
  assert.deepStrictEqual(vb, [[7, -1, 81], [7, 5, 5], [7, 9, 1]], 'varp then each changed varbit');
  assert.strictEqual(rl.client.getVarbitValue(Int32Array.from(ll.client.vps), 5), 5);
  assert.strictEqual(rl.client.getVarpValue(7), 81);
  console.log('core overlay menu / varbits: ok');
}

// ---- Menu Entry Swapper: Talk-to -> Bank on a banker; an item's left-click set to Drop
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/menuentryswapper/page.js'), 'utf8'), ctx);
  ll.insertMenuEntry = (c, at, text, fn) => { inserted.push({ at, text, fn }); };
  const mesItems = require('../src/plugins/menuentryswapper/descriptor').config.items;
  ll.pluginConfig({ id: 'menuentryswapper', enabled: true, config: { __items: mesItems } });
  const texts = () => Array.from(ll.menuArrays()[0].slice(0, ll.client.mc));
  let m = [['Cancel', 'Examine @yel@Banker', 'Bank @yel@Banker', 'Talk-to @yel@Banker'], [1007, 1002, 38, 17], [0, 3, 3, 3], [0, 0, 0, 0], [0, 0, 0, 0]];
  ll.menuArrays = () => m; ll.client.mc = 4; ll.shiftDown = false;
  core.menu(ll.client);
  assert.strictEqual(texts()[3], 'Bank @yel@Banker', 'Bank on top');
  // a bronze axe in the inventory: Wield (op 2), Use, Drop, Examine; left-click set to Drop (op index 4)
  ll.api.iop = () => [null, 'Wield', null, null, 'Drop'];
  m = [['Cancel', 'Examine @or1@Bronze axe', 'Drop @or1@Bronze axe', 'Use @or1@Bronze axe', 'Wield @or1@Bronze axe'], [1007, 1001, 18, 12, 9], [0, 1351, 1351, 1351, 1351], [0, 0, 0, 0, 0], [0, 149 << 16, 149 << 16, 149 << 16, 149 << 16]];
  ll.client.mc = 5; ll.shiftDown = true; inserted.length = 0;
  core.menu(ll.client);
  ll.shiftDown = false;
  const swapLeft = inserted.find((e) => /^Swap left-click/.test(e.text));
  assert.ok(swapLeft, 'Swap left-click on Shift + right-click');
  swapLeft.fn();
  const menuOpts = ll.chatPrompt[1];
  assert.ok(/Drop/.test(menuOpts) && /Use/.test(menuOpts) && !/Wield/.test(menuOpts), 'the default (Wield) is not listed: ' + menuOpts);
  rl.chatboxPanelManager.current.options.find((o) => o.text === 'Drop').fn();
  assert.strictEqual(rl.configManager.getConfiguration('menuentryswapper', 'item_1351'), '4');
  rl.chatboxPanelManager.close();
  m = [['Cancel', 'Examine @or1@Bronze axe', 'Drop @or1@Bronze axe', 'Use @or1@Bronze axe', 'Wield @or1@Bronze axe'], [1007, 1001, 18, 12, 9], [0, 1351, 1351, 1351, 1351], [0, 0, 0, 0, 0], [0, 149 << 16, 149 << 16, 149 << 16, 149 << 16]];
  ll.client.mc = 5;
  core.menu(ll.client); // (lastShift: the shift state of the frame before)
  m = m.map((a) => a.slice()); m[0] = ['Cancel', 'Examine @or1@Bronze axe', 'Drop @or1@Bronze axe', 'Use @or1@Bronze axe', 'Wield @or1@Bronze axe']; m[1] = [1007, 1001, 18, 12, 9];
  core.menu(ll.client);
  assert.strictEqual(texts()[4], 'Drop @or1@Bronze axe', 'Drop is the left-click');
  // RuneLite's named swaps added back: Exchange (Tool Leprechaun), Clean on herbs, box trap Reset, the tanner's Tan all
  ll.pluginConfig({ id: 'menuentryswapper', enabled: true, config: { swapHerbs: true, swapTan: true } });
  const swapped = (rows, ids) => {
    m = [['Cancel', ...rows], [1007, ...ids], rows.map(() => 0).concat(0), rows.map(() => 0).concat(0), rows.map(() => 0).concat(0)];
    ll.client.mc = rows.length + 1;
    core.menu(ll.client);
    return texts()[rows.length];
  };
  assert.strictEqual(swapped(['Examine @yel@Tool Leprechaun', 'Exchange @yel@Tool Leprechaun', 'Talk-to @yel@Tool Leprechaun'], [1002, 34, 17]), 'Exchange @yel@Tool Leprechaun');
  assert.strictEqual(swapped(['Examine @or1@Grimy guam', 'Use @or1@Grimy guam', 'Clean @or1@Grimy guam'], [1001, 12, 9]), 'Use @or1@Grimy guam');
  assert.strictEqual(swapped(['Examine @cya@Box trap', 'Reset @cya@Box trap', 'Check @cya@Box trap'], [1005, 51, 7]), 'Reset @cya@Box trap');
  assert.strictEqual(swapped(['Tan all @lre@Soft Leathers', 'Tan 5 @lre@Soft Leathers', 'Tan 1 @lre@Soft Leather'], [646, 646, 646]), 'Tan all @lre@Soft Leathers');
  ll.pluginConfig({ id: 'menuentryswapper', enabled: true, config: { swapTan: false } });
  assert.strictEqual(swapped(['Tan all @lre@Soft Leathers', 'Tan 5 @lre@Soft Leathers', 'Tan 1 @lre@Soft Leather'], [646, 646, 646]), 'Tan 1 @lre@Soft Leather', 'off: Tan 1 stays');
  // a bank booth (2007 loc 11402: Use, Use-quickly) in front of a banker: its op entries' identifier is the scene tag
  // (the id in bits 32-62, the square in the low bits), Examine's the loc's id. Here the booth stands for a multiloc
  // (tag id 9999, shown as 11402) and the menu has a placed op (Search, slot 3) the loc type lacks.
  {
    const realLoc = ll.api.loc;
    ll.api.loc = (id) => (id === 11402 ? { name: 'Bank booth', width: 1, length: 1, op: ['Use', 'Use-quickly', null, null, null] } : { name: 'null', width: 1, length: 1, op: [null, null, null, null, null] });
    const tag = 9999 * 4294967296 + (2 << 29) + (40 << 7) + 50;
    const booth = () => {
      m = [['Cancel', 'Examine @yel@Banker', 'Examine @cya@Bank booth', 'Walk here', 'Talk-to @yel@Banker', 'Bank @yel@Banker', 'Search @cya@Bank booth', 'Use-quickly @cya@Bank booth', 'Use @cya@Bank booth'],
        [1007, 1002, 1005, 10, 17, 38, 51, 35, 7], [0, 3, 11402, 0, 3, 3, tag, tag, tag], [0, 0, 50, 0, 0, 0, 50, 50, 50], [0, 0, 40, 0, 0, 0, 40, 40, 40]];
      ll.client.mc = m[0].length;
    };
    booth(); ll.shiftDown = true; inserted.length = 0;
    core.menu(ll.client);
    ll.shiftDown = false;
    for (const [kind, key] of [['left', 'object_11402'], ['shift', 'object_shift_11402']]) {
      const swapEntry = inserted.find((e) => e.text === `Swap ${kind}-click @cya@Bank booth`);
      assert.ok(swapEntry, `Swap ${kind}-click on the booth`);
      swapEntry.fn();
      const opts = Array.from(rl.chatboxPanelManager.current.options, (o) => o.text);
      assert.deepStrictEqual(opts, ['Use', 'Use-quickly', 'Search', 'Walk here'], `every op of the booth is offered (${kind})`);
      rl.chatboxPanelManager.current.options.find((o) => o.text === 'Use-quickly').fn();
      rl.chatboxPanelManager.close();
      assert.strictEqual(rl.configManager.getConfiguration('menuentryswapper', key), '1', 'saved by the loc it shows as');
    }
    booth(); core.menu(ll.client);
    assert.strictEqual(texts()[m[0].length - 1], 'Use-quickly @cya@Bank booth', 'Use-quickly is the left-click');
    ll.shiftDown = true; booth(); core.menu(ll.client);
    assert.strictEqual(texts()[ll.client.mc - 1], 'Use-quickly @cya@Bank booth', 'and the shift-click');
    ll.shiftDown = false;
    rl.configManager.unsetConfiguration('menuentryswapper', 'object_11402'); rl.configManager.unsetConfiguration('menuentryswapper', 'object_shift_11402');
    booth(); core.menu(ll.client);
    assert.strictEqual(texts()[m[0].length - 1], 'Use @cya@Bank booth', 'reset: Use again');
    assert.deepStrictEqual(Array.from(texts().slice(4, 6)), ['Talk-to @yel@Banker', 'Bank @yel@Banker'], 'swapBank: Bank over Talk-to on the banker');
    ll.api.loc = realLoc;
  }
  // the same in game, at Varrock West bank, picked with the mouse: Shift + right-click a booth (2007 loc 11402 at
  // 3186,3440; the menu as the client made it there, the op entries' identifier the scene tag 11402 << 32 | 1081251906),
  // "Swap left-click" / "Swap shift-click", then click "2: Use-quickly" on the chat box prompt's second line (548:94,
  // 459 wide at 30,422, its text centred). The list is RuneLite's ChatboxTextMenuInput, whose options are clicked; it took
  // only the number keys before, so clicking Use-quickly did nothing.
  {
    const realLoc = ll.api.loc, realCom = ll.api.com, realWidth = ll.api.comTextWidth;
    ll.api.loc = (id) => (id === 11402 ? { name: 'Bank booth', width: 1, length: 1, op: ['Use', 'Use-quickly', null, null, null] } : { name: 'null', width: 1, length: 1, op: [null, null, null, null, null] });
    let promptShown = true;
    ll.api.com = (p) => (p === ((548 << 16) | 88) ? { hide: !promptShown } : p === ((548 << 16) | 94) ? { screen: [30, 422], width: 459, height: 20 } : null);
    ll.api.comTextWidth = (p, s) => (p === ((548 << 16) | 94) ? rl.Text.removeTags(s).length * 6 : -1);
    const listeners = new Set();
    const realReg = rl.mouseManager.registerMouseListener, realUnreg = rl.mouseManager.unregisterMouseListener;
    rl.mouseManager.registerMouseListener = (l) => { listeners.add(l); realReg.call(rl.mouseManager, l); };
    rl.mouseManager.unregisterMouseListener = (l) => { listeners.delete(l); realUnreg.call(rl.mouseManager, l); };
    const mouse = (kind, x, y, button = 0) => {
      let consumed = false;
      const ev = { getPoint: () => new rl.Point(x, y), getX: () => x, getY: () => y, getButton: () => button, consume() { consumed = true; }, isConsumed: () => consumed };
      for (const l of [...listeners]) if (l[kind]) l[kind](ev);
      return consumed;
    };
    // where an option is drawn: "1: Use   2: Use-quickly   3: Walk here" centred on the line
    const optionX = (text) => {
      const line = rl.chatboxPanelManager.current.options.map((o, i) => `${i + 1}: ${o.text}`).join('   ');
      const i = line.indexOf(text);
      return 30 + Math.trunc((459 - line.length * 6) / 2) + (i + text.length / 2) * 6;
    };
    const tag = 48972298360898; // 11402 * 2^32 + 1081251906
    assert.strictEqual(Math.floor(tag / 4294967296), 11402);
    const booth = () => {
      m = [['Cancel', 'Examine @cya@Bank booth', 'Walk here', 'Use-quickly @cya@Bank booth', 'Use @cya@Bank booth'],
        [1007, 1005, 10, 35, 7], [0, 11402, 0, tag, tag], [0, 66, -13, 66, 66], [0, 48, 25, 48, 48]];
      ll.client.mc = m[0].length;
    };
    for (const [kind, key] of [['left', 'object_11402'], ['shift', 'object_shift_11402']]) {
      booth(); ll.shiftDown = true; inserted.length = 0;
      core.menu(ll.client);
      ll.shiftDown = false;
      const swapEntry = inserted.find((e) => e.text === `Swap ${kind}-click @cya@Bank booth`);
      assert.ok(swapEntry, `Swap ${kind}-click on the booth`);
      swapEntry.fn();
      assert.deepStrictEqual(Array.from(rl.chatboxPanelManager.current.options, (o) => o.text), ['Use', 'Use-quickly', 'Walk here'], `the booth's ops (${kind})`);
      assert.strictEqual(listeners.size, 1, 'the list takes mouse clicks');
      const x = optionX('2: Use-quickly');
      // hovering draws the option white
      mouse('mouseMoved', x, 432, -1);
      assert.strictEqual(ll.chatPrompt[1], '1: Use   @whi@2: Use-quickly@end@   3: Walk here');
      mouse('mouseMoved', x, 300, -1);
      assert.strictEqual(ll.chatPrompt[1], '1: Use   2: Use-quickly   3: Walk here', 'off the line: plain again');
      assert.strictEqual(mouse('mousePressed', x, 432, 2), false, 'a right click is left alone');
      assert.strictEqual(mouse('mousePressed', x, 400, 0), false, 'a click off the line is left alone');
      promptShown = false;
      assert.strictEqual(mouse('mousePressed', x, 432, 0), false, 'nor while the game\'s own prompt has the place');
      promptShown = true;
      assert.strictEqual(mouse('mousePressed', x, 432, 0), true, 'clicking Use-quickly picks it');
      assert.strictEqual(rl.chatboxPanelManager.current, null, 'and closes the list');
      assert.strictEqual(listeners.size, 0, 'which stops taking clicks');
      assert.strictEqual(rl.configManager.getConfiguration('menuentryswapper', key), '1', `Use-quickly saved (${kind})`);
    }
    booth(); core.menu(ll.client);
    assert.strictEqual(texts()[m[0].length - 1], 'Use-quickly @cya@Bank booth', 'Use-quickly is the left-click');
    ll.shiftDown = true; booth(); core.menu(ll.client);
    assert.strictEqual(texts()[ll.client.mc - 1], 'Use-quickly @cya@Bank booth', 'and the shift-click');
    // Reset, clicked too (the list is Use, Use-quickly, Walk here, Reset)
    inserted.length = 0; booth(); core.menu(ll.client);
    ll.shiftDown = false;
    for (const kind of ['left', 'shift']) {
      inserted.find((e) => e.text === `Swap ${kind}-click @cya@Bank booth`).fn();
      assert.deepStrictEqual(Array.from(rl.chatboxPanelManager.current.options, (o) => o.text), ['Use', 'Use-quickly', 'Walk here', 'Reset']);
      assert.strictEqual(mouse('mousePressed', optionX('4: Reset'), 432, 0), true);
    }
    assert.strictEqual(rl.configManager.getConfiguration('menuentryswapper', 'object_11402'), undefined, 'reset');
    assert.strictEqual(rl.configManager.getConfiguration('menuentryswapper', 'object_shift_11402'), undefined, 'reset (shift)');
    booth(); core.menu(ll.client);
    assert.strictEqual(texts()[m[0].length - 1], 'Use @cya@Bank booth', 'reset: Use again');
    // the number keys still pick
    inserted.length = 0; ll.shiftDown = true; booth(); core.menu(ll.client); ll.shiftDown = false;
    inserted.find((e) => e.text === 'Swap left-click @cya@Bank booth').fn();
    rl.chatboxPanelManager.current.listener.keyPressed({ key: '2', consume() {} });
    assert.strictEqual(rl.configManager.getConfiguration('menuentryswapper', 'object_11402'), '1', 'key 2: Use-quickly');
    assert.strictEqual(listeners.size, 0);
    rl.configManager.unsetConfiguration('menuentryswapper', 'object_11402');
    rl.mouseManager.registerMouseListener = realReg; rl.mouseManager.unregisterMouseListener = realUnreg;
    ll.api.loc = realLoc; ll.api.com = realCom; ll.api.comTextWidth = realWidth;
  }
  ll.pluginConfig({ id: 'menuentryswapper', enabled: false, config: {} });
  console.log('menu entry swapper clone: ok');
}

// ---- Barrows: slain panel and reward potential from the 2007 varbits, the puzzle answer
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/barrows/page.js'), 'utf8'), ctx);
  const bItems = require('../src/plugins/barrows/descriptor').config.items;
  ll.pluginConfig({ id: 'barrows', enabled: true, config: { __items: bItems } });
  const vps = new Int32Array(1000); ll.client.vps = vps;
  // barrows_kills (varp 453): brothers bits 0-5, monster kills bits 6-15
  ll.api.varbit = (id) => (id >= 457 && id <= 462 ? (vps[453] >> (id - 457)) & 1 : id === 463 ? (vps[453] >> 6) & 1023 : 0);
  vps[453] = 0b000101 | (100 << 6);
  const slain = rl.overlayManager.overlays.find((o) => o instanceof ll.barrowsTest.BarrowsBrotherSlainOverlay);
  assert.strictEqual(slain.rewardPotential(), 104, '100 + 2 brothers x 2');
  assert.strictEqual(JSON.stringify(slain.getMenuEntries().map((e) => [e.getMenuAction(), e.getOption()])), '[[1503,"Configure"]]');
  // the slain panel only at the Barrows (BarrowsBrotherSlainOverlay): 2007's overlay 24 is never closed, so not at Draynor
  {
    const realInfo = ll.entityInfo, realVis = ll.api.comVisible, realOpen = ll.api.ifOpen, realCom = ll.api.com;
    ll.api.com = (p) => ((p >>> 16) === 24 ? { x: 0, y: 0, width: 10, height: 10 } : null);
    ll.api.comVisible = () => true; ll.api.ifOpen = (g) => g === 24;
    Object.assign(ll.fields, { baseX: 'bx', baseZ: 'bz', level: 'lv' });
    const at = (wx, wz) => { Object.assign(ll.client, { bx: wx - 52, bz: wz - 52, lv: 0 }); ll.entityInfo = (p, o) => Object.assign(o, { x: (52 << 7) + 64, z: (52 << 7) + 64, animation: -1, interacting: null }); };
    const fm = { getHeight: () => 11, stringWidth: (t) => String(t).length * 6, getAscent: () => 9, getDescent: () => 2 };
    const g = new Proxy({}, { get: (_t, k) => (k === 'getFontMetrics' ? () => fm : () => undefined) });
    const shown = () => { slain.panelComponent.getChildren().length = 0; return slain.render(g) != null; };
    at(3093, 3244); assert.strictEqual(shown(), false, 'not at Draynor with overlay 24 still open');
    at(3565, 3290); assert.strictEqual(shown(), true, 'at the mounds (14131)');
    at(3551, 9695); assert.strictEqual(shown(), true, 'in the crypt (14231) with overlay 24');
    ll.api.ifOpen = () => false; assert.strictEqual(shown(), false, 'in the crypt without overlay 24');
    ll.entityInfo = realInfo; ll.api.comVisible = realVis; ll.api.ifOpen = realOpen; ll.api.com = realCom;
  }
  // the puzzle: question model 6734 (interface 25, component 1), the right answer is 6731 on component 7
  const models = { 1: 6734, 6: 6732, 7: 6731, 8: 6733 };
  const realCom = ll.api.com;
  ll.api.com = (p) => ((p >>> 16) === 25 && models[p & 0xffff] ? { modelId: models[p & 0xffff], x: 10 * (p & 0xffff), y: 5, width: 30, height: 20 } : null);
  ll.api.comVisible = () => true;
  ll.widgetLoaded(25);
  const ans = rl.overlayManager.overlays.find((o) => o instanceof ll.barrowsTest.BarrowsOverlay).plugin.getPuzzleAnswer();
  assert.strictEqual(ans.getId(), (25 << 16) | 7, 'the answer whose model is the question\'s - 3');
  ll.widgetClosed(25, true);
  assert.strictEqual(rl.overlayManager.overlays.find((o) => o instanceof ll.barrowsTest.BarrowsOverlay).plugin.getPuzzleAnswer(), null);
  ll.api.com = realCom;
  ll.pluginConfig({ id: 'barrows', enabled: false, config: {} });
  console.log('barrows clone: ok');
}

// ---- Slayer: the task from varps 394 / 395 (OSRS task ids), the infobox, targets, the count on the gem
{
  for (const f of ['plugins/slayer/data.js', 'plugins/slayer/page.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  const sItems = require('../src/plugins/slayer/descriptor').config.items;
  const vps = new Int32Array(1000); ll.client.vps = vps;
  const gob = { index: 9, typecode: 0x20000000 + (9 << 14), id: 100, name: 'Goblin', level: 2, x: 50 * 128 + 64, z: 50 * 128 + 64, size: 1, health: 0, totalHealth: 0, actions: [null, 'Attack', null, null, null], animation: -1 };
  const realNpcs = ll.readNpcs;
  ll.readNpcs = () => [gob];
  ll.pluginConfig({ id: 'slayer', enabled: true, config: { __items: sItems, highlightHull: true } });
  const sp = ll.slayerTest.plugin;
  assert.strictEqual(ll.slayerTest.Task.getTask('goblins').getName(), 'Goblins');
  vps[395] = 2; vps[394] = 15; step(); sp.updateTask();
  assert.strictEqual(sp.getTaskName(), 'Goblins'); assert.strictEqual(sp.getAmount(), 15);
  const box = rl.infoBoxManager.getInfoBoxes().find((b) => b.itemId !== undefined && b.getText);
  assert.ok(box && box.getText() === '15' && /Goblins/.test(box.tooltip), 'task infobox');
  assert.deepStrictEqual(sp.getTargets().map((n) => n.getIndex()), [9], 'goblins are targets');
  assert.ok(rl.npcOverlayService.highlightedNpcs.has(9), 'highlighted (hull on)');
  vps[394] = 14; step(); sp.updateTask();
  assert.strictEqual(box === rl.infoBoxManager.getInfoBoxes().find((b) => b.itemId !== undefined) ? box.getText() : rl.infoBoxManager.getInfoBoxes().find((b) => b.itemId !== undefined).getText(), '14');
  // the count on the enchanted gem (WidgetItemOverlay over the inventory, 149)
  ll.api.widgetItems = () => Int32Array.from([4155, 1, (149 << 16) | 0, 3, 600, 220, 995, 5, (149 << 16) | 0, 4, 640, 220]);
  const drawn = [];
  const g = { setFont() {}, getFontMetrics: () => ({ getHeight: () => 11, stringWidth: (s) => s.length * 6, getAscent: () => 9 }), setColor() {}, drawString: (s, x, y) => drawn.push([s, x, y]), getColor() {}, getFont() {} };
  sp.overlay.render(g);
  assert.ok(drawn.some((d) => d[0] === '14' && d[1] === 599), 'count on the gem only: ' + JSON.stringify(drawn));
  vps[394] = 0; step(); sp.updateTask();
  assert.strictEqual(sp.getAmount(), 0); assert.strictEqual(rl.infoBoxManager.getInfoBoxes().filter((b) => b.itemId !== undefined).length, 0, 'task done');
  ll.pluginConfig({ id: 'slayer', enabled: false, config: {} });
  ll.readNpcs = realNpcs;
  console.log('slayer clone: ok');
}

// ---- Agility: obstacles and shortcuts from the core's loc events, a Gnome course lap from the XP at the course's end
{
  for (const f of ['plugins/runelite/agilityshortcut.js', 'plugins/agility/obstacles.js', 'plugins/agility/page.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  const agItems = require('../src/plugins/agility/descriptor').config.items;
  const realInfo = ll.entityInfo;
  // you at the end of the Gnome course's pipes (2484, 3437): scene base 2432, 3392
  Object.assign(ll.fields, { baseX: 'bx', baseZ: 'bz', level: 'lv' }); Object.assign(ll.client, { bx: 2432, bz: 3392, lv: 0 });
  ll.entityInfo = (p, o) => Object.assign(o, { x: (52 << 7) + 64, z: (45 << 7) + 64, animation: -1, interacting: null });
  locEvs = [
    { k: 2, level: 0, sx: 50, sz: 40, wx: 2482, wz: 3432, id: 2295, tag: 1n, shape: 10, angle: 0, spawned: true }, // Gnome log balance
    { k: 0, level: 0, sx: 10, sz: 10, wx: 2442, wz: 3402, id: 11844, tag: 2n, shape: 0, angle: 0, spawned: true }, // a shortcut's object
    { k: 2, level: 0, sx: 51, sz: 41, wx: 2483, wz: 3433, id: 1281, tag: 3n, shape: 10, angle: 0, spawned: true },
  ];
  ll.pluginConfig({ id: 'agility', enabled: true, config: { __items: agItems } });
  step();
  const ag = ll.__agility.plugin;
  const obs = [...ag.getObstacles()].map(([o, ob]) => [o.getId(), ob.shortcut && ob.shortcut.name]);
  assert.deepStrictEqual(obs, [[2295, null], [11844, 'FALADOR_CRUMBLING_WALL']]);
  assert.strictEqual(rl.AgilityShortcut.FALADOR_CRUMBLING_WALL.getTooltip(), 'Crumbling Wall - Level 5');
  stats[16].xp = 0; step();
  stats[16].xp = 100; stats[16].level = 2; step();
  const s = ag.getSession();
  assert.ok(s, 'a lap at the course end');
  assert.strictEqual(s.getCourse(), ll.__agility.Courses.GNOME);
  assert.strictEqual(s.getTotalLaps(), 1);
  assert.strictEqual(s.getLapsTillGoal(), Math.ceil((174 - 100) / 86.5), 'laps to level 3 at 86.5 xp a lap');
  locEvs = [{ k: 2, level: 0, sx: 50, sz: 40, wx: 2482, wz: 3432, id: 2295, tag: 1n, spawned: false }]; step();
  assert.strictEqual(ag.getObstacles().size, 1, 'despawned');
  ll.entityInfo = realInfo;
  ll.pluginConfig({ id: 'agility', enabled: false, config: {} });
  console.log('agility clone: ok');
}

// ---- Fishing: the core's FishingSpot (2007 NPC ids by their Jagex names), spots from NpcSpawned, the session from the catch message
{
  for (const f of ['plugins/runelite/fishingspot.js', 'plugins/fishing/page.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  assert.strictEqual(rl.FishingSpot.findSpot(316), rl.FishingSpot.SHRIMP, '0_43_51_saltfish');
  assert.strictEqual(rl.FishingSpot.findSpot(321), rl.FishingSpot.LOBSTER, '0_44_53_rarefish');
  assert.strictEqual(rl.FishingSpot.SHRIMP.getFishSpriteId(), 317);
  assert.strictEqual(rl.FishingSpot.MINNOW, undefined, 'no minnows in 2007');
  const fiItems = require('../src/plugins/fishing/descriptor').config.items;
  const spotNpc = { index: 7, typecode: 0x20000000 + (7 << 14), id: 316, name: 'Fishing spot', level: 0, x: 50 * 128 + 64, z: 51 * 128 + 64, size: 1, actions: ['Net', null, 'Bait', null, null], animation: -1 };
  const realNpcs = ll.readNpcs;
  ll.readNpcs = () => [spotNpc];
  ll.pluginConfig({ id: 'fishing', enabled: true, config: { __items: fiItems } });
  step();
  const fp = ll.__fishing.plugin;
  assert.strictEqual(JSON.stringify(fp.getFishingSpots().map((n) => n.getId())), '[316]');
  core.chat({ type: 0, text: 'You catch some shrimps.', time: Date.now() }); step();
  assert.ok(fp.getSession().getLastFishCaught(), 'a catch starts the session');
  assert.strictEqual(fp.spotOverlay.hidden, false);
  ll.readNpcs = () => []; step();
  assert.strictEqual(fp.getFishingSpots().length, 0, 'despawned');
  ll.readNpcs = realNpcs;
  ll.pluginConfig({ id: 'fishing', enabled: false, config: {} });
  console.log('fishing clone: ok');
}
// ---- Time Tracking: the 2007 patch varbits, predictions, the observed growth tick offset, clocks, the panel model
{
  for (const f of ['plugins/timetracking/data.js', 'plugins/timetracking/page.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  const tItems = require('../src/plugins/timetracking/descriptor').config.items;
  const T = ll.timetrackingTest;
  const TD = ll.timetrackingData;
  const vb = {};
  ll.api.varbit = (id) => vb[id] | 0;
  ll.api.componentTable = () => [];
  ll.pluginConfig({ id: 'timetracking', enabled: true, config: { __items: tItems, timeFormatMode: 'RELATIVE' } });
  const tp = T.plugin;
  // the world: RuneLite's Falador farm, mapped to the 2007 varbits
  const fal = tp.farmingWorld.all.find((r) => r.regionID === 12083);
  assert.deepStrictEqual(Array.from(fal.patches, (p) => `${p.name}:${p.implementation.key}:${p.varbit}`), ['North West:ALLOTMENT:708', 'South East:ALLOTMENT:709', ':FLOWER:728', ':HERB:780', ':COMPOST:740']);
  assert.strictEqual(fal.patches[0].farmer, 2323, 'Elstan, the 2007 npc id');
  // 2007 herb / hops values (the server's): toadflax from 46, torstol from 204, hops watered states
  const ps = (s) => s && `${s.produce.key}/${s.cropState}/${s.stage}`;
  assert.strictEqual(ps(TD.PatchImplementation.HERB.forVarbitValue(46)), 'TOADFLAX/GROWING/0');
  assert.strictEqual(ps(TD.PatchImplementation.HERB.forVarbitValue(204)), 'TORSTOL/GROWING/0');
  assert.strictEqual(ps(TD.PatchImplementation.HERB.forVarbitValue(8)), 'GUAM/HARVESTABLE/2');
  assert.strictEqual(ps(TD.PatchImplementation.HOPS.forVarbitValue(68)), 'HAMMERSTONE/GROWING/0');
  // a potato seed (allotment value 6) seen 11 minutes ago, unknown offset: done 4 10-minute ticks after it
  assert.strictEqual(rl.configManager.getRSProfileKey(), 'tester');
  const now = Math.floor(Date.now() / 1000);
  const seen = now - 660;
  rl.configManager.setRSProfileConfiguration('timetracking', '12083.708', `6:${seen}`);
  const pr = tp.farmingTracker.predictPatch(fal.patches[0]);
  const tick0 = seen - (seen % 600);
  assert.strictEqual(pr.produce.key, 'POTATO'); assert.strictEqual(pr.doneEstimate, tick0 + 4 * 600); // 5 stages: 4 ticks
  assert.strictEqual(pr.stage, Math.trunc((now - (now % 600) - tick0) / 600));
  // observed growth tick: stage 0 -> 1 (value 7) sets the offset from the clock, precision 10
  tick += 100;
  vb[708] = 7;
  const loc = new rl.WorldPoint(3055, 3307, 0);
  tp.farmingTracker.lastRegions = tp.farmingWorld.getRegionsForLocation(loc);
  assert.strictEqual(tp.farmingTracker.updateData(loc, 5), true);
  const off = Math.abs((Math.floor(Date.now() / 60000) % 10) - 10);
  assert.strictEqual(rl.configManager.getRSProfileConfiguration('timetracking', 'farmTickOffsetPrecision'), 10);
  assert.strictEqual(rl.configManager.getRSProfileConfiguration('timetracking', 'farmTickOffset'), off);
  assert.strictEqual(String(rl.configManager.getRSProfileConfiguration('timetracking', '12083.708')).split(':')[0], '7');
  // a modal interface open: nothing is read
  ll.api.componentTable = () => [12, 0];
  assert.strictEqual(tp.farmingTracker.updateData(loc, 5), false);
  ll.api.componentTable = () => [];
  // the notification text
  const notes = [];
  const realNotify = rl.notifier.notify; rl.notifier.notify = (m) => notes.push(m);
  tp.farmingTracker.sendNotification({ getDisplayName: () => 'Tester', getKey: () => 'tester' }, { produce: TD.Produce.POTATO, cropState: 'GROWING' }, fal.patches[0]);
  assert.deepStrictEqual(notes, ['Your Potato is ready to harvest in Falador.']);
  // compost messages (the server's wording)
  assert.strictEqual(T.CompostTracker.determineCompostUsed('You treat the allotment with supercompost.'), 'SUPERCOMPOST');
  assert.strictEqual(T.CompostTracker.determineCompostUsed('This is an allotment. The soil has been treated with compost. The patch needs weeding.'), 'COMPOST');
  // clocks
  assert.strictEqual(T.getFormattedDuration(3725), '01:02:05');
  assert.strictEqual(T.stringToSeconds('1:30'), 90); assert.strictEqual(T.stringToSeconds('1h 2m'), 3720); assert.strictEqual(T.stringToSeconds('2:00:05'), 7205);
  tp.onPanelAction({ action: 'addTimer' });
  tp.onPanelAction({ action: 'addStopwatch' });
  assert.strictEqual(tp.clockManager.timers[0].name, 'Timer 1'); assert.strictEqual(tp.clockManager.timers[0].duration, 300);
  tp.onPanelAction({ action: 'duration', kind: 'timer', i: 0, value: '0:01' });
  tp.onPanelAction({ action: 'startPause', kind: 'timer', i: 0 });
  assert.ok(tp.clockManager.timers[0].active);
  assert.ok(JSON.parse(rl.configManager.getConfiguration('timetracking', 'timers'))[0].active, 'saved');
  // the panel model
  const tpanel = () => JSON.parse(JSON.stringify(posted.filter((m) => m.type === 'plugin-state' && m.data.id === 'timetracking').pop().data.state));
  assert.strictEqual(tpanel().active, 'CLOCK');
  assert.strictEqual(tpanel().clocks.timers[0].display, '00:00:01');
  assert.strictEqual(tpanel().clocks.stopwatches[0].name, 'Stopwatch 1');
  tp.clockManager.timers[0].lastUpdate -= 2;
  rl.configManager.setConfiguration('timetracking', 'timerNotification', true);
  tp.clockManager.checkCompletion();
  assert.ok(!tp.clockManager.timers[0].active); assert.strictEqual(notes.pop(), '[Timer 1] has finished counting down.');
  rl.notifier.notify = realNotify;
  tp.onPanelAction({ action: 'tab', tab: 'ALLOTMENT' });
  const rows = tpanel().patches;
  const fnw = rows.find((r) => r.title === 'Falador (North West)');
  assert.ok(fnw && fnw.icon === 1942 && /^Done in /.test(fnw.estimate), JSON.stringify(fnw));
  // every patch is read (global 2007 varbits): Catherby's empty allotment is fully grown weeds, no bar
  assert.strictEqual(rows.find((r) => r.title === 'Catherby (North)').progress, null);
  tp.onPanelAction({ action: 'tab', tab: 'OVERVIEW' });
  assert.deepStrictEqual(tpanel().overview.map((o) => o.title).slice(0, 4), ['Timers', 'Stopwatches', 'Herb Patches', 'Tree Patches']);
  ll.pluginConfig({ id: 'timetracking', enabled: false, config: {} });
  console.log('time tracking clone: ok');
}

// ---- Mining: the session from the swing message, a rock respawn when a rock turns into its depleted loc (2007's stand-in
// for ADD_OVERLAYTIMER_LOC, with the server's ticks)
{
  for (const f of ['plugins/mining/rocks.js', 'plugins/mining/page.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  const miItems = require('../src/plugins/mining/descriptor').config.items;
  assert.deepStrictEqual([...ll.__mining.MiningAnimation.MINING_ANIMATIONS].sort(), [624, 625, 626, 627, 628, 629], 'bronze .. rune pickaxes');
  assert.strictEqual(JSON.stringify(ll.miningRocks.ROCK_RESPAWNS[2090]), '[450,10]', 'copper rock (2007 copperrock1) -> rocks1, 10 ticks');
  ll.pluginConfig({ id: 'mining', enabled: true, config: { __items: miItems } });
  locEvs = [{ k: 2, level: 0, sx: 30, sz: 30, wx: 3230, wz: 3230, id: 2090, tag: 501n, shape: 10, angle: 0, spawned: true }]; step();
  const mp = ll.__mining.plugin;
  core.chat({ type: 0, text: 'You swing your pick at the rock.', time: Date.now() }); step();
  assert.ok(mp.getSession() && mp.getSession().getLastMined(), 'the swing message starts the session');
  locEvs = [
    { k: 2, level: 0, sx: 30, sz: 30, wx: 3230, wz: 3230, id: 2090, tag: 501n, spawned: false },
    { k: 2, level: 0, sx: 30, sz: 30, wx: 3230, wz: 3230, id: 450, tag: 502n, shape: 10, angle: 0, spawned: true },
  ]; step();
  assert.strictEqual(mp.getRespawns().length, 1, 'a respawn timer');
  assert.strictEqual(mp.getRespawns()[0].getRespawnTime(), 6000);
  assert.strictEqual(mp.getRespawns()[0].getWorldPoint().getX(), 3230);
  ll.pluginConfig({ id: 'mining', enabled: false, config: {} });
  assert.strictEqual(mp.getRespawns().length, 0, 'cleared on shutdown');
  console.log('mining clone: ok');
}
// ---- World Map: RuneLite's points trimmed to the 2007 map, the core's WorldMapOverlay (tooltip, edge snap, focus on click)
{
  for (const f of ['plugins/worldmap/data.js', 'plugins/worldmap/page.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  const wItems = require('../src/plugins/worldmap/descriptor').config.items;
  ll.pluginConfig({ id: 'worldmap', enabled: true, config: { __items: wItems } });
  const pts = () => rl.worldMapPointManager.getWorldMapPoints();
  const W = ll.__worldmap;
  const byTip = (t) => pts().find((p) => p.getTooltip() === t);
  assert.ok(byTip('Varrock - lvl 25'), 'standard spellbook teleport');
  assert.ok(byTip('Jewellery -  Ring of Dueling - Duel Arena') || pts().some((p) => /Ring of Dueling - Duel Arena/.test(p.getTooltip() || '')), 'its 2007 name');
  assert.ok(!pts().some((p) => /Arceuus|Varrock GE|Kourend|Pandemonium|Redwood|Amethyst|Rat Pits/.test(p.getTooltip() || '')), 'nothing later than Sept 2007');
  assert.ok(pts().some((p) => p.getType() === W.MapPoint.Type.FAIRY_RING && /^Fairy Ring - [A-D][I-L][P-S]$/.test(p.getTooltip())), 'fairy rings');
  const n = pts().length;
  // config: tooltips off removes that kind
  rl.configManager.setConfiguration('worldmap', 'dungeonTooltips', false);
  W.plugin.onConfigChanged({ getGroup: () => 'worldmap' });
  assert.ok(pts().length < n && !pts().some((p) => p.getType() === 'DUNGEON'), 'dungeon tooltips off');
  rl.configManager.setConfiguration('worldmap', 'dungeonTooltips', true);
  W.plugin.onConfigChanged({ getGroup: () => 'worldmap' });
  assert.strictEqual(pts().length, n);
  // the overlay on a mock map: 4 px per tile centred on (3213, 3424)
  const focus = [];
  const map = { width: 500, height: 300, mouse: { x: 250, y: 150 }, toScreen: (x, y) => ({ x: 250 + (x - 3213) * 4 + 2, y: 150 - (y - 3424) * 4 + 2 }), surfaceContains: (x, y) => y < 4096 };
  window.__lostliteWorldMap = { zoom: () => 4, position: () => ({ x: 3213, y: 3424 }), setPositionTarget: (x, y) => focus.push([x, y]), surfaceContains: map.surfaceContains, isOpen: () => true, isLoaded: () => true };
  const drawn = [];
  const c2d = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (t) => ({ width: String(t).length * 6 }) : k === 'fillText' ? (t, x, y) => drawn.push([t, x, y]) : () => {}), set: () => true });
  rl.worldMapOverlay.renderOnMap(c2d, map);
  assert.ok(drawn.some((d) => d[0] === 'Varrock - lvl 25'), 'tooltip under the mouse: ' + JSON.stringify(drawn.slice(0, 3)));
  // a jump-on-click transport: a click focuses on its target
  const ship = pts().find((p) => p.isJumpOnClick() && p.getTarget());
  const sp = ship.getWorldPoint();
  map.toScreen = (x, y) => ({ x: 250 + (x - sp.x) * 4 + 2, y: 150 - (y - sp.y) * 4 + 2 });
  map.mouse = map.toScreen(sp.x, sp.y);
  rl.worldMapOverlay.renderOnMap(c2d, map);
  assert.ok(rl.worldMapOverlay.onMapClick(), 'click on a transport');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(focus.pop())), [ship.getTarget().x, ship.getTarget().y], 'focus on its target');
  // edge snapping (the Clue Scroll's point): off the map it snaps to the edge and calls onEdgeSnap
  const snaps = [];
  const far = new rl.WorldMapPoint(new rl.WorldPoint(3400, 3424, 0), { getWidth: () => 10, getHeight: () => 10 });
  far.setSnapToEdge(true); far.onEdgeSnap = () => snaps.push('snap'); far.onEdgeUnsnap = () => snaps.push('unsnap');
  rl.worldMapPointManager.add(far);
  rl.worldMapOverlay.renderOnMap(c2d, map);
  map.toScreen = (x, y) => ({ x: 250 + (x - 3390) * 4, y: 150 - (y - 3424) * 4 });
  rl.worldMapOverlay.renderOnMap(c2d, map);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(snaps)), ['snap', 'unsnap']);
  rl.worldMapPointManager.remove(far);
  delete window.__lostliteWorldMap;
  ll.pluginConfig({ id: 'worldmap', enabled: false, config: {} });
  assert.strictEqual(pts().length, 0, 'shut down removes its points');
  console.log('world map clone: ok');
}
// ---- World Hopper: the core's WorldService (our server's list), the panel rows, favourites, ::hop, pings
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/worldhopper/page.js'), 'utf8'), ctx);
  const wItems = require('../src/plugins/worldhopper/descriptor').config.items;
  const msgs = [];
  const oldGameMessage = ll.gameMessage;
  ll.gameMessage = (t) => msgs.push(t);
  ll.api.world = () => 1;
  core.configure({ worlds: [{ id: 1, types: ['MEMBERS'], address: 'localhost:8888', activity: '-', location: -1, region: null }] });
  assert.strictEqual(rl.worldService.getWorlds().findWorld(1).getAddress(), 'localhost:8888');
  assert.strictEqual(rl.client.getWorld(), 1);
  posted.length = 0;
  ll.pluginConfig({ id: 'worldhopper', enabled: true, config: { __items: wItems } });
  const state = () => posted.filter((m) => m.type === 'plugin-state' && m.data.id === 'worldhopper').pop().data.state;
  assert.deepStrictEqual(JSON.parse(JSON.stringify(state().rows.map((r) => [r.id, r.types, r.players, r.favorite]))), [[1, ['MEMBERS'], null, false]]);
  // a ping goes to the app and its answer comes back to the row
  const ping = posted.find((m) => m.type === 'rl-ping');
  assert.ok(ping && ping.data.id === 1, 'pinged world 1');
  // the filters: free worlds only hides our members world
  ll.pluginConfig({ id: 'worldhopper', enabled: true, config: { subscriptionFilter: 'FREE' } });
  assert.strictEqual(state().rows.length, 0);
  ll.pluginConfig({ id: 'worldhopper', enabled: true, config: { subscriptionFilter: 'BOTH' } });
  // favourites (favorite_<world>) from the panel
  const wp = ll.pagePlugins.get('worldhopper');
  wp.impl.panel({ action: 'favorite', id: 1, add: true });
  assert.ok(posted.some((m) => m.type === 'rl-config' && m.data.key === 'favorite_1' && m.data.value === true));
  assert.strictEqual(state().rows[0].favorite, true);
  // ::hop: taken from the server; usage, unknown world, the current world
  assert.strictEqual(ll.chatCommand('::hop x'), true);
  assert.strictEqual(ll.chatCommand('::hop 5'), true);
  assert.strictEqual(ll.chatCommand('::tele 0,50,50'), false, 'other commands go to the server');
  assert.deepStrictEqual(msgs.slice(-2), ['Usage: ::hop world', 'Unknown world 5']);
  ll.pluginConfig({ id: 'worldhopper', enabled: false, config: {} });
  ll.gameMessage = oldGameMessage;
  console.log('world hopper clone: ok');
}
// ---- Bank: qty value searches through the bankSearchFilter callback (no prices), Deposit inventory left-click
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/bank/page.js'), 'utf8'), ctx);
  const bItems = require('../src/plugins/bank/descriptor').config.items;
  ll.pluginConfig({ id: 'bank', enabled: true, config: { __items: bItems } });
  const B = ll.bankTest;
  const oldInv = rl.client.getItemContainer;
  rl.client.getItemContainer = (id) => (id === 95 ? { getItems: () => [{ getId: () => 995, getQuantity: () => 5000 }, { getId: () => 1925, getQuantity: () => 3 }] } : null);
  assert.strictEqual(B.parseQuantity('1.5k'), 1500);
  assert.strictEqual(ll.bankSearchFilter(995, 'qty>1k'), true);
  assert.strictEqual(ll.bankSearchFilter(1925, 'qty>1k'), false);
  assert.strictEqual(ll.bankSearchFilter(1925, 'qty 1-5'), true);
  assert.strictEqual(ll.bankSearchFilter(995, 'ge>1'), false, 'no value searches while prices are off');
  assert.strictEqual(ll.bankSearchFilter(995, 'coins'), false);
  // Disable left-click bank inventory: MenuEntryAdded then MenuShouldLeftClick forces the menu
  ll.pluginConfig({ id: 'bank', enabled: true, config: { rightClickBankInventory: true } });
  B.plugin.onMenuEntryAdded({ getOption: () => 'Deposit inventory', getTarget: () => '' });
  const oldEntries = rl.client.getMenuEntries;
  rl.client.getMenuEntries = () => [{ getOption: () => 'Deposit inventory', getTarget: () => '' }];
  let forced = false;
  B.plugin.onMenuShouldLeftClick({ setForceRightClick: (b) => { forced = b; } });
  assert.strictEqual(forced, true);
  rl.client.getMenuEntries = oldEntries;
  rl.client.getItemContainer = oldInv;
  ll.pluginConfig({ id: 'bank', enabled: false, config: {} });
  console.log('bank clone: ok');
}

// ---- Woodcutting: the session from the log message, a tree respawn when a tree turns into its stump (2007's stand-in
// for ADD_OVERLAYTIMER_LOC), ended when the stump turns back
{
  for (const f of ['plugins/woodcutting/trees.js', 'plugins/woodcutting/page.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  const wcItems = require('../src/plugins/woodcutting/descriptor').config.items;
  assert.ok(ll.__woodcutting.WOODCUTTING_ANIMS.has(879) && ll.__woodcutting.WOODCUTTING_ANIMS.has(867), 'bronze .. rune axes');
  const oak = Object.keys(ll.woodcuttingTrees.TREE_RESPAWNS).find((k) => ll.woodcuttingTrees.TREE_RESPAWNS[k][1] === 30);
  assert.ok(oak, 'an oak-like tree at 30 ticks');
  const [stump] = ll.woodcuttingTrees.TREE_RESPAWNS[oak];
  ll.pluginConfig({ id: 'woodcutting', enabled: true, config: { __items: wcItems } });
  locEvs = [{ k: 2, level: 0, sx: 30, sz: 32, wx: 3230, wz: 3232, id: +oak, tag: 601n, shape: 10, angle: 0, spawned: true }]; step();
  const wp = ll.__woodcutting.plugin;
  core.chat({ type: 0, text: 'You get some oak logs.', time: Date.now() }); step();
  assert.strictEqual(wp.getSession().getLogsCut(), 1, 'the log message counts');
  locEvs = [
    { k: 2, level: 0, sx: 30, sz: 32, wx: 3230, wz: 3232, id: +oak, tag: 601n, spawned: false },
    { k: 2, level: 0, sx: 30, sz: 32, wx: 3230, wz: 3232, id: stump, tag: 602n, shape: 10, angle: 0, spawned: true },
  ]; step();
  assert.strictEqual(wp.getRespawns().length, 1, 'a respawn timer');
  assert.strictEqual(wp.getRespawns()[0].getRespawnTime(), 18000);
  locEvs = [{ k: 2, level: 0, sx: 30, sz: 32, wx: 3230, wz: 3232, id: stump, tag: 602n, spawned: false }]; step();
  assert.strictEqual(wp.getRespawns().length, 0, 'the stump turned back');
  ll.pluginConfig({ id: 'woodcutting', enabled: false, config: {} });
  console.log('woodcutting clone: ok');
}

// ---- Cooking: cooked / burnt from the messages, the wine ferment timer from 2007's wine message
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/cooking/page.js'), 'utf8'), ctx);
  const ckItems = require('../src/plugins/cooking/descriptor').config.items;
  ll.pluginConfig({ id: 'cooking', enabled: true, config: { __items: ckItems } });
  const cp = ll.__cooking.plugin;
  core.chat({ type: 0, text: 'You successfully cook a lobster.', time: Date.now() }); step();
  core.chat({ type: 0, text: 'You accidentally burn the shrimps.', time: Date.now() }); step();
  core.chat({ type: 0, text: 'You successfully cook some shrimps.', time: Date.now() }); step();
  assert.strictEqual(cp.getSession().getCookAmount(), 2);
  assert.strictEqual(cp.getSession().getBurnAmount(), 1);
  core.chat({ type: 0, text: 'You squeeze the grapes into the jug. The wine begins to ferment.', time: Date.now() }); step();
  const ft = rl.infoBoxManager.getInfoBoxes().find((b) => b instanceof ll.__cooking.FermentTimer);
  assert.ok(ft && Number(ft.getText()) >= 11 && Number(ft.getText()) <= 12, 'a 12 s ferment timer');
  ll.pluginConfig({ id: 'cooking', enabled: false, config: {} });
  assert.ok(!rl.infoBoxManager.getInfoBoxes().some((b) => b instanceof ll.__cooking.FermentTimer), 'removed on shutdown');
  console.log('cooking clone: ok');
}

// ---- Ammo: the worn ammo (or a stackable weapon) as a counter infobox
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/ammo/page.js'), 'utf8'), ctx);
  ITEMS[882] = { name: 'Bronze arrow', cost: 1, stackable: true };
  const realRead = ll.readContainer;
  const worn = new Array(14).fill(null);
  ll.readContainer = (id) => (id === 94 ? worn.slice() : realRead(id));
  ll.pluginConfig({ id: 'ammo', enabled: true, config: { __items: [] } });
  step();
  worn[13] = { id: 882, quantity: 12345 }; step();
  const box = () => rl.infoBoxManager.getInfoBoxes().find((b) => b.constructor.name === 'AmmoCounter');
  assert.ok(box(), 'an ammo counter');
  assert.strictEqual(box().getText(), '12.3K');
  assert.strictEqual(box().getTooltip(), 'Bronze arrow');
  worn[13] = null; step();
  assert.ok(!box(), 'removed when unequipped');
  ll.pluginConfig({ id: 'ammo', enabled: false, config: {} });
  ll.readContainer = realRead;
  console.log('ammo clone: ok');
}
// ---- A-M batch 28: Barbarian Assault, Blast Furnace, Boss Timers, Cannon
{
  for (const f of ['plugins/runelite/corea.js', 'plugins/barbarianassault/page.js', 'plugins/blastfurnace/page.js', 'plugins/bosstimer/page.js', 'plugins/cannon/page.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  const items = (id) => require(`../src/plugins/${id}/descriptor`).config.items;
  const msgs = [];
  const realGameMessage = ll.gameMessage;
  ll.gameMessage = (t) => msgs.push(t);
  // Barbarian Assault: wave timer from the game message, formatting
  const BA = ll.__barbarianassault;
  ll.pluginConfig({ id: 'barbarianassault', enabled: true, config: { __items: items('barbarianassault') } });
  assert.strictEqual(BA.GameTimer.formatTime(65), '1:05');
  assert.strictEqual(BA.GameTimer.formatTime(725), '12:05');
  assert.strictEqual(BA.GameTimer.formatTime(3725), '01:02');
  core.chat({ type: 0, text: '---- Wave: 1 ----', time: Date.now() }); step();
  assert.ok(BA.plugin.gameTime, 'game timer started on wave 1');
  BA.plugin.announceTime('Wave 1 duration: ', '1:05');
  assert.strictEqual(msgs.pop(), 'Wave 1 duration: 1:05');
  ll.pluginConfig({ id: 'barbarianassault', enabled: false, config: {} });
  assert.strictEqual(BA.plugin.gameTime, null);
  // Boss Timers: a dying KBD starts a 9 s respawn timer
  ll.pluginConfig({ id: 'bosstimer', enabled: true, config: { __items: [] } });
  const kbd = Object.assign({}, goblin, { index: 9, typecode: 0x20000000 + (9 << 14), id: 50, name: 'King Black Dragon', health: 0, totalHealth: 240 });
  ll.readNpcs = () => [kbd]; step();
  ll.readNpcs = () => []; step();
  const rt = rl.infoBoxManager.getInfoBoxes().find((b) => b instanceof ll.__bosstimer.RespawnTimer);
  assert.ok(rt, 'a respawn timer');
  assert.strictEqual(rt.getTooltip(), 'King Black Dragon');
  assert.ok(rt.left() > 8000 && rt.left() <= 9000);
  ll.pluginConfig({ id: 'bosstimer', enabled: false, config: {} });
  assert.ok(!rl.infoBoxManager.getInfoBoxes().some((b) => b instanceof ll.__bosstimer.RespawnTimer), 'removed on shutdown');
  // Cannon: the varps, the counter, notifications
  const vps = new Int32Array(1000); Object.assign(ll.fields, { varps: 'vps' }); ll.client.vps = vps;
  ll.pluginConfig({ id: 'cannon', enabled: true, config: { __items: items('cannon'), showInfobox: true, lowWarningThreshold: 10 } });
  const cp = ll.__cannon.plugin;
  vps[4] = (3200 << 14) | 3200; vps[2] = 4; vps[3] = 30; step();
  assert.strictEqual(cp.isCannonPlaced(), true);
  assert.strictEqual(cp.getCannonPosition().getX(), 3200);
  const cb = () => rl.infoBoxManager.getInfoBoxes().find((b) => b instanceof ll.__cannon.CannonCounter);
  assert.ok(cb(), 'cannonball infobox');
  assert.strictEqual(cb().getText(), '30');
  assert.strictEqual(cb().getTextColor(), rl.Color.GREEN);
  const n0 = posted.filter((m) => m.type === 'rl-notify').length;
  vps[3] = 8; step();
  assert.strictEqual(cb().getTextColor(), rl.Color.ORANGE);
  assert.strictEqual(posted.filter((m) => m.type === 'rl-notify').length, n0 + 1, 'low warning');
  vps[2] = 0; step();
  assert.ok(!cb(), 'counter gone when the cannon is picked up');
  assert.ok(ll.__cannon.cannonSpots.every((p) => !(p.getX() < 1800 && p.getY() < 4000)), 'no Kourend spots');
  ll.pluginConfig({ id: 'cannon', enabled: false, config: {} });
  // Blast Furnace: the foreman's ten minutes from the NPC dialogue
  ll.pluginConfig({ id: 'blastfurnace', enabled: true, config: { __items: items('blastfurnace') } });
  const realGetWidget = rl.client.getWidget;
  const text = 'Okay, you can use the furnace for ten minutes. Remember,<br>you only need half as much coal as with a regular furnace.';
  rl.client.getWidget = (g, c) => (g === 242 ? { isHidden: () => false, getText: () => (c === 2 ? text.split('<br>')[0] : text.split('<br>')[1]) } : null);
  step();
  rl.client.getWidget = realGetWidget;
  const ft = rl.infoBoxManager.getInfoBoxes().find((b) => b instanceof ll.__blastfurnace.ForemanTimer);
  assert.ok(ft, 'foreman timer');
  assert.strictEqual(ft.getTooltip(), 'Foreman Fee');
  ll.pluginConfig({ id: 'blastfurnace', enabled: false, config: {} });
  assert.ok(!rl.infoBoxManager.getInfoBoxes().some((b) => b instanceof ll.__blastfurnace.ForemanTimer));
  ll.gameMessage = realGameMessage;
  console.log('barbarian assault / blast furnace / boss timers / cannon clones: ok');
}
// ---- A-M batch 29: Examine (no prices), Inventory Viewer, Inventory Grid
{
  for (const f of ['plugins/examine/page.js', 'plugins/inventoryviewer/page.js', 'plugins/inventorygrid/page.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  const items = (id) => require(`../src/plugins/${id}/descriptor`).config.items;
  const realApi = Object.assign({}, ll.api);
  const inv = { screen: [563, 213], width: 4, marginX: 10, marginY: 4, linkObjType: [527, 0, 1966], linkObjNumber: [1, 0, 3] };
  let tab = 3;
  ll.api.com = (p) => (p === (149 << 16) ? inv : (p >>> 16) === 548 ? { hide: (p & 0xffff) - 99 !== tab } : null);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(rl.inventorySlot(149 << 16, 2))), { id: 1965, quantity: 3, bounds: { x: 647, y: 213, width: 32, height: 32 } });
  // Examine: a pending examine is used up by the reply, and prints nothing with prices off
  ll.pluginConfig({ id: 'examine', enabled: true, config: { __items: [] } });
  const ex = ll.__examine.plugin;
  ex.onMenuOptionClicked({ getMenuOption: () => 'Examine', getMenuAction: () => rl.MenuAction.EXAMINE_ITEM_GROUND, getId: () => 1965, isItemOp: () => false });
  assert.strictEqual(ex.pending.length, 1);
  const msgs = []; const realGm = ll.gameMessage; ll.gameMessage = (t) => msgs.push(t);
  ex.onChatMessage({ getType: () => 'GAMEMESSAGE', getMessage: () => 'Yuck, it smells bad.' });
  assert.strictEqual(ex.pending.length, 0);
  assert.strictEqual(msgs.length, 0, 'no price line');
  ll.gameMessage = realGm;
  ll.pluginConfig({ id: 'examine', enabled: false, config: {} });
  // Inventory Viewer: 28 cells, hidden on the inventory tab when set
  ll.pluginConfig({ id: 'inventoryviewer', enabled: true, config: { __items: items('inventoryviewer'), hideIfInventoryActive: true } });
  const iv = ll.__inventoryviewer.plugin;
  assert.strictEqual(iv.overlay.render({}), null, 'hidden on the inventory tab');
  tab = 4;
  let kids = 0; const realRender = rl.OverlayPanel.prototype.render;
  rl.OverlayPanel.prototype.render = function r() { kids = this.panelComponent.getChildren().length; this.panelComponent.getChildren().length = 0; return null; };
  iv.overlay.render({});
  rl.OverlayPanel.prototype.render = realRender;
  assert.strictEqual(kids, 28);
  ll.pluginConfig({ id: 'inventoryviewer', enabled: false, config: {} });
  // Inventory Grid: the 28 slots filled while an item is dragged
  ll.pluginConfig({ id: 'inventorygrid', enabled: true, config: { __items: items('inventorygrid') } });
  const og = ll.__inventorygrid.plugin.overlay;
  Object.assign(ll.client, { dragCom: 149 << 16, dragSlot: 0, dragCycles: 10 });
  const realMouse = rl.client.getMouseCanvasPosition;
  let mouse = [570, 220];
  rl.client.getMouseCanvasPosition = () => new rl.Point(mouse[0], mouse[1]);
  const fills = []; const g = { setColor(c) { this.c = c; }, fill: (b) => fills.push([b.x, b.y, g.c.getAlpha(), g.c.getGreen()]), setComposite() {}, drawImage() {} };
  og.render(g);
  assert.strictEqual(fills.length, 0, 'not until the mouse has moved 5 px');
  mouse = [650, 220]; og.render(g);
  assert.strictEqual(fills.length, 28);
  assert.deepStrictEqual(fills[2], [647, 213, 45, 255], 'the slot under the mouse highlighted');
  ll.client.dragCom = -1; fills.length = 0; og.render(g);
  assert.strictEqual(fills.length, 0);
  rl.client.getMouseCanvasPosition = realMouse;
  ll.pluginConfig({ id: 'inventorygrid', enabled: false, config: {} });
  for (const k of Object.keys(ll.api)) if (!(k in realApi)) delete ll.api[k];
  Object.assign(ll.api, realApi);
  console.log('examine / inventory viewer / inventory grid clones: ok');
}
// ---- A-M batch 30: Implings, Metronome
{
  for (const f of ['plugins/implings/page.js', 'plugins/metronome/page.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  const items = (id) => require(`../src/plugins/${id}/descriptor`).config.items;
  ll.pluginConfig({ id: 'implings', enabled: true, config: { __items: items('implings'), shownature: 'NOTIFY' } });
  const ip = ll.__implings.plugin;
  const npc = (id) => ({ getId: () => id, getName: () => 'x' });
  assert.ok(ip.isTarget(npc(4189)), 'dragon implings highlighted by default');
  assert.strictEqual(ip.isTarget(npc(4180)), null, 'baby off by default');
  assert.strictEqual(ip.isTarget(npc(4196)).highlightColor.getGreen(), 138, 'Puro-Puro nature impling, its colour');
  const n0 = posted.filter((m) => m.type === 'rl-notify').length;
  ip.onNpcSpawned({ getNpc: () => npc(4186) });
  assert.strictEqual(posted.filter((m) => m.type === 'rl-notify').pop().data, 'Nature impling is in the area');
  assert.strictEqual(posted.filter((m) => m.type === 'rl-notify').length, n0 + 1);
  ll.pluginConfig({ id: 'implings', enabled: false, config: {} });
  // Metronome: tick, tock every 2 ticks
  const played = []; const realApi = Object.assign({}, ll.api);
  ll.api.playSound = (id) => played.push(id);
  ll.pluginConfig({ id: 'metronome', enabled: true, config: { __items: items('metronome'), tickCount: 2, tockVolume: 50 } });
  for (let i = 0; i < 4; i++) step();
  assert.deepStrictEqual(played, [1263, 948]);
  ll.pluginConfig({ id: 'metronome', enabled: false, config: {} });
  for (const k of Object.keys(ll.api)) if (!(k in realApi)) delete ll.api[k];
  console.log('implings / metronome clones: ok');
}
// ---- A-M batch 31: Friend List, Friend Notes, Item Identification, Inventory Tags
{
  for (const f of ['plugins/friendlist/page.js', 'plugins/friendnotes/page.js', 'plugins/itemidentification/data.js', 'plugins/itemidentification/page.js', 'plugins/inventorytags/page.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  const items = (id) => require(`../src/plugins/${id}/descriptor`).config.items;
  const realApi = Object.assign({}, ll.api);
  const texts = {};
  let friends = [{ name: 'Zezima', world: 2 }];
  Object.assign(ll.api, { friends: () => friends, ignores: () => [{ name: 'Spammer' }], members: () => true, world: () => 1, setText: (id, t) => { texts[id] = t; } });
  const gw = rl.client.getWidget;
  rl.client.getWidget = ((orig) => (id, c) => { const packed = c === undefined ? id : (id << 16) | c; return { setText: (t) => { texts[packed] = t; }, getText: () => texts[packed] }; })(rl.client.getWidget);
  ll.pluginConfig({ id: 'friendlist', enabled: true, config: { __items: items('friendlist'), showWorldOnLogin: true } });
  step();
  assert.strictEqual(texts[(550 << 16) | 2], 'Friends - W1 (1/200)');
  assert.strictEqual(texts[(551 << 16) | 2], 'Ignores - W1 (1/100)');
  const msg = { type: 5, text: 'Zezima has logged in.', time: Date.now() };
  core.chat(msg);
  assert.strictEqual(msg.replace, 'Zezima has logged in. (World 2)');
  rl.configManager.setConfiguration('friendlist', 'hidenotification_Zezima', true);
  const msg2 = { type: 5, text: 'Zezima has logged out.', time: Date.now() };
  core.chat(msg2);
  assert.strictEqual(msg2.replace, false, 'hidden friend line dropped');
  ll.pluginConfig({ id: 'friendlist', enabled: false, config: {} });
  assert.strictEqual(texts[(550 << 16) | 2], 'Friends List - World 1');
  // Friend Notes: a note set through the chat box input, its tooltip, removed with the friend
  ll.pluginConfig({ id: 'friendnotes', enabled: true, config: { __items: items('friendnotes') } });
  const fn = ll.__friendnotes.plugin;
  fn.setFriendNote('Zezima', 'pker');
  fn.onMenuEntryAdded({ getActionParam1: () => (550 << 16) | 1, getOption: () => 'Message', getTarget: () => '<col=ffffff>Zezima' });
  assert.strictEqual(fn.getHoveredFriend().getNote(), 'pker');
  assert.ok(/Zezima's Notes/.test(ll.__friendnotes.NOTE_PROMPT_FORMAT('Zezima', 128)));
  friends = []; step();
  assert.strictEqual(fn.getFriendNote('Zezima'), null, 'note removed with the friend');
  ll.pluginConfig({ id: 'friendnotes', enabled: false, config: {} });
  // Item Identification: 2007 items only
  const II = ll.__itemidentification.ItemIdentification;
  const guam = (ll.itemIdentificationData.find((r) => r[0] === 'GUAM_SEED') || [])[4];
  assert.ok(guam && II.get(guam[0]).shortName === 'G');
  assert.ok(!ll.itemIdentificationData.some((r) => r[0] === 'REDWOOD_LOG'), 'no redwood (2017)');
  // Inventory Tags: tag json, outline from the icon
  ll.pluginConfig({ id: 'inventorytags', enabled: true, config: { __items: items('inventorytags') } });
  const it = ll.__inventorytags.plugin;
  it.setTag(1351, { color: new rl.Color(255, 0, 0) });
  assert.strictEqual(it.getTag(1351).color.getRGB(), 0xffff0000);
  const icon = { w: 3, h: 3, px: new Uint32Array([0, 0, 0, 0, 0xff00ff00, 0, 0, 0, 0]) };
  const getImage = rl.itemManager.getImage; rl.itemManager.getImage = () => icon;
  const o = rl.itemManager.getItemOutline(1351, 1, new rl.Color(255, 0, 0));
  assert.deepStrictEqual(Array.from(o.px).map((p) => p >>> 0), [0, 0xffff0000, 0, 0xffff0000, 0, 0xffff0000, 0, 0xffff0000, 0]);
  rl.itemManager.getImage = getImage;
  it.unsetTag(1351);
  assert.strictEqual(it.getTag(1351), null);
  ll.pluginConfig({ id: 'inventorytags', enabled: false, config: {} });
  rl.client.getWidget = gw;
  for (const k of Object.keys(ll.api)) if (!(k in realApi)) delete ll.api[k];
  Object.assign(ll.api, realApi);
  console.log('friend list / friend notes / item identification / inventory tags clones: ok');
}
// ---- A-M batch 32: Minimap (dots, hide, zoom)
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/minimap/page.js'), 'utf8'), ctx);
  const realApi = Object.assign({}, ll.api);
  const dots = {}; let zoom = 4; const hidden = {};
  Object.assign(ll.api, { mapDotCount: () => 5, mapDot: (i, px, w, h) => { dots[i] = px ? [px, w, h] : null; return true; }, minimapZoom: (z) => { if (z) zoom = z; return zoom; }, setHidden: (id, h) => { hidden[id] = h; } });
  ll.pluginConfig({ id: 'minimap', enabled: true, config: { __items: require('../src/plugins/minimap/descriptor').config.items, npc: '#FF0000', hideMinimap: true, zoomLevel: 6 } });
  assert.deepStrictEqual(dots[1], [ll.__minimap.MinimapDot.createPixels(new rl.Color(255, 0, 0)), 4, 5]);
  assert.strictEqual(dots[0], undefined, 'no colour set: the client dot stays');
  assert.strictEqual(zoom, 6);
  rl.client.setMinimapZoom(20); assert.strictEqual(zoom, 8, 'clamped');
  ll.pluginConfig({ id: 'minimap', enabled: false, config: {} });
  assert.strictEqual(dots[1], null, 'restored'); assert.strictEqual(zoom, 4);
  for (const k of Object.keys(ll.api)) if (!(k in realApi)) delete ll.api[k];
  Object.assign(ll.api, realApi);
  console.log('minimap clone: ok');
}
// ---- A-M batch 33: Chat History, Key Remapping, Music
{
  for (const f of ['chathistory', 'keyremapping', 'music']) vm.runInContext(fs.readFileSync(path.join(root, `plugins/${f}/page.js`), 'utf8'), ctx);
  const realApi = Object.assign({}, ll.api);
  const added = []; const removed = []; const varcs = { 1: 'abc', 22: 'hi', 23: 'Bob' }; let varc5 = 0;
  Object.assign(ll.api, { addChatQuiet: (...a) => added.push(a), removeChat: (t) => { removed.push(t); return 1; }, varcStr: (i, v) => { if (v !== undefined) varcs[i] = v; return varcs[i]; },
    varc: (i) => (i === 5 ? varc5 : 0), ifOpen: (g) => g === 137, com: () => ({ hide: false, text: 'Giidle1test1: <col=0000ff>*' }) });
  // Chat History: messages queued, put back after the welcome message without events, cleared per tab
  ll.pluginConfig({ id: 'chathistory', enabled: true, config: { __items: require('../src/plugins/chathistory/descriptor').config.items } });
  const ch = ll.__chathistory.plugin;
  const node = (type, name, value, sender) => ({ getType: () => type, getName: () => name, getValue: () => value, getSender: () => sender, getCrown: () => 0 });
  const msg = (type, name, value, sender) => ({ getType: () => type, getName: () => name, getMessage: () => value, getMessageNode: () => node(type, name, value, sender) });
  ch.onChatMessage(msg('PUBLICCHAT', 'Zezima', 'hello', null));
  ch.onChatMessage(msg('PRIVATECHAT', 'Bob', 'hey', null));
  ch.onChatMessage(msg('PRIVATECHAT', 'Alice', 'yo', null));
  ch.onChatMessage(msg('GAMEMESSAGE', '', 'You chop a tree.', null));
  assert.strictEqual([...ch.messageQueue].length, 3, 'game messages are not kept');
  const qm = ctx.queueMicrotask; ctx.queueMicrotask = (f) => f();
  ch.onChatMessage(msg('GAMEMESSAGE', '', 'Welcome to 2006RS.', null));
  ctx.queueMicrotask = qm;
  assert.deepStrictEqual(added.map((a) => [a[0], a[1], a[2]]), [[2, 'hello', 'Zezima'], [3, 'hey', 'Bob'], [3, 'yo', 'Alice']]);
  assert.strictEqual(ch.findPreviousFriend(), 'Alice', 'Bob -> the one before him, wrapping to the newest');
  varc5 = 6; ch.keyPressed({ keyCode: 9, preventDefault() {} });
  assert.strictEqual(varcs[23], 'Alice'); assert.strictEqual(varcs[22], 'hi', 'the typed PM text stays');
  ch.clearChatboxHistory(ll.__chathistory.ChatboxTab.PRIVATE);
  assert.strictEqual([...ch.messageQueue].length, 1); assert.strictEqual(JSON.stringify(removed[0]), '[3,6,7,5]');
  ll.pluginConfig({ id: 'chathistory', enabled: false, config: {} });
  // Key Remapping: W is the up arrow while not typing; Enter starts typing; typed characters are blocked until then
  varc5 = 0;
  ll.pluginConfig({ id: 'keyremapping', enabled: true, config: { __items: require('../src/plugins/keyremapping/descriptor').config.items } });
  const kr = ll.__keyremapping.plugin;
  assert.strictEqual(varcs[1], '', 'typed text cleared');
  const kev = (code, key, kc) => { let keyCode = kc; return { code, key, get keyCode() { return keyCode; }, getKeyCode: () => keyCode, getKeyChar: () => (key.length === 1 ? key : null), setKeyCode(c) { keyCode = c; }, setKeyChar() {}, consume() { this.consumed = true; } }; };
  const w = kev('KeyW', 'w', 87); kr.inputListener.keyPressed(w); assert.strictEqual(w.keyCode, 38);
  const t = kev('KeyW', 'w', 0); kr.inputListener.keyTyped(t); assert.ok(t.consumed, 'remapped char blocked');
  const up = kev('KeyW', 'w', 87); kr.inputListener.keyReleased(up); assert.strictEqual(up.keyCode, 38);
  const h = kev('KeyH', 'h', 0); kr.inputListener.keyTyped(h); assert.ok(h.consumed, 'not typing: no chat input');
  kr.inputListener.keyPressed(kev('Enter', 'Enter', 13)); assert.strictEqual(kr.isTyping(), true);
  const w2 = kev('KeyW', 'w', 87); kr.inputListener.keyPressed(w2); assert.strictEqual(w2.keyCode, 87, 'typing: W is W');
  ll.pluginConfig({ id: 'keyremapping', enabled: false, config: {} });
  // Music: area sounds by source, prayer sounds
  ll.pluginConfig({ id: 'music', enabled: true, config: { __items: require('../src/plugins/music/descriptor').config.items, muteOtherAreaNPCSounds: true, mutePrayerSounds: true } });
  assert.strictEqual(ll.onSound('area', 100, 'npc', 1), false);
  assert.strictEqual(ll.onSound('area', 100, 'local', -1), true);
  assert.strictEqual(ll.onSound('effect', 2690, null, -1), false, 'thick skin');
  assert.strictEqual(ll.onSound('effect', 446, null, -1), true);
  ll.pluginConfig({ id: 'music', enabled: false, config: {} });
  for (const k of Object.keys(ll.api)) if (!(k in realApi)) delete ll.api[k];
  Object.assign(ll.api, realApi);
  console.log('chat history / key remapping / music clones: ok');
}
// ---- A-M batch 34: Fairy Rings (code screen 426, travel log 620)
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/fairyring/page.js'), 'utf8'), ctx);
  const realApi = Object.assign({}, ll.api); const realVarps = rl.client.getVarps; const realGetWidget = rl.client.getWidget;
  const texts = {}; const hidden = {}; const pos = {};
  const coms = { [(426 << 16) | 30]: { type: 4, text: 'Teleport to this location', buttonText: 'Teleport to this location' } };
  for (let n = 0; n < 3; n++) { coms[(620 << 16) | (3 + n * 12)] = { type: 0, hide: false, x: 0, y: n * 42 }; coms[(620 << 16) | (3 + n * 12 + 9)] = { type: 4, text: ['AIQ', 'BKS', 'DKR'][n] }; }
  Object.assign(ll.api, { ifOpen: (g) => g === 426 || g === 620, com: (id) => coms[id] || null });
  const widget = (id) => ({ getId: () => id, isHidden: () => !!hidden[id], getText: () => texts[id] || (coms[id] || {}).text || '', setText(t) { texts[id] = t; },
    setHidden(h) { hidden[id] = h; }, setOriginalX() { return this; }, setOriginalY(y) { pos[id] = y; return this; }, revalidate() {}, getHeight: () => 42, getCanvasLocation: () => ({ getX: () => 0, getY: () => 0 }) });
  rl.client.getWidget = (g, c) => widget(c === undefined ? g : (g << 16) | c);
  let varp = 0; rl.client.getVarps = () => { const v = []; v[777] = varp; return v; };
  ll.pluginConfig({ id: 'fairyring', enabled: true, config: { __items: [] } });
  const fr = ll.__fairyring.plugin;
  // AIP (0,0,0) leads nowhere; BKS: B = 3, K = 2, S = 1
  texts[(426 << 16) | 30] = ''; fr.setWidgetTextToDestination(); assert.strictEqual(texts[(426 << 16) | 30], 'Invalid location');
  varp = 3 | (2 << 3) | (1 << 6); fr.setWidgetTextToDestination(); assert.strictEqual(texts[(426 << 16) | 30], 'Zanaris');
  assert.strictEqual(fr.slotCode(fr.slotOf((620 << 16) | (3 + 12 + 2))), 'BKS');
  fr.setConfigTags('DKR', 'home,bank');
  fr.filterSlots('bank');
  assert.ok(hidden[(620 << 16) | 3] && hidden[(620 << 16) | 15] && !hidden[(620 << 16) | 27]); assert.strictEqual(pos[(620 << 16) | 27], 0, 'closed up');
  fr.restoreSlots(); assert.strictEqual(pos[(620 << 16) | 27], 84);
  ll.pluginConfig({ id: 'fairyring', enabled: false, config: {} });
  rl.client.getVarps = realVarps; rl.client.getWidget = realGetWidget;
  for (const k of Object.keys(ll.api)) if (!(k in realApi)) delete ll.api[k];
  Object.assign(ll.api, realApi);
  console.log('fairy rings clone: ok');
}
// ---- Tears of Guthix (streams by decorative object) and Kingdom of Miscellania (estimates, counter)
{
  for (const f of ['plugins/tearsofguthix/page.js', 'plugins/kingdomofmiscellania/page.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  const tItems = require('../src/plugins/tearsofguthix/descriptor').config.items;
  ll.pluginConfig({ id: 'tearsofguthix', enabled: true, config: { __items: tItems } });
  const tog = ll.pagePlugins.get('tearsofguthix');
  assert.ok(tog, 'tears registered');
  const kItems = require('../src/plugins/kingdomofmiscellania/descriptor').config.items;
  ll.pluginConfig({ id: 'kingdomofmiscellania', enabled: true, config: { __items: kItems } });
  const K = ll.kingdomTest;
  const day = 86400000;
  // 3 days at the base rate: coffer 1M -> 950k, 900k, 850k; approval 127 - trunc(3 * 0.025 * 127) = 118
  assert.strictEqual(K.plugin.estimateCoffer(Date.now() - 3 * day, 1000000), 850000);
  assert.strictEqual(K.plugin.estimateApproval(Date.now() - 3 * day, 127), 118);
  assert.strictEqual(K.plugin.estimateCoffer(Date.now() - 2 * day, 100000), 81000, 'under the threshold a tenth goes each day');
  ll.pluginConfig({ id: 'tearsofguthix', enabled: false, config: {} });
  ll.pluginConfig({ id: 'kingdomofmiscellania', enabled: false, config: {} });
  console.log('tears of guthix / kingdom clones: ok');
}

// ---- core: display-only widget writes (Widget.setText / setHidden / setTextColor) go to the client hooks
{
  const calls = [];
  const realApi = Object.assign({}, ll.api);
  Object.assign(ll.api, { com: () => ({ text: 'Combat Lvl: 3', colour: 0xff981f, x: 1, y: 2, width: 10, height: 10, ox: 5, oy: 6 }),
    setText: (p, t) => calls.push(['text', p, t]), setHidden: (p, h) => calls.push(['hide', p, h]), setColour: (p, c) => calls.push(['colour', p, c]),
    setPosition: (p, x, y) => calls.push(['pos', p, x, y]) });
  const w = rl.client.getWidget(90, 3);
  w.setText('Combat Lvl: 3.4'); w.setHidden(true); w.setTextColor(0xffffff); w.setOriginalX(9); w.revalidate();
  assert.strictEqual(JSON.stringify(calls), JSON.stringify([['text', (90 << 16) | 3, 'Combat Lvl: 3.4'], ['hide', (90 << 16) | 3, true], ['colour', (90 << 16) | 3, 0xffffff], ['pos', (90 << 16) | 3, 9, 6]]));
  assert.strictEqual(w.getOriginalY(), 6);
  for (const k of ['com', 'setText', 'setHidden', 'setColour', 'setPosition']) { if (realApi[k]) ll.api[k] = realApi[k]; else delete ll.api[k]; }
  console.log('core widget writes: ok');
}
// ---- Login Screen: sync username (remembered on login, filled on the login box), fire, custom background
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/loginscreen/page.js'), 'utf8'), ctx);
  const L = { index: -1, field: 0, user: '', fire: true, back: 'none' };
  Object.assign(ll.api, { loginIndex: () => L.index, loginField: () => L.field, loginUsername: () => L.user, setLoginUsername: (u) => { L.user = u; },
    loginFire: (on) => { L.fire = on; }, loginBackground: (rgb) => { L.back = rgb ? rgb.length : null; } });
  const lItems = require('../src/plugins/loginscreen/descriptor').config.items;
  const core = ll.pagePlugins.get('runelite').impl;
  const wasIn = ll.loggedIn;
  L.user = 'Tester'; step(); // logged in already: remembered
  ll.pluginConfig({ id: 'loginscreen', enabled: true, config: { __items: lItems, showLoginFire: false } });
  assert.strictEqual(L.fire, false, 'Display fire off');
  assert.strictEqual(L.back, null, 'Background Off restores the cache background');
  ll.loggedIn = true; step(); ll.loggedIn = false; core.title();
  ll.loggedIn = true; L.user = 'Tester'; step();
  assert.strictEqual(rl.configManager.getConfiguration('loginscreen', 'username'), 'Tester', 'username synced on log in');
  ll.loggedIn = false; L.user = ''; L.index = 0; core.title();
  L.index = 2; core.title();
  assert.strictEqual(L.user, 'Tester', 'the login box gets the remembered username');
  ll.pluginConfig({ id: 'loginscreen', enabled: false, config: {} });
  assert.strictEqual(L.fire, true, 'fire back on shutdown');
  ll.loggedIn = wasIn; L.index = -1; step();
  console.log('login screen clone: ok');
}
// ---- Login Screen's 2007RS section (the user's own Remember username / password, Hide username, kept by request):
// the password IPC only answers the game page and only while "Remember password" is ticked; unticking deletes it
{
  const { loginPasswordHandlers } = require('../src/main/loginPassword');
  let stored = ''; let ticked = false; let enabled = true;
  const game = { id: 'game' }; const other = { id: 'chrome' };
  const secrets = { getPassword: () => stored, setPassword: (p) => { stored = p; return true; }, clear: () => { stored = ''; return true; } };
  const h = loginPasswordHandlers({ secrets, isGamePage: (s) => s === game, enabled: () => enabled, ticked: () => ticked });
  h.set({ sender: game }, 'secret1');
  assert.strictEqual(stored, '', 'not stored while Remember password is unticked');
  ticked = true;
  assert.strictEqual(h.set({ sender: other }, 'secret1'), false, 'only the game page may store it');
  assert.strictEqual(stored, '');
  assert.strictEqual(h.set({ sender: game }, 'secret1'), true);
  assert.strictEqual(stored, 'secret1', 'stored while ticked');
  assert.strictEqual(h.get({ sender: other }), '', 'only the game page may read it');
  assert.strictEqual(h.get({ sender: game }), 'secret1');
  enabled = false;
  assert.strictEqual(h.get({ sender: game }), '', 'not given out while the plugin is off');
  enabled = true; ticked = false;
  assert.strictEqual(h.get({ sender: game }), '', 'not given out while unticked');
  h.configChanged({ group: 'loginscreen', key: 'rememberPassword', value: false });
  assert.strictEqual(stored, '', 'unticking deletes it straight away');
  // the runtime fills only empty fields, so Sync username (which also fills only an empty one) never fights it
  const savedFields = ll.fields; const box = { loginScreen: 0, loginUser: '', loginPass: '' };
  ll.fields = Object.assign({}, savedFields, { loginScreen: 'loginScreen', loginUser: 'loginUser', loginPass: 'loginPass' });
  runtimeCommand.call(ll, { type: 'login-config', hideUser: true, rememberUser: true, rememberPass: true, user: 'Mine', pass: 'pw' });
  assert.strictEqual(ll.hideUser, true, 'Hide username reaches the client');
  box.loginScreen = 2; box.loginUser = 'Synced'; ll.title(box);
  assert.strictEqual(box.loginUser, 'Synced', 'a username already filled in is kept');
  assert.strictEqual(box.loginPass, 'pw', 'the remembered password is filled in');
  runtimeCommand.call(ll, { type: 'login-config', hideUser: false, rememberUser: false, rememberPass: false });
  ll.fields = savedFields; ll.lastScreen = -1;
  console.log('login screen 2007RS: ok');
}
// ---- Developer Tools: buttons, commands, examine ids, var inspector
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/devtools/page.js'), 'utf8'), ctx);
  const dItems = require('../src/plugins/devtools/descriptor').config.items;
  ll.pluginConfig({ id: 'devtools', enabled: true, config: { __items: dItems } });
  const D = ll.__devtools.plugin;
  const st = () => posted.filter((m) => m.type === 'plugin-state' && m.data.id === 'devtools').pop().data.state;
  assert.ok(st().buttons.some((b) => b.id === 'players' && !b.active), 'Players button off');
  ll.pagePlugins.get('devtools').impl.panel({ action: 'toggle', id: 'players' });
  assert.ok(st().buttons.find((b) => b.id === 'players').active, 'toggled on');
  assert.deepStrictEqual(Array.from(ll.__devtools.getSetFlags(0x2 | 0x100)), ['BLOCK_MOVEMENT_NORTH', 'BLOCK_MOVEMENT_OBJECT', 'BLOCK_MOVEMENT_FULL']);
  const said = [];
  const realGm = ll.gameMessage; ll.gameMessage = (m) => said.push(m);
  let consumed = false;
  D.onCommandExecuted({ getCommand: () => 'msg', getArguments: () => ['hello', 'there'], consume: () => { consumed = true; } });
  assert.deepStrictEqual([said.pop(), consumed], ['hello there', true]);
  D.onCommandExecuted({ getCommand: () => 'setconf', getArguments: () => ['devtools', 'x', '=', '5'], consume() {} });
  assert.strictEqual(rl.configManager.getConfiguration('devtools', 'x'), '5');
  ll.gameMessage = realGm;
  ll.pagePlugins.get('devtools').impl.panel({ action: 'toggle', id: 'examine' });
  const entry = { target: 'Rat', getTarget() { return this.target; }, setTarget(t) { this.target = t; }, getNpc: () => ({ getId: () => 47 }) };
  D.onMenuEntryAdded({ getType: () => rl.MenuAction.EXAMINE_NPC, getIdentifier: () => 3, getMenuEntry: () => entry });
  assert.ok(entry.target.endsWith('(ID: 47)'), entry.target);
  ll.pluginConfig({ id: 'devtools', enabled: false, config: {} });
  console.log('developer tools clone: ok');
}

// ---- Combat Level (Experience's combat methods, the precise level and Wilderness range written to the 2007 widgets)
// and Attack Styles (the 2007 combat tab per weapon type, warned styles' buttons hidden)
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/runelite/combatinterface.js'), 'utf8'), ctx);
  for (const f of ['plugins/combatlevel/page.js', 'plugins/attackstyles/page.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  const E = rl.Experience;
  // a level 3
  assert.strictEqual(E.getCombatLevel(1, 1, 1, 10, 1, 1, 1), 3);
  assert.strictEqual(E.getCombatLevel(99, 99, 99, 99, 99, 99, 99), 126);
  assert.strictEqual(E.getNextCombatLevelMelee(1, 1, 1, 10, 1, 1, 1), 2);
  assert.strictEqual(E.getNextCombatLevelHpDef(1, 1, 1, 10, 1, 1, 1), 3);
  assert.strictEqual(E.getNextCombatLevelPrayer(1, 1, 1, 10, 1, 1, 1), 5);
  assert.strictEqual(E.getNextCombatLevelRange(1, 1, 1, 10, 1, 1, 1), 2);
  const realApi = Object.assign({}, ll.api);
  const open = new Set([75]); const texts = new Map([[(75 << 16) | 25, 'Combat Lvl: %1']]); const hidden = new Map();
  Object.assign(ll.api, {
    ifOpen: (g) => open.has(g), comVisible: () => true,
    com: (p) => ({ text: texts.get(p) || '', shown: (texts.get(p) || '').replace('%1', p === ((381 << 16) | 1) ? '5' : '3'), x: 560, y: 230, width: 180, height: 12 }),
    setText: (p, t) => texts.set(p, t), setHidden: (p, h) => hidden.set(p, h),
  });
  ll.pluginConfig({ id: 'combatlevel', enabled: true, config: { __items: require('../src/plugins/combatlevel/descriptor').config.items } });
  const cl = ll.__combatlevel.plugin;
  assert.strictEqual(texts.get((75 << 16) | 25), 'Combat Lvl: 3.4', 'precise level in the axe tab');
  assert.strictEqual(cl.overlay.getLevelsUntilTooltip(), '<col=ff981f>Next combat level:</br></col>2 Attack/Strength</br>3 Defence/Hitpoints</br>2 Ranged</br>2 Magic</br>5 Prayer');
  // the Wilderness overlay: "Level: 5" + the attack range
  open.add(381); texts.set((381 << 16) | 1, 'Level: %1');
  cl.onScriptPostFired({ getScriptId: () => rl.ScriptID.PVP_WIDGET_BUILDER });
  assert.strictEqual(texts.get((381 << 16) | 1), 'Level: 5<br>3-5'); // (the fake player's level reads 0)
  ll.pluginConfig({ id: 'combatlevel', enabled: false, config: {} });
  assert.strictEqual(texts.get((381 << 16) | 1), 'Level: 5');
  assert.strictEqual(texts.get((75 << 16) | 25), 'Combat Lvl: %1', 'given back its own level');
  // Attack Styles: axe tab, style 2 (Smash, aggressive), warn for strength and remove warned styles
  const realVarp = rl.client.getVarpValue; rl.client.getVarpValue = (id) => (id === 43 ? 2 : 0);
  ll.pluginConfig({ id: 'attackstyles', enabled: true, config: { __items: require('../src/plugins/attackstyles/descriptor').config.items, warnForStrength: true, removeWarnedStyles: true } });
  const as = ll.__attackstyles.plugin;
  as.onVarbitChanged({ getVarpId: () => 43, getVarbitId: () => -1 });
  assert.strictEqual(as.getAttackStyle().getName(), 'Aggressive');
  assert.ok(as.isWarnedSkillSelected());
  as.processWidgets();
  for (const c of [5, 8, 28, 4, 9, 29]) assert.strictEqual(hidden.get((75 << 16) | c), true, 'Hack and Smash hidden: ' + c);
  assert.ok(!hidden.get((75 << 16) | 2), 'Chop shown');
  ll.pluginConfig({ id: 'attackstyles', enabled: false, config: {} });
  assert.strictEqual(hidden.get((75 << 16) | 5), false, 'shown again');
  rl.client.getVarpValue = realVarp;
  for (const k of ['ifOpen', 'comVisible', 'com', 'setText', 'setHidden']) { if (realApi[k]) ll.api[k] = realApi[k]; else delete ll.api[k]; }
  console.log('combat level / attack styles clones: ok');
}
// ---- Puzzle Solver: IDA* (sliced) on a scrambled 5x5 sliding puzzle
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/puzzlesolver/page.js'), 'utf8'), ctx);
  const P = ll.__puzzlesolver;
  // the solved board, then 12 blank moves away from it
  let st = new P.PuzzleState([...Array(24).keys(), -1]);
  const seq = [-1, -5, -1, -5, 1, 5, -1, -1, -5, -5, 1, 5];
  for (const d of seq) st = new P.PuzzleState(st.pieces.slice()).move(st.emptyPiece + d);
  const start = new P.PuzzleState(st.pieces.slice());
  const ida = new P.IDAStar(P.ManhattanDistance);
  ida.start(start);
  let sol;
  for (let i = 0; i < 1000 && sol === undefined; i++) sol = ida.step(50);
  assert.ok(sol && sol.length - 1 <= seq.length, `solved in ${sol && sol.length - 1} moves`);
  assert.ok(sol[sol.length - 1].hasPieces([...Array(24).keys(), -1]), 'ends solved');
  // Monkey Madness: IDAStarMM on boards shuffled as the server does (255 random blank moves), every step one valid swap
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let t = 0; t < 6; t++) {
    let b = new P.PuzzleState([...Array(24).keys(), -1]);
    for (let m = 0; m < 255; m++) {
      const e = b.emptyPiece; const opts = [];
      if (e % 5 > 0) opts.push(e - 1); if (e % 5 < 4) opts.push(e + 1); if (e >= 5) opts.push(e - 5); if (e < 20) opts.push(e + 5);
      b = new P.PuzzleState(b.pieces.slice()).move(opts[Math.floor(rnd() * opts.length)]);
    }
    const mm = new P.IDAStarMM(P.ManhattanDistance);
    mm.start(new P.PuzzleState(b.pieces.slice()));
    let path;
    for (let i = 0; i < 2000 && path === undefined; i++) path = mm.step(50);
    assert.ok(path && path[0].hasPieces(b.pieces), 'MM path starts at the board');
    assert.ok(path[path.length - 1].hasPieces([...Array(24).keys(), -1]), 'MM ends solved');
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1].emptyPiece; const c = path[i].emptyPiece;
      assert.ok(Math.abs(a - c) === 5 || (Math.abs(a - c) === 1 && Math.floor(a / 5) === Math.floor(c / 5)), 'one swap per step');
    }
  }
  console.log('puzzle solver clone: ok');
}

// ---- Diary Requirements (our 2007 Karamja diary in the 2007 quest journal, 275)
{
  for (const f of ['plugins/runelite/quest.js', 'plugins/achievementdiary/diaries.js', 'plugins/achievementdiary/page.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  const realApi = Object.assign({}, ll.api);
  const L = (n) => (275 << 16) | (n + 3);
  const texts = new Map([[(275 << 16) | 2, '<col=800000>Achievement Diary - Karamja'], [L(1), '<col=ff0000>Karamja Area Tasks'],
    [L(2), '<col=000080>Pick 5 bananas from the plantation located east of the volcano.'],
    [L(3), '<col=000080>Mine some gold from the rocks on the north-west peninsula'], [L(4), '<col=000080>of Karamja.'],
    [L(5), '<col=000080><str>Cook a spider on stick.'], [L(6), '<col=000080>Mine a red topaz from a gem rock.'],
    [(274 << 16) | 81, ''], [(274 << 16) | 133, '']]);
  const colours = new Map([[(274 << 16) | 81, 0x00ff00]]); // Jungle Potion finished
  const coms = [];
  for (let n = 1; n <= 10; n++) coms.push({ id: L(n), layer: (275 << 16) | 1 });
  Object.assign(ll.api, {
    ifOpen: (g) => g === 275 || g === 274, comVisible: () => true, comsOf: (g) => (g === 275 ? coms : []),
    com: (p) => ({ text: texts.get(p) || '', shown: texts.get(p) || '', colour: colours.get(p) || 0xff0000, width: 404, height: 14 }),
    comTextWidth: (p, s) => rl.Text.removeTags(s).length * 6, setText: (p, t) => texts.set(p, t),
  });
  const realLevel = rl.client.getRealSkillLevel; rl.client.getRealSkillLevel = (s) => (s === rl.Skill.COOKING ? 20 : 1);
  ll.pluginConfig({ id: 'achievementdiary', enabled: true, config: { __items: [] } });
  assert.strictEqual(rl.Quest.JUNGLE_POTION.getState(rl.client), rl.QuestState.FINISHED);
  assert.strictEqual(rl.Quest.SHILO_VILLAGE.getState(rl.client), rl.QuestState.NOT_STARTED);
  ll.__achievementdiary.plugin.onWidgetLoaded({ getGroupId: () => 275 });
  assert.strictEqual(texts.get(L(2)), '<col=000080>Pick 5 bananas from the plantation located east of the volcano.', 'nothing needed');
  assert.strictEqual(texts.get(L(4)), '<col=000080>of Karamja.<col=ffffff>(<col=800000>40 Mining<col=000080><col=ffffff>)', 'a two-line task');
  assert.strictEqual(texts.get(L(5)), '<col=000080><str>Cook a spider on stick.<col=ffffff>(<col=000080><str>16 Cooking</str><col=ffffff>)', 'met');
  assert.strictEqual(texts.get(L(6)), '<col=000080>Mine a red topaz from a gem rock.', 'too wide: split');
  assert.strictEqual(texts.get(L(7)), '<col=ffffff>(<col=800000>40 Mining<col=000080>, <col=000080><str>Shilo Village or Jungle Potion</str><col=ffffff>)');
  ll.pluginConfig({ id: 'achievementdiary', enabled: false, config: {} });
  rl.client.getRealSkillLevel = realLevel;
  for (const k of ['ifOpen', 'comVisible', 'comsOf', 'com', 'comTextWidth', 'setText']) { if (realApi[k]) ll.api[k] = realApi[k]; else delete ll.api[k]; }
  console.log('diary requirements clone: ok');
}

// ---- Virtual Levels, Poison, Smelting
{
  for (const p of ['virtuallevels', 'poison', 'smelting']) vm.runInContext(fs.readFileSync(path.join(root, `plugins/${p}/page.js`), 'utf8'), ctx);
  const realApi = Object.assign({}, ll.api);
  // the 2007 skill tab: attack's base level (cs1 op 2, skill 0) and the total (op 9)
  const texts = new Map([[(320 << 16) | 67, '%1'], [(320 << 16) | 141, 'Total Lvl: %1']]);
  Object.assign(ll.api, {
    ifOpen: (g) => g === 320, comVisible: () => true,
    comsOf: (g) => (g === 320 ? [{ id: (320 << 16) | 67, type: 4, text: '%1', scripts: [{ 0: 2, 1: 0, 2: 0 }] }, { id: (320 << 16) | 141, type: 4, text: 'Total Lvl: %1', scripts: [{ 0: 9 }] }] : []),
    com: (p) => ({ text: texts.get(p) || '', shown: texts.get(p) || '' }), setText: (p, t) => texts.set(p, t),
  });
  const realXp = rl.client.getSkillExperience;
  rl.client.getSkillExperience = (s) => (s === rl.Skill.ATTACK ? 20000000 : 0);
  ll.pluginConfig({ id: 'virtuallevels', enabled: true, config: { __items: require('../src/plugins/virtuallevels/descriptor').config.items } });
  ll.__virtuallevels.plugin.update();
  assert.strictEqual(texts.get((320 << 16) | 67), '103', 'virtual attack level');
  assert.strictEqual(texts.get((320 << 16) | 141), 'Total Lvl: 125', 'virtual total');
  ll.pluginConfig({ id: 'virtuallevels', enabled: false, config: {} });
  assert.strictEqual(texts.get((320 << 16) | 67), '%1', 'restored');
  assert.strictEqual(texts.get((320 << 16) | 141), 'Total Lvl: %1', 'restored');
  rl.client.getSkillExperience = realXp;
  for (const k of ['ifOpen', 'comVisible', 'comsOf', 'com', 'setText']) { if (realApi[k]) ll.api[k] = realApi[k]; else delete ll.api[k]; }

  // Poison: varp 102 -> next damage ceil(v / 5) and the tooltip
  ll.pluginConfig({ id: 'poison', enabled: true, config: { __items: require('../src/plugins/poison/descriptor').config.items } });
  assert.strictEqual(ll.__poison.PoisonPlugin.nextDamage(16), 4);
  const pp = ll.__poison.plugin;
  pp.onVarbitChanged({ getVarpId: () => 102, getVarbitId: () => -1, getValue: () => 18 });
  assert.strictEqual(pp.getLastDamage(), 4);
  assert.ok(/^Next poison damage: <col=ff\w+>4<\/col><\/br>Time until damage: 0:1[78]<\/br>Time until cure: 5:2[67]$/.test(pp.createTooltip()), pp.createTooltip());
  ll.pluginConfig({ id: 'poison', enabled: false, config: {} });
  assert.strictEqual(pp.getLastDamage(), 0);

  // Smelting: bars and cannonballs from the server's messages
  ll.pluginConfig({ id: 'smelting', enabled: true, config: { __items: require('../src/plugins/smelting/descriptor').config.items } });
  const sp = ll.__smelting.plugin;
  core.chat({ type: 0, text: 'You retrieve a bar of bronze.', time: Date.now() }); step();
  core.chat({ type: 0, text: 'You retrieve a bar of iron.', time: Date.now() }); step();
  core.chat({ type: 0, text: 'The molten metal cools slowly to form 4 cannonballs.', time: Date.now() }); step();
  core.chat({ type: 0, text: 'You remove the cannonballs from the mould.', time: Date.now() }); step();
  assert.strictEqual(sp.getSession().getBarsSmelted(), 2);
  assert.strictEqual(sp.getSession().getCannonBallsSmelted(), 4);
  ll.pluginConfig({ id: 'smelting', enabled: false, config: {} });
  assert.strictEqual(sp.getSession(), null);
  console.log('virtual levels / poison / smelting clones: ok');
}

// ---- Player Indicators, Team
{
  for (const p of ['playerindicators', 'team']) vm.runInContext(fs.readFileSync(path.join(root, `plugins/${p}/page.js`), 'utf8'), ctx);
  const realPlayers = ll.readPlayers; const realFriend = ll.api.isFriend;
  const mk = (index, name, team) => ({ index, typecode: index << 14, kind: 'player', name, level: 3, x: 64, z: 64, entity: { team } });
  ll.readPlayers = () => [mk(1, 'Friendy', 0), mk(2, 'Capey', 5), mk(3, 'Capey2', 5), mk(4, 'Other', 7)];
  ll.api.isFriend = (n) => n === 'Friendy';
  ll.pluginConfig({ id: 'playerindicators', enabled: true, config: { __items: require('../src/plugins/playerindicators/descriptor').config.items } });
  const pi = ll.__playerindicators.plugin;
  const pl = rl.client.getPlayers();
  assert.strictEqual(pi.service.getDecorations(pl[0]).getColor().getRGB() & 0xffffff, 0x00c853, 'friend colour');
  assert.strictEqual(pi.service.getDecorations(pl[3]), null, 'others off by default');
  const d = new ll.__playerindicators.Decorations(null, rl.Color.parse('#FFFF0000'));
  assert.strictEqual(pi.decorateTarget('<col=ffffff>Friendy<col=00ff00>  (level-3)', d), '<col=ff0000>Friendy<col=00ff00>  (level-3)');
  assert.strictEqual(pi.decorateTarget('<col=ff9040>Earth rune</col><col=ff> -> <col=ffffff>Friendy', d), '<col=ff9040>Earth rune</col><col=ff> -> <col=ff0000>Friendy');
  ll.pluginConfig({ id: 'playerindicators', enabled: false, config: {} });
  ll.pluginConfig({ id: 'team', enabled: true, config: { __items: require('../src/plugins/team/descriptor').config.items } });
  step();
  assert.deepStrictEqual([...ll.__team.plugin.getTeams()], [[5, 2], [7, 1]], 'teams by count');
  ll.readPlayers = () => [mk(1, 'Friendy', 0), mk(2, 'Capey', 5)]; step();
  assert.deepStrictEqual([...ll.__team.plugin.getTeams()], [[5, 1]], 'despawned');
  ll.pluginConfig({ id: 'team', enabled: false, config: {} });
  ll.readPlayers = realPlayers; if (realFriend) ll.api.isFriend = realFriend; else delete ll.api.isFriend;
  console.log('player indicators / team clones: ok');
}

// ---- the 2007 clan chat as OSRS's friends chat: Player Indicators' colour and rank, Team's counter, the core's events
{
  const realPlayers = ll.readPlayers; const realWorld = ll.api.world;
  const mk = (index, name) => ({ index, typecode: index << 14, kind: 'player', name, level: 3, x: 64, z: 64, entity: { team: 0 } });
  ll.readPlayers = () => [mk(1, 'Clanny'), mk(2, 'Stranger')];
  let fc = [{ name: 'Clanny', rank: 3, world: 1 }];
  ll.api.friendsChat = () => fc; ll.api.world = () => 1;
  const events = [];
  const sub = { onFriendsChatMemberJoined: (e) => events.push('+' + e.getMember().getName()), onFriendsChatSync: (e) => events.push('sync ' + e.isSync()) };
  rl.eventBus.register(sub);
  ll.pluginConfig({ id: 'playerindicators', enabled: true, config: {} });
  ll.pluginConfig({ id: 'team', enabled: true, config: { friendsChatMemberCounter: true } });
  step();
  const pl = rl.client.getPlayers();
  assert.strictEqual(pl[0].isFriendsChatMember(), true);
  assert.strictEqual(pl[1].isFriendsChatMember(), false);
  const dec = ll.__playerindicators.plugin.service.getDecorations(pl[0]);
  assert.strictEqual(dec.getColor().getRGB() & 0xffffff, 0xaa00ff, 'friends chat colour');
  assert.strictEqual(dec.getFriendsChatRank(), rl.FriendsChatRank.SERGEANT);
  fc = [{ name: 'Clanny', rank: 3, world: 1 }, { name: 'Stranger', rank: 0, world: 1 }]; step();
  assert.deepStrictEqual(events, ['sync true', '+Stranger']);
  const box = rl.infoBoxManager.getInfoBoxes().find((b) => b.getTooltip && /friends chat member/.test(b.getTooltip() || ''));
  assert.ok(box && box.getText() === '2', 'two members near you: ' + (box && box.getText()));
  ll.pluginConfig({ id: 'team', enabled: false, config: {} });
  ll.pluginConfig({ id: 'playerindicators', enabled: false, config: {} });
  if (rl.eventBus.unregister) rl.eventBus.unregister(sub);
  delete ll.api.friendsChat; ll.readPlayers = realPlayers; if (realWorld) ll.api.world = realWorld; else delete ll.api.world;
  console.log('friends chat (2007 clan chat): ok');
}
// ---- Bank Tags: tags as config keys, tag searches and an open tag tab through the bank's script callbacks, Edit-tags
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/runelite/itemvariations.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/banktags/page.js'), 'utf8'), ctx);
  const items = require('../src/plugins/banktags/descriptor').config.items;
  const hadBank = ll.BANK; if (!ll.BANK) ll.BANK = { inv: (12 << 16) | 89 };
  ll.pluginConfig({ id: 'banktags', enabled: true, config: { __items: items, item_379: 'food,pvm', item_1712: 'jewellery' } });
  const T = ll.bankTagsTest;
  const oldInv = rl.client.getItemContainer;
  rl.client.getItemContainer = (id) => (id === 95 ? { getItems: () => [] } : null);
  assert.deepStrictEqual([...T.plugin.tagManager.getTags(379, false)], ['food', 'pvm']);
  assert.strictEqual(ll.bankSearchFilter(379, 'tag:food', false), true, 'tagged');
  assert.strictEqual(ll.bankSearchFilter(2003, 'tag:food', true), false, "a tag search doesn't match by name");
  assert.strictEqual(ll.bankSearchFilter(379, 'pv', false), true, 'a plain search matches a tag prefix');
  assert.strictEqual(ll.bankSearchFilter(2003, 'pv', true), true, 'and names still');
  assert.strictEqual(ll.bankSearchingTagTab(), false);
  T.plugin.openBankTag('jewellery');
  assert.strictEqual(ll.bankSearchingTagTab(), true, 'an open tag tab filters with nothing typed');
  assert.strictEqual(ll.bankSearchFilter(1712, '', false), true);
  assert.strictEqual(ll.bankSearchFilter(379, '', false), false);
  T.plugin.closeBankTag();
  assert.strictEqual(ll.bankSearchingTagTab(), false);
  // Edit-tags on a bank item's Examine, with its tag count
  const made = [];
  const oldCreate = rl.client.createMenuEntry;
  rl.client.createMenuEntry = () => { const e = { o: {} }; for (const k of ['setParam0', 'setParam1', 'setTarget', 'setOption', 'setType', 'setIdentifier', 'setItemId', 'onClick']) e[k] = (v) => { e.o[k] = v; return e; }; made.push(e); return e; };
  T.plugin.onMenuEntryAdded({ getOption: () => 'Examine', getTarget: () => 'Lobster', getIdentifier: () => 379, getActionParam0: () => 0, getActionParam1: () => ll.BANK.inv, getType: () => 1001 });
  assert.strictEqual(made[0].o.setOption, 'Edit-tags (2)');
  rl.client.createMenuEntry = oldCreate;
  // TabManager: tag tabs and icons as RuneLite keeps them
  T.plugin.tabManager.add(T.plugin.tabManager.load('Food'));
  T.plugin.tabManager.save();
  assert.strictEqual(rl.configManager.getConfiguration('banktags', 'tagtabs'), 'food');
  assert.strictEqual(rl.configManager.getConfiguration('banktags', 'icon_food'), 952, 'a new tab is a spade');
  rl.client.getItemContainer = oldInv;
  ll.pluginConfig({ id: 'banktags', enabled: false, config: {} });
  if (!hadBank) delete ll.BANK;
  console.log('bank tags clone: ok');
}

// ---- Chat Notifications: own name and highlight words coloured in the 2007 line, notifications
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/chatnotifications/page.js'), 'utf8'), ctx);
  const items = require('../src/plugins/chatnotifications/descriptor').config.items;
  ll.pluginConfig({ id: 'chatnotifications', enabled: true, config: { __items: items, highlightWordsString: 'rune, dragon', notifyOnHighlight: true, notifyOnOwnName: true, notifyOnTrade: true } });
  const C = ll.chatNotificationsTest;
  C.plugin.updateHighlights();
  const oldMe = rl.client.getLocalPlayer;
  rl.client.getLocalPlayer = () => ({ getName: () => 'Tester' });
  C.plugin.usernameMatcher = null;
  const n0 = posted.filter((p) => p.type === 'rl-notify').length;
  const say = (type, name, text) => { const msg = { text }; C.plugin.onChatMessage({ getType: () => type, getName: () => name, getMessage: () => text, getSender: () => null, msg, setMessage(t) { msg.replace = t; } }); return msg.replace; };
  assert.strictEqual(say('PUBLICCHAT', 'Bob', 'hi tester how are you'), 'hi @bla@Tester@end@ how are you');
  assert.strictEqual(say('PUBLICCHAT', 'Ann', 'selling rune scimitar'), 'selling @bla@rune@end@ scimitar');
  assert.strictEqual(say('PUBLICCHAT', 'Ann', 'selling runes'), undefined, 'whole words');
  assert.strictEqual(say('PUBLICCHAT', 'Tester', 'rune dragon'), undefined, 'not your own lines');
  say('TRADEREQ', 'Cat', 'Cat wishes to trade with you.');
  // the 2007 clan chat is RuneLite's friends chat: its channel is the sender
  { const msg = { text: 'tester come here' }; C.plugin.onChatMessage({ getType: () => 'FRIENDSCHAT', getName: () => 'Eve', getMessage: () => msg.text, getSender: () => 'Clan', msg, setMessage(t) { msg.replace = t; } }); assert.strictEqual(msg.replace, '@bla@Tester@end@ come here'); }
  const notes = posted.filter((p) => p.type === 'rl-notify').slice(n0).map((p) => p.data);
  assert.deepStrictEqual(notes, ['Bob: hi tester how are you', 'Ann: selling rune scimitar', 'Cat wishes to trade with you.', '[Clan] Eve: tester come here']);
  rl.client.getLocalPlayer = oldMe;
  ll.pluginConfig({ id: 'chatnotifications', enabled: false, config: {} });
  console.log('chat notifications clone: ok');
}

// ---- Report Button, Run Energy, Regeneration Meter, Quest List (and core2007.js: Prayer, Arc2D, widget buttons)
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/runelite/core2007.js'), 'utf8'), ctx);
  for (const p of ['reportbutton', 'runenergy', 'regenmeter', 'questlist']) vm.runInContext(fs.readFileSync(path.join(root, `plugins/${p}/page.js`), 'utf8'), ctx);
  const realApi = Object.assign({}, ll.api);
  const realVarp = rl.client.getVarpValue;
  const texts = new Map([[(548 << 16) | 26, 'Report Abuse'], [(261 << 16) | 27, '%1%']]);
  Object.assign(ll.api, { ifOpen: () => true, comVisible: () => true, com: (p) => ({ text: texts.get(p) || '', type: 4 }), setText: (p, t) => texts.set(p, t) });
  // core: prayers are 2007 varps
  const varps = { 90: 1, 300: 900 };
  rl.client.getVarpValue = (id) => varps[id] | 0;
  assert.strictEqual(rl.Prayer.RAPID_HEAL.getVarbit(), 90);
  assert.strictEqual(rl.client.isPrayerActive(rl.Prayer.RAPID_HEAL), true);
  assert.strictEqual(rl.client.isPrayerActive(rl.Prayer.PIETY), false);
  assert.strictEqual(rl.statusOrbs.circle('run').x, Math.round(643 + 89 * Math.cos((158 * Math.PI) / 180)));
  // the rings and tooltips (rl.statusOrbs) must sit on the orbs Status Orbs actually draws
  {
    const arcOf = (f) => (fs.readFileSync(path.join(root, f), 'utf8').match(/const ARC = (\{[^}]*\})/) || [])[1];
    assert.strictEqual(arcOf('plugins/runelite/core2007.js'), arcOf('plugins/orbs/game.js'));
  }

  // Report Button: the login timer, then the 2007 text back
  ll.pluginConfig({ id: 'reportbutton', enabled: true, config: { __items: require('../src/plugins/reportbutton/descriptor').config.items, time: 'GAME_TICKS' } });
  const rb = ll.__reportbutton.plugin;
  rb.onGameTick(); rb.onGameTick();
  assert.strictEqual(texts.get((548 << 16) | 26), String(rb.ticksSinceLogin));
  rb.onGameStateChanged({ getGameState: () => 'LOGIN_SCREEN' }); rb.onGameStateChanged({ getGameState: () => 'LOGGED_IN' });
  assert.strictEqual(rb.getLoginTime(), '00:00:00');
  ll.pluginConfig({ id: 'reportbutton', enabled: false, config: {} });
  assert.strictEqual(texts.get((548 << 16) | 26), 'Report Abuse');

  // Run Energy: 2007 drain / recovery, the Options tab's energy text
  ll.pluginConfig({ id: 'runenergy', enabled: true, config: { __items: require('../src/plugins/runenergy/descriptor').config.items, replaceOrbText: true } });
  const re = ll.__runenergy.plugin;
  const realEnergy = rl.client.getEnergy; const realWeight = rl.client.getWeight;
  rl.client.getEnergy = () => 10000; rl.client.getWeight = () => 0;
  assert.strictEqual(re.getEstimatedRunTimeRemaining(false), '1:30'); // 150 ticks of 67
  re.onGameTick();
  assert.strictEqual(texts.get((261 << 16) | 27), '90s');
  rl.client.getEnergy = () => 0;
  assert.strictEqual(re.getEstimatedRecoverTimeRemaining(), 750); // 10000 / (8 / 0.6)
  ll.pluginConfig({ id: 'runenergy', enabled: false, config: {} });
  assert.strictEqual(texts.get((261 << 16) | 27), '%1%');
  rl.client.getEnergy = realEnergy; rl.client.getWeight = realWeight;

  // Regeneration Meter: Rapid Heal halves the hitpoints cycle; special energy 900 regenerates
  ll.pluginConfig({ id: 'regenmeter', enabled: true, config: { __items: require('../src/plugins/regenmeter/descriptor').config.items, showWhenNoChange: true } });
  const rm = ll.__regenmeter.plugin;
  for (let i = 0; i < 10; i++) rm.onGameTick();
  assert.strictEqual(rm.getHitpointsPercentage(), 10 / 50);
  assert.strictEqual(rm.getSpecialPercentage(), 10 / 50);
  const drawn = [];
  const g = { setStroke() {}, setColor() {}, draw: (s) => drawn.push(s) };
  const realShown = rl.statusOrbs.shown; rl.statusOrbs.shown = () => true;
  rm.overlay.render(g);
  rl.statusOrbs.shown = realShown;
  assert.strictEqual(drawn.length, 2);
  assert.ok(drawn[0] instanceof rl.Arc2D && drawn[0].width === 30 && drawn[0].start === 90 && Math.abs(drawn[0].extent + 72) < 1e-9);
  ll.pluginConfig({ id: 'regenmeter', enabled: false, config: {} });

  // Quest List: the filter hides other quests and closes the list up; closing the search puts it back
  const lines = { 13: ['Free Quests', null, 239], 14: ["Black Knights' Fortress", ['Read Journal'], 254], 15: ["Cook's Assistant", ['Read Journal'], 269], 16: ['Demon Slayer', ['Read Journal'], 284] };
  const hidden = new Set(); const pos = {};
  for (const [i, [, , y]] of Object.entries(lines)) pos[i] = y;
  Object.assign(ll.api, {
    com: (p) => { const i = p & 0xffff; if ((p >>> 16) !== 274) return null; const l = lines[i]; return l ? { type: 4, text: l[0], ops: l[1], ox: 5, oy: pos[i], screen: [561, pos[i]] } : (i === 11 || i === 0 ? { type: 5, screen: [711, 209] } : null); },
    setHidden: (p, h) => (h ? hidden.add(p & 0xffff) : hidden.delete(p & 0xffff)), setPosition: (p, x, y) => { pos[p & 0xffff] = y; },
  });
  ll.pluginConfig({ id: 'questlist', enabled: true, config: {} });
  const ql = ll.__questlist.plugin;
  ql.questSearchButton.onClick(); // Open
  assert.strictEqual(ql.questSearchButton.option(), 'Close');
  ql.searchInput.value = 'demon'; ql.redrawQuests();
  assert.deepStrictEqual([...hidden].sort(), [14, 15]);
  assert.strictEqual(pos[16], 254, 'Demon Slayer moves up under the header');
  ql.questSearchButton.onClick(); // Close
  assert.strictEqual(hidden.size, 0);
  assert.strictEqual(pos[16], 284);
  assert.strictEqual(ql.questSearchButton.option(), 'Open');
  ll.pluginConfig({ id: 'questlist', enabled: false, config: {} });

  rl.client.getVarpValue = realVarp;
  for (const k of Object.keys(ll.api)) if (!(k in realApi)) delete ll.api[k];
  Object.assign(ll.api, realApi);
  console.log('report button / run energy / regeneration meter / quest list clones: ok');
}

// ---- Status Bars, Special Attack Counter, XP Globes
{
  for (const p of ['statusbars', 'specialcounter', 'xpglobes']) vm.runInContext(fs.readFileSync(path.join(root, `plugins/${p}/page.js`), 'utf8'), ctx);
  // Status Bars: bars beside the 2007 sidebar (subRects), prayer active colour from the 2007 varps
  const realSub = ll.api.subRects; const realVarp = rl.client.getVarpValue;
  ll.api.subRects = () => [149, 1, 547, 205, 190, 261];
  rl.client.getVarpValue = (id) => (id === 95 ? 1 : 0);
  ll.pluginConfig({ id: 'statusbars', enabled: true, config: { __items: require('../src/plugins/statusbars/descriptor').config.items, enableSkillIcon: false } });
  const sbp = ll.__statusbars.plugin;
  assert.strictEqual(sbp.isBarsDisplayed(), true);
  const rects = []; const cols = [];
  const g = { setColor: (c) => cols.push(c), drawRect() {}, fillRect: (x, y, w, h) => rects.push([x, y, w, h]), setFont() {}, drawImage() {} };
  sbp.overlay.render(g);
  assert.deepStrictEqual(rects[0], [527, 209, 20, 252], 'left bar 20 px left of the sidebar');
  assert.deepStrictEqual(rects[2], [737, 209, 20, 252], 'right bar at its right edge');
  assert.ok(cols.some((c) => c.getRed && c.getRed() === 57 && c.getGreen() === 255), 'active prayer colour');
  ll.pluginConfig({ id: 'statusbars', enabled: false, config: {} });
  ll.api.subRects = realSub;

  // Special Attack Counter: a Bandos godsword spec that hits 25 on the target the tick after
  ll.pluginConfig({ id: 'specialcounter', enabled: true, config: { __items: require('../src/plugins/specialcounter/descriptor').config.items } });
  const scp = ll.__specialcounter.plugin;
  const npc = Object.create(rl.NPC.prototype); npc.info = { index: 7, id: 1, x: 64, z: 64, size: 1 };
  const realLocal = rl.client.getLocalPlayer; const realCont = rl.client.getItemContainer;
  rl.client.getLocalPlayer = () => ({ getInteracting: () => npc, getWorldLocation: () => new rl.WorldPoint(3200, 3200, 0) });
  npc.getWorldArea = () => new rl.WorldArea(3201, 3200, 1, 1, 0);
  rl.client.getItemContainer = () => ({ getItem: (s) => (s === 3 ? { getId: () => 10502 } : null) });
  const t0 = rl.client.getTickCount();
  scp.onVarbitChanged({ getVarpId: () => 300, getVarbitId: () => -1, getValue: () => 1000 });
  scp.onVarbitChanged({ getVarpId: () => 300, getVarbitId: () => -1, getValue: () => 500 });
  assert.strictEqual(scp.hitsplatTick, t0 + 1);
  const realTick = rl.client.getTickCount; rl.client.getTickCount = () => t0 + 1;
  scp.onHitsplatApplied({ getActor: () => npc, getHitsplat: () => ({ getAmount: () => 25 }) });
  scp.onGameTick();
  const box = rl.infoBoxManager.getInfoBoxes().find((b) => b.getTooltip && /Bandos Godsword special/.test(b.getTooltip()));
  assert.ok(box && box.getText() === '25', 'counter ' + (box && box.getText()));
  assert.strictEqual(scp.getPlayerInfoDrops().length, 1);
  assert.strictEqual(new rl.WorldArea(0, 0, 2, 2, 0).distanceTo(new rl.WorldPoint(5, 1, 0)), 4);
  ll.pluginConfig({ id: 'specialcounter', enabled: false, config: {} });
  assert.ok(!rl.infoBoxManager.getInfoBoxes().includes(box));
  rl.client.getTickCount = realTick;
  rl.client.getLocalPlayer = realLocal; rl.client.getItemContainer = realCont; rl.client.getVarpValue = realVarp;

  // XP Globes: the first change caches, the second shows a globe; at most five, sorted by skill
  ll.pluginConfig({ id: 'xpglobes', enabled: true, config: { __items: require('../src/plugins/xpglobes/descriptor').config.items } });
  const xg = ll.__xpglobes.plugin;
  const sc = (skill, xp) => xg.onStatChanged({ getSkill: () => skill, getXp: () => xp, getLevel: () => rl.Experience.getLevelForXp(xp) });
  for (const k of ['MINING', 'ATTACK', 'COOKING', 'FISHING', 'MAGIC', 'PRAYER']) { sc(rl.Skill[k], 10); sc(rl.Skill[k], 20); }
  assert.deepStrictEqual([...xg.getXpGlobes().map((x) => x.getSkill().name)], ['PRAYER', 'MAGIC', 'COOKING', 'FISHING', 'MINING']); // (same millisecond: the first in skill order goes, as Stream.min)
  ll.pluginConfig({ id: 'xpglobes', enabled: false, config: {} });
  console.log('status bars / special attack counter / xp globes clones: ok');
}

// ---- Prayer, NPC Aggression Timer (and core2007.js: ItemManager.getItemStats from itemstats.js)
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/runelite/itemstats.js'), 'utf8'), ctx);
  for (const p of ['prayer', 'npcunaggroarea']) vm.runInContext(fs.readFileSync(path.join(root, `plugins/${p}/page.js`), 'utf8'), ctx);
  // the server's prayer bonuses: monk's robe top (544) +6, holy symbol (1718) +8
  assert.strictEqual(rl.itemManager.getItemStats(544).getEquipment().getPrayer(), 6);
  assert.strictEqual(rl.itemManager.getItemStats(1718).getEquipment().getPrayer(), 8);
  const realVarp = rl.client.getVarpValue; const realCont = rl.client.getItemContainer; const realBoost = rl.client.getBoostedSkillLevel; const realReal = rl.client.getRealSkillLevel;
  const varps = { 97: 1, 87: 1 }; // Protect from melee + Superhuman Strength
  rl.client.getVarpValue = (v) => varps[v] | 0;
  const cont = (ids) => ({ getItems: () => ids.map((id) => ({ getId: () => id, getQuantity: () => 1 })) });
  rl.client.getItemContainer = (id) => (id === rl.InventoryID.WORN ? cont([544, 1718]) : cont([2434]));
  rl.client.getBoostedSkillLevel = () => 30; rl.client.getRealSkillLevel = () => 70;
  ll.pluginConfig({ id: 'prayer', enabled: true, config: { __items: require('../src/plugins/prayer/descriptor').config.items, prayerIndicator: true, prayerIndicatorOverheads: true } });
  const pp = ll.__prayer.plugin;
  assert.strictEqual(pp.getPrayerBonus(), 14);
  assert.strictEqual(pp.doseOverlay.restoreAmount, 7 + Math.floor(70 * 0.25)); // a prayer potion at 70 prayer
  pp.onGameTick();
  // drain 18 (12 + 6), resistance 2 * 14 + 60 = 88: 30 points * 0.6 * 88 / 18 = 88 s
  assert.strictEqual(pp.getEstimatedTimeRemaining(false), '1:28');
  const boxes = rl.infoBoxManager.getInfoBoxes().filter((b) => b instanceof ll.__prayer.PrayerCounter);
  assert.deepStrictEqual([...boxes.map((b) => b.getTooltip())].sort(), ['+10% Strength', 'Protects against melee attacks']);
  ll.pluginConfig({ id: 'prayer', enabled: false, config: {} });
  assert.strictEqual(rl.infoBoxManager.getInfoBoxes().filter((b) => b instanceof ll.__prayer.PrayerCounter).length, 0);
  rl.client.getVarpValue = realVarp; rl.client.getItemContainer = realCont; rl.client.getBoostedSkillLevel = realBoost; rl.client.getRealSkillLevel = realReal;

  // NPC Aggression Timer: a long jump sets the second tile and starts the 10 minute timer; walking 11 tiles moves it
  const realLocal = rl.client.getLocalPlayer;
  let at = new rl.WorldPoint(3200, 3200, 0);
  rl.client.getLocalPlayer = () => ({ getWorldLocation: () => at, getCombatLevel: () => 3, getHealthScale: () => -1 });
  ll.pluginConfig({ id: 'npcunaggroarea', enabled: true, config: { __items: require('../src/plugins/npcunaggroarea/descriptor').config.items, npcUnaggroAlwaysActive: true } });
  const na = ll.__npcunaggroarea.plugin;
  na.onGameTick();
  at = new rl.WorldPoint(3300, 3200, 0); na.onGameTick();
  assert.ok(na.getSafeCenters()[1].x === 3300 && na.getSafeCenters()[0] == null);
  assert.ok(Math.abs(na.getEndTime() - Date.now() - 600000) < 1000);
  at = new rl.WorldPoint(3311, 3200, 0); na.onGameTick();
  assert.deepStrictEqual([na.getSafeCenters()[0].x, na.getSafeCenters()[1].x], [3300, 3311]);
  // the outline of two overlapping 21x21 squares: 2 * 84 edges minus the 2 * 10 inside each other... boundary length 21*4 + 11*2
  assert.strictEqual(na.generateSafeAreaEdges({ x: 0, y: 0, w: 1e5, h: 1e5 }).length, 21 * 2 + 32 * 2);
  ll.pluginConfig({ id: 'npcunaggroarea', enabled: false, config: {} });
  rl.client.getLocalPlayer = realLocal;
  // Runecraft: rifts by their 2007 ids; a degraded pouch turns on the Dark mage highlight
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/runecraft/page.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/pyramidplunder/page.js'), 'utf8'), ctx);
  ll.pluginConfig({ id: 'runecraft', enabled: true, config: { __items: require('../src/plugins/runecraft/descriptor').config.items } });
  const rc = ll.__runecraft.plugin;
  assert.strictEqual(ll.__runecraft.AbyssRifts.getRift(7141).name, 'BLOOD_RIFT');
  rc.onDecorativeObjectSpawned({ getDecorativeObject: () => ({ getId: () => 7139 }) });
  rc.onDecorativeObjectSpawned({ getDecorativeObject: () => ({ getId: () => 1 }) });
  assert.strictEqual(rc.getAbyssObjects().size, 1);
  rc.onItemContainerChanged({ getContainerId: () => rl.InventoryID.INV, getItemContainer: () => cont([5513]) });
  const hl = rc.highlightDarkMage({ getId: () => 2262 });
  assert.ok(hl && hl.render() === true && rc.highlightDarkMage({ getId: () => 1 }) == null);
  assert.strictEqual(ll.__runecraft.EssPouches.GIANT.maxAmount({ getVarpValue: () => 700 }), 6);
  ll.pluginConfig({ id: 'runecraft', enabled: false, config: {} });
  // Pyramid Plunder: 2007 ids; idle outside the pyramid
  ll.pluginConfig({ id: 'pyramidplunder', enabled: true, config: { __items: require('../src/plugins/pyramidplunder/descriptor').config.items } });
  ll.__pyramidplunder.plugin.onGameTick();
  assert.strictEqual(ll.__pyramidplunder.plugin.timer, null);
  const urn = { getId: () => 16501, equals: (o) => o.getId() === 16501 };
  ll.__pyramidplunder.plugin.onGameObjectSpawned({ getGameObject: () => urn, getTile: () => null });
  ll.__pyramidplunder.plugin.onGameObjectSpawned({ getGameObject: () => ({ getId: () => 1 }), getTile: () => null });
  assert.strictEqual(ll.__pyramidplunder.plugin.getObjectsToHighlight().length, 1);
  ll.__pyramidplunder.plugin.onGameObjectDespawned({ getGameObject: () => ({ getId: () => 16501, equals: () => true }) });
  assert.strictEqual(ll.__pyramidplunder.plugin.getObjectsToHighlight().length, 0);
  ll.pluginConfig({ id: 'pyramidplunder', enabled: false, config: {} });
  console.log('prayer / npc aggression timer / runecraft / pyramid plunder clones: ok');
}

// ---- Random Events
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/randomevents/page.js'), 'utf8'), ctx);
  ll.pluginConfig({ id: 'randomevents', enabled: true, config: { __items: require('../src/plugins/randomevents/descriptor').config.items, notifyGenie: true } });
  const re = ll.__randomevents.plugin;
  assert.strictEqual(re.shouldNotify(409), true);
  assert.strictEqual(re.shouldNotify(410), false);
  const npc = Object.create(rl.NPC.prototype); npc.info = { index: 3, id: 409, name: 'Genie' };
  const realLocal = rl.client.getLocalPlayer; const realNotify = rl.notifier.notify; const notes = [];
  rl.notifier.notify = (m) => notes.push(m);
  rl.client.getLocalPlayer = () => ({ getName: () => 'me', getInteracting: () => null });
  re.onInteractingChanged({ getSource: () => npc, getTarget: () => ({ getName: () => 'me' }) });
  assert.deepStrictEqual(notes, ['Random event spawned: Genie']);
  rl.client.getLocalPlayer = realLocal; rl.notifier.notify = realNotify;
  ll.pluginConfig({ id: 'randomevents', enabled: false, config: {} });
  console.log('random events clone: ok');
}
// ---- A-M batch 35: Hunter, Interact Highlight (and corea.js: ModelOutlineRenderer, item layers, menu box)
{
  for (const f of ['plugins/hunter/page.js', 'plugins/interacthighlight/page.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  const items = (id) => require(`../src/plugins/${id}/descriptor`).config.items;
  ll.pluginConfig({ id: 'hunter', enabled: true, config: { __items: items('hunter') } });
  const hp = ll.__hunter.plugin; const O = ll.__hunter.ObjectID;
  const realLp2 = rl.client.getLocalPlayer; const realScene = rl.client.getScene;
  const me = new rl.WorldPoint(2550, 2910, 0);
  rl.client.getLocalPlayer = () => ({ getWorldLocation: () => me, getName: () => 'Tester' });
  const sceneObjs = new Map();
  rl.client.getScene = () => ({ getTiles: () => [new Proxy([], { get: () => new Proxy([], { get: () => ({ getGameObjects: () => [...sceneObjs.values()] }) }) })] });
  const obj = (id, wp) => ({ getId: () => id, getWorldLocation: () => wp });
  hp.onGameTick();
  hp.onGameObjectSpawned({ getGameObject: () => obj(O.HUNTING_OJIBWAY_TRAP, me) });
  assert.strictEqual(hp.getTraps().size, 1, 'a bird snare laid on your tile is yours');
  hp.onGameObjectSpawned({ getGameObject: () => obj(O.HUNTING_OJIBWAY_TRAP, new rl.WorldPoint(2555, 2910, 0)) });
  assert.strictEqual(hp.getTraps().size, 1, "someone else's snare isn't");
  const trap = [...hp.getTraps().values()][0];
  hp.onGameObjectSpawned({ getGameObject: () => obj(O.HUNTING_OJIBWAY_TRAP_TRAPPING_JUNGLE, me) });
  assert.strictEqual(trap.getState(), 'TRANSITION');
  hp.onGameObjectSpawned({ getGameObject: () => obj(O.HUNTING_OJIBWAY_TRAP_FULL_JUNGLE, me) });
  assert.strictEqual(trap.getState(), 'FULL');
  // net trap: the bent young tree on the square next to you
  const tree = new rl.WorldPoint(2551, 2910, 0);
  hp.onGameObjectSpawned({ getGameObject: () => obj(O.HUNTING_SAPLING_NET_SET_SWAMP, tree) });
  assert.strictEqual(hp.getTraps().size, 2);
  hp.onGameObjectSpawned({ getGameObject: () => obj(O.HUNTING_SAPLING_FAILED_SWAMP, tree) });
  assert.strictEqual([...hp.getTraps().values()][1].getState(), 'EMPTY');
  // gone from the scene: dropped on the next tick (rl.LocalPoint.fromWorld is null off the scene in this fake, so old ones are culled)
  trap.placedOn -= 3 * 60000;
  hp.onGameTick();
  assert.strictEqual(hp.getTraps().has('2550,2910,0'), false, 'an old trap off the scene is culled');
  ll.pluginConfig({ id: 'hunter', enabled: false, config: {} });
  assert.strictEqual(hp.getTraps().size, 0);
  rl.client.getLocalPlayer = realLp2; rl.client.getScene = realScene;
  // Interact Highlight: loc ids from the client's scene tags, click colour fades
  const ih = ll.__interacthighlight.plugin;
  ll.pluginConfig({ id: 'interacthighlight', enabled: true, config: { __items: items('interacthighlight') } });
  const ov = ih.overlay;
  const c0 = ov.getClickColor(new rl.Color(255, 255, 0, 0x90), new rl.Color(255, 0, 0, 0x90), 0);
  const c10 = ov.getClickColor(new rl.Color(255, 255, 0, 0x90), new rl.Color(255, 0, 0, 0x90), 10);
  assert.deepStrictEqual([c0.getRed(), c0.getGreen(), c10.getGreen()], [255, 255, 0]);
  assert.strictEqual(ih.findItem({ getTop: () => ({ getId: () => 1, getNext: () => ({ getId: () => 995, getNext: () => null }) }) }, 995).getId(), 995);
  const drawn = []; const realMor = rl.modelOutlineRenderer;
  rl.modelOutlineRenderer = { drawOutline: (...a) => drawn.push(a) };
  const realFind = ih.findTileObject; const tree2 = obj(4818, new rl.WorldPoint(2544, 2919, 0));
  ih.findTileObject = (w, x, y, id) => (id === 4818 && x === 48 && y === 63 ? tree2 : null);
  ih.onMenuOptionClicked({ getMenuAction: () => 7, getParam0: () => 48, getParam1: () => 63, getId: () => -1, getRawId: () => 20694231588784, isItemOp: () => false, getMenuOption: () => 'Chop-down' });
  assert.strictEqual(ih.getInteractedObject(), tree2, 'the clicked loc (id 4818 from its scene tag)');
  ov.renderTarget();
  assert.strictEqual(drawn.length, 1);
  ih.onMenuOptionClicked({ getMenuAction: () => 10, getParam0: () => 0, getParam1: () => 0, getId: () => 0, isItemOp: () => false, getMenuOption: () => 'Walk here' });
  assert.strictEqual(ih.getInteractedObject(), null, 'walking clears it');
  ih.findTileObject = realFind; rl.modelOutlineRenderer = realMor;
  ll.pluginConfig({ id: 'interacthighlight', enabled: false, config: {} });
  assert.strictEqual(typeof rl.modelOutlineRenderer.drawOutline, 'function');
  console.log('hunter / interact highlight clones: ok');
}
// ---- Chat Channels (2007 clan chat = friends chat)
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/chatchannel/page.js'), 'utf8'), ctx);
  const cc = ll.__chatchannel.plugin;
  ll.pluginConfig({ id: 'chatchannel', enabled: true, config: { __items: require('../src/plugins/chatchannel/descriptor').config.items, showJoinLeave: true } });
  const realTick = rl.client.getTickCount; const realFcm = rl.client.getFriendsChatManager; const realGs = rl.client.getGameState;
  const realAdd = rl.client.addChatMessage; const realRm = rl.client.removeChatMessage;
  let t = 100; rl.client.getTickCount = () => t; rl.client.getGameState = () => rl.GameState.LOGGED_IN;
  rl.client.getFriendsChatManager = () => ({ getName: () => 'Zezima', getCount: () => 2, getSize: () => 100 });
  const added = []; const removed = [];
  rl.client.addChatMessage = (type, n, m) => added.push([type, m]);
  rl.client.removeChatMessage = (type, m) => removed.push(m);
  const mem = (n) => ({ getName: () => n, getRank: () => rl.FriendsChatRank.FRIEND });
  cc.onFriendsChatSync(); t++;
  cc.onFriendsChatMemberJoined({ getMember: () => mem('Bob') });
  cc.onFriendsChatMemberJoined({ getMember: () => mem('Al') }); t++;
  cc.onFriendsChatMemberLeft({ getMember: () => mem('Al') }); // joined and left within the delay: nothing
  t += 11; cc.onGameTick();
  assert.deepStrictEqual(added, [['FRIENDSCHATNOTIFICATION', '[Zezima] Bob has joined.']]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(cc.chats)), ['Zezima'], 'the channel you are in goes to the recent chats');
  t += 21; cc.onGameTick();
  assert.deepStrictEqual(removed, ['[Zezima] Bob has joined.'], 'the join line is taken out after the timeout');
  rl.client.getTickCount = realTick; rl.client.getFriendsChatManager = realFcm; rl.client.getGameState = realGs;
  rl.client.addChatMessage = realAdd; rl.client.removeChatMessage = realRm;
  ll.pluginConfig({ id: 'chatchannel', enabled: false, config: {} });
  console.log('chat channels clone: ok');
}

// ---- XP drops (core2007.js) and XP Drop
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/xpdrop/page.js'), 'utf8'), ctx);
  const xd = rl.xpDrops;
  assert.ok(xd && xd.tracker, 'core xp drops');
  ll.pluginConfig({ id: 'xpdrop', enabled: true, config: { __items: require('../src/plugins/xpdrop/descriptor').config.items, standardColor: '#FFFF0000' } });
  // (the core learns each skill's XP from its first StatChanged, as at log in)
  xd.state.prev = new Map(rl.Skill.values().map((sk) => [sk, rl.client.getSkillExperience(sk)]));
  step(); step();
  xd.state.drops = [];
  // one tick, two skills: one grouped drop
  stats[0].xp += 40; stats[3].xp += 13; step();
  assert.strictEqual(xd.state.drops.length, 1);
  const d = xd.state.drops[0];
  assert.strictEqual(d.total, 53);
  assert.strictEqual(JSON.stringify(d.children.slice(1).map((c) => c.getSpriteId())), '[197,203]');
  assert.strictEqual(d.colour, 0xff0000, 'standard colour from XP Drop');
  assert.strictEqual(rl.client.getWidget(d.id).getChildren()[0].getText(), '53');
  // a melee prayer recolours melee drops; hidden icons
  const realVarp = rl.client.getVarpValue;
  rl.client.getVarpValue = (id) => (id === 85 ? 1 : realVarp.call(rl.client, id)); // Burst of Strength
  ll.pluginConfig({ id: 'xpdrop', enabled: true, config: { hideSkillIcons: true } });
  stats[2].xp += 20; step();
  const d2 = xd.state.drops[xd.state.drops.length - 1];
  assert.strictEqual(d2.colour, 0x1580ad);
  assert.strictEqual(JSON.stringify(d2.children.slice(1)), '[null]');
  rl.client.getVarpValue = realVarp;
  // fake drops after the delay; ungrouped drops
  ll.pluginConfig({ id: 'xpdrop', enabled: true, config: { hideSkillIcons: false, fakeXpDropDelay: 2 } });
  const n = xd.state.drops.length;
  step(); step(); step();
  assert.ok(xd.state.drops.length > n && xd.state.drops[xd.state.drops.length - 1].fake, 'fake drop');
  rl.configManager.setConfiguration('xpdrop', 'xpDropsGroup', false);
  const m = xd.state.drops.length;
  stats[0].xp += 4; stats[1].xp += 4; step();
  assert.strictEqual(xd.state.drops.length, m + 2);
  rl.configManager.setConfiguration('xpdrop', 'xpDropsGroup', true);
  // a map load (teleport) keeps the last-known XP: the first gain after it still makes a drop
  const gsc = (g) => rl.eventBus.post('GameStateChanged', { getGameState: () => g });
  gsc(rl.GameState.LOADING); gsc(rl.GameState.LOGGED_IN);
  const k = xd.state.drops.length;
  stats[5].xp += 7; step();
  assert.strictEqual(xd.state.drops.length, k + 1, 'drop on the first gain after a map load');
  assert.strictEqual(xd.state.drops[k].total, 7);
  // a log out forgets it (the next StatChanged per skill is the log in's)
  gsc(rl.GameState.LOGIN_SCREEN);
  assert.strictEqual(xd.state.prev, null);
  xd.state.prev = new Map(rl.Skill.values().map((sk) => [sk, rl.client.getSkillExperience(sk)]));
  assert.strictEqual(rl.client.getEnum(1169).getIntValue(xd.varbit(4695)), 0xffffff);
  ll.pluginConfig({ id: 'xpdrop', enabled: false, config: {} });
  assert.strictEqual(xd.varbit(4702), 0, 'no counter or drops with XP Drop off');
  stats[0].xp += 4; step();
  assert.strictEqual(xd.state.drops.length, 0);
  console.log('xp drop clone: ok');
}

// ---- Pest Control
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/pestcontrol/page.js'), 'utf8'), ctx);
  assert.ok(rl.OverlayUtil, 'core');
  const { Game, Portal } = ll.__pestcontrol;
  const g = new Game();
  assert.strictEqual(g.getNextPortals().map(String).join(), 'PURPLE,BLUE,YELLOW');
  g.fall('blue');
  assert.strictEqual(g.getNextPortals().map(String).join(), 'RED,PURPLE');
  g.fall('purple');
  assert.strictEqual(g.getNextPortals().map(String).join(), 'RED');
  assert.strictEqual(Portal.BLUE.getHitpoints(), (408 << 16) | 14);
  ll.pluginConfig({ id: 'pestcontrol', enabled: true, config: { __items: [] } });
  const pc = ll.__pestcontrol.plugin;
  const sp = Object.create(rl.NPC.prototype); sp.info = { index: 9, id: 3747, name: 'Spinner' };
  pc.onNpcSpawned({ getNpc: () => sp });
  assert.strictEqual(pc.getSpinners().length, 1);
  pc.onNpcDespawned({ getNpc: () => sp });
  assert.strictEqual(pc.getSpinners().length, 0);
  ll.pluginConfig({ id: 'pestcontrol', enabled: false, config: {} });
  console.log('pest control clone: ok');
}

// ---- Player-owned House
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/poh/page.js'), 'utf8'), ctx);
  const { plugin: poh, PohIcons } = ll.__poh;
  assert.strictEqual(String(PohIcons.getIcon(13628)), 'KHARYLL');
  assert.strictEqual(PohIcons.getIcon(29147), null, 'no spellbook altar in 2007');
  ll.pluginConfig({ id: 'poh', enabled: true, config: { __items: require('../src/plugins/poh/descriptor').config.items, showAltar: false } });
  assert.ok(!poh.overlay.getIconList().includes(PohIcons.ALTAR) && poh.overlay.getIconList().includes(PohIcons.VARROCK));
  const tile = new rl.Tile(new rl.WorldPoint(3200, 3200, 0));
  const portal = { getId: () => 13615, getLocalLocation: () => null };
  poh.onDecorativeObjectSpawned({ getDecorativeObject: () => portal, getTile: () => tile });
  assert.strictEqual(poh.getPohObjects().size, 1);
  poh.onDecorativeObjectDespawned({ getDecorativeObject: () => portal });
  assert.strictEqual(poh.getPohObjects().size, 0);
  poh.onGameObjectSpawned({ getGameObject: () => ({ getId: () => 13209 }), getTile: () => tile });
  const b = [...poh.getIncenseBurners().values()][0].burner;
  assert.strictEqual(b.isLit(), true);
  ll.__poh.plugin.constructor.updateBurner(b, 50);
  assert.strictEqual(b.getCountdownTimer(), 150);
  ll.pluginConfig({ id: 'poh', enabled: false, config: {} });
  console.log('poh clone: ok');
}

// ---- Screen Markers
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/screenmarkers/page.js'), 'utf8'), ctx);
  const saved = JSON.stringify([{ id: 5, name: 'Bank', borderThickness: 3, color: { value: -16711936 }, fill: { value: 0 }, visible: true, labelled: false }]);
  rl.configManager.setConfiguration('screenmarkers', 'markers', saved);
  ll.pluginConfig({ id: 'screenmarkers', enabled: true, config: { __items: require('../src/plugins/screenmarkers/descriptor').config.items } });
  const sm = ll.__screenmarkers.plugin;
  assert.strictEqual(sm.getScreenMarkers().length, 1);
  assert.strictEqual(JSON.stringify(sm.getScreenMarkers()[0].getMarker()), saved.slice(1, -1));
  // draw one: add, drag, confirm
  sm.onPanelAction({ action: 'add' });
  assert.ok(sm.isCreatingScreenMarker());
  const ev = (x, y, b = 0) => ({ getPoint: () => new rl.Point(x, y), getButton: () => b, consume() {} });
  sm.mouseListener.mousePressed(ev(10, 20));
  sm.mouseListener.mouseDragged(ev(60, 50));
  sm.mouseListener.mouseReleased(ev(60, 50));
  assert.strictEqual(sm.confirmLocked, false);
  assert.strictEqual(sm.overlay.getPreferredSize().width, 50);
  sm.overlay.getBounds().setBounds(10, 20, 50, 30);
  sm.onPanelAction({ action: 'confirm' });
  assert.strictEqual(sm.getScreenMarkers().length, 2);
  const m2 = sm.getScreenMarkers()[1];
  assert.strictEqual(m2.getMarker().getName(), 'Marker 2');
  assert.strictEqual(rl.configManager.getConfiguration('runelite', 'marker' + m2.getMarker().getId() + '_preferredLocation'), '10:20');
  sm.onPanelAction({ action: 'fill', id: m2.getMarker().getId(), value: '#4B00FF00' });
  assert.ok(rl.configManager.getConfiguration('screenmarkers', 'markers').includes('"fill":{"value":1258356480}'));
  sm.onPanelAction({ action: 'delete', id: '5' });
  assert.strictEqual(sm.getScreenMarkers().length, 1);
  ll.pluginConfig({ id: 'screenmarkers', enabled: false, config: {} });
  console.log('screen markers clone: ok');
}

// ---- Screenshot
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/screenshot/page.js'), 'utf8'), ctx);
  const { ScreenshotPlugin, plugin: ss } = ll.__screenshot;
  assert.strictEqual(ScreenshotPlugin.parseQuestCompletedWidget('You have completed Death Plateau!'), 'Quest(Death Plateau)');
  assert.strictEqual(ScreenshotPlugin.parseQuestCompletedWidget("'One Small Favour' completed!"), 'Quest(One Small Favour)');
  assert.strictEqual(ScreenshotPlugin.parseQuestCompletedWidget('You have completed the Druidic Ritual Quest!'), 'Quest(Druidic Ritual)');
  assert.strictEqual(ss.parseLevelUpWidget('Your cooking level is now 2.'), 'cooking(2)');
  ll.pluginConfig({ id: 'screenshot', enabled: true, config: { __items: require('../src/plugins/screenshot/descriptor').config.items } });
  const shots = [];
  const realTake = ss.takeScreenshot; ss.takeScreenshot = (f, d) => shots.push([f, d]);
  ss.onChatMessage({ getType: () => 'GAMEMESSAGE', getMessage: () => 'Your Barrows chest count is: @red@12@bla@.' });
  ss.onWidgetLoaded({ getGroupId: () => 364 });
  ss.onWidgetLoaded({ getGroupId: () => 392 });
  assert.strictEqual(shots[0].join('|'), 'Barrows(12)|Boss Kills');
  assert.ok(shots[1][0].startsWith('Kingdom ') && shots[1][1] === 'Kingdom Rewards');
  ss.takeScreenshot = realTake;
  ll.pluginConfig({ id: 'screenshot', enabled: false, config: {} });
  console.log('screenshot clone: ok');
}

// ---- Skill Calculator
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/skillcalculator/data.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/skillcalculator/page.js'), 'utf8'), ctx);
  const { plugin: sc, SkillCalculator, CalculatorType } = ll.__skillcalculator;
  const types = CalculatorType.map((t) => t.name());
  assert.ok(!types.includes('SAILING') && types.includes('CONSTRUCTION') && types.includes('HUNTER') && types.length === 17);
  assert.strictEqual(SkillCalculator.formatBonusPercentage(3.5), '350');
  assert.strictEqual(SkillCalculator.formatBonusPercentage(1.025), '102.5');
  assert.strictEqual(SkillCalculator.formatXPActionString(25, 1234, 'exp - '), '2.5exp - 1,234 actions');
  const realXp = rl.client.getSkillExperience; const realWt = rl.client.getWorldType; const realUpdate = rl.panels.update;
  let st = null;
  rl.panels.update = (id, s) => { if (id === 'skillcalculator') st = s; };
  rl.client.getSkillExperience = (s) => (s === rl.Skill.COOKING ? 174 : s === rl.Skill.PRAYER ? 0 : 0);
  rl.client.getWorldType = () => new Set(['MEMBERS']);
  ll.pluginConfig({ id: 'skillcalculator', enabled: true, config: { __items: [] } });
  sc.onPanelAction({ action: 'tab', index: types.indexOf('COOKING') });
  assert.strictEqual(JSON.stringify([st.input.currentLevel, st.input.currentXP, st.input.targetLevel, st.input.targetXP]), '[3,"174",4,"276"]');
  const shrimp = st.slots.find((s) => s.n === 'SHRIMPS');
  assert.strictEqual(shrimp.text, 'Lvl. 1 (30exp) - 4 actions');
  assert.strictEqual(shrimp.border, 'green');
  sc.onPanelAction({ action: 'targetLevel', value: '40' });
  assert.strictEqual(st.input.targetXP, '37,224');
  assert.strictEqual(st.slots.find((s) => s.n === 'SHRIMPS').text, 'Lvl. 1 (30exp) - 1,235 actions');
  assert.strictEqual(st.slots.find((s) => s.n === 'TROUT').border, 'orange');
  assert.strictEqual(st.slots.find((s) => s.n === 'LOBSTER').border, 'red');
  sc.onPanelAction({ action: 'slot', index: shrimp.i });
  sc.onPanelAction({ action: 'slot', index: st.slots.find((s) => s.n === 'SINEW').i, shift: true });
  assert.strictEqual(st.combined.title + ' ' + st.combined.text, '2 actions selected 33exp - 1,123 actions');
  // Prayer: the era bonuses (Lit Gilded Altar / Ectofuntus), which don't stack
  sc.onPanelAction({ action: 'tab', index: types.indexOf('PRAYER') });
  assert.strictEqual(st.bonuses.map((b) => b.label).join('|'), 'Lit Gilded Altar (350%)|Ectofuntus (400%)');
  sc.onPanelAction({ action: 'bonus', id: 'LIT_GILDED_ALTAR', value: true });
  assert.ok(st.slots.find((s) => s.n === 'DRAGON_BONES').text.startsWith('Lvl. 1 (252exp)'));
  sc.onPanelAction({ action: 'bonus', id: 'ECTOFUNTUS', value: true });
  assert.strictEqual(st.bonuses.map((b) => b.on).join(), 'false,true');
  assert.ok(st.slots.find((s) => s.n === 'DRAGON_BONES').text.startsWith('Lvl. 1 (288exp)'));
  sc.onPanelAction({ action: 'multiplier', value: '2x' });
  assert.ok(st.slots.find((s) => s.n === 'DRAGON_BONES').text.startsWith('Lvl. 1 (576exp)'));
  ll.pluginConfig({ id: 'skillcalculator', enabled: false, config: {} });
  rl.client.getSkillExperience = realXp; rl.client.getWorldType = realWt; rl.panels.update = realUpdate;
  console.log('skill calculator clone: ok');
}

// ---- Item Charges: worn / inventory charge text, infoboxes, binding necklace varp, ring of forging messages
{
  for (const f of ['plugins/itemcharges/data.js', 'plugins/itemcharges/page.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  const IC = ll.__itemcharges;
  const icItems = require('../src/plugins/itemcharges/descriptor').config.items;
  assert.ok(!icItems.some((i) => /dodgy|Explorer|Chemistry|Slaughter|Expeditious|BloodEssence/i.test(i.key)), 'era-trimmed options');
  assert.strictEqual(IC.ItemWithCharge.findItem(1712).getCharges(), 4, 'Amulet of glory(4)');
  assert.strictEqual(IC.ItemWithCharge.findItem(1712).getType().name, 'TELEPORT');
  assert.strictEqual(IC.ItemWithCharge.findItem(2552).getCharges(), 8, 'Ring of dueling(8)');
  assert.ok(IC.ItemWithCharge.findItem(11976) == null, 'no 2008+ items (glory(5))');
  assert.strictEqual(IC.ItemWithConfig.findItem(5521).getConfigKey(), 'bindingNecklace');
  ITEMS[1712] = { name: 'Amulet of glory(4)', cost: 1 }; ITEMS[2568] = { name: 'Ring of forging', cost: 1 };
  const realRead = ll.readContainer;
  const worn = new Array(14).fill(null);
  ll.readContainer = (id) => (id === 94 ? worn.slice() : realRead(id));
  const cfg = icItems.map((i) => (i.key === 'showInfoboxes' ? { ...i, default: true } : i));
  ll.pluginConfig({ id: 'itemcharges', enabled: true, config: { __items: cfg } });
  const p = IC.plugin;
  step();
  worn[2] = { id: 1712, quantity: 1 }; step();
  const boxes = () => rl.infoBoxManager.getInfoBoxes().filter((b) => b instanceof IC.ItemChargeInfobox);
  assert.strictEqual(boxes().length, 1, 'a glory infobox');
  assert.strictEqual(boxes()[0].getText(), '4');
  assert.strictEqual(boxes()[0].getTooltip(), 'Amulet of glory(4)');
  worn[12] = { id: 2568, quantity: 1 }; step();
  core.chat({ type: 0, text: 'You can smelt 2 more pieces of iron ore before a ring melts.', time: Date.now() }); step();
  assert.strictEqual(p.getItemCharges('ringOfForging'), 2);
  assert.strictEqual(boxes().length, 2, 'a ring of forging infobox');
  core.chat({ type: 0, text: 'You retrieve a bar of iron.', time: Date.now() }); step();
  assert.strictEqual(p.getItemCharges('ringOfForging'), 1);
  assert.strictEqual(p.getColor(1).toString(), rl.Color.RED.toString(), 'very low warning colour');
  worn[2] = null; step();
  assert.strictEqual(boxes().length, 1, 'removed when unequipped');
  ll.pluginConfig({ id: 'itemcharges', enabled: false, config: {} });
  assert.strictEqual(boxes().length, 0, 'removed on shutdown');
  ll.readContainer = realRead;
  console.log('item charges clone: ok');
}

// ---- Item Stats: the ItemStatChanges table (2007 items), stat change tooltips, equipment bonus diff, the service
{
  for (const f of ['plugins/runelite/itemstats.js', 'plugins/itemstats/changes.js', 'plugins/itemstats/page.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  const IS = ll.__itemstats;
  const isItems = require('../src/plugins/itemstats/descriptor').config.items;
  assert.ok(!isItems.some((i) => i.key === 'geStats'), 'no GE information (Nov 2007)');
  assert.ok(rl.itemStatChangesService, 'the service is bound with the plugin off');
  assert.ok(IS.ItemStatChanges.get(11730) == null, 'no Nightmare Zone overload on the 2007 Saradomin sword id');
  const realB = rl.client.getBoostedSkillLevel; const realR = rl.client.getRealSkillLevel;
  rl.client.getBoostedSkillLevel = (s) => (s === rl.Skill.HITPOINTS ? 5 : s === rl.Skill.PRAYER ? 10 : 40);
  rl.client.getRealSkillLevel = (s) => (s === rl.Skill.HITPOINTS ? 10 : s === rl.Skill.PRAYER ? 43 : 40);
  ll.pluginConfig({ id: 'itemstats', enabled: true, config: { __items: isItems } });
  const ov = IS.plugin.overlay;
  const tip = (id) => rl.itemStatChangesService.getItemStatChanges(id).calculate(rl.client).getStatChanges().map((c) => ov.buildStatChangeString(c).replace(/<\/?col[^>]*>/g, '')).join('');
  assert.strictEqual(tip(315), '+3 (8) Hitpoints</br>', 'shrimps');
  assert.strictEqual(tip(385), '+5 (10) Hitpoints</br>', 'shark caps at the maximum');
  assert.strictEqual(tip(2434), '+17 (27) Prayer</br>', 'prayer potion: 7 + 25% of 43');
  assert.strictEqual(tip(2440).split('</br>')[0], '+11 (51) Strength', 'super strength: 5 + 15% of 40');
  // equipment: a rune scimitar against an empty weapon slot (unarmed)
  const realRead = ll.readContainer;
  const worn = new Array(14).fill(null);
  ll.readContainer = (id) => (id === 94 ? worn.slice() : realRead(id));
  const scim = rl.itemManager.getItemStats(1333);
  const s = ov.buildStatBonusString(scim).replace(/<\/?col[^>]*>/g, '');
  assert.ok(s.includes('Slash: +45') && s.includes('Melee Str: +44') && s.includes('Attack Bonus') && !s.includes('Speed'), s);
  ll.pluginConfig({ id: 'itemstats', enabled: false, config: {} });
  ll.readContainer = realRead; rl.client.getBoostedSkillLevel = realB; rl.client.getRealSkillLevel = realR;
  console.log('item stats clone: ok');
}

// ---- Mage Training Arena: the 2007 alchemy room (8 cupboards), graveyard counter, Angle / canTravelInDirection core
{
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins/mta/page.js'), 'utf8'), ctx);
  const M = ll.__mta;
  assert.strictEqual(new rl.Angle(0).getNearestDirection(), 'SOUTH');
  assert.strictEqual(new rl.Angle(1024).getNearestDirection(), 'NORTH');
  assert.strictEqual(new rl.Angle(1536 - 200).getNearestDirection(), 'EAST');
  assert.strictEqual(new rl.WorldArea(10, 20, 2, 2, 0).toWorldPointList().length, 4);
  ll.pluginConfig({ id: 'mta', enabled: true, config: { __items: require('../src/plugins/mta/descriptor').config.items } });
  const p = M.plugin;
  const realLp = rl.client.getLocalPlayer; const realW = rl.client.getWidget;
  let plane = 2;
  rl.client.getLocalPlayer = () => ({ getWorldLocation: () => new rl.WorldPoint(3366, 9628, plane), getName: () => 'Tester' });
  const texts = { 4: 'Leather Boots', 5: 'Adamant Kiteshield', 6: 'Adamant Helm', 7: 'Emerald', 8: 'Rune Longsword', 9: '5', 10: '10', 11: '30', 12: '20', 13: '1' };
  rl.client.getWidget = (g, c) => (g === 194 && texts[c] !== undefined ? { getText: () => texts[c] } : realW(g, c));
  const cup = (i, x, y) => ({ getId: () => 10783 + i * 2, getWorldLocation: () => new rl.WorldPoint(x, y, 2), getLocalLocation: () => null });
  for (let i = 0; i < 8; i++) p.onGameObjectSpawned({ getGameObject: () => cup(i, 3360 + (i < 4 ? 0 : 9), 9620 + (i < 4 ? i : 7 - i) * 4) });
  p.onGameTick();
  assert.strictEqual(p.alchemyRoom.best, M.AlchemyItem.ADAMANT_MED_HELM, 'best = the 30-point item');
  // the player stands by cupboard 0 and finds an emerald: the ring of eight fills from there
  rl.client.getLocalPlayer = () => ({ getWorldLocation: () => new rl.WorldPoint(3360, 9620, 2) });
  p.onChatMessage({ getType: () => 'GAMEMESSAGE', getMessage: () => 'You found: Emerald' });
  assert.strictEqual(p.alchemyRoom.cupboards.map((c) => c.alchemyItem.name).join(), 'EMERALD,RUNE_LONGSWORD,EMPTY,EMPTY,EMPTY,LEATHER_BOOTS,ADAMANT_KITESHIELD,ADAMANT_MED_HELM');
  // graveyard: bones in the inventory on plane 1
  plane = 1;
  rl.client.getLocalPlayer = () => ({ getWorldLocation: () => new rl.WorldPoint(3366, 9628, plane) });
  const items = [6904, 6907, 6907].map((id) => ({ getId: () => id, getQuantity: () => 1 }));
  p.onItemContainerChanged({ getContainerId: () => 93, getItemContainer: () => ({ getItems: () => items }) });
  const gc = rl.infoBoxManager.getInfoBoxes().find((b) => b instanceof M.GraveyardCounter);
  assert.ok(gc && gc.getCount() === 9 && gc.getTextColor() === rl.Color.ORANGE, 'graveyard score 9');
  ll.pluginConfig({ id: 'mta', enabled: false, config: {} });
  rl.infoBoxManager.removeIf((b) => b instanceof M.GraveyardCounter);
  rl.client.getLocalPlayer = realLp; rl.client.getWidget = realW;
  console.log('mta clone: ok');
}
