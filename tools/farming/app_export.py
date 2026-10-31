#!/usr/bin/env python3
"""Farming tracker data for the app (app/src/plugins/farming/patches.json), from our own
content: each patch's varbit (its varp and bits, all transmitted to the client), where it is
(Void's names for the same varbit ids), its type, the decode tables (varbit value -> packed
crop * 1000 + kind * 100 + stage, farming_states.enum) and each crop's name and stages
(farming_crops.dbrow). Growth intervals are farming.rs2's: flowers every 5-minute tick,
allotments and hops every 2nd, herbs every 4th."""
import re, json, os
E = os.path.join(os.path.dirname(__file__), '..', '..')
C = E + '/content'
OUT = E + '/app/src/plugins/farming/patches.json'
PLACES = {708: 'Falador (North West)', 709: 'Falador (South East)', 710: 'Catherby (North)',
          711: 'Catherby (South)', 712: 'Ardougne (North)', 713: 'Ardougne (South)',
          714: 'Morytania (North West)', 715: 'Morytania (South East)', 728: 'Falador',
          729: 'Catherby', 730: 'Ardougne', 731: 'Morytania', 780: 'Falador', 781: 'Catherby',
          782: 'Ardougne', 783: 'Morytania', 716: 'Yanille', 717: 'Entrana', 718: 'Lumbridge',
          719: "Seers' Village", 700: 'Taverley', 701: 'Falador', 702: 'Varrock', 703: 'Lumbridge',
          704: 'Gnome Stronghold', 705: 'Tree Gnome Village', 706: 'Brimhaven', 707: 'Catherby',
          732: "Champions' Guild", 733: 'Rimmington', 734: 'Etceteria', 735: 'Ardougne'}  # Void's farming.varbits.toml names for these ids
# key, RuneLite's tab name, growth every n-th 5-minute tick, RuneLite's tab icon (Tab.java)
TYPES = {1: ('allotment', 'Allotment Patches', 2, 'cabbage'), 2: ('flower', 'Flower Patches', 1, 'flowers_waterfall_quest_red'),
         3: ('herb', 'Herb Patches', 4, 'unidentified_ranarr'), 4: ('hops', 'Hops Patches', 2, 'barley'),
         # step 2a; the tab icons are our choice
         5: ('tree', 'Tree Patches', 8, 'oak_logs'), 6: ('fruit_tree', 'Fruit Tree Patches', 32, 'cooking_apple'),
         7: ('bush', 'Bush Patches', 4, 'redberries')}
objid = {l.split('=', 1)[1].strip(): int(l.split('=', 1)[0]) for l in open(C + '/pack/obj.pack') if '=' in l}
order = list(range(708, 716)) + list(range(728, 732)) + list(range(780, 784)) + list(range(716, 720)) + list(range(700, 708)) + list(range(732, 736))
vb = dict(re.findall(r'(?ms)^\[(\w+)\]\n(.*?)(?=^\[|\Z)', open(C + '/scripts/_unpack/377/all.varbit').read()))
ids = {l.split('=', 1)[1].strip(): int(l.split('=', 1)[0]) for l in open(C + '/pack/varp.pack') if '=' in l}
patches = []
for i, v in enumerate(order, 1):
    b = vb[f'varbit_{v}']
    base = re.search(r'basevar=(\w+)', b).group(1)
    t = 1 if i <= 8 else 2 if i <= 12 else 3 if i <= 16 else 4 if i <= 20 else 5 if i <= 24 else 6 if i <= 28 else 7
    patches.append({'index': i, 'varbit': v, 'varp': ids[base], 'start': int(re.search(r'startbit=(\d+)', b).group(1)),
                    'end': int(re.search(r'endbit=(\d+)', b).group(1)), 'type': t, 'place': PLACES[v]})
enum = open(C + '/scripts/skill_farming/configs/farming_states.enum').read()
decode = {}
for name, body in re.findall(r'(?ms)^\[farming_(\w+)_decode\]\n(.*?)(?=^\[|\Z)', enum):
    decode[name] = {int(a): int(b) for a, b in re.findall(r'^val=(\d+),(-?\d+)', body, re.M)}
crops = {}
for body in re.findall(r'(?ms)^\[farming_crop_\w+\]\n(.*?)(?=^\[|\Z)', open(C + '/scripts/skill_farming/configs/farming_crops.dbrow').read()):
    g = lambda k: re.search(r'^data=' + k + r',(.*)$', body, re.M).group(1)
    m = re.search(r'^data=produce,(\w+)', body, re.M)
    crops[int(g('index'))] = {'name': g('name').replace('_', ' '), 'stages': int(g('stages')), 'type': int(g('patchtype')),
                              'item': objid.get(m.group(1)) if m else None}
data = {'types': {k: {'key': a, 'title': b, 'ticks': c, 'icon': objid[d]} for k, (a, b, c, d) in TYPES.items()},
        'tabOrder': [3, 5, 6, 2, 1, 4, 7],  # RuneLite's FARMING_TABS order: herb, tree, fruit tree, flower, allotment, hops, bush
        'weeds': objid['weeds'],
        # the varps the server sends the app (::appfarming, eascape_app.rs2): growth offset + 1, clock minute
        'appVarps': {'offset': ids['eascape_farming_offset'], 'clock': ids['eascape_farming_clock']},
        # RuneLite's Overview tab icon is the DS2 Crandor notes, not in this game: the Crandor map (our choice)
        'overviewIcon': objid['dragonmap'], 'patches': patches, 'decode': decode, 'crops': crops, 'tickMinutes': 5}
json.dump(data, open(OUT, 'w'), indent=1)
print(len(patches), 'patches,', {k: len(v) for k, v in decode.items()}, len(crops), 'crops ->', OUT)
