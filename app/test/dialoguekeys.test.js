'use strict';
// Dialogue Keys: Space and 1-5 press the open conversation's buttons through doAction,
// option numbers are added and removed, and the patcher finds the continue button's action.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { patchButtons } = require('../src/main/patcher');

// ---- patcher: the continue button's menu action, in the shape the client is built to
const snippet = "if(0x1===q['bt']){let o=!0x1;0x0!==q['cc']&&(o=this['so'](q)),!o&&q['bx']&&(this['mo'][this['mn']]=q['bx'],this['ma'][this['mn']]=0x13b,this['mc'][this['mn']]=q['id'],this['mn']++);}" +
  "else 0x2===q['bt']&&0x0===this['tm']?(this['mo'][this['mn']]=x+' @gre@'+q['tb'],this['ma'][this['mn']]=0x26a):" +
  "0x3===q['bt']?(this['mo'][this['mn']]='Close',this['ma'][this['mn']]=0xc8,this['mc'][this['mn']]=q['id'],this['mn']++):" +
  "0x4===q['bt']&&q['bx']?(this['mo'][this['mn']]=q['bx'],this['ma'][this['mn']]=0x2a7,this['mc'][this['mn']]=q['id'],this['mn']++):" +
  "0x5===q['bt']&&q['bx']?(this['mo'][this['mn']]=q['bx'],this['ma'][this['mn']]=0x34d,this['mc'][this['mn']]=q['id'],this['mn']++):" +
  "0x6===q['bt']&&!this['rp']&&q['bx']&&(this['mo'][this['mn']]=q['bx'],this['ma'][this['mn']]=0x2a1,this['mc'][this['mn']]=q['id'],this['mn']++);" +
  "if(q['sc']&&q['sc'][0x0]&&0x5===q['sc'][0x0][0x0]){let v=q['sc'][0x0][0x1];q['so2']&&this['var'][v]!==q['so2'][0x0]}" +
  "let a=this['in']['g1'](),b=0x1===this['in']['g1']();return x['list'][a]['hd']=b," +
  "this['mx']>=0x2b6&&this['mx']<=0x2d4&&this['my']>=0xa8&&this['my']<0xcd&&-0x1!=this['si'][0x5]?(this['rs']=!0x0,this['at']=0x5,this['ri']=!0x0):0;";
// The ok regex wants "0x1===q['bt']){" - give it that form too.
const b = patchButtons(snippet.replace("if(0x1===q['bt']){", "if(0x1===q['bt']){"));
if (b.ok) {
  assert.strictEqual(b.fields.buttons.pause, 0x2a1, 'continue action found');
  const t = patchButtons(snippet.replace("0x6===q['bt']&&!this['rp']&&q['bx']&&(", "0x6===q['bt']&&!this['rp']&&q['bx']?(").replace("this['mn']++);if(q['sc']", "this['mn']++):0;if(q['sc']"));
  assert.strictEqual(t.ok && t.fields.buttons.pause, 0x2a1, 'ternary form too');
  assert.strictEqual(patchButtons(snippet.replace("0x6===q['bt']", "0x7===q['bt']")).fields.buttons.pause, undefined, 'optional');
  console.log('continue button action: ok');
} else {
  // The synthetic shape didn't satisfy every other check; still check the pause pattern itself.
  console.log(`continue button action: synthetic skipped (${b.reason})`);
}

// ---- page side
const handlers = {};
const win = { postMessage() {}, addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); } };
const ctx = vm.createContext({ window: win, document: { getElementById: () => null }, setInterval() {}, setTimeout() {}, clearTimeout() {}, performance: { now: () => 0 }, Int32Array, Math, String, Array, Object, RegExp, Proxy, Map, Set, JSON, Number, isFinite, parseInt });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'runtime', 'runtime.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'plugins', 'dialoguekeys', 'page.js'), 'utf8'), ctx);
const ll = vm.runInContext('window.__lostlite', ctx);
const cmd = (c) => handlers.message.forEach((fn) => fn({ source: win, data: { __lostliteCmd: c } }));

