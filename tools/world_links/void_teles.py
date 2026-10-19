#!/usr/bin/env python3
"""Reads Void's object teleports (GregHib/void, data/**/*.teles.toml) and matches each one to the
2006 loc at that square with that option. Writes void_links.json next to this file.

Usage: void_teles.py <void checkout>
Void's teleports: "delta" moves you by that much; "to" puts you on that square; "near" puts you on
the square of that width x height area nearest to where you stood."""
import os, re, sys, json, glob

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv_saved = sys.argv
exec(open(os.path.join(HERE, 'analyse.py')).read().split('# placements')[0])  # locs, ids
C = os.path.join(HERE, '..', '..', 'content')

def parse_inline(v):
    out = {}
    for k, val in re.findall(r'(\w+)\s*=\s*(-?\d+)', v):
        out[k] = int(val)
    return out

entries = []
for f in glob.glob(os.path.join(sys.argv_saved[1], 'data', '**', '*.teles.toml'), recursive=True):
    cur = None
    for line in open(f, encoding='utf-8'):
        line = line.split('#')[0].strip()
        if not line:
            continue
        m = re.match(r'^\[(.+)\]$', line)
        if m:
            cur = {'id': m.group(1), 'file': os.path.relpath(f, sys.argv_saved[1])}
            entries.append(cur)
            continue
        m = re.match(r'^(\w+)\s*=\s*(.*)$', line)
        if m and cur is not None:
            k, v = m.group(1), m.group(2)
            cur[k] = v.strip('"') if k == 'option' else parse_inline(v)

# the 2006 locs at every square
at = {}
for fn in os.listdir(os.path.join(C, 'maps')):
    m = re.match(r'm(\d+)_(\d+)\.jm2', fn)
    if not m:
        continue
    mx, mz = int(m.group(1)), int(m.group(2))
    sec = None
    for line in open(os.path.join(C, 'maps', fn)):
        if line.startswith('===='):
            sec = line.strip('= \n')
            continue
        if sec != 'LOC' or ':' not in line:
            continue
        head, rest = line.split(':')
        lv, lx, lz = map(int, head.split())
        n = ids.get(int(rest.split()[0]))
        if n in locs:
            at.setdefault((lv, mx * 64 + lx, mz * 64 + lz), []).append(n)

out, missed = [], 0
for e in entries:
    t = e.get('tile')
    if not t or 'option' not in e:
        continue
    key = (t.get('level', 0), t['x'], t['y'])
    hit = None
    for n in at.get(key, []):
        for o, txt in locs[n]['ops'].items():
            if txt.lower() == e['option'].lower():
                hit = (n, o)
    if not hit:
        missed += 1
        continue
    row = {'name': hit[0], 'op': hit[1], 'frm': list(key), 'void': e['id'], 'file': e['file']}
    if 'near' in e:
        nr = e['near']
        row.update(kind=3, to=[nr.get('level', 0), nr['x'], nr['y']], w=nr.get('width', 1), h=nr.get('height', 1))
    elif 'to' in e:
        to = e['to']
        row.update(kind=2, to=[to.get('level', 0), to['x'], to['y']])
    elif 'delta' in e:
        d = e['delta']
        row.update(kind=1, dx=d.get('x', 0), dz=d.get('y', 0), dl=d.get('level', 0))
    else:
        continue
    out.append(row)
json.dump(out, open(os.path.join(HERE, 'void_links.json'), 'w'))
print(f'{len(entries)} Void teleports, {len(out)} match a 2006 loc, {missed} have no matching loc')
