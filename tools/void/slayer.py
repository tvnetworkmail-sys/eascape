#!/usr/bin/env python3
"""Slayer importer: gives our Slayer monsters what Void (GregHib/void) has for them.
NPC, item and (most) animation/graphic ids are the same in 377 and Void; sounds are matched by
name, never by number. Void stores hitpoints and hits x10, so they are divided by 10.

For every attackable NPC whose Void categories are a Slayer category:
- param slayer_category, if it has none (so kills count for the task)
- if it has no hitpoints: hitpoints/attack/strength/defence/magic/ranged, attack speed and
  bonus, damage type, max hit (param eascape_maxhit), respawn time, attack/defend/death
  animations and sounds; a ranged or magic attacker also gets its projectile and the
  generated attack triggers
- if it dies through the default death script: its Void drop table (param eascape_drops)

Writes into the NPC config files in place and generates
  content/scripts/eascape_void/configs/void_drops.dbrow
  content/scripts/eascape_void/scripts/void_npc_attacks.rs2
Usage: slayer.py <void checkout> [--write]"""
import os, re, sys, collections
from common import *
from slayer_map import CATEGORY

VOID, WRITE = sys.argv[1], '--write' in sys.argv
# EASCape: monsters to import that aren't Slayer monsters (quest areas), from VOID_EXTRA (comma list)
# plus the ones already imported that way (kept so re-runs give the same result)
EXTRA = {'fourdiamonds_sword_bandit_1', 'fourdiamonds_sword_bandit_free', 'ft2_gorak'} | set(x for x in os.environ.get('VOID_EXTRA', '').split(',') if x)
# EASCape: Void items that are ours under another name (the 2007 cache's, ported by name)
ITEM_AS = {'gorak_claws': 'ft2_gorak_claws'}
EXTRA_AS = {'fourdiamonds_sword_bandit_free': 'bandit_bandit_camp', 'ft2_gorak': 'gorak'}
OUT = os.path.join(CONTENT, 'scripts', 'eascape_void')

vnpc = void_npcs(VOID)
ids = pack('npc')
objs = {v: k for k, v in pack('obj').items()}
seqs = {v: k for k, v in pack('seq').items()}
synths = set(pack('synth'))
spots = {v: k for k, v in pack('spotanim').items()}
blocks = our_blocks('.npc')

# dummy (inventory-only) objects can't be dropped
dummy = set()
for name, b in our_blocks('.obj').items():
    if has_field(b, 'dummyitem'):
        dummy.add(name)

def id_map(pattern):
    out = {}
    for name, d in void_section_map(VOID, pattern).items():
        if 'id' in d and re.fullmatch(r'\d+', d['id'].strip()):
            out[name] = int(d['id'])
    return out
v_items = id_map('*.items.toml')
v_anims = id_map('*.anims.toml')
v_gfx = id_map('*.gfx.toml')

# Void combat definitions: base -> {'top': {...}, 'attacks': [(name, {...})]}
combat = collections.OrderedDict()
for f in void_files(VOID, '*.combat.toml'):
    for name, d in toml_sections(f):
        base, _, att = name.partition('.')
        c = combat.setdefault(base, {'top': {}, 'attacks': []})
        if att:
            c['attacks'].append((att, d))
        else:
            c['top'].update(d)
def combat_def(name, depth=0):
    c = combat.get(name)
    if not c:
        return {'top': {}, 'attacks': []}
    top, attacks = dict(c['top']), list(c['attacks'])
    if 'clone' in top and depth < 5:
        base = combat_def(unq(top['clone']), depth + 1)
        for k, v in base['top'].items():
            top.setdefault(k, v)
        if not attacks:
            attacks = base['attacks']
    return {'top': top, 'attacks': attacks}

# triggers that already exist (by npc or _category)
trig = collections.defaultdict(set)
for dp, _, fs in os.walk(os.path.join(CONTENT, 'scripts')):
    if os.path.abspath(dp).startswith(os.path.abspath(OUT)):
        continue
    for f in fs:
        if f.endswith('.rs2'):
            for t, n in re.findall(r'^\[(ai_queue\d|ai_opplayer2|ai_applayer2),([^\]]+)\]', open(os.path.join(dp, f), errors='replace').read(), re.M):
                trig[t].add(n)
