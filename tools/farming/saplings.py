# Farming step 2a: plant pots. From Void's potted_plants.recipes.toml (a seed sown in a filled plant
# pot gives a seedling, watering it a watered seedling) and Farming.growSaplings (a watered seedling
# turns into a sapling at the next growth tick). Writes configs/farming_saplings.enum:
#   farming_sapling_sow    seed -> seedling           farming_sapling_sowmes   seed -> message
#   farming_sapling_water  seedling -> watered        farming_sapling_watermes seedling -> message
#   farming_sapling_grow   watered -> sapling
import re, tomllib, glob
VOID = '/home/claude/greghib/void/data'
E = '/home/claude/eascape'
ourobj = {}
for line in open(E + '/content/pack/obj.pack'):
    a, b = line.strip().split('=', 1); ourobj[int(a)] = b
voidid = {}
for f in glob.glob(VOID + '/**/*.items.toml', recursive=True):
    txt = open(f, encoding='utf-8', errors='replace').read()
    for m in re.finditer(r'^\[([\w.]+)\]\s*\n(?:(?!\[)[^\n]*\n)*?id = (\d+)', txt, re.M):
        voidid.setdefault(m.group(1), int(m.group(2)))
def our(n):
    i = voidid.get(n)
    return ourobj.get(i) if i is not None and i < 7957 else None
rec = tomllib.load(open(VOID + '/skill/farming/potted_plants.recipes.toml', 'rb'))
sow, sowmes, water, watermes, grow = {}, {}, {}, {}, {}
for k, r in rec.items():
    rem, add = r['remove'], r['add']
    if 'plant_pot' in rem:
        seed = next(x for x in rem if x != 'plant_pot')
        a, b = our(seed), our(add[0])
        if a and b:
            sow[a] = b; sowmes[a] = r['message'].replace('<br>', ' ')
            w = add[0] + '_w'; s = add[0].replace('_seedling', '_sapling')
            if our(w): water[b] = our(w); watermes[b] = None
            if our(w) and our(s): grow[our(w)] = our(s)
    elif k.startswith('water_') and our(rem[1]):
        watermes[our(rem[1])] = r['message']
out = ['// EASCape: plant pots, seedlings and saplings (tools/farming/saplings.py, from Void\'s', '// potted_plants.recipes.toml and Farming.growSaplings)', '']
def enum(name, t, d):
    global out
    out += [f'[{name}]', 'inputtype=obj', f'outputtype={t}'] + (['default=null'] if t == 'namedobj' else []) + [f'val={k},{v}' for k, v in d.items() if v] + ['']
enum('farming_sapling_sow', 'namedobj', sow)
enum('farming_sapling_sowmes', 'string', sowmes)
enum('farming_sapling_water', 'namedobj', water)
enum('farming_sapling_watermes', 'string', watermes)
enum('farming_sapling_grow', 'namedobj', grow)
open(E + '/content/scripts/skill_farming/configs/farming_saplings.enum', 'w').write('\n'.join(out))
print(len(sow), len(water), len(grow))
