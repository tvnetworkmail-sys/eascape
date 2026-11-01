# The Feud: the mayor's safe from the August 2007 cache (interface 330) as our interface feud_safe:
# the safe's dial (model 6039), nine "Set to N" buttons (6040, lit 6041) and "Reset Safe" (6042, lit
# 6043), at their 2007 places. Ours: the 2006 "Close Window" text where 2007 has its close sprite.
# Usage: python3 -I safe_interface.py <cache468 flat dir>   (re-running replaces it)
import os, sys
W = os.path.dirname(os.path.abspath(__file__)); E = os.path.abspath(W + '/../..')
sys.path.insert(0, E + '/tools/fairytale2')
from port468 import Porter, ORIG
from if468 import decode_if1

pt = Porter(sys.argv[1], f'{E}/content/models/feud')

def model(mid):
    if mid < ORIG['model']:
        return pt.P['model'][mid]
    if mid in pt.newmodels:
        return pt.newmodels[mid]
    return pt.write_model(mid, f'feud_safe_m{mid}')

C = {k: decode_if1(v) for k, v in pt.c.files(3, 330).items()}
NAMES = {1: 'dial', 2: 'buttons', 12: 'reset'}
for i in range(1, 10):
    NAMES[i + 2] = f'set{i}'
out = ['// EASCape: from the August 2007 cache (interface 330), made by tools/feud/safe_interface.py', '']
comps = []
def com(name, lines):
    comps.append(name); out.append(f'[{name}]'); out.extend(lines); out.append('')
for k in sorted(C):
    if k in (0, 13, 14, 15):
        continue                         # the 600x500 root and 2007's close sprite
    o = C[k]; t = o['type']
    base = [f"x={o['x']}", f"y={o['y']}", f"width={o['width']}", f"height={o['height']}"]
    if o['layer'] is not None and o['layer'] in NAMES:
        base.insert(0, f"layer={NAMES[o['layer']]}")
    name = NAMES.get(k, f'com{k}')
    if t == 0:
        com(name, ['type=layer'] + base)
    elif t == 6:
        lines = ['type=model'] + base + [f"model={model(o['model'])}", f"zoom={o['zoom']}", f"xan={o['xan']}", f"yan={o['yan']}"]
        if o.get('option'):
            lines[1:1] = ['buttontype=normal']; lines.append(f"option={o['option']}")
        if o.get('activemodel') not in (None, -1):
            model(o['activemodel'])      # ported for the script's if_setmodel
        com(name, lines)
com('close', ['type=text', 'x=438', 'y=10', 'width=68', 'height=11', 'buttontype=close',
              'font=p11_full', 'shadowed=yes', 'text=Close Window', 'colour=0x808080', 'overcolour=0xFFFFFF'])
d = f'{E}/content/scripts/quests/quest_feud/interfaces'
os.makedirs(d, exist_ok=True)
open(f'{d}/feud_safe.if', 'w').write('\n'.join(out))
ip = f'{E}/content/pack/interface.pack'; io = f'{E}/content/pack/interface.order'
lines = open(ip).read().splitlines()
old = {l.split('=')[0] for l in lines if l.split('=', 1)[1].split(':')[0] == 'feud_safe'}
open(ip, 'w').write('\n'.join(l for l in lines if l.split('=')[0] not in old) + '\n')
order = open(io).read().splitlines()
open(io, 'w').write('\n'.join(o for o in order if o not in old) + '\n')
nxt = max(int(l.split('=')[0]) for l in open(ip) if '=' in l) + 1
with open(ip, 'a') as f, open(io, 'a') as g:
    for n in ['feud_safe'] + [f'feud_safe:{x}' for x in comps]:
        f.write(f'{nxt}={n}\n'); g.write(f'{nxt}\n'); nxt += 1
pt.save_packs()
print(comps, {m: pt.newmodels.get(m) for m in (6039, 6040, 6041, 6042, 6043)})
