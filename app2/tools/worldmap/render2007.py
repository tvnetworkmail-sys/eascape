#!/usr/bin/env python3
"""Renders the world map from the September 2007 game cache (build 471) the game runs.

The map is drawn the way the 2007 client draws its minimap (4 pixels per tile), ported from
webclient/src: ClientBuild (underlay blending: FluType hue/saturation/lightness/chroma over a
10 x 10 window, getTable/getUCol/getOCol; FloType colour, texture average and mapcolour),
World.render2DGround (overlay shapes), Client.minimapBuildBuffer (the 0x18 / 0x8 level flags)
and Client.drawDetail (walls white, doors and other active walls red, diagonal walls, mapscene
sprites), plus the mapfunction icons the minimap draws for ground decor.

Usage: render2007.py [cache dir] [output dir]
  cache dir   engine/data/cache2007 (its cache/ is the game cache build.py writes: OpenRS2 236
              with our fills; keys.json the XTEA keys)
  output dir  app/src/ui/assets/worldmap
Output: <out>/<level>/<regionX>_<regionZ>.png (256 x 256, one per 64 x 64 region), index.json,
icons.json, mapfunction.png (the icon sheet, 15 x 15 cells). labels.json is kept (place names
don't move): labels on regions that don't exist are dropped and a few 2007 ones added.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'cache'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'warriors_guild'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'fairytale2'))
from js5 import Cache, name_hash  # noqa: E402
import locs as L  # noqa: E402
from locdef import decode_loc  # noqa: E402
from sprites468 import decode_sprites  # noqa: E402

try:
    import oxipng  # pip install pyoxipng: halves the pictures' size
except ImportError:
    oxipng = None

PX = 4
LEVELS = 4
BRIGHTNESS = 0.8  # the game's default ("normal") brightness

# Labels the 2006 map doesn't have: [text lines, x, z, size]
EXTRA_LABELS = [
    (['God Wars', 'Dungeon'], 2917, 3742, 0),
]


class FlatCache(Cache):
    def __init__(self, root):
        self.root = root
        self.refs = {}

    def raw(self, archive, group):
        p = os.path.join(self.root, str(archive), f'{group}.dat')
        return open(p, 'rb').read() if os.path.exists(p) else None


# ---------------------------------------------------------------- colours (Pix3D / ClientBuild)


def colour_table(brightness):
    y = np.arange(512)[:, None]
    x = np.arange(128)[None, :]
    hue = (y // 8) / 64.0 + 0.0078125
    sat = (y & 7) / 8.0 + 0.0625
    light = x / 128.0
    hue, sat, light = np.broadcast_arrays(hue, sat, light)
    q = np.where(light < 0.5, light * (sat + 1.0), light + sat - light * sat)
    p = light * 2.0 - q
    t = hue + 1.0 / 3.0
    t = np.where(t > 1.0, t - 1, t)
    d = hue - 1.0 / 3.0
    d = np.where(d < 0.0, d + 1, d)

    def ch(tt):
        return np.where(tt * 6.0 < 1.0, p + (q - p) * 6.0 * tt,
                        np.where(tt * 2.0 < 1.0, q,
                                 np.where(tt * 3.0 < 2.0, p + (q - p) * (2.0 / 3.0 - tt) * 6.0, p)))
    r, g, b = ch(t), ch(hue), ch(d)
    ri = (r ** brightness * 256.0).astype(np.int64)
    gi = (g ** brightness * 256.0).astype(np.int64)
    bi = (b ** brightness * 256.0).astype(np.int64)
    rgb = (ri << 16) + (gi << 8) + bi
    rgb = np.where(rgb == 0, 1, rgb)
    return rgb.reshape(65536).astype(np.uint32)


def flo_hsl(rgb):
    """FloType.getColour: an RGB colour as the client's 16-bit HSL."""
    g = ((rgb >> 8) & 0xff) / 256.0
    r = ((rgb >> 16) & 0xff) / 256.0
    b = (rgb & 0xff) / 256.0
    mx = max(r, g, b)
    mn = min(r, g, b)
    s = h = 0.0
    lt = (mn + mx) / 2.0
    if mn != mx:
        s = (mx - mn) / (mx + mn) if lt < 0.5 else (mx - mn) / (2.0 - mn - mx)
        if r == mx:
            h = (g - b) / (mx - mn)
        elif g == mx:
            h = (b - r) / (mx - mn) + 2.0
        else:
            h = (r - g) / (mx - mn) + 4.0
    h /= 6.0
    si = max(0, min(255, int(s * 256.0)))
    hi = int(h * 256.0)
    li = max(0, min(255, int(lt * 256.0)))
    if li > 243:
        si >>= 4
    elif li > 217:
        si >>= 3
    elif li > 192:
        si >>= 2
    elif li > 179:
        si >>= 1
    return ((si >> 5) << 7) + ((hi >> 2) << 10) + (li >> 1)


