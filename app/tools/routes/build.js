#!/usr/bin/env node
'use strict';
// Builds the walking data for the Quest Helper's route lines from Lost City's 274 content:
//
//   collision.bin   which way you can walk out of every tile (walls, blocked squares and
//                   scenery), built the way Lost City's server builds its collision map
//                   (GameMap.loadGround / loadLocations / changeLocCollision and rsmod's
//                   CollisionEngine, MIT licence, Copyright (c) 2023-2026 Lost City).
//                   Doors and gates are left open: the route goes through them.
//   transports.json stairs, ladders and trapdoors: where using them takes you, read from the
//                   server scripts that move you (p_telejump / ~climb_ladder).
//
// Usage: build.js <Content checkout (274)> <out dir>
//
// collision.bin: deflated; "LLC1", region count (u16), then per region rx (u8) rz (u8) and
// 4 x 64 x 64 u16 flags (level, x, z order). Flags: bits 0-7 walls as rsmod (NW, N, NE, E,
// SE, S, SW, W), 0x100 scenery, 0x200 blocked floor. Missing regions are blocked.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const [root, outDir] = process.argv.slice(2);
if (!root || !outDir) {
  console.error('usage: build.js <content> <out dir>');
  process.exit(1);
}

const WALL = { NW: 0x1, N: 0x2, NE: 0x4, E: 0x8, SE: 0x10, S: 0x20, SW: 0x40, W: 0x80 };
const LOC = 0x100;
const FLOOR = 0x200;

// ---------------------------------------------------------------- configs

function readPack(file) {
  const ids = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^(\d+)=(\S+)/.exec(line.trim());
    if (m) ids.set(m[2], +m[1]);
  }
  return ids;
}

function walk(dir, ext, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '_test') walk(p, ext, out);
    } else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

const locIds = readPack(path.join(root, 'pack', 'loc.pack'));
const locs = new Map(); // id -> config
const byCategory = new Map();
for (const file of walk(path.join(root, 'scripts'), '.loc')) {
  let cur = null;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const s = raw.trim();
    const h = /^\[(\w+)\]$/.exec(s);
    if (h) {
      cur = { name: h[1], ops: [] };
      const id = locIds.get(h[1]);
      if (id !== undefined) locs.set(id, cur);
      continue;
    }
    if (!cur || !s.includes('=') || s.startsWith('//')) continue;
    const k = s.slice(0, s.indexOf('='));
    const v = s.slice(s.indexOf('=') + 1);
    if (/^op[1-5]$/.test(k)) cur.ops.push(v.toLowerCase());
    else if (k === 'category') {
      cur.category = v;
      if (!byCategory.has(v)) byCategory.set(v, []);
      byCategory.get(v).push(cur.name);
    } else if (!(k in cur)) cur[k] = v;
  }
}

const yes = (v, dflt) => (v === undefined ? dflt : v === 'yes' || v === 'true');

function locType(id) {
  const c = locs.get(id) || { ops: [] };
  return {
    name: c.name,
    width: +(c.width || 1),
    length: +(c.length || 1),
    blockwalk: yes(c.blockwalk, true),
    active: c.active !== undefined ? yes(c.active, false) : c.ops.length > 0,
    // Doors and gates: the route walks through them (you open them on the way).
    // EASCape: also the climbing rocks you climb across (Death Plateau, Trollheim, the Ice Path
    // ledges) - the route climbs over them.
    door: c.ops.some((o) => o === 'open' || o === 'walk-through' || o === 'pass-through' || o === 'squeeze-through' || o === 'go-through')
      || (/climbingrocks|climbing_rocks|climbrock/.test(c.name || '') && c.ops.some((o) => o === 'climb')),
  };
}

// ---------------------------------------------------------------- maps

const regions = new Map(); // (rx << 8 | rz) -> Uint16Array(4 * 64 * 64)
const instances = new Map(); // loc name -> [{x, z, level, angle, shape, w, l}]
const at = (lv, x, z) => (lv * 64 + x) * 64 + z;

function grid(x, z) {
  return regions.get(((x >> 6) << 8) | (z >> 6));
}
function add(x, z, lv, mask) {
  const g = grid(x, z);
  if (g) g[at(lv, x & 63, z & 63)] |= mask;
}

const mapFiles = fs.readdirSync(path.join(root, 'maps')).filter((f) => /^m\d+_\d+\.jm2$/.test(f));
const parsed = [];
for (const f of mapFiles) {
  const [, rx, rz] = /^m(\d+)_(\d+)/.exec(f).map(Number);
  regions.set((rx << 8) | rz, new Uint16Array(4 * 64 * 64));
  parsed.push({ f, rx, rz });
}

