#!/usr/bin/env node
'use strict';
// Developer helper: where things are in Lost City's maps.
//   where.js <content> npc|loc|obj <name substring> [x z r]
const fs = require('fs');
const path = require('path');
const [root, kind, name, cx, cz, cr] = process.argv.slice(2);
const pack = new Map();
for (const l of fs.readFileSync(path.join(root, 'pack', `${kind}.pack`), 'utf8').split('\n')) {
  const m = /^(\d+)=(\S+)/.exec(l.trim());
  if (m) pack.set(+m[1], m[2]);
}
const section = { npc: 'NPC', loc: 'LOC', obj: 'OBJ' }[kind];
const out = [];
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
    const nm = pack.get(id) || String(id);
    if (!nm.includes(name)) continue;
    const wx = rx * 64 + x;
    const wz = rz * 64 + z;
    if (cx && Math.max(Math.abs(wx - cx), Math.abs(wz - cz)) > (+cr || 15)) continue;
    out.push(`${nm} (${id}) ${wx},${wz},${lv}${kind === 'loc' ? ` shape ${a} angle ${b || 0}` : ''}`);
  }
}
console.log(out.slice(0, 40).join('\n') || 'none');
