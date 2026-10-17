'use strict';
// Clue Scroll: the clue list built from Lost City's content, the answers, and the page side
// (panel, highlights, hint arrow) against a fake client.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---- data
global.window = { dispatchEvent() {} };
global.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } };
const { CLUES, solve } = require('../src/plugins/cluescroll/game.js');
const all = Object.values(CLUES);
assert.ok(all.length >= 190, `${all.length} clues`);
for (const [id, c] of Object.entries(CLUES)) {
  assert.ok(/^\d+$/.test(id), 'clue keyed by item id');
  if (['dig', 'search', 'coordinate', 'map'].includes(c.kind)) assert.ok(Number.isInteger(c.x) && Number.isInteger(c.z), `${c.name} has a spot`);
  if (c.kind === 'npc') assert.ok(c.npc && c.spawns && c.spawns.length, `${c.name} has an NPC with spawns`);
  if (c.kind === 'challenge') assert.ok(Number.isInteger(c.answer), `${c.name} has an answer`);
  assert.notStrictEqual(c.kind, 'unknown', `${c.name} solved`);
}
const byName = (n) => Object.keys(CLUES).find((k) => CLUES[k].name === n);
let s = solve(byName('trail_clue_easy_simple001'));
assert.strictEqual(s.tiles[0].level, 1);
assert.deepStrictEqual([...s.lines], ["Search the chest in the Duke of Lumbridge's bedroom."], 'no tile numbers when the clue says where');
s = solve(byName('trail_clue_hard_sextant001'));
assert.ok(s.title.startsWith('Coordinate clue'));
assert.ok(s.lines.some((l) => /Zamorak Wizard/.test(l)));
s = solve(byName('trail_clue_medium_anagram001_challenge'));
assert.ok(s.lines.includes('Answer: 6859'));
s = solve(byName('trail_clue_easy_simple005'));
assert.deepStrictEqual([...s.npcIds], [0]);
assert.deepStrictEqual([...s.lines], ['Speak to Hans to solve the clue.'], 'no extra Talk line when the clue names the NPC');
s = solve(byName('trail_clue_easy_map001'));
assert.ok(/^Dig near /.test(s.lines[0]), 'map clue says roughly where');
assert.ok(!all.some((c) => solve(Object.keys(CLUES).find((k) => CLUES[k] === c)).lines.some((l) => /\d{4}, \d{4}/.test(l))), 'no tile numbers anywhere');
console.log(`clue data: ok (${all.length} clues)`);

// ---- page side
const posted = [];
const handlers = {};
const win = { postMessage: (m) => posted.push(m), addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); } };
const ctx = vm.createContext({ window: win, document: { getElementById: () => null }, setInterval() {}, setTimeout() {}, clearTimeout() {}, performance: { now: () => 0 }, Int32Array, Math, String, Array, Object, RegExp, Proxy, Map, Set, JSON, Number, isFinite, parseInt });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'runtime', 'runtime.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'plugins', 'cluescroll', 'page.js'), 'utf8'), ctx);
const ll = vm.runInContext('window.__lostlite', ctx);
const cmd = (c) => handlers.message.forEach((fn) => fn({ source: win, data: { __lostliteCmd: c } }));
const texts = [];
const font = { tag(str, x, y, rgb) { texts.push({ str, x, y, rgb }); }, wid(str) { return String(str).length * 6; } };
const hans = { t: { nm: 'Hans', lv: 0, id: 0 }, ex: 10 * 128 + 64, ez: 30 * 128 + 64, sz: 1, ht: 80, rx: new Int32Array([10]), rz: new Int32Array([30]), anim: -1, cc: -1000, hp: 0, th: 0, face: -1 };
const client = {
  lp: { ex: 12 * 128 + 64, ez: 30 * 128 + 64 }, lvl: 0, bx: 3197, bz: 3203, p11: font, p12: font, b12: font, px: -1, py: -1,
  proj(x, z, h) { this.px = 256 + (x - 12 * 128) / 4; this.py = 167 - (z - 30 * 128) / 4 - h; },
  npcList: [], npcIds: new Int32Array([4]), npcN: 1, plist: [], pids: new Int32Array(0), pN: 0,
  ht: 0, hn: -1, hox: 0, hoz: 0, htx: 0, htz: 0, hh: 0,
};
client.npcList[4] = hans;
const pixels = new Int32Array(512 * 334);
ll.configure({ fields: {
  localPlayer: 'lp', entityX: 'ex', entityZ: 'ez', entitySize: 'sz', entityHeight: 'ht2', routeX: 'rx', routeZ: 'rz', primaryAnim: 'anim',
  combatCycle: 'cc', health: 'hp', totalHealth: 'th', faceEntity: 'face', level: 'lvl', baseX: 'bx', baseZ: 'bz',
  npcs: 'npcList', npcIds: 'npcIds', npcCount: 'npcN', npcType: 't', npcName: 'nm', npcLevel: 'lv', npcId: 'id',
  players: 'plist', playerIds: 'pids', playerCount: 'pN', playerName: 'pn', combatLevel: 'pl',
  fontP11: 'p11', fontP12: 'p12', fontB12: 'b12', fontDrawTag: 'tag', fontWidth: 'wid', project: 'proj', projectX: 'px', projectY: 'py',
  hintType: 'ht', hintNpc: 'hn', hintOffsetX: 'hox', hintOffsetZ: 'hoz', hintTileX: 'htx', hintTileZ: 'htz', hintHeight: 'hh',
}, features: {} });
ll.setApi({ pix: () => ({ pixels, width: 512, height: 334 }), loopCycle: () => 0 });
const frame = () => { texts.length = 0; ll.frame(client); };
const show = (clue) => cmd({ type: 'plugin-config', id: 'cluescroll', enabled: true, config: { clue, displayHintArrows: true, highlight: true, highlightColor: '#FF9040' } });

