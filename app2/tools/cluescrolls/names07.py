# python3 -I app/tools/cluescrolls/names07.py (NAMES07=out.json), then
#   RL_SRC=<runelite checkout> NAMES07=out.json python3 -I app/tools/cluescrolls/gen.py app/src/plugins/cluescrolls/data.js
# (server_clues.json: our server's clue list, from content/scripts/minigames/game_trail.)
# Dump 2007 (build 471) obj and npc names: {"obj": {id: name}, "npc": {id: name}}
import sys, os, json
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.insert(0, ROOT + '/tools/cache')
sys.path.insert(0, ROOT + '/tools/warriors_guild')
sys.path.insert(0, ROOT + '/tools/fairytale2')
sys.argv = [sys.argv[0]]
from js5 import Cache
from defs451 import decode_obj, decode_npc


class FlatCache(Cache):
    def __init__(self, root):
        self.root = root; self.refs = {}

    def raw(self, archive, group):
        p = os.path.join(self.root, str(archive), str(group) + '.dat')
        return open(p, 'rb').read() if os.path.exists(p) else None


c = FlatCache(os.path.join(ROOT, 'engine', 'data', 'cache2007', 'openrs2-236', 'cache'))
O = {i: decode_obj(d).get('name') for i, d in c.files(2, 10).items()}
N = {i: decode_npc(d).get('name') for i, d in c.files(2, 9).items()}
json.dump({'obj': O, 'npc': N}, open(os.environ.get('NAMES07', '/tmp/names07.json'), 'w'))
print(len(O), len(N), O.get(2677), O.get(952), N.get(1))
