# Between a Rock...: the dwarven lore book's picture, from the August 2007 cache. Interface 111 there
# is the book, with the picture as model 5826 (component 2: x 346, y 176, 32x32, zoom 437, xan 383,
# yan 2025). This ports the model (content/models/dwarfrock/dwarf_rock_lore_picture.ob2) and adds it
# as a hidden component of our book screen (book:dwarf_lore_picture), at 2007's place.
# Usage: python3 -I lore_picture.py <cache468 flat dir>   (run once)
import os, sys
W = os.path.dirname(os.path.abspath(__file__)); E = os.path.abspath(W + '/../..')
sys.path.insert(0, E + '/tools/fairytale2')
from port468 import Porter

pt = Porter(sys.argv[1], f'{E}/content/models/dwarfrock')
name = pt.write_model(5826, 'dwarf_rock_lore_picture')
pt.save_packs()

bk = f'{E}/content/scripts/general/interfaces/book.if'
s = open(bk).read()
if '[dwarf_lore_picture]' not in s:
    s = s.rstrip('\n') + '\n\n// EASCape: the dwarven lore book\'s picture (2007 interface 111, component 2; tools/dwarfrock/lore_picture.py)\n'
    s += '[dwarf_lore_picture]\ntype=model\nx=346\ny=176\nwidth=32\nheight=32\nhide=yes\n'
    s += f'model={name}\nzoom=437\nxan=383\nyan=2025\n'
    open(bk, 'w').write(s)
    ip = f'{E}/content/pack/interface.pack'; io = f'{E}/content/pack/interface.order'
    nxt = max(int(l.split('=')[0]) for l in open(ip) if '=' in l) + 1
    with open(ip, 'a') as f, open(io, 'a') as g:
        f.write(f'{nxt}=book:dwarf_lore_picture\n'); g.write(f'{nxt}\n')
print('done', name)