def flu(rgb):
    """FluType.getHsl: (hue, saturation, lightness, chroma) for blending."""
    r = ((rgb >> 16) & 0xff) / 256.0
    g = ((rgb >> 8) & 0xff) / 256.0
    b = (rgb & 0xff) / 256.0
    mn = min(r, g, b)
    mx = max(r, g, b)
    s = h = 0.0
    lt = (mx + mn) / 2.0
    light = int(lt * 256.0)
    if mn != mx:
        s = (mx - mn) / (mn + mx) if lt < 0.5 else (mx - mn) / (2.0 - mx - mn)
        if r == mx:
            h = (g - b) / (mx - mn)
        elif g == mx:
            h = (b - r) / (mx - mn) + 2.0
        elif b == mx:
            h = (r - g) / (mx - mn) + 4.0
    sat = max(0, min(255, int(s * 256.0)))
    h /= 6.0
    chroma = int(s * (1.0 - lt) * 512.0) if lt > 0.5 else int(s * lt * 512.0)
    chroma = max(1, chroma)
    return int(h * chroma), sat, light, chroma


def get_ocol(light, hsl):
    if hsl == -2:
        return 12345678
    if hsl == -1:
        return max(2, min(126, light))
    v = max(2, min(126, ((hsl & 0x7f) * light) >> 7))
    return (hsl & 0xff80) + v


# ---------------------------------------------------------------- cache data


def load_floors(c):
    under = {}
    for fid, d in c.files(2, 1).items():
        p = 0
        rgb = 0
        while p < len(d):
            op = d[p]
            p += 1
            if op == 0:
                break
            if op == 1:
                rgb = int.from_bytes(d[p:p + 3], 'big')
                p += 3
            elif op == 2:
                p += 2
            elif op == 3:
                p += 2
            else:
                raise ValueError(f'underlay {fid}: opcode {op}')
        under[fid] = flu(rgb)
    over = {}
    for fid, d in c.files(2, 4).items():
        p = 0
        o = {'colour': 0, 'material': -1, 'mapcolour': -1}
        while p < len(d):
            op = d[p]
            p += 1
            if op == 0:
                break
            if op == 1:
                v = int.from_bytes(d[p:p + 3], 'big')
                p += 3
                o['colour'] = -1 if v == 0xff00ff else flo_hsl(v)
            elif op == 2:
                o['material'] = d[p]
                p += 1
            elif op == 3:
                v = int.from_bytes(d[p:p + 2], 'big')
                p += 2
                o['material'] = -1 if v == 65535 else v
            elif op == 7:
                v = int.from_bytes(d[p:p + 3], 'big')
                p += 3
                o['mapcolour'] = -1 if v == 0xff00ff else flo_hsl(v)
            elif op in (5, 8, 10, 12):
                pass
            elif op in (9,):
                p += 2
            elif op in (11, 14):
                p += 1
            elif op == 13:
                p += 3
            else:
                raise ValueError(f'overlay {fid}: opcode {op}')
        over[fid] = o
    return under, over


def texture_averages(c):
    """Texture2007.averageRgb (an HSL colour) for each texture in archive 9."""
    return {tid: int.from_bytes(d[0:2], 'big') for tid, d in c.files(9, 0).items()}


def load_locs(c):
    out = {}
    for lid, d in c.files(2, 6).items():
        o = decode_loc(d)
        active = o.get('active', -1)
        if active == -1:
            active = 1 if o['models'] and o['models'][0][1] == 10 else 0
            if any(v for v in o['ops'].values()):
                active = 1
        out[lid] = {'width': o.get('width', 1), 'length': o.get('length', 1),
                    'mapscene': o.get('mapscene', -1), 'mapfunction': o.get('mapfunction', -1),
                    'active': active}
    return out


