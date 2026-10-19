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
body = body[:body.index(';')]
entries = re.split(r'\)\s*,\s*(?=//|\n\s*[A-Z_0-9]+\()', body)
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
json.dump(data, open(out, 'w'), separators=(',', ':'), sort_keys=True)
print(f'added {added} shortcut locs; {len(short)} in all')
