#!/usr/bin/env node
'use strict';
// Imports route links (EASCape's hand-made ones, or new ones from our build.js) (its app/tools/routes/extra.json) into ours,
// each checked against the 2007 map the server loads (engine/data/cache2007/server):
//   - the loc it starts from must stand there in the 2007 map (by our loc name; within 2 squares,
//     and then the link moves with it), or the link isn't a loc's (a whistle, a quest's way);
//   - where it leads must be a square you can stand on (collision.bin, within 2 squares);
//   - links ours already has (same start square and destination) are left out.
// A link from an area rather than its loc's own square (a rope thrown from an island) is left out
// as "not on the 2007 map": check those by hand.
// Usage: node tools/routes/import-links.js <EASCape extra.json> [--write]
//        node tools/routes/import-links.js <build.js's new transports> --built [--write]
//   writes tools/routes/extra.json (the new links appended, with an "EASCape" note) and adds them to
//   src/plugins/questhelper/transports.json; prints what was left out and why.
const fs = require('fs');
const path = require('path');
const { load } = require('../../src/plugins/questhelper/route');

const [src] = process.argv.slice(2);
const write = process.argv.includes('--write');
// --built: links from our own build.js (new ones the committed data lacks): checked the same way,
// added to transports.json only (build.js makes them again), with no note
const built = process.argv.includes('--built');
const app = path.join(__dirname, '..', '..');
const content = path.join(app, '..', 'content');
const dataDir = path.join(app, 'src', 'plugins', 'questhelper');
const theirs = JSON.parse(fs.readFileSync(src, 'utf8'));
const extraFile = path.join(__dirname, 'extra.json');
const extra = JSON.parse(fs.readFileSync(extraFile, 'utf8'));
const transports = JSON.parse(fs.readFileSync(path.join(dataDir, 'transports.json'), 'utf8'));
const world = load();

const locIds = new Map();
const locNames = new Map();
for (const l of fs.readFileSync(path.join(content, 'pack', 'loc.pack'), 'utf8').split('\n')) {
  const m = /^(\d+)=(\S+)/.exec(l.trim());
  if (m) {
    locIds.set(m[2], +m[1]);
    locNames.set(+m[1], m[2]);
  }
}
// the 2007 map's locs, by square
const placed = new Map();
const d07 = require('../quests/data2007')(path.join(app, '..', 'engine', 'data', 'cache2007', 'server'));
if (!d07) throw new Error('no 2007 server data: start the server once');
d07.locs(placed, null);
const at = new Map(); // "x,z,level" -> Set(names)
for (const [id, list] of placed) {
  const nm = locNames.get(id);
  if (!nm) continue;
  for (const p of list) {
    const k = `${p.x},${p.z},${p.level}`;
    if (!at.has(k)) at.set(k, new Set());
    at.get(k).add(nm);
  }
}

const key = (t) => `${t.x},${t.z},${t.level}>${t.to ? t.to.join(',') : `rel${t.rel}`}`;
const have = new Set([...transports, ...extra].map(key));
const added = [];
const left = { duplicate: 0, notOn2007: [], unwalkable: [] };
for (const t0 of theirs) {
  if (have.has(key(t0))) {
    left.duplicate++;
    continue;
  }
  const t = { ...t0 };
  // where the 2007 map has the loc (an object of ours by that name)
  if (locIds.has(t.name)) {
    let found = null;
    for (let d = 0; d <= 2 && !found; d++) {
      for (let dx = -d; dx <= d && !found; dx++) {
        for (let dz = -d; dz <= d && !found; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== d) continue;
          const s = at.get(`${t.x + dx},${t.z + dz},${t.level}`);
          if (s && s.has(t.name)) found = [dx, dz];
        }
      }
    }
    if (!found) {
      left.notOn2007.push(`${t.name} ${t.x},${t.z},${t.level}`);
      continue;
    }
    if (found[0] || found[1]) {
      t.x += found[0];
      t.z += found[1];
      t.moved = found;
    }
  }
  if (t.to && !world.nearestWalkable(t.to[0], t.to[1], t.to[2], 2)) {
    left.unwalkable.push(`${t.name} ${t.x},${t.z},${t.level} -> ${t.to}`);
    continue;
  }
  if (!built || t.moved) t.note = `${built ? '2007RS' : 'EASCape'}${t0.note ? `: ${t0.note}` : ''}${t.moved ? ` (2007RS: moved ${t.moved} to where the 2007 map has it)` : ''}`;
  delete t.moved;
  have.add(key(t));
  added.push(t);
}
console.log(`${built ? 'Built' : 'EASCape'} links: ${theirs.length}; already ours: ${left.duplicate}; added: ${added.length}; not on the 2007 map: ${left.notOn2007.length}; leading nowhere walkable: ${left.unwalkable.length}`);
for (const s of left.notOn2007) console.log(`  not on the 2007 map: ${s}`);
for (const s of left.unwalkable) console.log(`  leads nowhere walkable: ${s}`);
if (write) {
  if (!built) fs.writeFileSync(extraFile, `${JSON.stringify(extra.concat(added), null, 1)}\n`);
  fs.writeFileSync(path.join(dataDir, 'transports.json'), JSON.stringify(transports.concat(added)));
}
