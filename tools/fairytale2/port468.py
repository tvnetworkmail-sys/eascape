# Shared porting for the 2007 cache (build 468): new ids after ours for whatever 377 lacks, with
# the same colour and animation conversion as convert_content.py (whose step 1 run made the names
# in names.pkl, so things ported then are reused, not ported twice).
import os, re, sys, pickle, struct
W = os.path.dirname(os.path.abspath(__file__))
E = os.path.abspath(W + '/../..')
sys.path.insert(0, W); sys.path.insert(0, W + '/../warriors_guild')
from cache468 import FlatCache as Cache  # noqa: E402
from defs468 import decode_seq, R  # noqa: E402

ORIG = {'model': 14927, 'seq': 3997, 'npc': 3852, 'obj': 7957, 'spotanim': 666, 'loc': 14974, 'flo': 174}

def readpack(name):
    d = {}
    for line in open(f'{E}/content/pack/{name}.pack'):
        if '=' in line:
            a, b = line.rstrip('\n').split('=', 1); d[int(a)] = b
    return d

def slug(s):
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')

# ---------------------------------------------------------------- colours (as convert_content.py)
def _hsl24to16(h, s, l):
    if l > 243: s >>= 4
    elif l > 217: s >>= 3
    elif l > 192: s >>= 2
    elif l > 179: s >>= 1
    return (((h & 0xff) >> 2) << 10) + ((s >> 5) << 7) + (l >> 1)
def _rgbToHsl(r, g, b):
    mn = min(r, g, b); mx = max(r, g, b); h = 0.0; s = 0.0; l = (mn + mx) / 2.0
    if mn != mx:
        s = (mx - mn) / (mx + mn) if l < 0.5 else (mx - mn) / (2.0 - mx - mn)
        if r == mx: h = (g - b) / (mx - mn)
        elif g == mx: h = (b - r) / (mx - mn) + 2.0
        else: h = (r - g) / (mx - mn) + 4.0
    h /= 6.0
    return _hsl24to16(int(h * 256.0), max(0, min(255, int(s * 256.0))), max(0, min(255, int(l * 256.0))))
REV = {}
for _rgb in range(32768):
    REV.setdefault(_rgbToHsl(((_rgb >> 10) & 31) / 31.0, ((_rgb >> 5) & 31) / 31.0, (_rgb & 31) / 31.0), _rgb)

def recol_lines(pairs):
    out = []
    for k, (s_, d_) in enumerate(pairs):
        if s_ not in REV or d_ not in REV:
            raise SystemExit(f'colour {s_}/{d_} has no rgb15')
        out += [f'recol{k + 1}s={REV[s_]}', f'recol{k + 1}d={REV[d_]}']
    return out


