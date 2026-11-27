"""Generate the Skill Calculator clone's data (app/src/plugins/skillcalculator/data.js) from RuneLite's
skillcalculator `skills/<Skill>Action.java` / `<Skill>Bonus.java` enums, trimmed to Sept 2007 and with our server's xp.

    RUNELITE_SRC=<RuneLite source root> python3 skillcalc.py <client_items.json> [-v]

- Item actions (ItemSkillAction) are kept when RuneLite's item id is in the 2007 client (client_items.json, a dump of
  the running client's item names) under a name that shares a word with RuneLite's constant.
- Named actions (agility courses, thieving targets, hunter creatures, farming crops, spells, furniture) are era-trimmed
  by the KEEP lists below (Sept 2007: no rooftops, Zeah / Varlamore / Prifddinas / Sailing, Arceuus, OSRS-only spells,
  bird houses ...). Icons are kept when the icon item is in the 2007 client.
- Server values: our server's xp (content/scripts configs: dbrows, structs, objs, enums) replaces RuneLite's where an
  action's item / name matches a server row and the amounts differ; -v prints every replacement.
- Bonuses: only the ones in the game by Sept 2007 and that our server applies (Lit Gilded Altar 3.5x and Ectofuntus 4x
  on bones, Goldsmith gauntlets 2.5x on gold bars).
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gameval  # noqa: E402

OUT = os.path.join(gameval.REPO, 'app/src/plugins/skillcalculator/data.js')
SKILLS = 'runelite-client/src/main/java/net/runelite/client/plugins/skillcalculator/skills/'
SCRIPTS = os.path.join(gameval.REPO, 'content/scripts')
NAMES = {}
VERBOSE = '-v' in sys.argv

# CalculatorType order (SAILING dropped); bonuses kept per skill (era + server)
TYPES = ['MINING', 'AGILITY', 'SMITHING', 'HERBLORE', 'FISHING', 'THIEVING', 'COOKING', 'PRAYER', 'CRAFTING',
         'FIREMAKING', 'MAGIC', 'FLETCHING', 'WOODCUTTING', 'RUNECRAFT', 'FARMING', 'CONSTRUCTION', 'HUNTER']
BONUSES = {
    'SMITHING': ['GOLDSMITH_GAUNTLETS'],
    'PRAYER': ['LIT_GILDED_ALTAR', 'ECTOFUNTUS'],
}
# PrayerBonus.getCanBeStackedWith: the altars / ectofuntus never stack with each other
NO_STACK = {'PRAYER': {'LIT_GILDED_ALTAR': [], 'ECTOFUNTUS': []}, 'SMITHING': {'GOLDSMITH_GAUNTLETS': []}}
NAMED = {'AGILITY', 'THIEVING', 'HUNTER', 'FARMING', 'MAGIC', 'CONSTRUCTION'}

KEEP = {
    'AGILITY': 'GNOME_STRONGHOLD_COURSE PENGUIN_AGILITY_COURSE BARBARIAN_OUTPOST APE_ATOLL_COURSE WILDERNESS_AGILITY_COURSE '
               'WEREWOLF_AGILITY_COURSE',
    'THIEVING': 'MAN_OR_WOMAN WINTER_SQIRKJUICE CAKE_STALL MONKEY_FOOD_STALL TEA_STALL CRAFTING_STALL '
                'MONKEY_GENERAL_STALL FARMER CHEST_10_COINS HAM_MEMBER SILK_STALL WINE_STALL '
                'WARRIOR_WOMEN_OR_AL_KHARID_WARRIOR SPRING_SQIRKJUICE SEED_STALL NATURE_RUNE_CHEST ROGUE FUR_STALL '
                'CAVE_GOBLIN MASTER_FARMER GUARD FISH_STALL CHEST_50_COINS BEARDED_POLLNIVNIAN_BANDIT '
                'FREMENNIK_CITIZEN AUTUMN_SQIRKJUICE CHEST_STEEL_ARROWTIPS CROSSBOW_STALL WALL_SAFE SILVER_STALL '
                'DESERT_BANDIT KNIGHT POLLNIVNIAN_BANDIT MAGIC_STALL SPICE_STALL MENAPHITE_THUG YANILLE_WATCHMAN '
                'SCIMITAR_STALL SUMMER_SQIRKJUICE PALADIN GNOME GEM_STALL HERO ROGUES_CASTLE_CHEST',
    'HUNTER': 'POLAR_KEBBIT CRIMSON_SWIFT COMMON_KEBBIT GOLDEN_WARBLER FELDIP_WEASEL COPPER_LONGTAIL CERULEAN_TWITCH '
              'DESERT_DEVIL RUBY_HARVEST BABY_IMPLING TROPICAL_WAGTAIL YOUNG_IMPLING WILD_KEBBIT SAPPHIRE_GLACIALIS '
              'FERRET GOURMET_IMPLING SWAMP_LIZARD SPINED_LARUPIA BARB_TAILED_KEBBIT SNOWY_KNIGHT EARTH_IMPLING '
              'PRICKLY_KEBBIT HORNED_GRAAHK ESSENCE_IMPLING SPOTTED_KEBBIT BLACK_WARLOCK ORANGE_SALAMANDER '
              'RAZOR_BACKED_KEBBIT ECLECTIC_IMPLING SABRE_TOOTHED_KEBBIT CHINCHOMPA SABRE_TOOTHED_KYATT DARK_KEBBIT '
              'NATURE_IMPLING RED_SALAMANDER CARNIVOROUS_CHINCHOMPA MAGPIE_IMPLING BLACK_SALAMANDER DASHING_KEBBIT '
              'NINJA_IMPLING DRAGON_IMPLING',
    'FARMING': 'POTATOES ONIONS CABBAGES GUAM_LEAF TOMATOES MARRENTILL OAK_TREE TARROMIN SWEETCORN HARRALANDER '
               'LIMPWURT_PLANT APPLE_TREE GOUTWEED WILLOW_TREE STRAWBERRIES RANARR_WEED BANANA_TREE TOADFLAX '
               'ORANGE_TREE CURRY_TREE IRIT_LEAF MAPLE_TREE WATERMELONS AVANTOE PINEAPPLE_PLANT KWUARM PAPAYA_TREE '
               'YEW_TREE SNAPDRAGON CADANTINE PALM_TREE CALQUAT_TREE LANTADYME MAGIC_TREE DWARF_WEED SPIRIT_TREE '
               'TORSTOL WINTER_SQIRK SPRING_SQIRK AUTUMN_SQIRK SUMMER_SQIRK '
               # the POH garden's bagged plants (Construction, Jan 2006)
               'DOCK_LEAF FERN_BIG_PLANT PLANT SHORT_PLANT BUSH LARGE_LEAF_BUSH SMALL_FERN THISTLE FERN_SMALL_PLANT '
               'HUGE_PLANT REEDS TALL_PLANT',
}
# spells: the standard book (minus the Kourend / Civitas teleports and the surges), the Ancients and the Lunars of
# Lunar Diplomacy / Dream Mentor (minus the 2016 OSRS additions); no Arceuus
MAGIC_DROP = re.compile(r'ARCEUUS|DRAYNOR_MANOR|MIND_ALTAR|RESPAWN|SALVE_GRAVEYARD|FENKENSTRAIN|KOUREND|CIVITAS|'
                        r'WEST_ARDOUGNE|HARMONY|CEMETERY|BARROWS_TELEPORT|APE_ATOLL_TELEPORT$|SURGE|TELEPORT_TO_TARGET|'
                        r'REANIMATION|THRALL|GRASP|DEMONBANE|SHADOW_VEIL|DARK_LURE|MARK_OF_DARKNESS|CORRUPTION|'
                        r'VILE_VIGOUR|DEGRIME|WARD_OF|RESURRECT_CROPS|DEATH_CHARGE|OFFERING|GEOMANCY|SPIN_FLAX|'
                        r'TAN_LEATHER|PLANK_MAKE|RECHARGE_DRAGONSTONE|OURANIA|ZENYTE|BATTLEFRONT|INFERIOR|SUPERIOR')
# furniture: everything in the Jan 2006 POH but Sailing's hull parts / repair kits and later additions
CONSTRUCTION_DROP = re.compile(r'HULL|REPAIR_KIT|DEADMAN|MYTHICAL|GOLD_SINK|^SINK$')


# server rows the generic matching gets wrong: RuneLite's xp is the whole chain (pizzas: base + topping; pottery: shaping +
# firing; logs: a tree row's xp is per log type) where the server row is one step
SERVER_IGNORE = {
    'COOKING': {'MEAT_PIZZA', 'ANCHOVY_PIZZA', 'PINEAPPLE_PIZZA', 'DRUNK_DRAGON'},
    'CRAFTING': {'PIE_DISH', 'BOWL', 'EMPTY_PLANT_POT'},
    'WOODCUTTING': {'LOGS'},
    'CONSTRUCTION': {'ROPE_BELL_PULL', 'BELL_PULL', 'POSH_BELL_PULL', 'BOXING_RING'},
}
# server values read from the scripts by hand (whole xp)
SERVER_XP = {
    # skill_thieving: pickpocket / stealing / trapped_chest dbrows
    'THIEVING': {'MAN_OR_WOMAN': 8, 'FARMER': 14.5, 'WARRIOR_WOMEN_OR_AL_KHARID_WARRIOR': 26, 'ROGUE': 36.5, 'GUARD': 46.8,
                 'KNIGHT': 84.3, 'YANILLE_WATCHMAN': 137.5, 'PALADIN': 151.8, 'GNOME': 198.3, 'HERO': 273.3,
                 'DESERT_BANDIT': 79.4, 'HAM_MEMBER': 22.2, 'CAKE_STALL': 16, 'TEA_STALL': 16, 'SILK_STALL': 24,
                 'FUR_STALL': 36, 'SILVER_STALL': 54, 'SPICE_STALL': 81, 'GEM_STALL': 160, 'CRAFTING_STALL': 16,
                 'SEED_STALL': 10, 'CHEST_10_COINS': 7.8, 'NATURE_RUNE_CHEST': 25, 'CHEST_50_COINS': 125,
                 'CHEST_STEEL_ARROWTIPS': 150},
    # skill_hunter: hunter / hunter_net dbrows (implings: puro_xp, the calculator's Puro-Puro rows)
    'HUNTER': {'TROPICAL_WAGTAIL': 95.2, 'CRIMSON_SWIFT': 34, 'CERULEAN_TWITCH': 64.7, 'GOLDEN_WARBLER': 48,
               'COPPER_LONGTAIL': 61, 'FERRET': 115, 'CHINCHOMPA': 198.3, 'CARNIVOROUS_CHINCHOMPA': 265,
               'WILD_KEBBIT': 128, 'BARB_TAILED_KEBBIT': 168, 'PRICKLY_KEBBIT': 204, 'SABRE_TOOTHED_KEBBIT': 200,
               'SWAMP_LIZARD': 152, 'ORANGE_SALAMANDER': 224, 'RED_SALAMANDER': 272, 'BLACK_SALAMANDER': 319.2,
               'RUBY_HARVEST': 24, 'SAPPHIRE_GLACIALIS': 34, 'SNOWY_KNIGHT': 44, 'BLACK_WARLOCK': 54,
               'BABY_IMPLING': 18, 'YOUNG_IMPLING': 20, 'GOURMET_IMPLING': 22, 'EARTH_IMPLING': 25,
               'ESSENCE_IMPLING': 27, 'ECLECTIC_IMPLING': 30, 'NATURE_IMPLING': 34, 'MAGPIE_IMPLING': 44,
               'NINJA_IMPLING': 50, 'DRAGON_IMPLING': 65},
    # skill_runecraft: runecraft dbrows
    'RUNECRAFT': {'AIR_RUNE': 5, 'MIND_RUNE': 5.5, 'WATER_RUNE': 6, 'EARTH_RUNE': 6.5, 'FIRE_RUNE': 7, 'BODY_RUNE': 7.5,
                  'COSMIC_RUNE': 8, 'CHAOS_RUNE': 8.5, 'NATURE_RUNE': 9, 'LAW_RUNE': 9.5, 'DEATH_RUNE': 10},
}


def words(s):
    return set(w for w in re.findall(r'[a-z]+', s.lower()) if len(w) > 2)


def item_ok(const, i):
    """the client's item ids are OSRS's, so an id in the 2007 client is the same item; -v lists the ones whose names
    share nothing with RuneLite's constant, to check by hand"""
    n = NAMES.get(str(i))
    if not n or n == 'null':
        return False
    c = const.lower().replace('_', '')
    if VERBOSE and not any(w[:5] in c for w in words(n)):
        print('  check:', const, i, n)
    return True


