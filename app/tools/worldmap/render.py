#!/usr/bin/env python3
"""Renders LostLite's world map from Lost City's revision 274 map data.

The map is drawn the way the 2004 client draws its minimap (4 pixels per tile): blended
underlay colours, overlay shapes, walls (doors in red), map scenery sprites. The colour
pipeline is ported from Lost City's Client-TS (MIT licence): ClientBuild (underlay
blending, getTable/getUCol/getOCol), FloType (HSL), Pix3D (colour table, texture average),
World.render2DGround (overlay shapes) and Client.minimapBuildBuffer / drawDetail (walls,
map scenery, map functions).

Usage: render.py <Content repo checkout (274 branch)> <output dir>
Output: <out>/<level>/<regionX>_<regionZ>.png (256 x 256, one per 64 x 64 region), plus
index.json (regions per level), icons.json (map functions) and labels.json (place names).
"""
import json
import math
import os
import re
import sys

import numpy as np
from PIL import Image

PX = 4  # pixels per tile, as the minimap
LEVELS = 4

# ---------------------------------------------------------------- colours (Client-TS)


def gamma_correct(rgb, gamma):
    r = ((rgb >> 16) & 0xff) / 256.0
    g = ((rgb >> 8) & 0xff) / 256.0
    b = (rgb & 0xff) / 256.0
    return (int(r ** gamma * 256.0) << 16) + (int(g ** gamma * 256.0) << 8) + int(b ** gamma * 256.0)


