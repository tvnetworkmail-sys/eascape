#!/usr/bin/env node
'use strict';
// The one way to refresh the Quest Helper's route data after content changes (new maps, new
// stairs and ladders, a new quest). The committed collision.bin and transports.json are the
// tested data, so this never drops or changes a transport that's there:
//   1. build.js builds fresh data from ../content into a scratch folder;
//   2. transports: every committed one is kept as it is; a fresh one is added only where no
//      committed transport starts (a new staircase, a new quest's way across); fresh ones that
//      disagree with a committed one, or committed ones the build no longer finds, are only
//      listed, for a look by hand (fix them in extra.json or the committed file);
//   3. collision: the fresh regions (so new walls and locs count), plus any region only the
//      committed data has;
//   4. golden.js --check: every step-to-step route that worked before must still work, or
//      nothing is written.
// Usage: node tools/routes/update.js [--write]   (without --write it only reports)
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const here = __dirname;
const app = path.join(here, '..', '..');
const data = path.join(app, 'src', 'plugins', 'questhelper');
const content = path.join(app, '..', 'content');
const write = process.argv.includes('--write');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'routes-'));
execFileSync(process.execPath, [path.join(here, 'build.js'), content, tmp], { stdio: 'inherit' });

const pos = (t) => `${t.x},${t.z},${t.level}`;
const strip = (t) => { const c = { ...t }; delete c.note; return JSON.stringify(c); };
const same = (a, b) => strip(a) === strip(b);
const committed = JSON.parse(fs.readFileSync(path.join(data, 'transports.json'), 'utf8'));
const fresh = JSON.parse(fs.readFileSync(path.join(tmp, 'transports.json'), 'utf8'));
const at = new Map();
for (const t of committed) {
  if (!at.has(pos(t))) at.set(pos(t), []);
  at.get(pos(t)).push(t);
}
const freshAt = new Set(fresh.map(pos));
const added = [];
const differ = [];
const addedKeys = new Set();
for (const t of fresh) {
  const here2 = at.get(pos(t));
  if (!here2) {
    if (!addedKeys.has(strip(t))) added.push(t); // the build can list one twice
    addedKeys.add(strip(t));
  }
  else if (!here2.some((c) => same(c, t))) differ.push(t);
}
const missing = committed.filter((t) => !freshAt.has(pos(t)));
const out = committed.concat(added.map((t) => JSON.parse(strip(t))));
console.log(`transports: ${committed.length} kept, ${added.length} new`);
for (const t of added) console.log(`  + ${t.name} at ${pos(t)}`);
if (differ.length) console.log(`  ${differ.length} fresh ones disagree with a kept one (kept as committed):`);
for (const t of differ) console.log(`    ~ ${t.name} at ${pos(t)} -> ${JSON.stringify(t.to || t.rel)}`);
if (missing.length) console.log(`  ${missing.length} kept ones the build no longer finds (kept: tested data)`);

function regions(file) {
  const raw = zlib.inflateSync(fs.readFileSync(file));
  const n = raw.readUInt16LE(4);
  const size = 4 * 64 * 64 * 2;
  const m = new Map();
  let o = 6;
  for (let i = 0; i < n; i++) {
    m.set((raw[o] << 8) | raw[o + 1], raw.subarray(o + 2, o + 2 + size));
    o += 2 + size;
  }
  return m;
}
const oldR = regions(path.join(data, 'collision.bin'));
const newR = regions(path.join(tmp, 'collision.bin'));
let changed = 0;
for (const [k, v] of oldR) {
  if (!newR.has(k)) newR.set(k, v);
  else if (!newR.get(k).equals(v)) changed++;
}
console.log(`collision: ${newR.size} regions, ${changed} changed by the content`);
const keys = [...newR.keys()].sort((a, b) => a - b);
const buf = Buffer.alloc(6 + keys.length * (2 + 4 * 64 * 64 * 2));
buf.write('LLC1', 0, 'ascii');
buf.writeUInt16LE(keys.length, 4);
let o = 6;
for (const k of keys) {
  buf[o] = k >> 8;
  buf[o + 1] = k & 0xff;
  newR.get(k).copy(buf, o + 2);
  o += 2 + 4 * 64 * 64 * 2;
}

// try it before keeping it
const trial = fs.mkdtempSync(path.join(os.tmpdir(), 'routes-trial-'));
const backup = { c: fs.readFileSync(path.join(data, 'collision.bin')), t: fs.readFileSync(path.join(data, 'transports.json')) };
fs.writeFileSync(path.join(data, 'collision.bin'), zlib.deflateSync(buf, { level: 9 }));
fs.writeFileSync(path.join(data, 'transports.json'), JSON.stringify(out));
let ok = true;
try {
  execFileSync(process.execPath, [path.join(here, 'golden.js'), '--check'], { stdio: 'inherit' });
} catch (e) {
  ok = false;
}
if (!ok || !write) {
  fs.writeFileSync(path.join(data, 'collision.bin'), backup.c);
  fs.writeFileSync(path.join(data, 'transports.json'), backup.t);
  console.log(ok ? 'Nothing written (run with --write to keep it).' : 'A tested route broke: nothing written.');
  fs.rmSync(trial, { recursive: true, force: true });
  process.exit(ok ? 0 : 1);
}
fs.rmSync(trial, { recursive: true, force: true });
console.log('Written: collision.bin and transports.json. Rerun golden.js to add new working routes.');