def has_trig(kind, name, b):
    cat = dict(b['fields']).get('category')
    return name in trig[kind] or (cat is not None and '_' + cat in trig[kind])

def tokens(s):
    out = [t for t in re.split(r'[_\d\s]+', s) if len(t) >= 3]
    syn = {'magic': 'mage', 'mage': 'magic', 'ranged': 'range', 'range': 'ranged', 'stab': 'melee',
           'slash': 'melee', 'crush': 'melee'}
    return out + [syn[t] for t in out if t in syn]

ROLE = {'attack': ('attack', 'bite', 'swipe', 'punch', 'kick', 'claw', 'strike', 'bow', 'shoot', 'throw',
                   'cast', 'casting', 'spit', 'rangeattack', 'magicattack', 'breath'),
        'defend': ('defend', 'block', 'def', 'hit', 'hurt', 'flinch', 'parry'),
        'death': ('death', 'die', 'dies', 'dead')}
GENERIC = {'walk', 'ready', 'idle', 'attack', 'death', 'defend', 'block', 'hit', 'anim', 'stand', 'run'}
def seq_for(role, vname, walk, hint=''):
    """Our animation for a role (attack/defend/death), by name: the npc's own walk animation
    names its set (wyvern_skeleton_walk -> wyvern_skeleton_bite, _block, _death). Within the set
    the one sharing most words with Void's name (and the attack style) wins. Falls back to Void's
    id when our name for it looks related."""
    vname = vname or ''
    base = re.sub(r'_?(walk|ready).*$', '', walk or '')
    prefixes = []
    if base:
        prefixes.append(base)
        parts = base.split('_')
        for k in range(len(parts) - 1, 1, -1):
            prefixes.append('_'.join(parts[:k]))
        if len(parts) > 1:
            prefixes += ['_'.join(parts[1:]), '_'.join(parts[:1])]
    # humans share one set of animations; a weapon's own comes from Void's id below
    prefixes = [x for x in prefixes if x not in ('human', 'slayer', 'misc', 'npc')]
    for prefix in prefixes:
        cands = [n for n in seqs.values() if n != walk and (n.startswith(prefix + '_') or prefix == base and n.startswith(prefix))]
        want = set(tokens(vname) + tokens(hint)) - GENERIC - set(tokens(prefix))
        best, score = None, -1
        for n in cands:
            rest = n[len(prefix):]
            rt = set(tokens(rest)) - set(tokens(prefix))
            if role == 'attack' and want & {'range', 'ranged', 'magic', 'mage'}:
                rt |= {'range', 'magic'} if rt & {'bow', 'shoot', 'throw', 'cast', 'casting', 'spit', 'breath'} else set()
                rt |= {w for w in want if any(w in t for t in rt)}
            if not rt & set(ROLE[role]):
                continue
            if role == 'attack' and rt & {'death', 'dead', 'block', 'defend'}:
                continue
            if role == 'defend' and rt & {'attack', 'death'}:
                continue
            sc = len(rt & want) * 2 + (1 if ROLE[role][0] in rt else 0) - len(rt) * 0.1
            if sc > score:
                best, score = n, sc
        if best:
            return best
    i = v_anims.get(vname)
    if i is not None and i in seqs:
        ours = seqs[i]
        if any(t in ours for t in set(tokens(vname)) - GENERIC - {'human'}):
            return ours
    return None

def spot_for(vname):
    i = v_gfx.get(vname)
    if i is not None and i in spots:
        ours = spots[i]
        if any(t in ours for t in tokens(vname)):
            return ours
    # the standard spells moved to new ids in Void; 2006 had no surges, so a surge is a wave
    m = re.match(r'(wind|water|earth|fire)_(strike|bolt|blast|wave|surge)(_impact)?$', vname)
    if m:
        cand = '%s%s_%s' % (m.group(1), 'wave' if m.group(2) == 'surge' else m.group(2), 'impact' if m.group(3) else 'travel')
        if cand in spots.values():
            return cand
    return None

