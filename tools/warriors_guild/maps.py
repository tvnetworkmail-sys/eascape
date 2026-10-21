# Decode old-style (build 451) terrain and loc map files, and read our jm2 text maps.
import re

def decode_terrain(d):
    # returns {(level,x,z): dict(h=..., o=(id,shape,rot)|None, f=flags, u=underlay)}
    t = {}; p = 0
    for l in range(4):
        for x in range(64):
            for z in range(64):
                tile = {'h': None, 'o': None, 'f': 0, 'u': 0}
                while True:
                    op = d[p]; p += 1
                    if op == 0:
                        break
                    if op == 1:
                        tile['h'] = d[p]; p += 1
                        break
                    if op <= 49:
                        oid = d[p]; p += 1
                        tile['o'] = (oid, (op - 2) // 4, (op - 2) & 3)
                    elif op <= 81:
                        tile['f'] = op - 49
                    else:
                        tile['u'] = op - 81
                t[(l, x, z)] = tile
    return t, p

def smart(d, p):
    if d[p] < 128:
        return d[p], p + 1
    return int.from_bytes(d[p:p + 2], 'big') - 32768, p + 2

def decode_locs(d):
    out = []; p = 0; lid = -1
    while True:
        inc, p = smart(d, p)
        if inc == 0:
            break
        lid += inc; pos = 0
        while True:
            pinc, p = smart(d, p)
            if pinc == 0:
                break
            pos += pinc - 1
            info = d[p]; p += 1
            z = pos & 63; x = (pos >> 6) & 63; l = pos >> 12
            out.append((l, x, z, lid, info >> 2, info & 3))
    return out

def read_jm2(path):
    terr = {}; locs = []; npcs = []; objs = []
    sec = None; rest = []
    for line in open(path):
        line = line.rstrip('\n')
        if line.startswith('===='):
            sec = line.strip('= ').strip(); continue
        if sec == 'MAP':
            m = re.match(r'(\d) (\d+) (\d+):(.*)', line)
            if m:
                terr[(int(m[1]), int(m[2]), int(m[3]))] = m[4]
        elif sec == 'LOC':
            m = re.match(r'(\d) (\d+) (\d+): (\d+) (\d+)(?: (\d+))?', line)
            if m:
                locs.append((int(m[1]), int(m[2]), int(m[3]), int(m[4]), int(m[5]), int(m[6] or 0)))
        else:
            rest.append((sec, line))
    return terr, locs, rest
