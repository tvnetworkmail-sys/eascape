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
// Usage: build-guides.js <content> [<2007 server data>]
//
// 2007RS: the guides come from EASCape (its app/tools/quests/guides, tested there against the
// same quests); some 274 names are loc_NNNN in our content, names274.json gives their ids.
// The objects are checked where the 2007 map has them (the 2007 server data, by default
// engine/data/cache2007/server next to the content: maps.zip, locs.json), and the npc and obj
// ids are written as the 2007 client knows them (its ids.json), so the build needs that data
// (made when the server starts). A guide for a quest 2007RS doesn't have yet says inGame: false:
// it is listed as not in the game, and its names aren't checked against our content.

const fs = require('fs');
const path = require('path');

const root = process.argv[2];
if (!root) {
  console.error('usage: build-guides.js <content> [<2007 server data>]');
  process.exit(1);
}
const dir07 = process.argv[3] || path.join(root, '..', 'engine', 'data', 'cache2007', 'server');
const d07 = require('./data2007')(dir07);
if (!d07) {
  console.error(`no 2007 server data (maps.zip, locs.json, ids.json) in ${dir07}: start the server once, or give its data/cache2007/server`);
  process.exit(1);
}
const OUT = path.join(__dirname, '..', '..', 'src', 'plugins', 'questhelper', 'guides.json');
const PROGRESS = path.join(__dirname, '..', '..', 'src', 'plugins', 'questhelper', 'progress.json');
const progress = JSON.parse(fs.readFileSync(PROGRESS, 'utf8'));

function pack(kind) {
  const byName = new Map();
  for (const l of fs.readFileSync(path.join(root, 'pack', `${kind}.pack`), 'utf8').split('\n')) {
    const m = /^(\d+)=(\S+)/.exec(l.trim());
    if (m) byName.set(m[2], +m[1]);
  }
  for (const [n, id] of Object.entries(require('./names274.json')[kind] || {})) if (!byName.has(n)) byName.set(n, id);
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

// 2007RS: the server's locs are the 2007 map's (GameMap), where it has the square
// (the locs 2007 has and we don't, by name: a step's object can be one of those, see below)
const ext07 = [];
d07.locs(placed.loc, ext07);

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

// Loc sizes (width x length) and shown names by name, for highlighting all of a big object's squares.
const locSize = new Map();
const locName = new Map();
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
        } else if (cur && t.startsWith('name=')) locName.set(cur, t.slice(5).toLowerCase());
        else if (cur && /^width=\d+/.test(t)) locSize.get(cur)[0] = +t.slice(6);
        else if (cur && /^length=\d+/.test(t)) locSize.get(cur)[1] = +t.slice(7);
      }
    }
  }
})(path.join(root, 'scripts'));

// 2007RS: each guide's quest variable, live from the server (::appquests; game.js / page.js): the
// varp ids (content/pack/varp.pack, the server's ids), the varbits'
// bits (.varbit), the constants (^name) and the variable and "complete" value each quest list line
// is coloured from (general/scripts/quests.rs2), by its quest list component.
const varpIds = pack('varp');
const constants = new Map();
const varbits = new Map();
(function scan(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) scan(p);
    else if (p.endsWith('.constant')) {
      for (const raw of fs.readFileSync(p, 'utf8').split('\n')) {
        const m = /^\^(\w+)\s*=\s*(-?\d+)\s*(?:\/\/.*)?$/.exec(raw.trim());
        if (m) constants.set(m[1], +m[2]);
      }
    } else if (p.endsWith('.varbit')) {
      let cur = null;
      for (const raw of fs.readFileSync(p, 'utf8').split('\n')) {
        const t = raw.trim();
        const m = /^\[(\w+)\]$/.exec(t);
        if (m) varbits.set((cur = m[1]), {});
        else if (cur && t.includes('=')) varbits.get(cur)[t.slice(0, t.indexOf('='))] = t.slice(t.indexOf('=') + 1);
      }
    }
  }
})(path.join(root, 'scripts'));
/** A varp or varbit by name, or bits of a varp ("name:lo:hi"): { id, lo, hi } (the client's varp
 * id and the bits). */
