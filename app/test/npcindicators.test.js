'use strict';
// NPC Indicators and the NPC/player readers: hulls from the model hook, tiles, names, the
// Shift + right-click Tag / Tag-All entries and menu colours, against a fake client.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'src');
const posted = [];
const handlers = {};
const window = { postMessage: (m) => posted.push(m), addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); } };
const ctx = vm.createContext({ window, document: { getElementById: () => null }, setInterval() {}, setTimeout() {}, clearTimeout() {}, performance: { now: () => 0 }, Int32Array, Math, String, Array, Object, RegExp, Proxy, Map, Set, JSON, Number, isFinite, parseInt });
vm.runInContext(fs.readFileSync(path.join(root, 'runtime', 'runtime.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'plugins', 'npcindicators', 'page.js'), 'utf8'), ctx);
const ll = vm.runInContext('window.__lostlite', ctx);
const cmd = (c) => handlers.message.forEach((fn) => fn({ source: window, data: { __lostliteCmd: c } }));

const goblinType = { nm: 'Goblin', lv: 2, id: 100 };
const guardType = { nm: 'Guard', lv: 21, id: 9 };
const mk = (type, tx, tz) => ({ t: type, ex: tx * 128 + 64, ez: tz * 128 + 64, sz: 1, ht: 80, rx: new Int32Array([tx]), rz: new Int32Array([tz]), anim: -1, cc: -1000, hp: 0, th: 0, face: -1 });
const npcs = [];
npcs[5] = mk(goblinType, 50, 50);
npcs[7] = mk(guardType, 52, 50);
const texts = [];
const font = { tag(str, x, y, rgb) { texts.push({ str, x, y, rgb }); }, wid(str) { return String(str).length * 6; } };
const client = {
  lp: { ex: 50 * 128 + 64, ez: 48 * 128 + 64 }, lvl: 0, bx: 3200, bz: 3200,
  npcList: npcs, npcIds: new Int32Array([5, 7]), npcN: 2, plist: [], pids: new Int32Array(0), pN: 0,
  p11: font, p12: font, b12: font, px: -1, py: -1,
  proj(x, z, h) { this.px = 256 + (x - 50 * 128) / 4; this.py = 200 - (z - 50 * 128) / 4 - h; },
  n: 0, o: [], act: new Int32Array(500), a: new Int32Array(500), b: new Int32Array(500), c: new Int32Array(500),
};
const pixels = new Int32Array(512 * 334);
ll.configure({ fields: {
  localPlayer: 'lp', entityX: 'ex', entityZ: 'ez', entitySize: 'sz', entityHeight: 'ht', routeX: 'rx', routeZ: 'rz', primaryAnim: 'anim',
  combatCycle: 'cc', health: 'hp', totalHealth: 'th', faceEntity: 'face', level: 'lvl', baseX: 'bx', baseZ: 'bz',
  npcs: 'npcList', npcIds: 'npcIds', npcCount: 'npcN', npcType: 't', npcName: 'nm', npcLevel: 'lv', npcId: 'id',
  players: 'plist', playerIds: 'pids', playerCount: 'pN', playerName: 'pn', combatLevel: 'pl',
  fontP11: 'p11', fontP12: 'p12', fontB12: 'b12', fontDrawTag: 'tag', fontWidth: 'wid', project: 'proj', projectX: 'px', projectY: 'py',
  actions: { walk: 718, npc: [242, 209, 309, 852, 793, 1714, 240, 829], npcExamine: 1714, obj: [], objTake: [] },
  menuCount: 'n', menuOption: 'o', menuAction: 'act', menuParamA: 'a', menuParamB: 'b', menuParamC: 'c',
}, features: {} });
ll.setApi({ pix: () => ({ pixels, width: 512, height: 334 }), loopCycle: () => 0 });

// Readers
const read = ll.readNpcs(client);
assert.deepStrictEqual(JSON.parse(JSON.stringify(read.map((n) => [n.index, n.name, n.level, n.id, n.typecode]))), [[5, 'Goblin', 2, 100, 0x20000000 + (5 << 14)], [7, 'Guard', 21, 9, 0x20000000 + (7 << 14)]]);

const defaults = {};
for (const it of require('../src/plugins/npcindicators/descriptor').config.items) defaults[it.key] = it.default;
const configure = (over) => cmd({ type: 'plugin-config', id: 'npcindicators', enabled: true, config: Object.assign({}, defaults, over) });
function frame(models) {
  texts.length = 0;
  pixels.fill(0);
  // The client draws the scene (models) first, then calls frame().
  for (const [tc, pts] of models || []) {
    const sx = new Int32Array(pts.map((p) => p[0]));
    const sy = new Int32Array(pts.map((p) => p[1]));
    if (ll.hullWanted) ll.modelDrawn({}, tc, sx, sy, pts.length);
  }
  ll.frame(client);
}
const goblinModel = [0x20000000 + (5 << 14), [[100, 100], [120, 90], [140, 100], [120, 130], [120, 110], [-5000, 0]]];

// Name list with wildcard: hull asked for the goblin, drawn the frame after
configure({ npcToHighlight: 'gob*' });
frame([goblinModel]);
assert.ok(ll.hullNext.size === 0 && ll.hullWant.has(goblinModel[0]), 'hull requested for the next frame');
frame([goblinModel]);
assert.strictEqual(pixels[110 * 512 + 120] !== 0, true, 'hull filled');
assert.strictEqual(pixels[100 * 512 + 100] & 0xffffff, 0x00ffff, 'hull border in the highlight colour');
assert.strictEqual(pixels[300 * 512 + 300], 0, 'nothing else drawn');

// Names above, tiles
configure({ npcToHighlight: 'Guard', highlightHull: false, drawNames: true, highlightTile: true });
frame();
assert.deepStrictEqual([...texts.map((t) => t.str)], ['Guard']);
assert.ok(pixels.some((p) => p !== 0), 'tile drawn');

// Menu colours and the Shift Tag entries
function menu(entries) {
  client.n = entries.length;
  entries.forEach((e, i) => { client.o[i] = e[0]; client.act[i] = e[1]; client.a[i] = e[2] || 0; client.b[i] = 0; client.c[i] = 0; });
  ll.menuBuilt(client);
  return client.o.slice(0, client.n);
}
configure({ npcToHighlight: 'Guard', highlightMenuStyle: 'name' });
let m = menu([['Cancel', 1106], ['Walk here', 718], ['Examine @yel@Guard @gre@(level-21)', 1714, 7], ['Attack @yel@Guard @gre@(level-21)', 2242, 7], ['Talk-to @yel@Goblin @gre@(level-2)', 242, 5]]);
assert.ok(/^Attack @~[0-9a-z]{2}@Guard @gre@\(level-21\)$/.test(m[3]), m[3]);
assert.strictEqual(m[4], 'Talk-to @yel@Goblin @gre@(level-2)', 'not highlighted: unchanged');
assert.strictEqual(ll.__npcIndicators.recolour('Attack @yel@Guard @gre@(level-21)', '@~01@', 'level'), 'Attack @yel@Guard @~01@(level-21)');
assert.strictEqual(ll.__npcIndicators.recolour('Attack @yel@Guard @gre@(level-21)', '@~01@', 'both'), 'Attack @~01@Guard (level-21)');

ll.altDown = true;
m = menu([['Cancel', 1106], ['Walk here', 718], ['Examine @yel@Goblin @gre@(level-2)', 1714, 5], ['Talk-to @yel@Goblin @gre@(level-2)', 242, 5]]);
assert.deepStrictEqual([...m], ['Cancel', 'Walk here', 'Tag-All @yel@Goblin @gre@(level-2)', 'Tag @yel@Goblin @gre@(level-2)', 'Examine @yel@Goblin @gre@(level-2)', 'Talk-to @yel@Goblin @gre@(level-2)']);
// Choose "Tag": the goblin (index 5) is now highlighted
assert.strictEqual(ll.menuClick(client, 3), true);
assert.ok(ll.__npcIndicators.tags().has(5));
m = menu([['Cancel', 1106], ['Examine @yel@Goblin @gre@(level-2)', 1714, 5]]);
assert.ok(m.some((t) => /^Un-tag @(yel|~[0-9a-z]{2})@Goblin @gre@\(level-2\)$/.test(t)), m.join(' | '));
// Tag-All saves the name
const tagAll = m.findIndex((t) => t.startsWith('Tag-All '));
assert.strictEqual(ll.menuClick(client, tagAll), true);
assert.strictEqual(posted.filter((p) => p.type === 'npcindicators-list').pop().data, 'Guard, Goblin');
m = menu([['Cancel', 1106], ['Examine @yel@Goblin @gre@(level-2)', 1714, 5]]);
assert.ok(m.some((t) => t.startsWith('Un-tag-All ')), m.join(' | '));
ll.altDown = false;
m = menu([['Cancel', 1106], ['Examine @yel@Goblin @gre@(level-2)', 1714, 5]]);
assert.strictEqual(m.length, 2, 'no tag entries without the tag key');
ll.shiftDown = true;
assert.strictEqual(menu([['Cancel', 1106], ['Examine @yel@Goblin @gre@(level-2)', 1714, 5]]).length, 2, 'Shift is not the tag key by default');
configure({ tagKey: 'shift', npcToHighlight: 'Guard, Goblin' });
assert.strictEqual(menu([['Cancel', 1106], ['Examine @yel@Goblin @gre@(level-2)', 1714, 5]]).length, 4, 'unless chosen');
ll.shiftDown = false;
// A normal entry is not taken by the plugin handler
menu([['Cancel', 1106], ['Examine @yel@Goblin @gre@(level-2)', 1714, 5]]);
assert.strictEqual(ll.menuClick(client, 1), false);

// Dead NPCs are ignored
configure({ npcToHighlight: 'Guard', highlightHull: false, highlightTile: true, drawNames: true });
npcs[7].th = 22; npcs[7].hp = 0; npcs[7].cc = 400;
frame();
assert.deepStrictEqual([...texts.map((t) => t.str)], ['Goblin'], 'dead guard not highlighted (the tagged goblin still is)');
console.log('npc indicators: ok');
