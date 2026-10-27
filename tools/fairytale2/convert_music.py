# Fairytale II's three tracks from the August 2007 cache (archive 6, Jagex's packed format) as
# standard MIDI files in content/songs, with new ids after ours in midi.pack. Names as the cache
# has them ("alls fairy in love n war" is the wiki's "All's Fairy in Love & War").
# Usage: convert_music.py <cache468 flat dir>   (run once)
import os, sys
W = os.path.dirname(os.path.abspath(__file__)); E = os.path.abspath(W + '/../..')
sys.path.insert(0, W)
from cache468 import FlatCache
from track2midi import convert
c = FlatCache(sys.argv[1])
pack = f'{E}/content/pack/midi.pack'
ids = {int(l.split('=')[0]): l.split('=', 1)[1].strip() for l in open(pack) if '=' in l}
nxt = max(ids) + 1
with open(pack, 'a') as f:
    for name in ('we are the fairies', 'dimension x', 'alls fairy in love n war'):
        if name in ids.values():
            continue
        g = c.group_by_name(6, name)
        open(f'{E}/content/songs/{name}.mid', 'wb').write(convert(list(c.files(6, g).values())[0]))
        f.write(f'{nxt}={name}\n'); print(nxt, name); nxt += 1
