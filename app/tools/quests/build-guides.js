#!/usr/bin/env node
'use strict';
// Builds src/plugins/questhelper/guides.json from the guide sources in tools/quests/guides/.
//
// Guides are written against Lost City's own names (npc/loc/obj config names), so this
// resolves every name to its 274 id and checks it against the maps: each NPC must spawn,
// and each object or ground item must be placed, within a few squares of where the step
// says it is (the step's position is then moved onto the real one). Anything that doesn't
// check out stops the build.
//
// The step text, structure and order follow RuneLite's Quest Helper (BSD 2-Clause,
// Copyright (c) 2020, Zoinkwiz), reworked for the 2004 versions of the quests from Lost
// City's scripts.
//
// Usage: build-guides.js <Content checkout (274)>

const fs = require('fs');
const path = require('path');

const root = process.argv[2];
if (!root) {
  console.error('usage: build-guides.js <content>');
  process.exit(1);
}
const OUT = path.join(__dirname, '..', '..', 'src', 'plugins', 'questhelper', 'guides.json');
const progress = require('../../src/plugins/questhelper/progress.json');

function pack(kind) {
  const byName = new Map();
  for (const l of fs.readFileSync(path.join(root, 'pack', `${kind}.pack`), 'utf8').split('\n')) {
    const m = /^(\d+)=(\S+)/.exec(l.trim());
    if (m) byName.set(m[2], +m[1]);
  }
  return byName;
}
const ids = { npc: pack('npc'), loc: pack('loc'), obj: pack('obj') };
const names = { npc: new Map(), loc: new Map(), obj: new Map() };
for (const k of Object.keys(ids)) for (const [n, id] of ids[k]) names[k].set(id, n);

// Everything placed in the maps: { npc|loc|obj: Map(id -> [{x, z, level}]) }
const placed = { npc: new Map(), loc: new Map(), obj: new Map() };
for (const f of fs.readdirSync(path.join(root, 'maps'))) {
  const mm = /^m(\d+)_(\d+)\.jm2$/.exec(f);
  if (!mm) continue;
  let sec = '';
  const lines = fs.readFileSync(path.join(root, 'maps', f), 'utf8').split('\n');
  // Bridges: things on level 1 over a "link below" square are really on the ground floor.
  const bridged = new Set();
  for (const line of lines) {
    if (line.startsWith('====')) {
      sec = line.replace(/=/g, '').trim();
      continue;
    }
    if (sec !== 'MAP') continue;
    const c = line.indexOf(':');
    if (c < 0) continue;
    const [lv, x, z] = line.slice(0, c).trim().split(/\s+/).map(Number);
    const m = /\bf(\d+)/.exec(line.slice(c + 1));
    if (lv === 1 && m && (+m[1] & 2)) bridged.add(x * 64 + z);
  }
  sec = '';
  for (const line of lines) {
    if (line.startsWith('====')) {
      sec = { MAP: '', LOC: 'loc', NPC: 'npc', OBJ: 'obj' }[line.replace(/=/g, '').trim()] || '';
      continue;
    }
    if (!sec) continue;
    const c = line.indexOf(':');
    if (c < 0) continue;
    let [lv, x, z] = line.slice(0, c).trim().split(/\s+/).map(Number);
    if (lv > 0 && bridged.has(x * 64 + z)) lv--;
    const [id, , angle] = line.slice(c + 1).trim().split(/\s+/).map(Number);
    if (!placed[sec].has(id)) placed[sec].set(id, []);
    placed[sec].get(id).push({ id, x: +mm[1] * 64 + x, z: +mm[2] * 64 + z, level: lv, angle: angle || 0 });
  }
}

// Every string the server scripts can show, normalized: dialogue options and flag texts
// must be among them (so they match what the game really says).
const said = new Set();
(function scan(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) scan(p);
    else if (p.endsWith('.rs2')) for (const m of fs.readFileSync(p, 'utf8').matchAll(/"((?:[^"\\]|\\.)*)"/g)) said.add(norm(m[1].replace(/<p,[a-z_]+>/g, '').replace(/\|/g, ' ')));
  }
})(path.join(root, 'scripts'));
const saidText = [...said].join('\n');

