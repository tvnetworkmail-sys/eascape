# Builds src/plugins/loottracker/clues.json: { itemId: 'Easy' | 'Medium' | 'Hard' } for every
# clue scroll and casket (Lost City Content, game_trail configs, by category), so the Loot
# Tracker can tell which tier a Treasure Trail reward was. Give every revision's checkout
# (274 and 377): item ids are Jagex's and the same in both, so the tables merge.
# Usage: python3 tools/skilling/clues.py <Content 274> [<Content 377> ...]
import glob, json, os, re, sys

out = {}
for content in sys.argv[1:]:
    ids = {}
    for line in open(os.path.join(content, 'pack', 'obj.pack')):
        m = re.match(r'(\d+)=(\S+)', line.strip())
        if m:
            ids[m.group(2)] = int(m.group(1))
    for f in glob.glob(os.path.join(content, 'scripts', '**', 'game_trail', 'configs', '*.obj'), recursive=True):
        name = None
        for line in open(f):
            line = line.strip()
            if line.startswith('['):
                name = line[1:-1]
            m = re.match(r'category=trail_(?:clue|casket)_(easy|medium|hard|elite|master)', line)
            if m and name in ids:
                out[ids[name]] = m.group(1).capitalize()
dest = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'plugins', 'loottracker', 'clues.json')
json.dump(out, open(dest, 'w'), separators=(',', ':'), sort_keys=True)
print(len(out), 'clue items', sorted(set(out.values())))
