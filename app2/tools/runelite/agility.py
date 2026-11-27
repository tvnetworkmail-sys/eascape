"""Agility clone data from RuneLite's source, trimmed to the 2007 cache.

    RUNELITE_SRC=<RuneLite checkout> python3 agility.py

writes app/src/plugins/agility/obstacles.js (Obstacles.java's sets) and
app/src/plugins/runelite/agilityshortcut.js (net.runelite.client.game.AgilityShortcut).

An OSRS object id is kept when the 2007 cache has the same object there (its debug name is the gameval name);
a name found elsewhere in the 2007 cache gives that id. The classic courses' objects that Jagex later replaced
with new ids (Gnome, Barbarian, Wilderness: OSRS 23131..23640, 20211) map to their 2007 objects in MANUAL, by
the server's course scripts (content/scripts/skill_agility). Anything else is later content and is left out.
"""
import json
import os
import re
import sys

import gameval as gv

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.normpath(os.path.join(HERE, '..', '..'))
JAVA = os.path.join(gv.RL, 'runelite-client/src/main/java/net/runelite/client')

MANUAL = {
    # Gnome Stronghold course
    'GNOME_LOG_BALANCE1': [2295], 'OBSTICAL_NET2': [2285], 'CLIMBING_BRANCH': [2313], 'BALANCING_ROPE': [2312],
    'CLIMBING_TREE': [2314, 2315], 'OBSTICAL_NET3': [2286], 'OBSTICAL_PIPE3_1': [4058], 'OBSTICAL_PIPE3_2': [154],
    # Barbarian Outpost course
    'OBSTICAL_ROPESWING1': [2282], 'BARBARIAN_LOG_BALANCE1': [2294], 'AGILITY_OBSTICAL_NET_BARBARIAN': [2284],
    'BALANCING_LEDGE1': [2302],
    # Wilderness course
    'OBSTICAL_PIPE2': [2288], 'OBSTICAL_ROPESWING2': [2283], 'STEPPINGSTONE1': [2311], 'WILDERNESS_LOG_BALANCE1': [2297],
    'WILDCLIMBINGROCK': [2328],
    # Ape Atoll and Werewolf courses: renumbered in our cache, matched by name and place (the 2007 maps' interactive locs in
    # the courses' regions 11050 and 14234). The skull slope is one OSRS object on both courses, two in 2007.
    '_100_ILM_STEPPING_STONE': [12568], '_100_ILM_CLIMBABLE_TREE': [12570], '_100_ILM_MONKEYBARS_START': [12573],
    '_100_ILM_CLIFF_CLIMB_1': [12576, 5136], '_100_ILM_ROPE_SWING': [12578], '_100_ILM_AGILITY_TREE_BASE': [12618],
    'WEREWOLF_STEPING_STONE': [5138], 'WEREWOLF_HURDLE_MID': [5133], 'WEREWOLF_HURDLE_END': [5134],
    'WEREWOLF_HURDLE_END_MIRROR': [5135], 'WAA_PIPE': [5152], 'WEREWOLF_SLIDE_CENTER': [5139], 'WEREWOLF_SLIDE_SIDE': [5140],
    'WEREWOLF_SLIDE_SIDE_MIRROR': [5141],
    # (the Penguin course's area isn't in our 2007 maps: its objects stay out)
}

dropped = []
by_location = []
_agility_locs = None


def agility_locs():
    """the 2007 locs our server's scripts handle (oploc) in files about Agility, and every placement of them"""
    global _agility_locs
    if _agility_locs is not None:
        return _agility_locs
    names = set()
    for root, _, files in os.walk(os.path.join(gv.REPO, 'content/scripts')):
        for f in files:
            if f.endswith('.rs2'):
                t = open(os.path.join(root, f), errors='replace').read()
                if 'agility' in t:
                    names.update(re.findall(r'^\[oploc\d,([a-z0-9_]+)\]', t, re.M))
    ids = {i for i, n in gv.pack('ObjectID').items() if n in names}
    placed = []  # (x, y, level, id)
    mdir = os.path.join(gv.REPO, 'content/maps')
    for f in os.listdir(mdir):
        m = re.match(r'm(\d+)_(\d+)\.jm2$', f)
        if not m:
            continue
        bx, bz = int(m.group(1)) * 64, int(m.group(2)) * 64
        sect = None
        for line in open(os.path.join(mdir, f)):
            if line.startswith('===='):
                sect = line.strip()
                continue
            if sect != '==== LOC ====':
                continue
            p = re.match(r'(\d+) (\d+) (\d+): (\d+)', line)
            if p and int(p.group(4)) in ids:
                placed.append((bx + int(p.group(2)), bz + int(p.group(3)), int(p.group(1)), int(p.group(4))))
    _agility_locs = placed
    return placed


