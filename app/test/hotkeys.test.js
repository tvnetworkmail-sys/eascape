'use strict';
// The hotkey system (3.6), against fake key events.
const assert = require('assert');
const { parse, matches, createManager } = require('../src/preload/hotkeys');

const ev = (key, o = {}) => ({ key, ctrlKey: !!o.ctrl, shiftKey: !!o.shift, altKey: !!o.alt, metaKey: !!o.meta, repeat: !!o.repeat, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } });

assert.deepStrictEqual(parse('Ctrl+M'), { key: 'm', ctrl: true, shift: false, alt: false, meta: false, modifier: false });
assert.strictEqual(parse(''), null);
assert.ok(matches(ev('m', { ctrl: true }), 'Ctrl+M'));
assert.ok(matches(ev('M', { ctrl: true }), 'Ctrl+M'), 'case does not matter');
assert.ok(!matches(ev('m', { ctrl: true, shift: true }), 'Ctrl+M'), 'extra modifiers do not match');
assert.ok(matches(ev('Alt', { alt: true }), 'Alt'), 'a modifier on its own');
assert.ok(!matches(ev('Alt', { alt: true, ctrl: true }), 'Alt'), 'only with nothing else held');
assert.ok(matches(ev('Tab'), 'Tab'));

const m = createManager(null);
let setting = 'Ctrl+M';
const log = [];
let allowed = true;
const off = m.add(() => setting, { pressed: () => log.push('down'), released: () => log.push('up'), when: () => allowed });
let e = ev('m', { ctrl: true });
m.down(e);
assert.ok(e.prevented && e.stopped, 'kept from the game');
m.down(ev('m', { ctrl: true, repeat: true }));
m.up(ev('m'));
assert.deepStrictEqual(log, ['down', 'up'], 'once per press, held keys do not repeat');
allowed = false;
e = ev('m', { ctrl: true });
m.down(e);
assert.ok(!e.prevented && log.length === 2, 'when() off: the key goes to the game');
allowed = true;
setting = 'F5';
m.down(ev('F5'));
assert.strictEqual(log[2], 'down', 'follows the setting as it changes');
m.blur();
assert.strictEqual(log[3], 'up', 'leaving the window releases it');
off();
m.down(ev('F5'));
assert.strictEqual(log.length, 4, 'removed');
const passive = [];
m.add('Alt', { pressed: () => passive.push(1), consume: false });
e = ev('Alt', { alt: true });
m.down(e);
assert.ok(passive.length === 1 && !e.prevented, 'consume: false leaves the key to the game');
console.log('hotkeys: ok');
