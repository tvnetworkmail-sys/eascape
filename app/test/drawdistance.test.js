'use strict';
// Runs the patched renderer's visibility pre-calculation (the code that crashed at draw
// distance 50 in 0.3.2) for every draw distance, against a real client bundle.
// Usage: LIVE_BUNDLE=/path/to/client.js node test/drawdistance.test.js
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const { patchClient } = require('../src/main/patcher');

if (!process.env.LIVE_BUNDLE) {
  console.log('draw distance: skipped (set LIVE_BUNDLE to a client.js)');
  process.exit(0);
}
const src = fs.readFileSync(process.env.LIVE_BUNDLE, 'utf8');

function typedArray4d(a, b, c, d, v) {
  return Array.from({ length: a }, () => Array.from({ length: b }, () => Array.from({ length: c }, () => new Array(d).fill(v))));
}
const sin = new Int32Array(2048);
const cos = new Int32Array(2048);
for (let i = 0; i < 2048; i++) {
  sin[i] = (Math.sin(i * 0.0030679615) * 65536) | 0;
  cos[i] = (Math.cos(i * 0.0030679615) * 65536) | 0;
}
const any = new Proxy(function stub() {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : any),
  construct: () => any,
  apply: () => any,
});

for (let R = 25; R <= 50; R++) {
  const { code, info } = patchClient(src, '', { drawDistance: R });
  assert.strictEqual(info.features.drawDistance, R, `R=${R} patched`);
  const loop = code.search(/for\(let ([\w$]+)=0x80;\1<=0x180;\1\+=0x20\)/);
  const start = code.lastIndexOf('class ', loop);
  let depth = 0;
  let end = code.indexOf('{', start);
  for (; end < code.length; end++) {
    if (code[end] === '{') depth++;
    else if (code[end] === '}' && --depth === 0) break;
  }
  const cls = code.slice(start, end + 1);
  const name = /^class ([\w$]+)/.exec(cls)[1];
  // Names differ per build: the 4D array class, the sin/cos table holder, the methods.
  const table = /static \['([\w$]+)'\]=new ([\w$]+)\(0x8,0x20,/.exec(cls);
  const trig = /=([\w$]+)\['([\w$]+)'\]\[([\w$]+)\],this\['[\w$]+'\]=\1\['([\w$]+)'\]\[\3\]/.exec(cls);
  const vis = /window\.__lostlite\.visCalc\(this,'([\w$]+)'/.exec(cls);
  assert.ok(table && trig && vis, 'found renderer names');
  const ctx = vm.createContext({
    [table[2]]: typedArray4d,
    [trig[1]]: { [trig[2]]: sin, [trig[4]]: cos },
    Int32Array, Array, Math, Object,
    window: { __lostlite: { far: Math.round((3500 * R) / 25), visCalc() {} } },
  });
  for (let tries = 0; ; tries++) {
    try {
      vm.runInContext(`{${cls};globalThis.__world=${name};}`, ctx);
      break;
    } catch (e) {
      const m = /^([\w$]+) is not defined/.exec(e.message);
      if (!m || tries > 50) throw e;
      ctx[m[1]] = any;
    }
  }
  const world = vm.runInContext('__world', ctx);
  const d = new Int32Array(9);
  for (let x = 0; x < 9; x++) {
    const a = x * 32 + 128 + 15;
    d[x] = ((a * 3 + 600) * sin[a]) >> 16;
  }
  world[vis[1]](d, 500, 800, 512, 334);
  const t = world[table[1]];
  assert.strictEqual(t[0][0].length, 2 * R + 1, `R=${R} table size`);
  let visible = 0;
  for (const p of t) for (const y of p) for (const row of y) for (const v of row) if (v) visible++;
  assert.ok(visible > 0, `R=${R} some tiles visible`);
}
console.log('draw distance: ok for 25-50 tiles');