show(solve(byName('trail_clue_easy_simple005'))); // Talk to Hans
frame();
assert.strictEqual(texts[0].str, 'Clue scroll (easy)', 'panel title');
assert.ok(texts.some((t) => /Speak to Hans/.test(t.str)), 'answer in the panel');
assert.ok(texts.some((t) => t.str === 'Hans'), 'name above Hans');
assert.strictEqual(client.ht, 1, 'hint arrow on an NPC');
assert.strictEqual(client.hn, 4, 'on Hans');

// A dig spot in the loaded area: tile highlighted, arrow on the tile
show({ title: 'Map clue (easy)', lines: ['Dig at 3215, 3240'], tiles: [{ x: 3197 + 18, z: 3203 + 37, level: 0, label: 'Dig here' }], npcIds: [] });
frame();
assert.strictEqual(client.ht, 2, 'hint arrow on a tile');
assert.deepStrictEqual([client.htx, client.htz], [3215, 3240]);
assert.ok(texts.some((t) => t.str === 'Dig here'));
assert.ok(pixels.some((p) => p !== 0));

// No clue: our arrow goes
show(null);
frame();
assert.strictEqual(client.ht, 0, 'arrow removed');

// A quest's own arrow from the server is left alone
client.ht = 1; client.hn = 9;
show(solve(byName('trail_clue_easy_simple005')));
frame();
assert.strictEqual(client.hn, 9, 'server arrow kept');
show(null);
frame();
assert.strictEqual(client.ht, 1, 'and not cleared');
console.log('clue scroll overlay: ok');

// ---- puzzle solver
const solveP = ll.__puzzleSolve;
const isSolved = (b) => b.every((v, i) => v === i);
const slide = (b, cell) => { const g = b.indexOf(24); const nb = [[-1, 1, -5, 5]].flat().map((d) => g + d); assert.ok(nb.includes(cell) && (Math.abs(cell - g) === 5 || ((cell / 5) | 0) === ((g / 5) | 0)), `legal move ${cell} gap ${g}`); b[g] = b[cell]; b[cell] = 24; };
let seed = 7;
const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
for (let t = 0; t < 40; t++) {
  const b = Array.from({ length: 25 }, (_, i) => i);
  for (let k = 0; k < 2000; k++) {
    const g = b.indexOf(24);
    const opts = [g - 5, g + 5].filter((x) => x >= 0 && x < 25).concat([g - 1, g + 1].filter((x) => x >= 0 && x < 25 && ((x / 5) | 0) === ((g / 5) | 0)));
    slide(b, opts[rnd(opts.length)]);
  }
  const t0 = Date.now();
  const moves = solveP(b.slice());
  assert.ok(moves, 'solvable');
  assert.ok(Date.now() - t0 < 500, 'fast');
  for (const m of moves) slide(b, m);
  assert.ok(isSolved(b), 'moves solve it');
}
assert.deepStrictEqual([...solveP(Array.from({ length: 25 }, (_, i) => i))], [], 'already solved');
console.log('puzzle solver: ok');

