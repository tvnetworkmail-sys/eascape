# Warriors' Guild, step 1: merge the guild's map from the build 451 cache (OpenRS2 602) into our
# 377 map square 44_55, with new loc configs and models for the objects 377 doesn't have.
import sys, os, re, pickle, shutil
W = '/tmp/claude-0/-home-claude/75994f91-c279-5580-8356-99c172c3a22d/scratchpad/wg'
E = '/home/claude/eascape'
sys.path.insert(0, W)
from maps import decode_terrain, decode_locs, read_jm2
from js5 import Cache

c = Cache(W + '/../c451/disk/cache')
defs = pickle.load(open(W + '/defs.pkl', 'rb'))
terr451, _ = decode_terrain(open(W + '/m44_55.bin', 'rb').read())
locs451 = decode_locs(open(W + '/l44_55.bin', 'rb').read())
jm2 = E + '/content/maps/m44_55.jm2'

def inreg(l, x, z):
    return l > 0 or (18 <= x <= 63 and 12 <= z <= 38)

# ---------------------------------------------------------------- ids
def readpack(p):
    d = {}
    for line in open(p):
        if '=' in line:
            a, b = line.rstrip('\n').split('=', 1); d[int(a)] = b
    return d
locpack = readpack(E + '/content/pack/loc.pack')
modelpack = readpack(E + '/content/pack/model.pack')
model_by_name = {v: k for k, v in modelpack.items()}
LOCMAX = max(locpack)

MULTI_TO_KEG = {15669, 15670, 15671, 15672, 15673}  # varbit kegs (Jimmy's challenge, later step)
used = sorted({i for (l, x, z, i, s, r) in locs451 if inreg(l, x, z)})
newlocs = sorted(i for i in used if i > LOCMAX and i not in MULTI_TO_KEG)
if 15668 not in newlocs:
    newlocs.append(15668); newlocs.sort()

def slug(s):
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')

locname = {}
for i in newlocs:
    n = defs[i].get('name')
    locname[i] = f'wg_{slug(n)}_{i}' if n else f'wg_part_{i}'
newid = {}
nxt = LOCMAX + 1
for i in newlocs:
    newid[i] = nxt; nxt += 1
for i in MULTI_TO_KEG:
    newid[i] = newid[15668]

# ---------------------------------------------------------------- models
SUFFIX = {0: '_1', 1: '_2', 2: '_3', 3: '_4', 4: '_q', 9: '_5', 5: '_w', 6: '_r', 7: '_e', 8: '_t', 10: '_8', 11: '_9',
          22: '_0', 12: '_a', 13: '_s', 14: '_d', 15: '_f', 16: '_g', 17: '_h', 18: '_z', 19: '_x', 20: '_c', 21: '_v'}
model_name = {}   # model id -> file name (without .ob2) for new models
loc_models = {}   # loc id -> list of model= base names
nextmodel = max(modelpack) + 1
new_model_files = []

def name_model(mid, fname):
    global nextmodel
    if mid in modelpack:
        return modelpack[mid]
    if mid in model_name:
        if model_name[mid] != fname:
            raise SystemExit(f'model {mid} named twice: {model_name[mid]} / {fname}')
        return fname
    model_name[mid] = fname
    new_model_files.append((mid, fname, nextmodel)); nextmodel += 1
    return fname

groups = {}
for i in newlocs:
    ms = defs[i]['models']
    key = tuple(ms)
    groups.setdefault(key, []).append(i)
for key, ids in groups.items():
    base_l = min(ids)
    if not key:
        bases = []
    elif all(s == 10 for m, s in key):
        bases = []
        for m, s in key:
            nm = name_model(m, f'wg_m{m}_8')
            if not nm.endswith('_8'):
                raise SystemExit(f'old model {m} {nm} not a _8 model')
            bases.append(nm[:-2])
    else:
        # one base for all the shapes; old models must already share one
        olds = [modelpack[m] for m, s in key if m in modelpack]
        if olds:
            base = None
            for m, s in key:
                nm = modelpack.get(m)
                if nm is None or not nm.endswith(SUFFIX[s]):
                    raise SystemExit(f'loc {ids} mixes models: {key}')
                b = nm[:-2]
                if base and b != base:
                    raise SystemExit(f'loc {ids} bases differ {base} {b}')
                base = b
        else:
            base = f'wg_l{base_l}' if len(key) > 1 else f'wg_m{key[0][0]}'
            for m, s in key:
                name_model(m, base + SUFFIX[s])
        bases = [base]
    for i in ids:
        loc_models[i] = bases

# ---------------------------------------------------------------- colours (ColorConversion port)
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
    def trunc(v): return int(v)
    hue = trunc(h * 256.0); sat = max(0, min(255, trunc(s * 256.0))); lig = max(0, min(255, trunc(l * 256.0)))
    return hsl24to16(hue, sat, lig)
REV = {}
for rgb in range(32768):
    v = rgbToHsl(((rgb >> 10) & 31) / 31.0, ((rgb >> 5) & 31) / 31.0, (rgb & 31) / 31.0)
    REV.setdefault(v, rgb)

# ---------------------------------------------------------------- examines (OSRS wiki; same ids there)
EXAMINE = {
    15166: 'Metal plating to protect the dwarf.',      # Armour (scenery), id 15166
    15608: 'This person was of great importance.',     # Statue of a warrior (every version)
    15609: 'This person was of great importance.',
    15621: 'Brings armour to life.',                   # Magical Animator
    15658: "It looks like it's made from lead - heavy, man.",  # Heavy door 15658
    15660: "It looks like it's made from lead - heavy, man.",  # Heavy door 15660
    15664: "It's a pile of 18lb shot.",                # Shot 15664
    15665: "It's a pile of 22lb shot.",                # Shot 15665
    15668: "It's a small-ish beer keg",                # Keg (Warriors' Guild) 15668
}

