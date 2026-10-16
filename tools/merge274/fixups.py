#!/usr/bin/env python3
# Hand fixes applied after the automatic 274 -> 377 merge (run inside content/).
import os, re, sys

S = sys.argv[1]
T = S + '/mt/t274/scripts'

def edit(path, old, new, count=1):
    p = os.path.join('scripts', path)
    s = open(p, encoding='utf-8', errors='surrogateescape').read()
    if old not in s:
        print('FIXUP MISSING:', path, old[:60])
        return
    s = s.replace(old, new, count)
    open(p, 'w', encoding='utf-8', errors='surrogateescape').write(s)

# 1. engine.rs2 is 377's (it must match our engine); add the commands 274 scripts use that our
#    engine already implements but 377's command list didn't declare.
decl = []
t274 = open(T + '/engine.rs2', encoding='utf-8').read().split('\n')
want = ('midi_length', 'p_temprun', 'npc_destination', '.npc_destination', '.loc_anim',
        'inv_totalparam', '.inv_totalparam', 'inv_totalparam_stack', '.inv_totalparam_stack')
for l in t274:
    m = re.match(r'^\[command,([^\]]+)\]', l)
    if m and m.group(1) in want:
        decl.append(l)
eng = open('scripts/engine.rs2', encoding='utf-8').read()
eng = eng.rstrip('\n') + '\n\n// EASCape: commands used by scripts merged from Lost City\'s 274 game\n' + '\n'.join(decl) + '\n'
open('scripts/engine.rs2', 'w', encoding='utf-8').write(eng)

# 2. 377's quest scroll lists rewards; the quests merged from 274 don't pass them yet.
rewards = {
    'quests/quest_viking/scripts/quest_viking.rs2': ('"You have completed the\\\\nTrials of the Fremmenik Quest!");',
        '"You have completed the\\\\nFremennik Trials!", "2,812 Attack, Strength, Defence XP|2,812 Hitpoints, Agility, Thieving XP|2,812 Woodcutting, Fletching XP|2,812 Fishing, Crafting XP|Fremennik helmets");'),
    'quests/quest_regicide/scripts/quest_regicide.rs2': ('"You have completed the\\\\nRegicide Quest!");',
        '"You have completed the\\\\nRegicide Quest!", "13,750 Agility XP|15,000 coins|Access to Tirannwn");'),
    'quests/quest_horror/scripts/quest_horror.rs2': ('"You have survived the\\\\nHorror From The Deep!");',
        '"You have survived the\\\\nHorror From The Deep!", "4,662 Strength XP|4,662 Ranged XP|4,662 Magic XP|A rusty casket");'),
    'quests/quest_eadgar/scripts/quest_eadgar.rs2': ('"You have completed\\\\nEadgars Ruse!");',
        '"You have completed\\\\nEadgar\'s Ruse!", "11,000 Herblore XP|Trollheim Teleport spell");'),
    'quests/quest_mortton/scripts/quest_mortton.rs2': ('"\'Shades of Mort\'ton\' Quest Complete!");',
        '"\'Shades of Mort\'ton\' Quest Complete!", "2,000 Crafting XP|2,000 Herblore XP|Access to Flamtaer temple");'),
    'quests/quest_tbwt/scripts/quest_tbwt.rs2': ('"You have completed the\\\\n\'Tai Bwo Wannai Trio\' Quest!");',
        '"You have completed the\\\\n\'Tai Bwo Wannai Trio\' Quest!", "");'),
}
for path, (old, new) in rewards.items():
    edit(path, old, new)

# 3. 274 changed this proc to return a boolean; 377's overlay still stores it as an int.
edit('minigames/game_trawler/scripts/trawler_overlay.rs2',
     'def_int $net_ripped = ~trawler_net_ripped;',
     'def_int $net_ripped = 0;\nif (~trawler_net_ripped = true) $net_ripped = 1;')

# 4. 377's troll thrower calls the ranged hit proc without the protect-prayer flag 274 added.
edit('areas/area_burthorpe/scripts/death_troll_thrower.rs2',
     '~playerhit_n_ranged(randominc($maxhit)', '~playerhit_n_ranged(true, randominc($maxhit)')
edit('areas/area_burthorpe/scripts/death_troll_thrower.rs2',
     '~playerhit_n_ranged(0, $duration', '~playerhit_n_ranged(true, 0, $duration')

# 5. Peer the Seer's deposit service (274) uses 274's quiet bank deposit; 377's bank has none.
edit('quests/quest_viking/scripts/viking_peer.rs2', '~bank_deposit_request(', '~bank_deposit_try(', -1)
os.makedirs('scripts/_merge274/scripts', exist_ok=True)
open('scripts/_merge274/scripts/eascape_bank.rs2', 'w').write('''// EASCape: 274's "deposit and tell me if it worked" bank proc, for scripts merged from 274.
[proc,bank_deposit_try](inv $inv, obj $obj, int $amount, int $slot, int $mes)(boolean)
def_int $overflow = inv_itemspace2(bank, oc_uncert($obj), $amount, ^max_32bit_int);
if (sub(^max_32bit_int, $amount) < inv_total(bank, $obj)) {
    if ($mes = ^true) mes("You already have a full stack of that item in the bank.");
    return(false);
}
if ($overflow >= $amount) {
    if ($mes = ^true) mes("You don't have enough space in your bank account.");
    return(false);
}
def_int $deposit = sub($amount, $overflow);
if ($deposit > 0) {
    session_log(^log_moderator, "Deposited <oc_debugname($obj)> x<tostring($deposit)> into bank");
    inv_moveitem_uncert($inv, bank, $obj, $deposit);
}
return(true);
''')
print('fixups done')
