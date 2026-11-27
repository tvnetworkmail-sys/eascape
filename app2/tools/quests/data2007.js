'use strict';
// 2007RS: what the guide tools need from the 2007 world the server runs (its
// data/cache2007/server, made by tools/cache/server2007.py and ids2007.py at server start):
//   - the 2007 map's locs (maps.zip), with their 2007 loc ids turned into ours (locs.json), so a
//     guide's objects are checked where the 2007 map has them, not where our old maps did;
//   - the npc and obj ids the 2007 client knows ours by (ids.json), so the app's highlights and
//     item counts match what the client shows.
// Usage: require('./data2007')(dir) -> null when dir has no 2007 data, else
//   { locs(placed, ids), npc(id), obj(id) }
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/** The files of a zip: { name: Buffer } (stored or deflated entries, as maps.zip has). */
function unzip(file) {
  const buf = fs.readFileSync(file);
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error(`${file}: not a zip`);
  const count = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(at + 10);
    const size = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    out[name] = method === 8 ? zlib.inflateRawSync(data) : data;
    at += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** A map square's "link below" squares (level 1 flag 2): level*4096 + x*64 + z for every level whose locs drop one. */
function bridges(m) {
  const linked = new Set();
  let pos = 0;
  for (let level = 0; level < 4; level++) {
    for (let x = 0; x < 64; x++) {
      for (let z = 0; z < 64; z++) {
        for (;;) {
          const op = m[pos++];
          if (op === 0) break;
          if (op === 1) {
            pos++;
            break;
          }
          if (op <= 49) pos++;
          else if (op <= 81 && level === 1 && ((op - 49) & 2)) linked.add(x * 64 + z);
        }
      }
    }
  }
  return linked;
}

module.exports = function data2007(dir) {
  if (!dir || !fs.existsSync(path.join(dir, 'maps.zip')) || !fs.existsSync(path.join(dir, 'locs.json')) || !fs.existsSync(path.join(dir, 'ids.json'))) return null;
  const locs = JSON.parse(fs.readFileSync(path.join(dir, 'locs.json'), 'utf8'));
  const ids = JSON.parse(fs.readFileSync(path.join(dir, 'ids.json'), 'utf8'));
  // (-1: 2007 has nothing for it; the app then looks for ours, as before)
  const npc07 = new Map(ids.npc.filter(([, b]) => b >= 0));
  const obj07 = new Map(ids.obj.filter(([, b]) => b >= 0));
  const at07 = locs.at07 || {};
  const ours = (id07, level, x, z) => {
    const at = at07[`${level},${x},${z},${id07}`];
    if (at !== undefined) return at;
    const m = locs.map[id07];
    return m === null || m === undefined || m < 0 ? -1 : m; // negative: a 2007-only loc, none of ours
  };
  const extOf = (id07) => {
    const m = locs.map[id07];
    const e = m !== null && m !== undefined && m < 0 ? locs.ext[-1 - m] : null;
    return { name: (e && e.name) || null, size: e ? [e.w || 1, e.l || 1] : [1, 1], ops: (e && e.ops) || [] };
  };
  return {
    /**
     * Replaces the locs in `placed` (Map id -> [{id, x, z, level, angle}]) with the 2007 map's in
     * every map square the 2007 map has locs for, as the server loads them. Returns that count.
     * The 2007-only locs (none of ours) go in `ext` when it's given: [{id07, name, size, x, z, level, angle}].
     */
    locs(placed, ext = null) {
      const files = unzip(path.join(dir, 'maps.zip'));
      const squares = Object.keys(files).filter((n) => n[0] === 'l' && files[`m${n.slice(1)}`]).map((n) => n.slice(1));
      const covered = new Set(squares);
      for (const [id, list] of placed) placed.set(id, list.filter((p) => !covered.has(`${p.x >> 6}_${p.z >> 6}`)));
      for (const sq of squares) {
        const [mx, mz] = sq.split('_').map(Number);
        const linked = bridges(files[`m${sq}`]);
        const l = files[`l${sq}`];
        let pos = 0;
        const smart = () => (l[pos] < 128 ? l[pos++] : ((l[pos++] << 8) | l[pos++]) - 32768);
        let id07 = -1;
        for (let d = smart(); d !== 0; d = smart()) {
          id07 += d;
          let coord = 0;
          for (let c = smart(); c !== 0; c = smart()) {
            coord += c - 1;
            const info = l[pos++];
            const z = coord & 63;
            const x = (coord >> 6) & 63;
            const level = (coord >> 12) & 3;
            const lv = linked.has(x * 64 + z) ? level - 1 : level;
            if (lv < 0) continue;
            const wx = mx * 64 + x;
            const wz = mz * 64 + z;
            const id = ours(id07, level, wx, wz);
            if (id < 0) {
              if (ext) ext.push({ id07, ...extOf(id07), x: wx, z: wz, level: lv, angle: info & 3, shape: info >> 2 });
              continue;
            }
            if (!placed.has(id)) placed.set(id, []);
            placed.get(id).push({ id, x: wx, z: wz, level: lv, angle: info & 3, shape: info >> 2 });
          }
        }
      }
      return squares.length;
    },
    /** Each map square's ground: { "mx_mz": { floor: Uint8Array(4*64*64) (1: an underlay or overlay is
     * drawn there), flags: Uint8Array(4*64*64) (its settings: 1 blocked, 2 a bridge's link below) } }. */
    ground() {
      const files = unzip(path.join(dir, 'maps.zip'));
      const out = {};
      for (const name of Object.keys(files)) {
        if (name[0] !== 'm') continue;
        const m = files[name];
        const floor = new Uint8Array(4 * 64 * 64);
        const flags = new Uint8Array(4 * 64 * 64);
        let pos = 0;
        for (let level = 0; level < 4; level++) {
          for (let x = 0; x < 64; x++) {
            for (let z = 0; z < 64; z++) {
              const i = (level * 64 + x) * 64 + z;
              for (;;) {
                const op = m[pos++];
                if (op === 0) break;
                if (op === 1) {
                  pos++;
                  break;
                }
                if (op <= 49) {
                  pos++;
                  floor[i] = 1; // an overlay
                } else if (op <= 81) flags[i] = op - 49;
                else floor[i] = 1; // an underlay
              }
            }
          }
        }
        out[name.slice(1)] = { floor, flags };
      }
      return out;
    },
    npc: (id) => (npc07.has(id) ? npc07.get(id) : id),
    obj: (id) => (obj07.has(id) ? obj07.get(id) : id),
  };
};