def num(s):
    s = s.strip().rstrip('f')
    if '/' in s:
        a, b = s.split('/')
        return float(num(a)) / float(num(b))
    return float(s)


def item_id(arg):
    m = re.match(r'ItemID\.(\w+)$', arg.strip())
    return (m.group(1), gameval.gameval('ItemID').get(m.group(1))) if m else (None, None)


def sprite_ids():
    """SpriteID.<Class>.<NAME> -> id (the nested classes RuneLite's MagicAction uses)"""
    src = open(os.path.join(gameval.RL, 'runelite-api/src/main/java/net/runelite/api/gameval/SpriteID.java')).read()
    out, cls = {}, None
    for line in src.splitlines():
        m = re.match(r'\tpublic static final class (\w+)', line)
        if m:
            cls = m.group(1)
            continue
        m = re.match(r'\t\tpublic static final int (\w+) = (\w+);', line)
        if m and cls:
            v = m.group(2)
            out[cls + '.' + m.group(1)] = int(v) if v.isdigit() else out.get(cls + '.' + v, -1)
    return out


# ---- our server's xp ----------------------------------------------------------------------------------------------

def norm(s):
    return re.sub(r'[^a-z0-9]', '', s.lower().replace('&', 'and'))


def server_blocks():
    """[(file, block name, [(key, [values])])] of every config block under content/scripts (not the unpack dumps)"""
    out = []
    for root, dirs, files in os.walk(SCRIPTS):
        dirs[:] = [d for d in dirs if d not in ('_unpack', '_test')]
        for f in files:
            if f.split('.')[-1] not in ('dbrow', 'struct', 'obj', 'enum'):
                continue
            cur = None
            for line in open(os.path.join(root, f), errors='replace'):
                line = line.split('//')[0].strip()
                if line.startswith('[') and line.endswith(']'):
                    cur = (os.path.relpath(os.path.join(root, f), SCRIPTS), line[1:-1], [])
                    out.append(cur)
                elif cur and '=' in line:
                    k, _, v = line.partition('=')
                    if k in ('data', 'param'):
                        k, _, v = v.partition(',')
                    cur[2].append((k, [x.strip() for x in v.split(',')]))
    return out


