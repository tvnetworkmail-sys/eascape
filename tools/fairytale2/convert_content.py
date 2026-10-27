# Fairytale II, step 1: the quest's people, items and their models and animations from the
# August 2007 cache (build 468, OpenRS2 633), converted to our 377 content the way the Warriors'
# Guild's were (tools/warriors_guild/convert_people.py, whose colour and animation code this
# reuses). Ids below the 377 cache's own counts are the same thing in both caches, so only what
# 377 lacks is added, with new ids after ours. Multinpcs keep the cache's own varbits, by
# RuneLite's names (gameval VarbitID: fairy2_queencure_quest is varp 810 bits 0-6).
# Usage: convert_content.py <cache468 flat dir>    (run once; see README.md)
import sys, os, re, pickle, struct
W = os.path.dirname(os.path.abspath(__file__))
E = os.path.abspath(W + '/../..')
CACHE = sys.argv[1]
sys.path.insert(0, W); sys.path.insert(0, W + '/../warriors_guild')
from cache468 import FlatCache as Cache
from defs468 import decode_npc, decode_obj, decode_seq, R

c = Cache(CACHE)
NPCF = c.files(2, 9); OBJF = c.files(2, 10); SEQF = c.files(2, 12); SPOTF = c.files(2, 13); VBF = c.files(2, 14)

def readpack(name):
    d = {}
    for line in open(f'{E}/content/pack/{name}.pack'):
        if '=' in line:
            a, b = line.rstrip('\n').split('=', 1); d[int(a)] = b
    return d
P = {n: readpack(n) for n in ('model', 'seq', 'npc', 'obj', 'spotanim', 'anim', 'animset', 'base', 'loc', 'varbit')}
NEXT = {n: max(P[n]) + 1 for n in P}
ORIG = {'model': 14927, 'seq': 3997, 'npc': 3852, 'obj': 7957, 'spotanim': 666, 'loc': 14974}
ADDED = {n: [] for n in P}

def newid(pack, name):
    i = NEXT[pack]; NEXT[pack] += 1
    P[pack][i] = name; ADDED[pack].append((i, name))
    return i

def slug(s):
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')

# ---------------------------------------------------------------- what comes over
NPCS = list(range(4418, 4460))          # Gorak .. the orks (the quest's people, the hideout's wildlife)
OBJS = list(range(9016, 9026))          # gorak claws .. Nuff's certificate
# the cache's own varbits the multinpcs use (RuneLite gameval VarbitID names)
VARBITS = {2326: 'fairy2_queencure_quest', 2332: 'fairy2_nuffvisible'}

MODEL_DIR = f'{E}/content/models/fairytale2'
os.makedirs(MODEL_DIR, exist_ok=True)
newmodels = {}

def model(mid, kind):
    """name for a 468 model id: ours if 377 has it, else a new file"""
    if mid < ORIG['model']:
        return P['model'][mid]
    if mid in newmodels:
        return newmodels[mid]
    name = f'ft2_{kind}m{mid}'
    newmodels[mid] = name
    newid('model', name)
    open(f'{MODEL_DIR}/{name}.ob2', 'wb').write(Cache.decompress(c.raw(7, mid)))
    return name

# ---------------------------------------------------------------- colours (as convert.py)
def hsl24to16(h, s, l):
    if l > 243: s >>= 4
    elif l > 217: s >>= 3
    elif l > 192: s >>= 2
    elif l > 179: s >>= 1
    return (((h & 0xff) >> 2) << 10) + ((s >> 5) << 7) + (l >> 1)
def rgbToHsl(r, g, b):
    mn = min(r, g, b); mx = max(r, g, b); h = 0.0; s = 0.0; l = (mn + mx) / 2.0
    if mn != mx:
        s = (mx - mn) / (mx + mn) if l < 0.5 else (mx - mn) / (2.0 - mx - mn)
        if r == mx: h = (g - b) / (mx - mn)
        elif g == mx: h = (b - r) / (mx - mn) + 2.0
        else: h = (r - g) / (mx - mn) + 4.0
    h /= 6.0
    return hsl24to16(int(h * 256.0), max(0, min(255, int(s * 256.0))), max(0, min(255, int(l * 256.0))))
REV = {}
for rgb in range(32768):
    REV.setdefault(rgbToHsl(((rgb >> 10) & 31) / 31.0, ((rgb >> 5) & 31) / 31.0, (rgb & 31) / 31.0), rgb)
def recol_lines(pairs):
    out = []
    for k, (s_, d_) in enumerate(pairs):
        if s_ not in REV or d_ not in REV:
            raise SystemExit(f'colour {s_}/{d_} has no rgb15')
        out += [f'recol{k + 1}s={REV[s_]}', f'recol{k + 1}d={REV[d_]}']
    return out

# ---------------------------------------------------------------- animations
seqname = {}       # 451 seq id -> our name
frameid = {}       # (group, file) -> our frame id
groups_done = {}

