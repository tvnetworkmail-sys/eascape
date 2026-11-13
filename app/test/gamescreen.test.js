'use strict';
// The one check for "is the game world on screen": overlays stay off the title screen and
// the full-screen welcome screen, against a fake client.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'src');
const posted = [];
const handlers = {};
const window = { postMessage: (m) => posted.push(m), addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); } };
const ctx = vm.createContext({ window, document: { getElementById: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 765, height: 503 }) }) }, setInterval() {}, setTimeout() {}, clearTimeout() {}, performance: { now: () => 1000 }, Date, Int32Array, Math, String, Array, Object, RegExp, Proxy, Map, Set, JSON, Number, isFinite, parseInt });
vm.runInContext(fs.readFileSync(path.join(root, 'runtime', 'runtime.js'), 'utf8'), ctx);
const ll = vm.runInContext('window.__lostlite', ctx);

const font = { tag() {}, wid: () => 0 };
const client = { ingame: false, sceneState: 0, fullscreenId: -1, font };
ll.configure({ fields: { inGame: 'ingame', fontB12: 'font', fontP11: 'font', fontP12: 'font', fontDrawTag: 'tag', fontWidth: 'wid' }, features: {} });
ll.setApi({ pix: () => ({ pixels: new Int32Array(512 * 334), width: 512, height: 334 }), loopCycle: () => 0 });

const seen = [];
const frames = [];
const clicks = [];
ll.registerPlugin('t', {
  screenShown: (s) => seen.push(s),
  frame: () => frames.push(0),
  mouseDown: () => { clicks.push(1); return false; },
});
ll.pluginConfig({ id: 't', enabled: true, config: {} });
const messages = () => posted.filter((m) => m.type === 'game-shown').map((m) => m.data);
const tick = () => ll.tick(client);
const click = () => handlers.mousedown.forEach((fn) => fn({ clientX: 100, clientY: 100, button: 0, preventDefault() {}, stopImmediatePropagation() {} }));

// ---- title screen
ll.title(client);
tick();
assert.strictEqual(ll.gameShown, false, 'not on the title screen');
ll.frame(client, 0);
click();
assert.deepStrictEqual([frames.length, clicks.length], [0, 0], 'nothing drawn or clicked on the title screen');
assert.deepStrictEqual(messages(), [], 'nothing reported while nothing changed');

// ---- logging in: in the game, map not built yet
client.ingame = true;
tick();
assert.strictEqual(ll.gameShown, false, 'not before the world has been built');
// the welcome screen arrives before the map is built
client.fullscreenId = 353;
tick();
client.sceneState = 2;
tick();
assert.strictEqual(ll.gameShown, false, 'not while the welcome screen is up');
ll.frame(client, 0);
assert.strictEqual(frames.length, 0, 'no drawing under the welcome screen');
assert.deepStrictEqual(messages(), [], 'never showed between login and the welcome screen');

// ---- the welcome screen closes
client.fullscreenId = -1;
tick();
assert.strictEqual(ll.gameShown, true, 'back on the very next call');
assert.deepStrictEqual(messages(), [true], 'told once');
assert.deepStrictEqual(seen, [true]);
ll.frame(client, 0);
click();
assert.deepStrictEqual([frames.length, clicks.length], [1, 1], 'drawing and clicks are back');

// ---- walking onto a new map: sceneState goes back to 1 and nothing blinks
client.sceneState = 1;
tick();
assert.strictEqual(ll.gameShown, true, 'a later map load changes nothing');
client.sceneState = 2;
tick();
assert.strictEqual(messages().length, 1, 'no blink at region edges');

// ---- a main interface (port warning, design screen, bank) leaves the game frame up
client.mainModalId = 4000;
tick();
assert.strictEqual(ll.gameShown, true, 'a main interface is not the welcome screen');

// ---- logging out
client.ingame = false;
tick();
assert.strictEqual(ll.gameShown, false, 'gone when logging out');
assert.deepStrictEqual(messages(), [true, false]);

// ---- logging in again: the map has to build again, whatever the last session left
client.ingame = true;
client.sceneState = 0;
tick();
assert.strictEqual(ll.gameShown, false, 'a new login waits for the world again');
client.sceneState = 2;
tick();
assert.strictEqual(ll.gameShown, true, 'no welcome screen (Tutorial Island): shown once built');

// ---- a dropped connection: the client clears ingame while it reconnects, keeps its map
client.ingame = false;
tick();
assert.strictEqual(ll.gameShown, false, 'hidden while reconnecting');
client.ingame = true;
tick();
assert.strictEqual(ll.gameShown, true, 'back when the reconnect lands');

// ---- the 300 ms poll is enough when no packets are read
client.ingame = false;
ll.poll();
assert.strictEqual(ll.gameShown, false, 'poll sees it too');

console.log('gamescreen: ok');
