# The width of a string in one of our fonts, as the 377 client measures it (PixFont.depack: each
# glyph's width + 2, less 1 for a mostly empty left or right column; a space as wide as "i").
from PIL import Image
import os
E = os.path.abspath(os.path.dirname(os.path.abspath(__file__)) + '/../..')

def advances(font):
    im = Image.open(f'{E}/content/fonts/{font}.png').convert('RGBA')
    meta = open(f'{E}/content/fonts/meta/{font}.opt').read().split()
    cw, ch = map(int, meta[0].split('x'))
    cols = im.size[0] // cw
    adv = []
    for c, line in enumerate(meta[1:257]):
        ox, oy, w, h = map(int, line.split(','))
        bx, by = (c % cols) * cw, (c // cols) * ch
        m = lambda x, y: 0 if im.getpixel((bx + ox + x, by + oy + y))[:3] == (255, 0, 255) else 1
        a = w + 2
        if sum(m(0, y) for y in range(h // 7, h)) <= h // 7: a -= 1
        if sum(m(w - 1, y) for y in range(h // 7, h)) <= h // 7: a -= 1
        adv.append(a)
    adv[32] = adv[105]
    return adv

def width(adv, s):
    return sum(adv[ord(ch)] for ch in s)
