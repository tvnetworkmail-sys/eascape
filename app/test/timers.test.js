'use strict';
// Timers & Buffs (page side) with the Info Boxes, against a fake client.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'src');
const window = { postMessage() {}, addEventListener() {} };
const ctx = vm.createContext({ window, document: { getElementById: () => null }, setInterval() {}, setTimeout() {}, clearTimeout() {}, performance: { now: () => ctx.__now }, Date, Int32Array, Math, String, Array, Object, RegExp, Proxy, Map, Set, JSON, Number, isFinite, parseInt });
ctx.__now = 1e6;
for (const f of ['runtime/runtime.js', 'plugins/infoboxes/page.js', 'plugins/timersandbuffs/page.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
const ll = vm.runInContext('window.__lostlite', ctx);
const plain = (x) => JSON.parse(JSON.stringify(x));

const varps = new Int32Array(300);
const me = { sp: -1, face: -1 };
const client = { lp: me, varps, base: new Int32Array(25).fill(50), boosted: new Int32Array(25).fill(50), xp: new Int32Array(25) };
ll.configure({ fields: { localPlayer: 'lp', varps: 'varps', statXP: 'xp', statBaseLevel: 'base', statEffectiveLevel: 'boosted', entitySpotanim: 'sp', faceEntity: 'face', iconData: 'cf' }, features: {} });
const drawnIcons = [];
ll.setApi({ pix: () => ({ pixels: new Int32Array(512 * 334), width: 512, height: 334 }), objIcon: (id) => { drawnIcons.push(id); const cf = new Int32Array(1024); cf[0] = 0x123456; return { cf }; } });
ll.client = client;
ll.loggedIn = true;
let inv = [{ id: 2448, quantity: 1 }, { id: 2446, quantity: 1 }];
ll.readContainer = () => inv.map((x) => (x ? Object.assign({}, x) : null));
const ibDefaults = {};
for (const it of require('../src/plugins/infoboxes/descriptor').config.items) ibDefaults[it.key] = it.default;
ll.pluginConfig({ id: 'infoboxes', enabled: true, config: Object.assign(ibDefaults, { layout: null }) });
const tDefaults = {};
for (const it of require('../src/plugins/timersandbuffs/descriptor').config.items) tDefaults[it.key] = it.default;
const icons = JSON.parse(fs.readFileSync(path.join(root, 'plugins', 'timersandbuffs', 'icons.json'), 'utf8'));
assert.ok(icons.bind && icons.snare && icons.entangle && icons.charge && icons.thieving, 'spell and thieving icons');
const tConfig = (over) => ll.pluginConfig({ id: 'timersandbuffs', enabled: true, config: Object.assign({}, tDefaults, { icons }, over) });
tConfig({});

const game = (text) => ll.onChat(0, text, '');
const frame = () => { ll.tick(client); ll.frame(client, 0); ll.frame(client, 1); };
const boxes = () => plain(ll.__infoBoxes.drawn().flatMap((g) => g.boxes || []).map((p) => [p.box.name, p.box.text, p.box.tooltip]));
const find = (name) => boxes().find((b) => b[0] === name);

frame();
assert.deepStrictEqual(boxes(), [], 'nothing yet');

// ---- antifire: the 2004 message is "dragon potion"; 6:00
game('You drink some of your dragon potion.');
frame();
assert.deepStrictEqual(find('Antifire'), ['Antifire', '6:00', 'Antifire']);
frame();
assert.ok(drawnIcons.includes(2452), 'the game draws the antifire potion icon');
const box = ll.__infoBoxes.drawn().flatMap((g) => g.boxes || []).find((p) => p.box.name === 'Antifire').box;
assert.ok(box.image && box.image.w === 32 && (box.image.px[0] >>> 0) === 0xff123456 && box.image.px[1] === 0, 'icon pixels (0 = see-through)');
ctx.__now += 5 * 60 * 1000 + 30000;
frame();
const af = ll.__infoBoxes.drawn().flatMap((g) => g.boxes || []).find((p) => p.box.name === 'Antifire').box;
assert.ok(af.text === '0:30' && af.colour === 0xff3333, 'red in the last 10%');
console.log('antifire: ok');

// ---- antipoison: same message for both; the potion that went down says which
game('You drink some of your antipoison potion.');
inv = [{ id: 183, quantity: 1 }, { id: 2446, quantity: 1 }]; // the 4-dose super went to 3 doses... (183 = 2 dose, any change counts)
frame();
assert.deepStrictEqual(find('Antipoison'), ['Antipoison', '6:00', 'Superantipoison'], 'super: 20 cycles of 30 ticks');
game('You drink some of your antipoison potion.');
inv = [{ id: 183, quantity: 1 }, { id: 175, quantity: 1 }];
frame();
assert.deepStrictEqual(find('Antipoison'), ['Antipoison', '1:30', 'Antipoison'], 'normal: 5 cycles');
console.log('antipoison: ok');

// ---- charge
game('You feel charged with magic power.');
frame();
assert.deepStrictEqual(find('Charge'), ['Charge', '7:00', 'Charge']);
game('Your magical charge fades away.');
frame();
assert.ok(!find('Charge'), 'gone when it fades');

// ---- freeze from the spot animation landing on you; halved with Protect from Magic
me.sp = 181; // bind_impact
frame();
assert.deepStrictEqual(find('Freeze'), ['Freeze', '0:05', 'Bind']);
me.sp = -1;
frame();
varps[83 + 12] = 1;
me.sp = 179; // entangle_impact
frame();
assert.deepStrictEqual(find('Freeze'), ['Freeze', '0:08', 'Entangle'], '24 ticks halved: 12 ticks = 7.2 s');
varps[83 + 12] = 0;
console.log('charge / freeze: ok');

// ---- pickpocket stun
game("You've been stunned!");
frame();
assert.deepStrictEqual(find('Stunned'), ['Stunned', '0:05', 'Stunned']);

// ---- switched off in the settings: the box goes, the timer keeps running
tConfig({ showAntiFire: false });
frame();
assert.ok(!find('Antifire') && find('Antipoison'), 'antifire hidden');
tConfig({});
frame();
assert.ok(find('Antifire'), 'and back');

// ---- logging out: antifire and antipoison carry on after the next login, the rest end
// the login screen draws no frames: the timers notice on their own
client.lp = null;
ll.loggedIn = false;
ll.__timers.loginCheck(ctx.__now);
ctx.__now += 10 * 60 * 1000;
client.lp = me;
ll.loggedIn = true;
frame();
const names = boxes().map((b) => b[0]);
assert.ok(names.includes('Antifire') && names.includes('Antipoison') && !names.includes('Stunned'), `after login: ${names}`);
assert.strictEqual(find('Antifire')[1], '0:30', 'paused while logged out');
ctx.__now += 31000;
frame();
assert.ok(!find('Antifire'), 'ends');
console.log('timers & buffs: ok');