// The overlay on the open puzzle box
const PZ = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'plugins', 'cluescroll', 'puzzle.json'), 'utf8'));
assert.strictEqual(Object.keys(PZ.pieces).length, 72, 'three puzzles of 24 pieces');
const pieceObj = {}; // index -> obj id (one puzzle's set)
for (const [oid, idx] of Object.entries(PZ.pieces)) if (!(idx in pieceObj)) pieceObj[idx] = +oid;
const board = Array.from({ length: 25 }, (_, i) => i);
slide(board, 23); slide(board, 18); slide(board, 17);
const com = { io: board.map((v) => (v === 24 ? 0 : pieceObj[v] + 1)) };
const ifs = []; ifs[PZ.inv] = com;
client.modal = PZ.root;
ll.configure({ fields: Object.assign({}, ll.fields, { mainModal: 'modal', invObj: 'io' }), features: {} });
ll.setApi({ ifList: () => ifs });
const drawn = [];
const origRect = null;
cmd({ type: 'plugin-config', id: 'cluescroll', enabled: true, config: { clue: null, puzzle: PZ, solvePuzzle: true } });
texts.length = 0; ll.frame(client, 1);
assert.ok(texts.some((t) => t.str === 'Puzzle solver: 3 moves left'), texts.map((t) => t.str).join('|'));
// follow the plan: the count drops without re-solving
slide(board, 18); com.io = board.map((v) => (v === 24 ? 0 : pieceObj[v] + 1));
texts.length = 0; ll.frame(client, 1);
assert.ok(texts.some((t) => t.str === 'Puzzle solver: 2 moves left'));
slide(board, 23); slide(board, 24); com.io = board.map((v) => (v === 24 ? 0 : pieceObj[v] + 1));
texts.length = 0; ll.frame(client, 1);
assert.ok(texts.some((t) => /Puzzle solved/.test(t.str)));
// layer 0 doesn't draw the solver; other interfaces don't either
texts.length = 0; ll.frame(client, 0);
assert.ok(!texts.some((t) => /Puzzle/.test(t.str)));
client.modal = 5292;
texts.length = 0; ll.frame(client, 1);
assert.ok(!texts.some((t) => /Puzzle/.test(t.str)));
cmd({ type: 'plugin-config', id: 'cluescroll', enabled: true, config: { clue: null, puzzle: PZ, solvePuzzle: false } });
client.modal = PZ.root;
texts.length = 0; ll.frame(client, 1);
assert.ok(!texts.some((t) => /Puzzle/.test(t.str)), 'setting off');
console.log('puzzle overlay: ok');

// the challenge scroll comes before the anagram clue it was handed out for
{
  const sent = [];
  const listeners = [];
  const cs = require('../src/plugins/cluescroll/game')({ config: () => true, sendToGame: (m) => sent.push(m), log() {}, onRuntime: (fn) => { listeners.push(fn); return () => {}; } });
  global.window = global.window || { dispatchEvent() {} };
  global.CustomEvent = global.CustomEvent || function CustomEvent() {};
  cs.start();
  const anagram = Object.keys(require('../src/plugins/cluescroll/game').CLUES).find((k) => /anagram003$/.test(require('../src/plugins/cluescroll/game').CLUES[k].name));
  listeners.forEach((fn) => fn('items', { inventory: [{ id: Number(anagram) }, { id: 2846 }] }));
  const last = sent.filter((m) => m.config && m.config.clue).pop();
  assert.ok(last && last.config.clue.id === 2846 && last.config.clue.lines.includes('Answer: 40'), `challenge first: ${last && last.config.clue.title}`);
  console.log('challenge scroll: ok');
}

// a locked search: kill the NPC for the key, then search
{
  const { solve, CLUES } = require('../src/plugins/cluescroll/game');
  const s1 = solve(2835, []);
  assert.ok(s1.lines.includes('Kill Guard for the key') && s1.lines.includes('then search the drawer') && s1.npcIds.length === 1, s1.lines.join(' / '));
  const s2 = solve(2835, [{ id: CLUES[2835].key.id }]);
  assert.ok(s2.lines.includes('You have the key: search the drawer') && !s2.npcIds.length, s2.lines.join(' / '));
  assert.ok(solve(2839, []).lines.includes('Kill any man for the key'));
  console.log('clue keys: ok');
}