XP_KEY = re.compile(r'(^|_)(xp|exp|experience|productexp|processexp)$|^bone_exp$|^rock_exp$|^xpperbar$|^harvestxp$')
PRODUCT_KEYS = ['cooked', 'product', 'rock_output', 'namedobj', 'result', 'output', 'obj', 'item', 'logs']


def server_xp():
    """display name (normalised) -> {file: xp in tenths} from the server's configs"""
    dn = gameval.display_names('ItemID')
    out = {}

    def put(name, f, xp):
        if name and xp is not None:
            out.setdefault(norm(name), {})[f] = xp

    for f, block, fields in server_blocks():
        d = {}
        for k, v in fields:
            d.setdefault(k, v)
        if f.endswith('.enum'):
            continue
        xp = next((int(v[0]) for k, v in fields if XP_KEY.search(k) and v and v[0].lstrip('-').isdigit()), None)
        if f.endswith('.obj'):
            put(d.get('name', [None])[0] or dn.get(block), f, xp)
            continue
        if block.startswith('fishing_struct_'):
            put('raw ' + block[len('fishing_struct_'):].replace('_', ' '), f, xp)
        if 'name' in d and xp is not None and not any(k in d for k in PRODUCT_KEYS):
            put(d['name'][0], f, xp)
        for k in PRODUCT_KEYS:
            if k in d and d[k][0] in dn:
                put(dn[d[k][0]], f, xp)
                break
        # (namedobj, level, xp) tuples (fletching's bows)
        for k, v in fields:
            if len(v) == 3 and v[0] in dn and v[1].isdigit() and v[2].isdigit():
                put(dn[v[0]], f, int(v[2]))
    return out


