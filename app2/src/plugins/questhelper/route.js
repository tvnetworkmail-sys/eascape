'use strict';
// Walking routes for the Quest Helper: A* over the world's collision map (built offline by
// tools/routes/build.js from Lost City's maps, the way its server builds collision), with
// stairs, ladders and trapdoors as links between floors. Doors are open in the data, so a
// route goes through them. Step rules follow rsmod's StepValidator for a 1 x 1 walker.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Flag bits (see build.js): walls NW N NE E SE S SW W, scenery, blocked floor.
const LOC = 0x100;
const FLOOR = 0x200;
const BLOCKED = LOC | FLOOR;
// rsmod's BLOCK_* masks, reduced to the bits we keep: what the tile you step INTO must not have.
const B = {
  W: BLOCKED | 0x08, // moving west: no east wall on the destination
  E: BLOCKED | 0x80,
  S: BLOCKED | 0x02,
  N: BLOCKED | 0x20,
  SW: BLOCKED | 0x0e,
  SE: BLOCKED | 0x83,
  NW: BLOCKED | 0x38,
  NE: BLOCKED | 0xe0,
};
const MISSING = 0xffff;

/** 2007RS: a variable's value from the live values ({ id: value }), or undefined (requires.json's terms:
 * { id, lo, hi } bits). */
