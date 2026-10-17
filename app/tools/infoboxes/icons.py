# Builds src/plugins/infoboxes/icons.json: images for the info boxes, as ARGB pixels the page
# side draws into the game view.
#   skills:  the 2004 stat icons (src/ui/assets/skills, cut from Lost City's staticons)
#   prayers: the 2004 prayer icons (Lost City Content sprites/prayeron.png, 4 x 4 grid of
#            30 px, magenta = see-through), in prayer order (varps prayer0..prayer14)
#   hourglass, boostup: LostLite's own small drawings
# Usage: python3 tools/infoboxes/icons.py <path to Lost City Content checkout>
import glob, json, os, sys
from PIL import Image, ImageDraw

root = os.path.join(os.path.dirname(__file__), '..', '..', 'src')
content = sys.argv[1] if len(sys.argv) > 1 else None

def pixels(im):
    im = im.convert('RGBA')
    return {'w': im.width, 'h': im.height, 'px': [(a << 24) | (r << 16) | (g << 8) | b for r, g, b, a in im.getdata()]}

out = {'skills': {}, 'prayers': [], 'misc': {}}
for f in sorted(glob.glob(os.path.join(root, 'ui', 'assets', 'skills', '*.png'))):
    out['skills'][os.path.basename(f)[:-4]] = pixels(Image.open(f))

if content:
    sheet = Image.open(os.path.join(content, 'sprites', 'prayeron.png')).convert('RGBA')
    for i in range(15):
        cell = sheet.crop(((i % 4) * 30, (i // 4) * 30, (i % 4) * 30 + 30, (i // 4) * 30 + 30))
        data = [(0, 0, 0, 0) if (r, g, b) == (255, 0, 255) else (r, g, b, a) for r, g, b, a in cell.getdata()]
        cell.putdata(data)
        box = cell.getbbox()
        out['prayers'].append(pixels(cell.crop(box) if box else cell))
else:
    old = json.load(open(os.path.join(root, 'plugins', 'infoboxes', 'icons.json')))
    out['prayers'] = old['prayers']

# hourglass (idle logout), 16 x 24: frame, glass, sand
hg = Image.new('RGBA', (16, 24), (0, 0, 0, 0))
d = ImageDraw.Draw(hg)
wood, dark, glass, sand = (150, 100, 50, 255), (60, 40, 20, 255), (200, 225, 235, 200), (230, 190, 90, 255)
d.polygon([(2, 3), (13, 3), (8, 12), (13, 20), (2, 20), (7, 12)], fill=glass, outline=dark)
d.polygon([(4, 6), (11, 6), (8, 11), (7, 11)], fill=sand)
d.polygon([(7, 14), (8, 14), (12, 19), (3, 19)], fill=sand)
d.line([(7, 11), (7, 18)], fill=sand)
d.rectangle([0, 0, 15, 2], fill=wood, outline=dark)
d.rectangle([0, 21, 15, 23], fill=wood, outline=dark)
out['misc']['hourglass'] = pixels(hg)

# green up arrow with a clock tick (next boost drop), 18 x 22
ar = Image.new('RGBA', (18, 22), (0, 0, 0, 0))
d = ImageDraw.Draw(ar)
d.polygon([(9, 1), (17, 10), (12, 10), (12, 20), (6, 20), (6, 10), (1, 10)], fill=(40, 200, 40, 255), outline=(0, 70, 0, 255))
out['misc']['boostup'] = pixels(ar)

with open(os.path.join(root, 'plugins', 'infoboxes', 'icons.json'), 'w') as fh:
    json.dump(out, fh, separators=(',', ':'))