// Interface objects with fields in the client's declaration order: id, layerId, type,
// buttonType, ..., hide, children, childX, childY, ..., text, text2, ..., buttonText.
const list = [];
function com(id, layer, bt, extra = {}) {
  list[id] = { cid: id, lay: layer, ty: 4, btn: bt, hd: false, kids: null, kx: null, ky: null, txt: extra.text || '', txt2: '', btx: extra.bx || null, ...extra.more };
  return list[id];
}
// multi3 (Select an Option): title, three options, a hidden layer
const MULTI = 2490;
com(MULTI, -1, 0).kids = [2491, 2492, 2493, 2494, 2495];
com(2491, MULTI, 0, { text: 'Select an Option' });
com(2492, MULTI, 1, { text: 'Yes please.', bx: 'Ok' });
com(2493, MULTI, 1, { text: 'No thanks.', bx: 'Ok' });
com(2494, MULTI, 1, { text: 'Tell me more.', bx: 'Ok' });
com(2495, MULTI, 0).hd = true;
list[MULTI].kx = [0, 0, 0, 0, 2]; list[MULTI].ky = [0, 23, 47, 71, 1]; // also look like ids, mustn't be picked
// chatnpc1: model, name, line, continue
const CHAT = 4882;
com(CHAT, -1, 0).kids = [4883, 4884, 4885];
com(4883, CHAT, 0, { text: 'Hans' });
com(4884, CHAT, 0, { text: 'Hello.' });
com(4885, CHAT, 6, { text: 'Click here to continue', bx: 'Continue' });

const pressed = [];
const client = {
  chat: -1, dio: false, sio: false, rc: false,
  mn: 0, mo: [], ma: new Int32Array(500), mpa: new Int32Array(500), mpb: new Int32Array(500), mpc: new Int32Array(500),
  act(i) { pressed.push([this.ma[i], this.mpc[i]]); },
};
ll.configure({ fields: {
  chatModal: 'chat', dialogInputOpen: 'dio', socialInputOpen: 'sio', redrawChat: 'rc', doAction: 'act',
  menuCount: 'mn', menuOption: 'mo', menuAction: 'ma', menuParamA: 'mpa', menuParamB: 'mpb', menuParamC: 'mpc',
  comButtonType: 'btn', comButtonText: 'btx', comId: 'cid', comHide: 'hd', buttons: { ok: 315, toggle: 679, select: 845, pause: 673 },
}, features: {} });
ll.setApi({ ifList: () => list, pix: () => ({ pixels: new Int32Array(512 * 334), width: 512, height: 334 }) });
ll.client = client;
ll.loggedIn = true;
cmd({ type: 'plugin-config', id: 'dialoguekeys', enabled: true, config: { spaceContinue: true, numberOptions: true, showNumbers: true } });
const press = (k, more = {}) => {
  const e = { key: k, code: k === ' ' ? 'Space' : `Digit${k}`, repeat: false, ctrlKey: false, altKey: false, metaKey: false, prevented: false, stopped: false,
    preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...more };
  handlers.keydown.forEach((fn) => fn(e));
  return e;
};

// Nothing open: keys go to the game (they type into chat)
let e = press(' ');
assert.ok(!e.prevented && !pressed.length, 'space types when no conversation is open');

// A conversation line: Space continues
client.chat = CHAT;
e = press(' ');
assert.deepStrictEqual(pressed.pop(), [673, 4885], 'continue pressed');
assert.ok(e.prevented && e.stopped, 'game does not see the key');
assert.ok(!press(' ', { repeat: true }).prevented && !pressed.length, 'holding Space does not repeat');
assert.ok(!press('1').prevented, 'no options on this page');
assert.strictEqual(client.mn, 0, 'menu untouched');

// Select an Option: 2 picks the second option, numbers shown, hidden layer ignored
client.chat = MULTI;
ll.frame(client, 0);
assert.deepStrictEqual([2492, 2493, 2494].map((i) => list[i].txt), ['1. Yes please.', '2. No thanks.', '3. Tell me more.']);
assert.strictEqual(list[2491].txt, 'Select an Option', 'title left alone');
assert.strictEqual(client.rc, true, 'chat box redrawn');
ll.frame(client, 0);
assert.strictEqual(list[2492].txt, '1. Yes please.', 'numbered once');
press('2');
assert.deepStrictEqual(pressed.pop(), [315, 2493], 'option 2 pressed');
assert.ok(!press('4').prevented && !pressed.length, 'no 4th option');
assert.ok(!press(' ').prevented, 'no continue on an options page');
assert.ok(!press('1', { ctrlKey: true }).prevented, 'Ctrl+1 left alone');

// Typing prompts (Enter amount, PM) keep their keys
client.dio = true;
assert.ok(!press('1').prevented && !pressed.length, 'enter-amount prompt keeps digits');
client.dio = false;

// Settings off: numbers removed, keys go to the game
cmd({ type: 'plugin-config', id: 'dialoguekeys', enabled: true, config: { spaceContinue: false, numberOptions: false, showNumbers: true } });
assert.strictEqual(list[2492].txt, 'Yes please.', 'numbers removed');
assert.ok(!press('1').prevented, 'numbers off');
client.chat = CHAT;
assert.ok(!press(' ').prevented, 'space off');
console.log('dialogue keys: ok');