class Porter:
    PACKS = ('model', 'seq', 'npc', 'obj', 'spotanim', 'anim', 'animset', 'base', 'loc', 'varbit', 'flo')

    def __init__(self, cache_dir, model_dir):
        self.c = Cache(cache_dir)
        self.P = {n: readpack(n) for n in self.PACKS}
        self.NEXT = {n: max(self.P[n]) + 1 for n in self.P}
        self.ADDED = {n: [] for n in self.P}
        self.model_dir = model_dir
        os.makedirs(model_dir, exist_ok=True)
        names = pickle.load(open(W + '/names.pkl', 'rb'))
        self.seqname = dict(names['seq'])
        self.newmodels = dict(names['model'])
        self.npcname = dict(names['npc'])
        self.objname = dict(names['obj'])
        self.SEQF = self.c.files(2, 12)
        self.frameid = {}
        self.groups_done = {}
        self.seq_out = []
        self.anim_dir = model_dir

    def newid(self, pack, name):
        if name in self.P[pack].values():
            raise SystemExit(f'{pack} {name} already exists')
        i = self.NEXT[pack]; self.NEXT[pack] += 1
        self.P[pack][i] = name; self.ADDED[pack].append((i, name))
        return i

    def write_model(self, mid, name):
        """a new model file for 468 model mid (name without .ob2)"""
        self.newid('model', name)
        open(f'{self.model_dir}/{name}.ob2', 'wb').write(Cache.decompress(self.c.raw(7, mid)))
        self.newmodels[mid] = name
        return name

    # ------------------------------------------------------------ animations
    @staticmethod
    def _base377(d451):
        r = R(d451); n = r.g1()
        types = [r.g1() for _ in range(n)]
        counts = [r.g1() for _ in range(n)]
        out = bytearray([n]) + bytes(types)
        for k in counts:
            out.append(k); out += bytes(r.g1() for _ in range(k))
        if r.p != len(d451):
            raise SystemExit('base not fully read')
        return bytes(out)

    def _group(self, g):
        if g in self.groups_done:
            return
        files = self.c.files(0, g)
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
            fid = self.newid('anim', f'anim_{self.NEXT["anim"]}')
            self.frameid[(g, f)] = fid
            head += struct.pack('>HB', fid, n)
            t1 += flags; t2 += values; dl.append(1)
        bdata = self._base377(list(self.c.files(1, base).values())[0])
        gid = self.newid('animset', f'anim_{self.NEXT["animset"]}')
        self.newid('base', f'base_{self.NEXT["base"]}')
        blob = bytes(head + t1 + t2 + dl + bdata) + struct.pack('>HHHH', len(head) - 2, len(t1), len(t2), len(dl))
        open(f'{self.anim_dir}/anim_{gid}.anim', 'wb').write(blob)
        self.groups_done[g] = gid

    def seq(self, sid):
        """our name for a 468 seq id; new ones are converted with their frames"""
        if sid is None or sid == 65535:
            return None
        if sid < ORIG['seq']:
            return self.P['seq'][sid]
        if sid in self.seqname:
            return self.seqname[sid]
        o = decode_seq(self.SEQF[sid])
        name = f'ft2_seq_{sid}'
        self.seqname[sid] = name
        self.newid('seq', name)
        lines = [f'[{name}]']
        for k, (fr, dly) in enumerate(zip(o['frames'], o['delays'])):
            self._group(fr >> 16)
            lines.append(f'frame{k + 1}=anim_{self.frameid[(fr >> 16, fr & 0xffff)]}')
            lines.append(f'delay{k + 1}={dly}')
        for k, fr in enumerate(o.get('iframes', [])):
            self._group(fr >> 16)
            lines.append(f'iframe{k + 1}=anim_{self.frameid[(fr >> 16, fr & 0xffff)]}')
        if 'replayoff' in o: lines.append(f"loops={o['replayoff']}")
        if 'walkmerge' in o: lines.append('walkmerge=' + ','.join(f'label_{x}' for x in o['walkmerge']))
        if 'priority' in o: lines.append(f"priority={o['priority']}")
        if 'replaycount' in o: lines.append(f"maxloops={o['replaycount']}")
        for key in ('righthand', 'lefthand'):
            if key in o:
                raise SystemExit(f'seq {sid} holds items: not handled here')
        for key in ('preanim_move', 'postanim_move'):
            if key in o:
                names = ['delaymove', 'delayanim', 'merge'] if key == 'preanim_move' else ['delaymove', 'abortanim', 'merge']
                lines.append(f"{key}={names[o[key]]}")
        self.seq_out.append('\n'.join(lines))
        return name

    def save_packs(self):
        for pack in self.ADDED:
            if self.ADDED[pack]:
                with open(f'{E}/content/pack/{pack}.pack', 'a') as f:
                    for i, n in self.ADDED[pack]:
                        f.write(f'{i}={n}\n')
        names = {'npc': self.npcname, 'obj': self.objname, 'seq': self.seqname, 'model': self.newmodels}
        pickle.dump(names, open(W + '/names.pkl', 'wb'))