function varValue(vars, t) {
  if (!vars || vars[t.id] === undefined) return undefined;
  const raw = vars[t.id] | 0;
  const bits = t.hi - t.lo + 1;
  return bits >= 32 ? raw : (raw >>> t.lo) & ((1 << bits) - 1);
}
const OPS = { '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '=': (a, b) => a === b, '!=': (a, b) => a !== b, '<': (a, b) => a < b, '>': (a, b) => a > b };

/** 2007RS: one term of a requirement (requires.json): a quest variable ({ id, lo, hi, op, n }), a skill's
 * current level ({ stat, op, n }) or items carried and/or worn ({ objs: [client ids], where: 'inv' | 'worn' |
 * 'any', n }). What isn't known (no live values, no stats or items read yet) counts as met. */
function termMet(c, vars, have) {
  if (c.never) return false; // a door only opened from the other side (whatever the player has)
  if (c.not) {
    // (what isn't known still counts as met)
    if (c.not.objs && (!have || !have.inv)) return true;
    if (c.not.stat && (!have || !have.stats || have.stats[c.not.stat] === undefined)) return true;
    if (c.not.id !== undefined && (!vars || vars[c.not.id] === undefined)) return true;
    return !termMet(c.not, vars, have);
  }
  if (c.stat) {
    const v = have && have.stats ? have.stats[c.stat] : undefined;
    return v === undefined || OPS[c.op](v, c.n);
  }
  if (c.objs) {
    if (!have || !have.inv) return true;
    let n = 0;
    for (const id of c.objs) {
      if (c.where !== 'worn') n += have.inv[id] || 0;
      if (c.where !== 'inv' && have.worn && have.worn[id]) n++;
    }
    return n >= (c.n || 1);
  }
  const v = varValue(vars, c);
  return v === undefined || OPS[c.op](v, c.n);
}

/** Every requirement entry ({ req: [[term, ...] (and), ...] (or), side? }) is met. */
function reqsMet(reqs, vars, have, x, z, t) {
  for (const r of reqs) {
    if (r.side && t) {
      const on = { north: z >= t.z + (t.l || 1), south: z < t.z, east: x >= t.x + (t.w || 1), west: x < t.x }[r.side];
      if (!on) continue; // only used from that side
    }
    if (!r.req.some((and) => and.every((c) => termMet(c, vars, have)))) return false;
  }
  return true;
}

/** 2007RS: can the player use this link (its requirements, requires.json), going from (x, z)? */
function usable(t, vars, x, z, have = null) {
  if (!t.reqs || (!vars && !have)) return true;
  return reqsMet(t.reqs, vars, have, x, z, t);
}

/** 2007RS: puts each requirement (requires.json: by the link's name, and its `to` or `rel` if
 * given) on the transports it is for; the door entries (gates) go to `gates` (key -> [{ edge, from,
 * reqs }]). Returns how many transports (or door squares) each requirement matched. */
function applyRequires(transports, requires, gates = null) {
  const same = (a, b) => !a || (Array.isArray(b) && a.length === b.length && a.every((n, i) => n === b[i]));
  return (requires || []).map((r) => {
    const entry = { req: r.req, side: r.side };
    if (r.gates) {
      if (gates) {
        for (const [x, z, level, edge] of r.gates) {
          const k = key(x, z, level);
          if (!gates.has(k)) gates.set(k, []);
          gates.get(k).push({ edge, from: r.from, reqs: [entry] });
        }
      }
      return r.gates.length;
    }
    let n = 0;
    for (const t of transports) {
      if (t.name !== r.name || !same(r.to, t.to) || !same(r.rel, t.rel) || !same(r.at, [t.x, t.z, t.level])) continue;
      t.reqs = (t.reqs || []).concat([entry]);
      n++;
    }
    return n;
  });
}

const EDGE = { '-1,0': 'W', '1,0': 'E', '0,1': 'N', '0,-1': 'S' };

class World {
  constructor(collision, transports, gates = null) {
    this.gates = gates || new Map(); // 2007RS: doors a quest, level or item locks (requires.json)
    this.regions = new Map();
    const raw = zlib.inflateSync(collision);
    if (raw.toString('ascii', 0, 4) !== 'LLC1') throw new Error('bad collision data');
    const n = raw.readUInt16LE(4);
    let o = 6;
    const size = 4 * 64 * 64 * 2;
    for (let i = 0; i < n; i++) {
      const key = (raw[o] << 8) | raw[o + 1];
      o += 2;
      const copy = new Uint16Array(4 * 64 * 64);
      copy.set(new Uint16Array(raw.buffer.slice(raw.byteOffset + o, raw.byteOffset + o + size)));
      this.regions.set(key, copy);
      o += size;
    }
    // transports by the tiles you can use them from (the squares around the loc)
    this.links = new Map();
    for (const t of transports) {
      const w = t.w || 1;
      const l = t.l || 1;
      for (let x = t.x - 1; x <= t.x + w; x++) {
        for (let z = t.z - 1; z <= t.z + l; z++) {
          const inside = x >= t.x && x < t.x + w && z >= t.z && z < t.z + l;
          const edge = (x === t.x - 1 || x === t.x + w) && (z === t.z - 1 || z === t.z + l);
          if (edge) continue; // not from the corners
          const k = key(x, z, t.level);
          if (!this.links.has(k)) this.links.set(k, []);
          this.links.get(k).push({ t, inside });
        }
      }
    }
  }

  flags(x, z, level) {
    const g = this.regions.get(((x >> 6) << 8) | (z >> 6));
    return g ? g[(level * 64 + (x & 63)) * 64 + (z & 63)] : MISSING;
  }

  walkable(x, z, level) {
    const f = this.flags(x, z, level);
    return f !== MISSING && (f & BLOCKED) === 0;
  }

  canStep(x, z, level, dx, dz) {
    const f = (ax, az) => this.flags(ax, az, level);
    const ok = (v, m) => v !== MISSING && (v & m) === 0;
    if (dx === 0 && dz === -1) return ok(f(x, z - 1), B.S);
    if (dx === 0 && dz === 1) return ok(f(x, z + 1), B.N);
    if (dx === -1 && dz === 0) return ok(f(x - 1, z), B.W);
    if (dx === 1 && dz === 0) return ok(f(x + 1, z), B.E);
    if (dx === -1 && dz === -1) return ok(f(x - 1, z - 1), B.SW) && ok(f(x - 1, z), B.W) && ok(f(x, z - 1), B.S);
    if (dx === -1 && dz === 1) return ok(f(x - 1, z + 1), B.NW) && ok(f(x - 1, z), B.W) && ok(f(x, z + 1), B.N);
    if (dx === 1 && dz === -1) return ok(f(x + 1, z - 1), B.SE) && ok(f(x + 1, z), B.E) && ok(f(x, z - 1), B.S);
    if (dx === 1 && dz === 1) return ok(f(x + 1, z + 1), B.NE) && ok(f(x + 1, z), B.E) && ok(f(x, z + 1), B.N);
    return false;
  }

  /** The nearest walkable square to (x, z) on the level, within r squares. */
  nearestWalkable(x, z, level, r = 3) {
    if (this.walkable(x, z, level)) return { x, z, level };
    for (let d = 1; d <= r; d++) {
      for (let i = -d; i <= d; i++) {
        for (const [ax, az] of [[x + i, z - d], [x + i, z + d], [x - d, z + i], [x + d, z + i]]) {
          if (this.walkable(ax, az, level)) return { x: ax, z: az, level };
        }
      }
    }
    return null;
  }

  /** Distance of the nearest square around `to` that opens out to the wider world. */
  openRing(to, max) {
    for (let d = 1; d <= max; d++) {
      for (let i = -d; i <= d; i++) {
        for (const [x, z] of [[to.x + i, to.z - d], [to.x + i, to.z + d], [to.x - d, to.z + i], [to.x + d, to.z + i]]) {
          if (this.walkable(x, z, to.level) && this.escapes(x, z, to, max + 2)) return d;
        }
      }
    }
    return 1;
  }

  /** True if walking from (x, z) can get further than r squares from `c`. */
  escapes(x, z, c, r) {
    const seen = new Set([x * 16384 + z]);
    const q = [[x, z]];
    for (let i = 0; i < q.length && i < 600; i++) {
      const [ax, az] = q[i];
      if (Math.max(Math.abs(ax - c.x), Math.abs(az - c.z)) > r) return true;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = (ax + dx) * 16384 + az + dz;
        if (!seen.has(k) && this.canStep(ax, az, c.level, dx, dz)) {
          seen.add(k);
          q.push([ax + dx, az + dz]);
        }
      }
    }
    return false;
  }

  /**
   * Route from `from` to `to` ({x, z, level}). `near` (squares) ends the route as soon as
   * it's that close on the right floor (an NPC or object: you stand next to it). Returns
   * [{x, z, level, via?}] or null. via marks the square where you take stairs/a ladder.
   * `allow` lists what the player has that some ways across need (a transport's "needs", such
   * as "fairyrings"); the others are left out. A transport costs 3 squares of walking, or its
   * `cost` (a slow one, such as the Chasm of Tears' light creatures, so a route never takes it
   * as a short cut). 2007RS: `vars` ({ id: value }, the quest variables live from the server) leaves
   * out the links whose quest requirement (requires.json) isn't met, and `have` ({ stats: { skill:
   * level }, inv: { client obj id: count }, worn: { id: true } }) those that need a level or an item; with
   * either, the doors such a requirement locks (gates) aren't walked through.
   */
  find(from, to, { near = 0, maxNodes = 400000, weight = 1, allow = [], vars = null, have = null } = {}) {
    const gated = this.gates.size > 0;
    // (3: from a big loc's corner, such as the Lumbridge Swamp Caves' 3 x 3 tunnel to the Chasm of Tears)
    const start = this.nearestWalkable(from.x, from.z, from.level, 3);
    if (!start) return null;
    const goalLevel = to.level;
    // A blocked goal (a fountain, a counter): end at the closest ring of squares around it
    // that isn't boxed in (the middle of a fountain can be "walkable" but you can't get there).
    // 2007RS: so is a goal boxed in on a few squares (an NPC behind a counter, a wall or a witness box)
    if (!this.walkable(to.x, to.z, to.level) || !this.escapes(to.x, to.z, to, 8)) near = Math.max(near, this.openRing(to, 6));
    const done = (x, z, level) => level === goalLevel && Math.max(Math.abs(x - to.x), Math.abs(z - to.z)) <= near;
    // Dungeons are 6400 squares north of the land above them; measure to the surface spot.
    const UNDER = 6400;
    const goalUnder = to.z >= UNDER;
    const h = (x, z, level) => {
      let gz = to.z;
      if (z >= UNDER !== goalUnder) gz = goalUnder ? to.z - UNDER : to.z + UNDER;
      return Math.max(Math.abs(x - to.x), Math.abs(z - gz)) + (level !== goalLevel ? 4 * Math.abs(level - goalLevel) : 0);
    };
    const heap = new Heap();
    const g = new Map();
    const prev = new Map();
    const sk = key(start.x, start.z, start.level);
    g.set(sk, 0);
    heap.push(h(start.x, start.z, start.level), sk);
    let expanded = 0;
    while (heap.size) {
      const k = heap.pop();
      const [x, z, level] = unkey(k);
      if (done(x, z, level)) return this.trace(prev, k);
      if (++expanded > maxNodes) return null;
      const gk = g.get(k);
      const visit = (nx, nz, nl, cost, via) => {
        const nk = key(nx, nz, nl);
        const ng = gk + cost;
        if (g.has(nk) && g.get(nk) <= ng) return;
        g.set(nk, ng);
        prev.set(nk, { k, via });
        heap.push(ng + weight * h(nx, nz, nl), nk);
      };
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if ((dx || dz) && this.canStep(x, z, level, dx, dz) && !(gated && this.gateBlocks(x, z, level, dx, dz, vars, have))) visit(x + dx, z + dz, level, 1, null);
        }
      }
      for (const { t, inside } of this.links.get(k) || []) {
        if (inside) continue;
        if (t.needs && !allow.includes(t.needs)) continue;
        if (t.reqs && !usable(t, vars, x, z, have)) continue;
        let dest;
        if (t.rel) {
          dest = this.nearestWalkable(x + t.rel[0], z + t.rel[2], level + t.rel[1], 2);
        } else {
          dest = this.nearestWalkable(t.to[0], t.to[1], t.to[2], 2);
        }
        if (dest && dest.level >= 0 && dest.level <= 3) visit(dest.x, dest.z, dest.level, t.cost || 3, t.name);
      }
    }
    return null;
  }

  /** 2007RS: does the step from (x, z) by (dx, dz) cross a door edge whose requirement isn't met?
   * A door's square has the door on one edge; `from` 'on' locks only leaving the door's square
   * through it, 'off' only coming onto it (the scripts' check_axis), neither both ways. */
  gateBlocks(x, z, level, dx, dz, vars, have) {
    if (!this.gateNear) {
      // (the door squares and their neighbours: most steps are nowhere near one)
      this.gateNear = new Set();
      for (const k of this.gates.keys()) {
        const [gx, gz, gl] = unkey(k);
        for (const [ax, az] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) this.gateNear.add(key(gx + ax, gz + az, gl));
      }
    }
    if (!this.gateNear.has(key(x, z, level))) return false;
    const pairs = [];
    if (dx && dz) {
      pairs.push([x, z, x + dx, z], [x, z + dz, x + dx, z + dz], [x, z, x, z + dz], [x + dx, z, x + dx, z + dz]);
    } else pairs.push([x, z, x + dx, z + dz]);
    for (const [ax, az, bx, bz] of pairs) {
      const out = EDGE[`${bx - ax},${bz - az}`];
      const back = EDGE[`${ax - bx},${az - bz}`];
      for (const g of this.gates.get(key(ax, az, level)) || []) {
        if (g.edge === out && g.from !== 'off' && !reqsMet(g.reqs, vars, have, ax, az, null)) return true;
      }
      for (const g of this.gates.get(key(bx, bz, level)) || []) {
        if (g.edge === back && g.from !== 'on' && !reqsMet(g.reqs, vars, have, ax, az, null)) return true;
      }
    }
    return false;
  }

  trace(prev, k) {
    const out = [];
    let cur = k;
    let via = null;
    while (cur !== undefined) {
      const [x, z, level] = unkey(cur);
      const step = { x, z, level };
      if (via) step.via = via;
      out.push(step);
      const p = prev.get(cur);
      if (!p) break;
      via = p.via;
      cur = p.k;
    }
    return out.reverse();
  }
}

