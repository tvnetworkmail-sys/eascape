#!/usr/bin/env python3
# Hand fixes after merging Lost City 289's quests into EASCape (run on the merge's out/scripts).
import os, re, sys, glob
OUT, EAS = sys.argv[1], sys.argv[2]   # merged scripts dir, our scripts dir before the merge

def rd(p): return open(p, encoding='utf-8', errors='surrogateescape').read()
def wr(p, s): open(p, 'w', encoding='utf-8', errors='surrogateescape').write(s)

# 1. quest completion: our ~send_quest_complete takes the reward text too (the 377 scroll lists
#    rewards); where the merge took 289's shorter call in a quest we already had, keep ours
#    world_delay too: 289's new lengths go with an engine fix (Lost City's #769) we don't have,
#    so our tuned values stay
for p in glob.glob(OUT + '/**/*.rs2', recursive=True):
    rel = os.path.relpath(p, OUT)
    ours = os.path.join(EAS, rel)
    if not os.path.exists(ours):
        continue
    s = rd(p)
    for key in ('~send_quest_complete(', 'world_delay('):
        if key not in s:
            continue
        mine = [l for l in rd(ours).split('\n') if key in l]
        theirs = [l for l in s.split('\n') if key in l]
        if len(mine) == len(theirs) and mine != theirs:
            for a, b in zip(theirs, mine):
                s = s.replace(a, b, 1)
    wr(p, s)

# 2. three of the new quests' reward lines (OSRS wiki, each quest's Rewards; their later
#    unlocks left out). In Search of the Myreque has its own (~send_quest_complete2).
REWARDS = {
    'quests/quest_mm/scripts/quest_mm.rs2': '3 Quest Points|10,000 coins|3 diamonds|Dragon scimitars|Combat training from Daero',
    'quests/quest_misc/scripts/misc_quest.rs2': '1 Quest Point|Management of Miscellania',
    'quests/quest_hauntedmine/scripts/hauntedmine_crystals.rs2': '2 Quest Points|22,000 Strength XP|Salve amulet|Crystal outcrop shortcut',
}
for rel, text in REWARDS.items():
    p = os.path.join(OUT, rel)
    if not os.path.exists(p):
        continue
    s = rd(p)
    def add(m):
        call = m.group(0)
        if call.count('"') >= 4:
            return call
        return call[:-1] + f', "{text}")'
    s = re.sub(r'~send_quest_complete\([^;\n]*\)(?=;)', add, s)
    wr(p, s)

# 3. 289's ~troll_drop_table is our @troll_drop_table label; 289's ~unequip_effect is our
#    ~update_all + ~on_unequip
for p in glob.glob(OUT + '/**/*.rs2', recursive=True):
    s = rd(p)
    s2 = s.replace('~troll_drop_table;', '@troll_drop_table;')
    s2 = re.sub(r'~unequip_effect\((\$\w+), \^true\);', r'~update_all(\1);\n~on_unequip(\1);', s2)
    if s2 != s:
        wr(p, s2)
print('post289 done')

# 4. Miscellania's and Etceteria's market stalls (289 skill_thieving: their stealing dbrows,
#    timers and the stall owners' "stolen" queue), in our stall system's way (a bit each in
#    %thieving_stall_timer, like the 274 merge's Rellekka stalls, which take bits 8 and 9)
STALLS = [('miscfish', 'misc_fish_market', 10), ('miscveg', 'misc_veg_market', 11), ('etcfish', 'etc_fish_market', 12), ('etcveg', 'etc_veg_market', 13)]
T289 = sys.argv[3]
dbrow = rd(T289 + '/skill_thieving/configs/stalls/stealing.dbrow')
rows = []
for short, loc, bit in STALLS:
    m = re.search(r'(?ms)^\[stealing_' + loc + r'\]\n.*?(?=^\[|\Z)', dbrow)
    block = m.group(0).rstrip()
    block = re.sub(r'(?m)^data=replacement,.*\n', '', block)  # ours swaps the stall in code
    # 289 has these in whole XP (42, 10); our table is in tenths like its other stalls (the
    # wiki: 42 and 10 XP)
    block = re.sub(r'(?m)^data=experience,(\d+)$', lambda e: f'data=experience,{int(e.group(1)) * 10}', block)
    rows.append('// from 289: skill_thieving/configs/stalls/stealing.dbrow\n' + block + '\n')
