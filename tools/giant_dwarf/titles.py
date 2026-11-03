# The Giant Dwarf: the cutscene titles from the August 2007 cache (interface 152: "Keldagrim / Grand
# Capital of the Dwarven realm", "Rise of the Red Axe / Part 1", "The Giant Dwarf", and the later
# ones), as a 377 interface gd_titles. Its texts are in 2007 fonts our client doesn't have (645,
# 646), so each is drawn from the 2007 glyphs into a sprite (the way tools/fairytale2/
# scroll_interfaces.py does it), centred on its 2007 box; the layers keep their 2007 places and
# start hidden.
# Usage: titles.py <cache468 flat dir>   (re-running replaces its components)
import os, sys, re
from PIL import Image
W = os.path.dirname(os.path.abspath(__file__)); E = os.path.abspath(W + '/../..')
sys.path.insert(0, E + '/tools/fairytale2')
from cache468 import FlatCache
from if468 import decode_if1
from sprites468 import decode_sprites

c = FlatCache(sys.argv[1])

def render_text(font, text, colour, lineheight, shadow, path):
    g = decode_sprites(list(c.files(8, font).values())[0])
    adv = list(c.files(13, font).values())[0]  # 2007 metrics: byte n is char n's advance
    lineheight = lineheight or g['maxh']
    lines = [l.strip() for l in re.split(r'<br>', text)]
    widths = [sum(adv[ord(ch)] for ch in l) for l in lines]
    w = max(widths) + 2; h = lineheight * (len(lines) - 1) + g['maxh'] + 2
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); px = im.load()
    rgb = ((colour >> 16) & 255, (colour >> 8) & 255, colour & 255)
    for li, l in enumerate(lines):
        x = (w - 2 - widths[li]) // 2; top = li * lineheight
        for ch in l:
            s = g['sprites'][ord(ch)]
            for yy in range(s['h']):
                for xx in range(s['w']):
                    if s['px'][xx + yy * s['w']] is None: continue
                    X = x + s['ox'] + xx; Y = top + s['oy'] + yy
                    if shadow and X + 1 < w and Y + 1 < h and px[X + 1, Y + 1][3] == 0:
                        px[X + 1, Y + 1] = (1, 1, 1, 255)
                    if 0 <= X < w and 0 <= Y < h:
                        px[X, Y] = rgb + (255,)
            x += adv[ord(ch)]
    im.save(path)
    return w, h

IFNAME = 'gd_titles'
C = {k: decode_if1(v) for k, v in c.files(3, 152).items()}
out = ['// EASCape: from the August 2007 cache (interface 152), made by tools/giant_dwarf/titles.py', '']
comps = []
def com(name, lines):
    comps.append(name); out.append(f'[{name}]'); out.extend(lines); out.append('')
for k in sorted(C):
    o = C[k]
    if o['type'] == 0:
        com(f'layer{k}', ['type=layer', f"x={o['x']}", f"y={o['y']}", f"width={o['width']}", f"height={o['height']}", 'hide=yes'])
for k in sorted(C):
    o = C[k]
    if o['type'] != 4:
        continue
    sprite = f'{IFNAME}_{k}'
    w, h = render_text(o['font'], o['text'], o['colour'], o['lineheight'], o.get('shadowed'), f'{E}/content/sprites/{sprite}.png')
    cx = o['x'] + o['width'] // 2
    y = o['y'] + (o['height'] - h) // 2 if o.get('valign') == 1 else o['y']
    com(f'com{k}', [f"layer=layer{o['layer']}", 'type=graphic', f'x={cx - w // 2}', f'y={y}', f'width={w}', f'height={h}', f'graphic={sprite},0'])
d = f'{E}/content/scripts/quests/quest_giant_dwarf/interfaces'
os.makedirs(d, exist_ok=True)
open(f'{d}/{IFNAME}.if', 'w').write('\n'.join(out))

ip = f'{E}/content/pack/interface.pack'; io = f'{E}/content/pack/interface.order'
lines = open(ip).read().splitlines()
old = {l.split('=')[0] for l in lines if l.split('=', 1)[1].split(':')[0] == IFNAME}
open(ip, 'w').write('\n'.join(l for l in lines if l.split('=')[0] not in old) + '\n')
order = open(io).read().splitlines()
open(io, 'w').write('\n'.join(o for o in order if o not in old) + '\n')
nxt = max(int(l.split('=')[0]) for l in open(ip) if '=' in l) + 1
with open(ip, 'a') as f, open(io, 'a') as g:
    for n in [IFNAME] + [f'{IFNAME}:{x}' for x in comps]:
        f.write(f'{nxt}={n}\n'); g.write(f'{nxt}\n'); nxt += 1
print(len(comps), 'components')
