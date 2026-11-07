# Forgettable Tale...: lays the three cart puzzles' railways over the chasm (m29_77, level 1) and
# writes the rides along them.
#
# The facts: the cache's map has no track over the chasm, only the five straights by the cart
# (1861-1865,4957; the 2005 cache and the 2008 one both); the OSRS wiki: "A short cutscene shows the
# vastness of the area, along with tracks floating out in all directions", and the third chasm has
# "even more tracks" (the player's line). The cache's track locs are one square each: the straight
# (keldagrim_trackstraight_gdecor, running east-west at angle 0), a quarter turn of four squares
# (keldagrim_track_curve_a..d: in from the west, out to the north) and a split of six squares
# (keldagrim_track_tjunction_a..d2: in from the west, out to the north and to the south). The
# track maps are the cache's puzzle screens (ft_tracks.rs2: a green stone takes the upper way, a
# yellow the lower).
#
# Ours: where on the chasm each track runs. Each junction goes on a grid (the screen's map, the
# first junction two squares east of the cart, the rows 6 or 7 squares apart, 9/8/6 squares between
# columns in the first/second/third chasm); the ways between them are found square by square
# (A*) with the cache's pieces, and where two ways meet one split is laid the other way round.
# An end of the track (the boxes, the top, the exit, the dead ends) may sit up to 3 squares above or
# below its place on the screen's map, and has a buffer; a box's end has its island to itself (the
# box a ride puts there stands north of the end, the cart back west of it).
#
# The islands (ours where they are; the user's OSRS pictures show the boxes on rock islands, while
# the 2005 cache has no island loc and neither its map nor the 2008 one has islands): a 5x5 rock
# patch round each box's end (box 1, box 2, the top), built the way this map square builds its own
# raised rock (level 2, 1904-1908,4984-4988: dwarf_cavewall_top on the inner squares, cave walls
# that fade down on the border, straight on the sides and diagonal at the corners, one level below
# the top). Here they stand on level 0, so their top is level 1's floor, where the track runs.
#
# The supports (keldagrim_track_supports..6; ours where they go): one under each track square off
# the islands, the piece matching the track piece's rails (straight: supports; the quarter turn's
# a/b/c/d: supports2/3/5/4; the split's c/d/d2: supports5/4/6). Their models reach from 240 above
# their square to 432 below, i.e. from level 0 up to the track on level 1, so they too stand on
# level 0.
#
# Both are shown to you alone (each chasm's differ), on level 0: ft_tunnel.rs2 has you stand there a
# moment as you arrive (a loc can be shown only on the level the player is on). The chasm's level-1
# floor is the cache's invisible_occ, under which the client draws nothing; this also makes it
# ft_chasm_invisible (ours: the same, not occluding) in content/maps/m29_77.jm2.
#
# Writes content/scripts/quests/quest_forgettable_tale/scripts/ft_chasm.rs2 and the chasm's floor
# in content/maps/m29_77.jm2 (rerunning gives the same).
# Usage: chasm.py [--png DIR]   (python3 -I; --png draws each chasm's layout for checking)
import os, re, sys, heapq
E = os.path.abspath(os.path.dirname(os.path.abspath(__file__)) + '/../..')
OUT = E + '/content/scripts/quests/quest_forgettable_tale/scripts/'
MAP = E + '/content/maps/m29_77.jm2'

