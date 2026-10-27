# Fairytale II, step 2b: the right-click options on the fairy rings convert_maps.py brought over
# (its output keeps the 2007 cache's single "Use"). Run after convert_maps.py.
#   - every ring of the network: Zanaris, Configure, Last-destination (the OSRS wiki's options,
#     Fairy ring), in the category fairy_ring for the scripts;
#   - the Zanaris ring the network meets at (12128, BKS): Configure and Last-destination, in
#     fairy_ring_zanaris (there is no "Zanaris" from Zanaris);
#   - the two other rings in Zanaris (12094 to the Lumbridge Swamp shed, 12003 to Al Kharid) are
#     one-way exits, not part of the network, and keep "Use".
# Examines from the OSRS wiki (Fairy ring: "Don't eat any!"; Fairy ring (Zanaris): "Better not eat
# them!"); the 2007 cache has none.
import os, re
E = os.path.abspath(os.path.dirname(os.path.abspath(__file__)) + '/../..')
P = f'{E}/content/scripts/areas/area_fairy_rings/configs/fairy_rings.loc'
EXITS = {'ft2_fairy_ring_12094', 'ft2_fairy_ring_12003'}
HUB = 'ft2_fairy_ring_12128'
s = open(P).read()
blocks = re.split(r'(?=^\[)', s, flags=re.M)
out = []
n = 0
for b in blocks:
    m = re.match(r'\[([a-z0-9_]+)\]\n', b)
    if not m or 'name=Fairy ring\n' not in b:
        out.append(b); continue
    if m[1] in EXITS:
        out.append(b.replace('name=Fairy ring\n', 'name=Fairy ring\ndesc=Better not eat them!\n')); continue
    b = b.replace('name=Fairy ring\n', "name=Fairy ring\ndesc=Don't eat any!\n")
    assert 'op1=Use\n' in b, m[1]
    if m[1] == HUB:
        b = b.replace('op1=Use\n', 'op1=Configure\nop3=Last-destination\ncategory=fairy_ring_zanaris\n')
    else:
        b = b.replace('op1=Use\n', 'op1=Zanaris\nop2=Configure\nop3=Last-destination\ncategory=fairy_ring\n')
    n += 1
    out.append(b)
open(P, 'w').write(''.join(out))
cat = f'{E}/content/pack/category.pack'
have = {l.split('=', 1)[1].strip() for l in open(cat) if '=' in l}
nxt = max(int(l.split('=')[0]) for l in open(cat) if '=' in l) + 1
with open(cat, 'a') as f:
    for c in ('fairy_ring', 'fairy_ring_zanaris'):
        if c not in have:
            f.write(f'{nxt}={c}\n'); nxt += 1
print(n, 'rings')