// Obj categories (weapon_slash, arrows ...) by name, for "any sword" style items.
const objCategory = new Map();
(function scan(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) scan(p);
    else if (p.endsWith('.obj')) {
      let cur = null;
      for (const raw of fs.readFileSync(p, 'utf8').split('\n')) {
        const t = raw.trim();
        const m = /^\[(\w+)\]$/.exec(t);
        if (m) cur = m[1];
        else if (cur && t.startsWith('category=')) {
          const c = t.slice(9);
          if (!objCategory.has(c)) objCategory.set(c, []);
          if (!cur.startsWith('cert_')) objCategory.get(c).push(cur);
        }
      }
    }
  }
})(path.join(root, 'scripts'));

// Loc sizes (width x length) by name, for highlighting all of a big object's squares.
const locSize = new Map();
(function scan(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) scan(p);
    else if (p.endsWith('.loc')) {
      let cur = null;
      for (const raw of fs.readFileSync(p, 'utf8').split('\n')) {
        const t = raw.trim();
        const m = /^\[(\w+)\]$/.exec(t);
        if (m) {
          cur = m[1];
          locSize.set(cur, [1, 1]);
        } else if (cur && /^width=\d+/.test(t)) locSize.get(cur)[0] = +t.slice(6);
        else if (cur && /^length=\d+/.test(t)) locSize.get(cur)[1] = +t.slice(7);
      }
    }
  }
})(path.join(root, 'scripts'));

const errors = [];
const fail = (q, msg) => errors.push(`${q}: ${msg}`);

function resolve(q, kind, list) {
  return [].concat(list).map((n) => {
    const id = ids[kind].get(n);
    if (id === undefined) fail(q, `no ${kind} called ${n}`);
    return id;
  }).filter((x) => x !== undefined);
}

/** The placement of any of `idList` nearest to `at`, within r squares on the same level. */
function snap(kind, idList, at, r) {
  let best = null;
  let bd = Infinity;
  for (const id of idList) {
    for (const p of placed[kind].get(id) || []) {
      if (p.level !== at[2]) continue;
      const d = Math.max(Math.abs(p.x - at[0]), Math.abs(p.z - at[1]));
      if (d <= r && d < bd) {
        bd = d;
        best = p;
      }
    }
  }
  return best;
}

// ---- condition language: "have:egg & !have:milk | in:millTop", stage<=N, seen:flag
function parseCond(q, src, guide) {
  if (src === null || src === undefined || src === true) return null;
  const ors = String(src).split('|').map((s) => s.trim());
  const one = (t) => {
    let neg = false;
    if (t.startsWith('!')) {
      neg = true;
      t = t.slice(1).trim();
    }
    let c;
    let m;
    if ((m = /^have:(\w+)(?::(\d+))?$/.exec(t))) {
      if (!guide.items[m[1]]) fail(q, `condition uses unknown item ${m[1]}`);
      c = { have: m[1], qty: m[2] ? +m[2] : undefined };
    } else if ((m = /^wear:(\w+)$/.exec(t))) {
      if (!guide.items[m[1]]) fail(q, `condition uses unknown item ${m[1]}`);
      c = { wear: m[1] };
    } else if ((m = /^in:(\w+)$/.exec(t))) {
      if (!guide.zones || !guide.zones[m[1]]) fail(q, `condition uses unknown zone ${m[1]}`);
      c = { in: m[1] };
    } else if ((m = /^seen:(\w+)$/.exec(t))) {
      if (!guide.flags || !guide.flags[m[1]]) fail(q, `condition uses unknown flag ${m[1]}`);
      c = { seen: m[1] };
    } else if ((m = /^npc:(\w+)$/.exec(t))) {
      c = { npc: resolve(q, 'npc', m[1]) };
    } else if ((m = /^level:(\d)$/.exec(t))) {
      c = { level: +m[1] };
    } else if ((m = /^stage(>=|<=|=|<|>)(\d+)$/.exec(t))) {
      c = { stage: m[1], n: +m[2] };
    } else {
      fail(q, `bad condition "${t}"`);
      c = {};
    }
    return neg ? { not: c } : c;
  };
  const tree = ors.map((o) => o.split('&').map((a) => one(a.trim())));
  return tree.length === 1 && tree[0].length === 1 ? tree[0][0] : { or: tree.map((and) => (and.length === 1 ? and[0] : { and })) };
}

