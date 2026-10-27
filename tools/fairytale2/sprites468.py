# The 2007 cache's sprite groups (archive 8): palette-indexed sprites, as RuneLite's cache
# SpriteLoader reads them (BSD 2-Clause, Copyright (c) 2016-2017 Adam and RuneLite contributors).
import struct

def decode_sprites(d):
    count = struct.unpack('>H', d[-2:])[0]
    p = len(d) - 7 - count * 8
    maxw, maxh = struct.unpack('>HH', d[p:p + 4]); pal = d[p + 4] + 1; p += 5
    ox = [struct.unpack('>H', d[p + 2 * i:p + 2 * i + 2])[0] for i in range(count)]; p += 2 * count
    oy = [struct.unpack('>H', d[p + 2 * i:p + 2 * i + 2])[0] for i in range(count)]; p += 2 * count
    ws = [struct.unpack('>H', d[p + 2 * i:p + 2 * i + 2])[0] for i in range(count)]; p += 2 * count
    hs = [struct.unpack('>H', d[p + 2 * i:p + 2 * i + 2])[0] for i in range(count)]; p += 2 * count
    pp = len(d) - 7 - count * 8 - (pal - 1) * 3
    palette = [0] + [int.from_bytes(d[pp + 3 * i:pp + 3 * i + 3], 'big') for i in range(pal - 1)]
    q = 0; out = []
    for i in range(count):
        w, h = ws[i], hs[i]; n = w * h
        flags = d[q]; q += 1
        idx = [0] * n
        if flags & 1 == 0:
            for j in range(n): idx[j] = d[q + j]
        else:
            for x in range(w):
                for y in range(h): idx[x + y * w] = d[q + x * h + y]
        q += n
        alpha = None
        if flags & 2:
            alpha = [0] * n
            if flags & 1 == 0:
                for j in range(n): alpha[j] = d[q + j]
            else:
                for x in range(w):
                    for y in range(h): alpha[x + y * w] = d[q + x * h + y]
            q += n
        px = [palette[k] if k else None for k in idx]
        out.append({'w': w, 'h': h, 'ox': ox[i], 'oy': oy[i], 'px': px, 'alpha': alpha})
    return {'maxw': maxw, 'maxh': maxh, 'sprites': out}
