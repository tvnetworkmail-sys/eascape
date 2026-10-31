# EASCape: fairy rings that landed you on ground our July 2006 map can't walk on. The August 2007
# map opened up land the 2006 one blocks (flag 1 on the tile): the islands south of Witchaven
# (AIR), south-west of Mort Myre (BIP) and south of Isafdar (DLR), the Piscatoris Hunter area
# (AKQ), the Polar Hunter area (DKS) and around the Tower of Life (DJP). For those map squares,
# every level-0 tile the 2007 map has walkable loses its block flag here; nothing else changes
# (no terrain or scenery is brought over). Your call, 31 Oct 2026.
# Usage: ring_walkable.py <cache468 flat dir> <keys.json>   (re-running changes nothing more)
import os, sys, re
W = os.path.dirname(os.path.abspath(__file__)); E = os.path.abspath(W + '/../..')
sys.path.insert(0, W); sys.path.insert(0, W + '/../warriors_guild')
from maps468 import Maps468
m = Maps468(sys.argv[1], sys.argv[2])
SQUARES = {'AIR': (42, 50), 'BIP': (53, 51), 'DLR': (34, 48), 'AKQ': (36, 56), 'DKS': (42, 58), 'DJP': (41, 50)}
for code, (mx, mz) in SQUARES.items():
    t = m.terrain(mx, mz)
    path = f'{E}/content/maps/m{mx}_{mz}.jm2'
    text = open(path).read()
    head, rest = text.split('==== LOC ====', 1)
    out = []; n = 0
    for line in head.split('\n'):
        mm = re.match(r'^0 (\d+) (\d+): ?(.*)$', line)
        if mm:
            x, z, tok = int(mm[1]), int(mm[2]), mm[3].split()
            v = t.get((0, x, z))
            if v is not None and not ((v.get('f') or 0) & 1):
                for i, k in enumerate(tok):
                    if re.fullmatch(r'f\d+', k) and int(k[1:]) & 1:
                        f = int(k[1:]) & ~1
                        if f: tok[i] = f'f{f}'
                        else: tok.pop(i)
                        n += 1
                        line = f'0 {x} {z}: ' + ' '.join(tok) if tok else f'0 {x} {z}:'
                        break
        out.append(line)
    open(path, 'w').write('\n'.join(out) + '==== LOC ====' + rest)
    print(code, f'm{mx}_{mz}', n, 'tiles opened')