ALIAS = {'aberrant_spectre': 'spectre', 'abyssal_demon': 'abyssal', 'baby_dragon': 'babydragon'}
def synth_for(vname):
    if not vname:
        return None
    n = unq(vname)
    for a, b in ALIAS.items():
        if n.startswith(a + '_'):
            n2 = b + n[len(a):]
            if n2 in synths:
                return n2
    cands = [n]
    for suf, alts in (('_defend', ('_hit', '_block')), ('_attack', ('_attack1', '_bite')), ('_death', ('_die', '_dies'))):
        if n.endswith(suf):
            b = n[:-len(suf)]
            cands += [b + a for a in alts]
    for c in list(cands):
        cands += [c.replace('_', ''), re.sub(r'^([a-z]+)_', r'\1', c)]
    for c in cands:
        if c in synths:
            return c
    return None

STYLE = {'stab': '^stab_style', 'slash': '^slash_style', 'crush': '^crush_style', 'range': '^ranged_style',
         'magic': '^magic_style', 'melee': '^crush_style', 'dragonfire': '^magic_style'}

def target_hit(d):
    m = re.search(r'offense\s*=\s*"(\w+)"', d.get('target_hit', ''))
    x = re.search(r'max\s*=\s*(\d+)', d.get('target_hit', ''))
    return (m.group(1) if m else None), (int(x.group(1)) if x else None)

# ---------------------------------------------------------------- drop tables
tables = void_section_map(VOID, '*.drops.toml')
def parse_entries(raw):
    out = []
    for m in re.finditer(r'\{([^{}]*)\}', raw or ''):
        e = {}
        for k, v in re.findall(r'(\w+)\s*=\s*("[^"]*"|[\w.-]+)', m.group(1)):
            e[k] = unq(v)
        out.append(e)
    return out
used_tables = collections.OrderedDict()
skipped_items = collections.Counter()
def table_row(tname):
    return 'void_drop_' + re.sub(r'[^a-z0-9_]', '_', tname.lower())
def build_table(tname, depth=0):
    if tname in used_tables or depth > 8:
        return tname in used_tables
    t = tables.get(tname)
    if t is None:
        return False
    used_tables[tname] = None  # reserve (handles cycles)
    rows = []
    for e in parse_entries(t.get('drops')):
        if any(k in e for k in ('owns', 'lacks', 'variable', 'skill')) or e.get('members') == 'false':
            continue  # needs something we don't track (quest/item state) or free-to-play only
        chance = int(e['chance']) if 'chance' in e else None
        if 'table' in e:
            sub = e['table']
            if not build_table(sub, depth + 1):
                continue
            subt = tables[sub]
            c = chance if chance is not None else int(subt.get('chance', '1'))
            roll = int(e['roll']) if 'roll' in e else int(subt.get('roll', '1'))
            rows.append(('null', 0, 0, c, table_row(sub), roll))
            continue
        iid = e.get('id', 'nothing')
        c = chance if chance is not None else 1
        if 'amount' in e or 'charges' in e:
            lo = hi = int(e.get('amount', e.get('charges')))
        else:
            lo, hi = int(e.get('min', 1)), int(e.get('max', e.get('min', 1)))
        ours = ITEM_AS.get(iid) or objs.get(v_items.get(iid, -1))
        if iid == 'nothing' or ours is None or ours in dummy or lo <= 0:
            if iid != 'nothing':
                skipped_items[iid] += 1  # not in the 2006 game: the slot stays, it just drops nothing
            rows.append(('null', 0, 0, c, 'null', 0))
        else:
            rows.append((ours, lo, hi, c, 'null', 0))
    kind = 0 if unq(t.get('type', '"first"')) == 'all' else 1
    used_tables[tname] = (kind, int(t.get('roll', '1')), rows)
    return True

