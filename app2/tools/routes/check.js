#!/usr/bin/env node
'use strict';
// Checks the Quest Helper's walking routes for every guide (src/plugins/questhelper/guides.json):
// for each step with a place, the route from the step before it (in the guide's order: where you
// would be standing) must be found over collision.bin and transports.json, as the app's route
// worker finds it (on foot, or with the fairy rings for a player who has them). The first step of
// each quest is reached from Lumbridge, the next from where the route to the step before ended.
// Steps a route can't reach for a reason of the game (you are taken there: a cutscene, a teleport
// by an NPC, a boat) are listed in check-skip.json with the reason.
// Usage: node tools/routes/check.js [--quest key] [--json]   (exit 1 when a route fails)
const fs = require('fs');
const path = require('path');
const { load } = require('../../src/plugins/questhelper/route');

const guides = require('../../src/plugins/questhelper/guides.json');
const SKIP = JSON.parse(fs.readFileSync(path.join(__dirname, 'check-skip.json'), 'utf8'));
const LUMBRIDGE = [3222, 3218, 0];
const args = process.argv.slice(2);
const only = args.includes('--quest') ? args[args.indexOf('--quest') + 1] : null;

/** Every step-to-step route of a guide: { quest, from, to, a, b, near }. */
function pairs(g) {
  const order = [];
  for (const sec of g.sections) for (const id of sec.steps) if (!order.includes(id)) order.push(id);
  const out = [];
  let prev = { id: 'Lumbridge', at: LUMBRIDGE };
  for (const id of order) {
    const st = g.steps[id];
    if (!st || !st.at) continue;
    const a = prev.at;
    const b = st.at;
    if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) out.push({ quest: g.quest, from: prev.id, to: id, a, b, near: st.reach || (st.locAt ? Math.max(1, ...(st.locSize || [1, 1])) : st.npc ? 1 : 0) });
    prev = { id, at: b };
  }
  return out;
}

// As the app's route worker searches (src/main/routeWorker.js): a near-shortest route, then one
// that heads for the goal harder, then a plain shortest-route search (a goal behind a long detour,
// such as Mort Myre's Grotto from Falador by way of Paterdomus, where heading for the goal harder
// only fills the dead end west of the Salve); on foot, then with the fairy rings.
function route(world, p) {
  const from = { x: p.a[0], z: p.a[1], level: p.a[2] };
  const to = { x: p.b[0], z: p.b[1], level: p.b[2] };
  for (const allow of [[], ['fairyrings']]) {
    const r = world.find(from, to, { near: p.near, maxNodes: 60000, weight: 1.2, allow })
      || world.find(from, to, { near: p.near, maxNodes: MAX, weight: 2, allow })
      || world.find(from, to, { near: p.near, maxNodes: MAX1, weight: 1, allow });
    if (r) return r;
  }
  return null;
}
const MAX = args.includes('--quick') ? 300000 : 3000000;
const MAX1 = args.includes('--quick') ? 100000 : 1000000;

const world = load();
// 2007RS: every route link requirement (requires.json, from tools/routes/requires.js) must still
// match a transport (a renamed or moved link would quietly lose it). Routes here are found with no
// quest variables known, as before: every link counts as usable.
{
  const { applyRequires } = require('../../src/plugins/questhelper/route');
  const requires = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'plugins', 'questhelper', 'requires.json'), 'utf8'));
  const counts = applyRequires(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'plugins', 'questhelper', 'transports.json'), 'utf8')), requires, new Map());
  const lost = requires.filter((r, i) => !counts[i]);
  for (const r of lost) console.log(`REQUIREMENT MATCHES NO LINK: ${r.name || JSON.stringify(r.gates)}${r.to ? ` to ${r.to}` : ''}${r.rel ? ` by ${r.rel}` : ''}`);
  if (lost.length) process.exitCode = 1;
}
const failed = [];
let total = 0;
let skipped = 0;
for (const g of Object.values(guides)) {
  if (g.notInGame || (only && g.quest !== only)) continue;
  let end = null; // where the last route ended: you stand there (next to the NPC or object)
  for (const p of pairs(g)) {
    total++;
    if (end && p.from !== 'Lumbridge') p.a = end;
    const skip = SKIP[`${p.quest}:${p.to}`] || SKIP[`${p.quest}:${p.from}>${p.to}`];
    if (skip) skipped++;
    const r = skip ? null : route(world, p);
    if (!skip && !r) failed.push(p);
    end = r ? [r[r.length - 1].x, r[r.length - 1].z, r[r.length - 1].level] : null;
  }
}
if (args.includes('--json')) {
  console.log(JSON.stringify(failed));
  process.exit(failed.length || process.exitCode ? 1 : 0);
}
for (const p of failed) console.log(`NO ROUTE ${p.quest}: ${p.from} (${p.a}) -> ${p.to} (${p.b})`);
console.log(`${total - skipped - failed.length} of ${total - skipped} step-to-step routes found; ${skipped} skipped (check-skip.json: the game takes you there)`);
process.exit(failed.length || process.exitCode ? 1 : 0);