def near_agility_locs(wp, dist=2):
    out = []
    for x, y, lv, i in agility_locs():
        if lv == wp[2] and abs(x - wp[0]) <= dist and abs(y - wp[1]) <= dist and i not in out:
            out.append(i)
    return out


def resolve(name):
    if name in MANUAL:
        return MANUAL[name]
    osrs = gv.gameval('ObjectID').get(name)
    pk = gv.pack('ObjectID')
    if osrs is not None and pk.get(osrs) == name.lower():
        return [osrs]
    for i, n in pk.items():
        if n == name.lower():
            return [i]
    dropped.append(name)
    return []


def ids_in(text):
    out = []
    for n in gv.refs(text, 'ObjectID'):
        for i in resolve(n):
            if i not in out:
                out.append(i)
    return out


def java_set(src, name):
    m = re.search(r'static final (?:Set|List)<Integer> ' + name + r' = Immutable\w+\.of\((.*?)\);', src, re.S)
    return m.group(1) if m else ''


def split_top(s):
    """split on top-level commas"""
    out, depth, cur = [], 0, ''
    for ch in s:
        if ch in '({':
            depth += 1
        elif ch in ')}':
            depth -= 1
        if ch == ',' and depth == 0:
            out.append(cur.strip())
            cur = ''
        else:
            cur += ch
    if cur.strip():
        out.append(cur.strip())
    return out


def world_point(s):
    m = re.match(r'new WorldPoint\((\d+),\s*(\d+),\s*(\d+)\)', s)
    return [int(m.group(1)), int(m.group(2)), int(m.group(3))] if m else None


def shortcuts():
    src = open(os.path.join(JAVA, 'game/AgilityShortcut.java')).read()
    body = src[src.index('{', src.index('public enum AgilityShortcut')) + 1:]
    body = body[:body.index('@Getter\n\tprivate final int level')]
    body = re.sub(r'//[^\n]*', '', body)
    body = re.sub(r'/\*.*?\*/', '', body, flags=re.S)
    out = []
    i = 0
    while True:
        m = re.compile(r'([A-Z][A-Z0-9_]+)\(').search(body, i)
        if not m:
            break
        depth, j = 1, m.end()
        while depth:
            depth += {'(': 1, ')': -1}.get(body[j], 0)
            j += 1
        args = split_top(body[m.end():j - 1])
        # an overridden matches() body follows in braces: skip it
        k = j
        while k < len(body) and body[k] in ' \t\n':
            k += 1
        override = None
        if k < len(body) and body[k] == '{':
            depth, e = 1, k + 1
            while depth:
                depth += {'{': 1, '}': -1}.get(body[e], 0)
                e += 1
            override = body[k:e]
            j = e
        i = j
        level, desc = int(args[0]), json.loads(args[1])
        rest = args[2:]
        map_loc = world_point(rest[0]) if rest and rest[0] != 'null' else None
        rest = rest[1:]
        world_loc = map_loc
        if rest and rest[0].startswith('new WorldPoint'):
            world_loc = world_point(rest[0])
            rest = rest[1:]
        names = [r.split('.', 1)[1] for r in rest if r.startswith('ObjectID.')]
        ids = []
        for n in names:
            for x in resolve(n):
                if x not in ids:
                    ids.append(x)
        if names and not ids and world_loc:
            # an OSRS object id that replaced a 2007 one: the 2007 agility object our server handles at that spot
            ids = near_agility_locs(world_loc)
            if ids:
                by_location.append(m.group(1))
        if names and not ids:
            continue  # every object is later content
        if override:
            # WEISS_BROKEN_FENCE (multiloc, 2016) and DARKMEYER_WALL_ROCKS (Sins of the Father, 2019) are later content
            dropped.append(m.group(1) + ' (matches override)')
            continue
        out.append({'name': m.group(1), 'level': level, 'description': desc, 'worldMapLocation': map_loc, 'worldLocation': world_loc, 'obstacleIds': ids})
    return out


