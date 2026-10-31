# EASCape: the 2007 combat tabs (the "2007 interface" app plugin), from the August 2007 cache
# (build 468): its weapon interfaces (IF1 groups 75-93) written as 377 interfaces combat07_<kind>,
# shown instead of 2006's combat_<kind> while the plugin is on (player_attackstyles.rs2,
# %eascape_combat07). Each keeps its 2007 components, places, sprites (content/sprites/c07_<id>,
# archive 8 group <id>), fonts and the special attack bar (sprite 657 and models 18552-18562,
# filled by special energy, varp 300 = sa_energy).
# 2007's varps map to ours: 43 com_mode, 300 sa_energy, 301 sa_attack, 172 option_nodef.
# Component names: the style buttons b<style> (their com_mode), autoretaliate, name (the weapon
# name text), specbar_layer and specbar (as 2006's), auto_spell / auto_choose (staff).
# Our choices: the hover tooltips (type 8, which 377 can't show) are left out; vertically centred
# texts are placed at the middle of their boxes (377 has no vertical alignment); the staff tab
# keeps 2006's magic: no defensive casting (its box is left out), its Spell box opens the spell
# list and shows the chosen spell's name in place of its icon (2007 showed the spell's icon).
# Usage: combat_tabs.py <cache468 flat dir>   (re-running replaces what it wrote)
import os, sys, re
W = os.path.dirname(os.path.abspath(__file__)); E = os.path.abspath(W + '/../..')
sys.path.insert(0, W + '/../fairytale2')
from port468 import Porter, ORIG
from if468 import decode_if1
from sprites468 import decode_sprites
from PIL import Image

pt = Porter(sys.argv[1], f'{E}/content/models/frame2007')
c = pt.c
FONT = {494: 'p11_full', 495: 'p12_full', 496: 'b12_full', 497: 'q8_full'}
VARP = {43: 'com_mode', 300: 'sa_energy', 301: 'sa_attack', 172: 'option_nodef'}
OPS = {1: 'eq', 2: 'lt', 3: 'gt', 4: 'neq'}
KINDS = {
    'heavysword': 82, 'axe': 75, 'blunt': 76, 'pickaxe': 83, 'scythe': 86, 'hacksword': 81,
    'spear': 87, 'spiked': 88, 'stabsword': 89, 'claw': 78, 'whip': 93, 'polearm': 84,
    'bow': 77, 'crossbow': 79, 'thrown': 91, 'staff': 90, 'unarmed': 92,
}
MAG = (255, 0, 255)

def sprite(g):
    name = f'c07_{g}'
    path = f'{E}/content/sprites/{name}.png'
    if not os.path.exists(path):
        sp = decode_sprites(list(c.files(8, g).values())[0]); s = sp['sprites'][0]
        im = Image.new('RGB', (sp['maxw'], sp['maxh']), MAG); px = im.load()
        for y in range(s['h']):
            for x in range(s['w']):
                v = s['px'][x + y * s['w']]
                if v is not None:
                    rgb = ((v >> 16) & 255, (v >> 8) & 255, v & 255)
                    px[s['ox'] + x, s['oy'] + y] = rgb if rgb != MAG else (254, 0, 254)
        im.save(path)
    return f'{name},0'

def model(mid):
    if mid < ORIG['model']:
        return pt.P['model'][mid]
    if mid in pt.newmodels:
        return pt.newmodels[mid]
    return pt.write_model(mid, f'c07_ifm{mid}')

def col(t):
    t = re.sub(r'<col=([0-9a-fA-F]{6})>', lambda m: {'ffff00': '@yel@', '00ff00': '@gre@'}[m.group(1).lower()], t)
    return t.replace('<br>', '\\n')

def script(o, staff):
    sc = o.get('scripts'); cmp = o.get('comparators')
    if not sc or not sc[0]:
        return []
    s = sc[0]
    if s == [8, 0]:
        return ['script1op1=op8']
    if staff and 2668 in s:   # 2007's autocast: ours is lastcastspell bit 0
        return ['script1op1=testbit,lastcastspell,0', 'script1=eq,1']
    assert s[0] == 5 and len(s) == 3, s
    return [f'script1op1=pushvar,{VARP[s[1]]}', f'script1={OPS[cmp[0][0]]},{cmp[0][1]}']

