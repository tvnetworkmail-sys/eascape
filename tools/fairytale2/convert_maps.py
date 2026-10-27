# Fairytale II, step 2a: the five places fairy rings lead to that our 2006 map doesn't have, from
# the August 2007 cache (build 468, OpenRS2 633), as new map squares; and every fairy ring the
# 2007 map has on squares we do have, put in the way 2007 has them.
#
#   36_69  the Fairy Resistance hideout (its ring: 2328,4426)
#   32_75  the cosmic entity's plane (CKP, 2075,4848 level 1)
#   47_83  Gorak's plane (DIR, 3038,5348)
#   47_70  the Enchanted Valley (BKQ, 3041,4532)
#   47_76  the Abyssal area (ALR, 3059,4875)
#
# What comes over and how (the Warriors' Guild merge's method, tools/warriors_guild/convert.py):
#   - locs: an id below our 377 count that decodes the same in both caches (name and models) is
#     the same thing and keeps its id; anything else (new in 2007, or changed: all the fairy rings,
#     which 377 only has as placeholders) gets a new id after ours, ft2_<name>_<468 id>, with its
#     models, recolours and animation converted. Their sounds (468 opcodes 78/79) and 'blocks walk
#     only' (27) have no 377 equivalent and are left out.
#   - floors: 377 has one floor list where 468 splits underlays and overlays; the ids line up
#     (both 1-based in the map), except where 2007 has a floor 377 doesn't: those get new floors.
#   - the rings on squares we have: every loc of the 2007 ring's 3x3 (the ring and its eight
#     trampled-grass parts) replaces whatever our 2006 square has there (the 2006 placeholder ring
#     and its sparkle, grass and flowers), and the 2007 map icon is added; a tree the 2007 map moved
#     out of the ring's way is moved too. Nothing else on those squares changes.
#   - NPCs: Void's spawns (its ids are 468's for these), less what came after August 2007.
#
# Usage: convert_maps.py <cache468 flat dir> <keys.json> <void data dir>   (run once; README.md)
import sys, os, glob, re
W = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, W); sys.path.insert(0, W + '/../warriors_guild')
from port468 import Porter, E, ORIG, slug, recol_lines, REV  # noqa: E402
from maps468 import Maps468  # noqa: E402
from maps import read_jm2  # noqa: E402
import locdef  # noqa: E402
from locdef import decode_loc  # noqa: E402
from jag import read_jag, jag_file  # noqa: E402

CACHE, KEYS, VOID = sys.argv[1], sys.argv[2], sys.argv[3]
m = Maps468(CACHE, KEYS)
pt = Porter(CACHE, f'{E}/content/models/fairytale2')
L468 = m.c.files(2, 6)
U468 = m.c.files(2, 1); O468 = m.c.files(2, 4)

SQUARES = {(36, 69): 'the Fairy Resistance hideout', (32, 75): "the cosmic entity's plane",
           (47, 83): "Gorak's plane", (47, 70): 'the Enchanted Valley', (47, 76): 'the Abyssal area'}
# 2007 rings on squares we don't have and won't add here: Lunar Isle (17012, after our cache) and
# the cave south of Dorgesh-Kaan (23047)
RING_SKIP = {17012, 23047}

# ---------------------------------------------------------------- our 377 configs, as built
cfg = read_jag(f'{E}/engine/data/pack/client/config')

def decode_loc377(d):
    old = locdef.gstr
    def g(d, p):
        e = d.index(10, p); return d[p:e].decode('latin-1'), e + 1
    locdef.gstr = g
    try:
        return decode_loc(d)
    finally:
        locdef.gstr = old

dat = jag_file(cfg, 'loc.dat'); idx = jag_file(cfg, 'loc.idx')
OURLOC = {}
n = int.from_bytes(idx[:2], 'big'); p = 2; off = 2
for i in range(n):
    sz = int.from_bytes(idx[p:p + 2], 'big'); p += 2
    OURLOC[i] = decode_loc377(dat[off:off + sz]); off += sz

