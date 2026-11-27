#!/usr/bin/env python3
"""World Map clone data: RuneLite's worldmap/*Location enums and TeleportLocationData, era-trimmed to Sept 2007.

Most of RuneLite's map points are a tooltip over an icon the OSRS map already draws (BLANK_ICON). So a point is kept
only where the 2007 map (app/src/ui/assets/worldmap/icons.json) has that kind of icon within 4 tiles, and it moves onto
that 2007 icon. On top of that, later kinds are dropped by name (ores, fish, hunter creatures, trees, patches) and the
teleports, altars and agility courses are a 2007 list. Writes app/src/plugins/worldmap/data.js.

usage: RUNELITE_SRC=<runelite checkout> python3 app/tools/worldmap/points.py
"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'runelite'))
import gameval as gv

APP = os.path.normpath(os.path.join(HERE, '..', '..'))
RL = os.environ.get('RUNELITE_SRC') or gv.RL
WM = os.path.join(RL, 'runelite-client/src/main/java/net/runelite/client/plugins/worldmap')
ICONS = json.load(open(os.path.join(APP, 'src/ui/assets/worldmap/icons.json')))  # [level, x, z, mapfunction]

# 2007 mapfunction sprite of each kind
AGILITY, DUNGEON, TRANSPORT, FARMING, FISHING, HUNTER, MINIGAME, MINING, RARE_TREE = 49, 12, 56, 53, 26, 63, 38, 8, 34

def src(name):
    return open(os.path.join(WM, name + '.java')).read()

def wps(text):
    return [tuple(map(int, m)) for m in re.findall(r'new WorldPoint\((\d+),\s*(\d+),\s*(\d+)\)', text)]

def strs(text):
    return re.findall(r'"((?:[^"\\]|\\.)*)"', text)

def on_2007_icon(p, kind, d=4):
    """the 2007 map's icon of that kind nearest the point (within d tiles), or None"""
    best = None
    for lv, x, z, f in ICONS:
        if f == kind and lv == p[2] and abs(x - p[0]) <= d and abs(z - p[1]) <= d:
            dist = max(abs(x - p[0]), abs(z - p[1]))
            if best is None or dist < best[0]:
                best = (dist, [x, z, lv])
    return best and best[1]

def entries(name):
    return gv.enum_entries(src(name), name)

out = {}

# ---- agility courses: the 2007 ones (no rooftops)
AGILITY_COURSES_2007 = {'AGILITY_PYRAMID', 'APE_ATOLL_AGILITY_COURSE', 'BARBARIAN_OUTPOST_AGILITY_COURSE', 'GNOME_STRONGHOLD_AGILITY_COURSE',
                        'PENGUIN_AGILITY_COURSE', 'WEREWOLF_AGILITY_COURSE', 'WILDERNESS_AGILITY_COURSE'}
out['agilityCourses'] = []
for n, args, _ in entries('AgilityCourseLocation'):
    p = wps(' '.join(args))
    if n in AGILITY_COURSES_2007 and p:
        at = on_2007_icon(p[0], AGILITY) or list(p[0])
        out['agilityCourses'].append({'name': n, 'tooltip': strs(args[0])[0], 'p': at})

# ---- tooltip-only kinds over 2007 icons
def simple(name, kind, key, tooltip_of, multi=False, keep=lambda n, a: True):
    rows = []
    for n, args, _ in entries(name):
        if not keep(n, args):
            continue
        tip = tooltip_of(n, args)
        if not tip:
            continue
        pts = wps(' '.join(args))
        if not multi:
            pts = pts[:1]
        locs = [at for at in (on_2007_icon(p, kind) for p in pts) if at]
        if locs:
            rows.append({'name': n, 'tooltip': tip, 'locations': locs})
    out[key] = rows

simple('DungeonLocation', DUNGEON, 'dungeons', lambda n, a: strs(a[0])[0])
simple('MinigameLocation', MINIGAME, 'minigames', lambda n, a: strs(a[0])[0])
simple('FairyRingLocation', TRANSPORT, 'fairyRings', lambda n, a: strs(a[0])[0])

FARMING_LATER = {'ANIMA_HERB', 'CELASTRUS_FRUIT_TREE', 'CORAL', 'CRYSTAL_TREE', 'GRAPES', 'HARDWOOD', 'HESPORI', 'REDWOOD', 'SEAWEED'}
simple('FarmingPatchLocation', FARMING, 'farmingPatches', lambda n, a: strs(a[0])[0], True, lambda n, a: n not in FARMING_LATER)

TREES_LATER = {'SULLIUSCEP', 'CAMPHOR', 'CAMPHOR_MAHOGANY', 'CAMPHOR_JATOBA', 'IRONWOOD', 'ROSEWOOD', 'REDWOOD', 'BLOODWOOD',
               'BLISTERWOOD', 'MATURE_JUNIPER', 'YEW_JATOBA'}
