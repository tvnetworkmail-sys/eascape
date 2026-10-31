# Farming step 2d: compost bins. From Void's data: the bin's varbit values (compost_bin.varbits.toml,
# the same for all four bins: 740-743) and which items go in (items with compostable / super_compost).
# Writes configs/farming_compost.enum:
#   farming_compost_decode  value -> contents * 100 + count; farming_compost_encode the other way
#     contents: 1 compostable, 2 compost, 3 compostable rotting, 4 compostable ready,
#     5 supercompostable, 6 supercompost, 7 supercompostable rotting, 8 supercompostable ready,
#     9 tomatoes, 10 rotten tomatoes, 11 tomatoes rotting, 12 tomatoes ready (0: empty)
#   farming_compostable  item -> 1 (makes compost) or 2 (makes supercompost)
import re, tomllib, glob
VOID = '/home/claude/greghib/void/data'
E = '/home/claude/eascape'
ourobj = {}
for line in open(E + '/content/pack/obj.pack'):
    a, b = line.strip().split('=', 1); ourobj[int(a)] = b
voidid, params = {}, {}
for f in glob.glob(VOID + '/**/*.items.toml', recursive=True):
    txt = open(f, encoding='utf-8', errors='replace').read()
    for m in re.finditer(r'^\[([\w.]+)\]\s*\n(?:(?!\[)[^\n]*\n)*?id = (\d+)', txt, re.M):
        voidid.setdefault(m.group(1), int(m.group(2)))
    try:
        for k, v in tomllib.load(open(f, 'rb')).items():
            if isinstance(v, dict): params.setdefault(k, v)
    except Exception:
        pass
def our(n):
    i = voidid.get(n)
    return ourobj.get(i) if i is not None and i < 7957 else None
txt = open(VOID + '/skill/farming/compost_bin.varbits.toml').read()
vals = re.search(r'\[compost_bin_falador\][\s\S]*?values = \{([^}]*)\}', txt).group(1)
CODE = {'compostable': 1, 'compost': 2, 'compostable_rotting': 3, 'compostable_ready': 4, 'supercompostable': 5,
        'supercompost': 6, 'supercompostable_rotting': 7, 'supercompostable_ready': 8, 'tomatoes': 9,
        'rotten_tomatoes': 10, 'tomatoes_rotting': 11, 'tomatoes_ready': 12}
dec, enc = {}, {}
for name, v in re.findall(r'(\w+)\s*=\s*(\d+)', vals):
    v = int(v)
    if name == 'empty': key = 0
    elif name in CODE: key = CODE[name] * 100
    else:
        m = re.match(r'^(\w+)_(\d+)$', name)
        if not m or m.group(1) not in CODE: continue
        key = CODE[m.group(1)] * 100 + int(m.group(2))
    dec[v] = key; enc.setdefault(key, v)
items = {}
for k, v in params.items():
    if v.get('compostable'):
        o = our(k)
        if o: items[o] = 2 if v.get('super_compost') else 1
out = ['// EASCape: compost bins (tools/farming/compost.py, from Void\'s compost_bin.varbits.toml and', '// its items\' compostable / super_compost)', '']
out += ['[farming_compost_decode]', 'inputtype=int', 'outputtype=int', 'default=-1'] + [f'val={k},{v}' for k, v in sorted(dec.items())] + ['']
out += ['[farming_compost_encode]', 'inputtype=int', 'outputtype=int', 'default=-1'] + [f'val={k},{v}' for k, v in sorted(enc.items())] + ['']
out += ['[farming_compostable]', 'inputtype=obj', 'outputtype=int', 'default=0'] + [f'val={k},{v}' for k, v in sorted(items.items())] + ['']
open(E + '/content/scripts/skill_farming/configs/farming_compost.enum', 'w').write('\n'.join(out))
print(len(dec), len(items), sorted(items.items()))
