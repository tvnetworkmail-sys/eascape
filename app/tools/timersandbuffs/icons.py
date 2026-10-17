# Builds src/plugins/timersandbuffs/icons.json: the 2004 spell icons for the Timers & Buffs
# boxes (Lost City Content sprites/magicon2.png, 20 px grid, magenta = see-through: bind 0,
# snare 1, entangle 2, charge 3) and the 2004 Thieving stat icon (pickpocket stun).
# Potion boxes use the game's own item icons, drawn by the client.
# Usage: python3 tools/timersandbuffs/icons.py <path to Lost City Content checkout>
import json, os, sys
from PIL import Image

root = os.path.join(os.path.dirname(__file__), '..', '..', 'src')
content = sys.argv[1]

def pixels(im):
    im = im.convert('RGBA')
    data = list(im.getdata())
    return {'w': im.width, 'h': im.height, 'px': [(a << 24) | (r << 16) | (g << 8) | b for r, g, b, a in data]}

sheet = Image.open(os.path.join(content, 'sprites', 'magicon2.png')).convert('RGBA')
out = {}
for name, i in [('bind', 0), ('snare', 1), ('entangle', 2), ('charge', 3)]:
    cell = sheet.crop((i * 20, 0, i * 20 + 20, 20))
    cell.putdata([(0, 0, 0, 0) if (r, g, b) == (255, 0, 255) else (r, g, b, a) for r, g, b, a in cell.getdata()])
    box = cell.getbbox()
    out[name] = pixels(cell.crop(box) if box else cell)
out['thieving'] = pixels(Image.open(os.path.join(root, 'ui', 'assets', 'skills', 'thieving.png')))
with open(os.path.join(root, 'plugins', 'timersandbuffs', 'icons.json'), 'w') as fh:
    json.dump(out, fh, separators=(',', ':'))