def ourflo():
    d = jag_file(cfg, 'flo.dat'); n = int.from_bytes(d[:2], 'big'); p = 2; out = []
    for _ in range(n):
        o = {}
        while True:
            op = d[p]; p += 1
            if op == 0: break
            if op == 1: o['rgb'] = d[p:p + 3].hex(); p += 3
            elif op == 7: o['map'] = d[p:p + 3].hex(); p += 3
            elif op == 2: o['tex'] = d[p]; p += 1
            elif op == 3: o['ovl'] = True
            elif op == 5: o['occ'] = False
            elif op == 6: e = d.index(10, p); p = e + 1
        out.append(o)
    return out
OURFLO = ourflo()

def flo468(b):
    o = {}; p = 0
    while p < len(b):
        op = b[p]; p += 1
        if op == 0: break
        if op == 1: o['rgb'] = b[p:p + 3].hex(); p += 3
        elif op == 2: o['tex'] = b[p]; p += 1
        elif op == 5: o['occ'] = False
        elif op == 7: o['map'] = b[p:p + 3].hex(); p += 3
        else: raise SystemExit(f'floor opcode {op}')
    return o

# ---------------------------------------------------------------- floors
flo_out = []
flo_map = {'u': {}, 'o': {}}   # 468 map value -> our map value
TEXNAME = __import__('port468').readpack('texture')

def floor(kind, v):
    if v in flo_map[kind]:
        return flo_map[kind][v]
    src = (U468 if kind == 'u' else O468)[v - 1]
    a = flo468(src)
    ours = OURFLO[v - 1] if v - 1 < len(OURFLO) else None
    if ours is not None:
        b = {k: x for k, x in ours.items() if k in ('rgb', 'tex', 'occ', 'map')}
        if a == b and bool(ours.get('ovl')) == (kind == 'o'):
            flo_map[kind][v] = v
            return v
    name = f"ft2_{'underlay' if kind == 'u' else 'overlay'}_{v - 1}"
    fid = pt.newid('flo', name)
    lines = [f'[{name}]']
    if kind == 'o': lines.append('overlay=yes')
    if 'rgb' in a: lines.append(f"colour=0x{a['rgb']}")
    if 'tex' in a: lines.append(f"texture={TEXNAME[a['tex']]}")
    if a.get('occ') is False: lines.append('occlude=no')
    if 'map' in a: lines.append(f"mapcolour=0x{a['map']}")
    flo_out.append('\n'.join(lines))
    flo_map[kind][v] = fid + 1
    return fid + 1

# ---------------------------------------------------------------- locs
SUFFIX = {0: '_1', 1: '_2', 2: '_3', 3: '_4', 4: '_q', 9: '_5', 5: '_w', 6: '_r', 7: '_e', 8: '_t', 10: '_8', 11: '_9',
          22: '_0', 12: '_a', 13: '_s', 14: '_d', 15: '_f', 16: '_g', 17: '_h', 18: '_z', 19: '_x', 20: '_c', 21: '_v'}
LOCMODELS = f'{E}/content/models/loc/fairytale2'
os.makedirs(LOCMODELS, exist_ok=True)
locname = {}      # 468 id -> our name (for ported ones)
locid = {}        # 468 id -> our id
loc_out = []
dropped = []      # (468 id, what was left out)

def same(i):
    if i >= ORIG['loc']:
        return False
    a = OURLOC[i]; b = decode_loc(L468[i])
    return a.get('name') == b.get('name') and a['models'] == b['models']

def loc_model(mid, fname):
    """a model file for this loc's shape: ours if it already has that name, else a new copy"""
    old = pt.P['model'].get(mid) if mid < ORIG['model'] else None
    if old == fname:
        return
    if fname in pt.P['model'].values():
        return
    pt.newid('model', fname)
    open(f'{LOCMODELS}/{fname}.ob2', 'wb').write(m.c.decompress(m.c.raw(7, mid)))

