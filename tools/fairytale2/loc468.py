# Porting 2007 (build 468) locs to our 377 content, as convert_maps.py does (its loc code, made
# reusable): a loc that decodes the same in both caches keeps its id; anything else gets a new id
# after ours, ft2_<name>_<468 id>, with its models, recolours, animation and multiloc states.
import os
from port468 import E, ORIG, slug, recol_lines
import locdef
from locdef import decode_loc
from jag import read_jag, jag_file

SUFFIX = {0: '_1', 1: '_2', 2: '_3', 3: '_4', 4: '_q', 9: '_5', 5: '_w', 6: '_r', 7: '_e', 8: '_t', 10: '_8', 11: '_9',
          22: '_0', 12: '_a', 13: '_s', 14: '_d', 15: '_f', 16: '_g', 17: '_h', 18: '_z', 19: '_x', 20: '_c', 21: '_v'}
# the 377 client loads map functions 0-69 and map scenes 0-71 (Client.load)
MAPFUNCTIONS, MAPSCENES = 70, 72

def decode_loc377(d):
    old = locdef.gstr
    def g(d, p):
        e = d.index(10, p); return d[p:e].decode('latin-1'), e + 1
    locdef.gstr = g
    try:
        return decode_loc(d)
    finally:
        locdef.gstr = old

def our_locs():
    cfg = read_jag(f'{E}/engine/data/pack/client/config')
    dat = jag_file(cfg, 'loc.dat'); idx = jag_file(cfg, 'loc.idx')
    out = {}
    n = int.from_bytes(idx[:2], 'big'); p = 2; off = 2
    for i in range(min(n, ORIG['loc'])):
        sz = int.from_bytes(idx[p:p + 2], 'big'); p += 2
        out[i] = decode_loc377(dat[off:off + sz]); off += sz
    return out

class LocPorter:
    def __init__(self, pt, model_dir, varbits):
        self.pt = pt
        self.L468 = pt.c.files(2, 6)
        self.ours = our_locs()
        self.model_dir = model_dir
        os.makedirs(model_dir, exist_ok=True)
        self.varbits = varbits          # 468 varbit id -> our varbit name
        self.name = {}; self.id = {}; self.out = []; self.dropped = []
        # locs a run before already ported keep their names (their configs are in place)
        for i, nm in pt.P['loc'].items():
            if nm.startswith('ft2_'):
                try: self.id[int(nm.rsplit('_', 1)[1])] = i; self.name[int(nm.rsplit('_', 1)[1])] = nm
                except ValueError: pass

    def same(self, i):
        if i >= ORIG['loc']:
            return False
        a = self.ours[i]; b = decode_loc(self.L468[i])
        return a.get('name') == b.get('name') and a['models'] == b['models']

    def _model(self, mid, fname):
        pt = self.pt
        if mid < ORIG['model'] and pt.P['model'].get(mid) == fname:
            return
        if fname in pt.P['model'].values():
            return
        pt.newid('model', fname)
        open(f'{self.model_dir}/{fname}.ob2', 'wb').write(pt.c.decompress(pt.c.raw(7, mid)))

    def _bases(self, i, o):
        pt = self.pt; key = o['models']
        if not key:
            return []
        olds = [pt.P['model'].get(mid) for mid, s in key if mid < ORIG['model']]
        if len(olds) == len(key):
            bs = set(); ok = True
            for (mid, s), nm in zip(key, olds):
                if not nm.endswith(SUFFIX[s]): ok = False; break
                bs.add(nm[:-len(SUFFIX[s])])
            if ok and (len(bs) == 1 or all(s == 10 for mid, s in key)):
                return sorted(bs) if all(s == 10 for mid, s in key) and len(bs) > 1 else [bs.pop()]
        if all(s == 10 for mid, s in key) and len(key) > 1:
            out = []
            for mid, s in key:
                self._model(mid, f'ft2_m{mid}_8'); out.append(f'ft2_m{mid}')
            return out
        base = f'ft2_l{i}' if len(key) > 1 else f'ft2_m{key[0][0]}'
        if len({s for mid, s in key}) != len(key):
            raise SystemExit(f'loc {i}: two models for one shape {key}')
        for mid, s in key:
            self._model(mid, base + SUFFIX[s])
        return [base]

    def ref(self, i):
        """our id for 468 loc i, porting it if needed"""
        pt = self.pt
        if i in self.id:
            return self.id[i]
        if self.same(i):
            self.id[i] = i
            return i
        o = decode_loc(self.L468[i])
        name = f"ft2_{slug(o['name'])}_{i}" if o.get('name') and o['name'] != 'null' else f'ft2_loc_{i}'
        self.name[i] = name
        self.id[i] = pt.newid('loc', name)
        lines = [f'[{name}]']
        if o.get('name') and o['name'] != 'null': lines.append(f"name={o['name']}")
        if o.get('desc'): lines.append(f"desc={o['desc']}")
        for k, b in enumerate(self._bases(i, o)):
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
                else: self.dropped.append((i, f'{key} {o[key]}'))
        for nn, op in sorted(o['ops'].items()):
            lines.append(f'op{nn}={op}')
        if o.get('shadow') is False: lines.append('shadow=no')
        if 'forceapproach' in o:
            f = o['forceapproach']
            lines.append('forceapproach=' + next((nm for bit, nm in ((1, 'north'), (2, 'east'), (4, 'south'), (8, 'west')) if f & bit == 0), ''))
        if 'raiseobject' in o: lines.append(f"raiseobject={'yes' if o['raiseobject'] else 'no'}")
        lines += recol_lines(o['recol'])
        for key in ('bgsound', 'randsound', 'blockwalk1', 'hasalpha'):
            if key in o: self.dropped.append((i, key))
        if o['retex'] or o['unknown'] or 'params' in o:
            raise SystemExit(f'unhandled loc {i} {o}')
        if o.get('multi'):
            vb, vp, states = o['multi']
            if vb == 65535 or vb not in self.varbits:
                raise SystemExit(f'loc {i}: multiloc on varbit {vb}/varp {vp}')
            lines.append(f'multivar={self.varbits[vb]}')
            for st, child in enumerate(states):
                if child != 65535:
                    self.ref(child)
                    lines.append(f'multiloc={st},{self.name.get(child) or pt.P["loc"][child]}')
        self.out.append('\n'.join(lines))
        return self.id[i]
