#!/usr/bin/env python3
# Every built quest's ::<quest>pack: the items the OSRS wiki lists under the quest's "Items
# required" (Quest details), as our game's items. Writes content/scripts/_test/scripts/cheats/
# cheat_questpacks.rs2 and prints what it couldn't match, for a look by hand.
import re, glob, json, os, subprocess, sys, urllib.parse
E = '/home/claude/eascape/content'
CACHE = os.path.join(os.path.dirname(__file__), 'wiki_items.json')
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}

def wiki(title):
    if title in cache:
        return cache[title]
    t = title
    for _ in range(3):
        url = 'https://oldschool.runescape.wiki/w/' + urllib.parse.quote(t.replace(' ', '_')) + '?action=raw'
        txt = subprocess.run(['curl', '-sS', url], capture_output=True, text=True).stdout
        m = re.match(r'#REDIRECT\s*\[\[([^\]#|]+)', txt, re.I)
        if not m:
            break
        t = m.group(1)
    cache[title] = txt
    return txt

# quests with a journal (built): questlist component -> journal name
qif = open(E + '/scripts/interfaces/questlist.if').read()
names = {}
for b in re.split(r'\n(?=\[)', qif):
    m = re.match(r'\[(\w+)\]', b); t = re.search(r'^text=(.*)$', b, re.M)
    if m and t: names[m.group(1)] = t.group(1)
handled = set()
for f in glob.glob(E + '/scripts/**/*.rs2', recursive=True):
    if 'eascape_unbuilt' in f: continue
    handled |= set(re.findall(r'^\[if_button,questlist:(\w+)\]', open(f, errors='replace').read(), re.M))
WIKI = {'runemysteries': 'Rune Mysteries', 'itexam': 'The Dig Site', 'zanaris': 'Lost City', 'fortress': "Black Knights' Fortress",
        'romeojuliet': 'Romeo & Juliet', 'blackarmgang': 'Shield of Arrav', 'squire': "The Knight's Sword", 'itwatchtower': 'Watchtower',
        'mm': 'Monkey Madness I', 'misc': 'Throne of Miscellania', 'viking': 'The Fremennik Trials', 'grail': 'Holy Grail',
        'horror': 'Horror from the Deep', 'desertrescue': 'The Tourist Trap', 'itgronigen': 'Observatory Quest', 'elena': 'Plague City',
        'zombiequeen': 'Shilo Village', 'routequest': 'In Search of the Myreque', 'hunt': "Pirate's Treasure", 'haunted': 'Ernest the Chicken',
        'priest': 'The Restless Ghost', 'ball': "Witch's House", 'hetty': "Witch's Potion", 'cog': 'Clock Tower', 'chompybird': 'Big Chompy Bird Hunting',
        'mcannon': 'Dwarf Cannon', 'crest': 'Family Crest', 'arena': 'Fight Arena', 'fluffs': "Gertrude's Cat", 'hero': "Heroes' Quest",
        'arthur': "Merlin's Crystal", 'drunkmonk': "Monk's Friend", 'seaslug': 'Sea Slug', 'ikov': 'Temple of Ikov', 'tree': 'Tree Gnome Village',
        'totem': 'Tribal Totem', 'upass': 'Underground Pass', 'dragon': 'Dragon Slayer I', 'druid': 'Druidic Ritual', 'druidspirit': 'Nature Spirit',
        'death': 'Death Plateau', 'troll': 'Troll Stronghold', 'tbwt': 'Tai Bwo Wannai Trio', 'regicide': 'Regicide', 'mortton': "Shades of Mort'ton",
        'troll_love': 'Troll Romance', 'golem': 'The Golem', 'hauntedmine': 'Haunted Mine', 'grandtree': 'The Grand Tree', 'legends': "Legends' Quest",
        'waterfall': 'Waterfall Quest', 'deserttreasure': 'Desert Treasure I', 'priestperil': 'Priest in Peril', 'doric': "Doric's Quest",
        'demon': 'Demon Slayer', 'cook': "Cook's Assistant", 'gobdip': 'Goblin Diplomacy', 'imp': 'Imp Catcher', 'prince': 'Prince Ali Rescue',
        'sheep': 'Sheep Shearer', 'vampire': 'Vampire Slayer', 'biohazard': 'Biohazard', 'fishingcompo': 'Fishing Contest', 'hazeelcult': 'Hazeel Cult',
        'junglepotion': 'Jungle Potion', 'murder': 'Murder Mystery', 'scorpcatcher': 'Scorpion Catcher', 'sheepherder': 'Sheep Herder',
        'elemental_workshop': 'Elemental Workshop I', 'eadgar': "Eadgar's Ruse"}