def bases_for(i, o):
    key = o['models']
    if not key:
        return []
    olds = [pt.P['model'].get(mid) for mid, s in key if mid < ORIG['model']]
    # all old models, already named for their shapes with one base: use them as they are
    if len(olds) == len(key):
        bs = set()
        ok = True
        for (mid, s), nm in zip(key, olds):
            if not nm.endswith(SUFFIX[s]): ok = False; break
            bs.add(nm[:-len(SUFFIX[s])])
        if ok and (len(bs) == 1 or all(s == 10 for mid, s in key)):
            return sorted(bs) if all(s == 10 for mid, s in key) and len(bs) > 1 else [bs.pop()]
    if all(s == 10 for mid, s in key) and len(key) > 1:
        out = []
        for mid, s in key:
            loc_model(mid, f'ft2_m{mid}_8'); out.append(f'ft2_m{mid}')
        return out
    base = f'ft2_l{i}' if len(key) > 1 else f'ft2_m{key[0][0]}'
    if len({s for mid, s in key}) != len(key):
        raise SystemExit(f'loc {i}: two models for one shape {key}')
    for mid, s in key:
        loc_model(mid, base + SUFFIX[s])
    return [base]

def forceapproach(f):
    for bit, nm in ((1, 'north'), (2, 'east'), (4, 'south'), (8, 'west')):
        if f & bit == 0:
            return nm
    return ''

def loc_ref(i):
    """our id for 468 loc i, porting it if needed"""
    if i in locid:
        return locid[i]
    if same(i):
        locid[i] = i
        return i
    o = decode_loc(L468[i])
    name = f"ft2_{slug(o['name'])}_{i}" if o.get('name') and o['name'] != 'null' else f'ft2_loc_{i}'
    locname[i] = name
    locid[i] = pt.newid('loc', name)
    lines = [f'[{name}]']
    if o.get('name') and o['name'] != 'null': lines.append(f"name={o['name']}")
    if o.get('desc'): lines.append(f"desc={o['desc']}")
    for k, b in enumerate(bases_for(i, o)):
        lines.append(f"model{'' if k == 0 else k + 1}={b}")
    for key in ('width', 'length'):
        if key in o: lines.append(f'{key}={o[key]}')
    if o.get('blockwalk') is False: lines.append('blockwalk=no')
    if o.get('blockrange') is False and o.get('blockwalk') is not False: lines.append('blockrange=no')
    if 'active' in o: lines.append(f"active={'yes' if o['active'] else 'no'}")
    for key in ('hillskew', 'sharelight', 'occlude', 'mirror', 'forcedecor', 'breakroutefinding'):
        if o.get(key): lines.append(f'{key}=yes')
    if o.get('anim') is not None: lines.append(f"anim={pt.seq(o['anim'])}")
    for key in ('wallwidth', 'ambient', 'contrast', 'resizex', 'resizey', 'resizez', 'offsetx', 'offsety', 'offsetz'):
        if key in o: lines.append(f'{key}={o[key]}')
    for key, mx in (('mapfunction', MAPFUNCTIONS), ('mapscene', MAPSCENES)):
        if key in o:
            if o[key] < mx: lines.append(f'{key}={o[key]}')
            else: dropped.append((i, f'{key} {o[key]}'))
    for nn, op in sorted(o['ops'].items()):
        lines.append(f'op{nn}={op}')
    if o.get('shadow') is False: lines.append('shadow=no')
    if 'forceapproach' in o: lines.append(f"forceapproach={forceapproach(o['forceapproach'])}")
    if 'raiseobject' in o: lines.append(f"raiseobject={'yes' if o['raiseobject'] else 'no'}")
    lines += recol_lines(o['recol'])
    for key in ('bgsound', 'randsound', 'blockwalk1', 'hasalpha'):
        if key in o: dropped.append((i, key))
    if o['retex'] or o['unknown'] or 'params' in o:
        raise SystemExit(f'unhandled loc {i} {o}')
    if o.get('multi'):
        vb, vp, states = o['multi']
        if vb == 65535:
            raise SystemExit(f'loc {i}: multiloc on a varp')
        lines.append(f'multivar={VARBITS[vb]}')
        for st, child in enumerate(states):
            if child != 65535:
                loc_ref(child)
                lines.append(f'multiloc={st},{locname.get(child) or pt.P["loc"][child]}')
    loc_out.append('\n'.join(lines))
    return locid[i]

