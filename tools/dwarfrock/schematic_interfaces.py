# Between a Rock...: the schematic puzzle from the August 2007 cache, as two 377 interfaces:
#   113 -> bar_schematic       the base schematics and the three overlays (and their lined-up
#                              versions, shown once solved), with "That's it, it all makes sense
#                              now!..." at the top
#   114 -> bar_schematic_side  the side panel: move up/down/left/right and rotate, and per overlay
#                              "Show" and "Select" ticks
# Each keeps its 2007 components and places. Ours: the 2006 "Close Window" text where 2007 has its
# close sprite; each tick is two graphics (2007's sprites 180 empty and 181 ticked, 2007 swaps them
# by client script); the server moves the ticked one onto the empty one, as hiding a graphic doesn't
# take in our client; the 2007 sprites 172/173/314/315 (borders),
# 310-313 (corners) and 180/181 (ticks) are written as our sprite sheets bar_schematic_border,
# bar_schematic_corner and bar_schematic_tick; 297 is our tradebacking.
# Usage: python3 -I schematic_interfaces.py <cache468 flat dir>   (re-running replaces them)
import os, sys
from PIL import Image
W = os.path.dirname(os.path.abspath(__file__)); E = os.path.abspath(W + '/../..')
sys.path.insert(0, E + '/tools/fairytale2')
from port468 import Porter, ORIG
from if468 import decode_if1
from sprites468 import decode_sprites

pt = Porter(sys.argv[1], f'{E}/content/models/dwarfrock')

def model(mid):
    if mid < ORIG['model']:
        return pt.P['model'][mid]
    if mid in pt.newmodels:
        return pt.newmodels[mid]
    return pt.write_model(mid, f'dwarf_rock_ifm{mid}')

def sprite_img(g):
    sp = decode_sprites(list(pt.c.files(8, g).values())[0]); s = sp['sprites'][0]
    im = Image.new('RGBA', (sp['maxw'], sp['maxh']), (0, 0, 0, 0)); px = im.load()
    for y in range(s['h']):
        for x in range(s['w']):
            v = s['px'][x + y * s['w']]
            if v is not None:
                px[s['ox'] + x, s['oy'] + y] = ((v >> 16) & 255, (v >> 8) & 255, v & 255, 255)
    return im

SHEETS = {'bar_schematic_border': [172, 173, 314, 315], 'bar_schematic_corner': [310, 311, 312, 313],
          'bar_schematic_tick': [180, 181]}
GFX = {297: 'tradebacking,0'}
for name, ids in SHEETS.items():
    ims = [sprite_img(g) for g in ids]
    w, h = ims[0].size
    sheet = Image.new('RGBA', (w * len(ims), h), (0, 0, 0, 0))
    for i, im in enumerate(ims):
        sheet.paste(im, (i * w, 0)); GFX[ids[i]] = f'{name},{i}'
    sheet.save(f'{E}/content/sprites/{name}.png')
    open(f'{E}/content/sprites/meta/{name}.opt', 'w').write(f'{w}x{h}\n')

FONT = {494: 'p11_full', 495: 'p12_full', 496: 'b12_full', 497: 'q8_full'}
# 2007 component -> our name, for the ones the scripts use
NAMES = {113: {1: 'base', 3: 'layer1', 5: 'layer2', 7: 'layer3', 4: 'model1', 6: 'model2', 8: 'model3',
               10: 'solved1', 12: 'solved2', 14: 'solved3', 16: 'done'},
         114: {24: 'select1', 25: 'select2', 26: 'select3', 27: 'show1', 28: 'show2', 29: 'show3',
               30: 'rotate', 31: 'up', 32: 'right', 33: 'left', 34: 'down'}}
