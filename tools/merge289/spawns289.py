#!/usr/bin/env python3
# NPCs Lost City 289 places on the map that our 377 maps don't have anywhere (Juliet, Edmond,
# the Myreque's Vanstrom, the Tai Bwo Wannai trio...): add their 289 spawns to our map squares.
import re, glob, os, sys
L, E = sys.argv[1], sys.argv[2]   # Lost City 289 content dir, our content dir
def npcs(f):
    out, sec = [], None
    for l in open(f, errors='replace'):
        if l.startswith('===='):
            sec = l.strip(); continue
        if sec and 'NPC' in sec:
            m = re.match(r'(\d+ \d+ \d+): (\d+)', l)
            if m: out.append((m.group(1), int(m.group(2))))
    return out
have = set()
for f in glob.glob(E + '/maps/*.jm2'):
    for p, i in npcs(f): have.add(i)
added = 0
for f in sorted(glob.glob(L + '/maps/*.jm2')):
    b = os.path.basename(f); o = E + '/maps/' + b
    new = [(p, i) for p, i in npcs(f) if i not in have]
    if not new or not os.path.exists(o):
        continue
    s = open(o).read()
    if '==== NPC ====' not in s:
        s = s.rstrip('\n') + '\n==== NPC ====\n'
    lines = s.split('\n')
    k = lines.index('==== NPC ====') + 1
    while k < len(lines) and lines[k] and not lines[k].startswith('===='):
        k += 1
    lines[k:k] = [f'{p}: {i}' for p, i in new]
    open(o, 'w').write('\n'.join(lines))
    added += len(new)
    print(b, [i for p, i in new])
print('added', added)