# our items by display name; where several share a name, the plain one (not the tutorial's,
# a fake or a quest's own copy): the one whose config name is the name itself, else the shortest
cands = {}
for f in glob.glob(E + '/scripts/**/*.obj', recursive=True):
    if '_test' in f: continue
    for b in re.split(r'\n(?=\[)', open(f, errors='replace').read()):
        m = re.match(r'\[(\w+)\]', b); n = re.search(r'^name=(.*)$', b, re.M)
        if not m or not n or m.group(1).startswith('cert_') or 'certtemplate' in b: continue
        cands.setdefault(n.group(1).strip().lower(), []).append(m.group(1))
def best(name, cs):
    slug = re.sub(r'[^a-z0-9]+', '_', name).strip('_')
    def score(c):
        bad = any(w in c for w in ('newbie', 'fake', 'dummy', 'tut', 'mm_', 'deal_', 'trail_'))
        return (c != slug, bad, len(c))
    return sorted(cs, key=score)[0]
objs = {n: best(n, cs) for n, cs in cands.items()}
# wiki items that are a kind rather than one item: the best a tester would want
KIND = {'pickaxe': 'rune_pickaxe', 'axe': 'rune_axe', 'woodcutting axe': 'rune_axe', 'bow': 'yew_longbow',
        'arrows': 'iron_arrow', 'arrow': 'iron_arrow', 'coin': 'coins', 'balls of wool': 'ball_of_wool',
        'ball of wool': 'ball_of_wool', 'shantay pass (item)': 'shantay_pass', 'machete (weapon)': 'machette',
        'agility potion': '4dose1agility', 'priest gown top': 'priest_gown', 'priest gown bottom': 'priest_robe',
        'sword': 'iron_sword', 'longsword': 'iron_longsword', 'ring': 'gold_ring', 'poison cure': '4doseantipoison',
        'light source': 'torch_lit', 'food': 'lobster', 'bucket of water': 'bucket_water', 'water': 'bucket_water',
        'beer tankard': 'beer', 'tarromin potion (unf)': 'tarrominvial', 'guam potion (unf)': 'guamvial',
        'harralander potion (unf)': 'harralandervial', 'ranarr potion (unf)': 'ranarrvial', 'poison (item)': 'poison'}
def find(name):
    n = name.strip().lower()
    if n in KIND: return KIND[n]
    for c in (n, re.sub(r's$', '', n), re.sub(r'es$', '', n), re.sub(r'ies$', 'y', n)):
        if c in objs: return objs[c]
    return None

def items_of(txt):
    m = re.search(r'\|items\s*=(.*?)(?=\n\|[a-z]+\s*=|\n\}\})', txt, re.S)
    if not m: return []
    out = []
    for line in m.group(1).split('\n'):
        if not re.match(r'^\*[^*]', line.strip()): continue  # top level only
        l = line.strip()[1:].strip()
        c = re.search(r'\{\{[Cc]oins\|([\d,]+)\}\}', l)
        if c:
            out.append(('coins', int(c.group(1).replace(',', '')), l)); continue
        lk = re.search(r'\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]', l)
        if not lk: out.append((None, 0, l)); continue
        q = re.match(r'^(\d[\d,]*)\s*(?:x\s*)?', l)
        qty = int(q.group(1).replace(',', '')) if q else 1
        x = re.search(r'\bx\s?(\d+)', l)
        if x and not q: qty = int(x.group(1))
        out.append((lk.group(1), qty, l))
    return out

procs, report = [], {}
for key in sorted(handled):
    if key not in names: continue
    title = WIKI.get(key, names[key])
    txt = wiki(title)
    got, miss = [], []
    for item, qty, line in items_of(txt):
        if item == 'coins':
            got.append(('coins', qty)); continue
        o = find(item) if item else None
        if o: got.append((o, qty))
        else: miss.append(line[:90])
    report[key] = {'wiki': title, 'got': got, 'missing': miss}
