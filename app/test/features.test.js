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

// ---------------------------------------------------------------- xp tracker (game side)
function loadTracker(conf, clock) {
  let onRuntime = null;
  let reported = null;
  const sent = [];
  let tick = null;
  const ctx = {
    config: (k) => conf[k],
    state: (k, d) => (k in conf ? conf[k] : d),
    setState: (k, v) => { conf[k] = JSON.parse(JSON.stringify(v)); },
    onRuntime: (fn) => { onRuntime = fn; return () => {}; },
    report: (d) => { reported = d; },
    sendToGame: (m) => sent.push(m),
    log() {},
  };
  const realNow = Date.now;
  const realInterval = global.setInterval;
  Date.now = () => clock.t;
  global.setInterval = (fn) => { tick = fn; return 1; };
  delete require.cache[require.resolve(path.join(root, 'plugins', 'xptracker', 'game.js'))];
  const inst = require(path.join(root, 'plugins', 'xptracker', 'game.js'))(ctx);
  inst.start();
  global.setInterval = realInterval;
  return {
    inst, sent,
    send: (type, data) => onRuntime(type, data),
    ticks: (n) => { for (let i = 0; i < n; i++) { clock.t += 1000; tick(); } },
    rep: () => reported,
    restore: () => { Date.now = realNow; },
  };
}
{
  const clock = { t: 1e9 };
  const conf = {};
  let t = loadTracker(conf, clock);
  const stats = (wc, sl = 0) => [{ skill: 'woodcutting', xp: wc }, { skill: 'attack', xp: 0 }, { skill: 'slayer', xp: sl }];
  t.send('player', { name: 'Tester' });
  t.send('stats', stats(1000));
  t.ticks(60);
  t.send('stats', stats(1025));
  t.ticks(60);
  t.send('stats', stats(1050));
  let wc = t.rep().skills.find((s) => s.skill === 'woodcutting');
  assert.ok(wc && wc.xpGained === 50 && wc.actions === 2, `counts gains: ${JSON.stringify(wc)}`);
  assert.ok(!t.rep().skills.some((s) => s.skill === 'attack'), 'untrained skills not shown');
  assert.strictEqual(wc.xpHour, 3000, '50 xp in a minute = 3,000/hr (time counted from the first gain)');
  assert.strictEqual(wc.startLevel, 9, 'level 9 at 1,050 xp (level 10 is 1,154)');
  t.send('stats', stats(1050, 300));
  assert.ok(t.rep().skills.some((s) => s.skill === 'slayer' && s.xpGained === 300), 'Slayer counted');
  // logged out time doesn't count (Pause on logout)
  t.send('login-state', false);
  t.ticks(30);
  t.send('login-state', true);
  t.send('stats', stats(1050, 300));
  t.ticks(1);
  wc = t.rep().skills.find((s) => s.skill === 'woodcutting');
  assert.strictEqual(wc.xpHour, Math.floor((3600 / 61) * 50), 'paused while logged out (61 s: the minute and the one after logging back in)');
  assert.ok(conf.saves && conf.saves.tester && conf.saves.tester.skills.woodcutting, 'saved');
  // pause by hand, then XP unpauses it
  conf.command = { action: 'pause', skill: 'woodcutting' };
  t.inst.configChanged('command');
  assert.ok(t.rep().skills.find((s) => s.skill === 'woodcutting').paused, 'paused');
  t.send('stats', stats(1060, 300));
  t.ticks(1);
  assert.ok(!t.rep().skills.find((s) => s.skill === 'woodcutting').paused, 'XP unpauses it');
  // the canvas boxes go to the page side
  conf.command = { action: 'canvas', skill: 'slayer' };
  t.inst.configChanged('command');
  assert.deepStrictEqual(t.sent[t.sent.length - 1].config.boxes.map((b) => b.skill), ['slayer'], 'slayer on the canvas');
  t.inst.stop();
  t.restore();
  // EASCape closed and opened again: carries on; XP gained in another client meanwhile isn't counted
  clock.t += 5 * 3600000;
  t = loadTracker(conf, clock);
  t.send('player', { name: 'Tester' });
  t.send('stats', stats(1090, 300));
  wc = t.rep().skills.find((s) => s.skill === 'woodcutting');
  assert.ok(wc && wc.xpGained === 60 && wc.xp === 1090, `restored: ${JSON.stringify(wc)}`);
  t.send('stats', stats(1100, 300));
  assert.strictEqual(t.rep().skills.find((s) => s.skill === 'woodcutting').xpGained, 70, 'keeps counting');
  // Reset starts the skill again from its XP now
  conf.command = { action: 'reset', skill: 'woodcutting' };
  t.inst.configChanged('command');
  assert.ok(!t.rep().skills.some((s) => s.skill === 'woodcutting'), 'reset takes it off');
  // another account has its own
  t.send('player', { name: 'Alt' });
  assert.strictEqual(t.rep().skills.length, 0, 'alt starts empty');
  t.restore();
  // the old tracker's save carries over
  const old = { sessions: { olduser: { mining: { start: 500, xp: 800, active: 120000, actions: 3, lastGain: 1 } } } };
  t = loadTracker(old, clock);
  t.send('player', { name: 'OldUser' });
  t.send('stats', [{ skill: 'mining', xp: 800 }]);
  const mi = t.rep().skills.find((s) => s.skill === 'mining');
  assert.ok(mi && mi.xpGained === 300 && mi.xpHour === 9000, `carried over: ${JSON.stringify(mi)}`);
  t.restore();
  console.log('xp tracker: ok');
}


