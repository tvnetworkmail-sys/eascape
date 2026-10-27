# Fairytale II, step 4: the quest's four scrolls from the August 2007 cache, as 377 interfaces:
#   423 ft2_certificate    Nuff's certificate, read
#   424 ft2_message        the back of it, studied: the message in the fairies' symbols
#   425 ft2_sign           the rune temple sign by the Cosmic Altar ruins, read
#   427 ft2_contract       the Godfather's contract scroll
# Each keeps its 2007 components and places. The two symbol texts are in 2007 fonts our client
# doesn't have (647 and 648), so they're drawn here from the 2007 glyphs (archive 8, with their
# advances from archive 13) into sprites (ft2_message_text, ft2_sign_text) that the interfaces
# show. Our choices: the 2006 "Close Window" button where 2007 has its close sprite; vertically
# centred texts placed at the middle of their boxes (377 has no vertical alignment).
# Usage: scroll_interfaces.py <cache468 flat dir>   (re-running replaces its components)
import os, sys, re
from PIL import Image
W = os.path.dirname(os.path.abspath(__file__)); E = os.path.abspath(W + '/../..')
sys.path.insert(0, W)
from port468 import Porter, ORIG
from if468 import decode_if1
from sprites468 import decode_sprites

pt = Porter(sys.argv[1], f'{E}/content/models/fairytale2')
FONT = {494: 'p11_full', 495: 'p12_full', 496: 'b12_full', 497: 'q8_full'}

def model(mid):
    if mid < ORIG['model']:
        return pt.P['model'][mid]
    if mid in pt.newmodels:
        return pt.newmodels[mid]
    return pt.write_model(mid, f'ft2_ifm{mid}')

def render_text(font, text, colour, lineheight, shadow, path):
    g = decode_sprites(list(pt.c.files(8, font).values())[0])
    adv = list(pt.c.files(13, font).values())[0][1:]
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

IFS = {423: 'ft2_certificate', 424: 'ft2_message', 425: 'ft2_sign', 427: 'ft2_contract'}
names = {}
for gid, ifname in IFS.items():
    C = {k: decode_if1(v) for k, v in pt.c.files(3, gid).items()}
    out = [f'// EASCape: from the August 2007 cache (interface {gid}), made by tools/fairytale2/scroll_interfaces.py', '']
    comps = []
    def com(name, lines):
        comps.append(name); out.append(f'[{name}]'); out.extend(lines); out.append('')
    n = 0
    for k in sorted(C):
        o = C[k]
        if o['type'] == 0 or o['type'] == 5:      # the close sprite and its layer
            continue
        n += 1
        if o['type'] == 6:
            com(f'com{k}', ['type=model', f"x={o['x']}", f"y={o['y']}", f"width={o['width']}", f"height={o['height']}",
                            f"model={model(o['model'])}", f"zoom={o['zoom']}", f"xan={o['xan']}", f"yan={o['yan']}"])
        elif o['type'] == 4 and o['font'] in FONT:
            text = o['text'].replace('<br>', '\\n')
            y = o['y'] + ((o['height'] - 14) // 2 if o.get('valign') else 0)
            lines = ['type=text', f"x={o['x']}", f'y={y}', f"width={o['width']}", f"height={o['height']}",
                     f"font={FONT[o['font']]}", f"text={text}", f"colour=0x{o['colour']:06X}"]
            if o.get('center'): lines.insert(6, 'center=yes')
            if o.get('shadowed'): lines.insert(6, 'shadowed=yes')
            com(f'com{k}', lines)
        elif o['type'] == 4:
            sprite = f'{ifname}_text'
            w, h = render_text(o['font'], o['text'], o['colour'], o['lineheight'], o.get('shadowed'), f'{E}/content/sprites/{sprite}.png')
            cx = o['x'] + o['width'] // 2; cy = o['y'] + o['height'] // 2
            if gid == 424:   # its box is a point at the top: the text hangs from it
                x, y = cx - w // 2, o['y']
            else:
                x, y = cx - w // 2, cy - h // 2
            com(f'com{k}', ['type=graphic', f'x={x}', f'y={y}', f'width={w}', f'height={h}', f'graphic={sprite},0'])
    close = [c for c in C.values() if c['type'] == 5 and c['menutype'] == 0][0]
    com('close', ['type=text', f"x={min(close['x'] - 44, 438)}", f"y={close['y'] + 6}", 'width=68', 'height=11', 'buttontype=close',
                  'font=p11_full', 'shadowed=yes', 'text=Close Window', 'colour=0x808080', 'overcolour=0xFFFFFF'])
    d = f'{E}/content/scripts/quests/quest_fairy2/interfaces'
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