json.dump(cache, open(CACHE, 'w'))
json.dump(report, open(os.path.join(os.path.dirname(__file__), 'packs_report.json'), 'w'), indent=1)
for k, v in report.items():
    print(k, '|', v['wiki'], '|', v['got'], '| MISSING:', v['missing'])

# what the wiki describes rather than lists (our picks, enough for one go)
EXTRA = {
    'crest': [('airrune', 50), ('waterrune', 20), ('earthrune', 20), ('firerune', 20), ('deathrune', 10)],  # the 4 Blast spells
    'dragon': [('lawrune', 5), ('airrune', 20)],  # Telekinetic Grab
    'hero': [('yew_longbow', 1), ('iron_arrow', 100)],
    'horror': [('yew_longbow', 1), ('iron_arrow', 100), ('airrune', 200), ('mindrune', 100), ('waterrune', 100), ('earthrune', 100), ('firerune', 100)],
    'legends': [('sapphire', 1), ('emerald', 1), ('ruby', 1), ('diamond', 1), ('opal', 1), ('jade', 1), ('red_topaz', 1)],
    'regicide': [('ball_of_wool', 4)],
    'tbwt': [('yew_longbow', 1), ('iron_arrow', 100)],
    'tree': [('lobster', 10)],
    'zanaris': [('rune_axe', 1)],
    'upass': [('iron_arrow', 5)],
    # the wiki lists no items for these; its recommended ones instead
    'junglepotion': [('3doseantipoison', 2), ('lobster', 10)],
    'totem': [('coins', 60)],  # Captain Barnaby there and back
}
SKIP = {'deserttreasure'}  # has its own hand-made ::dtpack
out = ['// EASCape: ::<quest>pack for every built quest (generated by tools/quests/make_packs.py): the',
       "// items the OSRS wiki lists for the quest (Quest details, \"Items required\"), as our game's items,",
       '// plus a few picks where the wiki describes rather than lists (combat gear, spell runes). What',
       "// doesn't fit in your pack goes to your bank. Skills and earlier quests: ::maxstats and ::questdone.",
       '// The quest list (::questpacks) names them all.', '']
keys = []
for key, v in sorted(report.items()):
    if key in SKIP: continue
    items = {}
    for o, q in v['got'] + EXTRA.get(key, []):
        items[o] = max(items.get(o, 0), q)
    keys.append(key)
    out += [f'[debugproc,{key}pack]', 'if (p_finduid(uid) = false) {', '    return;', '}']
    if not items:
        out += [f'mes("{v["wiki"]} needs no items: just start it.");', '']
        continue
    out += ['def_int $banked = 0;']
    for o, q in items.items():
        out.append(f'$banked = calc($banked + ~questpack_give({o}, {q}));')
    out += [f'~questpack_done("{v["wiki"]}", $banked);', '']
out += ['[proc,questpack_give](namedobj $obj, int $count)(int)',
        'if (oc_stackable($obj) = true) {',
        '    if (inv_freespace(inv) > 0 | inv_total(inv, $obj) > 0) {',
        '        inv_add(inv, $obj, $count);',
        '        return(0);',
        '    }',
        '} else if (inv_freespace(inv) >= $count) {',
        '    inv_add(inv, $obj, $count);',
        '    return(0);',
        '}',
        'inv_add(bank, $obj, $count);',
        'return(1);', '',
        '[proc,questpack_done](string $quest, int $banked)',
        'if ($banked > 0) {',
        '    mes("<$quest> pack: <tostring($banked)> of its items went to your bank (no room in your pack).");',
        '    return;',
        '}',
        'mes("<$quest> pack: the items the quest needs are in your pack.");', '',
        '[debugproc,questpacks]',
        'if (p_finduid(uid) = false) {', '    return;', '}']
line = ''
for k in keys + ['dt']:
    piece = f'::{k}pack'
    if len(line) + len(piece) > 75:
        out.append(f'mes("{line.strip()}");'); line = ''
    line += piece + ' '
out.append(f'mes("{line.strip()}");')
open(E + '/scripts/_test/scripts/cheats/cheat_questpacks.rs2', 'w').write('\n'.join(out) + '\n')
print('packs', len(keys))