// ---------------------------------------------------------------- slayer (page side)
{
  const window = { postMessage() {}, addEventListener() {} };
  const ctx = vm.createContext({ window, document: { getElementById: () => null }, setInterval() {}, setTimeout() {}, clearTimeout() {}, performance: { now: () => 0 }, Date, Int32Array, Math, String, Array, Object, RegExp, Proxy, Map, Set, JSON, Number, isFinite, parseInt });
  vm.runInContext(fs.readFileSync(path.join(root, 'runtime', 'runtime.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'plugins', 'slayer', 'page.js'), 'utf8'), ctx);
  const ll = vm.runInContext('window.__lostlite', ctx);
  ll.configure({ fields: { addChat: 'ac', varps: 'v', localPlayer: 'lp', playerName: 'nm' }, features: {} });
  const tasks = require(path.join(root, 'plugins', 'slayer', 'tasks.json'));
  const added = [];
  const client = { ac(type, text, sender) { added.push([type, text, sender]); }, v: [], lp: { nm: 'Tester' } };
  client.v[395] = 49; // ^slayer_dustdevil
  client.v[394] = 20;
  ll.client = client;
  ll.loggedIn = true;
  ll.hookChat(client);
  ll.pluginConfig({ id: 'slayer', enabled: true, config: { infobox: true, itemoverlay: true, statTimeout: 5, taskCommand: true, tasks } });
  const boxes = () => ll.infoBoxProviders.get('slayer')(0);
  assert.strictEqual(tasks[49].name, 'Dust Devils', 'task table from the server data');
  assert.ok(tasks[49].npcs.includes('Dust devil'), 'its monsters');
  let b = boxes();
  assert.ok(b.length === 1 && b[0].text === '20' && /Dust Devils/.test(b[0].tooltip), `task box: ${JSON.stringify(b)}`);
  assert.strictEqual(JSON.stringify(ll.itemText(4155, 0)), JSON.stringify({ text: '20', colour: 0xffffff }), 'count on the gem');
  assert.strictEqual(ll.itemText(995, 0), null, 'nothing on other items');
  client.v[394] = 15;
  client.ac(2, '!task', 'Tester');
  assert.strictEqual(added[added.length - 1][1], 'Slayer Task: Dust Devils: 5/20 killed', '!task says the task');
  client.ac(2, '!task', 'Someone');
  assert.strictEqual(added[added.length - 1][1], '!task', 'only your own');
  client.v[394] = 0;
  assert.strictEqual(boxes().length, 0, 'no box once the task is done');
  console.log('slayer: ok');
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
