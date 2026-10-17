'use strict';
// 0.17 features against fakes: the chat hook, scene objects, Idle Notifier, XP Drops and the
// XP Tracker panel's numbers.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'src');

// ---------------------------------------------------------------- runtime: chat and objects
{
  const posted = [];
  const window = { postMessage: (m) => posted.push(m), addEventListener() {} };
  const ctx = vm.createContext({ window, document: { getElementById: () => null }, setInterval() {}, setTimeout() {}, clearTimeout() {}, performance: { now: () => 0 }, Date, Int32Array, Math, String, Array, Object, RegExp, Proxy, Map, Set, JSON, Number, isFinite, parseInt });
  vm.runInContext(fs.readFileSync(path.join(root, 'runtime', 'runtime.js'), 'utf8'), ctx);
  const ll = vm.runInContext('window.__lostlite', ctx);
  ll.configure({ fields: {
    addChat: 'ac', localPlayer: 'lp', entityX: 'ex', entityZ: 'ez', level: 'lvl',
    sceneWorld: 'w', sceneWall: 'wa', sceneDecor: 'de', sceneLoc: 'lo', sceneGroundDecor: 'gd', sceneInfo: 'inf', locName: 'nm',
  }, features: {} });
  const added = [];
  const client = { ac(type, text, sender) { added.push([type, text, sender]); } };
  ll.hookChat(client);
  client.ac(2, '@yel@Hello there', '@cr1@Mod Ash');
  client.ac(0, 'Welcome to RuneScape.', '');
  assert.deepStrictEqual(added.map((a) => a[0]), [2, 0], 'game still gets its messages');
  const msgs = posted.filter((m) => JSON.stringify(m).includes('Welcome to RuneScape'));
  const log = ll.chatLog;
  assert.strictEqual(log.length, 2);
  assert.strictEqual(log[0].kind, 'public');
  assert.strictEqual(log[0].name, 'Mod Ash');
  assert.strictEqual(log[0].text, 'Hello there');
  assert.strictEqual(log[1].kind, 'game');
  assert.strictEqual(msgs.length, 1, 'chat posted');
  ll.client = client;
  ll.command({ type: 'game-message', text: 'Zezima is now idle!' });
  assert.deepStrictEqual(added[2], [0, 'Zezima is now idle!', ''], 'notification in the chat box');
  // screen flash: red at ~27% over the game view, flashing, until the game sees input
  let nowMs = 0;
  vm.runInContext('performance.now = () => globalThis.__now', ctx);
  ctx.__now = 1000;
  const pix = new Int32Array(512 * 334).fill(0x000000);
  ll.setApi({ pix: () => ({ pixels: pix, width: 512, height: 334 }) });
  ll.fields.idleTimer = 'it';
  client.it = 900;
  ll.command({ type: 'flash', mode: 'until', colour: '#46FF0000' });
  ll.frame(client, 1);
  assert.ok((pix[100] >> 16 & 255) > 50 && (pix[100] & 0xffff) === 0, `tinted red: ${pix[100].toString(16)}`);
  pix.fill(0);
  ctx.__now = 1700;
  ll.frame(client, 1);
  assert.strictEqual(pix[100], 0, 'off half the time');
  ctx.__now = 2100;
  ll.frame(client, 1);
  assert.ok(pix[100] !== 0, 'and on again');
  client.it = 2150; // mouse moved
  pix.fill(0);
  ctx.__now = 3100;
  ll.frame(client, 1);
  assert.strictEqual(pix[100], 0, 'cancelled by input');
  ll.command({ type: 'flash', mode: 'once', colour: '#46FF0000' });
  ctx.__now = 5200;
  ll.frame(client, 1);
  assert.strictEqual(ll.flashState, null, 'flash once ends after 2 s');
  void nowMs;
  // the idle timer
  ctx.__now = 50000;
  client.it = 20000;
  assert.strictEqual(ll.idleMs(), 30000);
  console.log('chat hook: ok');

  // scene: a door (wall) and a tree (scenery) next to you
  const tc = (id) => (id << 14) | 1 | (2 << 29);
  const world = {
    wa: (l, x, z) => (l === 0 && x === 51 && z === 50 ? tc(1530) : 0),
    de: () => 0,
    lo: (l, x, z) => (l === 0 && x === 49 && z === 52 ? tc(1276) : 0),
    gd: () => 0,
    inf: (l, x, z, t) => (t === tc(1530) ? 0 | (1 << 6) : 10),
  };
  const NAMES = { 1530: 'Door', 1276: 'Tree' };
  ll.setApi({ loc: (id) => ({ nm: NAMES[id] || 'null' }) });
  const c = { w: world, lvl: 0, lp: { ex: 50 * 128 + 64, ez: 50 * 128 + 64 } };
  const objs = ll.readObjects(c, 5);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(objs.map((o) => [o.kind, o.id, o.name, o.x, o.z]))), [['scenery', 1276, 'Tree', 49, 52], ['wall', 1530, 'Door', 51, 50]]);
  assert.strictEqual(objs[1].angle, 1);
  assert.strictEqual(objs[0].shape, 10);
  console.log('scene objects: ok');
}