d = OUT + '/skill_thieving/configs/stalls'
wr(d + '/eascape_misc_stalls.dbrow', '\n'.join(rows))
const = rd(T289 + '/skill_thieving/configs/stalls/stealing.constant')
cl = ['// EASCape: Miscellania and Etceteria stalls (timers from 289)']
for short, loc, bit in STALLS:
    cl.append(re.search(r'(?m)^\^' + short + r'_stall_timer\s*=.*$', const).group(0))
    cl.append(f'^{short}_stall_index = {bit}')
# the merge may have added the timers already (from289.constant): don't define them twice
fc = OUT + '/_merge289/configs/from289.constant'
if os.path.exists(fc):
    have = rd(fc)
    cl = [l for l in cl if not (l.startswith('^') and re.search(r'(?m)^\^' + l[1:].split(' ')[0] + r'\s*=', have))]
wr(d + '/eascape_misc_stalls.constant', '\n'.join(cl) + '\n')
sc = ['// EASCape: Miscellania and Etceteria market stalls (289), our stall system']
for short, loc, bit in STALLS:
    sc += [f'[oploc2,{loc}]', '@attempt_steal_from_stall(loc_type, loc_coord, loc_angle, loc_shape);', '',
           f'[queue,stolen_from_stall_{short}]', f'%thieving_stall_timer = clearbit(%thieving_stall_timer, ^{short}_stall_index);', '']
wr(OUT + '/skill_thieving/scripts/stalls/eascape_misc_stalls.rs2', '\n'.join(sc))
p = OUT + '/skill_thieving/scripts/thieving.rs2'
s = rd(p)
add = ''.join(f'    case {loc} :\n        longqueue(stolen_from_stall_{short}, ^{short}_stall_timer, 0, ^discard);\n        %thieving_stall_timer = setbit(%thieving_stall_timer, ^{short}_stall_index);\n' for short, loc, bit in STALLS)
s = s.replace('        %thieving_stall_timer = setbit(%thieving_stall_timer, ^vikingfish_stall_index);\n}', '        %thieving_stall_timer = setbit(%thieving_stall_timer, ^vikingfish_stall_index);\n' + add + '}', 1)
s = s.replace('if(loc_type = viking_fur_market | loc_type = viking_fish_market) loc_change(viking_market, $respawn_ticks);',
              'if(loc_type = viking_fur_market | loc_type = viking_fish_market | loc_type = misc_fish_market | loc_type = misc_veg_market | loc_type = etc_fish_market | loc_type = etc_veg_market) loc_change(viking_market, $respawn_ticks);')
wr(p, s)
p = OUT + '/skill_thieving/scripts/stalls/stealing.rs2'
s = rd(p)
add = ''.join(f'if (testbit(%thieving_stall_timer, ^{short}_stall_index) = ^true) {{\n    longqueue(stolen_from_stall_{short}, ^{short}_stall_timer, 0, ^discard);\n}}\n' for short, loc, bit in STALLS)
s = s.replace('    longqueue(stolen_from_stall_vikingfish, ^vikingfish_stall_timer, 0, ^discard);\n}\n', '    longqueue(stolen_from_stall_vikingfish, ^vikingfish_stall_timer, 0, ^discard);\n}\n' + add, 1)
wr(p, s)

# 5. Managing Miscellania's panel: the merge turned misc_both_manage:com_87 into the clash name
p = OUT + '/minigames/game_managing_miscellania/scripts/managing_miscellania.rs2'
if os.path.exists(p):
    wr(p, rd(p).replace('inter_210_274:com_87', 'inter_210:com_87'))
print('post289 stalls done')

# 6. our ~npc_death needs the secondary npc pointer (Slayer's task check): 289's quests call it
#    as ~npc_death in ai scripts; ours are gosub(npc_death)
for p in glob.glob(OUT + '/quests/**/*.rs2', recursive=True):
    s = rd(p)
    if '~npc_death;' in s:
        wr(p, s.replace('~npc_death;', 'gosub(npc_death);'))

# 7. the Miscellania fishing spots' moves (289 skill_fishing/configs/fishing_movement.enum),
#    which its fishing spot npcs now point at
e = rd(T289 + '/skill_fishing/configs/fishing_movement.enum')
m = re.search(r'(?ms)^\[fishing_movement_miscellania_enum\]\n.*?(?=^\[|\Z)', e)
fe = OUT + '/_merge289/configs/from289.enum'
have = rd(fe) if os.path.exists(fe) else ''
if m and '[fishing_movement_miscellania_enum]' not in have:
    wr(fe, have.rstrip('\n') + '\n\n// from 289: skill_fishing/configs/fishing_movement.enum\n' + m.group(0).rstrip() + '\n')