def colour_table(brightness=0.8):
    table = [0] * 65536
    offset = 0
    for y in range(512):
        hue = (y // 8) / 64.0 + 0.0078125
        sat = (y & 0x7) / 8.0 + 0.0625
        for x in range(128):
            light = x / 128.0
            r = g = b = light
            if sat != 0.0:
                q = light * (sat + 1.0) if light < 0.5 else light + sat - light * sat
                p = light * 2.0 - q
                t = hue + 1.0 / 3.0
                if t > 1.0:
                    t -= 1
                d11 = hue - 1.0 / 3.0
                if d11 < 0.0:
                    d11 += 1

                def ch(tt):
                    if tt * 6.0 < 1.0:
                        return p + (q - p) * 6.0 * tt
                    if tt * 2.0 < 1.0:
                        return q
                    if tt * 3.0 < 2.0:
                        return p + (q - p) * (2.0 / 3.0 - tt) * 6.0
                    return p
                r, g, b = ch(t), ch(hue), ch(d11)
            rgb = (int(r * 256.0) << 16) + (int(g * 256.0) << 8) + int(b * 256.0)
            table[offset] = gamma_correct(rgb, brightness)
            offset += 1
    return table


def get_table(hue, sat, light):
    if light > 179:
        sat //= 2
    if light > 192:
        sat //= 2
    if light > 217:
        sat //= 2
    if light > 243:
        sat //= 2
    return ((hue // 4) << 10) + ((sat // 32) << 7) + (light // 2)


def get_ucol(hsl, light):
    light = (light * (hsl & 0x7f)) // 128
    light = max(2, min(126, light))
    return (hsl & 0xff80) + light


get_ocol = get_ucol  # same for real colours (the -1/-2 cases are handled by the caller)


class Flo:
    def __init__(self, name):
        self.name = name
        self.colour = 0
        self.texture = -1
        self.overlay = False
        self.hue = self.sat = self.light = 0
        self.chroma = 0
        self.underlay_hue = 0
        self.overlay_hsl = 0

    def set_colour(self, rgb):
        self.colour = rgb
        red = ((rgb >> 16) & 0xff) / 256.0
        green = ((rgb >> 8) & 0xff) / 256.0
        blue = (rgb & 0xff) / 256.0
        mn = min(red, green, blue)
        mx = max(red, green, blue)
        h = s = 0.0
        l = (mn + mx) / 2.0
        if mn != mx:
            s = (mx - mn) / (mx + mn) if l < 0.5 else (mx - mn) / (2.0 - mx - mn)
            if red == mx:
                h = (green - blue) / (mx - mn)
            elif green == mx:
                h = (blue - red) / (mx - mn) + 2.0
            else:
                h = (red - green) / (mx - mn) + 4.0
        h /= 6.0
        self.hue = int(h * 256.0)
        self.sat = max(0, min(255, int(s * 256.0)))
        self.light = max(0, min(255, int(l * 256.0)))
        self.chroma = max(1, int(((1.0 - l) if l > 0.5 else l) * s * 512.0))
        self.underlay_hue = int(h * self.chroma)
        # The client adds a little random variation here; the map uses the plain colour.
        self.overlay_hsl = get_table(max(0, min(255, self.hue)), self.sat, self.light)


# ---------------------------------------------------------------- data loading


def read_pack(path):
    ids = {}
    with open(path) as f:
        for line in f:
            m = re.match(r'(\d+)=(\S+)', line.strip())
            if m:
                ids[m.group(2)] = int(m.group(1))
    return ids


def read_configs(root, ext):
    """[name] blocks with key=value lines from every *.ext file."""
    out = {}
    for dirpath, _, files in os.walk(os.path.join(root, 'scripts')):
        for fn in files:
            if not fn.endswith(ext):
                continue
            cur = None
            with open(os.path.join(dirpath, fn), encoding='utf-8', errors='replace') as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('[') and line.endswith(']'):
                        cur = out.setdefault(line[1:-1], {})
                    elif cur is not None and '=' in line and not line.startswith('//'):
                        k, v = line.split('=', 1)
                        cur.setdefault(k, v)
                        if re.match(r'op\d$', k):
                            cur['_op'] = True
    return out


def texture_averages(root):
    ids = read_pack(os.path.join(root, 'pack', 'texture.pack'))
    av = {}
    for name, tid in ids.items():
        p = os.path.join(root, 'textures', name + '.png')
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert('RGBA')
        colours = set()
        for r, g, b, a in list(im.getdata()):
            if a == 0 or (r, g, b) == (255, 0, 255):
                continue
            colours.add((r << 16) | (g << 8) | b)
        if not colours:
            continue
        pal = [gamma_correct(c, 0.8) for c in colours]
        r = sum((c >> 16) & 0xff for c in pal) // len(pal)
        g = sum((c >> 8) & 0xff for c in pal) // len(pal)
        b = sum(c & 0xff for c in pal) // len(pal)
        rgb = gamma_correct((r << 16) | (g << 8) | b, 1.4)
        av[tid] = rgb or 1
    return av


def load_maps(root):
    """{(level, worldX, worldZ): [underlay, overlay, shape, rotation, flags]} and locs."""
    tiles = {}
    locs = []
    regions = set()
    mapdir = os.path.join(root, 'maps')
    for fn in sorted(os.listdir(mapdir)):
        m = re.match(r'm(\d+)_(\d+)\.jm2$', fn)
        if not m:
            continue
        rx, rz = int(m.group(1)), int(m.group(2))
        regions.add((rx, rz))
        section = None
        with open(os.path.join(mapdir, fn)) as f:
            for line in f:
                line = line.strip()
                if line.startswith('===='):
                    section = line.strip('= ').upper()
                    continue
                if not line or ':' not in line:
                    continue
                head, rest = line.split(':', 1)
                parts = head.split()
                if len(parts) != 3:
                    continue
                level, lx, lz = (int(v) for v in parts)
                wx, wz = rx * 64 + lx, rz * 64 + lz
                if section == 'MAP':
                    t = [0, 0, 0, 0, 0]
                    for tok in rest.split():
                        if tok[0] == 'u':
                            t[0] = int(tok[1:])
                        elif tok[0] == 'o':
                            o = tok[1:].split(';')
                            t[1] = int(o[0])
                            if len(o) > 1:
                                t[2] = int(o[1])
                            if len(o) > 2:
                                t[3] = int(o[2])
                        elif tok[0] == 'f':
                            t[4] = int(tok[1:])
                    tiles[(level, wx, wz)] = t
                elif section == 'LOC':
                    v = rest.split()
                    loc_id = int(v[0])
                    shape = int(v[1]) if len(v) > 1 else 10
                    rot = int(v[2]) if len(v) > 2 else 0
                    locs.append((level, wx, wz, loc_id, shape, rot))
    return tiles, locs, regions


# ---------------------------------------------------------------- rendering (World / Client)

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

# Loc shapes
WALL_STRAIGHT, WALL_DIAGONALCORNER, WALL_L, WALL_SQUARECORNER, WALL_DIAGONAL = 0, 1, 2, 3, 9
CENTREPIECE_STRAIGHT, CENTREPIECE_DIAGONAL, GROUND_DECOR = 10, 11, 22
WEST, NORTH, EAST, SOUTH = 0, 1, 2, 3


def sprite_cells(path, w, h):
    im = Image.open(path).convert('RGBA')
    cols = im.size[0] // w
    rows = im.size[1] // h
    cells = []
    for r in range(rows):
        for c in range(cols):
            cell = im.crop((c * w, r * h, c * w + w, r * h + h))
            px = cell.load()
            for y in range(h):
                for x in range(w):
                    rr, gg, bb, a = px[x, y]
                    if (rr, gg, bb) == (255, 0, 255) or a == 0:
                        px[x, y] = (0, 0, 0, 0)
            cells.append(cell)
    return cells


def main(root, out):
    flo_ids = read_pack(os.path.join(root, 'pack', 'flo.pack'))
    flo_defs = read_configs(root, '.flo')
    flos = {}
    for name, fid in flo_ids.items():
        d = flo_defs.get(name, {})
        f = Flo(name)
        if 'colour' in d:
            f.set_colour(int(d['colour'], 16))
        if 'texture' in d:
            f.texture = d['texture']
        f.overlay = d.get('overlay') == 'yes'
        flos[fid] = f
    tex_ids = read_pack(os.path.join(root, 'pack', 'texture.pack'))
    tex_avg = texture_averages(root)
    for f in flos.values():
        if isinstance(f.texture, str):
            f.texture = tex_ids.get(f.texture, -1)

    loc_ids = read_pack(os.path.join(root, 'pack', 'loc.pack'))
    loc_defs = read_configs(root, '.loc')
    locinfo = {}
    for name, lid in loc_ids.items():
        d = loc_defs.get(name, {})
        locinfo[lid] = {
            'width': int(d.get('width', 1)),
            'length': int(d.get('length', 1)),
            'mapscene': int(d.get('mapscene', -1)),
            'mapfunction': int(d.get('mapfunction', -1)),
            'active': d.get('active') == 'yes' or (d.get('active') != 'no' and d.get('_op', False)),
            'model': 'model' in d,
        }

    table = np.array(colour_table(0.8), np.uint32)
    tiles, locs, regions = load_maps(root)
    print(f'{len(regions)} regions, {len(tiles)} tiles, {len(locs)} locs')

    # Per-region grids [level][x][z]: underlay, overlay, shape, rotation, flags.
    grids = {r: np.zeros((5, LEVELS, 64, 64), np.int32) for r in regions}
    for (level, wx, wz), t in tiles.items():
        g = grids[(wx >> 6, wz >> 6)]
        for k in range(5):
            g[k, level, wx & 63, wz & 63] = t[k]
    # Bridges: where level 1 is flagged "link below", every level moves down one there
    # (World.pushDown), so the bridge deck is what level 0 shows. The flags stay put.
    for g in grids.values():
        link = (g[4, 1] & 0x2) != 0
        if link.any():
            for k in range(4):
                for lv in range(LEVELS - 1):
                    g[k, lv][link] = g[k, lv + 1][link]
                g[k, LEVELS - 1][link] = 0
    placed = {}
    for (level, wx, wz, lid, shape, rot) in locs:
        g = grids[(wx >> 6, wz >> 6)]
        lv = level - 1 if (g[4, 1, wx & 63, wz & 63] & 0x2) else level
        if lv < 0:
            continue
        placed.setdefault((wx >> 6, wz >> 6), []).append((lv, wx & 63, wz & 63, lid, shape, rot))

    # Floor lookup tables (index = flo id + 1, 0 = none)
    maxflo = max(flos) + 2
    hue_t = np.zeros(maxflo, np.int64)
    sat_t = np.zeros(maxflo, np.int64)
    lig_t = np.zeros(maxflo, np.int64)
    com_t = np.zeros(maxflo, np.int64)
    over_t = np.zeros(maxflo, np.uint32)
    for fid, f in flos.items():
        hue_t[fid + 1] = f.underlay_hue
        sat_t[fid + 1] = f.sat
        lig_t[fid + 1] = f.light
        com_t[fid + 1] = f.chroma
        if f.texture >= 0:
            over_t[fid + 1] = tex_avg.get(f.texture, 0)
        elif f.colour == 0xff00ff:
            over_t[fid + 1] = 0
        else:
            over_t[fid + 1] = table[get_ucol(f.overlay_hsl, 96)]

    # 4x4 coverage masks for every (shape, rotation): masks[shape*4+rot][yy][xx]
    masks = np.zeros((13 * 4, 4, 4), bool)
    for sh in range(13):
        for rot in range(4):
            for k in range(16):
                masks[sh * 4 + rot, k // 4, k % 4] = MINIMAP_SHAPE[sh][MINIMAP_ROTATE[rot][k]] != 0

    def padded(rx, rz, k, lv):
        """64x64 grid with a 5-tile border from the neighbouring regions (74 x 74)."""
        out = np.zeros((74, 74), np.int64)
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                g = grids.get((rx + dx, rz + dz))
                if g is None:
                    continue
                sx0, sx1 = (59, 64) if dx < 0 else (0, 64) if dx == 0 else (0, 5)
                sz0, sz1 = (59, 64) if dz < 0 else (0, 64) if dz == 0 else (0, 5)
                tx = {-1: 0, 0: 5, 1: 69}[dx]
                tz = {-1: 0, 0: 5, 1: 69}[dz]
                out[tx:tx + sx1 - sx0, tz:tz + sz1 - sz0] = g[k, lv, sx0:sx1, sz0:sz1]
        return out

    def window_sum(a):
        """Sum over x-4..x+5, z-4..z+5 (the client's blend window) for the inner 64x64."""
        c = np.pad(a.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
        # inner tile i is at padded index i+5; window [i+1, i+10] in padded coords
        i0 = np.arange(64) + 1
        i1 = np.arange(64) + 11
        return c[np.ix_(i1, i1)] - c[np.ix_(i0, i1)] - c[np.ix_(i1, i0)] + c[np.ix_(i0, i0)]

    def ground(rx, rz, lv):
        """RGB per pixel (256 x 256, row = north to south), 0 = nothing."""
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
        under = np.zeros((64, 64), np.uint32)
        ok = (t1 > 0) & (tot > 0) & (com > 0)
        h = np.where(ok, hue * 256 // np.maximum(com, 1), 0) & 0xff
        sv = np.where(ok, sat // np.maximum(tot, 1), 0)
        lv_ = np.where(ok, lig // np.maximum(tot, 1), 0)
        # get_table with the saturation halving for light colours
        sv = np.where(lv_ > 179, sv // 2, sv)
        sv = np.where(lv_ > 192, sv // 2, sv)
        sv = np.where(lv_ > 217, sv // 2, sv)
        sv = np.where(lv_ > 243, sv // 2, sv)
        hsl = ((h // 4) << 10) + ((sv // 32) << 7) + (lv_ // 2)
        light = np.clip((96 * (hsl & 0x7f)) // 128, 2, 126)
        under = np.where(ok, table[(hsl & 0xff80) + light], 0).astype(np.uint32)
        over = over_t[t2]
        shape = np.where(t2 > 0, g[2, lv] + 1, 0)
        rot = g[3, lv] & 3
        m = masks[np.clip(shape, 0, 12) * 4 + rot]  # (64, 64, 4, 4)
        px = np.where(m, over[..., None, None], under[..., None, None])
        px[(t1 == 0) & (t2 == 0)] = 0
        # (x, z, yy, xx) -> image rows (63 - z) * 4 + yy, cols x * 4 + xx
        img = px.transpose(1, 2, 0, 3)[::-1].reshape(256, 256)
        return img, g[4, lv]

    sprites_dir = os.path.join(root, 'sprites')
    mapscene = sprite_cells(os.path.join(sprites_dir, 'mapscene.png'), 8, 8)
    index = {str(lv): [] for lv in range(LEVELS)}
    icons = []

    for (rx, rz) in sorted(regions):
        imgs = [ground(rx, rz, lv) for lv in range(LEVELS)]
        for lv in range(LEVELS):
            img, flags = imgs[lv]
            # Minimap rule: tiles drawn only in high detail or seen from the level above are
            # skipped, and tiles of the level above that are "seen below" are drawn here.
            skip = (flags & (0x8 | 0x10)) != 0
            skip_px = np.repeat(np.repeat(skip.T[::-1], 4, 0), 4, 1)
            img = np.where(skip_px, 0, img)
            if lv < LEVELS - 1:
                up, upflags = imgs[lv + 1]
                vis = (upflags & 0x8) != 0
                vis_px = np.repeat(np.repeat(vis.T[::-1], 4, 0), 4, 1)
                img = np.where(vis_px & (up != 0), up, img)
            rgba = np.zeros((256, 256, 4), np.uint8)
            rgba[..., 0] = (img >> 16) & 0xff
            rgba[..., 1] = (img >> 8) & 0xff
            rgba[..., 2] = img & 0xff
            rgba[..., 3] = np.where(img != 0, 255, 0)
            canvas = Image.fromarray(rgba, 'RGBA').copy()
            pix = canvas.load()

            def put(x, y, rgb):
                if 0 <= x < 256 and 0 <= y < 256:
                    pix[x, y] = ((rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff, 255)

            for (llv, x, z, lid, shape, rot) in placed.get((rx, rz), []):
                if llv != lv:
                    continue
                info = locinfo.get(lid)
                if not info:
                    continue
                ox = x * PX
                oy = (63 - z) * PX
                if info['mapfunction'] >= 0 and shape == GROUND_DECOR:
                    icons.append([lv, rx * 64 + x, rz * 64 + z, info['mapfunction']])
                if info['mapscene'] >= 0:
                    if info['mapscene'] < len(mapscene) and shape in (WALL_STRAIGHT, WALL_L, WALL_SQUARECORNER, WALL_DIAGONALCORNER, WALL_DIAGONAL, CENTREPIECE_STRAIGHT, CENTREPIECE_DIAGONAL, GROUND_DECOR):
                        sp = mapscene[info['mapscene']]
                        offx = (info['width'] * 4 - sp.size[0]) // 2
                        offy = (info['length'] * 4 - sp.size[1]) // 2
                        sx = ox + offx
                        sy = (64 - z - info['length']) * PX + offy
                        if -8 < sx < 256 and -8 < sy < 256:
                            layer = Image.new('RGBA', (256, 256))
                            layer.paste(sp, (sx, sy))
                            canvas.alpha_composite(layer)
                            pix = canvas.load()
                    continue
                rgb = 0xee0000 if info['active'] else 0xeeeeee
                if shape in (WALL_STRAIGHT, WALL_L):
                    edge = {WEST: [(ox, oy + i) for i in range(4)], NORTH: [(ox + i, oy) for i in range(4)],
                            EAST: [(ox + 3, oy + i) for i in range(4)], SOUTH: [(ox + i, oy + 3) for i in range(4)]}[rot]
                    for p in edge:
                        put(*p, rgb)
                if shape == WALL_SQUARECORNER:
                    put(*{WEST: (ox, oy), NORTH: (ox + 3, oy), EAST: (ox + 3, oy + 3), SOUTH: (ox, oy + 3)}[rot], rgb)
                if shape == WALL_L:
                    edge = {SOUTH: [(ox, oy + i) for i in range(4)], WEST: [(ox + i, oy) for i in range(4)],
                            NORTH: [(ox + 3, oy + i) for i in range(4)], EAST: [(ox + i, oy + 3) for i in range(4)]}[rot]
                    for p in edge:
                        put(*p, rgb)
                if shape == WALL_DIAGONAL:
                    drgb = 0xee0000 if info['active'] else 0xeeeeee
                    if rot in (WEST, EAST):
                        for i in range(4):
                            put(ox + i, oy + 3 - i, drgb)
                    else:
                        for i in range(4):
                            put(ox + i, oy + i, drgb)
            if canvas.getbbox() is None:
                continue
            os.makedirs(os.path.join(out, str(lv)), exist_ok=True)
            q = canvas.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
            q.save(os.path.join(out, str(lv), f'{rx}_{rz}.png'), optimize=True)
            index[str(lv)].append([rx, rz])
    for lv in range(LEVELS):
        print(f'level {lv}: {len(index[str(lv)])} regions')

    labels = []
    with open(os.path.join(root, 'maps', 'labels.txt')) as f:
        for line in f:
            line = line.strip()
            if not line.startswith('='):
                continue
            parts = line[1:].split(',')
            if len(parts) < 4:
                continue
            labels.append({'text': parts[0].split('/'), 'x': int(parts[1]), 'z': int(parts[2]), 'size': int(parts[3])})

    with open(os.path.join(out, 'index.json'), 'w') as f:
        json.dump({'pxPerTile': PX, 'regionSize': 64, 'levels': index}, f)
    with open(os.path.join(out, 'icons.json'), 'w') as f:
        json.dump(icons, f)
    with open(os.path.join(out, 'labels.json'), 'w') as f:
        json.dump(labels, f)
    # Map function icons as a sprite sheet for the viewer (15 x 15 cells).
    sheet = Image.open(os.path.join(sprites_dir, 'mapfunction.png')).convert('RGBA')
    px = sheet.load()
    for y in range(sheet.size[1]):
        for x in range(sheet.size[0]):
            if px[x, y][:3] == (255, 0, 255):
                px[x, y] = (0, 0, 0, 0)
    sheet.save(os.path.join(out, 'mapfunction.png'))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
