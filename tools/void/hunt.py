#!/usr/bin/env python3
"""Gives our NPCs Void's aggression (GregHib/void, data/**/*.npcs.toml: hunt_mode, hunt_range;
npc ids are the same in both games). Only NPCs that have no huntmode of their own get one.
- Void "aggressive" (and its intolerant/retarget kinds) -> aggressive_melee, or
  aggressive_ranged for an NPC that attacks from range (it has an ai_applayer2 script)
- Void "cowardly" (only goes for players weak enough) -> cowardly
hunt_range is Void's, or its default of 5.
Usage: hunt.py <void checkout> [--write]"""
import os, re, sys, glob
VOID, WRITE = sys.argv[1], '--write' in sys.argv
HERE = os.path.dirname(os.path.abspath(__file__))
C = os.path.join(HERE, '..', '..', 'content')

# Void npcs
raw = {}
for f in glob.glob(os.path.join(VOID, 'data', '**', '*.npcs.toml'), recursive=True):
    cur = None
    for line in open(f, encoding='utf-8'):
        line = line.split('#')[0].strip()
        m = re.match(r'^\[(.+)\]$', line)
        if m:
            cur = raw.setdefault(m.group(1), {})
            continue
        m = re.match(r'^(id|hunt_mode|hunt_range|clone)\s*=\s*"?([^"]+)"?$', line)
        if m and cur is not None:
            cur[m.group(1)] = m.group(2)
def resolve(name, depth=0):
    d = dict(raw.get(name, {}))
    if 'clone' in d and depth < 5:
        base = resolve(d['clone'], depth + 1)
        for k in ('hunt_mode', 'hunt_range'):
            d.setdefault(k, base.get(k))
    return d
byid = {}
for name, d in raw.items():
    if 'id' in d:
        r = resolve(name)
        if r.get('hunt_mode'):
            byid[int(d['id'])] = (r['hunt_mode'], int(r.get('hunt_range') or 5), name)

ids = {}
for l in open(os.path.join(C, 'pack', 'npc.pack')):
    if '=' in l:
        i, n = l.strip().split('=', 1)
        ids[n] = int(i)

# our npc blocks: where each is defined, and its huntmode / category
blocks = {}
for dp, _, fs in os.walk(os.path.join(C, 'scripts')):
    for f in fs:
        if f.endswith('.npc'):
            p = os.path.join(dp, f)
            for m in re.finditer(r'^\[([^\]]+)\]\n(.*?)(?=^\[|\Z)', open(p, encoding='utf-8', errors='replace').read(), re.S | re.M):
                b = blocks.setdefault(m.group(1), {'file': p, 'body': ''})
                b['body'] += m.group(2)
trig = set()
for dp, _, fs in os.walk(os.path.join(C, 'scripts')):
    for f in fs:
        if f.endswith('.rs2'):
            trig |= set(re.findall(r'^\[ai_applayer2,([^\]]+)\]', open(os.path.join(dp, f), errors='replace').read(), re.M))

from common import void_npcs as _void_npcs, unq as _unq
_vn = _void_npcs(VOID)
def _norm(x):
    return re.sub(r'[^a-z]', '', (x or '').lower())

changes = {}
for name, b in blocks.items():
    if name not in ids or ids[name] not in byid:
        continue
    if re.search(r'^huntmode=', b['body'], re.M):
        continue
    # Lost City's quest NPCs whose fights are scripted (no huntmode on purpose): left alone
    if re.search(r'no aggression, as Lost City', b['body']):
        continue
    # scripted fights that pick their own target (the Fight Cave and Pit, the Barrows brothers)
    if name.startswith(('tzhaar_fightcave', 'tzhaar_fightpit')) or name in ('barrows_ahrim', 'barrows_dharok', 'barrows_guthan', 'barrows_karil', 'barrows_torag', 'barrows_verac'):
        continue
    mode, rng, vname = byid[ids[name]]
    # only when Void's npc with this id is the same monster (some ids moved in Void's later cache)
    _d = _vn.get(ids[name], {})
    _desc = re.search(r'^desc=(.*)$', b['body'], re.M)
    _nm = re.search(r'^name=(.*)$', b['body'], re.M)
    _ex = _norm(_unq(_d.get('examine', '""')))
    if not ((_desc and _ex and _ex[:12] == _norm(_desc.group(1))[:12]) or (_nm and _norm(_nm.group(1)) and _norm(_nm.group(1)) in _norm(vname))):
        continue
    cat = re.search(r'^category=(\w+)', b['body'], re.M)
    ranged = name in trig or (cat and '_' + cat.group(1) in trig)
    if mode.startswith('aggressive') and mode != 'aggressive_npcs':
        ours = 'aggressive_ranged' if ranged else 'aggressive_melee'
    elif mode == 'cowardly':
        ours = 'cowardly'
    else:
        continue
    lines = f"// EASCape: aggression from Void ({vname}: {mode}, range {rng})\nhuntmode={ours}\n"
    if not re.search(r'^huntrange=', b['body'], re.M):
        lines += f"huntrange={rng}\n"
    changes.setdefault(b['file'], []).append((name, lines))

total = sum(len(v) for v in changes.values())
print(f'{len(byid)} Void NPCs with a hunt mode; {total} of ours get one')
if WRITE:
    for p, items in changes.items():
        s = open(p, encoding='utf-8', errors='replace').read()
        for name, lines in items:
            m = re.search(r'^\[' + re.escape(name) + r'\]\n(.*?)(?=^\[|\Z)', s, re.S | re.M)
            end = m.end(1)
            body = s[m.start(1):end]
            new = body.rstrip('\n') + '\n' + lines + ('\n' if body.endswith('\n\n') else '')
            s = s[:m.start(1)] + new + s[end:]
        open(p, 'w', encoding='utf-8').write(s)