def server_spells():
    """spell name (normalised) -> xp in tenths"""
    out = {}
    for f, block, fields in server_blocks():
        if not block.startswith('magic_spell_'):
            continue
        d = dict((k, v) for k, v in fields)
        if 'experience' not in d:
            continue
        nm = d['name'][0] if 'name' in d else block[len('magic_spell_'):].replace('_', ' ')
        out[norm(nm)] = int(d['experience'][0])
    return out


def server_furniture():
    """furniture name (normalised) -> xp (whole xp) from the POH build tables"""
    dn = gameval.display_names('ItemID')
    out = {}
    for f, block, fields in server_blocks():
        d = dict((k, v) for k, v in fields)
        if f.endswith('poh_data.dbrow') and 'xp' in d and 'obj' in d and d['xp'][0].isdigit():
            nm = dn.get(d['obj'][0])
            if nm:
                out.setdefault(norm(nm), int(d['xp'][0]) * 10)
    return out


# ---- RuneLite's enums -----------------------------------------------------------------------------------------------

def skill_name(t):
    return t[0] + t[1:].lower()


def actions(t, sprites):
    cls = skill_name(t) + 'Action'
    src = open(os.path.join(gameval.RL, SKILLS, cls + '.java')).read()
    src = src.replace('JATOBA_lOGS', 'JATOBA_LOGS')  # (RuneLite's typo stops the enum parser)
    named = t in NAMED
    keep = set(KEEP.get(t, '').split())
    out, dropped = [], []
    for name, args, extra in gameval.enum_entries(src, cls):
        a = [x.strip() for x in args]
        rec = {'n': name}
        override = re.search(r'return "([^"]+)"', extra or '')
        if named:
            rec['name'] = json.loads(a[0])
            rec['lvl'] = int(num(a[1]))
            rec['xp'] = num(a[2])
            ok = (name in keep) if t in KEEP else \
                (not MAGIC_DROP.search(name)) if t == 'MAGIC' else (not CONSTRUCTION_DROP.search(name))
            if t == 'MAGIC':
                rec['sprite'] = sprites.get(a[3].replace('SpriteID.', ''), -1)
                rec['mem'] = a[4] == 'true'
            else:
                c, i = item_id(a[3])
                rec['icon'] = i if i is not None and item_ok(c, i) else -1
            if not ok:
                dropped.append(name)
                continue
        else:
            c, i = item_id(a[0])
            rest = a[1:]
            if rest and rest[0].startswith('"'):
                rec['name'] = json.loads(rest[0])
                rest = rest[1:]
            if override:
                rec['name'] = override.group(1)
            rec['id'] = i
            rec['lvl'] = int(num(rest[0]))
            rec['xp'] = num(rest[1])
            flags = rest[2:]
            if t in ('COOKING', 'CRAFTING') and flags and flags[0] == 'true':
                rec['mem'] = True
            if t == 'RUNECRAFT' and len(flags) > 1 and flags[1] == 'true':
                rec['mem'] = True
            if t in ('FLETCHING', 'HERBLORE'):
                rec['mem'] = True
            if t == 'PRAYER':
                rec['method'] = flags[0].split('.')[-1]
            if t == 'FIREMAKING':
                rec['method'] = flags[0].split('.')[-1]
            if i is None or not item_ok(c, i) or (override and t in ('WOODCUTTING', 'FLETCHING', 'RUNECRAFT')) \
                    or (t == 'MINING' and override and 'Barronite' in override.group(1)) \
                    or (t == 'RUNECRAFT' and name in ('BLOOD_RUNE', 'BLOOD_RUNE_ZEAH', 'SOUL_RUNE', 'WRATH_RUNE')) \
                    or (t == 'FIREMAKING' and rec.get('method') == 'SACRED_OIL') \
                    or (t == 'PRAYER' and rec.get('method') not in ('BONES', 'SHADE_REMAINS')):
                dropped.append(name)
                continue
        # excluded bonuses (the kept bonuses only)
        kept = BONUSES.get(t, [])
        ex = []
        if t == 'SMITHING' and name != 'GOLD_BAR':
            ex = kept
        if t == 'PRAYER' and rec.get('method') != 'BONES':
            ex = kept
        if ex:
            rec['ex'] = ex
        rec.pop('method', None)
        out.append(rec)
    seen = {r['n'] for r in out} | set(dropped)
    for k in keep - seen:
        print('  KEEP name not in', cls + ':', k)
    return out, dropped


