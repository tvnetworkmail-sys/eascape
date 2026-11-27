#!/usr/bin/env python3
# Builds app/src/plugins/timetracking/data.js: RuneLite's Time Tracking farming tables (Produce,
# PatchImplementation.forVarbitValue, FarmingWorld) trimmed to Sept 2007 and mapped to the 2007 patches.
#   python3 gen.py <runelite-src>
# - Produce: the crops our server grows (content/scripts/skill_farming/configs/farming_crops.constant), weeds,
#   the scarecrow and the compost bin's contents (no ultracompost, no big bin: later); item ids are RuneLite's
#   gameval ItemID constants (the same ids in the 2007 cache).
# - PatchImplementation: the patch kinds of 2007 (no hespori, anima, coral, seaweed, grapes, hardwood, redwood,
#   celastrus, crystal tree, big compost bin); each forVarbitValue is RuneLite's code with the branches of
#   later produce left out.
# - FarmingWorld: OSRS sends a region's patches on region-relative varbits (FARMING_TRANSMIT_A..N); the 2007
#   client has one global varbit per patch (700-748, 780-783). Each of our server's patch locs is found in the
#   maps (content/maps), and matched to the RuneLite region holding that square with a patch of the same kind
#   (two of a kind in one region, as the allotments: in transmit-letter order against our varbit order).
#   RuneLite regions with no 2007 patch are left out.
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
CONTENT = os.path.join(os.path.dirname(REPO), 'content')
rl = sys.argv[1]
TT = os.path.join(rl, 'runelite-client/src/main/java/net/runelite/client/plugins/timetracking/farming/')

item_ids = {}
for m in re.finditer(r'public static final int (\w+) = (\d+);', open(os.path.join(rl, 'runelite-api/src/main/java/net/runelite/api/gameval/ItemID.java')).read()):
    item_ids.setdefault(m.group(1), int(m.group(2)))
objs07 = {int(l.split('=')[0]) for l in open(os.path.join(CONTENT, 'pack/obj.pack')) if '=' in l}

# ---------------------------------------------------------------- Produce
crops = re.findall(r'\^farming_crop_(\w+) = (\d+)', open(os.path.join(CONTENT, 'scripts/skill_farming/configs/farming_crops.constant')).read())
CROP_TO_PRODUCE = {'redberry': 'REDBERRIES', 'cadavaberry': 'CADAVABERRIES', 'dwellberry': 'DWELLBERRIES', 'jangerberry': 'JANGERBERRIES',
                   'whiteberry': 'WHITEBERRIES', 'spirit': 'SPIRIT_TREE', 'bittercap': 'MUSHROOM', 'herb_dead': None}
KEEP = {'WEEDS', 'SCARECROW', 'GOUTWEED', 'ANYHERB', 'EMPTY_COMPOST_BIN', 'COMPOST', 'SUPERCOMPOST', 'ROTTEN_TOMATO'}
crop_produce = {}
for name, idx in crops:
    p = CROP_TO_PRODUCE.get(name, name.upper())
    if p:
        KEEP.add(p); crop_produce[int(idx)] = p

src = open(TT + 'Produce.java').read()
produce = {}
order = []
for m in re.finditer(r'^\t([A-Z_]+)\(("[^"]*")((?:, [^)]*)?)\)[,;]', src, re.M):
    key, name, rest = m.group(1), json.loads(m.group(2)), m.group(3)
    args = [a.strip() for a in rest.split(',')[1:]]
    impl = None
    if args and re.fullmatch(r'-?\d+', args[0]):
        args = args[1:]  # contract varbit value (farming contracts are later)
    if args and args[0].startswith('PatchImplementation.'):
        impl = args[0].split('.')[1]; args = args[1:]
    item = item_ids[args[0].split('.')[1]] if args[0].startswith('ItemID.') else int(args[0])
    nums = [int(a) for a in args[1:]]
    tickrate, stages = nums[0], nums[1]
    regrow, harvest = (nums[2], nums[3]) if len(nums) > 2 else (0, 1)
    if key not in KEEP:
        continue
    assert item in objs07, (key, item)
    produce[key] = {'name': name, 'impl': impl, 'itemID': item, 'tickrate': tickrate, 'stages': stages, 'regrowTickrate': regrow, 'harvestStages': harvest}
    order.append(key)
missing = KEEP - set(produce)
assert not missing, missing

