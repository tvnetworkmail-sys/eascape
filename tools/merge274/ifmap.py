#!/usr/bin/env python3
# Work out how 274 interface and component names correspond to 377 ones.
# Writes ifmap.json: { "274name": "377name", "iface274:com274": "iface377:com377" }
import os, re, json, sys, difflib
R = sys.argv[1]

def tree(root):
    out = {}
    for d, _, fs in os.walk(root):
        for f in fs:
            if f.endswith('.if'):
                out[f[:-3]] = os.path.join(d, f)
    return out

def parse(p):
    """[(name, signature)] in file order"""
    res, cur, sig = [], None, []
    for line in open(p, encoding='utf-8', errors='surrogateescape'):
        m = re.match(r'^\[(\w+)\]', line)
        if m:
            if cur:
                res.append((cur, tuple(sig)))
            cur, sig = m.group(1), []
        elif cur and re.match(r'^(type|layer|width|height|x|y)=', line):
            sig.append(line.strip())
    if cur:
        res.append((cur, tuple(sig)))
    return res

B, T, O = tree(R + '/base/scripts'), tree(R + '/t274/scripts'), tree(R + '/eas/scripts')
mp = {}

# interfaces 377 renamed: base name missing in 377 -> 377 file with the same component layout
osig = {n: tuple(s for _, s in parse(p)) for n, p in O.items()}
by_sig = {}
for n, s in osig.items():
    by_sig.setdefault(s, []).append(n)
for n, p in T.items():
    if n in O:
        continue
    src = B.get(n, p)
    s = tuple(x for _, x in parse(src))
    cands = by_sig.get(s, [])
    if len(cands) == 1:
        mp[n] = cands[0]

def align(n274, n377):
    a, b = parse(T[n274]), parse(O[n377])
    sm = difflib.SequenceMatcher(None, [s for _, s in a], [s for _, s in b], autojunk=False)
    onames = {x for x, _ in b}
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag in ('equal',) or (tag == 'replace' and i2 - i1 == j2 - j1):
            for k in range(i2 - i1):
                an, bn = a[i1 + k][0], b[j1 + k][0]
                if an != bn and an not in onames:
                    mp[f'{n274}:{an}'] = f'{n377}:{bn}'
                elif n274 != n377 and an == bn:
                    mp[f'{n274}:{an}'] = f'{n377}:{bn}'

# 274 added an interface under a name 377 uses for a different interface: keep both, 274's renamed
clash = []
for n in T:
    if n in O and n not in B:
        if [x for _, x in parse(T[n])] != [x for _, x in parse(O[n])]:
            clash.append(n)
            mp[n] = n + '_274'
for n in T:
    if n in clash:
        continue
    tgt = n if n in O else mp.get(n)
    if tgt:
        align(n, tgt)

json.dump(clash, open(R + '/ifclash.json', 'w'))
json.dump(mp, open(R + '/ifmap.json', 'w'), indent=0)
print('clash', len(clash), clash)
print('interfaces', sum(1 for k in mp if ':' not in k), 'components', sum(1 for k in mp if ':' in k))
