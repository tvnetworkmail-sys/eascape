# EASCape: the "Resources Collected" scroll (Managing Miscellania), cut from your OSRS screenshot
# (resources_collected_osrs_ingame.png, 31 Oct 2026) at its own size, scroll bar and close knot
# included. The paper is picked out by colour (the largest parchment-coloured patch, holes
# filled) and its right edge, against the light floor, is set by hand; the title and the items
# are painted over with the paper 150 px below them (the window draws its own). See-through is
# magenta (the sprite packer's transparent colour); at most 255 colours.
# Usage: python3 tools/misc/parchment.py   (prints where the sprite's paper starts)
import os, collections
from PIL import Image
W_ = os.path.dirname(os.path.abspath(__file__)); E = os.path.abspath(W_ + '/../..')
im = Image.open(f'{W_}/resources_collected_osrs_ingame.png').convert('RGB'); px = im.load()
X0, Y0, X1, Y1 = 20, 85, 420, 400
W, H = X1 - X0, Y1 - Y0

def paper(c):
    r, g, b = c
    return 120 <= r <= 215 and r >= g >= b and 25 <= r - b <= 85 and g - b >= 12 and r - g <= 35

m = [[paper(px[X0 + x, Y0 + y]) for x in range(W)] for y in range(H)]
comp = set(); q = collections.deque([(150, 150)]); seen = {(150, 150)}
while q:
    x, y = q.popleft(); comp.add((x, y))
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        a, b = x + dx, y + dy
        if 0 <= a < W and 0 <= b < H and (a, b) not in seen and m[b][a]:
            seen.add((a, b)); q.append((a, b))
out = set(); q = collections.deque()
for x in range(W):
    for y in (0, H - 1):
        if (x, y) not in comp: out.add((x, y)); q.append((x, y))
for y in range(H):
    for x in (0, W - 1):
        if (x, y) not in comp and (x, y) not in out: out.add((x, y)); q.append((x, y))
while q:
    x, y = q.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        a, b = x + dx, y + dy
        if 0 <= a < W and 0 <= b < H and (a, b) not in out and (a, b) not in comp:
            out.add((a, b)); q.append((a, b))
o = Image.new('RGB', (W, H), (255, 0, 255)); op = o.load()
for y in range(H):
    edge = 400 - max(0, y + Y0 - 110) * 5 / 250  # the paper's right edge against the floor
    for x in range(W):
        if (x, y) not in out and x + X0 <= edge:
            op[x, y] = px[X0 + x, Y0 + y]
# paint out the title and the items (left of the close knot and the scroll bar): each column is
# blended from the paper just above to the paper just below
M = (255, 0, 255)
def avg(y, x):  # the paper colour around (x, y), from up to 7 paper pixels on that row
    c = [op[i, y] for i in range(x - 3, x + 4) if 0 <= i < W and op[i, y] != M]
    return tuple(sum(v[k] for v in c) / len(c) for k in range(3)) if c else None
TOP, BOT = 30, 132
for x in range(10, 352):
    top = TOP if x < 344 else 48  # under the close knot
    a, b = avg(top, x), avg(BOT, x)
    if a is None or b is None:
        continue
    for y in range(top + 1, BOT):
        if op[x, y] == M:
            continue
        t = (y - top) / (BOT - top)
        op[x, y] = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
xs = [x for y in range(H) for x in range(W) if op[x, y] != (255, 0, 255)]
ys = [y for y in range(H) for x in range(W) if op[x, y] != (255, 0, 255)]
o = o.crop((min(xs), min(ys), max(xs) + 1, max(ys) + 1))
q8 = o.quantize(colors=255, method=Image.Quantize.MEDIANCUT).convert('RGB')
mask_src = o.load(); qp = q8.load()
for y in range(q8.size[1]):
    for x in range(q8.size[0]):
        if mask_src[x, y] == (255, 0, 255): qp[x, y] = (255, 0, 255)
        elif qp[x, y] == (255, 0, 255): qp[x, y] = (254, 0, 254)
q8.save(f'{E}/content/sprites/eascape_parchment.png')
print('size', q8.size, 'paper starts at screenshot', min(xs) + X0, min(ys) + Y0)
