#!/usr/bin/env node
'use strict';
// Exports the server's Quest Helper guides (the questhelper_guide and questhelper_step dbrows
// under content/scripts, see content/scripts/eascape_questhelper) for the app's Quest Helper
// plugin: src/plugins/questhelper/server-guides.json. The server picks the step (varps
// questhelper_guide / questhelper_step); the app uses these rows to draw the highlights, the
// walking route and the dialogue options. Names become ids through content/pack/*.pack.
// Usage: node tools/quests/server.js   (rerun after changing a guide)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..', '..');
const content = path.join(root, 'content');
const out = path.join(__dirname, '..', '..', 'src', 'plugins', 'questhelper', 'server-guides.json');

function pack(name) {
  const m = {};
  for (const line of fs.readFileSync(path.join(content, 'pack', `${name}.pack`), 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0) m[line.slice(i + 1).trim()] = Number(line.slice(0, i));
  }
  return m;
}
const ids = { npc: pack('npc'), loc: pack('loc'), obj: pack('obj') };

function walk(dir, ext, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, acc);
    else if (e.name.endsWith(ext)) acc.push(p);
  }
  return acc;
}

/** [name] blocks of a config file: { name: [[key, value], ...] } */
function blocks(file, into = {}) {
  let cur = null;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    const h = /^\[([^\]]+)\]$/.exec(line);
    if (h) {
      cur = into[h[1]] = [];
      continue;
    }
    const i = line.indexOf('=');
    if (cur && i > 0) cur.push([line.slice(0, i), line.slice(i + 1)]);
  }
  return into;
}

/** a dbrow data= value split on commas outside quotes */
function fields(v) {
  const outv = [];
  let cur = '';
  let q = false;
  for (const ch of v) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) {
      outv.push(cur);
      cur = '';
    } else cur += ch;
  }
  outv.push(cur);
  return outv;
}

const scripts = path.join(content, 'scripts');
const constants = {};
for (const f of walk(scripts, '.constant')) {
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = /^\^(\w+)\s*=\s*(.+?)\s*$/.exec(line);
    if (m) constants[m[1]] = m[2];
  }
}
const objs = {};
for (const f of walk(scripts, '.obj')) blocks(f, objs);
const locs = {};
for (const f of walk(scripts, '.loc')) blocks(f, locs);
const rows = {};
for (const f of walk(scripts, '.dbrow')) {
  const text = fs.readFileSync(f, 'utf8');
  if (text.includes('table=questhelper_')) blocks(f, rows);
}

const objName = (n) => {
  const b = objs[n];
  const kv = b && b.find(([k]) => k === 'name');
  return kv ? kv[1] : n;
};
const locSize = (n) => {
  const b = locs[n] || [];
  const get = (k) => Number((b.find(([x]) => x === k) || [])[1] || 1);
  return [get('width'), get('length')];
};
const coord = (s) => {
  const [level, mx, mz, lx, lz] = s.split('_').map(Number);
  return [mx * 64 + lx, mz * 64 + lz, level];
};
const id = (type, name) => {
  const v = ids[type][name];
  if (v === undefined) throw new Error(`unknown ${type} ${name}`);
  return v;
};
const num = (v) => (v.startsWith('^') ? Number(constants[v.slice(1)]) : Number(v));

const guides = {};
const steps = [];
for (const [name, kv] of Object.entries(rows)) {
  const table = (kv.find(([k]) => k === 'table') || [])[1];
  const data = {};
  for (const [k, v] of kv) {
    if (k !== 'data') continue;
    const [col, ...rest] = fields(v);
    (data[col] = data[col] || []).push(rest);
  }
  const one = (c) => (data[c] ? data[c][0][0] : undefined);
  const all = (c) => (data[c] || []).map((r) => r[0]);
  const items = (c) => (data[c] || []).map(([n, q]) => ({ name: objName(n), id: id('obj', n), qty: Number(q || 1) }));
  if (table === 'questhelper_guide') {
    const g = num(one('guide'));
    guides[g] = {
      guide: g, key: one('key'), name: one('name'), journal: one('journal'), difficulty: one('difficulty') || '',
      start: one('start') || '', required: items('required'), recommended: items('recommended'),
      skills: all('skill'), rewards: all('reward'), sections: all('section'), steps: {},
    };
  } else if (table === 'questhelper_step') {
    const sid = Number(one('id'));
    const st = { id: sid % 1000, section: Number(one('section') || 0), text: one('text') };
    if (data.npc) st.npc = all('npc').map((n) => id('npc', n));
    if (data.obj) st.obj = all('obj').map((n) => id('obj', n));
    if (data.coord) st.at = coord(one('coord'));
    if (data.loc) {
      st.loc = id('loc', one('loc'));
      if (st.at) {
        st.locAt = st.at;
        st.locSize = locSize(one('loc'));
      }
    }
    st.options = all('option');
    st.items = items('item');
    if (one('dig') === 'yes' || one('dig') === 'true') st.dig = true;
    steps.push([Math.floor(sid / 1000), st, name]);
  }
}
for (const [g, st, name] of steps) {
  if (!guides[g]) throw new Error(`${name}: no guide ${g}`);
  guides[g].steps[st.id] = st;
}
const byKey = {};
for (const g of Object.values(guides)) byKey[g.key] = g;
fs.writeFileSync(out, `${JSON.stringify(byKey)}\n`);
console.log(`${Object.keys(byKey).length} guide(s), ${steps.length} steps -> ${path.relative(process.cwd(), out)}`);
