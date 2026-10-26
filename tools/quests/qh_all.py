#!/usr/bin/env python3
# Converts Quest Helper guides for every built quest that hasn't got one (qh2server.py does one).
# Checks first that Quest Helper's stage variable is the one our quest sets; where it isn't, the
# quest is listed and left for a guide by hand.
import re, os, sys, glob, json
sys.path.insert(0, os.path.dirname(__file__))
import qh2server as Q
E = Q.E
QHQ = Q.rd(Q.QH + '/questinfo/QuestHelperQuest.java')
QVP = {m.group(1): int(m.group(2)) for m in re.finditer(r'(\w+)\((\d+)\)', Q.rd(Q.QH + '/questinfo/QuestVarPlayer.java'))}
for m in re.finditer(r'(\w+)\(VarPlayerID\.(\w+)\)', Q.rd(Q.QH + '/questinfo/QuestVarPlayer.java')):
    QVP[m.group(1)] = Q.GV['VarPlayerID'].get(m.group(2))
QVB = {m.group(1): m.group(2) for m in re.finditer(r'(\w+)\(VarbitID\.(\w+)\)', Q.rd(Q.QH + '/questinfo/QuestVarbits.java'))}
classdir = {}
for f in glob.glob(Q.QH + '/helpers/quests/*/*.java'):
    classdir[os.path.basename(f)[:-5]] = os.path.basename(os.path.dirname(f))
qinfo = {}
for m in re.finditer(r'^\s*(\w+)\(new (\w+)\(\),[^\n]*?(QuestVarPlayer|QuestVarbits)\.(\w+)', QHQ, re.M):
    qinfo[m.group(2)] = (m.group(3), m.group(4))
# our quests: questlist key -> (stage var, journal title)
prog = {}
for f in glob.glob(E + '/scripts/**/*.rs2', recursive=True):
    for m in re.finditer(r'send_quest_progress(?:_colour)?\(questlist:(\w+), %(\w+)', Q.rd(f)):
        prog.setdefault(m.group(1), m.group(2))
journal = {}
for f in glob.glob(E + '/scripts/quests/**/*.rs2', recursive=True):
    s = Q.rd(f)
    for m in re.finditer(r'\[if_button,questlist:(\w+)\](.*?)(?=\n\[|\Z)', s, re.S):
        j = re.search(r'~quest_journal\("([^"]+)"', m.group(2))
        if j: journal[m.group(1)] = j.group(1)
DIRS = {'fortress': 'blackknightfortress', 'demon': 'demonslayer', 'doric': 'doricsquest', 'haunted': 'ernestthechicken',
    'gobdip': 'goblindiplomacy', 'imp': 'impcatcher', 'hunt': 'piratestreasure', 'prince': 'princealirescue', 'romeojuliet': 'romeoandjuliet',
    'runemysteries': 'runemysteries', 'sheep': 'sheepshearer', 'blackarmgang': 'shieldofarrav', 'squire': 'theknightssword', 'priest': 'therestlessghost',
    'vampire': 'vampyreslayer', 'hetty': 'witchspotion', 'biohazard': 'biohazard', 'chompybird': 'bigchompybirdhunting', 'cog': 'clocktower',
    'death': 'deathplateau', 'druid': 'druidicritual', 'mcannon': 'dwarfcannon', 'eadgar': 'eadgarsruse', 'elemental_workshop': 'elementalworkshopi',
    'crest': 'familycrest', 'arena': 'fightarena', 'fishingcompo': 'fishingcontest', 'fluffs': 'gertrudescat', 'hazeelcult': 'hazeelcult',
    'hero': 'heroesquest', 'grail': 'holygrail', 'horror': 'horrorfromthedeep', 'junglepotion': 'junglepotion', 'legends': 'legendsquest',
    'zanaris': 'lostcity', 'arthur': 'merlinscrystal', 'drunkmonk': 'monksfriend', 'murder': 'murdermystery', 'druidspirit': 'naturespirit',
    'itgronigen': 'observatoryquest', 'elena': 'plaguecity', 'regicide': 'regicide', 'scorpcatcher': 'scorpioncatcher', 'seaslug': 'seaslug',
    'mortton': 'shadesofmortton', 'sheepherder': 'sheepherder', 'zombiequeen': 'shilovillage', 'tbwt': 'taibwowannaitrio', 'viking': 'thefremenniktrials',
    'golem': 'thegolem', 'grandtree': 'thegrandtree', 'tree': 'treegnomevillage', 'totem': 'tribaltotem', 'troll_love': 'trollromance',
    'upass': 'undergroundpass', 'itwatchtower': 'watchtower', 'ball': 'witchshouse', 'mm': 'monkeymadnessi', 'misc': 'throneofmiscellania',
    'hauntedmine': 'hauntedmine', 'routequest': 'insearchofthemyreque', 'dragon': 'dragonslayer'}
