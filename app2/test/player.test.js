'use strict';
// Local player, run energy / weight / prayer / special attack, inventory and equipment, as
// the runtime reads them through the field map the patcher finds.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const runtime = fs.readFileSync(path.join(__dirname, '..', 'src', 'runtime', 'runtime.js'), 'utf8');
const posted = [];
const handlers = {};
const timers = [];
const window = { postMessage: (m) => posted.push(m), addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); } };
const ctx = vm.createContext({ window, setInterval: (fn) => timers.push(fn), setTimeout() {}, clearTimeout() {}, performance: { now: () => 0 }, Int32Array, Math, String, Array, Object, RegExp, Proxy, Map, JSON, BigInt, isFinite });
vm.runInContext(runtime, ctx);
const ll = vm.runInContext('window.__lostlite', ctx);

const NAMES = { 1351: 'Bronze axe', 995: 'Coins', 1277: 'Bronze sword', 1171: 'Wooden shield' };
const inv = { o: new Int32Array(28), n: new Int32Array(28) };
inv.o[0] = 1351 + 1; inv.n[0] = 1;
inv.o[5] = 995 + 1; inv.n[5] = 2500;
const worn = { o: new Int32Array(14), n: new Int32Array(14) };
worn.o[3] = 1277 + 1; worn.n[3] = 1;
worn.o[5] = 1171 + 1; worn.n[5] = 1;
const list = []; list[3214] = inv; list[1688] = worn;

const me = { px: 0, pz: 0, anim: -1, cc: -1000, hp: 0, th: 0, face: -1, nm: 'Tester', cl: 42 };
const varps = new Int32Array(2000); varps[300] = 750; varps[301] = 0;
const base = new Int32Array(21); const eff = new Int32Array(21);
base[3] = 30; eff[3] = 27; base[5] = 20; eff[5] = 15;
const client = { lp: me, lvl: 0, bx: 3200, bz: 3200, re: 87, rw: 12, vp: varps, xp: new Int32Array(21), bl: base, el: eff };
let loop = 100;

ll.configure({ fields: {
  statXP: 'xp', statBaseLevel: 'bl', statEffectiveLevel: 'el',
  localPlayer: 'lp', level: 'lvl', baseX: 'bx', baseZ: 'bz', entityX: 'px', entityZ: 'pz', primaryAnim: 'anim',
  combatCycle: 'cc', health: 'hp', totalHealth: 'th', faceEntity: 'face', playerName: 'nm', combatLevel: 'cl',
  runEnergy: 're', runWeight: 'rw', varps: 'vp', invObj: 'o', invCount: 'n', objName: 'nm2',
}, features: {} });
ll.setApi({ ifList: () => list, obj: (id) => ({ nm2: NAMES[id] }) });
ll.setApi({ loopCycle: () => loop });
assert.ok(ll.api.ifList && ll.api.loopCycle, 'setApi merges');

// Lumbridge-ish: scene tile (22, 18) -> world 3222, 3218
me.px = 22 * 128 + 64; me.pz = 18 * 128 + 64;
ll.tick(client);
timers[0]();
const last = (type) => posted.filter((m) => m.type === type).pop();
let p = last('player').data;
assert.strictEqual(p.name, 'Tester');
assert.strictEqual(p.combatLevel, 42);
assert.deepStrictEqual([p.x, p.y, p.plane], [3222, 3218, 0]);
assert.strictEqual(p.region, (50 << 8) | 50, 'region id like RuneLite');
assert.strictEqual(p.hitpoints, 27);
assert.strictEqual(p.maxHitpoints, 30);
assert.strictEqual(p.runEnergy, 87);
assert.strictEqual(p.weight, 12);
assert.strictEqual(p.prayer, 15);
assert.strictEqual(p.specialAttack, 75);
assert.strictEqual(p.inCombat, false);
assert.strictEqual(p.interacting, null);
assert.strictEqual(p.moving, false);

// Walk a tile, get hit by NPC 12
const count = posted.filter((m) => m.type === 'player').length;
me.px += 128; me.cc = loop + 400; me.face = 12;
timers[0]();
p = last('player').data;
assert.strictEqual(p.x, 3223);
assert.strictEqual(p.moving, true);
assert.strictEqual(p.inCombat, true);
assert.deepStrictEqual({ ...p.interacting }, { type: 'npc', index: 12 });
me.face = 32768 + 5;
timers[0]();
assert.deepStrictEqual({ ...last('player').data.interacting }, { type: 'player', index: 5 });
loop += 500;
timers[0]();
assert.strictEqual(last('player').data.inCombat, false, 'combat ends 400 cycles after the last hit');
assert.ok(posted.filter((m) => m.type === 'player').length > count);

// Nothing changed: nothing posted
const before = posted.length;
timers[0]();
timers[0]();
assert.strictEqual(posted.filter((m) => m.type === 'player').length, posted.slice(0, before).filter((m) => m.type === 'player').length, 'only changes are posted');

