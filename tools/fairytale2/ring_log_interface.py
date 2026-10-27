# Fairytale II: the fairy ring travel log, shown in the side panel while the code screen is open.
# The August 2007 cache has none (OSRS added one later: "a list of rings to which you have recently
# travelled ... click on the ring code in the travel log and the code will be automatically
# entered. Up to ten fairy ring codes can be marked as favourites", OSRS wiki, Fairy ring), so this
# is ours, laid out as the OSRS one is (the user's screenshot of it): on the side panel's own stone,
# "Travel log" at the top, then each code you've used with its place under it in one or two lines,
# a red heart with a minus by a favourite (Remove Favourite) and a green one with a plus by the rest
# (Add Favourite), favourites first. The hearts are our own sprite (eascape_hearts), drawn after
# that screenshot; the colours are the screenshot's: orange writing, codes in red.
# Our choices: the rows are as tall as their lines (the scripts place them); the place names are
# broken into lines here, measured in the p12 font (fontwidth.py), and kept in fairy_rings.dbrow.
# Writes: interfaces/fairyrings_log.if, configs/fairy_rings_log.enum, scripts/fairy_rings_log.rs2,
# the line1/line2 fields of configs/fairy_rings.dbrow, and the ids in interface.pack/order.
# Usage: ring_log_interface.py   (re-run replaces all of these)
import os, re, sys
W = os.path.dirname(os.path.abspath(__file__)); E = os.path.abspath(W + '/../..')
sys.path.insert(0, W)
from fontwidth import advances, width

A = f'{E}/content/scripts/areas/area_fairy_rings'
SLOTS = 36          # every code our game has (fairy_rings.dbrow)
LIST_W = 168
TEXT_X = 17
LINE_W = LIST_W - TEXT_X
LINE_H = 13
ORANGE = '0xFF981F'
RED = '0xE8303C'
adv = advances('p12_full')

# ---------------------------------------------------------------- the place names in lines
db = open(f'{A}/configs/fairy_rings.dbrow').read()
db = re.sub(r'\ndata=line[12],[^\n]*', '', db)
def split(name):
    if width(adv, name) <= LINE_W:
        return name, ''
    words = name.split(' ')
    for k in range(len(words) - 1, 0, -1):
        a, b = ' '.join(words[:k]), ' '.join(words[k:])
        if width(adv, a) <= LINE_W:
            if width(adv, b) > LINE_W:
                raise SystemExit(f'{name}: too long for two lines')
            return a, b
    raise SystemExit(f'{name}: no break')
heights = []
q = lambda v: f'"{v}"' if ',' in v else v     # a value with a comma is quoted in a dbrow
def add_lines(m):
    l1, l2 = split(m[1].strip('"'))
    heights.append(LINE_H * (3 if l2 else 2) + 3)
    return m[0] + f'\ndata=line1,{q(l1)}' + (f'\ndata=line2,{q(l2)}' if l2 else '')
db = re.sub(r'data=name,([^\n]*)', add_lines, db)
open(f'{A}/configs/fairy_rings.dbrow', 'w').write(db)
tbl = open(f'{A}/configs/fairy_rings.dbtable').read()
if 'column=line1' not in tbl:
    tbl = tbl.rstrip('\n') + '\n// the place in the travel log\'s lines (tools/fairytale2/ring_log_interface.py)\ncolumn=line1,string,REQUIRED\ncolumn=line2,string\n'
    open(f'{A}/configs/fairy_rings.dbtable', 'w').write(tbl)

# ---------------------------------------------------------------- the interface
out = ['// EASCape: the fairy ring travel log (side panel), made by tools/fairytale2/ring_log_interface.py.',
       '// The scripts fill the rows (favourites first, then code order), place them and hide the rest.', '']
names = []
def com(name, lines):
    names.append(name); out.append(f'[{name}]'); out.extend(lines); out.append('')
com('title', ['type=text', 'x=0', 'y=5', 'width=190', 'height=16', 'font=b12_full', 'center=yes', 'shadowed=yes',
              'text=Travel log', f'colour={ORANGE}'])
com('empty', ['type=text', 'x=8', 'y=34', 'width=174', 'height=40', 'font=p12_full', 'shadowed=yes',
              'text=No fairy ring codes used yet.', f'colour={ORANGE}'])
