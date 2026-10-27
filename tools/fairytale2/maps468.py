# The 2007 cache's map squares (archive 5): terrain files m<x>_<z> are plain, loc files l<x>_<z>
# need the XTEA key from OpenRS2's keys.json. Decoded with tools/warriors_guild/maps.py (the
# terrain and loc formats are the same as build 451's).
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'warriors_guild'))
from cache468 import FlatCache  # noqa: E402
from maps import decode_terrain, decode_locs  # noqa: E402

class Maps468:
    def __init__(self, cache_dir, keys_file):
        self.c = FlatCache(cache_dir)
        self.keys = {k['name']: k['key'] for k in json.load(open(keys_file))}

    def squares(self):
        """(mx, mz) of every square with a terrain file"""
        r = self.c.ref(5)
        names = set(r['names'].values())
        from js5 import name_hash
        out = []
        for mx in range(100):
            for mz in range(200):
                if name_hash(f'm{mx}_{mz}') in names:
                    out.append((mx, mz))
        return out

    def terrain(self, mx, mz):
        g = self.c.group_by_name(5, f'm{mx}_{mz}')
        if g is None:
            return None
        d = list(self.c.files(5, g).values())[0]
        return decode_terrain(d)[0]

    def locs(self, mx, mz):
        g = self.c.group_by_name(5, f'l{mx}_{mz}')
        if g is None:
            return None
        key = self.keys.get(f'l{mx}_{mz}')
        d = list(self.c.files(5, g, key).values())[0]
        return decode_locs(d)