// Items
const items = last('items').data;
assert.strictEqual(items.inventory.length, 28);
assert.deepStrictEqual({ ...items.inventory[0] }, { id: 1351, quantity: 1, name: 'Bronze axe' });
assert.deepStrictEqual({ ...items.inventory[5] }, { id: 995, quantity: 2500, name: 'Coins' });
assert.strictEqual(items.inventory[1], null);
assert.strictEqual(items.equipment.weapon.name, 'Bronze sword');
assert.strictEqual(items.equipment.shield.name, 'Wooden shield');
assert.strictEqual(items.equipment.head, null);
assert.ok(!('6' in items.equipment), 'unused slots left out');
inv.n[5] = 2400;
timers[0]();
assert.strictEqual(last('items').data.inventory[5].quantity, 2400, 'updates when coins are spent');
console.log('player and items: ok');

// Tab to reply
Object.assign(ll.fields, {
  friendCount: 'fc', friendUserhash: 'fh', friendWorld: 'fw', friendUsername: 'fn', socialRedraw: 'rc', socialDialogOpen: 'dio',
  socialInputOpen2: 'sio', socialInput: 'si', socialInputType: 'sit', socialUserhash: 'suh', socialInputHeader: 'sih',
  addChat: 'ac', chatType: 'ct', chatUsername: 'cu', chatText: 'cx',
});
ll.setApi({ toUserhash: (n) => BigInt(n.toLowerCase().length * 1000 + n.toLowerCase().charCodeAt(0)) });
const hashOf = (n) => ll.api.toUserhash(n);
const chat = [];
Object.assign(client, {
  fc: 2, fh: [hashOf('Alice'), hashOf('Bobby')], fw: [2, 0], fn: ['Alice', 'Bobby'], rc: false, dio: false, sio: false, si: 'x', sit: 0, suh: 0n, sih: '',
  ct: new Int32Array(100), cu: [], cx: [], ac: (t, text) => chat.push(text),
});
const cmd = (c) => handlers.message.forEach((fn) => fn({ source: window, data: { __lostliteCmd: c } }));
cmd({ type: 'reply-last' });
assert.strictEqual(client.sio, false, 'no private messages yet: nothing happens');
client.ct[0] = 2; client.cu[0] = 'Zed'; // public chat
client.ct[1] = 7; client.cu[1] = '@cr1@Alice'; // PM from Alice (moderator crown)
client.ct[2] = 3; client.cu[2] = 'Bobby';
cmd({ type: 'reply-last' });
assert.strictEqual(client.sio, true, 'prompt opened');
assert.strictEqual(client.sit, 3);
assert.strictEqual(client.si, '');
assert.strictEqual(client.suh, hashOf('Alice'));
assert.strictEqual(client.sih, 'Enter message to send to Alice');
assert.strictEqual(client.rc, true);
// Already typing: Tab does nothing
client.sih = 'x';
cmd({ type: 'reply-last' });
assert.strictEqual(client.sih, 'x');
// Bobby offline
client.sio = false;
client.ct[1] = 0;
cmd({ type: 'reply-last' });
assert.strictEqual(client.sio, false, 'offline friend: no prompt');
assert.ok(/Bobby is not online/.test(chat.pop()), 'explains why');
console.log('tab to reply: ok');

// Status orbs: run toggles through the controls tab's Walk/Run buttons, spec through the
// visible special attack bar, prayer opens the prayer tab; all via the client's doAction.
{
  const pressed = [];
  Object.assign(ll.fields, {
    doAction: 'da', buttons: { ok: 31, toggle: 291, select: 793 }, comButtonType: 'bt', comScripts: 'scr', comOperand: 'opd', comHide: 'hid', sideIcon: 'si', activeTab: 'at', redrawSide: 'rs', redrawIcons: 'ri',
    menuCount: 'mn', menuOption: 'mo', menuAction: 'ma', menuParamA: 'pa', menuParamB: 'pb', menuParamC: 'pc',
  });
  Object.assign(client, {
    mn: 2, mo: ['Cancel', 'Walk here'], ma: new Int32Array(500), pa: new Int32Array(500), pb: new Int32Array(500), pc: new Int32Array(500),
    si: new Int32Array([1764, 0, 0, 0, 0, 541, 0]), at: 3, rs: false, ri: false,
    da(i) { pressed.push([client.ma[i], client.pc[i], i]); },
  });
  client.ma[2] = 55; client.pc[2] = 66;
  list[7549] = { hid: false };
  list[300] = { bt: 5, scr: [[5, 173, 0]], opd: [0] }; // this world's Walk
  list[301] = { bt: 5, scr: [[5, 173, 0]], opd: [1] }; // and Run
  client.vp[173] = 0;
  cmd({ type: 'orb', which: 'run' });
  assert.deepStrictEqual(pressed.pop(), [793, 301, 2], 'run: the select button that sets option_run to 1, in a spare slot');
  assert.strictEqual(client.ma[2], 55, 'spare slot restored');
  client.vp[173] = 1;
  cmd({ type: 'orb', which: 'run' });
  assert.deepStrictEqual(pressed.pop().slice(0, 2), [793, 300], 'running: Walk');
  cmd({ type: 'orb', which: 'spec' });
  assert.deepStrictEqual(pressed.pop().slice(0, 2), [31, 7537], 'spec: the bow special attack bar');
  list[7549].hid = true;
  cmd({ type: 'orb', which: 'spec' });
  assert.strictEqual(pressed.length, 0, 'no special attack: nothing pressed');
  cmd({ type: 'orb', which: 'prayer' });
  assert.strictEqual(client.at, 5, 'prayer tab opened');
  assert.ok(client.rs && client.ri);
  console.log('status orbs: ok');
}