def base377(d451):
    r = R(d451); n = r.g1()
    types = [r.g1() for _ in range(n)]
    counts = [r.g1() for _ in range(n)]
    out = bytearray([n]) + bytes(types)
    for k in counts:
        out.append(k); out += bytes(r.g1() for _ in range(k))
    if r.p != len(d451):
        raise SystemExit('base not fully read')
    return bytes(out)

def convert_group(g):
    if g in groups_done:
        return
    files = c.files(0, g)
    head = bytearray(); t1 = bytearray(); t2 = bytearray(); dl = bytearray()
    base = None
    ids = sorted(files)
    head += struct.pack('>H', len(ids))
    for f in ids:
        d = files[f]; r = R(d)
        b = r.g2(); n = r.g1()
        if base is None: base = b
        elif b != base: raise SystemExit(f'group {g} mixes bases')
        flags = bytes(r.g1() for _ in range(n))
        values = d[r.p:]
        fid = newid('anim', f'anim_{NEXT["anim"]}')
        frameid[(g, f)] = fid
        head += struct.pack('>HB', fid, n)
        t1 += flags; t2 += values; dl.append(1)
    bdata = base377(list(c.files(1, base).values())[0])
    gid = newid('animset', f'anim_{NEXT["animset"]}')
    newid_base = NEXT['base']; P['base'][newid_base] = f'base_{newid_base}'; ADDED['base'].append((newid_base, f'base_{newid_base}')); NEXT['base'] += 1
    blob = bytes(head + t1 + t2 + dl + bdata) + struct.pack('>HHHH', len(head) - 2, len(t1), len(t2), len(dl))
    open(f'{MODEL_DIR}/anim_{gid}.anim', 'wb').write(blob)
    groups_done[g] = gid

seq_out = []
def seq(sid):
    """our name for a 451 seq id; new ones are converted with their frames"""
    if sid is None or sid == 65535:
        return None
    if sid < ORIG['seq']:
        return P['seq'][sid]
    if sid in seqname:
        return seqname[sid]
    o = decode_seq(SEQF[sid])
    name = f'ft2_seq_{sid}'
    seqname[sid] = name
    newid('seq', name)
    lines = [f'[{name}]']
    for k, (fr, dly) in enumerate(zip(o['frames'], o['delays'])):
        convert_group(fr >> 16)
        lines.append(f'frame{k + 1}=anim_{frameid[(fr >> 16, fr & 0xffff)]}')
        lines.append(f'delay{k + 1}={dly}')
    for k, fr in enumerate(o.get('iframes', [])):
        convert_group(fr >> 16)
        lines.append(f'iframe{k + 1}=anim_{frameid[(fr >> 16, fr & 0xffff)]}')
    if 'replayoff' in o: lines.append(f"loops={o['replayoff']}")
    if 'walkmerge' in o: lines.append('walkmerge=' + ','.join(f'label_{x}' for x in o['walkmerge']))
    if 'priority' in o: lines.append(f"priority={o['priority']}")
    for key, hand in (('righthand', 'replaceheldright'), ('lefthand', 'replaceheldleft')):
        if key in o:
            v = o[key]
            # 0: hide the held item; 512+: show this obj instead; anything else isn't an obj (468
            # has a few small values here), so the held item is left alone
            if v == 0: lines.append(f'{hand}=hide')
            elif v >= 512: lines.append(f'{hand}={obj_ref(v - 512)}')
    if 'replaycount' in o: lines.append(f"maxloops={o['replaycount']}")
    for key in ('preanim_move', 'postanim_move'):
        if key in o:
            names = ['delaymove', 'delayanim', 'merge'] if key == 'preanim_move' else ['delaymove', 'abortanim', 'merge']
            lines.append(f"{key}={names[o[key]]}")
    seq_out.append('\n'.join(lines))
    return name

# ---------------------------------------------------------------- objs
objname = {}
obj_out = []
def obj_ref(oid):
    if oid < ORIG['obj']:
        return P['obj'][oid]
    return objname.get(oid) or make_obj(oid)

def make_obj(oid):
    o = decode_obj(OBJF[oid])
    name = 'ft2_' + slug(o['name'].replace("'", '')) if o.get('name') else f'ft2_obj_{oid}'
    if name in P['obj'].values() or name in objname.values():
        name = f'ft2_{name}'
    objname[oid] = name
    newid('obj', name)
    lines = [f'[{name}]']
    if o.get('name'): lines.append(f"name={o['name']}")
    if o.get('desc'): lines.append(f"desc={o['desc']}")
    lines.append(f"model={model(o['model'], 'obj')}")
    for k, key in (('zoom2d', '2dzoom'), ('xan2d', '2dxan'), ('yan2d', '2dyan'), ('zan2d', '2dzan'), ('xof2d', '2dxof'), ('yof2d', '2dyof')):
        if k in o: lines.append(f'{key}={o[k]}')
    if o.get('stackable'): lines.append('stackable=yes')
    if 'cost' in o: lines.append(f"cost={o['cost']}")
    if o.get('members'): lines.append('members=yes')
    for n, op in sorted(o['ops'].items()): lines.append(f'op{n}={op}')
    for n, op in sorted(o['iops'].items()): lines.append(f'iop{n}={op}')
    for key in ('manwear', 'womanwear'):
        if key in o: lines.append(f'{key}={model(o[key][0], "obj")},{o[key][1]}')
    for key in ('manwear2', 'womanwear2', 'manwear3', 'womanwear3', 'manhead', 'womanhead', 'manhead2', 'womanhead2'):
        if key in o: lines.append(f'{key}={model(o[key], "obj")}')
    lines += recol_lines(o['recol'])
    for slot, cid, cnt in o.get('countobj', []):  # (slot, obj, count) as defs451 decodes it
        lines.append(f'count{slot}={obj_ref(cid)},{cnt}')
    if o['retex'] or o['unknown']: raise SystemExit(f'obj {oid} unhandled {o}')
    obj_out.append('\n'.join(lines))
    return name