DONE = {'cook', 'priestperil', 'waterfall', 'troll', 'ikov', 'itexam', 'desertrescue', 'deserttreasure'}
sys.path.insert(0, os.path.dirname(__file__))
WIKI = {}
exec(re.search(r"WIKI = \{.*?\}\n", Q.rd(os.path.join(os.path.dirname(__file__), 'make_packs.py')), re.S).group(0))
results, num = {}, 9
for key in sorted(DIRS):
    if key in DONE: continue
    d = DIRS[key]
    if not os.path.isdir(f'{Q.QH}/helpers/quests/{d}'):
        alt = [x for x in os.listdir(f'{Q.QH}/helpers/quests') if x.startswith(d[:6])]
        results[key] = f'no Quest Helper folder {d} ({alt})'; continue
    cls = [os.path.basename(f)[:-5] for f in sorted(glob.glob(f'{Q.QH}/helpers/quests/{d}/*.java')) if os.path.basename(f)[:-5] in qinfo]
    if key == 'blackarmgang': cls = ['ShieldOfArravPhoenixGang']  # our journal follows %phoenixgang (varp 145)
    if not cls:
        results[key] = 'no QuestHelperQuest entry'; continue
    kind, nm = qinfo[cls[0]]
    if kind == 'QuestVarPlayer':
        vid = QVP.get(nm); ourvar = Q.PK['varp'].get(vid)
    else:
        vid = Q.GV['VarbitID'].get(QVB.get(nm, '')); ourvar = Q.PK['varbit'].get(vid)
    mine = prog.get(key)
    if not ourvar:
        results[key] = f'{kind}.{nm} ({vid}) not in our game; ours is %{mine}'; continue
    if mine and ourvar != mine:
        results[key] = f'Quest Helper reads %{ourvar}, our quest sets %{mine}: by hand'; continue
    FOLDER = {'fortress': 'blackknight'}
    outdir = glob.glob(f'{E}/scripts/quests/quest_{FOLDER.get(key, key)}')
    if not outdir:
        results[key] = 'no quest folder'; continue
    try:
        n, warn = Q.write(key, num, d, ourvar, journal.get(key, WIKI.get(key, key)), WIKI.get(key, key), outdir[0])
        results[key] = f'guide {num}: {n} steps, {len(warn)} not carried over'
        num += 1
    except Exception as ex:
        results[key] = f'failed: {ex!r}'
for k, v in results.items(): print(k, '-', v)
json.dump(results, open(os.path.join(os.path.dirname(__file__), 'qh_report.json'), 'w'), indent=1)

# the guide numbers and the step procs' switch (questhelper.rs2's ~questhelper_current)
made = [(k, int(re.match(r'guide (\d+)', v).group(1))) for k, v in results.items() if v.startswith('guide ')]
made.sort(key=lambda x: x[1])
open(E + '/scripts/eascape_questhelper/configs/questhelper_converted.constant', 'w').write(
    "// Quest Helper guides converted from RuneLite's Quest Helper (tools/quests/qh_all.py)\n" +
    ''.join(f'^qh_{k} = {n}\n' for k, n in made))
p = E + '/scripts/eascape_questhelper/scripts/questhelper.rs2'
s = Q.rd(p)
s = re.sub(r'(?m)^    case \^qh_\w+ : return\(~questhelper_\w+\); // converted\n', '', s)
add = ''.join(f'    case ^qh_{k} : return(~questhelper_{k}); // converted\n' for k, n in made)
s = s.replace('    case ^qh_deserttreasure : return(~questhelper_deserttreasure);\n', '    case ^qh_deserttreasure : return(~questhelper_deserttreasure);\n' + add, 1)
open(p, 'w').write(s)
print(len(made), 'guides')
