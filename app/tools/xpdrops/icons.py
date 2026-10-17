# Builds src/plugins/xpdrops/icons.json: the 2004 stat icons (src/ui/assets/skills) scaled to
# XP drop size, as ARGB pixels the page side draws straight into the game view.
import glob, json, os
from PIL import Image

root = os.path.join(os.path.dirname(__file__), '..', '..', 'src')
out = {}
MAX_H, MAX_W = 15, 17
for f in sorted(glob.glob(os.path.join(root, 'ui', 'assets', 'skills', '*.png'))):
    im = Image.open(f).convert('RGBA')
    s = min(MAX_H / im.height, MAX_W / im.width, 1)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    px = [(a << 24) | (r << 16) | (g << 8) | b for r, g, b, a in im.getdata()]
    out[os.path.basename(f)[:-4]] = {'w': im.width, 'h': im.height, 'px': px}
with open(os.path.join(root, 'plugins', 'xpdrops', 'icons.json'), 'w') as fh:
    json.dump(out, fh, separators=(',', ':'))
