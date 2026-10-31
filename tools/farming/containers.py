# Farming step 2e: fruit baskets and vegetable sacks (Void Baskets.kt / Sack.kt): the farmers take
# them as payment. Writes configs/farming_containers.enum (our 2006 item names).
E = '/home/claude/eascape'
FAM = [('basket', 'strawberry', 'strawberry', 5), ('basket', 'orange', 'orange', 5), ('basket', 'banana', 'banana', 5),
       ('basket', 'apple', 'cooking_apple', 5), ('basket', 'tomato', 'tomato', 5),
       ('sack', 'potato', 'potato', 10), ('sack', 'onion', 'onion', 10), ('sack', 'cabbage', 'cabbage', 10)]
prod, count, nxt, prev, first = {}, {}, {}, {}, {}
for kind, name, item, size in FAM:
    for n in range(1, size + 1):
        c = f'{kind}_{name}_{n}'
        prod[c] = item; count[c] = n
        nxt[c] = f'{kind}_{name}_{n + 1}' if n < size else None
        prev[c] = f'{kind}_{name}_{n - 1}' if n > 1 else f'{kind}_empty'
    first[item] = f'{kind}_{name}_1'
out = ['// EASCape: fruit baskets and vegetable sacks (tools/farming/containers.py, after Void\'s Baskets.kt', '// and Sack.kt)', '']
def enum(n, t, d, default=None):
    global out
    out += [f'[{n}]', 'inputtype=obj', f'outputtype={t}'] + ([f'default={default}'] if default is not None else []) + [f'val={k},{v}' for k, v in d.items() if v] + ['']
enum('farming_cont_produce', 'namedobj', prod, 'null')
enum('farming_cont_count', 'int', count, '0')
enum('farming_cont_next', 'namedobj', nxt, 'null')
enum('farming_cont_prev', 'namedobj', prev, 'null')
enum('farming_cont_first', 'namedobj', first, 'null')
open(E + '/content/scripts/skill_farming/configs/farming_containers.enum', 'w').write('\n'.join(out))
