# Fairytale II, step 4: what the quest changes in Zanaris and who is in the hideout.
#   - Fairy Nuff's room: the 2007 map has it 3 squares west and 2 north of ours (the same room,
#     moved); we keep ours and put the 2007 multilocs in it at the same places in the room (its
#     shelves, workbenches and certificate, which the cache breaks from stage 20 on, and the
#     broken certificate on the floor, fairynuff_cert_taken 1). Our benches keep their facing.
#   - the rune temple sign by the Cosmic Altar ruins (2007 map, 2409,4369).
#   - NPCs: Fairy Nuff in her room becomes the cache's multinpc (gone once Fairytale II starts,
#     fairy2_nuffvisible); the fairies the 2007 cache makes multinpcs (gone as the Godfather's
#     orks come) and the two orks, at 2009Scape's places (npc_spawns.json, the 2007 cache's ids);
#     Fairy Fixit by the fairy ring (2009Scape). The hideout's people: the 2007 cache's multinpcs
#     (by stage), at Void's places (fairy_hq.npc-spawns.toml, its 2011 hideout) moved 75 east and
#     1 south, which puts Void's Fairy Nuff and Fairy Queen where RuneLite's Quest Helper has them on
#     the 2007 map (2355,4455 and 2354,4455) to a square.
# Usage: zanaris_ft2.py <cache468 flat dir>   (run once; README.md)
import os, sys, re
W = os.path.dirname(os.path.abspath(__file__)); E = os.path.abspath(W + '/../..')
sys.path.insert(0, W); sys.path.insert(0, W + '/../warriors_guild')
from port468 import Porter
from loc468 import LocPorter
from maps import read_jm2

pt = Porter(sys.argv[1], f'{E}/content/models/fairytale2')
lp = LocPorter(pt, f'{E}/content/models/loc/fairytale2',
               {2326: 'fairy2_queencure_quest', 2327: 'fairynuff_cert_taken'})
NPC = {v: k for k, v in pt.P['npc'].items()}

# (2007 x, y, loc, shape, rot) -> ours at (x + 3, y - 2), replacing what's there on that layer
GROTTO = [(2389, 4471, 16211, 4, 2), (2386, 4474, 16212, 10, None), (2387, 4474, 16214, 10, None),
          (2384, 4471, 16216, 10, 3), (2385, 4470, 16218, 10, 2), (2389, 4470, 16218, 10, 1),
          (2385, 4474, 16220, 4, 1), (2384, 4473, 16222, 4, 0), (2389, 4472, 16222, 4, 2),
          (2389, 4471, 16315, 10, 2)]
SIGN = (2409, 4369, 16307, 4, 3)

def layer(shape):
    return 0 if shape <= 3 or shape == 9 else (1 if shape <= 8 else (2 if shape <= 21 else 3))

def write_jm2(path, terr, locs, rest, npcs=None):
    lines = ['==== MAP ====']
    for lv in range(4):
        for x in range(64):
            for z in range(64):
                v = terr.get((lv, x, z), '').strip()
                if v: lines.append(f'{lv} {x} {z}: {v}')
    lines.append('==== LOC ====')
    for (lv, x, z, i, s, r) in sorted(locs, key=lambda t: (t[0], t[1], t[2])):
        lines.append(f'{lv} {x} {z}: {i} {s}' + (f' {r}' if r else ''))
    sec = None
    for (sname, line) in rest:
        if sname != sec:
            lines.append(f'==== {sname} ===='); sec = sname
        if line.strip():
            if sname == 'NPC' and npcs is not None:
                continue
            lines.append(line)
    if npcs is not None:
        if sec != 'NPC':
            lines.append('==== NPC ====')
        for (lv, x, z, i) in npcs:
            lines.append(f'{lv} {x} {z}: {i}')
    open(path, 'w').write('\n'.join(lines) + '\n')

def npcs_of(rest):
    out = []
    for sname, line in rest:
        m = re.match(r'(\d) (\d+) (\d+): (\d+)', line)
        if sname == 'NPC' and m:
            out.append(tuple(map(int, m.groups())))
    return out

# ---------------------------------------------------------------- Nuff's room and the Zanaris NPCs
p = f'{E}/content/maps/m37_69.jm2'
terr, locs, rest = read_jm2(p)
for (x, y, lid, shape, rot) in GROTTO:
    lx, lz = x + 3 - 2368, y - 2 - 4416
    here = [t for t in locs if t[0] == 0 and t[1] == lx and t[2] == lz and layer(t[4]) == layer(shape)]
    if rot is None:
        rot = here[0][5] if here else 0
    locs = [t for t in locs if t not in here]
    locs.append((0, lx, lz, lp.ref(lid), shape, rot))
npcs = npcs_of(rest)
def swap(x, y, old, new):
    global npcs
    k = (0, x - 2368, y - 4416, NPC[old])
    if k not in npcs:
        raise SystemExit(f'no {old} at {x},{y}')
    npcs[npcs.index(k)] = (0, x - 2368, y - 4416, NPC[new])
swap(2391, 4468, 'fairy_nuff', 'ft2_multi_4431')
for x, y in ((2377, 4450), (2381, 4459), (2388, 4425), (2394, 4440), (2418, 4447), (2427, 4461)):
    swap(x, y, 'fairy', 'ft2_multi_4422')
swap(2423, 4461, 'fairy', 'ft2_multi_4423')
for x, y, n in ((2387, 4456, 'ft2_multi_4423'), (2396, 4455, 'ft2_multi_4424'), (2398, 4453, 'ft2_multi_4425'),
                (2410, 4434, 'ft2_fairy_fixit')):
    npcs.append((0, x - 2368, y - 4416, NPC[n]))
write_jm2(p, terr, locs, rest, npcs)

# ---------------------------------------------------------------- the sign
p = f'{E}/content/maps/m37_68.jm2'
terr, locs, rest = read_jm2(p)
x, y, lid, shape, rot = SIGN
locs.append((0, x - 2368, y - 4352, lp.ref(lid), shape, rot))
write_jm2(p, terr, locs, rest)

# ---------------------------------------------------------------- the hideout's people
p = f'{E}/content/maps/m36_69.jm2'
terr, locs, rest = read_jm2(p)
npcs = npcs_of(rest)
for (lx, lz, n) in ((52, 39, 'ft2_multi_4432'), (50, 29, 'ft2_multi_4435'), (49, 40, 'ft2_multi_4436'), (46, 18, 'ft2_multi_4453'), (45, 16, 'ft2_multi_4454'), (30, 33, 'ft2_multi_4426'), (42, 15, 'ft2_multi_4426'), (44, 27, 'ft2_multi_4426'), (37, 36, 'ft2_multi_4427'), (54, 34, 'ft2_multi_4427'), (43, 33, 'ft2_multi_4428'), (51, 22, 'ft2_multi_4428'), (30, 40, 'ft2_multi_4429'), (54, 20, 'ft2_multi_4429'), (31, 35, 'ft2_multi_4430'), (40, 25, 'ft2_multi_4430')):
    npcs.append((0, lx, lz, NPC[n]))
write_jm2(p, terr, locs, rest, npcs)

d = f'{E}/content/scripts/quests/quest_fairy2/configs'
hdr = ("// EASCape: Fairytale II's scenery in Zanaris from the August 2007 cache (build 468, OpenRS2\n"
       "// 633), converted by tools/fairytale2/zanaris_ft2.py; 468 ids in the names.\n\n")
open(f'{d}/fairy2.loc', 'w').write(hdr + '\n\n'.join(lp.out) + '\n')
pt.save_packs()
print(len(lp.out), 'locs', 'left out:', lp.dropped)
