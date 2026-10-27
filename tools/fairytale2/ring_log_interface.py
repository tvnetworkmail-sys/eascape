# Fairytale II, step 2b: the fairy ring travel log, shown in the side panel while the code screen is
# open. The August 2007 cache has none (OSRS added one later: "a list of rings to which you have
# recently travelled ... click on the ring code in the travel log and the code will be
# automatically entered. Up to ten fairy ring codes can be marked as favourites", OSRS wiki, Fairy
# ring), so this is ours, laid out like the OSRS one: a parchment panel, each code you've used with
# its place under it in up to two lines and a heart (red, or green for a favourite) to add or remove a favourite.
# The parchment and the hearts are our own sprites (eascape_parchment, eascape_hearts).
# Usage: ring_log_interface.py   (re-run replaces its components in interface.pack/order)
import os
E = os.path.abspath(os.path.dirname(os.path.abspath(__file__)) + '/../..')
SLOTS = 36          # every code our game has (fairy_rings.dbrow)
H = 38
INK = '0x3E2A12'    # the dark brown of the OSRS log's writing
CODE = '0x9A1010'
out = ['// EASCape: the fairy ring travel log (side panel), made by tools/fairytale2/ring_log_interface.py.',
       '// The scripts fill the slots (favourites first, then code order) and hide the rest.', '']
names = []
def com(name, lines):
    names.append(name); out.append(f'[{name}]'); out.extend(lines); out.append('')
com('parchment', ['type=graphic', 'x=0', 'y=0', 'width=190', 'height=261', 'graphic=eascape_parchment,0'])
com('title', ['type=text', 'x=0', 'y=6', 'width=190', 'height=16', 'font=b12_full', 'center=yes',
              'text=Travel log', f'colour={INK}'])
com('empty', ['type=text', 'x=10', 'y=40', 'width=170', 'height=40', 'font=p11_full',
              'text=No fairy ring codes used yet.', f'colour={INK}'])
com('list', ['type=layer', 'x=4', 'y=26', 'width=166', 'height=230', f'scroll={SLOTS * H + 4}'])
# each slot is a layer, as 377 hides layers only (a hidden button would still take clicks); the
# two hearts are layers of their own so the option matches the heart shown
for i in range(SLOTS):
    y = 2 + i * H
    com(f'slot{i}', ['layer=list', 'type=layer', 'x=0', f'y={y}', 'width=166', f'height={H}', 'hide=yes'])
    com(f'button{i}', [f'layer=slot{i}', 'type=rect', 'x=18', 'y=0', 'buttontype=normal', 'width=148', f'height={H - 2}',
                       'trans=255', 'colour=0xFFFFFF', 'option=Select'])
    com(f'add{i}', [f'layer=slot{i}', 'type=layer', 'x=2', 'y=2', 'width=13', 'height=12'])
    com(f'addheart{i}', [f'layer=add{i}', 'type=graphic', 'x=1', 'y=1', 'buttontype=normal', 'width=11', 'height=10',
                         'graphic=eascape_hearts,0', 'option=Add Favourite'])
    com(f'remove{i}', [f'layer=slot{i}', 'type=layer', 'x=2', 'y=2', 'width=13', 'height=12', 'hide=yes'])
    com(f'removeheart{i}', [f'layer=remove{i}', 'type=graphic', 'x=1', 'y=1', 'buttontype=normal', 'width=11', 'height=10',
                            'graphic=eascape_hearts,1', 'option=Remove Favourite'])
    com(f'code{i}', [f'layer=slot{i}', 'type=text', 'x=18', 'y=0', 'width=40', 'height=13', 'font=p12_full',
                     'text=AIQ', f'colour={CODE}'])
    com(f'line1_{i}', [f'layer=slot{i}', 'type=text', 'x=18', 'y=12', 'width=148', 'height=12', 'font=p11_full',
                       'text=', f'colour={INK}'])
    com(f'line2_{i}', [f'layer=slot{i}', 'type=text', 'x=18', 'y=24', 'width=148', 'height=12', 'font=p11_full',
                       'text=', f'colour={INK}'])
d = f'{E}/content/scripts/areas/area_fairy_rings/interfaces'
os.makedirs(d, exist_ok=True)
open(f'{d}/fairyrings_log.if', 'w').write('\n'.join(out))
ip = f'{E}/content/pack/interface.pack'; io = f'{E}/content/pack/interface.order'
lines = open(ip).read().splitlines()
old = {l.split('=')[0] for l in lines if l.split('=', 1)[1].startswith('fairyrings_log')}
open(ip, 'w').write('\n'.join(l for l in lines if l.split('=')[0] not in old) + '\n')
order = open(io).read().splitlines()
open(io, 'w').write('\n'.join(o for o in order if o not in old) + '\n')
nxt = max(int(l.split('=')[0]) for l in open(ip) if '=' in l) + 1
with open(ip, 'a') as f, open(io, 'a') as g:
    for n in ['fairyrings_log'] + [f'fairyrings_log:{x}' for x in names]:
        f.write(f'{nxt}={n}\n'); g.write(f'{nxt}\n'); nxt += 1
print(len(names), 'components')