function build(file) {
  const g = require(file);
  const q = g.quest;
  const p = progress.quests[q];
  if (!p) fail(q, 'not in progress.json (no journal found for it)');
  const out = {
    quest: q,
    name: g.name || (p && p.name),
    difficulty: g.difficulty,
    members: !!g.members,
    start: g.start,
    items: {},
    required: g.required || [],
    recommended: g.recommended || [],
    skills: g.skills || [],
    zones: g.zones || {},
    flags: g.flags || {},
    steps: {},
    stages: [],
    sections: g.sections || [],
    rewards: g.rewards || [],
    journalCount: g.journalCount,
    journal: g.journal ? g.journal.map((j) => ({ lo: j.lo, hi: j.hi === undefined ? j.lo : j.hi, texts: j.texts.map(norm) })) : undefined,
  };
  for (const [k, it] of Object.entries(g.items || {})) {
    const objs = [].concat(it.obj || []);
    for (const c of [].concat(it.category || [])) {
      if (!objCategory.has(c)) fail(q, `no obj category ${c}`);
      objs.push(...(objCategory.get(c) || []));
    }
    out.items[k] = { name: it.name, ids: resolve(q, 'obj', objs), qty: it.qty || 1, qtyFromStage: it.qtyFromStage, tip: it.tip, worn: !!it.worn };
  }
  for (const k of [...out.required, ...out.recommended]) if (!out.items[k]) fail(q, `required item ${k} not defined`);
  for (const [id, s] of Object.entries(g.steps)) {
    const st = { text: s.text, items: s.items || [], options: s.options || [], note: s.note };
    for (const k of st.items) if (!out.items[k]) fail(q, `step ${id} needs undefined item ${k}`);
    for (const o of st.options) if (!said.has(norm(o))) fail(q, `step ${id}: the game never offers the option "${o}"`);
    if (!s.at && !s.npc && !s.loc && !s.obj) fail(q, `step ${id} has no position`);
    let at = s.at;
    if (s.npc) {
      st.npc = resolve(q, 'npc', s.npc);
      const sp = at ? snap('npc', st.npc, at, s.range || 12) : null;
      if (at && !sp && !s.spawned) fail(q, `step ${id}: no ${[].concat(s.npc).join('/')} spawns near ${at}`);
      if (sp && !s.keepAt) at = [sp.x, sp.z, sp.level];
    }
    if (s.loc) {
      st.loc = resolve(q, 'loc', s.loc);
      const sp = at ? snap('loc', st.loc, at, s.range || 6) : null;
      if (!sp) fail(q, `step ${id}: no ${[].concat(s.loc).join('/')} placed near ${at}`);
      else {
        st.locAt = [sp.x, sp.z, sp.level];
        const size = locSize.get(names.loc.get(sp.id)) || [1, 1];
        const rot = sp.angle === 1 || sp.angle === 3;
        st.locSize = rot ? [size[1], size[0]] : size;
        if (!s.keepAt) at = st.locAt;
      }
    }
    if (s.obj) {
      st.obj = resolve(q, 'obj', s.obj);
      const sp = at ? snap('obj', st.obj, at, s.range || 12) : null;
      if (at && !sp) fail(q, `step ${id}: no ${[].concat(s.obj).join('/')} lying near ${at}`);
      if (sp && !s.keepAt) at = [sp.x, sp.z, sp.level];
    }
    if (at) st.at = at;
    if (s.dig) st.dig = true;
    out.steps[id] = st;
  }
  for (const [range, rules] of Object.entries(g.stages)) {
    const [lo, hi] = range.includes('-') ? range.split('-').map(Number) : [+range, +range];
    const rs = rules.map(([cond, step]) => {
      if (!out.steps[step]) fail(q, `stage ${range} uses unknown step ${step}`);
      return { if: parseCond(q, cond, g), step };
    });
    out.stages.push({ lo, hi, rules: rs });
  }
  for (const sec of out.sections) for (const s of sec.steps) if (!out.steps[s]) fail(q, `section ${sec.title} lists unknown step ${s}`);
  for (const [k, fl] of Object.entries(out.flags)) {
    out.flags[k] = { on: [].concat(fl.on || []).map(norm), off: [].concat(fl.off || []).map(norm) };
    for (const t of [...out.flags[k].on, ...out.flags[k].off]) if (!saidText.includes(t)) fail(q, `flag ${k}: the game never says "${t}"`);
  }
  return out;
}

function norm(s) {
  return String(s).replace(/@[a-z0-9]{3}@/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const guides = {};
const dir = path.join(__dirname, 'guides');
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js')).sort()) {
  const g = build(path.join(dir, f));
  guides[g.quest] = g;
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
fs.writeFileSync(OUT, JSON.stringify(guides));
console.log(`${Object.keys(guides).length} guides: ${Object.values(guides).map((g) => `${g.name} (${Object.keys(g.steps).length} steps)`).join(', ')}`);
