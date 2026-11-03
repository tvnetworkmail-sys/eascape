# EASCape: the Rogues' Den maze's ways over its pendulums, floor blades, wall saws and wall blades,
# worked out from the map: each stands behind server-side invisible walls (inviswall_serverside);
# a wall with another wall right behind it in the same line is jumped (two squares), a single wall
# is hopped (one square). Writes content/scripts/areas/area_roguesden/configs/roguesden_cross.dbrow.
# Usage: python3 -I tools/roguesden/crossings.py   (from the repo root; run once, or after a map change)
import os, sys, collections
R = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
P = {}
for l in open(R + '/content/pack/loc.pack'):
    if '=' in l:
        a, b = l.strip().split('=', 1); P[int(a)] = b
D = {}; cur = None
for l in open(R + '/content/scripts/_unpack/377/all.loc'):
    l = l.strip()
    if l.startswith('['): cur = l[1:-1]; D[cur] = {}
    elif '=' in l and cur: k, v = l.split('=', 1); D[cur][k] = v
locs = []
for m in ['m46_78','m46_79','m47_77','m47_78','m47_79']:
    mx, mz = map(int, m[1:].split('_'))
    sec = None
    for line in open(f'{R}/content/maps/{m}.jm2'):
        if line.startswith('===='): sec = line.split()[1]; continue
        if sec != 'LOC' or not line.strip(): continue
        a, b = line.split(':'); lv, x, z = map(int, a.split()); p = b.split()
        if lv != 1: continue
        locs.append((mx*64+x, mz*64+z, P[int(p[0])], int(p[1]), int(p[2]) if len(p) > 2 else 0))
SIDE = {0: (-1, 0), 1: (0, 1), 2: (1, 0), 3: (0, -1)}
edges = set()
for x, z, n, sh, a in locs:
    if n != 'inviswall_serverside': continue
    sides = [a] if sh == 0 else ([a, (a + 1) % 4] if sh == 2 else [])
    for s in sides:
        dx, dz = SIDE[s]
        t, t2 = (x, z), (x + dx, z + dz)
        edges.add((t, t2)); edges.add((t2, t))
KINDS = {'roguesden_trap_floor_pendulum': 'pendulum', 'roguesden_trap_floor_timedblade': 'blade',
         'roguesden_trap_wall_saw': 'saw', 'roguesden_trap_wall_scytheblade': 'wallblade',
         'roguesden_trap_floor_scytheblade': 'pedestal'}
obst = []
for x, z, n, sh, a in locs:
    if n in KINDS:
        d = D[n]; w = int(d.get('width', 1)); l = int(d.get('length', 1))
        sx, sz = (l, w) if a in (1, 3) else (w, l)
        obst.append((KINDS[n], x, z, sx, sz, a))
def owner(tiles):
    best = None
    for k, x, z, sx, sz, a in obst:
        for (tx, tz) in tiles:
            if x <= tx < x + sx and z <= tz < z + sz:
                if best is None or (k != 'pedestal' and best[0] == 'pedestal'): best = (k, x, z)
    return best
out = []
seen = set()
for (t, t2) in sorted(edges):
    d = (t2[0] - t[0], t2[1] - t[1])
    back = ((t[0] - d[0], t[1] - d[1]), t)
    if back in edges: continue  # t is a middle tile
    far = (t2[0] + d[0], t2[1] + d[1])
    if (t2, far) in edges:
        mid, land = t2, far
    else:
        mid, land = None, t2
    o = owner([t, t2] + ([far] if mid else []))
    if o is None or o[0] == 'pedestal': continue
    out.append((o[0], t, land, mid, o[1:]))

KN = {'pendulum': 1, 'blade': 2, 'saw': 3, 'wallblade': 4, 'pcentre': 5}
def c(t, lv=1):
    x, z = t
    return f'{lv}_{x >> 6}_{z >> 6}_{x & 63}_{z & 63}'
lines = ['// EASCape: ours, worked out from the map by tools/roguesden/crossings.py (the server-side',
         '// invisible walls round each pendulum, floor blade, wall saw and wall blade in the maze).',
         '// One row per way across: stand on "from" heading for "to" (or stop on "from") and you go over',
         '// to "to". kind: 1 pendulum (each has two walled lanes; its middle is solid ground), 2 floor',
         '// blade, 3 wall saw, 4 wall blade. obstacle: the loc.', '']
n = 0
for r in sorted(out, key=lambda r: (KN[r[0]], r[1])):
    k, frm, to, mid, ob = r
    n += 1
    lines.append(f'[roguesden_cross_{n}]')
    lines.append('table=roguesden_cross')
    lines.append(f'data=from,{c(frm)}')
    lines.append(f'data=to,{c(to if to else frm)}')
    lines.append(f'data=kind,{KN[k]}')
    lines.append(f'data=obstacle,{c(ob)}')
    lines.append('')
open(R + '/content/scripts/areas/area_roguesden/configs/roguesden_cross.dbrow', 'w').write('\n'.join(lines))
print('rows', n)