def bonuses(t):
    keep = BONUSES.get(t)
    if not keep:
        return None
    src = open(os.path.join(gameval.RL, SKILLS, skill_name(t) + 'Bonus.java')).read()
    out = []
    for name, args, _ in gameval.enum_entries(src, skill_name(t) + 'Bonus'):
        if name in keep:
            out.append({'n': name, 'name': json.loads(args[0]), 'value': num(args[1]), 'stack': NO_STACK[t][name]})
    return out


def main():
    sprites = sprite_ids()
    sx = server_xp()
    spells = server_spells()
    furniture = server_furniture()
    data, report = [], []
    for t in TYPES:
        acts, dropped = actions(t, sprites)
        matched = 0
        for r in acts:
            s, src = None, ''
            if t == 'MAGIC':
                s = spells.get(norm(r['name']))
            elif t == 'CONSTRUCTION':
                s = furniture.get(norm(r['name']))
            elif t not in NAMED:
                cand = sx.get(norm(r.get('name') or NAMES.get(str(r['id']), '')), {})
                # the skill's own folder's rows, all agreeing
                cand = {f: v for f, v in cand.items() if f.startswith('skill_' + t.lower() + '/') and v}
                if len(set(cand.values())) == 1:
                    s, src = next(iter(cand.values())), next(iter(cand))
            if r['n'] in SERVER_IGNORE.get(t, ()):
                s = None
            if r['n'] in SERVER_XP.get(t, {}):
                s, src = SERVER_XP[t][r['n']] * 10, 'by hand'
            if s is None:
                continue
            matched += 1
            if abs(s / 10 - r['xp']) > 0.051:
                report.append(f"{t} {r['n']}: {r['xp']} -> {s / 10} {src}")
                r['xp'] = s / 10
        data.append({'type': t, 'skill': t, 'bonuses': bonuses(t), 'actions': acts})
        miss = set(SERVER_XP.get(t, {})) - {r['n'] for r in acts}
        if miss:
            print('  SERVER_XP names not kept:', ' '.join(sorted(miss)))
        print(t, len(acts), 'kept,', matched, 'on the server,', len(dropped), 'dropped' + (': ' + ' '.join(dropped) if VERBOSE else ''))
    print(len(report), 'server values')
    if VERBOSE:
        print('\n'.join(report))
    js = ('// Generated by app/tools/runelite/skillcalc.py: RuneLite\'s CalculatorType / <Skill>Action / <Skill>Bonus enums\n'
          '// trimmed to Sept 2007, with our server\'s xp where it differs. Per type: {type, skill, bonuses, actions};\n'
          '// action {n: enum name, id: item id (ItemSkillAction) or name (NamedSkillAction), lvl, xp, icon / sprite, mem, ex}.\n'
          'window.__lostlite && (window.__lostlite.skillCalculatorData = ' + json.dumps(data, separators=(',', ':')) + ');\n')
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w').write(js)


if __name__ == '__main__':
    NAMES.update(json.load(open(sys.argv[1])))
    main()
