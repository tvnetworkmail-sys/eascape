'use strict';
// Checks the runtime's menu engine (hide and swap rules) on a fake client menu laid out
// the way the 2004 client builds it: index 0 is Cancel, the top entry is count - 1.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parseLines } = require('../src/plugins/menuentryswapper/game');

const runtime = fs.readFileSync(path.join(__dirname, '..', 'src', 'runtime', 'runtime.js'), 'utf8');
const handlers = {};
const window = { postMessage() {}, addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); } };
const ctx = vm.createContext({ window, setInterval() {}, setTimeout() {}, clearTimeout() {}, performance: { now: () => 0 }, Int32Array, Math, String, Array, Object, RegExp, isFinite });
vm.runInContext(runtime, ctx);
const ll = vm.runInContext('window.__lostlite', ctx);
ll.configure({ fields: { menuCount: 'n', menuOption: 'o', menuAction: 'act', menuParamA: 'a', menuParamB: 'b', menuParamC: 'c' }, features: {} });

function menu(entries) {
  // entries listed top first, like the menu on screen; stored bottom first like the client
  const rev = ['Cancel', ...entries.slice().reverse().map((e) => e[0])];
  const ids = [[0, 0, 0], ...entries.slice().reverse().map((e) => e[1])];
  const c = { n: rev.length, o: rev.slice(), act: new Int32Array(500), a: new Int32Array(500), b: new Int32Array(500), c: new Int32Array(500) };
  ids.forEach((p, i) => { c.a[i] = p[0]; c.b[i] = p[1]; c.c[i] = p[2]; c.act[i] = 100 + i; });
  return c;
}
const top = (c) => c.o[c.n - 1];
function rules(r) { handlers.message.forEach((fn) => fn({ source: window, data: { __lostliteCmd: { type: 'menu-rules', ...r } } })); }

const MAN = [5, 10, 10];
const man = () => menu([['Talk-to @yel@Man @gre@(level-2)', MAN], ['Attack @yel@Man @gre@(level-2)', MAN], ['Pickpocket @yel@Man @gre@(level-2)', MAN], ['Walk here', [0, 3, 4]]]);

// Built-in NPC swap moves Pickpocket to the top, keeping its parameters with it
rules({ swaps: [{ option: 'pickpocket', target: '*', kind: 'npc' }] });
let c = man();
ll.menuBuilt(c);
assert.strictEqual(top(c), 'Pickpocket @yel@Man @gre@(level-2)');
assert.strictEqual(c.a[c.n - 1], 5);
assert.strictEqual(c.n, 5, 'nothing removed');
assert.strictEqual(c.o[0], 'Cancel');

// NPC-only rules don't touch players
c = menu([['Follow @whi@Zezima (level-126)', [7, 0, 0]], ['Trade with @whi@Zezima (level-126)', [7, 0, 0]]]);
rules({ swaps: [{ option: 'trade*', target: '*', kind: 'npc' }] });
ll.menuBuilt(c);
assert.strictEqual(top(c), 'Follow @whi@Zezima (level-126)');

// Different target instance (another Man) is never swapped in
c = menu([['Talk-to @yel@Man', MAN], ['Pickpocket @yel@Man', [6, 11, 11]]]);
rules({ swaps: [{ option: 'pickpocket', target: 'man' }] });
ll.menuBuilt(c);
assert.strictEqual(top(c), 'Talk-to @yel@Man');

// Custom rule with wildcard target
c = menu([['Chop down @cya@Oak tree', [9, 1, 1]], ['Examine @cya@Oak tree', [9, 1, 1]]]);
rules({ swaps: parseLines('examine, *tree') });
ll.menuBuilt(c);
assert.strictEqual(top(c), 'Examine @cya@Oak tree');

// Hide removes entries but never Cancel
c = man();
rules({ hide: parseLines('attack, man\ncancel') });
ll.menuBuilt(c);
assert.ok(!c.o.slice(0, c.n).some((o) => o.startsWith('Attack')));
assert.strictEqual(c.o[0], 'Cancel');
assert.strictEqual(c.n, 4);