// Coordinates up to 16383 fit: level (2 bits), x (14), z (14).
const key = (x, z, level) => level * 268435456 + x * 16384 + z;
const unkey = (k) => [Math.floor(k / 16384) % 16384, k % 16384, Math.floor(k / 268435456)];

class Heap {
  constructor() {
    this.p = [];
    this.v = [];
  }
  get size() {
    return this.v.length;
  }
  push(pri, val) {
    const p = this.p;
    const v = this.v;
    let i = v.length;
    p.push(pri);
    v.push(val);
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (p[j] <= pri) break;
      p[i] = p[j];
      v[i] = v[j];
      i = j;
    }
    p[i] = pri;
    v[i] = val;
  }
  pop() {
    const p = this.p;
    const v = this.v;
    const top = v[0];
    const lp = p.pop();
    const lv = v.pop();
    if (v.length) {
      let i = 0;
      const n = v.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && p[c + 1] < p[c]) c++;
        if (p[c] >= lp) break;
        p[i] = p[c];
        v[i] = v[c];
        i = c;
      }
      p[i] = lp;
      v[i] = lv;
    }
    return top;
  }
}

/**
 * A smoother version of a route for drawing: drops the zigzag squares wherever a straight
 * walk between two points is clear (string pulling), keeping floor changes.
 */