# ---------------------------------------------------------------- PatchImplementation
IMPLS = ['MUSHROOM', 'ALLOTMENT', 'HERB', 'FLOWER', 'BUSH', 'FRUIT_TREE', 'HOPS', 'TREE', 'SPIRIT_TREE', 'BELLADONNA', 'CACTUS', 'CALQUAT', 'COMPOST']
src = open(TT + 'PatchImplementation.java').read()
heads = list(re.finditer(r'^\t([A-Z_]+)\(Tab\.([A-Z_]+), "([^"]*)", (true|false)\)', src, re.M))
impls = {}
dropped = {}
for i, h in enumerate(heads):
    key = h.group(1)
    body = src[h.end(): heads[i + 1].start() if i + 1 < len(heads) else len(src)]
    if key not in IMPLS:
        continue
    body = re.sub(r'//[^\n]*', '', body)
    branches = re.findall(r'if \(([^)]*)\)\s*\{\s*return (new PatchState\((.*?)\)|null);\s*\}', body, re.S)
    js = []
    for cond, ret, args in branches:
        if ret == 'null':
            js.append(f'if ({cond}) return null;'); continue
        a = [x.strip() for x in re.split(r',(?![^(]*\))', args)]
        p, cs, stage = a[0].split('.')[1], a[1].split('.')[1], a[2]
        if p not in produce:
            dropped.setdefault(key, set()).add(p); continue
        stage = re.sub(r'Produce\.(\w+)\.getStages\(\)', r'P.\1.stages', stage)
        js.append(f"if ({cond.replace('==', '===')}) return S(P.{p}, '{cs}', {stage});")
    impls[key] = {'tab': h.group(2), 'name': h.group(3), 'healthCheckRequired': h.group(4) == 'true', 'js': js}

# Herb and hops patches use the 2007 cache's own values (its multilocs, which our server sets through
# farming_states.enum): herbs from toadflax on and torstol sit elsewhere, and 2007 hops have watered states.
# Their forVarbitValue is built from that table in RuneLite's terms: weeds as RuneLite's (values 0-3), growing
# (and watered) stage as is, harvestable counting down the harvests left (RuneLite's stage), diseased / dead
# from 1, dead herbs as RuneLite's ANYHERB.
KIND_STATE = {1: 'GROWING', 2: 'GROWING', 3: 'DISEASED', 4: 'DEAD', 5: 'HARVESTABLE'}
senum, cur = {}, None
for line in open(os.path.join(CONTENT, 'scripts/skill_farming/configs/farming_states.enum')):
    mm = re.match(r'\[farming_(\w+)_decode\]', line)
    if mm: cur = mm.group(1); senum[cur] = {}; continue
    if line.startswith('['): cur = None; continue
    mm = re.match(r'val=(\d+),(-?\d+)', line)
    if mm and cur: senum[cur][int(mm.group(1))] = int(mm.group(2))
CROP_NAME = {int(i): n for n, i in crops}
for key, ename in (('HERB', 'herb'), ('HOPS', 'hops')):
    weeds = [j for j in impls[key]['js'] if 'P.WEEDS' in j and re.search(r'value >= 0 && value <= 3', j)]
    rows = []
    for v in sorted(senum[ename]):
        e = senum[ename][v]
        if e < 0 or v < 4: continue
        crop, kind, st = e // 1000, (e // 100) % 10, e % 100
        if kind == 0:
            rows.append((v, 'WEEDS', 'GROWING', 3)); continue
        name = CROP_NAME[crop]
        p = 'ANYHERB' if name == 'herb_dead' else (CROP_TO_PRODUCE.get(name) or name.upper())
        cs = KIND_STATE[kind]
        stage = produce[p]['harvestStages'] - st if cs == 'HARVESTABLE' else st
        rows.append((v, p, cs, stage))
    js = list(weeds)
    i = 0
    while i < len(rows):
        v0, p, cs, s0 = rows[i]
        j = i
        step = None
        while j + 1 < len(rows) and rows[j + 1][0] == rows[j][0] + 1 and rows[j + 1][1:3] == (p, cs):
            d_ = rows[j + 1][3] - rows[j][3]
            if step is None and d_ in (1, -1, 0): step = d_
            if d_ != step: break
            j += 1
        v1 = rows[j][0]
        cond = f'value === {v0}' if v0 == v1 else f'value >= {v0} && value <= {v1}'
        if v0 == v1 or step == 0: expr = str(s0)
        elif step == 1: expr = f'value - {v0 - s0}' if v0 - s0 > 0 else (f'value + {s0 - v0}' if s0 > v0 else 'value')
        else: expr = f'{v0 + s0} - value'
        js.append(f"if ({cond}) return S(P.{p}, '{cs}', {expr});")
        i = j + 1
    impls[key]['js'] = js

