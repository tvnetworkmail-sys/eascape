#!/usr/bin/env python3
"""Adds every agility shortcut RuneLite knows (AgilityShortcut.java, which this plugin comes from)
to src/plugins/agility/agility.json, where the loc is in the 2006 game. RuneLite names objects by
Jagex's own names (ObjectID.TROLL_CLIMBINGROCKS_TOP), the same names our loc.pack uses
(troll_climbingrocks_top), so they match by name. Only locs placed somewhere on our 2006 map are
kept. Shortcuts already in the table keep their level.
Where our loc has no name of its own (loc_1234), RuneLite's number for it is used instead (the
2006 and OSRS numbers agree for nearly all old objects), from gameval/ObjectID.java.
Usage: agility_shortcuts.py <AgilityShortcut.java> <content dir> <gameval ObjectID.java>"""
import json, os, re, sys
src, content, gameval = sys.argv[1], sys.argv[2], sys.argv[3]
gv = dict((n, int(v)) for n, v in re.findall(r'public static final int ([A-Z_0-9]+) = (\d+);', open(gameval).read()))
HERE = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(HERE, '..', '..', 'src', 'plugins', 'agility', 'agility.json')

text = open(src).read()
body = text[text.index('{', text.index('enum AgilityShortcut')) + 1:]
# one entry per constant: from "\tNAME(" to the next one
starts = [m.start() for m in re.finditer(r'^\t[A-Z_0-9]+\(', body, re.M)]
entries = [body[a:b] for a, b in zip(starts, starts[1:] + [len(body)])]
ids = {}
for l in open(os.path.join(content, 'pack', 'loc.pack')):
    if '=' in l:
        i, n = l.strip().split('=', 1)
        ids[n] = int(i)
placed = set()
for fn in os.listdir(os.path.join(content, 'maps')):
    if not fn.endswith('.jm2'):
        continue
    sec = None
    for line in open(os.path.join(content, 'maps', fn)):
        if line.startswith('===='):
            sec = line.strip('= \n')
        elif sec == 'LOC' and ':' in line:
            placed.add(int(line.split(':')[1].split()[0]))

data = json.load(open(out))
short = data['shortcuts']
added = 0
for e in entries:
    m = re.search(r'([A-Z_0-9]+)\(\s*(\d+)', e)
    if not m:
        continue
    level = int(m.group(2))
    for name in re.findall(r'ObjectID\.([A-Z_0-9]+)', e):
        lid = ids.get(name.lower())
        if lid is None and name in gv and ids.get(f'loc_{gv[name]}') == gv[name]:
            lid = gv[name]
        if lid is None or lid not in placed or str(lid) in short:
            continue
        short[str(lid)] = level
        added += 1
# entries whose objects have newer numbers: the loc at RuneLite's spot (within 2 squares) whose
# name shares a word with RuneLite's description ("Spikey Chain (Floor 1)" -> "Spikey chain")
names = {}
cur = None
for dp, _, fs in os.walk(os.path.join(content, 'scripts')):
    for f in fs:
        if f.endswith('.loc'):
            for line in open(os.path.join(dp, f), encoding='utf-8', errors='replace'):
                line = line.strip()
                m2 = re.match(r'^\[(.+)\]$', line)
                if m2:
                    cur = m2.group(1)
                elif cur and line.startswith('name='):
                    names.setdefault(cur, line[5:])
                elif cur and line in ('op1=Mine', 'op2=Prospect'):
                    names[cur] = ''  # a rock to mine, never a shortcut
at = {}
for fn in os.listdir(os.path.join(content, 'maps')):
    m2 = re.match(r'm(\d+)_(\d+)\.jm2', fn)
    if not m2:
        continue
    mx, mz = int(m2.group(1)), int(m2.group(2))
    sec = None
    for line in open(os.path.join(content, 'maps', fn)):
        if line.startswith('===='):
            sec = line.strip('= \n')
        elif sec == 'LOC' and ':' in line:
            h, r = line.split(':')
            lv, lx, lz = map(int, h.split())
            at.setdefault((lv, mx * 64 + lx, mz * 64 + lz), []).append(int(r.split()[0]))
byid = {v: k for k, v in ids.items()}
for e in entries:
    m = re.search(r'([A-Z_0-9]+)\(\s*(\d+)\s*,\s*"([^"]*)"\s*,\s*new WorldPoint\((\d+),\s*(\d+),\s*(\d+)\)', e)
    if not m:
        continue
    level, desc = int(m.group(2)), m.group(3).lower()
    x, z, lv = int(m.group(4)), int(m.group(5)), int(m.group(6))
    words = {w for w in re.findall(r'[a-z]+', desc) if len(w) > 2}
    for dx in range(-2, 3):
        for dz in range(-2, 3):
            for lid in at.get((lv, x + dx, z + dz), []):
                nm = names.get(byid.get(lid, ''), '').lower()
                if str(lid) not in short and words & set(re.findall(r'[a-z]+', nm)):
                    short[str(lid)] = level
                    added += 1
json.dump(data, open(out, 'w'), separators=(',', ':'), sort_keys=True)
print(f'added {added} shortcut locs; {len(short)} in all')