# ---------------------------------------------------------------- the track maps (ft_tracks.rs2)
src = open(OUT + 'ft_tracks.rs2').read()
JN = {}; EDGES = {}
for k, x, z in re.findall(r'case (\d+) : return\((-?\d+), (-?\d+)\);', src.split('[proc,ft_edge]')[0]):
    k = int(k); JN.setdefault(k // 100, {})[k % 100] = (int(x), int(z))
for k, t, x, z in re.findall(r'case (\d+) : return\(([\^\w]+), (-?\d+), (-?\d+)\);', src.split('[proc,ft_edge]')[1]):
    k = int(k); EDGES.setdefault(k // 1000, {})[((k // 10) % 100, k % 10)] = (t, int(x), int(z))

# ---------------------------------------------------------------- the chasm's squares (level 1)
# the chasm: the cache's invisible floor (o42), or ours (o175) once this has run
CHASM_FLO = 175
free = set()
for line in open(MAP):
    if line.startswith('==== LOC'): break
    m = re.match(r'1 (\d+) (\d+): (.*)', line)
    if m and int(m.group(1)) >= 9 and 'f5' in m.group(3).split() and ('o42' in m.group(3).split() or f'o{CHASM_FLO}' in m.group(3).split()):
        free.add((int(m.group(1)), int(m.group(2))))
CHASM = set(free)
# keep a square clear of the chasm's edge and of the platform (x <= 9)
free = {(x, z) for (x, z) in free if x >= 10 and all((x + dx, z + dz) in free for dx in (-1, 0, 1) for dz in (-1, 0, 1))}

DIRS = {'E': (1, 0), 'N': (0, 1), 'W': (-1, 0), 'S': (0, -1)}
LEFT = {'E': 'N', 'N': 'W', 'W': 'S', 'S': 'E'}
RIGHT = {v: k for k, v in LEFT.items()}
ROT = {'E': 0, 'S': 1, 'W': 2, 'N': 3}   # a loc's angle turns it clockwise
STRAIGHT = 'keldagrim_trackstraight_gdecor'
CURVE = {'a': 'keldagrim_track_curve_a', 'b': 'keldagrim_track_curve_b', 'c': 'keldagrim_track_curve_c', 'd': 'keldagrim_track_curve_d'}
BUFFER = 'keldagrim_trackbuffer'
CART = (8, 29); J1X = 10; ROW = {3: 21, 2: 14, 1: 7, 0: 0, -1: -6, -2: -13, -3: -19}; COL = {1: 9, 2: 8, 3: 6}
def add(p, d, n=1): return (p[0] + d[0] * n, p[1] + d[1] * n)
BOXES = ('^ft_box1', '^ft_box2', '^ft_top')
def island(e):
    # the 5x5 rock patch round a box's end square
    return {(e[0] + dx, e[1] + dz) for dx in range(-2, 3) for dz in range(-2, 3)}
def island_locs(e):
    # as the map's own raised rock (1904-1908,4984-4988): (square, loc, shape, angle)
    x0, z0 = e[0] - 2, e[1] - 2; out = []
    for x in range(x0, x0 + 5):
        for z in range(z0, z0 + 5):
            w, s_, n_, e_ = x == x0, z == z0, z == z0 + 4, x == x0 + 4
            if s_ and w: out.append(((x, z), 'dwarf_cavewall_fade_down', 'wall_diagonal', 3))
            elif s_ and e_: out.append(((x, z), 'dwarf_cavewall_fade_down', 'wall_diagonal', 2))
            elif n_ and e_: out.append(((x, z), 'dwarf_cavewall_fade_down', 'wall_diagonal', 1))
            elif n_ and w: out.append(((x, z), 'dwarf_cavewall_fade_down', 'wall_diagonal', 0))
            elif w: out.append(((x, z), 'dwarf_cavewall_fade_down', 'wall_straight', 0))
            elif e_: out.append(((x, z), 'dwarf_cavewall_fade_down', 'wall_straight', 2))
            elif s_: out.append(((x, z), 'dwarf_cavewall_fade_down', 'wall_straight', 3))
            elif n_: out.append(((x, z), 'dwarf_cavewall_fade_down', 'wall_straight', 1))
            else: out.append(((x, z), 'dwarf_cavewall_top', 'centrepiece_straight', 2))
    return out
SUPPORT = {STRAIGHT: 'keldagrim_track_supports', CURVE['a']: 'keldagrim_track_supports2',
           CURVE['b']: 'keldagrim_track_supports3', CURVE['c']: 'keldagrim_track_supports5',
           CURVE['d']: 'keldagrim_track_supports4', 'J': 'keldagrim_track_supports',
           'keldagrim_track_tjunction_a': 'keldagrim_track_supports',
           'keldagrim_track_tjunction_c': 'keldagrim_track_supports5',
           'keldagrim_track_tjunction_d': 'keldagrim_track_supports4',
           'keldagrim_track_tjunction_d2': 'keldagrim_track_supports6', BUFFER: 'keldagrim_track_supports'}

def bend_pieces(p, h, turn):
    # the quarter turn entered at p heading h: (square, piece, angle) and the exit square, heading
    f = DIRS[h]; nh = LEFT[h] if turn == 'L' else RIGHT[h]; s = DIRS[nh]
    if turn == 'L':
        r = ROT[h]; ps = [(p, 'a'), (add(p, f), 'b'), (add(p, s), 'c'), (add(add(p, f), s), 'd')]
    else:  # a left turn ridden backwards
        g = {'E': 'W', 'W': 'E', 'N': 'S', 'S': 'N'}[nh]; r = ROT[g]
        ps = [(p, 'd'), (add(p, f), 'b'), (add(p, s), 'c'), (add(add(p, f), s), 'a')]
    return [(q, CURVE[k], r) for q, k in ps], add(add(p, f), s), nh

def split_pieces(p):
    # a split heading east, entered at p (its tjunction_a square)
    x, z = p
    return [((x, z), 'J', 0), ((x + 1, z), 'keldagrim_track_tjunction_b', 0), ((x, z + 1), 'keldagrim_track_tjunction_c', 0),
            ((x + 1, z + 1), 'keldagrim_track_tjunction_d', 0), ((x, z - 1), 'keldagrim_track_tjunction_c', 3),
            ((x + 1, z - 1), 'keldagrim_track_tjunction_d2', 0)]

def merge_pieces(o):
    # a split laid the other way round: in from the north and the south at x-1, out east from o
    x, z = o
    return [((x, z), 'keldagrim_track_tjunction_a', 2), ((x - 1, z), 'keldagrim_track_tjunction_b', 2),
            ((x, z - 1), 'keldagrim_track_tjunction_c', 2), ((x - 1, z - 1), 'keldagrim_track_tjunction_d', 2),
            ((x, z + 1), 'keldagrim_track_tjunction_c', 1), ((x - 1, z + 1), 'keldagrim_track_tjunction_d2', 2)]

def route(start, goals, used, near, extra=None):
    # A*: start and goals are (square, heading); a move lays a straight or a quarter turn; extra is
    # what ending at a goal costs on top
    extra = extra or {}
    def hcost(st): return min(abs(st[0][0] - g[0][0]) + abs(st[0][1] - g[0][1]) for g in goals)
    import itertools
    tick = itertools.count()
    openl = [(hcost(start), 0, next(tick), start, None)]; seen = {}
    while openl:
        _, g, _, st, prev = heapq.heappop(openl)
        if st[0] == 'DONE':
            st = st[1]; path = []; cur = st
            while seen[cur] is not None:
                pst, move = seen[cur]; path.append(move); cur = pst
            return path[::-1], st
        if st in seen: continue
        seen[st] = prev
        if st in goals:
            heapq.heappush(openl, (g + extra.get(st, 0), g + extra.get(st, 0), next(tick), ('DONE', st), None))
            continue
        p, h = st
        moves = [(('S', [(p, STRAIGHT, ROT[h] & 1)]), (add(p, DIRS[h]), h), 1.0)]
        for t in ('L', 'R'):
            ps, ex, nh = bend_pieces(p, h, t)
            moves.append(((t, ps), (add(ex, DIRS[nh]), nh), 5.0))
        mine = set(); cur = st  # the squares this way has laid so far (it may not cross itself)
        while seen[cur] is not None:
            pst, move = seen[cur]; mine.update(q for q, _, _ in move[1]); cur = pst
        for (kind, ps), nst, c in moves:
            sq = [q for q, _, _ in ps]
            if any(q not in free or q in used or q in mine for q in sq): continue
            if nst[0] in used and nst not in goals: continue
            c += sum(1.5 for q in sq if q in near)
            heapq.heappush(openl, (g + c + hcost(nst), g + c, next(tick), nst, (st, (kind, ps))))
    return None, None

def layout(room, okey):
    jn = JN[room]; edges = EDGES[room]; col = COL[room]
    xmin = jn[1][0]
    def X(mx): return J1X + (mx - xmin) // 96 * col
    def Z(mz): return CART[1] + ROW[mz // 96]
    pieces = {}; used = set()
    def lay(ps):
        for q, n, r in ps:
            assert q not in pieces, (room, q, n, pieces.get(q))
            pieces[q] = (n, r); used.add(q)
    # the targets: a junction, or an end (one end per place on the screen's map)
    targets = {}
    for (j, d), (t, mx, mz) in sorted(edges.items()):
        key = ('J', int(t)) if t.isdigit() else (t, mx, mz)
        targets.setdefault(key, []).append((j, d))
    node = {}
    for j, (mx, mz) in jn.items(): node[('J', j)] = (X(mx), Z(mz))
    for key, ins in targets.items():
        if key[0] == 'J': continue
        t, mx, mz = key
        x, z = X(mx), Z(mz)
        if len(ins) == 2:  # two ways in: the end goes halfway between where they come from
            zs = sorted(Z(jn[j][1]) for j, _ in ins); z = (zs[0] + zs[1]) // 2
        node[key] = (x, z)
    # where two ways meet: the merge's out square (east of it the track runs straight on). When the
    # two come from junctions one above the other, the upper one's lower way and the lower one's
    # upper way meet head on, so the merge is right there between them.
    merge_at = {}; direct = set()
    for key, ins in targets.items():
        if len(ins) != 2: continue
        x, z = node[key]
        (ja, da), (jb, db) = ins
        (ax, az), (bx, bz) = node[('J', ja)], node[('J', jb)]
        if ax == bx and {(da, az > bz), (db, bz > az)} == {(2, True), (1, False)}:
            zm = (az + bz) // 2
            merge_at[key] = (ax + 2, zm); direct |= {(ja, da), (jb, db)}
            if key[0] != 'J': node[key] = (x, zm)
        else:
            merge_at[key] = (x - 1, z)
    # reserve the junctions, the ends (and their merges)
    reserved = set(); ends_own = {}
    for key, (x, z) in node.items():
        if key[0] == 'J':
            reserved |= {q for q, _, _ in split_pieces((x, z))} | {(x + 1, z + 2), (x + 1, z - 2)}
        else:
            ends_own[key] = island((x, z)) if key[0] in BOXES else {(x, z), (x + 1, z)}
            reserved |= ends_own[key]
        if key in merge_at:
            mo = merge_at[key]
            reserved |= {q for q, _, _ in merge_pieces(mo)} | {(xx, z) for xx in range(mo[0] + 1, x)}
    exit_key = next(k for k in node if k[0] == '^ft_exit')
    routes = {}
    order = sorted(edges, key=lambda e: okey(node[('J', e[0])], e))
    for (j, d) in order:
        t, mx, mz = edges[(j, d)]
        key = ('J', int(t)) if t.isdigit() else (t, mx, mz)
        sx, sz = node[('J', j)]
        start = ((sx + 1, sz + 2), 'N') if d == 1 else ((sx + 1, sz - 2), 'S')
        tx, tz = node[key]
        ins = targets[key]
        if (j, d) in direct:
            # straight down (or up) the column into the merge
            mo = merge_at[key]; inp = (mo[0] - 1, mo[1] + 1) if d == 2 else (mo[0] - 1, mo[1] - 1)
            step = -1 if d == 2 else 1; path = []
            for zz in range(start[0][1], inp[1], step):
                path.append(('S', [((inp[0], zz), STRAIGHT, 1)]))
            for kind, ps in path: lay(ps)
            routes[(j, d)] = (path, key, (inp, start[1])); continue
        if len(ins) == 2:
            # the upper way comes in from the north, the lower from the south
            other = [e for e in ins if e != (j, d)][0]
            mine_z = Z(jn[j][1]); other_z = Z(jn[other[0]][1])
            upper = mine_z > other_z or (mine_z == other_z and d == 1)
            mx_, mz_ = merge_at[key]
            goal = ((mx_ - 1, mz_ + 1), 'S') if upper else ((mx_ - 1, mz_ - 1), 'N')
            goals = [goal]
        elif key[0] == 'J':
            goals = [((tx, tz), 'E')]
        else:
            # an end may move up or down a little from where the screen's map puts it
            goals = []; extra = {}
            for dz in (0, 1, -1, 2, -2, 3, -3):
                ez = tz + dz; sqs = [(tx, ez), (tx + 1, ez)]
                if key[0] in BOXES: sqs = list(island((tx, ez)))
                if all(q in free and q not in used and (q not in reserved or q in ends_own[key]) for q in sqs):
                    goals.append(((tx, ez), 'E')); extra[((tx, ez), 'E')] = 4 * abs(dz)
        near = set()
        for q in used | (reserved - {g[0] for g in goals}):
            for dx in (-1, 0, 1):
                for dz in (-1, 0, 1): near.add((q[0] + dx, q[1] + dz))
        blocked = used | (reserved - {g[0] for g in goals} - {start[0]} - ends_own.get(key, set()))
        path, got = route(start, goals, blocked, near, extra if key[0] != 'J' and len(ins) == 1 else None) if goals else (None, None)
        if path is None: raise RuntimeError(f'room {room}: no way for junction {j} {"green" if d == 1 else "yellow"} to {key}')
        for kind, ps in path: lay(ps)
        if key[0] != 'J' and len(ins) == 1:
            node[key] = got[0]
            reserved -= ends_own[key]
            ends_own[key] = island(got[0]) if key[0] in BOXES else {got[0], add(got[0], (1, 0))}
            reserved |= ends_own[key]
        routes[(j, d)] = (path, key, got)
    # now the junctions, merges and ends themselves
    for key, (x, z) in node.items():
        if key[0] == 'J':
            lay(split_pieces((x, z)))
        else:
            lay([((x, z), STRAIGHT, 0), ((x + 1, z), BUFFER, 1)])
        if key in merge_at:
            mo = merge_at[key]; lay(merge_pieces(mo))
            lay([((xx, z), STRAIGHT, 0) for xx in range(mo[0] + 1, x)])
    # the cart's squares along each way: from the junction's square to the next node's
    rides = {}
    for (j, d), (path, key, goal) in routes.items():
        sx, sz = node[('J', j)]
        sq = [(sx, sz), (sx + 1, sz + 1 if d == 1 else sz - 1)]
        for kind, ps in path:
            if kind == 'S': sq.append(ps[0][0])
            else:
                sq.append(ps[0][0]); sq.append(ps[3][0])
        tx, tz = node[key]
        if goal[0] != (tx, tz):
            mo = merge_at[key]
            if goal[0] != sq[-1]: sq.append(goal[0])
            sq += [(xx, tz) for xx in range(mo[0], tx)]
        sq.append((tx, tz))
        # check: one square at a time, on the track
        for a, b in zip(sq, sq[1:]):
            assert max(abs(a[0] - b[0]), abs(a[1] - b[1])) == 1, (room, j, d, a, b)
        for q in sq: assert q in pieces, (room, j, d, q)
        way = [sq[0]]; step = None
        for a, b in zip(sq, sq[1:]):
            s = (b[0] - a[0], b[1] - a[1])
            if s != step and step is not None: way.append(a)
            step = s
        way.append(sq[-1])
        rides[(j, d)] = way[1:]
    # nothing but the box's own track on its island
    for key in node:
        if key[0] in BOXES:
            own = {q for (path, k2, g) in routes.values() if k2 == key for kind, ps in path for q, _, _ in ps}
            for q in island(node[key]):
                if q in pieces and q[1] != node[key][1] and q not in own:
                    raise RuntimeError(f'room {room}: track on the island of {key}')
    return pieces, node, rides, exit_key

def coord(q): return f'1_29_77_{q[0]}_{q[1]}'

L = ["// EASCape: generated by tools/forgettable_tale/chasm.py. The railways over the three chasms and",
     "// the cart's way along them. Ours: the layout (the cache's map has no track over the chasm; the",
     "// track maps are ft_tracks.rs2's, laid with the cache's track pieces; chasm.py says how).", ""]
allp = {}; alln = {}; allr = {}
for room in (1, 2, 3):
    # the ways are laid one at a time; try a few orders until every way fits
    ORDERS = [lambda n, e: (n[0], e), lambda n, e: (n[0], n[1], e[1]), lambda n, e: (n[0], -n[1], e[1]),
              lambda n, e: (n[0], e[1], n[1]), lambda n, e: (n[0], -e[1], -n[1])]
    errs = []
    for okey in ORDERS:
        try:
            p, n, r, ek = layout(room, okey); break
        except RuntimeError as err:
            errs.append(str(err))
    else:
        raise SystemExit(f'room {room}: no layout ({"; ".join(errs)})')
    allp[room] = p; alln[room] = n; allr[room] = r
SUPPORTS = {}
for room in (1, 2, 3):
    isles = {e: island(e) for key, e in alln[room].items() if key[0] in BOXES}
    on_isle = set().union(*isles.values()) if isles else set()
    sup = [(q, SUPPORT[nm], 'centrepiece_straight', r if nm not in ('J', BUFFER) else 0)
           for q, (nm, r) in allp[room].items() if q not in on_isle and nm in SUPPORT]
    for e in isles: sup += island_locs(e)
    SUPPORTS[room] = sorted(sup)

# the chasm's floor: the cache's invisible_occ (o42) becomes ft_chasm_invisible (o175)
lines = open(MAP).read().split('\n'); changed = False
for i, line in enumerate(lines):
    if line.startswith('==== LOC'): break
    m = re.match(r'1 (\d+) (\d+): (.*)', line)
    if m and (int(m.group(1)), int(m.group(2))) in CHASM and 'o42' in m.group(3).split():
        lines[i] = line.replace(' o42 ', f' o{CHASM_FLO} ').replace(': o42 ', f': o{CHASM_FLO} '); changed = True
if changed: open(MAP, 'w').write('\n'.join(lines))
# the pieces, a room's in one list (the junctions' own squares are drawn by ft_junction_loc)
L += ['// how many track pieces a chasm has', '[proc,ft_track_count](int $room)(int)', 'switch_int ($room) {']
for room in (1, 2, 3): L.append(f'    case {room} : return({len(allp[room])});')
L += ['}', 'return(0);', '', '// a chasm\'s track piece $i (0 up): its square, loc, angle and shape',
      '[proc,ft_track_piece](int $room, int $i)(coord, loc, int, locshape)', 'switch_int (calc($room * 1000 + $i)) {']
for room in (1, 2, 3):
    for i, (q, (nm, r)) in enumerate(sorted(allp[room].items())):
        if nm == 'J':
            nm = 'keldagrim_track_tjunction_a'
        shape = 'centrepiece_straight' if nm == BUFFER else 'grounddecor'
        L.append(f'    case {room * 1000 + i} : return({coord(q)}, {nm}, {r}, {shape});')
L += ['}', 'return(null, null, 0, grounddecor);', '',
      '// how many supports and island pieces a chasm has (on level 0, under the track)',
      '[proc,ft_support_count](int $room)(int)', 'switch_int ($room) {']
for room in (1, 2, 3): L.append(f'    case {room} : return({len(SUPPORTS[room])});')
L += ['}', 'return(0);', '', "// a chasm's track support $i (0 up): its square (level 0), loc, angle and shape",
      '[proc,ft_support_piece](int $room, int $i)(coord, loc, int, locshape)', 'switch_int (calc($room * 1000 + $i)) {']
for room in (1, 2, 3):
    for i, (q, nm, shp, r) in enumerate(SUPPORTS[room]):
        L.append(f'    case {room * 1000 + i} : return(0_29_77_{q[0]}_{q[1]}, {nm}, {r}, {shp});')
L += ['}', 'return(null, null, 0, centrepiece_straight);', '',
      "// a junction's square (its tjunction_a piece)", '[proc,ft_junction_square](int $room, int $j)(coord)',
      'switch_int (calc($room * 100 + $j)) {']
for room in (1, 2, 3):
    for key, q in sorted(alln[room].items(), key=lambda kv: str(kv[0])):
        if key[0] == 'J': L.append(f'    case {room * 100 + key[1]} : return({coord(q)});')
L += ['}', 'return(null);', '',
      "// the cart's way from junction $j by the way a $dir stone sets: the squares where it turns, in",
      "// order (null after the last), the last one the next junction's square or the end of the track",
      '[proc,ft_ride_way](int $room, int $j, int $dir, int $k)(coord)',
      'switch_int (calc($room * 10000 + $j * 100 + $dir * 20 + $k)) {']
for room in (1, 2, 3):
    for (j, d), way in sorted(allr[room].items()):
        assert len(way) < 20
        for k, q in enumerate(way):
            L.append(f'    case {room * 10000 + j * 100 + d * 20 + k} : return({coord(q)});')
L += ['}', 'return(null);']
open(OUT + 'ft_chasm.rs2', 'w').write('\n'.join(L) + '\n')
print({room: len(allp[room]) for room in allp})

if '--png' in sys.argv:
    import struct, zlib
    d = sys.argv[sys.argv.index('--png') + 1]
    for room in (1, 2, 3):
        T = 12; W = 64 * T; img = [[(20, 20, 20)] * W for _ in range(W)]
        def fill(q, c, m=1):
            for yy in range((63 - q[1]) * T + m, (64 - q[1]) * T - m):
                for xx in range(q[0] * T + m, (q[0] + 1) * T - m): img[yy][xx] = c
        for q in free: fill(q, (45, 45, 60), 0)
        for q, (nm, r) in allp[room].items():
            c = (200, 200, 200) if nm == STRAIGHT else (220, 140, 40) if 'curve' in nm else (60, 200, 60) if nm in ('J',) or 'tjunction' in nm else (200, 50, 50)
            fill(q, c)
        for (j, dd), way in allr[room].items():
            for q in way: fill(q, (40, 120, 255), 4)
        fill(CART, (255, 255, 0))
        raw = b''.join(b'\0' + bytes(v for px in rr for v in px) for rr in img)
        def chunk(t, dt): return struct.pack('>I', len(dt)) + t + dt + struct.pack('>I', zlib.crc32(t + dt) & 0xffffffff)
        open(f'{d}/room{room}.png', 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', W, W, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))