# ---------------------------------------------------------------- npcs
npc_out = []
npcname = {}
decoded = {nid: decode_npc(NPCF[nid]) for nid in NPCS}
for nid in NPCS:
    o = decoded[nid]
    name = 'ft2_' + (slug(o['name']) if o.get('name') else f'multi_{nid}')
    if name in npcname.values() or any(decoded[x].get('name') == o.get('name') for x in NPCS if x != nid and o.get('name')):
        name = f'{name}_{nid}'  # several of one name: the 468 id tells them apart
    npcname[nid] = name
    newid('npc', name)

def npc_ref(nid):
    if nid < ORIG['npc']:
        return P['npc'][nid]
    if nid not in npcname:
        raise SystemExit(f'multinpc {nid} not ported')
    return npcname[nid]

for nid in NPCS:
    o = decoded[nid]
    name = npcname[nid]
    lines = [f'[{name}]']
    if o.get('name'): lines.append(f"name={o['name']}")
    if o.get('desc'): lines.append(f"desc={o['desc']}")
    for k, m in enumerate(o.get('models', [])):
        lines.append(f'model{k + 1}={model(m, "npc")}')
    for k, m in enumerate(o.get('heads', [])):
        lines.append(f'head{k + 1}={model(m, "npc")}')
    lines += recol_lines(o['recol'])
    if 'size' in o: lines.append(f"size={o['size']}")
    if 'readyanim' in o: lines.append(f"readyanim={seq(o['readyanim'])}")
    if 'walkanim_b' in o:
        lines.append(f"walkanim={seq(o['walkanim'])},{seq(o['walkanim_b'])},{seq(o['walkanim_r'])},{seq(o['walkanim_l'])}")
    elif 'walkanim' in o:
        lines.append(f"walkanim={seq(o['walkanim'])}")
    for n, op in sorted(o['ops'].items()): lines.append(f'op{n}={op}')
    if 'vislevel' in o: lines.append(f"vislevel={o['vislevel'] if o['vislevel'] else 'hide'}")
    for key in ('resizeh', 'resizev', 'ambient', 'contrast', 'turnspeed'):
        if key in o: lines.append(f'{key}={o[key]}')
    if o.get('minimap') is False: lines.append('minimap=no')
    if o.get('multi'):
        vb, vp, targets = o['multi']
        if vb == 65535 or vb not in VARBITS: raise SystemExit(f'npc {nid} multi on {vb}/{vp}')
        lines.append(f'multivar={VARBITS[vb]}')
        for state, t in enumerate(targets):
            if t != 65535: lines.append(f'multinpc={state},{npc_ref(t)}')
    if o['retex'] or o['unknown']: raise SystemExit(f'npc {nid} unhandled {o}')
    npc_out.append('\n'.join(lines))

for oid in OBJS:
    obj_ref(oid)

# ---------------------------------------------------------------- write
cfg = f'{E}/content/scripts/quests/quest_fairy2/configs'
os.makedirs(cfg, exist_ok=True)
hdr = ("// EASCape: Fairytale II's {what} from the August 2007 cache (build 468, OpenRS2 633), converted\n"
       "// by tools/fairytale2/convert_content.py; 468 ids in the names.\n\n")
open(f'{cfg}/fairy2.npc', 'w').write(hdr.format(what='people and creatures') + '\n\n'.join(npc_out) + '\n')
open(f'{cfg}/fairy2.obj', 'w').write(hdr.format(what='items') + '\n\n'.join(obj_out) + '\n')
if seq_out:
    open(f'{cfg}/fairy2.seq', 'w').write(hdr.format(what='animations') + '\n\n'.join(seq_out) + '\n')
for pack in ADDED:
    if ADDED[pack]:
        with open(f'{E}/content/pack/{pack}.pack', 'a') as f:
            for i, n in ADDED[pack]:
                f.write(f'{i}={n}\n')
pickle.dump({'npc': npcname, 'obj': objname, 'seq': seqname, 'model': newmodels}, open(W + '/names.pkl', 'wb'))
print({k: len(v) for k, v in ADDED.items()})
