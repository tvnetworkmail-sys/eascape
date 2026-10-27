# Fairytale II, step 2b: the fairy ring code screen, from the August 2007 cache's interface 426
# (decoded with if468.py), as a 377 interface: the same components at the same places, with its
# 52 new models (the three wooden dials, the twelve layers of toadstool letters - one layer per
# quarter turn of each dial - and the peg bar). Our choices: the 2006 "Close Window" text button
# in place of 2007's close sprite, and the vertically centred 2007 texts placed at the middle of
# their boxes (377 texts have no vertical alignment).
# Usage: ring_interface.py <cache468 flat dir>   (run once; README.md)
import os, sys
W = os.path.dirname(os.path.abspath(__file__)); E = os.path.abspath(W + '/../..')
sys.path.insert(0, W)
from port468 import Porter, ORIG
from if468 import decode_if1

pt = Porter(sys.argv[1], f'{E}/content/models/fairytale2')
C = {k: decode_if1(v) for k, v in pt.c.files(3, 426).items()}

# layers 16-27: three dials x four quarter turns. The letter on the bottom toadstool (under the
# peg bar) is the one dialled: for dial 1 the layers show C, B, A, D (2007 varbit values 2, 3, 0, 1).
LAYERS = {16: 'd1_c', 17: 'd1_b', 18: 'd1_a', 19: 'd1_d',
          20: 'd2_k', 21: 'd2_j', 22: 'd2_i', 23: 'd2_l',
          24: 'd3_r', 25: 'd3_q', 26: 'd3_p', 27: 'd3_s'}
NAMES = {1: 'dial1', 2: 'dial2', 3: 'dial3', 28: 'pegbar', 30: 'toadstool_top', 32: 'toadstool_bottom',
         31: 'title', 33: 'teleport', 34: 'turn1', 35: 'turn2', 36: 'turn3'}
FONT = {494: 'p11_full', 495: 'p12_full', 496: 'b12_full', 497: 'q8_full'}

def model(mid):
    if mid < ORIG['model']:
        return pt.P['model'][mid]
    if mid in pt.newmodels:
        return pt.newmodels[mid]
    return pt.write_model(mid, f'ft2_ifm{mid}')

out = ['// EASCape: the fairy ring code screen from the August 2007 cache (interface 426), made by',
       '// tools/fairytale2/ring_interface.py. The scripts show one letter layer per dial (if_sethide).', '']
names = []
def com(name, lines):
    names.append(name)
    out.append(f'[{name}]'); out.extend(lines); out.append('')

o = C[0]
com('background', ['type=rect', 'x=0', 'y=0', 'width=512', 'height=334', 'fill=yes', f"colour=0x{o['colour']:06X}"])
for k in (1, 2, 3, 30, 32):
    o = C[k]
    com(NAMES[k], ['type=model', f"x={o['x']}", f"y={o['y']}", f"width={o['width']}", f"height={o['height']}",
                   f"model={model(o['model'])}", f"zoom={o['zoom']}", f"xan={o['xan']}", f"yan={o['yan']}"])
for lay, nm in LAYERS.items():
    o = C[lay]
    com(nm, ['type=layer', f"x={o['x']}", f"y={o['y']}", f"width={o['width']}", f"height={o['height']}"] + (['hide=yes'] if o.get('hide') else []))
    n = 0
    for k in sorted(C):
        c = C[k]
        if c['type'] == 6 and c['layer'] == lay:
            n += 1
            com(f'{nm}_{n}', [f'layer={nm}', 'type=model', f"x={c['x']}", f"y={c['y']}", f"width={c['width']}", f"height={c['height']}",
                              f"model={model(c['model'])}", f"zoom={c['zoom']}", f"xan={c['xan']}", f"yan={c['yan']}"])
o = C[28]
com('pegbar', ['type=model', f"x={o['x']}", f"y={o['y']}", f"width={o['width']}", f"height={o['height']}",
               f"model={model(o['model'])}", f"zoom={o['zoom']}", f"xan={o['xan']}", f"yan={o['yan']}"])
for k in (31, 33):
    o = C[k]
    y = o['y'] + (o['height'] - 13) // 2
    lines = ['type=text', f"x={o['x']}", f'y={y}', f"width={o['width']}", 'height=15']
    if k == 33: lines.append('buttontype=normal')
    lines += [f"font={FONT[o['font']]}", 'center=yes', f"text={o['text']}", f"colour=0x{o['colour']:06X}"]
    if o.get('overcolour'): lines.append(f"overcolour=0x{o['overcolour']:06X}")
    if k == 33: lines.append('option=Teleport to this location')
    com(NAMES[k], lines)
for k in (34, 35, 36):
    o = C[k]
    com(NAMES[k], ['type=rect', f"x={o['x']}", f"y={o['y']}", 'buttontype=normal', f"width={o['width']}", f"height={o['height']}",
                   'trans=255', f"colour=0x{o['colour']:06X}", f"option={o['option']}"])
com('close', ['type=text', 'x=432', 'y=10', 'width=68', 'height=11', 'buttontype=close', 'font=p11_full', 'shadowed=yes',
              'text=Close Window', 'colour=0x808080', 'overcolour=0xFFFFFF'])

d = f'{E}/content/scripts/areas/area_fairy_rings/interfaces'
os.makedirs(d, exist_ok=True)
open(f'{d}/fairyrings.if', 'w').write('\n'.join(out))

ip = f'{E}/content/pack/interface.pack'; io = f'{E}/content/pack/interface.order'
have = {l.split('=', 1)[1].strip() for l in open(ip) if '=' in l}
nxt = max(int(l.split('=')[0]) for l in open(ip) if '=' in l) + 1
with open(ip, 'a') as f, open(io, 'a') as g:
    for n in ['fairyrings'] + [f'fairyrings:{x}' for x in names]:
        if n in have: continue
        f.write(f'{nxt}={n}\n'); g.write(f'{nxt}\n'); nxt += 1
pt.save_packs()
print(len(names), 'components;', len(pt.ADDED['model']), 'models')
