#!/usr/bin/env node
'use strict';
// Developer helper: where things are, for writing guides.
//   where.js <content> npc|loc|obj <name substring> [x z r]
// npcs and objs from our maps; locs from the 2007 map the server loads (the 2007 server data in
// engine/data/cache2007/server, as build-guides.js checks them), with the 2007-only ones by their
// 2007 name ("2007:<name>").
const fs = require('fs');
const path = require('path');
const [root, kind, name, cx, cz, cr] = process.argv.slice(2);
const pack = new Map();
for (const l of fs.readFileSync(path.join(root, 'pack', `${kind}.pack`), 'utf8').split('\n')) {
  const m = /^(\d+)=(\S+)/.exec(l.trim());
  if (m) pack.set(+m[1], m[2]);
}
const section = { npc: 'NPC', loc: 'LOC', obj: 'OBJ' }[kind];
const found = []; // {nm, id, x, z, level, extra}
const placed = new Map();
for (const f of fs.readdirSync(path.join(root, 'maps'))) {
  const mm = /^m(\d+)_(\d+)\.jm2$/.exec(f);
  if (!mm) continue;
  const rx = +mm[1];
  const rz = +mm[2];
  let sec = '';
  for (const line of fs.readFileSync(path.join(root, 'maps', f), 'utf8').split('\n')) {
    if (line.startsWith('====')) { sec = line.replace(/=/g, '').trim(); continue; }
    if (sec !== section) continue;
    const c = line.indexOf(':');
    if (c < 0) continue;
    const [lv, x, z] = line.slice(0, c).trim().split(/\s+/).map(Number);
    const [id, a, b] = line.slice(c + 1).trim().split(/\s+/).map(Number);
    const p = { id, x: rx * 64 + x, z: rz * 64 + z, level: lv, angle: b || 0, shape: a };
    if (kind === 'loc') {
      if (!placed.has(id)) placed.set(id, []);
      placed.get(id).push(p);
    } else found.push({ nm: pack.get(id) || String(id), ...p });
  }
}
if (kind === 'loc') {
  const d07 = require('./data2007')(path.join(root, '..', 'engine', 'data', 'cache2007', 'server'));
  const ext = [];
  if (d07) d07.locs(placed, ext);
  for (const [id, list] of placed) for (const p of list) found.push({ nm: pack.get(id) || String(id), ...p });
  for (const e of ext) found.push({ nm: `2007:${e.name || e.id07}`, id: e.id07, x: e.x, z: e.z, level: e.level, angle: e.angle });
}
const out = found
  .filter((p) => p.nm.includes(name) && (!cx || Math.max(Math.abs(p.x - cx), Math.abs(p.z - cz)) <= (+cr || 15)))
  .map((p) => `${p.nm} (${p.id}) ${p.x},${p.z},${p.level}${kind === 'loc' ? ` angle ${p.angle}` : ''}`);
console.log(out.slice(0, 40).join('\n') || 'none');