IFS = {113: 'bar_schematic', 114: 'bar_schematic_side'}
names = {}
for gid, ifname in IFS.items():
    C = {k: decode_if1(v) for k, v in pt.c.files(3, gid).items()}
    nm = lambda k: NAMES[gid].get(k, f'com{k}')
    out = [f'// EASCape: from the August 2007 cache (interface {gid}), made by tools/dwarfrock/schematic_interfaces.py', '']
    comps = []
    def com(name, lines):
        comps.append(name); out.append(f'[{name}]'); out.extend(lines); out.append('')
    skip = set()
    if gid == 113:
        skip = {9, 18, 19, 20}          # 2007's close sprite and its layers
    for k in sorted(C):
        if k in skip:
            continue
        o = C[k]; t = o['type']
        base = [f"x={o['x']}", f"y={o['y']}", f"width={o['width']}", f"height={o['height']}"]
        if o['layer'] is not None:
            base.insert(0, f"layer={nm(o['layer'])}")
        if t == 0:
            lines = ['type=layer'] + base
            if o.get('hide') or k in (10, 12, 14) and gid == 113:
                lines.append('hide=yes')
            com(nm(k), lines)
        elif t == 3:
            com(nm(k), ['type=rect'] + base + ['fill=yes', f"colour=0x{o['colour']:06X}"])
        elif t == 6:
            lines = ['type=model'] + base + [f"model={model(o['model'])}", f"zoom={o['zoom']}", f"xan={o['xan']}", f"yan={o['yan']}"]
            if o.get('option'):
                lines[1:1] = ['buttontype=normal']; lines.append(f"option={o['option']}")
            com(nm(k), lines)
        elif t == 4:
            lines = ['type=text'] + base + [f"font={FONT[o['font']]}", f"text={o['text']}", f"colour=0x{o['colour']:06X}"]
            if o.get('center'): lines.append('center=yes')
            if o.get('shadowed'): lines.append('shadowed=yes')
            com(nm(k), lines)
        elif t == 5:
            if gid == 114 and o['graphic'] == 180:      # a tick: empty and ticked
                for st, g in (('off', 180), ('on', 181)):
                    lines = ['type=graphic'] + base[:2] + ['width=15', 'height=15', 'buttontype=normal',
                             f'graphic={GFX[g]}', f"option={o['option']}"]
                    if st == 'on': lines[1:3] = ['x=-100', 'y=-100']   # off the panel until ticked (hide doesn't take on graphics here)
                    com(f'{nm(k)}_{st}', lines)
                continue
            com(nm(k), ['type=graphic'] + base + [f"graphic={GFX[o['graphic']]}"])
    if gid == 113:
        com('close', ['type=text', 'x=438', 'y=10', 'width=68', 'height=11', 'buttontype=close',
                      'font=p11_full', 'shadowed=yes', 'text=Close Window', 'colour=0x808080', 'overcolour=0xFFFFFF'])
    d = f'{E}/content/scripts/quests/quest_dwarfrock/interfaces'
    os.makedirs(d, exist_ok=True)
    open(f'{d}/{ifname}.if', 'w').write('\n'.join(out))
    names[ifname] = comps

ip = f'{E}/content/pack/interface.pack'; io = f'{E}/content/pack/interface.order'
lines = open(ip).read().splitlines()
old = {l.split('=')[0] for l in lines if l.split('=', 1)[1].split(':')[0] in names}
open(ip, 'w').write('\n'.join(l for l in lines if l.split('=')[0] not in old) + '\n')
order = open(io).read().splitlines()
open(io, 'w').write('\n'.join(o for o in order if o not in old) + '\n')
nxt = max(int(l.split('=')[0]) for l in open(ip) if '=' in l) + 1
with open(ip, 'a') as f, open(io, 'a') as g:
    for ifname, comps in names.items():
        for n in [ifname] + [f'{ifname}:{x}' for x in comps]:
            f.write(f'{nxt}={n}\n'); g.write(f'{nxt}\n'); nxt += 1
pt.save_packs()
print({k: len(v) for k, v in names.items()})
