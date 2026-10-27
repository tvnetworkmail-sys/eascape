# Fairytale II, step 2b: the fairy ring travel log, shown in the side panel while the code screen is
# open. The August 2007 cache has none (OSRS added one later: "a list of rings to which you have
# recently travelled ... click on the ring code in the travel log and the code will be
# automatically entered", OSRS wiki, Fairy ring), so this is ours, in the 2006 side panel style:
# a scrolling list of the codes you have used, each with its place; clicking one dials it.
# Usage: ring_log_interface.py   (run once; README.md)
import os
E = os.path.abspath(os.path.dirname(os.path.abspath(__file__)) + '/../..')
SLOTS = 36          # every code our game has (fairy_rings.dbrow)
H = 26
out = ['// EASCape: the fairy ring travel log (side panel), made by tools/fairytale2/ring_log_interface.py.',
       '// The scripts fill the slots in code order with the codes you have used and hide the rest.', '']
names = []
def com(name, lines):
    names.append(name); out.append(f'[{name}]'); out.extend(lines); out.append('')
com('title', ['type=text', 'x=0', 'y=4', 'width=190', 'height=16', 'font=b12_full', 'center=yes', 'shadowed=yes',
              'text=Travel log', 'colour=0xFF981F'])
com('empty', ['type=text', 'x=8', 'y=40', 'width=174', 'height=40', 'font=p11_full', 'shadowed=yes',
              'text=No fairy ring codes used yet.', 'colour=0xFFFFFF'])
com('list', ['type=layer', 'x=0', 'y=24', 'width=174', 'height=234', f'scroll={SLOTS * H + 4}'])
# each slot is a layer, as 377 hides layers only (a hidden button would still take clicks)
for i in range(SLOTS):
    y = 2 + i * H
    com(f'slot{i}', ['layer=list', 'type=layer', 'x=0', f'y={y}', 'width=174', f'height={H}', 'hide=yes'])
    com(f'button{i}', [f'layer=slot{i}', 'type=rect', 'x=2', 'y=0', 'buttontype=normal', 'width=170', f'height={H - 2}',
                       'trans=255', 'colour=0xFFFFFF', 'option=Select'])
    com(f'code{i}', [f'layer=slot{i}', 'type=text', 'x=4', 'y=5', 'width=30', 'height=14', 'font=p12_full', 'shadowed=yes',
                     'text=AIQ', 'colour=0xFFFF00'])
    com(f'region{i}', [f'layer=slot{i}', 'type=text', 'x=36', 'y=0', 'width=136', 'height=12', 'font=p11_full', 'shadowed=yes',
                       'text=', 'colour=0xFF981F'])
    com(f'place{i}', [f'layer=slot{i}', 'type=text', 'x=36', 'y=12', 'width=136', 'height=12', 'font=p11_full', 'shadowed=yes',
                      'text=', 'colour=0xFFFFFF'])
d = f'{E}/content/scripts/areas/area_fairy_rings/interfaces'
os.makedirs(d, exist_ok=True)
open(f'{d}/fairyrings_log.if', 'w').write('\n'.join(out))
ip = f'{E}/content/pack/interface.pack'; io = f'{E}/content/pack/interface.order'
have = {l.split('=', 1)[1].strip() for l in open(ip) if '=' in l}
nxt = max(int(l.split('=')[0]) for l in open(ip) if '=' in l) + 1
with open(ip, 'a') as f, open(io, 'a') as g:
    for n in ['fairyrings_log'] + [f'fairyrings_log:{x}' for x in names]:
        if n in have: continue
        f.write(f'{nxt}={n}\n'); g.write(f'{nxt}\n'); nxt += 1
print(len(names), 'components')
