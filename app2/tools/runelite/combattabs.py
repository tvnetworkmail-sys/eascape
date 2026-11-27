"""The 2007 combat tabs for RuneLite's InterfaceID.CombatInterface (Combat Level, Attack Styles).

    python3 combattabs.py

writes app/src/plugins/runelite/combatinterface.js (rl.CombatInterface). OSRS has one combat interface (593) whose
components the weapon category script rearranges; 2007 has a tab per weapon type (groups 75-93, the server's
combat07_*.if, opened by ~combat07_tab). For each tab: the "Combat Lvl:" text (CombatInterface.LEVEL), Auto Retaliate
(RETALIATE: its button and text), and per style index (com_mode, varp 43; OSRS's COM_MODE) the components of that
style's button (CombatInterface._0 .. _3: the button, its icon and its label, found by the label's centre lying in
the button), the staff's spell box as index 4 (AUTOCAST_BUTTONS), and the server's style list (combat.dbrow's
combat_style_table rows, as RuneLite's AttackStyle names; the staff casts as index 4 while autocasting).
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
IFDIR = os.path.join(REPO, 'content/scripts/skill_combat/interfaces/2007')
DBROW = os.path.join(REPO, 'content/scripts/skill_combat/configs/combat.dbrow')
TABLE = os.path.join(REPO, 'engine/src/network/game/server/codec/Com2007Table.ts')
OUT = os.path.join(REPO, 'app/src/plugins/runelite/combatinterface.js')

# the tab ~combat07_tab shows for each weapon category (player/combat07.rs2) -> that category's style table
TAB_TABLE = {
    'axe': 'weapon_axe_table', 'blunt': 'weapon_blunt_table', 'bow': 'weapon_bow_table', 'claw': 'weapon_claws_table',
    'crossbow': 'weapon_crossbow_table', 'hacksword': 'weapon_slash_table', 'heavysword': 'weapon_2h_sword_table',
    'pickaxe': 'weapon_pickaxe_table', 'scythe': 'weapon_scythe_table', 'spear': 'weapon_spear_table',
    'spiked': 'weapon_spiked_table', 'stabsword': 'weapon_stab_table', 'staff': 'weapon_staff_table',
    'thrown': 'weapon_thrown_table', 'unarmed': 'weapon_unarmed_table', 'whip': 'weapon_whip_table',
    # polearm (84): no 2007 weapon category opens it on our server
}
# combat_damagestyles.constant -> RuneLite's AttackStyle
STYLE = {
    'melee_accurate': 'ACCURATE', 'melee_aggressive': 'AGGRESSIVE', 'melee_defensive': 'DEFENSIVE',
    'melee_controlled': 'CONTROLLED', 'ranged_accurate': 'RANGING', 'ranged_rapid': 'RANGING',
    'ranged_longrange': 'LONGRANGE', 'magic_normal': 'CASTING', 'magic_defensive': 'DEFENSIVE_CASTING',
}


def parse_if(path):
    comps, cur = {}, None
    order = []
    for line in open(path):
        line = line.rstrip('\n')
        m = re.match(r'^\[(.+)\]$', line)
        if m:
            cur = m.group(1)
            comps[cur] = {}
            order.append(cur)
        elif cur and '=' in line:
            k, v = line.split('=', 1)
            comps[cur][k] = v
    return comps, order


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
    """the button and what's drawn on it (its icon, its label), not the layers it sits in or the special bar"""
    up = ancestors(comps, button)
    out = [button]
    for n, c in comps.items():
        if n == button or n in up or 'width' not in c or 'specbar' in n:
            continue
        if any(a not in up and a != n and 'specbar' in a for a in ancestors(comps, n)):
            continue
        if c.get('layer') and c['layer'] not in up and c['layer'] != button:
            continue  # inside a layer of its own (hidden with that layer)
        if inside(comps, n, button):
            out.append(n)
    return out


