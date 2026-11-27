#!/usr/bin/env python3
"""Cuts the app's UI icons (sidebar buttons, panel tabs, pins, skill and world flag icons) out of
the September 2007 game cache (build 471), so the app's chrome wears the 2007 client's own sprites
and not the older RuneScape / RuneLite pictures. They are committed as PNGs under
src/ui/assets: the sidebar has to draw before the game (and its cache) is loaded.

Sprites are archive 8 groups by id (RuneLite SpriteID numbering, which build 471 shares for these),
optionally one frame of a multi-image group (sideicons, mapfunction, sl_flags). Each is written at
its own size, pixel for pixel; one smaller than 16 px is doubled with nearest-neighbour so it stays
crisp at the size the UI shows it.

Usage: icons2007.py [cache dir] [assets dir]
  cache dir   engine/data/cache2007/cache (the flat JS5 cache: <archive>/<group>.dat)
  assets dir  app/src/ui/assets
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'cache'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'fairytale2'))
from js5 import Cache  # noqa: E402
from sprites468 import decode_sprites  # noqa: E402

# out path (under assets) -> (group, frame, why)
ICONS = {
    # sidebar buttons
    'icons/config_icon.png': (784, 0, 'Configuration: the Options tab wrench'),
    'icons/devtools_icon.png': (207, 0, 'Developer Tools: the Crafting hammer and chisel'),
    'icons/info_icon.png': (318, 66, 'Info: the minimap information "i" (mapfunction)'),
    'icons/worldhopper_icon.png': (815, 1, 'World Hopper: the world select UK flag (sl_flags)'),
    'icons/xp_icon.png': (775, 0, 'XP Tracker: the Stats tab bars'),
    'icons/infobox_icon.png': (779, 0, 'Info Boxes: the Prayer tab star'),
    'icons/loot_icon.png': (1050, 0, 'Loot Tracker: the coin pouch'),
    'icons/timetracking_watch.png': (217, 0, 'Farming: the Farming skill watering can'),
    'icons/quest_icon.png': (776, 0, 'Quest Helper: the Quest tab icon'),
    # Configuration panel tabs and plugin pins
    'icons/config_icon_lg.png': (784, 0, 'Configuration tab: the Options wrench'),
    'icons/profile_icon.png': (778, 0, 'Profiles tab: the Equipment tab figure'),
    'icons/star_on.png': (1007, 0, 'Pinned plugin: gold star'),
    'icons/star_off.png': (1008, 0, 'Unpinned plugin: silver star'),
    # Loot Tracker's overall box
    'icons/loot_big.png': (1050, 0, 'Loot Tracker total: the coin pouch'),
    # World Hopper rows: the 2007 world select flags (sl_flags 815)
    'flags/flag_us_east.png': (815, 0, 'US'),
    'flags/flag_aus.png': (815, 3, 'Australia'),
    'flags/flag_fi.png': (815, 6, 'Finland'),
}

# XP Tracker and the info boxes: the 2007 stats icons
SKILLS = {
    'attack': 197, 'strength': 198, 'defence': 199, 'ranged': 200, 'prayer': 201, 'magic': 202,
    'hitpoints': 203, 'agility': 204, 'herblore': 205, 'thieving': 206, 'crafting': 207,
    'fletching': 208, 'mining': 209, 'smithing': 210, 'fishing': 211, 'cooking': 212,
    'firemaking': 213, 'woodcutting': 214, 'runecraft': 215, 'slayer': 216, 'farming': 217,
    'hunter': 220, 'construction': 221,
}
for name, sid in SKILLS.items():
    ICONS[f'skills/{name}.png'] = (sid, 0, f'{name} skill icon')

SQUARE = {'flags'}  # drawn into square boxes: pad to a square so they aren't squashed


class FlatCache(Cache):
    def __init__(self, root):
        self.root = root
        self.refs = {}

    def raw(self, archive, group):
        p = os.path.join(self.root, str(archive), f'{group}.dat')
        return open(p, 'rb').read() if os.path.exists(p) else None


def sprite_image(cache, group, frame):
    s = decode_sprites(cache.files(8, group)[0])['sprites'][frame]
    w, h = s['w'], s['h']
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = im.load()
    for i, rgb in enumerate(s['px']):
        if rgb is None:
            continue
        a = 255 if s['alpha'] is None else s['alpha'][i]
        px[i % w, i // w] = ((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255, a)
    return im


def main(cache_dir, assets):
    cache = FlatCache(cache_dir)
    for out, (group, frame, why) in sorted(ICONS.items()):
        im = sprite_image(cache, group, frame)
        if out.split('/')[0] in SQUARE and im.width != im.height:
            n = max(im.size)
            sq = Image.new('RGBA', (n, n), (0, 0, 0, 0))
            sq.paste(im, ((n - im.width) // 2, (n - im.height) // 2))
            im = sq
        if max(im.size) < 16:
            im = im.resize((im.width * 2, im.height * 2), Image.NEAREST)
        path = os.path.join(assets, out)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        im.save(path, optimize=True)
        print(f'{out:34} {group}:{frame:<3} {im.width}x{im.height}  {why}')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'engine', 'data', 'cache2007', 'cache'),
         sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'app', 'src', 'ui', 'assets'))