com('list', ['type=layer', 'x=3', 'y=24', f'width={LIST_W}', 'height=234', f'scroll={sum(heights) + 2}'])
# each row is a layer, as 377 hides layers only (a hidden button would still take clicks): its
# "Select" box comes in two heights, and the two hearts are layers of their own so the option
# matches the heart shown
for i in range(SLOTS):
    com(f'slot{i}', ['layer=list', 'type=layer', 'x=0', 'y=0', f'width={LIST_W}', f'height={LINE_H * 3 + 3}', 'hide=yes'])
    for kind, lines in (('short', 2), ('tall', 3)):
        com(f'{kind}{i}', [f'layer=slot{i}', 'type=layer', 'x=0', 'y=0', f'width={LIST_W}', f'height={LINE_H * lines + 2}'])
        com(f'{kind}button{i}', [f'layer={kind}{i}', 'type=rect', f'x={TEXT_X}', 'y=0', 'buttontype=normal',
                                 f'width={LIST_W - TEXT_X}', f'height={LINE_H * lines + 1}', 'trans=255', 'colour=0xFFFFFF',
                                 'option=Select'])
    for kind, sprite, option in (('add', 0, 'Add Favourite'), ('remove', 1, 'Remove Favourite')):
        com(f'{kind}{i}', [f'layer=slot{i}', 'type=layer', 'x=1', 'y=1', 'width=13', 'height=13'])
        com(f'{kind}heart{i}', [f'layer={kind}{i}', 'type=graphic', 'x=0', 'y=0', 'buttontype=normal', 'width=13', 'height=13',
                                f'graphic=eascape_hearts,{sprite}', f'option={option}'])
    com(f'code{i}', [f'layer=slot{i}', 'type=text', f'x={TEXT_X}', 'y=0', 'width=40', f'height={LINE_H}', 'font=p12_full',
                     'shadowed=yes', 'text=AIQ', f'colour={RED}'])
    for k in (1, 2):
        com(f'line{k}_{i}', [f'layer=slot{i}', 'type=text', f'x={TEXT_X}', f'y={LINE_H * k}', f'width={LINE_W}', f'height={LINE_H}',
                             'font=p12_full', 'shadowed=yes', 'text=', f'colour={ORANGE}'])
open(f'{A}/interfaces/fairyrings_log.if', 'w').write('\n'.join(out))

# ---------------------------------------------------------------- the enums and buttons
enums = ['// EASCape: the travel log\'s components by row, made by tools/fairytale2/ring_log_interface.py', '']
for enum, part in (('slots', 'slot'), ('shorts', 'short'), ('talls', 'tall'), ('codes', 'code'), ('line1s', 'line1_'),
                   ('line2s', 'line2_'), ('adds', 'add'), ('removes', 'remove')):
    enums += [f'[fairy_rings_log_{enum}]', 'inputtype=int', 'outputtype=component']
    enums += [f'val={i},fairyrings_log:{part}{i}' for i in range(SLOTS)] + ['']
open(f'{A}/configs/fairy_rings_log.enum', 'w').write('\n'.join(enums))
rs = ['// EASCape: the travel log\'s buttons, made by tools/fairytale2/ring_log_interface.py', '']
for i in range(SLOTS):
    rs += [f'[if_button,fairyrings_log:shortbutton{i}] ~fairy_rings_log_pick({i});',
           f'[if_button,fairyrings_log:tallbutton{i}] ~fairy_rings_log_pick({i});',
           f'[if_button,fairyrings_log:addheart{i}] ~fairy_rings_log_favourite({i}, true);',
           f'[if_button,fairyrings_log:removeheart{i}] ~fairy_rings_log_favourite({i}, false);']
open(f'{A}/scripts/fairy_rings_log.rs2', 'w').write('\n'.join(rs) + '\n')

# ---------------------------------------------------------------- ids
ip = f'{E}/content/pack/interface.pack'; io = f'{E}/content/pack/interface.order'
lines = open(ip).read().splitlines()
old = {l.split('=')[0] for l in lines if l.split('=', 1)[1].startswith('fairyrings_log')}
open(ip, 'w').write('\n'.join(l for l in lines if l.split('=')[0] not in old) + '\n')
order = open(io).read().splitlines()
open(io, 'w').write('\n'.join(o for o in order if o not in old) + '\n')
nxt = max(int(l.split('=')[0]) for l in open(ip) if '=' in l) + 1
with open(ip, 'a') as f, open(io, 'a') as g:
    for n in ['fairyrings_log'] + [f'fairyrings_log:{x}' for x in names]:
        f.write(f'{nxt}={n}\n'); g.write(f'{nxt}\n'); nxt += 1
print(len(names), 'components;', sum(1 for h in heights if h > 30), 'two-line places of', len(heights))