// Shift swaps only while Shift is held
c = menu([['Use @lre@Bones', [526, 0, 3214]], ['Drop @lre@Bones', [526, 0, 3214]]]);
rules({ shiftSwaps: [{ option: 'drop', target: '*', kind: 'item' }] });
ll.menuBuilt(c);
assert.strictEqual(top(c), 'Use @lre@Bones');
handlers.keydown.forEach((fn) => fn({ key: 'Shift' }));
ll.menuBuilt(c);
assert.strictEqual(top(c), 'Drop @lre@Bones');
handlers.keyup.forEach((fn) => fn({ key: 'Shift' }));

// The bank booth from the screenshot: built-in Bank swap makes Use-quickly the left click
const BOOTH = [11, 50, 50];
const BANKER = [3, 51, 50];
const booth = () => menu([
  ['Use @cya@Bank booth', BOOTH], ['Use-quickly @cya@Bank booth', BOOTH], ['Talk-to @yel@Banker', BANKER], ['Bank @yel@Banker', BANKER],
  ['Walk here', [0, 50, 49]], ['Examine @cya@Bank booth', BOOTH], ['Examine @yel@Banker', BANKER],
]);
rules({ swaps: [{ option: 'bank', target: '*', kind: 'npc' }, { option: 'use-quickly', target: 'bank booth', kind: 'object' }] });
c = booth();
ll.menuBuilt(c);
assert.strictEqual(top(c), 'Use-quickly @cya@Bank booth');

// Walk here can be made the left click
rules({ swaps: [{ option: 'walk here', target: 'bank booth', kind: 'object' }] });
c = booth();
ll.menuBuilt(c);
assert.strictEqual(top(c), 'Walk here');

// The Hellhound from the screenshot: Attack is lowered under Walk here (the NPC is above
// your level) and an item lies under it, but a left click set for Hellhound still wins
const HH = [4, 0, 0];
const ARROW = [884, 30, 40];
const hellhound = (extra = []) => menu([...extra, ['Take @lre@Iron arrow', ARROW], ['Walk here', [0, 30, 40]], ['Examine @yel@Hellhound @red@(level-122)', HH],
  ['Attack @yel@Hellhound @red@(level-122)', HH], ['Examine @lre@Iron arrow', ARROW]]);
rules({ swaps: [{ option: 'attack', target: 'hellhound', kind: 'npc' }] });
c = hellhound();
ll.menuBuilt(c);
assert.strictEqual(top(c), 'Attack @yel@Hellhound @red@(level-122)');
assert.deepStrictEqual([c.a[c.n - 1], c.b[c.n - 1]], [4, 0], 'with its own target');
assert.strictEqual(c.n, 6, 'nothing removed');
// ...the same from a custom line
rules({ swaps: parseLines('attack, hellhound') });
c = hellhound();
ll.menuBuilt(c);
assert.strictEqual(top(c), 'Attack @yel@Hellhound @red@(level-122)');
// ...but not over another NPC that's in front of it
rules({ swaps: [{ option: 'attack', target: 'hellhound', kind: 'npc' }] });
c = hellhound([['Talk-to @yel@Man', MAN]]);
ll.menuBuilt(c);
assert.strictEqual(top(c), 'Talk-to @yel@Man');
// ...nor when Reset (the game's default) was chosen, nor from a catch-all line
rules({ swaps: [{ option: '<default>', target: 'hellhound', kind: 'npc' }, { option: 'attack', target: '*', kind: 'npc' }] });
c = hellhound();
ll.menuBuilt(c);
assert.strictEqual(top(c), 'Take @lre@Iron arrow');
rules({ swaps: [{ option: 'attack', target: '*', kind: 'npc' }] });
c = hellhound();
ll.menuBuilt(c);
assert.strictEqual(top(c), 'Take @lre@Iron arrow');