# ---------------------------------------------------------------- the 2007 patches: varbit, kind, map square
P07 = []  # (loc name, varbit, impl)
TYPES = {1: 'ALLOTMENT', 2: 'FLOWER', 3: 'HERB', 4: 'HOPS', 5: 'TREE', 6: 'FRUIT_TREE', 7: 'BUSH', 8: 'CACTUS', 9: 'BELLADONNA', 10: 'MUSHROOM', 11: 'CALQUAT', 12: 'SPIRIT_TREE'}
reg = open(os.path.join(CONTENT, 'scripts/skill_farming/scripts/farming_patches.rs2')).read()
pvar = {int(i): int(v) for i, v in re.findall(r'case (\d+) : return\(%varbit_(\d+)\);', reg)}
ploc = {}
for i, n in re.findall(r'\[oploc1,(\w+)\] ~farming_op1\((\d+)\);', reg):
    pass
for n, i in re.findall(r'\[oploc1,(\w+)\] ~farming_op1\((\d+)\);', reg):
    ploc[int(i)] = n
def ptype(i):
    if i <= 8: return 1
    if i <= 12: return 2
    if i <= 16: return 3
    if i <= 20: return 4
    if i <= 24: return 5
    if i <= 28: return 6
    if i <= 32: return 7
    if i <= 36: return i - 25
    return 12
for i in sorted(pvar):
    P07.append((ploc[i], pvar[i], TYPES[ptype(i)]))
for b in range(4):
    P07.append((f'farming_compost_bin_{b + 1}', 740 + b, 'COMPOST'))
locids = {}
for l in open(os.path.join(CONTENT, 'pack/loc.pack')):
    if '=' in l:
        k, v = l.strip().split('=', 1); locids[v] = int(k)
want = {locids[n]: n for n, _, _ in P07}
square = {}
for f in sorted(os.listdir(os.path.join(CONTENT, 'maps'))):
    m = re.fullmatch(r'm(\d+)_(\d+)\.jm2', f)
    if not m: continue
    mx, my = int(m.group(1)), int(m.group(2))
    txt = open(os.path.join(CONTENT, 'maps', f)).read()
    i = txt.find('==== LOC ====')
    if i < 0: continue
    for lm in re.finditer(r'^(\d+) (\d+) (\d+): (\d+) ', txt[i:], re.M):
        lid = int(lm.group(4))
        if lid in want and want[lid] not in square:
            square[want[lid]] = ((mx << 8) | my, (mx << 6) + int(lm.group(2)), (my << 6) + int(lm.group(3)))
for n, _, _ in P07:
    assert n in square, n

# ---------------------------------------------------------------- FarmingWorld
src = open(TT + 'FarmingWorld.java').read()
regions = []
for m in re.finditer(r'add\((?:farmingGuildRegion = )?new FarmingRegion\("([^"]+)", (\d+), (true|false),(.*?)\n\t\t\)(\s*\{.*?\n\t\t\})?(, [\d, \n\t/*A-Za-z]+)?\);', src, re.S):
    name, rid, definite, body, override, extra = m.groups()
    pats = re.findall(r'new FarmingPatch\("([^"]*)", VarbitID\.FARMING_TRANSMIT_([A-Z]), PatchImplementation\.([A-Z_]+)(?:, NpcID\.(\w+))?(?:, (\d+))?\)', body)
    ex = [int(x) for x in re.findall(r'\d+', re.sub(r'/\*.*?\*/', '', extra or ''))]
    regions.append({'name': name, 'regionID': int(rid), 'definite': definite == 'true', 'override': bool(override), 'extra': ex,
                    'patches': [{'name': pn, 'transmit': t, 'impl': im, 'farmerName': f or None, 'patchNumber': int(no) if no else -1} for pn, t, im, f, no in pats]})
assert len(regions) > 40, len(regions)

