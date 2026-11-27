'use strict';
// 0.17 features against fakes: the chat hook, scene objects, Idle Notifier and XP Drops.
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
  client.ac(0, 'Welcome to 2007RS.', '');
  assert.deepStrictEqual(added.map((a) => a[0]), [2, 0], 'game still gets its messages');
  const msgs = posted.filter((m) => JSON.stringify(m).includes('Welcome to 2007RS'));
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
