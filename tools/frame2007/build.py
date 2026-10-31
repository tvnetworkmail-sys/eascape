# EASCape: the 2007 game frame (the "2007 interface" app plugin), from the August 2007 cache
# (build 468): the fixed-size game frame interface 548 and its sprites, written as our sprites
# (content/sprites/f2007_*.png) for the client to draw instead of the 2006 frame:
#   f2007_frame       the still parts (borders, pillars, the chat box's border), 765x503, see-through
#                     where the client draws (the game view, minimap, side panel, chat, tab bars,
#                     chat buttons)
#   f2007_sideback    the side panel's background (sprite 1031)
#   f2007_chatback    the chat box's parchment where the chat is drawn (1017 at 20,24, 479x96)
#   f2007_topbar      the top tab bar (1036), f2007_bottombar the bottom one (1032)
#   f2007_stones      the selected tab's red stone: top-left, top-right, bottom-left, bottom-right,
#                     middle (1026-1029, 1030 cut to its 33 px cell)
#   f2007_icons       the tab icons: the top row's seven, then the bottom row's (clan chat first)
#   f2007_chatbar     the chat buttons' strip (1018); f2007_chatbtn its button (1019-1023);
#                     f2007_report the Report Abuse button (1024, 1025)
# Usage: build.py <cache468 flat dir>
import os, sys
W = os.path.dirname(os.path.abspath(__file__)); E = os.path.abspath(W + '/../..')
sys.path.insert(0, W); sys.path.insert(0, W + '/../fairytale2'); sys.path.insert(0, W + '/../warriors_guild')
from cache468 import FlatCache
from sprites468 import decode_sprites
from if3_468 import decode_if3
from PIL import Image

c = FlatCache(sys.argv[1])
OUT = f'{E}/content/sprites'
MAG = (255, 0, 255)

def spr(g):
    sp = decode_sprites(list(c.files(8, g).values())[0]); s = sp['sprites'][0]
    im = Image.new('RGBA', (sp['maxw'], sp['maxh']), (0, 0, 0, 0)); px = im.load()
    for y in range(s['h']):
        for x in range(s['w']):
            v = s['px'][x + y * s['w']]
            if v is not None:
                px[s['ox'] + x, s['oy'] + y] = ((v >> 16) & 255, (v >> 8) & 255, v & 255, 255)
    return im

def save(name, im, tile=None):
    """our sprite format: magenta is see-through, at most 255 colours"""
    rgb = Image.new('RGB', im.size, MAG); rgb.paste(im, (0, 0), im)
    if len(set(rgb.getdata())) > 256:
        q = rgb.quantize(colors=255, method=Image.Quantize.MEDIANCUT).convert('RGB')
        a = im.load(); qp = q.load()
        for y in range(im.size[1]):
            for x in range(im.size[0]):
                qp[x, y] = MAG if a[x, y][3] < 128 else (qp[x, y] if qp[x, y] != MAG else (254, 0, 254))
        rgb = q
    rgb.save(f'{OUT}/{name}.png')
    if tile:
        open(f'{OUT}/meta/{name}.opt', 'w').write(f'{tile[0]}x{tile[1]}\n')

def strip(ims, w, h):
    s = Image.new('RGBA', (w * len(ims), h), (0, 0, 0, 0))
    for i, im in enumerate(ims):
        s.alpha_composite(im, (i * w, 0))
    return s

# the frame: every shown sprite of interface 548 but the dynamic ones
F = c.files(3, 548); C = {k: decode_if3(v) for k, v in F.items()}
def absxy(k):
    x = y = 0
    while k is not None:
        x += C[k]['x']; y += C[k]['y']; k = C[k]['parent']
    return x, y
def under(k, roots):
    while k is not None:
        if k in roots or C[k]['hidden']: return True
        k = C[k]['parent']
    return False
DYNAMIC = {0, 27, 44, 95}   # chat buttons, bottom and top tab bars, side panel
frame = Image.new('RGBA', (765, 503), (0, 0, 0, 0))
for k in sorted(C):
    o = C[k]
    if o['type'] != 5 or under(k, DYNAMIC):
        continue
    im = spr(o['sprite']); ax, ay = absxy(k)
    frame.alpha_composite(im, (ax, ay))
# the chat area itself is drawn by the client
for y in range(362, 458):
    for x in range(20, 499):
        frame.putpixel((x, y), (0, 0, 0, 0))
save('f2007_frame', frame)
save('f2007_sideback', spr(1031))
save('f2007_chatback', spr(1017).crop((20, 24, 499, 120)))
save('f2007_topbar', spr(1036))
save('f2007_bottombar', spr(1032))
stones = [spr(1026), spr(1027), spr(1028), spr(1029), spr(1030).crop((0, 0, 33, 36))]
save('f2007_stones', strip(stones, 38, 36), (38, 36))
icons = [spr(g) for g in (168, 898, 899, 884, 901, 902, 903, 895, 904, 905, 906, 907, 908, 909)]
save('f2007_icons', strip(icons, 32, 36), (32, 36))
save('f2007_chatbar', spr(1018))
save('f2007_chatbtn', strip([spr(g) for g in range(1019, 1024)], 56, 22), (56, 22))
save('f2007_report', strip([spr(1024), spr(1025)], 111, 22), (111, 22))
print('written')