let locCount = 0;
for (const { f, rx, rz } of parsed) {
  const text = fs.readFileSync(path.join(root, 'maps', f), 'utf8').split('\n');
  const flags = new Uint8Array(4 * 64 * 64);
  const floor = new Uint8Array(4 * 64 * 64); // the square has ground drawn (underlay or overlay)
  const locLines = [];
  let section = '';
  for (const line of text) {
    if (line.startsWith('====')) {
      section = line.replace(/=/g, '').trim();
      continue;
    }
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const [lv, x, z] = line.slice(0, colon).trim().split(/\s+/).map(Number);
    if (section === 'MAP') {
      const rest = line.slice(colon + 1);
      const m = /\bf(\d+)/.exec(rest);
      if (m) flags[at(lv, x, z)] = +m[1];
      if (/\b[uo]\d/.test(rest)) floor[at(lv, x, z)] = 1;
    } else if (section === 'LOC') {
      const [id, shape, angle] = line.slice(colon + 1).trim().split(/\s+/).map(Number);
      locLines.push({ lv, x, z, id, shape, angle: angle || 0 });
    }
  }
  const bx = rx << 6;
  const bz = rz << 6;
  const bridged = (x, z, lv) => ((lv === 1 ? flags[at(1, x, z)] : flags[at(1, x, z)]) & 0x2) === 0x2;
  // Upper floors: only where there is a floor (the rest is open air above the ground).
  for (let real = 1; real < 4; real++) {
    for (let x = 0; x < 64; x++) {
      for (let z = 0; z < 64; z++) {
        const src = bridged(x, z, real + 1) && real + 1 < 4 ? real + 1 : real;
        if (!floor[at(src, x, z)]) add(bx + x, bz + z, real, FLOOR);
      }
    }
  }
  // blocked squares
  for (let lv = 0; lv < 4; lv++) {
    for (let x = 0; x < 64; x++) {
      for (let z = 0; z < 64; z++) {
        if ((flags[at(lv, x, z)] & 0x1) !== 0x1) continue;
        const real = bridged(x, z, lv) ? lv - 1 : lv;
        if (real >= 0) add(bx + x, bz + z, real, FLOOR);
      }
    }
  }
  // scenery
  for (const l of locLines) {
    const real = bridged(l.x, l.z, l.lv) ? l.lv - 1 : l.lv;
    if (real < 0) continue;
    const t = locType(l.id);
    const x = bx + l.x;
    const z = bz + l.z;
    locCount++;
    if (t.name) {
      if (!instances.has(t.name)) instances.set(t.name, []);
      const rot = l.angle === 1 || l.angle === 3;
      instances.get(t.name).push({ x, z, level: real, angle: l.angle, shape: l.shape, w: rot ? t.length : t.width, l: rot ? t.width : t.length });
    }
    if (!t.blockwalk || t.door) continue;
    collide(l.shape, l.angle, t, x, z, real);
  }
}

function collide(shape, angle, t, x, z, lv) {
  if (shape >= 0 && shape <= 3) {
    wall(shape, angle, x, z, lv);
  } else if (shape === 9 || (shape >= 10 && shape <= 21)) {
    // ground layer (centrepieces, diagonal walls, roofs)
    const rot = angle === 1 || angle === 3;
    const w = rot ? t.length : t.width;
    const l = rot ? t.width : t.length;
    for (let i = 0; i < w; i++) for (let j = 0; j < l; j++) add(x + i, z + j, lv, LOC);
  } else if (shape === 22) {
    if (t.active) add(x, z, lv, FLOOR);
  }
}

function wall(shape, angle, x, z, lv) {
  const pair = (m1, x2, z2, m2) => {
    add(x, z, lv, m1);
    add(x2, z2, lv, m2);
  };
  if (shape === 0) {
    if (angle === 0) pair(WALL.W, x - 1, z, WALL.E);
    else if (angle === 1) pair(WALL.N, x, z + 1, WALL.S);
    else if (angle === 2) pair(WALL.E, x + 1, z, WALL.W);
    else pair(WALL.S, x, z - 1, WALL.N);
  } else if (shape === 1 || shape === 3) {
    if (angle === 0) pair(WALL.NW, x - 1, z + 1, WALL.SE);
    else if (angle === 1) pair(WALL.NE, x + 1, z + 1, WALL.SW);
    else if (angle === 2) pair(WALL.SE, x + 1, z - 1, WALL.NW);
    else pair(WALL.SW, x - 1, z - 1, WALL.NE);
  } else if (shape === 2) {
    if (angle === 0) {
      add(x, z, lv, WALL.N | WALL.W);
      add(x - 1, z, lv, WALL.E);
      add(x, z + 1, lv, WALL.S);
    } else if (angle === 1) {
      add(x, z, lv, WALL.N | WALL.E);
      add(x, z + 1, lv, WALL.S);
      add(x + 1, z, lv, WALL.W);
    } else if (angle === 2) {
      add(x, z, lv, WALL.S | WALL.E);
      add(x + 1, z, lv, WALL.W);
      add(x, z - 1, lv, WALL.N);
    } else {
      add(x, z, lv, WALL.S | WALL.W);
      add(x, z - 1, lv, WALL.N);
      add(x - 1, z, lv, WALL.E);
    }
  }
}