// Shift + right-click customisation: one entry per option, under each Examine, like the
// old RuneLite menu swapper; the left click itself is unchanged
const posted = [];
window.postMessage = (m) => posted.push(m);
rules({ swaps: [], customize: { left: true, shift: true } });
handlers.keydown.forEach((fn) => fn({ key: 'Shift' }));
c = booth();
const before = c.n;
ll.menuBuilt(c);
assert.strictEqual(top(c), 'Use @cya@Bank booth', 'left click unchanged');
let shown = c.o.slice(0, c.n).reverse(); // as on screen, top first
let ex = shown.indexOf('Examine @cya@Bank booth');
assert.deepStrictEqual(shown.slice(ex + 1, ex + 5), [
  'Swap left click Use @cya@Bank booth',
  'Swap shift click Use @cya@Bank booth',
  'Swap left click Use-quickly @cya@Bank booth',
  'Swap shift click Use-quickly @cya@Bank booth',
]);
assert.strictEqual(c.n, before + 4 + 4, 'four for the booth, four for the banker');
// Clicking one is handled by LostLite (the game's action is skipped) and reports the choice
const idx = c.o.indexOf('Swap left click Use-quickly @cya@Bank booth');
assert.strictEqual(ll.menuClick(c, idx), true);
const msg = posted.find((m) => m.type === 'menu-choose');
assert.deepStrictEqual(JSON.parse(JSON.stringify(msg.data)), { kind: 'object', target: 'bank booth', name: 'Bank booth', shift: false, option: 'Use-quickly' });
assert.strictEqual(ll.menuClick(c, c.o.indexOf('Talk-to @yel@Banker')), false, 'normal entries are left to the game');
// Once chosen, that option isn't offered again for that click type, and Reset appears
rules({ swaps: [], customize: { left: true, shift: true }, chosen: { 'left|object|bank booth': 'Use-quickly' } });
c = booth();
ll.menuBuilt(c);
shown = c.o.slice(0, c.n).reverse();
ex = shown.indexOf('Examine @cya@Bank booth');
assert.ok(!shown.includes('Swap left click Use-quickly @cya@Bank booth'));
assert.ok(shown.includes('Swap shift click Use-quickly @cya@Bank booth'));
assert.ok(shown.includes('Reset left click @cya@Bank booth'));
assert.strictEqual(ll.menuClick(c, c.o.indexOf('Reset left click @cya@Bank booth')), true);
assert.strictEqual(posted.filter((m) => m.type === 'menu-choose').pop().data.option, null);
handlers.keyup.forEach((fn) => fn({ key: 'Shift' }));
// Without Shift nothing is added
c = booth();
ll.menuBuilt(c);
assert.strictEqual(c.n, before);

// Your choice beats the tick boxes: Attack on a Paladin even with Pickpocket ticked
const PAL = [8, 20, 20];
const paladin = () => menu([['Pickpocket @yel@Paladin @gre@(level-62)', PAL], ['Attack @yel@Paladin @gre@(level-62)', PAL], ['Walk here', [0, 1, 1]]]);
rules({ swaps: [{ option: 'attack', target: 'paladin', kind: 'npc' }, { option: 'pickpocket', target: '*', kind: 'npc' }] });
c = paladin();
ll.menuBuilt(c);
assert.strictEqual(top(c), 'Attack @yel@Paladin @gre@(level-62)', 'Attack moved up over Pickpocket');
// Reset = game default: the Pickpocket tick box no longer applies to Paladins
rules({ swaps: [{ option: '<default>', target: 'paladin', kind: 'npc' }, { option: 'pickpocket', target: '*', kind: 'npc' }] });
c = menu([['Attack @yel@Paladin @gre@(level-62)', PAL], ['Pickpocket @yel@Paladin @gre@(level-62)', PAL]]);
ll.menuBuilt(c);
assert.strictEqual(top(c), 'Attack @yel@Paladin @gre@(level-62)');

assert.deepStrictEqual(parseLines('Bank, Banker\n  # comment\nPickpocket'), [{ option: 'bank', target: 'banker' }, { option: 'pickpocket', target: '*' }]);
console.log('menu: ok');