# Slayer categories that are one kind of monster: the npc's name has to say so (Void files a
# few quest npcs under them, e.g. a zombie under wall beasts)
SPECIFIC = {'wallbeast': 'wall beast', 'mogre': 'mogre', 'rockslug': 'rockslug', 'turoth': 'turoth',
            'kurask': 'kurask', 'dustdevil': 'dust devil', 'feverspider': 'fever spider', 'killerwatt': 'killerwatt',
            'harpiebugswarm': 'harpie', 'skeletalwyvern': 'wyvern', 'mutatedzygomite': 'zygomite',
            'infernalmage': 'infernal', 'otherworldlybeing': 'otherworldly', 'caveslime': 'slime',
            'cavebug': 'cave bug', 'cavecrawler': 'cave crawler', 'crawlinghand': 'hand', 'banshee': 'banshee',
            'aberrantspecter': 'spectre', 'abyssaldemon': 'abyssal', 'basilisk': 'basilisk', 'cockatrice': 'cockatrice',
            'gargoyle': 'gargoyle', 'pyrefiend': 'pyrefiend', 'bloodveld': 'bloodveld', 'nechryael': 'nechryael',
            'jelly': 'jelly', 'darkbeast': 'dark beast', 'icefiend': 'icefiend', 'seasnake': 'snake',
            'shade': 'sha', 'earthwarrior': 'earth warrior', 'icewarrior': 'warrior'}
NAMED = {'mogre': 'mogre'}
# where the 377 id holds a different monster than Void's (checked by examine text)
# A tuple takes the first npc's stats and combat and fills in the rest (category, drops) from
# the next: in Void a picked fungus *transforms* into a zygomite and keeps the fungus's
# category and drops, where ours changes type.
OVERRIDE = {'mudskipper_ogre': 'mogre',
            'slayer_mutated_zygomite_adolescent': ('zygomite', 'fungi'),
            'slayer_mutated_zygomite_adult': ('zygomite_large', 'fungi_large'),
            'swamp_wallbeast_combat': ('hole_in_the_wall', 'wall_beast'),
            'slayer_killerwatt': ('killerwatt_attacking', 'killerwatt')}
def pick_category(sc, name):
    n = name.lower()
    if n in NAMED:
        return NAMED[n]
    for c in sc:
        if c in SPECIFIC and SPECIFIC[c] in n:
            return c
    rest = [c for c in sc if c not in SPECIFIC]
    return rest[0] if rest else None

# what other npcs with the same walk animation (the same creature) already use
SIB_KEYS = ('attack_anim', 'defend_anim', 'death_anim', 'attack_sound', 'defend_sound', 'death_sound')
sibling = collections.defaultdict(dict)
for _n, _b in blocks.items():
    _w = dict(_b['fields']).get('walkanim', '').split(',')[0]
    if not _w:
        continue
    for _k, _v in _b['fields']:
        if _k == 'param' and _v.split(',', 1)[0] in SIB_KEYS:
            sibling[_w].setdefault(_v.split(',', 1)[0], _v.split(',', 1)[1])
missing = collections.Counter(); missing_names = set()

def norm(x):
    return re.sub(r'[^a-z]', '', (x or '').lower())
by_examine = collections.defaultdict(list)
for _d in vnpc.values():
    by_examine[norm(unq(_d.get('examine', '""')))].append(_d)
def same_monster(v, f):
    """Void's npc with our id, if it's the same monster (its examine text, or its name, agrees);
    otherwise the Void npc with our examine text and name, if there's one. Some 377 ids hold
    different monsters in Void's later cache (e.g. 2801 is a Mogre in 2006, an ogre in Void)."""
    desc, nm = norm(f.get('desc')), norm(f.get('name'))
    def agrees(d):
        ex = norm(unq(d.get('examine', '""')))
        return (ex and desc and ex[:12] == desc[:12]) or (nm and nm in norm(d['_name']))
    if v and agrees(v):
        return v
    for d in by_examine.get(desc, []):
        if nm and nm in norm(d['_name']) and 'hitpoints' in d:
            return d
    return None

_texts = {}
def block_text(path, name):
    if path not in _texts:
        _texts[path] = open(path, encoding='utf-8', errors='replace').read()
    m = re.search(r'^\[' + re.escape(name) + r'\]\n(.*?)(?=^\[|\Z)', _texts[path], re.S | re.M)
    return m.group(1) if m else ''