VARBITS = {2326: 'fairy2_queencure_quest'}
# the 377 client loads map functions 0-69 and map scenes 0-71 (Client.load)
MAPFUNCTIONS, MAPSCENES = 70, 72

# ---------------------------------------------------------------- terrain text
def tstr(tile):
    s = ''
    if tile['h'] is not None: s += f"h{tile['h']} "
    if tile['o']:
        oid, sh, ro = tile['o']
        oid = floor('o', oid)
        oid = oid - 256 if oid > 127 else oid
        s += f'o{oid};{sh};{ro} ' if sh and ro else (f'o{oid};{sh} ' if sh else f'o{oid} ')
    if tile['f']: s += f"f{tile['f']} "
    if tile['u']: s += f"u{floor('u', tile['u'])} "
    return s.strip()

# ---------------------------------------------------------------- NPCs from Void
NPCNAME = {v: k for k, v in pt.P['npc'].items()}
def void_npcs():
    ids = {}
    for f in glob.glob(f'{VOID}/**/*.npcs.toml', recursive=True):
        cur = None
        for line in open(f):
            mm = re.match(r'\[([a-z0-9_]+)\]', line)
            if mm: cur = mm[1]; continue
            mm = re.match(r'id = (\d+)', line)
            if mm and cur and cur not in ids: ids[cur] = int(mm[1])
    sp = []
    for f in glob.glob(f'{VOID}/**/*.npc-spawns.toml', recursive=True):
        for line in open(f):
            mm = re.search(r'id = "([a-z0-9_]+)", x = (\d+), y = (\d+)(?:, level = (\d+))?', line)
            if mm: sp.append((mm[1], int(mm[2]), int(mm[3]), int(mm[4] or 0)))
    return ids, sp
VIDS, VSPAWNS = void_npcs()
# the Dream World on the level above the cosmic plane is Lunar Diplomacy's (after our cache)
SKIP_SPAWNS = {'shooting_star'}

def our_npc(vid):
    """our npc id for a 468 npc id, or None if it isn't in our game"""
    if vid < ORIG['npc']:
        return vid
    nm = pt.npcname.get(vid)
    return NPCNAME[nm] if nm else None

# ---------------------------------------------------------------- the new squares
report = []
for (mx, mz), what in SQUARES.items():
    terr = m.terrain(mx, mz); locs = m.locs(mx, mz)
    lines = ['==== MAP ====']
    for lv in range(4):
        for x in range(64):
            for z in range(64):
                v = tstr(terr[(lv, x, z)])
                if v: lines.append(f'{lv} {x} {z}: {v}')
    lines.append('==== LOC ====')
    for (lv, x, z, i, s, r) in sorted(locs, key=lambda t: (t[0], t[1], t[2])):
        lines.append(f'{lv} {x} {z}: {loc_ref(i)} {s}' + (f' {r}' if r else ''))
    lines.append('==== NPC ====')
    nn = 0; skipped = []
    for (name, x, y, lv) in VSPAWNS:
        if x >> 6 != mx or y >> 6 != mz: continue
        if name in SKIP_SPAWNS: skipped.append(name); continue
        vid = VIDS.get(name)
        nid = our_npc(vid) if vid is not None else None
        if nid is None:
            skipped.append(name); continue
        lines.append(f'{lv} {x & 63} {y & 63}: {nid}'); nn += 1
    path = f'{E}/content/maps/m{mx}_{mz}.jm2'
    if os.path.exists(path):
        raise SystemExit(f'{path} exists')
    open(path, 'w').write('\n'.join(lines) + '\n')
    report.append(f'm{mx}_{mz} ({what}): {len(locs)} locs, {nn} npcs' + (f', left out {sorted(set(skipped))}' if skipped else ''))