rows = []
for n, args, _ in entries('RareTreeLocation'):
    if n in TREES_LATER:
        continue
    locs = [at for at in (on_2007_icon(p, RARE_TREE) for p in wps(' '.join(args))) if at]
    if locs:
        rows.append({'name': n, 'tooltip': strs(args[0])[0], 'levelReq': int(args[1]), 'locations': locs})
out['rareTrees'] = rows

# fishing: FishingSpot.getWorldMapTooltip of the 2007 spots
fs_src = open(os.path.join(RL, 'runelite-client/src/main/java/net/runelite/client/game/FishingSpot.java')).read()
FISH_TIP = {}
for n, args, _ in gv.enum_entries(fs_src, 'FishingSpot'):
    s = strs(' '.join(args[:2]))
    FISH_TIP[n] = s[1] if len(s) > 1 and args[1].startswith('"') else s[0]
FISH_LATER = {'BARB_FISH', 'ANGLERFISH', 'MINNOW', 'HARPOONFISH', 'INFERNAL_EEL', 'SACRED_EEL', 'DARK_CRAB', 'COMMON_TENCH',
              'CAMDOZAAL_TETRA', 'CAMDOZAAL_CAVE_EEL', 'CIVITAS_ILLA_FORTIS_PARK', 'SQUID'}
rows = []
for n, args, _ in entries('FishingSpotLocation'):
    spots = [s for s in re.findall(r'FishingSpot\.(\w+)', args[0])]
    spots = [s for s in spots if s not in FISH_LATER]
    if not spots:
        continue
    locs = [at for at in (on_2007_icon(p, FISHING) for p in wps(' '.join(args[1:]))) if at]
    if locs:
        rows.append({'name': n, 'tooltip': ' / '.join(FISH_TIP[s] for s in spots), 'locations': locs})
out['fishingSpots'] = rows

# hunter: the 2007 creatures (Hunter came in Nov 2006)
hs = src('HunterAreaLocation')
CREATURE = {n: '%s (%s)' % (strs(a[0])[0], a[1].strip()) for n, a, _ in gv.enum_entries(hs, 'HunterCreature')}
HUNTER_2007 = {'BARB_TAILED_KEBBIT', 'BLACK_WARLOCK', 'CARNIVOROUS_CHINCHOMPA', 'CERULEAN_TWITCH', 'CHINCHOMPA', 'COMMON_KEBBIT',
               'COPPER_LONGTAIL', 'CRIMSON_SWIFT', 'DARK_KEBBIT', 'DASHING_KEBBIT', 'DESERT_DEVIL', 'FELDIP_WEASEL', 'FERRET',
               'GOLDEN_WARBLER', 'HORNED_GRAAHK', 'ORANGE_SALAMANDER', 'POLAR_KEBBIT', 'PRICKLY_KEBBIT', 'RAZOR_BACKED_KEBBIT',
               'RED_SALAMANDER', 'BLACK_SALAMANDER', 'SABRE_TOOTHED_KEBBIT', 'SABRE_TOOTHED_KYATT', 'SAPPHIRE_GLACIALIS',
               'SNOWY_KNIGHT', 'SPINED_LARUPIA', 'SWAMP_LIZARD', 'TROPICAL_WAGTAIL', 'WILD_KEBBIT', 'RUBY_HARVEST'}
rows = []
for n, args, _ in entries('HunterAreaLocation'):
    cs = [c for c in re.findall(r'HunterCreature\.(\w+)', ' '.join(args)) if c in HUNTER_2007]
    p = wps(args[0])
    at = cs and p and on_2007_icon(p[0], HUNTER)
    if at:
        rows.append({'name': n, 'tooltip': '<br>'.join(CREATURE[c] for c in cs), 'locations': [at]})
out['hunterAreas'] = rows

# mining: the 2007 ores
ORES_LATER = {'BARRONITE', 'DENSE_ESSENCE', 'DAEYALT_ESSENCE', 'CALCIFIED_ROCKS', 'HARD_ROCK', 'VOLCANIC_SULPHUR', 'LOVAKITE',
              'BASALT', 'TE_SALT', 'EFH_SALT', 'URT_SALT', 'AMETHYST', 'GEMSTONE_CRAB', 'LEAD', 'NICKEL', 'SUNSTONE', 'SOFT_CLAY'}
ms = src('MiningSiteLocation')
ORE = {n: strs(a[0])[0] for n, a, _ in gv.enum_entries(ms, 'Ore')}
rows = []
for n, args, _ in entries('MiningSiteLocation'):
    rocks = [(int(c), o) for c, o in re.findall(r'new Rock\((\d+),\s*Ore\.(\w+)\)', ' '.join(args)) if o not in ORES_LATER]
    p = wps(args[0])
    at = rocks and p and on_2007_icon(p[0], MINING)
    if at:
        rows.append({'name': n, 'tooltip': '<br>'.join('%d %s' % (c, ORE[o]) for c, o in rocks), 'locations': [at]})
out['miningSites'] = rows