// ---------------------------------------------------------------- idle notifier
{
  let t = 100000;
  const realNow = Date.now;
  Date.now = () => t;
  const intervals = [];
  const realSet = global.setInterval;
  const realClear = global.clearInterval;
  global.setInterval = (fn) => { intervals.push(fn); return intervals.length; };
  global.clearInterval = () => {};
  global.window = { addEventListener() {}, removeEventListener() {} };
  const sent = [];
  let listener = null;
  const cfg = { animationIdle: true, interactionIdle: true, logoutIdle: true, timeout: 5000, hitpoints: 10, prayer: 0, lowEnergy: 100, specEnergy: 0 };
  const ctx = { config: (k) => cfg[k], notify: (title, text) => sent.push(text), onRuntime: (fn) => { listener = fn; return () => {}; } };
  const p = require('../src/plugins/idlenotifier/game')(ctx);
  p.start();
  const tick = () => intervals[0]();
  const player = (o) => listener('player', Object.assign({ name: 'Zezima', animation: -1, hitpoints: 40, runEnergy: 100 }, o));
  player({});
  player({ animation: 879 }); // woodcutting
  t += 4000;
  player({ animation: -1 });
  t += 4000;
  tick();
  assert.deepStrictEqual(sent, [], 'waits for the timeout');
  t += 1100;
  tick();
  assert.deepStrictEqual(sent, ['Zezima is now idle!']);
  // a quick one-off animation (eating) doesn't count
  player({ animation: 829 });
  t += 600;
  player({ animation: -1 });
  t += 6000;
  tick();
  assert.strictEqual(sent.length, 1, 'short animation ignored');
  // combat
  player({ interacting: { type: 'npc', index: 9 } }); // talking to a banker
  t += 3000;
  player({ interacting: null });
  t += 5100;
  tick();
  assert.strictEqual(sent.length, 1, 'talking is not fighting');
  player({ interacting: { type: 'npc', index: 3 } });
  t += 1200;
  player({ interacting: { type: 'npc', index: 3 }, inCombat: true });
  t += 3000;
  player({ interacting: null });
  t += 5100;
  tick();
  assert.strictEqual(sent[1], 'Zezima is now out of combat!');
  // low hitpoints once, again only after healing
  player({ hitpoints: 8 });
  player({ hitpoints: 7 });
  player({ hitpoints: 30 });
  player({ hitpoints: 9 });
  assert.deepStrictEqual(sent.slice(2), ['Zezima has low hitpoints!', 'Zezima has low hitpoints!']);
  // idle logout: the game's timer says 90 s; warn 20 s before
  listener('idle', { ms: 60000 });
  tick();
  assert.strictEqual(sent.length, 4, 'not yet at 60 s');
  t += 10000;
  tick();
  assert.strictEqual(sent[4], 'Zezima is about to log out from idling too long!', 'warned at 70 s');
  t += 1000;
  tick();
  assert.strictEqual(sent.length, 5, 'warned once');
  listener('idle', { ms: 500 }); // moved the mouse
  listener('idle', { ms: 71000 });
  tick();
  assert.strictEqual(sent.length, 6, 'warns again after the next idle spell');
  p.stop();
  Date.now = realNow;
  global.setInterval = realSet;
  global.clearInterval = realClear;
  console.log('idle notifier: ok');
}