# ---------------------------------------------------------------- rings on squares we have
rings = []
for (mx, mz) in m.squares():
    if (mx, mz) in SQUARES or not os.path.exists(f'{E}/content/maps/m{mx}_{mz}.jm2'):
        continue
    locs = m.locs(mx, mz)
    if not locs: continue
    for t in locs:
        o = decode_loc(L468[t[3]])
        if o.get('name') == 'Fairy ring' and t[3] not in RING_SKIP:
            rings.append((mx, mz, t, locs))
by_sq = {}
for (mx, mz, t, locs) in rings:
    by_sq.setdefault((mx, mz), (locs, []))[1].append(t)
ICON = 7389
for (mx, mz), (l07, ringlocs) in sorted(by_sq.items()):
    path = f'{E}/content/maps/m{mx}_{mz}.jm2'
    terr, l06, rest = read_jm2(path)
    remove = set(); add = []
    for (lv, rx, rz, rid, rs, rr) in ringlocs:
        inring = lambda x, z: abs(x - rx) <= 1 and abs(z - rz) <= 1
        gone = [t for t in l06 if t[0] == lv and inring(t[1], t[2])]
        remove.update(gone)
        for t in l07:
            if t[0] == lv and inring(t[1], t[2]):
                add.append(t)
        # the 2007 map icon next to the ring (on top of whatever ground decoration 2006 has there)
        for t in l07:
            if t[0] == lv and t[3] == ICON and abs(t[1] - rx) <= 2 and abs(t[2] - rz) <= 2:
                remove.update(u for u in l06 if u[:3] == t[:3] and u[4] == 22)
                add.append(t)
        # trees 2007 moved out of the ring
        for g in gone:
            if g[4] != 10: continue
            for t in l07:
                if t[0] == lv and t[3] == g[3] and t[4] == 10 and abs(t[1] - rx) <= 2 and abs(t[2] - rz) <= 2 and not inring(t[1], t[2]):
                    remove.update(u for u in l06 if u[:3] == t[:3])
                    add.append(t)
        report.append(f'ring {loc_ref(rid)} ({rid}) at {mx * 64 + rx},{mz * 64 + rz} level {lv}: removed {len(gone)} 2006 locs')
    merged = [t for t in l06 if t not in remove] + [(lv, x, z, loc_ref(i), s, r) for (lv, x, z, i, s, r) in add]
    merged.sort(key=lambda t: (t[0], t[1], t[2]))
    lines = ['==== MAP ====']
    for lv in range(4):
        for x in range(64):
            for z in range(64):
                v = terr.get((lv, x, z), '').strip()
                if v: lines.append(f'{lv} {x} {z}: {v}')
    lines.append('==== LOC ====')
    for (lv, x, z, i, s, r) in merged:
        lines.append(f'{lv} {x} {z}: {i} {s}' + (f' {r}' if r else ''))
    sec = None
    for (sname, line) in rest:
        if sname != sec:
            lines.append(f'==== {sname} ===='); sec = sname
        if line.strip():
            lines.append(line)
    open(path, 'w').write('\n'.join(lines) + '\n')

# ---------------------------------------------------------------- write
d = f'{E}/content/scripts/areas/area_fairy_rings/configs'
os.makedirs(d, exist_ok=True)
hdr = ("// EASCape: {what} from the August 2007 cache (build 468, OpenRS2 633), converted by\n"
       "// tools/fairytale2/convert_maps.py; 468 ids in the names.\n\n")
open(f'{d}/fairy_rings.loc', 'w').write(hdr.format(what="the fairy rings and the scenery of the places they lead to") + '\n\n'.join(loc_out) + '\n')
if flo_out:
    open(f'{d}/fairy_rings.flo', 'w').write(hdr.format(what='the floors 377 lacks') + '\n\n'.join(flo_out) + '\n')
if pt.seq_out:
    open(f'{d}/fairy_rings.seq', 'w').write(hdr.format(what="the scenery's animations") + '\n\n'.join(pt.seq_out) + '\n')
pt.save_packs()
for r in report: print(r)
print({k: len(v) for k, v in pt.ADDED.items()})
print('left out:', sorted(set(dropped)))