function variable(name) {
  // (bits of a varp: name:lo:hi, as numbers or constants: tbwt_flags:^tbwt_tamayu_agility_count_start:^...)
  const bits = /^(\w+):(\^?\w+):(\^?\w+)$/.exec(name);
  if (bits) {
    const v = variable(bits[1]);
    const n = (t) => (/^\d+$/.test(t) ? +t : constants.get(t.replace(/^\^/, '')));
    const lo = n(bits[2]);
    const hi = n(bits[3]);
    return v && v.lo === 0 && v.hi === 31 && Number.isInteger(lo) && Number.isInteger(hi) ? { id: v.id, lo, hi } : null;
  }
  // (the server's id: ::appquests asks for it by that, whatever id the 2007 client knows it by)
  const at = (n) => varpIds.get(n);
  if (varpIds.has(name)) return { id: at(name), lo: 0, hi: 31 };
  const b = varbits.get(name);
  if (b && varpIds.has(b.basevar)) return { id: at(b.basevar), lo: +b.startbit, hi: +b.endbit };
  return null;
}
/** A number, or a constant (^name). */
function num(q, t) {
  if (/^-?\d+$/.test(t)) return +t;
  const c = constants.get(String(t).replace(/^\^/, ''));
  if (c === undefined) fail(q, `no constant ${t}`);
  return c === undefined ? NaN : c;
}
const listVar = new Map(); // quest list component id -> { varp, complete }
for (const m of fs.readFileSync(path.join(root, 'scripts', 'general', 'scripts', 'quests.rs2'), 'utf8').matchAll(/send_quest_progress_colour\(questlist:(\w+),\s*%(\w+),\s*\^(\w+)\)/g)) {
  const com = pack('interface').get(`questlist:${m[1]}`);
  if (com !== undefined && !listVar.has(com)) listVar.set(com, { varp: m[2], complete: constants.get(m[3]) });
}

const errors = [];
const fail = (q, msg) => errors.push(`${q}: ${msg}`);

let lenient = false; // building a guide for a quest not in the game: names we lack are left out
function resolve(q, kind, list) {
  return [].concat(list).map((n) => {
    const id = ids[kind].get(n);
    if (id === undefined && !lenient) fail(q, `no ${kind} called ${n}`);
    return id;
  }).filter((x) => x !== undefined);
}

// 2007RS: the ids the 2007 client shows (npcs and objs EASCape added after 2006 have other ones)
const client = (kind, list) => list.map((id) => (kind === 'npc' ? d07.npc(id) : kind === 'obj' ? d07.obj(id) : id));

/**
 * 2007RS: where the 2007 map has another loc than ours with the same name as one of `idList`
 * (one of its own that none of ours stands for, or one of ours with another id), nearest to `at`
 * within r squares: the object the step means, as 2007 has it (the app highlights the squares,
 * whatever the id).
 */