def main():
    src = open(os.path.join(JAVA, 'plugins/agility/Obstacles.java')).read()
    obstacle_text = java_set(src, 'OBSTACLE_IDS')
    # the course sections, kept for the 2007 ones only (rooftops, Prifddinas, Shayzien, Varlamore etc. are later)
    data = {
        'OBSTACLE_IDS': ids_in(obstacle_text),
        'PORTAL_OBSTACLE_IDS': ids_in(java_set(src, 'PORTAL_OBSTACLE_IDS')),
        'TRAP_OBSTACLE_IDS': ids_in(java_set(src, 'TRAP_OBSTACLE_IDS')),
        'TRAP_OBSTACLE_REGIONS': [12105, 13356],
        'SEPULCHRE_OBSTACLE_IDS': [],
        'SEPULCHRE_SKILL_OBSTACLE_IDS': [],
    }
    with open(os.path.join(APP, 'src/plugins/agility/obstacles.js'), 'w') as f:
        f.write('// Generated by app/tools/runelite/agility.py from RuneLite\'s Obstacles.java, trimmed to the 2007 cache\n')
        f.write('// (the classic courses\' objects by their 2007 ids; rooftops, Prifddinas, Sepulchre and other later courses left out).\n')
        f.write('(() => {\n  const ll = window.__lostlite;\n  if (!ll) return;\n  ll.agilityObstacles = ')
        f.write(json.dumps(data, separators=(',', ':')))
        f.write(';\n})();\n')
    sc = shortcuts()
    with open(os.path.join(APP, 'src/plugins/runelite/agilityshortcut.js'), 'w') as f:
        f.write('// Generated by app/tools/runelite/agility.py: RuneLite\'s net.runelite.client.game.AgilityShortcut, trimmed to the\n')
        f.write('// shortcuts whose objects are in the 2007 cache (rl.AgilityShortcut: values(), getTooltip(), matches()).\n')
        f.write('(() => {\n  const ll = window.__lostlite;\n  const rl = ll && ll.rl;\n  if (!rl) return;\n')
        f.write('  const DATA = ' + json.dumps(sc, separators=(',', ':')) + ';\n')
        f.write('''  const wp = (a) => (a ? new rl.WorldPoint(a[0], a[1], a[2]) : null);
  class AgilityShortcut {
    constructor(d) {
      this.name = d.name; this.level = d.level; this.description = d.description;
      this.worldMapLocation = wp(d.worldMapLocation); this.worldLocation = wp(d.worldLocation); this.obstacleIds = d.obstacleIds;
    }
    getLevel() { return this.level; }
    getDescription() { return this.description; }
    getWorldMapLocation() { return this.worldMapLocation; }
    getWorldLocation() { return this.worldLocation; }
    getObstacleIds() { return this.obstacleIds; }
    getTooltip() { return this.description + ' - Level ' + this.level; }
    matches() { return true; }
  }
  const VALUES = DATA.map((d) => new AgilityShortcut(d));
  AgilityShortcut.values = () => VALUES;
  for (const v of VALUES) AgilityShortcut[v.name] = v;
  rl.AgilityShortcut = AgilityShortcut;
})();
''')
    print(f'obstacles {len(data["OBSTACLE_IDS"])}, traps {len(data["TRAP_OBSTACLE_IDS"])}, shortcuts {len(sc)}; dropped {len(dropped)}', file=sys.stderr)
    print("by location: " + " ".join(by_location), file=sys.stderr)


if __name__ == '__main__':
    main()
