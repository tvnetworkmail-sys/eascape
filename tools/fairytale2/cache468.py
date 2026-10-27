# The August 2007 cache (build 468, OpenRS2 633) as OpenRS2's flat export has it:
# <root>/<archive>/<group>.dat, each a JS5 container. Same interface as
# tools/warriors_guild/js5.Cache (raw, decompress, ref, files), so its decoders and the Warriors'
# Guild converter's approach work unchanged.
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'warriors_guild'))
from js5 import Cache, xtea_decrypt, name_hash  # noqa: F401

class FlatCache(Cache):
    def __init__(self, root):
        self.root = root
        self.refs = {}

    def raw(self, archive, group):
        p = os.path.join(self.root, str(archive), f'{group}.dat')
        if not os.path.exists(p):
            return None
        return open(p, 'rb').read()