def main():
    table = dict((k, (int(g), int(c))) for k, g, c in re.findall(r'"(combat07_[a-z]+:[a-z0-9_]+)": \[(\d+), (\d+)\]', open(TABLE).read()))
    styles, cur = {}, None
    for line in open(DBROW):
        m = re.match(r'^\[(\w+)\]', line)
        if m:
            cur = m.group(1)
            styles[cur] = []
        m = re.match(r'^data=damagestyle,\^style_(\w+)', line)
        if m and cur:
            styles[cur].append(STYLE[m.group(1)])
    tabs = {}
    for f in sorted(os.listdir(IFDIR)):
        name = f[len('combat07_'):-3]
        comps, _ = parse_if(os.path.join(IFDIR, f))
        cid = lambda n: table['combat07_%s:%s' % (name, n)][1]
        ids = lambda ns: sorted(cid(n) for n in ns if 'combat07_%s:%s' % (name, n) in table)  # (auto_spell: ours, not 2007's)
        group = table['combat07_%s:name' % name][0]
        level = next(n for n, c in comps.items() if c.get('text', '').startswith('Combat Lvl:'))
        buttons = {}
        for n, c in comps.items():
            if c.get('script1op1') == 'pushvar,com_mode':
                buttons[int(c['script1'].split(',')[1])] = n
        tab = {
            'name': name, 'level': cid(level),
            'retaliate': ids(members(comps, 'autoretaliate')),
            'buttons': [ids(members(comps, buttons[i])) for i in sorted(buttons)],
            'styles': styles.get(TAB_TABLE.get(name), []),
        }
        if 'auto_choose' in comps:
            tab['buttons'].append(ids(members(comps, 'auto_choose')))
            tab['styles'] = tab['styles'] + [None, 'CASTING']  # RuneLite's staff: index 4 casts
        tabs[group] = tab
    js = '''// Generated by app/tools/runelite/combattabs.py: the 2007 combat tabs as RuneLite's InterfaceID.CombatInterface
// (rl.CombatInterface). 2007 has a tab (group) per weapon type instead of OSRS's one interface 593: open() is the open
// tab's group (-1 if none), LEVEL / RETALIATE / _0 .. _3 / AUTOCAST_BUTTONS resolve in it, getStyles(group) is the
// server's style list for it (combat.dbrow, as RuneLite's AttackStyle names). ScriptPostFired COMBAT_INTERFACE_SETUP is
// posted when a tab opens or a combat skill's level changes, PVP_WIDGET_BUILDER when the Wilderness level text is rebuilt.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const TABS = %s;
  const ifOpen = (g) => !!(ll.api && ll.api.ifOpen && ll.api.ifOpen(g));
  const CombatInterface = {
    TABS,
    open() { for (const g of Object.keys(TABS)) if (ifOpen(+g)) return +g; return -1; },
    getStyles(group) { const t = TABS[group]; return t ? t.styles : null; },
    /** the components (packed ids) of a CombatInterface key in the open tab (or the given one) */
    components(key, group) {
      const g = group === undefined ? this.open() : group; const t = TABS[g];
      if (!t) return [];
      const ids = key === 'LEVEL' ? [t.level] : key === 'RETALIATE' ? t.retaliate
        : key === 'AUTOCAST_BUTTONS' ? (t.styles.length > 4 ? t.buttons[t.buttons.length - 1] : [])
        : /^_[0-3]$/.test(key) ? (t.buttons[+key[1]] && !(t.styles.length > 4 && +key[1] >= t.buttons.length - 1) ? t.buttons[+key[1]] : []) : [];
      return ids.map((c) => (g << 16) | c);
    },
  };
  rl.CombatInterface = CombatInterface;
  rl.ScriptID.COMBAT_INTERFACE_SETUP = 7593;
  rl.ScriptID.PVP_WIDGET_BUILDER = 388;
  const post = (id) => rl.eventBus.post('ScriptPostFired', { getScriptId: () => id });
  // COMBAT_INTERFACE_SETUP: a tab opened (on the next client tick, once it is attached) or the combat level changed
  let pending = false; let lastLevel = -1; let lastTab = -1;
  const S = rl.Skill; const COMBAT_SKILLS = [S.ATTACK, S.STRENGTH, S.DEFENCE, S.HITPOINTS, S.MAGIC, S.RANGED, S.PRAYER];
  rl.eventBus.register({
    onWidgetLoaded(e) { if (TABS[e.getGroupId()]) pending = true; },
    // (OSRS's stat transmit re-runs the tab's setup: a combat skill's level changed)
    onStatChanged(e) { if (COMBAT_SKILLS.includes(e.getSkill())) pending = true; },
    onClientTick() {
      const tab = CombatInterface.open(); if (tab !== lastTab) { lastTab = tab; pending = true; }
      const p = rl.client.getLocalPlayer(); const lvl = p ? p.getCombatLevel() : -1;
      if (lvl !== lastLevel) { if (lastLevel !== -1 && lvl > 0) pending = true; lastLevel = lvl; }
      if (pending && CombatInterface.open() !== -1) { pending = false; post(rl.ScriptID.COMBAT_INTERFACE_SETUP); }
    },
  });
  // PVP_WIDGET_BUILDER: the 2007 Wilderness overlay's level text (381:1) is the server's "Level: N" (or the client's own
  // "Level: %%1", worked out each frame from the player's position); when it is set again (or the level changes, for
  // the client's own text, which is put back first) the event is posted, as OSRS's script rebuilds pvp_icons' text
  const WILD = (381 << 16) | 1; const WILD_LAYER = (381 << 16) | 2; let wildText = null; let wildLevel = -1; let last = null;
  const wildernessLevel = () => { const p = rl.client.getLocalPlayer(); const w = p && p.getWorldLocation(); return w ? Math.trunc((w.getY() - 3520) / 8) + 1 : 0; };
  // (the client's script rewrites the text each cycle: checked after the 3D view is drawn, before the overlay is)
  rl.viewDrawnHooks.push(() => {
    {
      if (!ifOpen(381)) { wildLevel = -1; last = null; return; }
      const w = rl.client.getWidget(WILD); if (!w) return;
      const info = ll.api.com(WILD) || {};
      if (wildText === null && /%%1/.test(info.text2 || info.text || '')) wildText = info.text2 || info.text;
      const lvl = wildernessLevel();
      const rebuilt = wildText !== null && lvl !== wildLevel;
      wildLevel = lvl;
      if (!rebuilt && w.getText() === last) return;
      if (rebuilt) w.setText(wildText);
      post(rl.ScriptID.PVP_WIDGET_BUILDER);
      last = w.getText();
      // (OSRS's pvp_icons has room under the level; the 2007 overlay's layer (381:2, 41 high) grows a line per <br>)
      const layer = rl.client.getWidget(WILD_LAYER);
      const h = 41 + 12 * (last.split('<br>').length - 1);
      if (layer && layer.getHeight() !== h) layer.setOriginalHeight(h).revalidate();
    }
  });
})();
''' % json.dumps(tabs, separators=(',', ':'))
    open(OUT, 'w').write(js)
    print('wrote', OUT, len(tabs), 'tabs')
    for g, t in sorted(tabs.items()):
        print(g, t['name'], t['level'], t['retaliate'], t['buttons'], t['styles'])


if __name__ == '__main__':
    main()
