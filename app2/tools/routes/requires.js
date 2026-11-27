#!/usr/bin/env node
'use strict';
// 2007RS: the quest a route link needs. tools/routes/requires.json lists the links (transports, by
// their loc's name; optionally only the ones to a square, `to`, or by a step, `rel`, or used from
// one side of the loc, `side`) that the game's scripts only let you use at a quest's stage, as
// conditions on the quest's variables by name:
//   "fishingcompo>=^fishingcompo_complete & bit:ibanmulti:^upass_started_bit | troll_opened_back_exit=1"
// (a varp or varbit, an operator (>= <= = != < >) and a number or ^constant; bit:<var>:<n> for one
// bit; & binds closer than |). A level or an item too: stat:agility>=66 (the current level, boosts
// counted, as the scripts' stat()), inv:<obj>/<obj> (carried), worn:<obj>/<obj>, has:<obj>/<obj>
// (carried or worn), cat:<obj category>[/<category>...] (one of its items carried; worncat:, hascat: worn, either); inv:coins>=30 for an amount (a fare:
// only the route uses it, no price is shown); !<term> for what you mustn't have. A door the collision data leaves
// open but the game locks (never: only opened from the other side; a railing only squeezed past) has "gates": [[x, z, level, edge (W N E S: the door's edge of its
// square)], ...] instead of a name, and "from": "on" (only leaving the door's square through it) or
// "off" (only coming onto it), as the script's check_axis decides. This resolves the names to the server's variable ids (as the app's
// ::appquests asks for them) and writes src/plugins/questhelper/requires.json, which route.js puts
// on the matching transports: the app sends the variables' live values with each route search,
// and a link whose condition fails is left out (with no value known, it's used as before).
// Usage: node tools/routes/requires.js [<content>]   (default ../content)
const fs = require('fs');
const path = require('path');

const app = path.join(__dirname, '..', '..');
const root = process.argv[2] || path.join(app, '..', 'content');
const SRC = path.join(__dirname, 'requires.json');
const OUT = path.join(app, 'src', 'plugins', 'questhelper', 'requires.json');

const varpIds = new Map();
for (const l of fs.readFileSync(path.join(root, 'pack', 'varp.pack'), 'utf8').split('\n')) {
  const m = /^(\d+)=(\S+)/.exec(l.trim());
  if (m) varpIds.set(m[2], +m[1]);
}
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
        const s = raw.trim();
        const h = /^\[(\w+)\]$/.exec(s);
        if (h) {
          cur = {};
          varbits.set(h[1], cur);
        } else if (cur && /^(basevar|startbit|endbit)=/.test(s)) cur[s.slice(0, s.indexOf('='))] = s.slice(s.indexOf('=') + 1);
      }
    }
  }
})(path.join(root, 'scripts'));

// objs: our names -> ids -> the 2007 client's ids (what the app sees in the pack), and categories
const objIds = new Map();
for (const l of fs.readFileSync(path.join(root, 'pack', 'obj.pack'), 'utf8').split('\n')) {
  const m = /^(\d+)=(\S+)/.exec(l.trim());
  if (m) objIds.set(m[2], +m[1]);
}
const objCat = new Map();
(function scan(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) scan(p);
    else if (p.endsWith('.obj')) {
      let cur = null;
      for (const raw of fs.readFileSync(p, 'utf8').split('\n')) {
        const s = raw.trim();
        const h = /^\[(\w+)\]$/.exec(s);
        if (h) cur = h[1];
        else if (cur && s.startsWith('category=')) {
          const c = s.slice(9);
          if (!objCat.has(c)) objCat.set(c, []);
          objCat.get(c).push(cur);
        }
      }
    }
  }
})(path.join(root, 'scripts'));
const d07 = require('../quests/data2007')(process.argv[3] || path.join(root, '..', 'engine', 'data', 'cache2007', 'server'));
if (!d07) {
  console.error('no 2007 server data (engine/data/cache2007/server): start the server once');
  process.exit(1);
}

const errors = [];
function objs(names) {
  return names.map((n) => {
    if (!objIds.has(n)) errors.push(`no obj called ${n}`);
    return d07.obj(objIds.get(n));
  });
}
function variable(name) {
  const bits = /^(\w+):(\^?\w+):(\^?\w+)$/.exec(name); // bits of a varp: name:lo:hi (numbers or ^constants)
  if (bits && varpIds.has(bits[1])) return { id: varpIds.get(bits[1]), lo: num(bits[2]), hi: num(bits[3]) };
  if (varpIds.has(name)) return { id: varpIds.get(name), lo: 0, hi: 31 };
  const b = varbits.get(name);
  if (b && varpIds.has(b.basevar)) return { id: varpIds.get(b.basevar), lo: +b.startbit, hi: +b.endbit };
  errors.push(`no varp or varbit called ${name}`);
  return null;
}
function num(t) {
  if (/^-?\d+$/.test(t)) return +t;
  const c = constants.get(t.replace(/^\^/, ''));
  if (c === undefined) errors.push(`no constant ${t}`);
  return c;
}
function term(t) {
  if (t === 'never') return { never: true };
  if (t.startsWith('!')) {
    // not: a banner you may not carry up these stairs
    const c = term(t.slice(1));
    return c && { not: c };
  }
  let m = /^stat:(\w+)\s*(>=|<=|!=|=|<|>)\s*(\d+)$/.exec(t);
  if (m) return { stat: m[1], op: m[2], n: +m[3] };
  m = /^(inv|worn|has):([\w/]+)(?:>=(\d+))?$/.exec(t);
  if (m) return { objs: objs(m[2].split('/')), where: m[1] === 'has' ? 'any' : m[1], n: m[3] ? +m[3] : 1 };
  m = /^(inv|worn|has)?cat:([\w/]+)$/.exec(t);
  if (m) {
    // (one or more obj categories, as the scripts' inv_totalcat: cat: and invcat: carried, worncat:, hascat:)
    const names = [];
    for (const c of m[2].split('/')) {
      if (!objCat.has(c)) errors.push(`no obj category ${c}`);
      names.push(...(objCat.get(c) || []));
    }
    return { objs: objs(names), where: m[1] === 'has' ? 'any' : m[1] || 'inv', n: 1 };
  }
  m = /^bit:(\w+):(\^?\w+)$/.exec(t);
  if (m) {
    const v = variable(m[1]);
    const b = num(m[2]);
    return v && { id: v.id, lo: v.lo + b, hi: v.lo + b, op: '=', n: 1 };
  }
  m = /^([\w:^]+?)\s*(>=|<=|!=|=|<|>)\s*(\^?\w+)$/.exec(t);
  if (!m) {
    errors.push(`bad condition "${t}"`);
    return null;
  }
  const v = variable(m[1]);
  return v && { ...v, op: m[2], n: num(m[3]) };
}

const out = [];
for (const r of JSON.parse(fs.readFileSync(SRC, 'utf8'))) {
  const req = String(r.req).split('|').map((or) => or.split('&').map((a) => term(a.trim())));
  const e = { name: r.name, req };
  for (const k of ['to', 'rel', 'at', 'side', 'gates', 'from']) if (r[k] !== undefined) e[k] = r[k];
  out.push(e);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
fs.writeFileSync(OUT, `${JSON.stringify(out)}\n`);
console.log(`${out.length} route requirements written (${[...new Set(out.flatMap((e) => e.req.flat().filter((t) => t.id !== undefined).map((t) => t.id)))].length} variables)`);