// ---------------------------------------------------------------- xp drops (page side)
{
  let now = 0;
  const window = { postMessage() {}, addEventListener() {} };
  const ctx = vm.createContext({ window, document: { getElementById: () => null }, setInterval() {}, setTimeout() {}, clearTimeout() {}, performance: { now: () => now }, Date, Int32Array, Math, String, Array, Object, RegExp, Proxy, Map, Set, JSON, Number, isFinite, parseInt });
  vm.runInContext(fs.readFileSync(path.join(root, 'runtime', 'runtime.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins', 'xpdrops', 'page.js'), 'utf8'), ctx);
  const ll = vm.runInContext('window.__lostlite', ctx);
  const texts = [];
  const font = { tag(str, x, y, rgb) { texts.push({ str, x, y, rgb }); }, wid(str) { return String(str).length * 7; } };
  const xp = new Int32Array(25);
  const base = new Int32Array(25).fill(1);
  const client = { lp: {}, xp, base, b12: font, p11: font, p12: font };
  const pixels = new Int32Array(512 * 334);
  ll.configure({ fields: { localPlayer: 'lp', statXP: 'xp', statBaseLevel: 'base', fontB12: 'b12', fontP11: 'p11', fontP12: 'p12', fontDrawTag: 'tag', fontWidth: 'wid' }, features: {} });
  ll.setApi({ pix: () => ({ pixels, width: 512, height: 334 }), loopCycle: () => 0 });
  ll.client = client;
  const icons = JSON.parse(fs.readFileSync(path.join(root, 'plugins', 'xpdrops', 'icons.json'), 'utf8'));
  assert.ok(icons.attack && icons.attack.h <= 15 && icons.attack.px.length === icons.attack.w * icons.attack.h, 'icons built');
  ll.pluginConfig({ id: 'xpdrops', enabled: true, config: { showIcons: true, colour: '#FF00FF00', duration: 2000, groupDrops: true, showCounter: true, icons } });
  const frame = () => { texts.length = 0; pixels.fill(0); ll.frame(client, 0); return texts.map((t) => t.str); };
  xp[0] = 100; xp[3] = 1200; // attack, hitpoints
  assert.deepStrictEqual(frame(), ['XP: 1,300'], 'counter shows total XP');
  now = 1000; xp[0] = 50000; // stats filling in just after login: not a drop
  frame();
  now = 2500;
  assert.deepStrictEqual(frame(), ['XP: 51,200']);
  xp[0] += 40; xp[3] += 13;
  const shown = frame();
  assert.deepStrictEqual(shown, ['XP: 51,253', '53'], 'grouped drop');
  const drop = texts[1];
  assert.strictEqual(drop.rgb, 0x00ff00, 'drop colour');
  assert.ok(drop.y > 100, `starts low: ${drop.y}`);
  // the icons are drawn left of the number
  let iconPx = 0;
  for (let y = drop.y - 16; y < drop.y + 4; y++) for (let x = 400; x < drop.x; x++) if (pixels[y * 512 + x]) iconPx++;
  assert.ok(iconPx > 100, `skill icons drawn (${iconPx} px)`);
  now += 1000;
  frame();
  assert.ok(texts[1].y < drop.y - 40, 'rises');
  now += 1100;
  assert.deepStrictEqual(frame(), ['XP: 51,253'], 'gone at the counter');
  ll.pluginConfig({ id: 'xpdrops', enabled: true, config: { showIcons: false, duration: 2000, groupDrops: false, showCounter: false } });
  xp[0] += 40; xp[3] += 13;
  frame();
  const ys = texts.map((t) => t.y);
  assert.deepStrictEqual(texts.map((t) => t.str), ['40', '13'], 'one drop each, no counter');
  assert.ok(ys[1] - ys[0] >= 16, 'second drop queued below the first');
  client.lp = null;
  assert.deepStrictEqual(frame(), [], 'nothing when logged out');
  console.log('xp drops: ok');
}

// ---------------------------------------------------------------- xp tracker panel
function loadTracker(conf, clock) {
  let onEvent = null;
  const panels = [];
  const state = { loggedIn: true };
  const sandbox = {
    UI: { h: () => ({}) },
    App: { state, config: (id, k, d) => (k in conf ? conf[k] : d), setConfig: (id, k, v) => { conf[k] = JSON.parse(JSON.stringify(v)); }, renderPanel() {} },
    Date: { now: () => clock.t }, Math, Map, Object, Array, Number, String, JSON, setInterval() {},
  };
  sandbox.window = { Panels: panels, lostlite: { onEvent: (fn) => { onEvent = fn; } }, addEventListener() {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'ui', 'panels', 'xptracker.js'), 'utf8'), sandbox);
  return { xt: sandbox.window.__xpTracker, send: (d) => onEvent({ type: 'patch', data: d }), panels, state };
}
{
  const clock = { t: 1e9 };
  const conf = {};
  let { xt, send, panels, state } = loadTracker(conf, clock);
  assert.strictEqual(xt.XP[1], 83, 'level 2 at 83 xp');
  assert.strictEqual(xt.XP[98], 13034431, 'level 99 at 13,034,431');
  assert.strictEqual(xt.levelFor(83), 2);
  assert.deepStrictEqual([xt.short(8040), xt.short(21300), xt.short(353840), xt.short(1256000)], ['8040', '21.3K', '353.8K', '1.25M'], 'RuneLite number style');
  const stats = (wc) => ({ stats: [{ skill: 'woodcutting', xp: wc }, { skill: 'attack', xp: 0 }] });
  send({ player: { name: 'Tester' } });
  send(stats(1000));
  for (let i = 0; i < 60; i++) { clock.t += 1000; xt.tick(clock.t); }
  send(stats(1025));
  for (let i = 0; i < 60; i++) { clock.t += 1000; xt.tick(clock.t); }
  send(stats(1050));
  const s = xt.session().get('woodcutting');
  assert.ok(s && s.start === 1000 && s.xp === 1050 && s.actions === 2, 'session counts gains');
  assert.ok(!xt.session().has('attack'), 'untrained skills not shown');
  assert.strictEqual(s.active, 60000, 'a minute logged in since the first gain');
  assert.strictEqual(Math.round(xt.rate(s)), 3000, '50 xp in a minute = 3,000/hr');
  // logged out time doesn't count
  send({ loggedIn: false });
  state.loggedIn = false;
  for (let i = 0; i < 30; i++) { clock.t += 1000; xt.tick(clock.t); }
  assert.strictEqual(s.active, 60000, 'paused while logged out');
  assert.ok(conf.sessions && conf.sessions.tester && conf.sessions.tester.woodcutting.xp === 1050, 'saved on logout');
  // LostLite closed and opened again (hours later): carries on where it left off
  clock.t += 5 * 3600000;
  ({ xt, send, state } = loadTracker(conf, clock));
  send({ player: { name: 'Tester' } });
  send({ loggedIn: true });
  send(stats(1080)); // 30 xp gained in another client meanwhile: not counted
  const s2 = xt.session().get('woodcutting');
  assert.ok(s2 && s2.xp === 1080 && s2.xp - s2.start === 50 && s2.active === 60000, `restored: ${JSON.stringify(s2)}`);
  send(stats(1100));
  assert.strictEqual(s2.xp - s2.start, 70, 'keeps counting');
  // another account has its own
  send({ player: { name: 'Alt' } });
  assert.strictEqual(xt.session().size, 0, 'alt starts empty');
  send({ player: { name: 'Tester' } });
  assert.strictEqual(xt.session().get('woodcutting').xp, 1100, 'back to the main');
  console.log('xp tracker: ok');
}