function smooth(world, route, maxLen = 24) {
  if (!route || route.length < 3) return route || [];
  const out = [route[0]];
  let i = 0;
  while (i < route.length - 1) {
    let j = i + 1;
    for (let k = Math.min(route.length - 1, i + maxLen); k > i + 1; k--) {
      if (straight(world, route, i, k)) {
        j = k;
        break;
      }
    }
    out.push(route[j]);
    i = j;
  }
  return out;
}

/** Can you walk a straight line from route[i] to route[k] (same floor, no stairs between)? */
function straight(world, route, i, k) {
  const a = route[i];
  const b = route[k];
  if (a.level !== b.level) return false;
  for (let m = i; m < k; m++) if (route[m].via || route[m].level !== a.level) return false;
  const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.z - a.z));
  let x = a.x;
  let z = a.z;
  for (let s = 1; s <= n; s++) {
    const nx = Math.round(a.x + ((b.x - a.x) * s) / n);
    const nz = Math.round(a.z + ((b.z - a.z) * s) / n);
    if (!world.canStep(x, z, a.level, nx - x, nz - z)) return false;
    x = nx;
    z = nz;
  }
  return true;
}

/** Corner points of a route (where it turns or changes floor), for drawing lines. */
function corners(route) {
  if (!route || route.length < 3) return route || [];
  const out = [route[0]];
  for (let i = 1; i < route.length - 1; i++) {
    const a = route[i - 1];
    const b = route[i];
    const c = route[i + 1];
    if (b.level !== a.level || c.level !== b.level || b.via || c.via) {
      out.push(b);
      continue;
    }
    const d1 = [b.x - a.x, b.z - a.z];
    const d2 = [c.x - b.x, c.z - b.z];
    if (d1[0] !== d2[0] || d1[1] !== d2[1]) out.push(b);
  }
  out.push(route[route.length - 1]);
  return out;
}

let shared = null;
function load(dir = __dirname) {
  if (!shared) {
    const transports = JSON.parse(fs.readFileSync(path.join(dir, 'transports.json'), 'utf8'));
    const req = path.join(dir, 'requires.json');
    const gates = new Map();
    if (fs.existsSync(req)) applyRequires(transports, JSON.parse(fs.readFileSync(req, 'utf8')), gates);
    shared = new World(fs.readFileSync(path.join(dir, 'collision.bin')), transports, gates);
  }
  return shared;
}

module.exports = { World, load, corners, smooth, applyRequires, usable, termMet };
