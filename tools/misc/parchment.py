# EASCape: the "Resources collected" parchment (Managing Miscellania) cut from your OSRS screenshot
# (resources_collected_osrs.png, 31 Oct 2026): the title and items are painted over with the
# parchment 80 px below them (the window draws its own), see-through outside the paper
# (magenta, the sprite packer's transparent colour), at most 255 colours.
# Usage: python3 tools/misc/parchment.py
import os
from PIL import Image
W = os.path.dirname(os.path.abspath(__file__)); E = os.path.abspath(W + '/../..')
im = Image.open(f'{W}/resources_collected_osrs.png').convert('RGBA')
px = im.load()
for y in range(8, 60):
    for x in range(6, 175):
        if px[x, y][3] == 255 and px[x, y + 80][3] == 255:
            px[x, y] = px[x, y + 80]
w, h = im.size
mask = [[px[x, y][3] >= 128 for x in range(w)] for y in range(h)]
rgb = Image.new('RGB', (w, h))
rgb.paste(im.convert('RGB'))
q = rgb.quantize(colors=255, method=Image.Quantize.MEDIANCUT).convert('RGB')
qp = q.load()
for y in range(h):
    for x in range(w):
        if not mask[y][x]:
            qp[x, y] = (255, 0, 255)
        elif qp[x, y] == (255, 0, 255):
            qp[x, y] = (254, 0, 254)
q.save(f'{E}/content/sprites/eascape_parchment.png')
print('colours', len(set(q.getdata())))