def load_sprites(c, name):
    s = decode_sprites(c.files(8, c.group_by_name(8, name))[0])
    return s


def decode_terrain(d):
    """[5][4][64][64]: underlay, overlay (ids + 1), shape, rotation, flags."""
    g = np.zeros((5, LEVELS, 64, 64), np.int32)
    p = 0
    for lv in range(LEVELS):
        for x in range(64):
            for z in range(64):
                while True:
                    op = d[p]
                    p += 1
                    if op == 0:
                        break
                    if op == 1:
                        p += 1
                        break
                    if op <= 49:
                        g[1, lv, x, z] = d[p]
                        p += 1
                        g[2, lv, x, z] = (op - 2) // 4
                        g[3, lv, x, z] = (op - 2) & 3
                    elif op <= 81:
                        g[4, lv, x, z] = op - 49
                    else:
                        g[0, lv, x, z] = (op - 81) & 0xff
    return g


def load_map(c, keys):
    names = {}
    for x in range(256):
        for z in range(256):
            names[name_hash(f'm{x}_{z}')] = ('m', x, z)
            names[name_hash(f'l{x}_{z}')] = ('l', x, z)
    groups = {}
    for gid, h in c.ref(5)['names'].items():
        if h in names:
            kind, x, z = names[h]
            groups[(kind, x, z)] = gid
    grids = {}
    locs = {}
    nolocs = []
    for (kind, x, z), gid in sorted(groups.items()):
        if kind != 'm':
            continue
        try:
            d = c.files(5, gid)[0]
        except Exception as ex:
            print('unreadable terrain', x, z, ex)
            continue
        grids[(x, z)] = decode_terrain(d)
        lg = groups.get(('l', x, z))
        got = None
        if lg is not None:
            key = keys.get(f'{x}_{z}')
            for k in ([key, None] if key else [None]):
                try:
                    got = L.decode(c.files(5, lg, k)[0])
                    break
                except Exception:
                    got = None
        if got is None:
            nolocs.append(f'{x}_{z}')
            got = []
        locs[(x, z)] = got
    return grids, locs, nolocs


# ---------------------------------------------------------------- rendering

MINIMAP_SHAPE = [
    [0] * 16,
    [1] * 16,
    [1, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1],
    [1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 1],
    [1, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1],
]
MINIMAP_ROTATE = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    [12, 8, 4, 0, 13, 9, 5, 1, 14, 10, 6, 2, 15, 11, 7, 3],
    [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
    [3, 7, 11, 15, 2, 6, 10, 14, 1, 5, 9, 13, 0, 4, 8, 12],
]

WALL_SHAPES = (0, 1, 2, 3)        # World.setWall
DECOR_SHAPES = (4, 5, 6, 7, 8)    # wall decor: not on the minimap
GROUND_DECOR = 22
WALL_WHITE = 0xeeeeee            # the client picks 228..247 at random per build: the middle
WALL_RED = 0xee0000


