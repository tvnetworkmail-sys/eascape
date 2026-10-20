# Builds src/plugins/slayer/tasks.json for the Slayer plugin from the server's own data:
#   name     the task's name (content/scripts/skill_slayer/configs/task_name.enum)
#   icon     the item drawn for it: RuneLite's choice (its Task.java) when that item is in
#            the 2006 data, otherwise the game's own Slayer guide picture, otherwise the gem
#   npcs     the names of every NPC that counts for it (param slayer_category in the NPC
#            configs), which the plugin highlights
#   weakness the item that finishes it off and the hitpoints it has to be down to, from our
#            scripts (gargoyle, rockslug, desert lizard, zygomite)
# Usage: python3 tools/slayer/tasks.py <eascape checkout> [<RuneLite checkout>]
import json, os, re, sys

repo = sys.argv[1]
runelite = sys.argv[2] if len(sys.argv) > 2 else None
here = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'plugins', 'slayer')
content = os.path.join(repo, 'content')

def pack(name):
    out = {}
    for l in open(os.path.join(content, 'pack', name + '.pack')):
        if '=' in l:
            i, n = l.strip().split('=', 1)
            out[n] = int(i)
    return out

objs = pack('obj')
consts = {m.group(1): int(m.group(2)) for m in re.finditer(r'^\^slayer_(\w+) = (\d+)', open(os.path.join(content, 'scripts', 'skill_slayer', 'configs', 'slayer.constant')).read(), re.M)}
names = {}
for m in re.finditer(r'^val=\^slayer_(\w+),\s*(.+)$', open(os.path.join(content, 'scripts', 'skill_slayer', 'configs', 'task_name.enum')).read(), re.M):
    names.setdefault(m.group(1), m.group(2).strip())

# npc names by category
bodies = {}
for dp, _, fs in os.walk(os.path.join(content, 'scripts')):
    for f in fs:
        if not f.endswith('.npc'):
            continue
        text = open(os.path.join(dp, f), encoding='utf-8', errors='replace').read()
        for m in re.finditer(r'^\[([^\]]+)\]\n(.*?)(?=^\[|\Z)', text, re.S | re.M):
            bodies[m.group(1)] = bodies.get(m.group(1), '') + m.group(2)  # a block can be split over files
npcs = {}
for body in bodies.values():
    c = re.search(r'^param=slayer_category,\^slayer_(\w+)', body, re.M)
    n = re.search(r'^name=(.+)$', body, re.M)
    if c and n:
        npcs.setdefault(c.group(1), set()).add(n.group(1).strip())
# fungi wake up as zygomites (RuneLite highlights "Fungi" for the task too)
npcs.setdefault('mutatedzygomite', set()).add('Fungi')

# RuneLite's pictures, by task name
rl = {}
if runelite:
    path = os.path.join(runelite, 'runelite-client', 'src', 'main', 'java', 'net', 'runelite', 'client', 'plugins', 'slayer', 'Task.java')
    for m in re.finditer(r'^\s*[A-Z_]+\("([^"]+)", ItemID\.([A-Z0-9_]+)', open(path).read(), re.M):
        rl[m.group(1).lower()] = m.group(2).lower()
def norm(s):
    s = s.lower().replace('vampires', 'vampyres')
    return re.sub(r'(es|s)$', '', s.replace(' ', ''))
rl_norm = {norm(k): v for k, v in rl.items()}

GUIDE = {'pyrefiend': 'slayerguide_pyrfiend', 'darkbeast': 'slayerguide_dark_beast', 'harpiebugswarm': 'slayerguide_swarm',
         'feverspider': 'slayerguide_fever_spider', 'cavebug': 'swamp_cave_bug', 'caveslime': 'swamp_cave_slime',
         'wallbeast': 'swamp_wallbeast', 'mutatedzygomite': 'slayer_zygomite_object'}
# 2006 items for the tasks where RuneLite's picture is a later item (a dragon mask, a POH
# trophy...); our choice, the nearest thing the 2006 game has
PICK = {'rat': 'eascape_slayerguide_rat', 'monkey': 'mm_normal_monkey_bones', 'goblin': 'goblin_armour', 'spider': 'red_spiders_eggs', 'cow': 'cow_hide',
        'scorpion': 'scorpioncagefull', 'bat': 'bat_bones', 'skeleton': 'bones', 'bear': 'raw_bear_meat',
        'hillgiant': 'big_bones', 'icegiant': 'big_bones', 'firegiant': 'big_bones', 'mossgiant': 'big_bones',
        'ogre': 'ogretooth', 'greendragon': 'dragonhide_green', 'bluedragon': 'dragonhide_blue',
        'reddragon': 'dragonhide_red', 'blackdragon': 'dragonhide_black', 'dagannoth': 'dagannoth_king_bones',
        'bronzedragon': 'bronze_bar', 'irondragon': 'iron_bar', 'steeldragon': 'steel_bar', 'earthwarrior': 'earthrune',
        'dwarf': 'dwarf_goldrock_helmet', 'lesserdemon': 'champions_challenge_lesserdemon',
        'hobgoblin': 'champions_challenge_hobgoblin', 'dog': 'bones', 'wolf': 'grey_wolf_fur'}
WEAKNESS = {'gargoyle': (8, 'slayer_rock_hammer'), 'rockslug': (4, 'slayer_bag_of_salt'),
            'lizard': (4, 'slayer_icy_water'), 'mutatedzygomite': (7, 'slayer_spray_pump_10')}

out = {}
for key, cid in sorted(consts.items(), key=lambda x: x[1]):
    if key not in names:
        continue
    icon = PICK.get(key) if PICK.get(key) in objs else None
    choice = None if icon else rl_norm.get(norm(names[key]))
    if choice and choice in objs:
        icon = choice
    if not icon:
        for cand in (GUIDE.get(key), 'slayerguide_' + key):
            if cand and cand in objs:
                icon = cand
                break
    icon = icon or 'slayer_gem'
    t = {'key': key, 'name': names[key], 'icon': objs[icon], 'iconName': icon, 'npcs': sorted(npcs.get(key, []))}
    if key in WEAKNESS:
        t['weakness'] = {'hp': WEAKNESS[key][0], 'item': objs[WEAKNESS[key][1]]}
    out[cid] = t
os.makedirs(here, exist_ok=True)
with open(os.path.join(here, 'tasks.json'), 'w') as fh:
    json.dump(out, fh, indent=0, sort_keys=True)
print(len(out), 'tasks;', sum(1 for t in out.values() if t['iconName'] == 'slayer_gem'), 'with the gem as picture')
for t in out.values():
    print(t['name'], t['iconName'], len(t['npcs']))