# ---------------------------------------------------------------- npcs
changes = collections.OrderedDict()   # npc -> (file, [lines])
attackers = []                        # (npc, 'ranged'|'magic')
report = collections.Counter()
cat_names = collections.defaultdict(set)
for name, b in blocks.items():
    if name not in ids or not any(k.startswith('op') and v == 'Attack' for k, v in b['fields']):
        continue
    if name.startswith('macro_'):
        continue  # random event monsters have their own scripts
    f0 = dict(b['fields'])
    if name in EXTRA_AS:
        v = next(d for d in vnpc.values() if d['_name'] == EXTRA_AS[name])
    elif name in OVERRIDE:
        o = OVERRIDE[name]
        names = o if isinstance(o, tuple) else (o,)
        v = {}
        for vn_ in reversed(names):  # the first name wins; the others fill in what it lacks
            v.update(next(d for d in vnpc.values() if d['_name'] == vn_))
    else:
        v = same_monster(vnpc.get(ids[name]), f0)
    if not v:
        continue
    cats = [unq(x) for x in re.findall(r'"[^"]+"', v.get('categories', ''))]
    sc = [CATEGORY[c] for c in cats if c in CATEGORY]
    if not sc and name not in EXTRA:
        continue
    f = collections.OrderedDict()
    for k, val in b['fields']:
        f.setdefault(k, val)
    sc = pick_category(sc, f.get('name') or '') if sc else None
    if not sc and name not in EXTRA:
        continue
    params = {val.split(',', 1)[0] for k, val in b['fields'] if k == 'param'}
    lines = []
    if sc:
        cat_names[sc].add(f.get('name'))
    if sc and 'slayer_category' not in params:
        lines.append('param=slayer_category,^slayer_' + sc)
        report['category'] += 1
    vname = v['_name']
    # imported before (re-runs regenerate the triggers and tables, and add nothing twice)
    imported = ('combat from Void (%s)' % vname) in block_text(b['file'], name)
    if ('hitpoints' not in f or imported) and 'hitpoints' in v:
        if not imported:
            report['stats'] += 1
            hp = max(1, int(v['hitpoints']) // 10)
            lines.append('// EASCape: combat from Void (%s); hitpoints and hits are Void\'s divided by 10' % vname)
            lines.append('hitpoints=%d' % hp)
            for ours, theirs in (('attack', 'att'), ('strength', 'str'), ('defence', 'def'), ('magic', 'mage'), ('ranged', 'range')):
                if ours not in f:
                    lines.append('%s=%d' % (ours, int(v.get(theirs, '1'))))
            if 'respawnrate' not in f and 'respawn_delay' in v:
                lines.append('respawnrate=%d' % int(v['respawn_delay']))
        cd = combat_def(unq(v.get('combat_def', '"%s"' % vname)))
        top, attacks = cd['top'], cd['attacks']
        plain = [a for a in attacks if 'condition' not in a[1]] or attacks
        melee = [a for a in plain if (target_hit(a[1])[0] or 'melee') in ('stab', 'slash', 'crush', 'melee')]
        proj = [a for a in plain if target_hit(a[1])[0] in ('range', 'magic')]
        att = melee[0] if melee else (proj[0] if proj else None)
        walk = f.get('walkanim', '').split(',')[0]
        def P(key, val):
            if val is None and key in SIB_KEYS and not walk.startswith('human'):
                val = sibling[walk].get(key)
                if val is None:
                    missing[key] += 1; missing_names.add((name, walk, key))
            if val is not None and key not in params:
                lines.append('param=%s,%s' % (key, val))
        if 'attack_speed' in v:
            P('attackrate', int(v['attack_speed']))
        if 'attack_bonus' in v:
            P('attackbonus', int(v['attack_bonus']))
        style = unq(v.get('style', '""'))
        off, mx = target_hit(att[1]) if att else (None, None)
        if mx is None:
            for key in ('max_hit_' + (style or 'melee'), 'max_hit_melee', 'max_hit_crush', 'max_hit_stab', 'max_hit_slash', 'max_hit_range', 'max_hit_magic'):
                if key in v:
                    mx = int(v[key])
                    break
        dt = STYLE.get(off if off and off != 'melee' else (style or 'crush'))
        if dt:
            P('damagetype', dt)
        if mx is not None:
            P('eascape_maxhit', max(0, (mx + 5) // 10))
        if att:
            P('attack_anim', seq_for('attack', unq(att[1].get('anim', '""')), walk, (off or '') + ' ' + att[0]))
            P('attack_sound', synth_for(att[1].get('target_sound') or att[1].get('sound')))
        else:
            P('attack_anim', seq_for('attack', '', walk, style))
            P('attack_sound', None)
        P('defend_anim', seq_for('defend', unq(top.get('defend_anim', '""')), walk))
        P('death_anim', seq_for('death', unq(top.get('death_anim', '""')), walk))
        P('defend_sound', synth_for(top.get('defend_sound')))
        P('death_sound', synth_for(top.get('death_sound')))
        # Void poison 30 = 3 damage a hit; ours starts at (severity + 4) / 5
        pois = [int(a[1]['impact_poison']) for a in attacks if re.fullmatch(r'\d+', a[1].get('impact_poison', '').strip())]
        if pois:
            P('poison_severity', max(pois) // 2)
        if att and not melee:
            kind = 'magic' if off == 'magic' else 'ranged'
            p = spot_for(unq(att[1].get('projectile', '""')))
            P('proj_travel', p)
            P('eascape_impact_gfx', spot_for(unq(att[1].get('impact_gfx', '""'))))
            P('rangeattack_sound', synth_for(att[1].get('target_sound') or att[1].get('sound')))
            r = int(att[1].get('range', '7'))
            if 'attackrange' not in f:
                lines.append('attackrange=%d' % r)
            if not (has_trig('ai_applayer2', name, b) or has_trig('ai_opplayer2', name, b)):
                attackers.append((name, kind))
    # drops: only for npcs that die through the default death script
    if not has_trig('ai_queue3', name, b):
        dt_name = unq(v.get('drop_table', '"%s"' % vname)) + '_drop_table'
        if build_table(dt_name) and 'eascape_drops' not in params:
            lines.append('param=eascape_drops,' + table_row(dt_name))
            report['drops'] += 1
    if lines:
        changes[name] = (b['file'], lines)

print(report, missing, 'ranged/magic attackers:', len(attackers), 'tables:', len(used_tables))
for c in sorted(cat_names):
    print(' ', c, sorted(n for n in cat_names[c] if n)[:12])
print(sorted(n for n in missing_names if n[2].endswith('anim')))
print('items not in the 2006 game (dropped as nothing):', ', '.join(sorted(skipped_items)))

if not WRITE:
    print('attackers', attackers)
    show = sys.argv[2:] if len(sys.argv) > 2 else list(changes)[:6]
    for n, (fp, ls) in [(k, changes[k]) for k in show if k in changes]:
        print('\n[%s] %s' % (n, os.path.relpath(fp, CONTENT)))
        print('\n'.join(ls))
    sys.exit()

for n, (fp, ls) in changes.items():
    append_lines(fp, n, ls)

os.makedirs(os.path.join(OUT, 'configs'), exist_ok=True)
os.makedirs(os.path.join(OUT, 'scripts'), exist_ok=True)
with open(os.path.join(OUT, 'configs', 'void_drops.dbrow'), 'w') as o:
    o.write('// Generated by tools/void/slayer.py from Void\'s drops.toml. Do not edit by hand.\n')
    for tname, val in used_tables.items():
        if not val:
            continue
        kind, roll, rows = val
        o.write('\n[%s]\ntable=eascape_drop\ndata=kind,%d\ndata=roll,%d\n' % (table_row(tname), kind, roll))
        for r in rows:
            o.write('data=entry,%s,%d,%d,%d,%s,%d\n' % r)
with open(os.path.join(OUT, 'scripts', 'void_npc_attacks.rs2'), 'w') as o:
    o.write('// Generated by tools/void/slayer.py: NPCs that attack from range in Void.\n')
    for n, kind in attackers:
        o.write('\n[ai_queue1,%s] ~npc_default_retaliate_ap;\n[ai_opplayer2,%s] npc_setmode(applayer2);\n[ai_applayer2,%s] ~eascape_npc_projattack(%s);\n'
                % (n, n, n, '^magic_style' if kind == 'magic' else '^ranged_style'))
print('written', len(changes), 'npcs')
