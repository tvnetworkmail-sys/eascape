# Builds the respawn tables for the Woodcutting and Mining plugins from Lost City's Content:
#   src/plugins/woodcutting/trees.json  { locId: { name, min, max } }   ticks (trees.dbrow)
#   src/plugins/mining/rocks.json       { locId: { name, min, max } }   ticks (mine.dbrow)
# A tree with respawnrate 0 respawns after 120-199 ticks (woodcut.rs2). Both are scaled by
# the world's player count on the server ((4000 - players) / 4000, player_count.rs2).
# Give every revision's checkout (274 first, then 377): loc ids are Jagex's and the same in
# both, so the tables merge; where both have a loc, the first one given wins.
# Usage: python3 tools/skilling/build.py <Content 274> [<Content 377> ...]
import glob, json, os, re, sys

root = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'plugins')

def pack(content, name):
    ids = {}
    for line in open(os.path.join(content, 'pack', name + '.pack')):
        m = re.match(r'(\d+)=(\S+)', line.strip())
        if m:
            ids[m.group(2)] = int(m.group(1))
    return ids

def rows(path):
    out, cur = [], None
    for line in open(path):
        line = line.strip()
        if line.startswith('['):
            cur = {'_name': line[1:-1], 'data': []}
            out.append(cur)
        elif cur and line.startswith('data='):
            k, _, v = line[5:].partition(',')
            cur['data'].append((k, v))
    return out

def find(content, name):
    return glob.glob(os.path.join(content, 'scripts', '**', name), recursive=True)

trees = {}
rocks = {}
for content in sys.argv[1:]:
    locs = pack(content, 'loc')
    for path in find(content, 'trees.dbrow'):
        for r in rows(path):
            rate = next((int(v) for k, v in r['data'] if k == 'respawnrate'), 0)
            lo, hi = (120, 199) if rate == 0 else (rate, rate)
            label = r['_name'].replace('_tree_table', '').replace('_table', '').replace('_', ' ')
            for k, v in r['data']:
                if k == 'tree' and v in locs:
                    trees.setdefault(locs[v], {'name': label, 'min': lo, 'max': hi})
    for path in find(content, 'mine.dbrow'):
        for r in rows(path):
            rate = next((int(v) for k, v in r['data'] if k == 'rock_respawnrate'), 0)
            name = next((v for k, v in r['data'] if k == 'ore_name'), r['_name'])
            if rate <= 0:
                continue
            for k, v in r['data']:
                if k == 'rock' and v in locs:
                    rocks.setdefault(locs[v], {'name': name, 'min': rate, 'max': rate})

for folder, data in (('woodcutting', trees), ('mining', rocks)):
    os.makedirs(os.path.join(root, folder), exist_ok=True)
    with open(os.path.join(root, folder, 'trees.json' if folder == 'woodcutting' else 'rocks.json'), 'w') as fh:
        json.dump(data, fh, separators=(',', ':'), sort_keys=True)
print(len(trees), 'trees', len(rocks), 'rocks')