function snap07(idList, at, r) {
  const want = new Set(idList.map((id) => locName.get(names.loc.get(id))).filter(Boolean));
  let best = null;
  let bd = Infinity;
  const consider = (p, name) => {
    if (p.level !== at[2] || !name || !want.has(name.toLowerCase())) return;
    const d = Math.max(Math.abs(p.x - at[0]), Math.abs(p.z - at[1]));
    if (d <= r && d < bd) {
      bd = d;
      best = p;
    }
  };
  for (const p of ext07) consider(p, p.name);
  for (const [id, list] of placed.loc) {
    const name = locName.get(names.loc.get(id));
    if (name && want.has(name)) for (const p of list) consider(p, name);
  }
  return best;
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
      c = { npc: client('npc', resolve(q, 'npc', m[1])) };
    } else if ((m = /^level:(\d)$/.exec(t))) {
      c = { level: +m[1] };
    } else if ((m = /^stage(>=|<=|=|<|>)(\^?\w+)$/.exec(t))) {
      c = { stage: m[1], n: num(q, m[2]) };
    } else if ((m = /^var:(\w+)(>=|<=|=|<|>)(\^?\w+)$/.exec(t))) {
      // 2007RS: one of the quest's other variables (the guide's vars), live from the server
      if (!guide.vars || !guide.vars[m[1]]) fail(q, `condition uses unknown variable ${m[1]}`);
      c = { var: m[1], op: m[2], n: num(q, m[3]) };
    } else if ((m = /^count:(\w+)(>=|<=|=|<|>)(\^?\w+)$/.exec(t))) {
      // how many of the variable's bits are set
      if (!guide.vars || !guide.vars[m[1]]) fail(q, `condition uses unknown variable ${m[1]}`);
      c = { var: m[1], count: true, op: m[2], n: num(q, m[3]) };
    } else if ((m = /^bit:(\w+):(\^?\w+)$/.exec(t))) {
      if (!guide.vars || !guide.vars[m[1]]) fail(q, `condition uses unknown variable ${m[1]}`);
      c = { var: m[1], bit: num(q, m[2]) };
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
  const away = g.inGame === false;
  lenient = away;
  // 2007RS: a miniquest has no quest list line; it is followed by its variable alone (miniquest: true)
  if (!p && !away && !g.miniquest) addQuest(g);
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
    notInGame: away || undefined,
    journal: g.journal ? g.journal.map((j) => ({ lo: j.lo, hi: j.hi === undefined ? j.lo : j.hi, texts: j.texts.map(norm) })) : undefined,
  };
  if (!away) {
    // the quest's own variable (the guide's varp, else the one its quest list line is coloured
    // from) and the value it has when done; the guide's other variables (vars: { key: name })
    const lv = p ? listVar.get(p.com) : null;
    const vname = g.varp || (p && p.varp) || (lv && lv.varp);
    out.live = vname ? variable(vname) : null;
    if (!out.live) fail(q, vname ? `no varp or varbit called ${vname}` : 'no quest variable: give the guide a varp');
    const done = g.complete !== undefined ? num(q, g.complete) : p && Number.isFinite(p.complete) ? p.complete : lv && lv.varp === vname ? lv.complete : undefined;
    if (!Number.isFinite(done)) fail(q, 'no "complete" value: give the guide one');
    out.complete = done;
    // done: a rule that also means done (a quest with two variables, one per way through)
    if (g.done) out.done = parseCond(q, g.done, g);
    if (g.vars) {
      out.vars = {};
      for (const [k, n] of Object.entries(g.vars)) {
        out.vars[k] = variable(n);
        if (!out.vars[k]) fail(q, `vars.${k}: no varp or varbit called ${n}`);
      }
    }
  }
  for (const [k, it] of Object.entries(g.items || {})) {
    const objs = [].concat(it.obj || []);
    for (const c of [].concat(it.category || [])) {
      if (!objCategory.has(c)) fail(q, `no obj category ${c}`);
      objs.push(...(objCategory.get(c) || []));
    }
    out.items[k] = { name: it.name, ids: client('obj', resolve(q, 'obj', objs)), qty: it.qty || 1, qtyFromStage: it.qtyFromStage, tip: it.tip, worn: !!it.worn };
  }
  for (const k of [...out.required, ...out.recommended]) if (!out.items[k]) fail(q, `required item ${k} not defined`);
  for (const [id, s] of Object.entries(g.steps)) {
    const st = { text: s.text, items: s.items || [], options: s.options || [], note: s.note };
    for (const k of st.items) if (!out.items[k]) fail(q, `step ${id} needs undefined item ${k}`);
    for (const o of st.options) if (!away && !said.has(norm(o))) fail(q, `step ${id}: the game never offers the option "${o}"`);
    // (anywhere: a step done wherever you are, such as using one item on another: no place, no route)
    if (!s.at && !s.npc && !s.loc && !s.obj && !s.anywhere && !s.square) fail(q, `step ${id} has no position`);
    let at = s.at;
    if (away) {
      // not in the game: the guide is only there to read, nothing is highlighted
      if (s.npc) st.npc = client('npc', resolve(q, 'npc', s.npc));
      if (s.obj) st.obj = client('obj', resolve(q, 'obj', s.obj));
    } else {
      if (s.npc) {
        st.npc = resolve(q, 'npc', s.npc);
        const sp = at ? snap('npc', st.npc, at, s.range || 12) : null;
        if (at && !sp && !s.spawned) fail(q, `step ${id}: no ${[].concat(s.npc).join('/')} spawns near ${at}`);
        if (sp && !s.keepAt) at = [sp.x, sp.z, sp.level];
      }
      if (s.loc) {
        st.loc = resolve(q, 'loc', s.loc);
        const sp = at ? snap('loc', st.loc, at, s.range || 6) || snap07(st.loc, at, s.range || 6) : null;
        if (!sp) fail(q, `step ${id}: no ${[].concat(s.loc).join('/')} placed near ${at}`);
        else {
          st.locAt = [sp.x, sp.z, sp.level];
          const size = sp.size || locSize.get(names.loc.get(sp.id)) || [1, 1];
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
      if (st.npc) st.npc = client('npc', st.npc);
      if (st.obj) st.obj = client('obj', st.obj);
    }
    // square: [x, z, level, w, l]: an object only the 2007 map has (no name of ours to find it by),
    // highlighted by hand
    if (s.square) {
      st.locAt = s.square.slice(0, 3);
      st.locSize = [s.square[3] || 1, s.square[4] || 1];
    }
    if (at) st.at = at;
    if (s.reach) st.reach = s.reach; // how close the route must get (an object you use from further off)
    if (s.dig) st.dig = true;
    out.steps[id] = st;
  }
  for (const [range, rules] of Object.entries(g.stages)) {
    // "N", "N-M", "^const" or "^a-^b"
    const [lo, hi] = range.includes('-') ? range.split('-').map((t) => num(q, t.trim())) : [num(q, range), num(q, range)];
    const rs = rules.map(([cond, step]) => {
      if (!out.steps[step]) fail(q, `stage ${range} uses unknown step ${step}`);
      return { if: parseCond(q, cond, g), step };
    });
    out.stages.push({ lo, hi, rules: rs });
  }
  for (const sec of out.sections) for (const s of sec.steps) if (!out.steps[s]) fail(q, `section ${sec.title} lists unknown step ${s}`);
  for (const [k, fl] of Object.entries(out.flags)) {
    out.flags[k] = { on: [].concat(fl.on || []).map(norm), off: [].concat(fl.off || []).map(norm) };
    // 2007RS: where the game keeps what the flag stands for, the rule that reads it from the quest's
    // variables (var: 'var:x>=^c & bit:y:3'), live from the server: it wins over the chat text.
    // text: true keeps the chat text too, for the part no variable holds (picking up an item).
    if (fl.var && !away) {
      out.flags[k].var = parseCond(q, fl.var, g);
      if (fl.text) out.flags[k].text = true;
      if (/seen:/.test(fl.var)) fail(q, `flag ${k}: its var rule can't use seen:`);
    }
    for (const t of [...out.flags[k].on, ...out.flags[k].off]) if (!away && !saidText.includes(t)) fail(q, `flag ${k}: the game never says "${t}"`);
  }
  return out;
}

// 2007RS: a quest in the game that progress.json doesn't list yet (its journal wasn't read when it
// was made) gets a place in the panel's quest list, by its quest list line, as server.js does
// for the quests with only a server guide: its colour gives the status.
const ifaces = pack('interface');
const addedQuests = [];
function addQuest(g) {
  const com = ifaces.get(`questlist:${g.quest}`);
  if (com === undefined) return fail(g.quest, `not in progress.json, and no questlist:${g.quest} in interface.pack`);
  if (!g.name) return fail(g.quest, 'not in progress.json: give the guide a name');
  progress.quests[g.quest] = { com, complete: null, dialogue: {}, journal: [], name: g.name, varp: null };
  addedQuests.push(g.quest);
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
if (addedQuests.length) {
  const sorted = (v) => (Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
  const ascii = (t) => t.replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  fs.writeFileSync(PROGRESS, `${ascii(JSON.stringify(sorted(progress), null, 1))}\n`);
  console.log(`added to the quest list: ${addedQuests.join(', ')} (run com2007.py for their 2007 quest list lines)`);
}
console.log(`${Object.keys(guides).length} guides: ${Object.values(guides).map((g) => `${g.name} (${Object.keys(g.steps).length} steps)`).join(', ')}`);