npc_ids = {}
for mm in re.finditer(r'public static final int (\w+) = (\d+);', open(os.path.join(rl, 'runelite-api/src/main/java/net/runelite/api/gameval/NpcID.java')).read()):
    npc_ids.setdefault(mm.group(1), int(mm.group(2)))

out_regions = []
used = set()
for n, varbit, impl in sorted(P07, key=lambda p: p[1]):
    rid, wx, wy = square[n]
    cands = [r for r in regions if (r['regionID'] == rid or rid in r['extra']) and any(p['impl'] == impl for p in r['patches'])]
    # the region whose own id is the square first
    cands.sort(key=lambda r: r['regionID'] != rid)
    assert cands, (n, varbit, impl, rid)
    r = cands[0]
    free = sorted([p for p in r['patches'] if p['impl'] == impl and (r['name'], r['regionID'], p['transmit']) not in used], key=lambda p: p['transmit'])
    assert free, (n, r['name'])
    p = free[0]
    used.add((r['name'], r['regionID'], p['transmit']))
    p['varbit'] = varbit
    p['loc'] = [wx, wy]
    if r not in out_regions:
        out_regions.append(r)
# the farmers (PaymentTracker): OSRS's npc ids are not the 2007 cache's, so each patch's farmer is our
# server's (quest_fairy1/fairy1_gardeners.rs2: farming_gardener_patches / farming_gardener_tree_patch)
npc07 = {}
for l in open(os.path.join(CONTENT, 'pack/npc.pack')):
    if '=' in l:
        k, v = l.strip().split('=', 1); npc07[v] = int(k)
gsrc = open(os.path.join(CONTENT, 'scripts/quests/quest_fairy1/scripts/fairy1_gardeners.rs2')).read()
farmer_of = {}
for proc in ('farming_gardener_patches', 'farming_gardener_tree_patch'):
    body = gsrc[gsrc.index(f'[proc,{proc}]'):]
    body = body[:body.index('\n}')]
    for npc, pats in re.findall(r'case (\w+) : return\(([\d, ]+)\);', body):
        for i in [int(x) for x in pats.split(',')]:
            if i > 0:
                farmer_of[pvar[i]] = npc07[npc]
for r in out_regions:
    r['patches'] = [{k: v for k, v in p.items() if k != 'transmit'} for p in r['patches'] if 'varbit' in p]
    for p in r['patches']:
        p.pop('farmerName', None)
        p['farmer'] = farmer_of.get(p['varbit'], -1)
out_regions.sort(key=lambda r: list(map(lambda x: x['name'], regions)).index(r['name']))

o = ['// Generated by app/tools/timetracking/gen.py from RuneLite\'s timetracking.farming (Produce, PatchImplementation,',
     '// FarmingWorld; BSD 2-Clause, Copyright (c) 2018 Abex and RuneLite contributors), trimmed to Sept 2007 and mapped',
     '// to the 2007 patch varbits. Do not edit.', "'use strict';", '(() => {',
     '  const P = ' + json.dumps({k: produce[k] for k in order}, separators=(',', ':')) + ';',
     '  for (const [k, v] of Object.entries(P)) v.key = k;',
     '  const S = (produce, cropState, stage) => ({ produce, cropState, stage });',
     '  const I = {}; ']
for k in IMPLS:
    im = impls[k]
    o.append(f"  I.{k} = {{ key: '{k}', tab: '{im['tab']}', name: {json.dumps(im['name'])}, healthCheckRequired: {str(im['healthCheckRequired']).lower()}, forVarbitValue(value) {{")
    o += ['    ' + j for j in im['js']]
    o.append('    return null;')
    o.append('  } };')
o.append('  for (const p of Object.values(P)) p.patchImplementation = p.impl ? I[p.impl] : null;')
o.append('  const REGIONS = ' + json.dumps(out_regions, separators=(',', ':')) + ';')
o.append('  const data = { Produce: P, PatchImplementation: I, REGIONS, PatchState: S };')
o.append("  if (typeof module !== 'undefined') module.exports = data; else window.__lostlite.timetrackingData = data;")
o.append('})();')
open(os.path.join(REPO, 'src/plugins/timetracking/data.js'), 'w').write('\n'.join(o) + '\n')
print('produce', len(produce), 'impls', len(impls), 'regions', len(out_regions), 'patches', sum(len(r['patches']) for r in out_regions))
print('dropped produce branches:', {k: sorted(v) for k, v in dropped.items()})
