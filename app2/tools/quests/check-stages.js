#!/usr/bin/env node
'use strict';
// Checks every app guide's stages against our quest scripts (content/scripts): each value the
// scripts give the quest's variable (%var = N / ^constant, or setbit for a quest kept in bits) must
// have a stage table in the guide that always picks a step, so the helper never says "no step for
// where you are"; and each stage table should be a value the scripts can set.
// Usage: node app/tools/quests/check-stages.js [<content>]    (exit 1 on a gap)
const fs = require('fs');
const path = require('path');

const content = process.argv[2] || path.join(__dirname, '..', '..', '..', 'content');
const guides = require('../../src/plugins/questhelper/guides.json');

const varpNames = new Map();
for (const l of fs.readFileSync(path.join(content, 'pack', 'varp.pack'), 'utf8').split('\n')) {
  const m = /^(\d+)=(\S+)/.exec(l.trim());
  if (m) varpNames.set(+m[1], m[2]);
}
const constants = new Map();
const varbits = new Map(); // name -> {basevar, lo, hi}
const sources = [];
(function scan(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '_test') scan(p);
    } else if (p.endsWith('.constant')) {
      for (const raw of fs.readFileSync(p, 'utf8').split('\n')) {
        const m = /^\^(\w+)\s*=\s*(-?\d+)/.exec(raw.trim());
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
    } else if (p.endsWith('.rs2')) sources.push(fs.readFileSync(p, 'utf8'));
  }
})(path.join(content, 'scripts'));
const all = sources.join('\n');

const val = (t) => (/^-?\d+$/.test(t) ? +t : constants.get(t.replace(/^\^/, '')));

/** The script names that hold a guide's quest variable (a varp, or a varbit over its bits). */
function names(live) {
  const out = [];
  const vp = varpNames.get(live.id);
  if (live.lo === 0 && live.hi === 31) out.push(vp);
  for (const [n, b] of varbits) if (b.basevar === vp && +b.startbit === live.lo && +b.endbit === live.hi) out.push(n);
  return out.filter(Boolean);
}

let gaps = 0;
const report = [];
for (const [key, g] of Object.entries(guides)) {
  if (g.notInGame || !g.live) continue;
  const ns = names(g.live);
  if (!ns.length) {
    report.push(`${key}: its variable (varp ${g.live.id} bits ${g.live.lo}-${g.live.hi}) has no name in the scripts: not checked`);
    continue;
  }
  const set = new Set([0]);
  let bitwise = false;
  for (const n of ns) {
    for (const m of all.matchAll(new RegExp(`%${n}\\s*=\\s*([\\^\\w]+)\\s*;`, 'g'))) {
      const v = val(m[1]);
      if (v !== undefined) set.add(v);
    }
    if (new RegExp(`%${n}\\s*=\\s*(setbit|clearbit)\\(`).test(all)) bitwise = true;
  }
  if (bitwise) continue; // a quest kept in bits (its rules go by bits)
  const missing = [];
  for (const v of [...set].sort((a, b) => a - b)) {
    if (v >= g.complete) continue;
    const t = g.stages.find((s) => v >= s.lo && v <= s.hi);
    if (!t) missing.push(`${v} (no stage table)`);
    else if (!t.rules.some((r) => r.if === null)) missing.push(`${v} (no fallback step)`);
  }
  const unused = g.stages.filter((s) => ![...set].some((v) => v >= s.lo && v <= s.hi)).map((s) => (s.lo === s.hi ? s.lo : `${s.lo}-${s.hi}`));
  if (missing.length) {
    gaps++;
    report.push(`${key}: the scripts set ${ns.join('/')} to ${missing.join(', ')}`);
  }
  if (unused.length) report.push(`${key}: stage tables the scripts never reach: ${unused.join(', ')} (note only)`);
}
console.log(report.join('\n') || 'every stage the scripts set has a step');
process.exit(gaps ? 1 : 0);