FA = {}
def forceapproach(f):
    for bit, nm in ((1, 'north'), (2, 'east'), (4, 'south'), (8, 'west')):
        if f & bit == 0:
            return nm
    return ''

out = ["// EASCape: the Warriors' Guild (released 13 June 2006, after our 377 cache). Its objects that",
       "// the 377 cache doesn't have, from the build 451 cache (OpenRS2 602, March 2007: the earliest with",
       "// the guild's map key). Names wg_<name>_<451 id>. Examines from the OSRS wiki where it gives them",
       "// for these ids; the rest have none yet. The Magical Animator's animation (451 seq 4161) isn't",
       "// converted yet, so it stands still. The five kegs that hide by varbit (Jimmy's challenge) are",
       "// plain kegs until that activity is built.", '']
skipped_anim = []
for i in newlocs:
    o = defs[i]
    out.append(f'[{locname[i]}]')
    if o.get('name'): out.append(f"name={o['name']}")
    if i in EXAMINE: out.append(f'desc={EXAMINE[i]}')
    for k, b in enumerate(loc_models[i]):
        out.append(f"model{'' if k == 0 else k + 1}={b}")
    for key in ('width', 'length'):
        if key in o: out.append(f'{key}={o[key]}')
    if o.get('blockwalk') is False: out.append('blockwalk=no')
    if o.get('blockrange') is False and o.get('blockwalk') is not False: out.append('blockrange=no')
    if 'active' in o: out.append(f"active={'yes' if o['active'] else 'no'}")
    for key in ('hillskew', 'sharelight', 'occlude', 'hasalpha', 'mirror', 'forcedecor', 'breakroutefinding'):
        if o.get(key): out.append(f'{key}=yes')
    if o.get('anim') is not None: skipped_anim.append((i, o['anim']))
    for key in ('wallwidth', 'ambient', 'contrast', 'mapfunction', 'resizex', 'resizey', 'resizez', 'mapscene', 'offsetx', 'offsety', 'offsetz'):
        if key in o: out.append(f'{key}={o[key]}')
    for n, op in sorted(o['ops'].items()):
        out.append(f'op{n}={op}')
    if o.get('shadow') is False: out.append('shadow=no')
    if 'forceapproach' in o: out.append(f"forceapproach={forceapproach(o['forceapproach'])}")
    if 'raiseobject' in o: out.append(f"raiseobject={'yes' if o['raiseobject'] else 'no'}")
    for k, (s_, d_) in enumerate(o['recol']):
        out.append(f'recol{k + 1}s={REV.get(s_, s_)}'); out.append(f'recol{k + 1}d={REV.get(d_, d_)}')
    if o['retex'] or o.get('multi') or o['unknown']:
        raise SystemExit(f'unhandled {i} {o}')
    out.append('')

# ---------------------------------------------------------------- write
cfgdir = E + '/content/scripts/areas/area_warriors_guild/configs'
os.makedirs(cfgdir, exist_ok=True)
open(cfgdir + '/warriors_guild.loc', 'w').write('\n'.join(out))
with open(E + '/content/pack/loc.pack', 'a') as f:
    for i in newlocs:
        f.write(f'{newid[i]}={locname[i]}\n')
mdir = E + '/content/models/loc/warriors_guild'
os.makedirs(mdir, exist_ok=True)
with open(E + '/content/pack/model.pack', 'a') as f:
    for mid, fname, pid in new_model_files:
        open(f'{mdir}/{fname}.ob2', 'wb').write(Cache.decompress(c.raw(7, mid)))
        f.write(f'{pid}={fname}\n')

# the map square: 2007 terrain and locs inside the guild's area, 2006 everywhere else
def tstr(tile):
    s = ''
    if tile['h'] is not None: s += f"h{tile['h']} "
    if tile['o']:
        oid, sh, ro = tile['o']; oid = oid - 256 if oid > 127 else oid
        s += f'o{oid};{sh};{ro} ' if sh and ro else (f'o{oid};{sh} ' if sh else f'o{oid} ')
    if tile['f']: s += f"f{tile['f']} "
    if tile['u']: s += f"u{tile['u']} "
    return s.strip()
terr, locs, rest = read_jm2(jm2)
lines = ['==== MAP ====']
for l in range(4):
    for x in range(64):
        for z in range(64):
            v = tstr(terr451[(l, x, z)]) if inreg(l, x, z) else terr.get((l, x, z), '').strip()
            if v:
                lines.append(f'{l} {x} {z}: {v}')
merged = [t for t in locs if not inreg(t[0], t[1], t[2])]
for (l, x, z, i, s, r) in locs451:
    if inreg(l, x, z):
        merged.append((l, x, z, newid.get(i, i), s, r))
merged.sort(key=lambda t: (t[0], t[1], t[2]))
lines.append('==== LOC ====')
for (l, x, z, i, s, r) in merged:
    lines.append(f'{l} {x} {z}: {i} {s}' + (f' {r}' if r else ''))
sec = None
for (sname, line) in rest:
    if sname != sec:
        lines.append(f'==== {sname} ===='); sec = sname
    if line.strip():
        lines.append(line)
open(jm2, 'w').write('\n'.join(lines) + '\n')
print('new locs', len(newlocs), 'ids', newid[newlocs[0]], '-', newid[newlocs[-1]])
print('new models', len(new_model_files))
print('locs in square', len(merged), 'skipped anims', skipped_anim)
