# Builds src/plugins/fishing/fishing.json for the Fishing plugin: for every fishing spot NPC,
# the fish you can catch there (in the order of its options) and the fish whose icon marks it,
# from Lost City's fishing spot scripts ([opnpc1,_saltfish] @attempt_fish_shrimp -> the label's
# "~fish_roll(raw_shrimp, raw_anchovies, ...)", following procs it calls). Give the 274
# checkout, then 377: ids are Jagex's and the same in both, so the tables merge.
# Usage: python3 tools/skilling/fishing.py <Content 274> [<Content 377> ...]
import glob, json, os, re, sys

# RuneLite's FishingSpot icons: the spot's best-known fish
ICON = ['raw_lobster', 'raw_shark', 'raw_salmon', 'raw_shrimps', 'raw_lava_eel', 'tbwt_raw_karambwan', 'raw_karambwan', 'raw_monkfish', 'mort_slimey_eel', 'raw_cave_eel', 'raw_pike']

def pack(content, name):
    ids = {}
    for line in open(os.path.join(content, 'pack', name + '.pack')):
        m = re.match(r'(\d+)=(\S+)', line.strip())
        if m:
            ids[m.group(2)] = int(m.group(1))
    return ids

def configs(content, ext):
    out = {}
    for f in glob.glob(os.path.join(content, 'scripts', '**', '*' + ext), recursive=True):
        cur = None
        for line in open(f, encoding='utf-8', errors='replace'):
            s = line.strip()
            if s.startswith('[') and s.endswith(']'):
                cur = out.setdefault(s[1:-1], {})
            elif cur is not None and '=' in s and not s.startswith('//'):
                k, v = s.split('=', 1)
                cur.setdefault(k, v)
    return out

def parts(text):
    """'[kind,name]' -> body, for every trigger, label and proc in a script."""
    marks = [(m.start(), m.group(1), m.group(2)) for m in re.finditer(r'^\[(\w+),(\w+)\]', text, re.M)]
    out = {}
    for i, (pos, kind, name) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(text)
        out[(kind, name)] = text[pos:end]
    return out

spots = {}
for content in sys.argv[1:]:
    npc_ids = pack(content, 'npc')
    obj_ids = pack(content, 'obj')
    npcs = configs(content, '.npc')
    objs = configs(content, '.obj')
    scripts = ''.join(open(f, encoding='utf-8', errors='replace').read() + '\n' for f in glob.glob(os.path.join(content, 'scripts', 'skill_fishing', '**', '*.rs2'), recursive=True))
    p = parts(scripts)

    def fish_in(body, depth=0):
        found = []
        # what ~fish_roll(fish1, fish2, ...) catches, and any raw fish named (tbwt_raw_karambwan)
        names = [a for call in re.findall(r'~fish_roll\((\w+), (\w+)', body) for a in call if a != 'null']
        names += re.findall(r'\b(\w*raw_\w+)\b', body)
        for f in names:
            if f in obj_ids and f not in found:
                found.append(f)
        if depth < 2:
            for call in re.findall(r'[@~](\w+)', body):
                for kind in ('label', 'proc'):
                    if (kind, call) in p:
                        found += [x for x in fish_in(p[(kind, call)], depth + 1) if x not in found]
        return found

    targets = {}
    for (kind, name), body in p.items():
        m = re.match(r'opnpc([1-5])$', kind)
        if m:
            targets.setdefault(name, {})[int(m.group(1))] = fish_in(body)
    for target, ops in targets.items():
        fish = []
        for op in sorted(ops):
            fish += [f for f in ops[op] if f not in fish]
        if not fish:
            continue
        names = [n for n, d in npcs.items() if d.get('category') == target[1:]] if target.startswith('_') else [target]
        icon = next((f for f in ICON if f in fish), fish[0])
        for n in names:
            if n not in npc_ids:
                continue
            spots.setdefault(str(npc_ids[n]), {
                'fish': [{'id': obj_ids[f], 'name': objs.get(f, {}).get('name', f.replace('_', ' ')).replace('Raw ', '').capitalize()} for f in fish],
                'icon': obj_ids[icon],
            })

out = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'plugins', 'fishing', 'fishing.json')
json.dump(spots, open(out, 'w'), separators=(',', ':'), sort_keys=True)
kinds = {}
for s in spots.values():
    kinds.setdefault(', '.join(f['name'] for f in s['fish']), 0)
    kinds[', '.join(f['name'] for f in s['fish'])] += 1
for k, v in sorted(kinds.items()):
    print(v, k)
print(len(spots), 'fishing spot npcs')
