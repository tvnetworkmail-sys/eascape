#!/usr/bin/env python3
"""EASCape: make the ore rocks the 377 cache added (the Wilderness, Lava Maze and other later
mines) mineable. They have the Mine option but no mining data, so Mine did nothing.

A rock's ore is the colour its ore patch (model colour 6342) is recoloured to, the same colours
the rocks we already mine use (copper 14596, tin 13741, iron 6242, coal 4226, mithril 6346,
adamantite 6438, runite 8721...). Its empty version is the rock of the same model and base
colour whose ore patch is the base colour or 0. Each placed rock gets the category and empty
stage of the rocks we already have for that ore, the empty one mining_rock_empty, and the rock
is added to that ore's row in mine.dbrow. Rocks whose colour isn't an ore we know are left.

Usage: rocks.py            (writes content/scripts/_unpack/377/all.loc and mine.dbrow)
"""
import re, glob, collections, os
C = os.path.join(os.path.dirname(__file__), '..', '..', 'content')
LOC = C + '/scripts/_unpack/377/all.loc'
MINE = C + '/scripts/skill_mining/configs/mine.dbrow'
OREC = {'18854': 'clay', '22025': 'clay', '14596': 'copper', '26981': 'copper', '13741': 'tin', '6242': 'iron',
        '4226': 'coal', '23108': 'gold', '31393': 'gold', '19026': 'silver', '6346': 'mithril',
        '6438': 'adamantite', '8721': 'runite', '382': 'blurite'}
TABLE = {'clay': 'clay_rock_table', 'copper': 'copper_rock_table', 'tin': 'tin_rock_table', 'iron': 'iron_rock_table',
         'coal': 'coal_rock_table', 'gold': 'gold_rock_table', 'silver': 'silver_rock_table',
         'mithril': 'mithril_rock_table', 'adamantite': 'adamantite_rock_table', 'runite': 'runite_rock_table',
         'blurite': 'blurite_rock'}
# quest and minigame rocks with their own scripts
SKIP = re.compile(r'^(dwarf_|tog_|elemental_|swamp_|newbie|misc_dummy|loc_49\d\d$)')
ORE_SRC = '6342'

s = open(LOC).read()
blocks = dict(re.findall(r'(?ms)^\[(\w+)\]\n(.*?)(?=^\[|\Z)', s))
ids = {l.split('=', 1)[1].strip(): int(l.split('=', 1)[0]) for l in open(C + '/pack/loc.pack') if '=' in l}
mine = open(MINE).read()
known = set(re.findall(r'^data=rock,(\w+)', mine, re.M))
placed = collections.Counter()
for f in glob.glob(C + '/maps/*.jm2'):
    sec = ''
    for line in open(f):
        if line.startswith('===='): sec = line; continue
        if 'LOC' in sec:
            p = line.split()
            if len(p) >= 4: placed[int(p[3])] += 1

def recols(b): return dict(re.findall(r'^recol\d+s=(\d+)\nrecol\d+d=(\d+)', b, re.M))
def model(b):
    m = re.search(r'^model=(\w+)', b, re.M); return m.group(1) if m else None

done, empties, rows = [], {}, collections.defaultdict(list)
for n, b in blocks.items():
    if 'op1=Mine' not in b or n in known or 'category=' in b or SKIP.match(n): continue
    if not placed[ids.get(n, -1)]: continue
    rc = recols(b)
    ore = OREC.get(rc.get(ORE_SRC, ''))
    if not ore: continue
    base = {k: v for k, v in rc.items() if k != ORE_SRC}
    cands = [m for m, bb in blocks.items() if m != n and model(bb) == model(b) and 'op1=Mine' in bb
             and {k: v for k, v in recols(bb).items() if k != ORE_SRC} == base
             and recols(bb).get(ORE_SRC, '0') in ('0',) + tuple(base.values())]
    cands.sort(key=lambda m: (-placed[ids.get(m, -1)], ids.get(m, 0)))
    empty = cands[0] if cands else None
    done.append((n, ore, empty))
    rows[TABLE[ore]].append(n)
    if empty: empties[empty] = True

cat_of = {'iron': 'mining_rock_fast'}
def patch(name, add):
    """add lines to the end of a loc's block"""
    global s
    m = re.search(r'(?ms)^\[' + name + r'\]\n.*?(?=^\[|\Z)', s)
    body = m.group(0).rstrip('\n')
    s = s[:m.start()] + body + '\n// EASCape: mineable (tools/mining/rocks.py)\n' + add + s[m.start() + len(body):]

for n, ore, empty in done:
    add = f'category={cat_of.get(ore, "mining_rock_normal")}'
    add += f'\nparam=next_loc_stage_mining,{empty or "rocks1"}'
    patch(n, add)
for e in empties:
    if 'category=' not in blocks[e]:
        patch(e, 'category=mining_rock_normal\nparam=mining_rock_empty,1')
open(LOC, 'w').write(s)
for t, names in rows.items():
    i = mine.index(f'[{t}]')
    j = mine.index('data=ore_name', i)
    mine = mine[:j] + ''.join(f'data=rock,{x}\n' for x in names) + mine[j:]
open(MINE, 'w').write(mine)
for d in done: print(*d)
print(len(done), 'rocks,', len(empties), 'empty rocks')
