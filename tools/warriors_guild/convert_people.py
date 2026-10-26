# Warriors' Guild, step 2: the guild's NPCs, items, graphics, extra objects and animations from the
# build 451 cache (OpenRS2 602), converted to our 377 content. Run once (21-26 Oct 2026); see
# README.md. Shared ids are identical between 377 and 451 (checked by name and bytes), so only what
# 377 lacks is added, with new ids after ours. Animations: the 451 frame groups are rewritten as
# 377 animation files (head / transforms / values / delays / base, see engine AnimFrame.ts).
import sys, os, re, pickle, struct
W = os.path.dirname(os.path.abspath(__file__))
E = os.path.abspath(W + '/../..')
CACHE = sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/-home-claude/75994f91-c279-5580-8356-99c172c3a22d/scratchpad/c451/disk/cache'
sys.path.insert(0, W)
from js5 import Cache
from defs451 import decode_npc, decode_obj, decode_seq, R
from locdef import decode_loc

c = Cache(CACHE)
NPCF = c.files(2, 9); OBJF = c.files(2, 10); SEQF = c.files(2, 12); SPOTF = c.files(2, 13); LOCF = c.files(2, 6)

def readpack(name):
    d = {}
    for line in open(f'{E}/content/pack/{name}.pack'):
        if '=' in line:
            a, b = line.rstrip('\n').split('=', 1); d[int(a)] = b
    return d
P = {n: readpack(n) for n in ('model', 'seq', 'npc', 'obj', 'spotanim', 'anim', 'animset', 'base', 'loc')}
NEXT = {n: max(P[n]) + 1 for n in P}
# the 377 cache's own counts: a 451 id below these is the same thing in both caches; at or above,
# it's something new (and may clash with an id we've already given our own additions)
ORIG = {'model': 14927, 'seq': 3997, 'npc': 3852, 'obj': 7957, 'spotanim': 666, 'loc': 14974}
ADDED = {n: [] for n in P}

def newid(pack, name):
    i = NEXT[pack]; NEXT[pack] += 1
    P[pack][i] = name; ADDED[pack].append((i, name))
    return i

def slug(s):
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')

# ---------------------------------------------------------------- what comes over
NPCS = list(range(4278, 4301))                    # animated armour .. the referees
OBJS = list(range(8844, 8866))                    # defenders, token (+ stack looks), shield, shots, barrels, ashes
SPOTS = list(range(679, 691))                     # catapult missiles, barrel puffs, the shot
LOCS_NEW = [15617, 15618, 15619, 15620] + list(range(15624, 15631))   # loaded catapults, dummies
SEQS_EXTRA = [4161] + list(range(4163, 4188))     # 2009scape's guild anims and their neighbours

# ---------------------------------------------------------------- models
MODEL_DIR = f'{E}/content/models/warriors_guild'
os.makedirs(MODEL_DIR, exist_ok=True)
model_name = {v: k for k, v in P['model'].items()}  # name -> id (existing)
newmodels = {}

def model(mid, kind):
    """name for a 451 model id: ours if 377 has it, else a new file"""
    if mid < ORIG['model']:
        return P['model'][mid]
    if mid in newmodels:
        return newmodels[mid]
    name = f'wg_{kind}m{mid}'
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
    name = f'wg_seq_{sid}'
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
            lines.append(f'{hand}=hide' if v == 0 else f'{hand}={obj_ref(v - 512)}')
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
    name = slug(o['name']) if o.get('name') else f'wg_obj_{oid}'
    if name in P['obj'].values() or name in objname.values():
        name = f'wg_{name}'
    objname[oid] = name
    newid('obj', name)
    lines = [f'[{name}]']
    if o.get('name'): lines.append(f"name={o['name']}")
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
for nid in NPCS:
    o = decode_npc(NPCF[nid])
    name = 'wg_' + slug(o['name'])
    while name in npcname.values():
        name += '_2'
    npcname[nid] = name
    newid('npc', name)
    lines = [f'[{name}]', f"name={o['name']}"]
    for k, m in enumerate(o.get('models', [])):
        lines.append(f'model{k + 1}={model(m, "npc")}')
    for k, m in enumerate(o.get('heads', [])):
        lines.append(f'head{k + 1}={model(m, "npc")}')
    lines += recol_lines(o['recol'])
    if 'size' in o: lines.append(f"size={o['size']}")
    if 'readyanim' in o: lines.append(f"readyanim={seq(o['readyanim'])}")
    if 'walkanim_b' in o:
        # 451's order is forward, back, then the two turns as 377's walkanim wants them (f, b, l, r)
        lines.append(f"walkanim={seq(o['walkanim'])},{seq(o['walkanim_b'])},{seq(o['walkanim_r'])},{seq(o['walkanim_l'])}")
    elif 'walkanim' in o:
        lines.append(f"walkanim={seq(o['walkanim'])}")
    for n, op in sorted(o['ops'].items()): lines.append(f'op{n}={op}')
    if 'vislevel' in o: lines.append(f"vislevel={o['vislevel']}")
    for key in ('resizeh', 'resizev', 'ambient', 'contrast', 'turnspeed'):
        if key in o: lines.append(f'{key}={o[key]}')
    if o.get('minimap') is False: lines.append('minimap=no')
    if o['retex'] or o['unknown'] or o.get('multi'): raise SystemExit(f'npc {nid} unhandled {o}')
    npc_out.append('\n'.join(lines))