# transportation: over a 2007 transport icon, the target kept
rows = []
for n, args, _ in entries('TransportationPointLocation'):
    p = wps(' '.join(args))
    at = p and on_2007_icon(p[0], TRANSPORT)
    if at:
        rows.append({'name': n, 'tooltip': strs(args[0])[0], 'locations': [at], 'target': list(p[1]) if len(p) > 1 else None})
out['transportation'] = rows

# runecrafting altars: the 2007 ones
ALTARS_2007 = {'AIR_ALTAR', 'MIND_ALTAR', 'WATER_ALTAR', 'EARTH_ALTAR', 'FIRE_ALTAR', 'BODY_ALTAR', 'COSMIC_ALTAR', 'CHAOS_ALTAR',
               'ASTRAL_ALTAR', 'NATURE_ALTAR', 'LAW_ALTAR', 'DEATH_ALTAR'}
out['runecraftingAltars'] = [{'name': n, 'tooltip': strs(a[0])[0], 'levelReq': int(a[1]), 'p': list(wps(a[2])[0]), 'icon': strs(a[3])[0]}
                             for n, a, _ in entries('RunecraftingAltarLocation') if n in ALTARS_2007]

# teleports: the spells and items of Sept 2007 (items checked against the 2007 cache's obj names)
TELEPORTS_2007 = {
    'VARROCK', 'LUMBRIDGE', 'FALADOR', 'CAMELOT', 'ARDOUGNE', 'WATCHTOWER', 'TROLLHEIM', 'APE_ATOLL',
    'PADDEWWA', 'SENNTISTEN', 'KHARYRLL', 'LASSAR', 'DAREEYAK', 'CARRALLANGER', 'ANNAKARL', 'GHORROCK',
    'MOONCLAN', 'WATERBIRTH', 'BARBARIAN', 'KHAZARD', 'FISHING_GUILD', 'CATHERBY', 'ICE_PLATEAU',
    'BARBARIAN_ASSAULT', 'BURTHORPE_GAMES_ROOM', 'EMIRS_ARENA', 'CASTLE_WARS', 'WARRIORS_GUILD', 'CHAMPIONS_GUILD',
    'EDGEVILLE_MONASTERY', 'RANGING_GUILD', 'FISHING_GUILD_NECK', 'MINING_GUILD', 'CRAFTING_GUILD', 'COOKING_GUILD',
    'EDGEVILLE', 'KARAMJA', 'DRAYNOR_VILLAGE', 'AL_KHARID',
    'ECTOFUNTUS', 'RELLEKKKA_LYRE', 'CAMULET_TEMPLE', 'OBELISK_13', 'OBELISK_19', 'OBELISK_27', 'OBELISK_35', 'OBELISK_44', 'OBELISK_50',
}
RENAMED_2007 = {'Emir\'s Arena': 'Duel Arena'}  # its 2007 name
PREFIX = {m.group(1): m.group(2) for m in re.finditer(r'(\w+)\("([^"]*)"\)', src('TeleportType'))}
rows = []
for n, args, _ in entries('TeleportLocationData'):
    if n not in TELEPORTS_2007:
        continue
    t = args[0].replace('TeleportType.', '')
    s = strs(' '.join(args))
    if re.fullmatch(r'\d+', args[2].strip()):  # (type, destination, magicLevel, location, icon)
        tip = '%s %s - lvl %s' % (PREFIX.get(t, ''), s[0], args[2].strip())
    elif len(s) == 3:  # (type, item, destination, location, icon)
        tip = '%s - %s' % (s[0], RENAMED_2007.get(s[1], s[1]))
    else:  # (type, item, location, icon)
        tip = s[0]
    rows.append({'name': n, 'type': t, 'tooltip': tip.strip(), 'p': list(wps(' '.join(args))[0]), 'icon': s[-1]})
out['teleports'] = rows

# names of Sept 2007 in the tooltips; later places dropped (the 2007 icon nearby is another boat / building)
TIP_2007 = [("Emir's Arena", 'Duel Arena'), ('/The Pandemonium', '')]
LATER_IN_TIP = re.compile(r'Jatizso|Neitiznot|Weiss|Iceberg|Rat Pits')
for k, rows in out.items():
    for r in rows:
        for a, b in TIP_2007:
            r['tooltip'] = r['tooltip'].replace(a, b)
    out[k] = [r for r in rows if not LATER_IN_TIP.search(r['tooltip'])]

with open(os.path.join(APP, 'src/plugins/worldmap/data.js'), 'w') as f:
    f.write("'use strict';\n// Generated by app/tools/worldmap/points.py from RuneLite's worldmap location enums, trimmed to Sept 2007.\n")
    f.write('(() => {\n  const ll = window.__lostlite;\n  if (!ll) return;\n  ll.worldMapData = ')
    f.write(json.dumps(out, separators=(',', ':')))
    f.write(';\n})();\n')
for k, v in out.items():
    print(k, len(v))
