#!/usr/bin/env node
'use strict';
// The Quest Helper's routes that work today, kept so a later change to the route data (a
// rebuild, a new quest's transports, new maps) can't quietly break a quest that's been tested.
// For every guide (src/plugins/questhelper/server-guides.json): each step to the next one that
// has a place, as the route line would draw it. golden.json keeps every one that has worked;
// test/routes.test.js (part of npm test) checks they all still do.
// Usage: node tools/routes/golden.js            (add today's newly working routes; refuses if one broke)
//        node tools/routes/golden.js --check    (report any golden route that no longer works)
const fs = require('fs');
const path = require('path');
const { load } = require('../../src/plugins/questhelper/route');

const GOLDEN = path.join(__dirname, 'golden.json');
const OPTS = { near: 1, maxNodes: 400000, weight: 2 };
// a route works if it can be walked without what some players have yet, or else with it (the
// fairy rings, once Fairytale II allows them: a search that may take them looks much further)
const UNLOCKS = ['fairyrings'];

function pairs() {
  const guides = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'plugins', 'questhelper', 'server-guides.json'), 'utf8'));
  const out = [];
  for (const g of Object.values(guides)) {
    const steps = Object.values(g.steps).filter((s) => s.at).sort((a, b) => a.id - b.id);
    for (let i = 1; i < steps.length; i++) {
      const a = steps[i - 1].at;
      const b = steps[i].at;
      if (a[0] === b[0] && a[1] === b[1] && a[2] === b[2]) continue;
      out.push({ quest: g.key, from: steps[i - 1].id, to: steps[i].id, a, b });
    }
  }
  return out;
}

function works(world, p) {
  const from = { x: p.a[0], z: p.a[1], level: p.a[2] };
  const to = { x: p.b[0], z: p.b[1], level: p.b[2] };
  return !!world.find(from, to, OPTS) || !!world.find(from, to, { ...OPTS, allow: UNLOCKS });
}

const world = load();
if (process.argv.includes('--check')) {
  const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  const broken = golden.filter((p) => !works(world, p));
  for (const p of broken) console.log(`BROKEN ${p.quest} step ${p.from} -> ${p.to}: (${p.a}) -> (${p.b})`);
  console.log(`${golden.length - broken.length} of ${golden.length} golden routes work`);
  process.exit(broken.length ? 1 : 0);
}
// adding: every golden route must still work (a broken one is never dropped from the list,
// it's fixed), then today's working ones join it
const id = (p) => `${p.quest}:${p.from}:${p.to}:${p.a}:${p.b}`;
const old = fs.existsSync(GOLDEN) ? JSON.parse(fs.readFileSync(GOLDEN, 'utf8')) : [];
const broken = old.filter((p) => !works(world, p));
if (broken.length) {
  for (const p of broken) console.log(`BROKEN ${p.quest} step ${p.from} -> ${p.to}: (${p.a}) -> (${p.b})`);
  console.log('A golden route broke: fix it first. golden.json not changed.');
  process.exit(1);
}
const have = new Set(old.map(id));
const all = pairs();
const t0 = Date.now();
const add = all.filter((p) => !have.has(id(p)) && works(world, p));
fs.writeFileSync(GOLDEN, JSON.stringify(old.concat(add), null, 1) + '\n');
console.log(`${old.length} golden routes still work, ${add.length} added (${all.length} step-to-step routes in the guides; ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
