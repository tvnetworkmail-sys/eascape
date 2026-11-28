"""2006RS-2: our combat tabs for RuneLite's InterfaceID.CombatInterface (Combat Level, Attack Styles).

    python3 combattabs2006.py

writes app2/src/plugins/runelite/combatinterface.js (rl.CombatInterface) from our content: every combat tab the server
opens, both kinds - the 2007-style ones (skill_combat/interfaces/2007/combat07_*.if, ~combat07_tab, on by default) and
the 2006 ones (melee/ranged/magic combat_*.if) - keyed by the tab's 2006 root id, with 2006 component ids
(content/pack/interface.pack). For each tab: the "Combat Lvl:" text (LEVEL; the 2006 tabs have none), Auto Retaliate
(RETALIATE: in the 2007-style tabs their own button; the 2006 tabs have it on the controls tab, controls.if's
option_nodef button), per style index (com_mode, varp 43) the components of that style's button (_0 .. _3: the button,
its icon and its label, found by the label's centre lying in the button), the staff's spell box as index 4
(AUTOCAST_BUTTONS) and the server's style list (combat.dbrow's tables, as RuneLite's AttackStyle names).
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
IFROOT = os.path.join(REPO, 'content/scripts/skill_combat/interfaces')
CONTROLS = os.path.join(REPO, 'content/scripts/interface_controls/interfaces/controls.if')
DBROW = os.path.join(REPO, 'content/scripts/skill_combat/configs/combat.dbrow')
PACK = os.path.join(REPO, 'content/pack/interface.pack')
OUT = os.path.join(REPO, 'app2/src/plugins/runelite/combatinterface.js')

TAB_TABLE = {
    'axe': 'weapon_axe_table', 'blunt': 'weapon_blunt_table', 'bow': 'weapon_bow_table', 'claw': 'weapon_claws_table',
    'crossbow': 'weapon_crossbow_table', 'hacksword': 'weapon_slash_table', 'heavysword': 'weapon_2h_sword_table',
    'pickaxe': 'weapon_pickaxe_table', 'scythe': 'weapon_scythe_table', 'spear': 'weapon_spear_table',
    'spiked': 'weapon_spiked_table', 'stabsword': 'weapon_stab_table', 'staff': 'weapon_staff_table',
    'staff_2': 'weapon_staff_table', 'thrown': 'weapon_thrown_table', 'unarmed': 'weapon_unarmed_table',
    'whip': 'weapon_whip_table', 'polearm': 'weapon_polearm_table',
}
STYLE = {
    'melee_accurate': 'ACCURATE', 'melee_aggressive': 'AGGRESSIVE', 'melee_defensive': 'DEFENSIVE',
    'melee_controlled': 'CONTROLLED', 'ranged_accurate': 'RANGING', 'ranged_rapid': 'RANGING',
    'ranged_longrange': 'LONGRANGE', 'magic_normal': 'CASTING', 'magic_defensive': 'DEFENSIVE_CASTING',
}


def parse_if(path):
    comps = {}
    cur = None
    for line in open(path):
        line = line.rstrip('\n')
        m = re.match(r'^\[(.+)\]$', line)
        if m:
            cur = m.group(1)
            comps[cur] = {}
        elif cur and '=' in line:
            k, v = line.split('=', 1)
            comps[cur][k] = v
    return comps


def abs_rect(comps, name):
    c = comps[name]
    x, y = int(c.get('x', 0)), int(c.get('y', 0))
    p = c.get('layer')
    while p:
        x += int(comps[p].get('x', 0))
        y += int(comps[p].get('y', 0))
        p = comps[p].get('layer')
    return x, y, int(c.get('width', 0)), int(c.get('height', 0))


def ancestors(comps, name):
    out, p = set(), comps[name].get('layer')
    while p:
        out.add(p)
        p = comps[p].get('layer')
    return out


def inside(comps, name, button):
    x, y, w, h = abs_rect(comps, name)
    bx, by, bw, bh = abs_rect(comps, button)
    cx, cy = x + w / 2, y + h / 2
    return bx <= cx < bx + bw and by <= cy < by + bh


def members(comps, button):
    up = ancestors(comps, button)
    out = [button]
    for n, c in comps.items():
        if n == button or n in up or 'width' not in c or 'specbar' in n:
            continue
        if any(a not in up and a != n and 'specbar' in a for a in ancestors(comps, n)):
            continue
        if c.get('layer') and c['layer'] not in up and c['layer'] != button:
            continue
        if inside(comps, n, button):
            out.append(n)
    return out


def main():
    ids = {}
    for line in open(PACK):
        m = re.match(r'^(\d+)=(.+)$', line.strip())
        if m:
            ids[m.group(2)] = int(m.group(1))
    styles, cur = {}, None
    for line in open(DBROW):
        m = re.match(r'^\[(\w+)\]', line)
        if m:
            cur = m.group(1)
            styles[cur] = []
        m = re.match(r'^data=damagestyle,\^style_(\w+)', line)
        if m and cur:
            styles[cur].append(STYLE[m.group(1)])
    controls = parse_if(CONTROLS)
    nodef = [n for n, c in controls.items() if c.get('script1op1') == 'pushvar,option_nodef']
    controls_retaliate = sorted(ids['controls:' + n] for n in nodef if 'controls:' + n in ids)
    tabs = {}
    files = []
    for d in ('2007', 'melee', 'ranged', 'magic'):
        for f in sorted(os.listdir(os.path.join(IFROOT, d))):
            if f.startswith('combat') and f.endswith('.if'):
                files.append(os.path.join(IFROOT, d, f))
    for path in files:
        iface = os.path.basename(path)[:-3]
        kind = iface.split('_', 1)[1]
        comps = parse_if(path)
        cid = lambda n: ids.get('%s:%s' % (iface, n))
        idlist = lambda ns: sorted(i for i in (cid(n) for n in ns) if i is not None)
        level = next((n for n, c in comps.items() if c.get('text', '').startswith('Combat Lvl:')), None)
        buttons = {}
        for n, c in comps.items():
            if c.get('script1op1') == 'pushvar,com_mode' and c.get('script1', '').startswith('eq,'):
                buttons[int(c['script1'].split(',')[1])] = n
        tab = {
            'name': iface,
            'level': cid(level) if level else -1,
            'retaliate': idlist(members(comps, 'autoretaliate')) if 'autoretaliate' in comps else controls_retaliate,
            'buttons': [idlist(members(comps, buttons[i])) for i in sorted(buttons)],
            'styles': styles.get(TAB_TABLE.get(kind), []),
        }
        if 'auto_choose' in comps:
            tab['buttons'].append(idlist(members(comps, 'auto_choose')))
            tab['styles'] = tab['styles'] + [None, 'CASTING']
        tabs[ids[iface]] = tab
    template = open(os.path.join(HERE, 'combatinterface2006.tmpl.js')).read()
    open(OUT, 'w').write(template.replace('/*TABS*/', json.dumps(tabs, separators=(',', ':'))))
    print('wrote', OUT, len(tabs), 'tabs')


if __name__ == '__main__':
    main()