def main(cache_dir, out):
    c = FlatCache(os.path.join(cache_dir, 'cache'))
    keys = json.load(open(os.path.join(cache_dir, 'keys.json')))
    under, over = load_floors(c)
    tex_avg = texture_averages(c)
    locinfo = load_locs(c)
    table = colour_table(BRIGHTNESS)
    grids, rlocs, nolocs = load_map(c, keys)
    regions = set(grids)
    print(f'{len(regions)} regions, {sum(len(v) for v in rlocs.values())} locs, '
          f'{len(nolocs)} without locs')

    # Bridges (World.pushDown): where level 1 is flagged 0x2, every level moves down one. The flags stay.
    for g in grids.values():
        link = (g[4, 1] & 0x2) != 0
        if link.any():
            for k in range(4):
                for lv in range(LEVELS - 1):
                    g[k, lv][link] = g[k, lv + 1][link]
                g[k, LEVELS - 1][link] = 0
    placed = {}
    for (rx, rz), lst in rlocs.items():
        g = grids[(rx, rz)]
        for (lid, level, x, z, shape, rot) in lst:
            lv = level - 1 if (g[4, 1, x, z] & 0x2) else level
            if lv < 0:
                continue
            placed.setdefault((rx, rz), []).append((lv, x, z, lid, shape, rot))

    # Floor tables (index = id + 1, 0 = none)
    nu = max(under) + 2
    hue_t = np.zeros(nu, np.int64)
    sat_t = np.zeros(nu, np.int64)
    lig_t = np.zeros(nu, np.int64)
    com_t = np.zeros(nu, np.int64)
    for fid, (h, s, li, ch) in under.items():
        hue_t[fid + 1], sat_t[fid + 1], lig_t[fid + 1], com_t[fid + 1] = h, s, li, ch
    hue_t = np.pad(hue_t, (0, 257 - nu)) if nu < 257 else hue_t
    sat_t = np.pad(sat_t, (0, 257 - nu)) if nu < 257 else sat_t
    lig_t = np.pad(lig_t, (0, 257 - nu)) if nu < 257 else lig_t
    com_t = np.pad(com_t, (0, 257 - nu)) if nu < 257 else com_t
    over_t = np.zeros(257, np.uint32)
    for fid, o in over.items():
        mat = o['material'] if o['material'] in tex_avg else -1
        if mat >= 0:
            rgb = int(table[get_ocol(96, tex_avg[mat])])
        elif o['colour'] == -1:
            rgb = 0
        else:
            rgb = int(table[get_ocol(96, o['colour'])])
        if o['mapcolour'] >= 0:
            rgb = int(table[get_ocol(96, o['mapcolour'])])
        over_t[fid + 1] = rgb

    masks = np.zeros((13 * 4, 4, 4), bool)
    for sh in range(13):
        for rot in range(4):
            for k in range(16):
                masks[sh * 4 + rot, k // 4, k % 4] = MINIMAP_SHAPE[sh][MINIMAP_ROTATE[rot][k]] != 0

    def padded(rx, rz, k, lv):
        """64 x 64 grid with a 5-tile border from the neighbouring regions (74 x 74)."""
        o = np.zeros((74, 74), np.int64)
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                g = grids.get((rx + dx, rz + dz))
                if g is None:
                    continue
                sx0, sx1 = (59, 64) if dx < 0 else (0, 64) if dx == 0 else (0, 5)
                sz0, sz1 = (59, 64) if dz < 0 else (0, 64) if dz == 0 else (0, 5)
                tx = {-1: 0, 0: 5, 1: 69}[dx]
                tz = {-1: 0, 0: 5, 1: 69}[dz]
                o[tx:tx + sx1 - sx0, tz:tz + sz1 - sz0] = g[k, lv, sx0:sx1, sz0:sz1]
        return o

    def window_sum(a):
        """Sum over x-4..x+5, z-4..z+5 (the client's blend window) for the inner 64 x 64."""
        cs = np.pad(a.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
        i0 = np.arange(64) + 1
        i1 = np.arange(64) + 11
        return cs[np.ix_(i1, i1)] - cs[np.ix_(i0, i1)] - cs[np.ix_(i1, i0)] + cs[np.ix_(i0, i0)]

    def ground(rx, rz, lv):
        """0xRRGGBB per pixel (256 x 256, rows north to south), 0 = nothing."""
        u = padded(rx, rz, 0, lv)
        has = (u > 0).astype(np.int64)
        hue = window_sum(hue_t[u] * has)
        sat = window_sum(sat_t[u] * has)
        lig = window_sum(lig_t[u] * has)
        com = window_sum(com_t[u] * has)
        tot = window_sum(has)
        g = grids[(rx, rz)]
        t1 = g[0, lv]
        t2 = g[1, lv]
        ok = (t1 > 0) & (tot > 0) & (com > 0)
        h = np.where(ok, hue * 256 // np.maximum(com, 1), 0)
        sv = np.where(ok, sat // np.maximum(tot, 1), 0)
        li = np.where(ok, lig // np.maximum(tot, 1), 0)
        sv = np.where(li > 243, sv >> 4, np.where(li > 217, sv >> 3, np.where(li > 192, sv >> 2, np.where(li > 179, sv >> 1, sv))))
        hsl = (li >> 1) + ((h >> 2) << 10) + ((sv >> 5) << 7)
        light = np.clip((96 * (hsl & 0x7f)) >> 7, 2, 126)
        und = np.where(ok, table[((hsl & 0xff80) + light) & 0xffff], 0).astype(np.uint32)
        ov = over_t[t2]
        shape = np.where(t2 > 0, g[2, lv] + 1, 0)
        rot = g[3, lv] & 3
        m = masks[np.clip(shape, 0, 12) * 4 + rot]
        px = np.where(m, ov[..., None, None], und[..., None, None])
        px[(t1 == 0) & (t2 == 0)] = 0
        return px.transpose(1, 2, 0, 3)[::-1].reshape(256, 256)

    def tilemask(a):
        return np.repeat(np.repeat(a.T[::-1], 4, 0), 4, 1)

    # Sprites
    ms = load_sprites(c, 'mapscene')
    mapscene = []
    for s in ms['sprites']:
        a = np.zeros((s['h'], s['w'], 4), np.uint8)
        for i, v in enumerate(s['px']):
            if v is not None:
                a[i // s['w'], i % s['w']] = ((v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff, 255)
        mapscene.append((a, s['w'], s['h'], s['ox'], s['oy']))

    index = {str(lv): [] for lv in range(LEVELS)}
    icons = []
    os.makedirs(out, exist_ok=True)
    total = 0
    for (rx, rz) in sorted(regions):
        g = grids[(rx, rz)]
        flags = g[4]
        imgs = [ground(rx, rz, lv) for lv in range(LEVELS)]
        for lv in range(LEVELS):
            # Client.minimapBuildBuffer: this level's tiles unless flagged 0x18, and the level
            # above's where it is flagged 0x8 (seen from below).
            here = (flags[lv] & 0x18) == 0
            up = (flags[lv + 1] & 0x8) != 0 if lv < LEVELS - 1 else np.zeros((64, 64), bool)
            img = np.where(tilemask(here), imgs[lv], 0)
            if lv < LEVELS - 1:
                img = np.where(tilemask(up) & (imgs[lv + 1] != 0), imgs[lv + 1], img)
            rgba = np.zeros((256, 256, 4), np.uint8)
            rgba[..., 0] = (img >> 16) & 0xff
            rgba[..., 1] = (img >> 8) & 0xff
            rgba[..., 2] = img & 0xff
            rgba[..., 3] = np.where(img != 0, 255, 0)

            def put(x, y, rgb):
                if 0 <= x < 256 and 0 <= y < 256:
                    rgba[y, x] = ((rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff, 255)

            # Details from this region's locs, and mapscene sprites of neighbours that reach in.
            for dx in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    nb = (rx + dx, rz + dz)
                    ng = grids.get(nb)
                    if ng is None:
                        continue
                    for (llv, x, z, lid, shape, rot) in placed.get(nb, []):
                        # drawn on this level: own tiles not flagged 0x18, or the level above's flagged 0x8
                        if llv == lv:
                            if ng[4, lv, x, z] & 0x18:
                                continue
                        elif llv == lv + 1:
                            if not (ng[4, llv, x, z] & 0x8):
                                continue
                        else:
                            continue
                        info = locinfo.get(lid)
                        if info is None or shape in DECOR_SHAPES:
                            continue
                        own = dx == 0 and dz == 0
                        ox = (x + dx * 64) * PX
                        oy = (63 - z - dz * 64) * PX
                        if own and shape == GROUND_DECOR and info['mapfunction'] >= 0:
                            icons.append([lv, rx * 64 + x, rz * 64 + z, info['mapfunction']])
                        if info['mapscene'] >= 0:
                            if info['mapscene'] >= len(mapscene):
                                continue
                            sp, w, h, xof, yof = mapscene[info['mapscene']]
                            sx = ox + int((info['width'] * 4 - w) / 2) + xof
                            sy = (64 - z - dz * 64 - info['length']) * PX + int((info['length'] * 4 - h) / 2) + yof
                            if sx >= 256 or sy >= 256 or sx + w <= 0 or sy + h <= 0:
                                continue
                            x0, y0 = max(0, sx), max(0, sy)
                            x1, y1 = min(256, sx + w), min(256, sy + h)
                            part = sp[y0 - sy:y1 - sy, x0 - sx:x1 - sx]
                            opaque = part[..., 3] > 0
                            rgba[y0:y1, x0:x1][opaque] = part[opaque]
                            continue
                        if not own:
                            continue
                        rgb = WALL_RED if info['active'] else WALL_WHITE
                        if shape in (0, 2):
                            edge = {0: [(ox, oy + i) for i in range(4)], 1: [(ox + i, oy) for i in range(4)],
                                    2: [(ox + 3, oy + i) for i in range(4)], 3: [(ox + i, oy + 3) for i in range(4)]}[rot]
                            for p in edge:
                                put(*p, rgb)
                        if shape == 3:
                            put(*{0: (ox, oy), 1: (ox + 3, oy), 2: (ox + 3, oy + 3), 3: (ox, oy + 3)}[rot], rgb)
                        if shape == 2:
                            edge = {3: [(ox, oy + i) for i in range(4)], 0: [(ox + i, oy) for i in range(4)],
                                    1: [(ox + 3, oy + i) for i in range(4)], 2: [(ox + i, oy + 3) for i in range(4)]}[rot]
                            for p in edge:
                                put(*p, rgb)
                        if shape == 9:
                            if rot in (0, 2):
                                for i in range(4):
                                    put(ox + i, oy + 3 - i, rgb)
                            else:
                                for i in range(4):
                                    put(ox + i, oy + i, rgb)
            if not rgba[..., 3].any():
                continue
            canvas = Image.fromarray(rgba, 'RGBA')
            os.makedirs(os.path.join(out, str(lv)), exist_ok=True)
            q = canvas.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
            fn = os.path.join(out, str(lv), f'{rx}_{rz}.png')
            q.save(fn, optimize=True)
            if oxipng:
                oxipng.optimize(fn, level=4)
            total += os.path.getsize(fn)
            index[str(lv)].append([rx, rz])
    for lv in range(LEVELS):
        print(f'level {lv}: {len(index[str(lv)])} regions')
    print(f'{len(icons)} icons, {total / 1e6:.1f} MB of pictures')

    with open(os.path.join(out, 'index.json'), 'w') as f:
        json.dump({'pxPerTile': PX, 'regionSize': 64, 'levels': index}, f)
    with open(os.path.join(out, 'icons.json'), 'w') as f:
        json.dump(icons, f)

    # Place names: the 2006 ones where the 2007 map has ground, plus a few new ones.
    lp = os.path.join(out, 'labels.json')
    labels = json.load(open(lp)) if os.path.exists(lp) else []
    ground0 = {(x, z) for x, z in index['0']}
    kept = [lb for lb in labels if (lb['x'] >> 6, lb['z'] >> 6) in ground0]
    have = {' '.join(lb['text']) for lb in kept}
    for text, x, z, size in EXTRA_LABELS:
        if ' '.join(text) not in have and (x >> 6, z >> 6) in ground0:
            kept.append({'text': text, 'x': x, 'z': z, 'size': size})
    print(f'labels: {len(kept)} ({len(labels)} before)')
    with open(lp, 'w') as f:
        json.dump(kept, f)

    # Map function icons as a sheet for the viewer (15 x 15 cells, 10 per row).
    mf = load_sprites(c, 'mapfunction')
    cw, chh = mf['maxw'], mf['maxh']
    n = len(mf['sprites'])
    cols = 10
    sheet = np.zeros(((n + cols - 1) // cols * chh, cols * cw, 4), np.uint8)
    for k, s in enumerate(mf['sprites']):
        bx = (k % cols) * cw + s['ox']
        by = (k // cols) * chh + s['oy']
        for i, v in enumerate(s['px']):
            if v is not None:
                sheet[by + i // s['w'], bx + i % s['w']] = ((v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff, 255)
    Image.fromarray(sheet, 'RGBA').save(os.path.join(out, 'mapfunction.png'), optimize=True)
    if oxipng:
        oxipng.optimize(os.path.join(out, 'mapfunction.png'), level=4)
    if nolocs:
        print('no locs (no key):', ' '.join(nolocs))


if __name__ == '__main__':
    main(os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(ROOT, 'engine', 'data', 'cache2007'),
         os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(ROOT, 'app', 'src', 'ui', 'assets', 'worldmap'))