// ---------------------------------------------------------------- mouse wheel scrolling
{
  const ctx = vm.createContext({ window: { postMessage() {}, addEventListener() {} }, document: { getElementById: () => null }, setInterval() {}, setTimeout() {}, clearTimeout() {}, performance: { now: () => 0 }, Date, Int32Array, Math, String, Array, Object, RegExp, Proxy, Map, Set, JSON, Number, isFinite, parseInt });
  vm.runInContext(fs.readFileSync(path.join(root, 'runtime', 'runtime.js'), 'utf8'), ctx);
  const ll = vm.runInContext('window.__lostlite', ctx);
  Object.assign(ll.fields, { comType: 't', comChildren: 'ch', comHide: 'hd', comWidth: 'w', comHeight: 'h', comChildX: 'cx', comChildY: 'cy', comX: 'x', comY: 'y', comScrollHeight: 'sh', scrollPos: 'sp', mainModal: 'mm', sideModal: 'sm', sideIcon: 'si', activeTab: 'at', redrawSide: 'rs', chatModal: 'cm', redrawChat: 'rc' });
  // a bank-like window: root 10 (at 4,4) holds layer 11 at (20, 40), 300 x 200, 1000 tall
  const list = [];
  list[10] = { t: 0, ch: [11], cx: [20], cy: [40], w: 512, h: 334, x: 0, y: 0, sh: 0, sp: 0 };
  list[11] = { t: 0, ch: [], cx: [], cy: [], w: 300, h: 200, x: 0, y: 0, sh: 1000, sp: 0 };
  // a side tab (skills guide style) with its own scrolling layer
  list[20] = { t: 0, ch: [21], cx: [0], cy: [0], w: 190, h: 261, x: 0, y: 0, sh: 0, sp: 0 };
  list[21] = { t: 0, ch: [], cx: [], cy: [], w: 170, h: 200, x: 0, y: 0, sh: 400, sp: 0 };
  ll.api = { ifList: () => list };
  ll.loggedIn = true;
  ll.client = { mm: 10, sm: -1, si: [20], at: 0, cm: -1, rs: false };
  assert.strictEqual(ll.wheelScroll(100, 100, 1), true, 'over the bank items');
  assert.strictEqual(list[11].sp, 45, 'one notch down');
  ll.wheelScroll(100, 100, -1);
  ll.wheelScroll(100, 100, -1);
  assert.strictEqual(list[11].sp, 0, 'not above the top');
  for (let i = 0; i < 30; i++) ll.wheelScroll(100, 100, 1);
  assert.strictEqual(list[11].sp, 800, 'not past the bottom');
  assert.strictEqual(ll.wheelScroll(400, 300, 1), false, 'outside the scrolling part: the camera zooms');
  ll.client.mm = -1;
  assert.strictEqual(ll.wheelScroll(600, 250, 1), true, 'the side tab');
  assert.ok(list[21].sp === 45 && ll.client.rs === true, 'scrolled and redrawn');
  console.log('wheel scrolling: ok');
}