// ---------------------------------------------------------------- transports

function coord(s) {
  const m = /^(\d)_(\d+)_(\d+)_(\d+)_(\d+)$/.exec(s);
  return m ? { level: +m[1], x: +m[2] * 64 + +m[4], z: +m[3] * 64 + +m[5] } : null;
}

const MOVE = /movecoord\(\s*(loc_coord|coord)(?:\(\))?\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/;
const DEST = /(p_telejump|p_teleport|~climb_ladder|~climb_stairs|@ladder_options|@jump_basalt)\(\s*([^;]*)/;
const transports = []; // {from: {x, z, level, w, l}, to: {x, z, level} | rel: {dx, dy, dz}, name, op}
const seenLink = new Set();
let unresolved = 0;

// Only ways up, down, in and out (not agility shortcuts, quest traps or wrong maze exits).
const KEEP = /jumping_spot|ladder|stair|trapdoor|manhole|hatch|steps|cellar|rope|tunnel|cave_entrance|caveentrance|cave_exit|caveexit|passage|dungeon|_entrance|_exit/;
const SKIP = /wrong|trap_|fail|_dead|mazeportal/;

function link(inst, dest, name, op) {
  if (!KEEP.test(name) || SKIP.test(name)) return;
  const to = dest.rel ? { rel: dest.rel } : { to: [dest.x, dest.z, dest.level] };
  const key = `${inst.x},${inst.z},${inst.level}>${JSON.stringify(to)}`;
  if (seenLink.has(key)) return;
  seenLink.add(key);
  transports.push({ x: inst.x, z: inst.z, level: inst.level, w: inst.w, l: inst.l, ...to, name, op });
}

function destinations(text, inst) {
  // every coord or relative move named in the destination call
  const out = [];
  const m = DEST.exec(text);
  if (!m) return out;
  const args = m[2];
  const coords = (args.match(/\b\d_\d+_\d+_\d+_\d+\b/g) || []).map(coord);
  // the basalt rocks: (start, landing, final square): you end up on the last
  if (m[1] === '@jump_basalt') return coords.slice(-1).filter(Boolean);
  out.push(...coords);
  let rest = args;
  let mm;
  while ((mm = MOVE.exec(rest))) {
    const [dx, dy, dz] = [+mm[2], +mm[3], +mm[4]];
    if (mm[1] === 'loc_coord') out.push({ x: inst.x + dx, z: inst.z + dz, level: inst.level + dy }); // from the loc's own square
    else out.push({ rel: [dx, dy, dz], level: inst.level + dy }); // from where the player stands
    rest = rest.slice(mm.index + mm[0].length);
  }
  return out.filter(Boolean);
}

// EASCape: a closed trapdoor or door is only on the map in its closed form; its script turns it
// into the open one (loc_change), and that one's script is the way down. So the open form is
// also found where the closed one stands.
{
  const OPEN = /^\[oploc\d,(\w+)\]/;
  for (const file of walk(path.join(root, 'scripts'), '.rs2')) {
    let cur = null;
    for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
      const s = raw.trim();
      const m = OPEN.exec(s);
      if (m) { cur = m[1]; continue; }
      if (s.startsWith('[')) { cur = null; continue; }
      const c = cur && /loc_change\(\s*(\w+)\s*,/.exec(s);
      if (!c || c[1] === cur || !instances.has(cur)) continue;
      if (!instances.has(c[1])) instances.set(c[1], []);
      const list = instances.get(c[1]);
      for (const inst of instances.get(cur)) {
        if (!list.some((o) => o.x === inst.x && o.z === inst.z && o.level === inst.level)) list.push(inst);
      }
    }
  }
}

const TRIG = /^\[oploc(\d),(\w+)\]/;
for (const file of walk(path.join(root, 'scripts'), '.rs2')) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let trig = null;
  let caseCoord = null;
  for (const raw of lines) {
    const s = raw.trim();
    const t = TRIG.exec(s);
    if (t) {
      trig = { op: +t[1], name: t[2] };
      caseCoord = null;
      if (!DEST.test(s)) continue; // the call can be on the trigger line itself
    }
    if (s.startsWith('[') && !t) {
      trig = null;
      continue;
    }
    if (!trig) continue;
    const names = trig.name.startsWith('_') ? byCategory.get(trig.name.slice(1)) || [] : [trig.name];
    const cm = /^case\s+(\d_\d+_\d+_\d+_\d+)\s*:/.exec(s);
    if (cm) caseCoord = coord(cm[1]);
    else if (/^case\s+default/.test(s)) caseCoord = 'default';
    if (!DEST.test(s)) continue;
    for (const nm of names) {
      for (const inst of instances.get(nm) || []) {
        if (caseCoord && caseCoord !== 'default') {
          if (inst.x !== caseCoord.x || inst.z !== caseCoord.z || inst.level !== caseCoord.level) continue;
        }
        for (const d of destinations(s, inst)) {
          if (d.level < 0 || d.level > 3) continue;
          link(inst, d, nm, trig.op);
        }
      }
    }
    if (!(instances.get(names[0]) || []).length) unresolved++;
  }
}

// EASCape: the links table (eascape_world/configs/eascape_links.dbrow) says where the ladders,
// stairs, trapdoors and cave entrances go that the scripts send to ~eascape_link (most of the
// 377 ones). Each row is a loc square and option: kind 0/2/3 go to "to", kind 1 moves by dx/dz/dl.
{
  const file = path.join(root, 'scripts', 'eascape_world', 'configs', 'eascape_links.dbrow');
  if (fs.existsSync(file)) {
    const at = new Map();
    for (const [nm, list] of instances) for (const inst of list) at.set(`${inst.x},${inst.z},${inst.level}`, { inst, nm });
    let row = null;
    const flush = () => {
      if (!row || !row.from) return;
      const found = at.get(`${row.from.x},${row.from.z},${row.from.level}`);
      const inst = found ? found.inst : { x: row.from.x, z: row.from.z, level: row.from.level, w: 1, l: 1 };
      const d = row.kind === 1 ? { x: row.from.x + row.dx, z: row.from.z + row.dz, level: row.from.level + row.dl } : row.to;
      if (!d || d.level < 0 || d.level > 3) return;
      const key = `${inst.x},${inst.z},${inst.level}>${JSON.stringify({ to: [d.x, d.z, d.level] })}`;
      if (seenLink.has(key)) return;
      seenLink.add(key);
      transports.push({ x: inst.x, z: inst.z, level: inst.level, w: inst.w, l: inst.l, to: [d.x, d.z, d.level], name: found ? found.nm : 'link', op: row.op });
    };
    for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
      const s = raw.trim();
      if (s.startsWith('[')) { flush(); row = { op: 1, kind: 0, dx: 0, dz: 0, dl: 0 }; continue; }
      const m = /^data=(\w+),(.*)$/.exec(s);
      if (!m || !row) continue;
      if (m[1] === 'from') row.from = coord(m[2]);
      else if (m[1] === 'to') row.to = coord(m[2]);
      else if (['op', 'kind', 'dx', 'dz', 'dl'].includes(m[1])) row[m[1]] = +m[2];
    }
    flush();
  }
}

// Ways across that the scripts work out at run time (tools/routes/extra.json).
for (const t of JSON.parse(fs.readFileSync(path.join(__dirname, 'extra.json'), 'utf8'))) transports.push(t);

// ---------------------------------------------------------------- write

fs.mkdirSync(outDir, { recursive: true });
const keys = [...regions.keys()].sort((a, b) => a - b);
const head = Buffer.alloc(6);
head.write('LLC1', 0, 'ascii');
head.writeUInt16LE(keys.length, 4);
const parts = [head];
for (const k of keys) {
  const h = Buffer.alloc(2);
  h[0] = k >> 8;
  h[1] = k & 255;
  parts.push(h, Buffer.from(regions.get(k).buffer));
}
const raw = Buffer.concat(parts);
const packed = zlib.deflateSync(raw, { level: 9 });
fs.writeFileSync(path.join(outDir, 'collision.bin'), packed);
fs.writeFileSync(path.join(outDir, 'transports.json'), JSON.stringify(transports));
console.log(`${keys.length} regions, ${locCount} locs, collision ${(packed.length / 1024).toFixed(0)} KB (raw ${(raw.length / 1048576).toFixed(1)} MB), ${transports.length} transports, ${unresolved} unresolved lines`);