for oid in OBJS:
    obj_ref(oid)

# ---------------------------------------------------------------- spotanims
spot_out = []
spotname = {}
for sid in SPOTS:
    r = R(SPOTF[sid]); o = {}
    while r.more():
        op = r.g1()
        if op == 0: break
        if op == 1: o['model'] = r.g2()
        elif op == 2: o['anim'] = r.g2()
        elif op == 4: o['resizeh'] = r.g2()
        elif op == 5: o['resizev'] = r.g2()
        elif op == 6: o['angle'] = r.g2()
        elif op == 7: o['ambient'] = r.g1b()
        elif op == 8: o['contrast'] = r.g1b()
        elif op == 40: o['recol'] = [(r.g2(), r.g2()) for _ in range(r.g1())]
        else: raise SystemExit(f'spot {sid} op {op}')
    name = f'wg_spot_{sid}'
    spotname[sid] = name
    newid('spotanim', name)
    lines = [f'[{name}]', f"model={model(o['model'], 'spot')}"]
    if 'anim' in o: lines.append(f"anim={seq(o['anim'])}")
    for key in ('resizeh', 'resizev', 'angle', 'ambient', 'contrast'):
        if key in o: lines.append(f'{key}={o[key]}')
    lines += recol_lines(o.get('recol', []))
    spot_out.append('\n'.join(lines))

# ---------------------------------------------------------------- the extra locs (loaded catapults, dummies)
SUFFIX = {0: '_1', 10: '_8', 22: '_0'}
loc_out = []
locname = {}
for lid in LOCS_NEW:
    o = decode_loc(LOCF[lid])
    name = f"wg_{slug(o['name'])}_{lid}"
    locname[lid] = name
    newid('loc', name)
    lines = [f'[{name}]', f"name={o['name']}"]
    for k, (m, s) in enumerate(o['models']):
        if s != 10: raise SystemExit(f'loc {lid} shape {s}')
        nm = model(m, 'loc')
        # loc models are found as <base>_8 by the packer; keep _8 names for new ones
        if not nm.endswith('_8'):
            os.rename(f'{MODEL_DIR}/{nm}.ob2', f'{MODEL_DIR}/{nm}_8.ob2')
            for k2, (i2, n2) in enumerate(ADDED['model']):
                if n2 == nm: ADDED['model'][k2] = (i2, nm + '_8'); P['model'][i2] = nm + '_8'
            newmodels[m] = nm + '_8'
            nm = nm + '_8'
        lines.append(f"model{'' if k == 0 else k + 1}={nm[:-2]}")
    for key in ('width', 'length'):
        if key in o: lines.append(f'{key}={o[key]}')
    if o.get('anim') is not None: lines.append(f"anim={seq(o['anim'])}")
    for n, op in sorted(o['ops'].items()): lines.append(f'op{n}={op}')
    loc_out.append('\n'.join(lines))
animator_seq = seq(4161)

for sid in SEQS_EXTRA:
    if sid in SEQF:
        seq(sid)

# ---------------------------------------------------------------- write
cfg = f'{E}/content/scripts/areas/area_warriors_guild/configs'
hdr = ("// EASCape: the Warriors' Guild's {what} from the build 451 cache (OpenRS2 602), converted by\n"
       "// tools/warriors_guild/convert_people.py; 451 ids in the names.\n\n")
open(f'{cfg}/warriors_guild.npc', 'w').write(hdr.format(what='people and monsters') + '\n\n'.join(npc_out) + '\n')
open(f'{cfg}/warriors_guild.obj', 'w').write(hdr.format(what='items') + '\n\n'.join(obj_out) + '\n')
open(f'{cfg}/warriors_guild.spotanim', 'w').write(hdr.format(what='graphics') + '\n\n'.join(spot_out) + '\n')
open(f'{cfg}/warriors_guild.seq', 'w').write(hdr.format(what='animations') + '\n\n'.join(seq_out) + '\n')
open(f'{cfg}/warriors_guild_extra.loc', 'w').write(hdr.format(what='loaded catapults and dummies') + '\n\n'.join(loc_out) + '\n')
for pack in ADDED:
    if ADDED[pack]:
        with open(f'{E}/content/pack/{pack}.pack', 'a') as f:
            for i, n in ADDED[pack]:
                f.write(f'{i}={n}\n')
pickle.dump({'npc': npcname, 'obj': objname, 'spot': spotname, 'loc': locname, 'seq': seqname}, open(W + '/names.pkl', 'wb'))
print({k: len(v) for k, v in ADDED.items()})
print('animator anim', animator_seq)