names = {}
for kind, gid in KINDS.items():
    C = {k: decode_if1(v) for k, v in c.files(3, gid).items()}
    staff = kind == 'staff'
    ifname = f'combat07_{kind}'
    # what is left out: tooltips, hidden layers (bar the special bar's) and what is in them,
    # and the staff's defensive casting box with its label and icon
    spec = [k for k, o in C.items() if o['type'] == 3 and 'Special' in (o.get('option') or '')]
    speclayer = C[spec[0]]['layer'] if spec else None
    drop = set()
    for k, o in C.items():
        if o['type'] == 8 or (o['type'] == 0 and o.get('hide') and k != speclayer):
            drop.add(k)
    if staff:
        # the defensive Spell box (4), its label (105), shield (104) and icon layer (176)
        drop |= {4, 104, 105, 176}
    changed = True
    while changed:
        changed = False
        for k, o in C.items():
            if k not in drop and o.get('layer') in drop:
                drop.add(k); changed = True
    cname = {}
    for k, o in sorted(C.items()):
        if k in drop:
            continue
        opt = o.get('option') or ''
        s = (o.get('scripts') or [[]])[0]
        if k == speclayer:
            cname[k] = 'specbar_layer'
        elif k in spec:
            cname[k] = 'specbar'
        elif o['type'] == 5 and opt == 'Auto Retaliate':
            cname[k] = 'autoretaliate'
        elif o['type'] == 5 and o.get('menutype') == 5 and s[:2] == [5, 43]:
            cname[k] = f"b{o['comparators'][0][1]}"
        elif staff and o['type'] == 5 and o.get('menutype'):
            cname[k] = 'auto_choose'
        elif staff and k == 83:
            cname[k] = 'auto_icon'          # the Spell box's icon while no spell is chosen
        elif o['type'] == 4 and o.get('text') == '%1':
            cname[k] = 'name'
        else:
            cname[k] = f'com{k}'
    out = ['type=overlay', '']
    comps = []
    def com(k, lines):
        o = C[k]
        comps.append(cname[k]); out.append(f'[{cname[k]}]')
        if o.get('layer') is not None:
            out.append(f"layer={cname[o['layer']]}")
        out.extend(lines); out.append('')
    for k, o in sorted(C.items()):
        if k in drop:
            continue
        xywh = [f"x={o['x']}", f"y={o['y']}", f"width={o['width']}", f"height={o['height']}"]
        t = o['type']; opt = o.get('option') or ''
        if t == 0:
            com(k, ['type=layer'] + xywh + (['hide=yes'] if o.get('hide') else []))
        elif t == 3:
            lines = ['type=rect'] + xywh + ([f"trans={o['trans']}"] if o.get('trans') else []) + [f"colour=0x{o['colour']:06X}"]
            if o.get('menutype') == 1:
                lines.insert(1, 'buttontype=normal'); lines.append(f'option={col(opt)}')
            com(k, lines)
        elif t == 5:
            lines = ['type=graphic'] + xywh
            if o.get('menutype') == 5:
                lines.insert(1, 'buttontype=select')
            elif o.get('menutype') == 1:
                lines.insert(1, 'buttontype=normal')
            lines += script(o, staff)
            if o['graphic'] >= 0:
                lines.append(f"graphic={sprite(o['graphic'])}")
            if o.get('activegraphic', -1) >= 0:
                lines.append(f"activegraphic={sprite(o['activegraphic'])}")
            if o.get('menutype') in (1, 5) and opt:
                lines.append(f'option={col(opt)}')
            com(k, lines)
        elif t == 6:
            com(k, ['type=model'] + xywh + script(o, staff) + [f"model={model(o['model'])}", f"zoom={o['zoom']}", f"xan={o.get('xan', 0)}", f"yan={o.get('yan', 0)}"])
        elif t == 4:
            text = col(o['text']); n = text.count('\\n') + 1
            y = o['y'] + ((o['height'] - 14 * n) // 2 if o.get('valign') else 0)
            lines = ['type=text', f"x={o['x']}", f'y={y}', f"width={o['width']}", f"height={o['height']}"] + script(o, staff)
            if o.get('center'): lines.append('center=yes')
            lines += [f"font={FONT[o['font']]}"]
            if o.get('shadowed'): lines.append('shadowed=yes')
            lines += [f'text={text}']
            if o.get('activetext'): lines.append(f"activetext={col(o['activetext'])}")
            lines.append(f"colour=0x{o['colour']:06X}")
            if o.get('activecolour'): lines.append(f"activecolour=0x{o['activecolour']:06X}")
            com(k, lines)
        else:
            raise SystemExit(f'{gid}:{k} type {t}')
    if staff:
        # the chosen spell's name, in the Spell box under its label (ours: 2007 showed its icon)
        box = [k for k, n in cname.items() if n == 'auto_choose'][0]
        b = C[box]; lay = b.get('layer')
        comps.append('auto_spell')
        out += ['[auto_spell]'] + ([f'layer={cname[lay]}'] if lay is not None else []) + [
            'type=text', f"x={b['x']}", f"y={b['y'] + 12}", f"width={b['width']}", 'height=11', 'center=yes',
            'font=p11_full', 'shadowed=yes', 'text=', 'colour=0xFF981F', '']
    open(f'{E}/content/scripts/skill_combat/interfaces/2007/{ifname}.if', 'w').write('\n'.join(out))
    names[ifname] = comps

ip = f'{E}/content/pack/interface.pack'; io = f'{E}/content/pack/interface.order'
lines = open(ip).read().splitlines()
old = {l.split('=')[0] for l in lines if '=' in l and l.split('=', 1)[1].split(':')[0] in names}
open(ip, 'w').write('\n'.join(l for l in lines if l.split('=')[0] not in old) + '\n')
order = open(io).read().splitlines()
open(io, 'w').write('\n'.join(o for o in order if o not in old) + '\n')
nxt = max(int(l.split('=')[0]) for l in open(ip) if '=' in l) + 1
with open(ip, 'a') as f, open(io, 'a') as g:
    for ifname, comps in names.items():
        for n in [ifname] + [f'{ifname}:{x}' for x in comps]:
            f.write(f'{nxt}={n}\n'); g.write(f'{nxt}\n'); nxt += 1
pt.save_packs()
print({k: len(v) for k, v in names.items()})
