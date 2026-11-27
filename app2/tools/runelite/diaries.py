"""Our 2007 Achievement Diaries as RuneLite's GenericDiaryRequirement subclasses (Diary Requirements).

    python3 diaries.py

writes app/src/plugins/achievementdiary/diaries.js. RuneLite's diaries/*DiaryRequirement.java are OSRS's 2015 task
lists; our server has 2007's Karamja (8 May 2007) and Varrock (10 Sep 2007) diaries, so each task's text is the
server's own (achievement_diary/configs/diary.enum, diary_task_text: key (area * 3 + tier) * 32 + task, as the
journal shows it) and the requirements are REQUIREMENTS below (RuneLite's where its task is the same one, otherwise the
skill / quest the 2007 task needs). The journal's first line is "<area> Area Tasks" (~diary_journal), which names
the diary as RuneLite's getRequirementsForTitle does. As in RuneLite, a task with nothing needed is left out. Quests
are RuneLite's Quest names that our quest list has (app/src/plugins/runelite/quest.js, quests.py); a requirement on a
quest our list doesn't have (Enlightened Journey, What Lies Below: after Sept 2007) is left out.

Checked against the server: where a task's script (the ~diary_task call sites across content/scripts and the skill
data they read: mine / trees / smithing / pottery / battlestaves / pickpocket / runecraft / farming / hunter / poh_data
dbrows, slayer_master_eligible, the Champions' Guild door, the carts' Shilo Village check) checks a level or quest, the
value here is the server's. Tasks the server checks nothing for, or doesn't wire up yet, keep RuneLite's value.
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
ENUM = os.path.join(REPO, 'content/scripts/achievement_diary/configs/diary.enum')
CONSTANT = os.path.join(REPO, 'content/scripts/achievement_diary/configs/diary.constant')
QUESTS = os.path.join(REPO, 'app/src/plugins/runelite/quest.js')
OUT = os.path.join(REPO, 'app/src/plugins/achievementdiary/diaries.js')

# (area, tier, task) -> requirements: 'Skill N', 'combat N', 'qp N', 'quest NAME', 'started NAME', ('or', a, b, ...)
REQUIREMENTS = {
    # Karamja: easy
    (0, 0, 1): ['Agility 10'],
    (0, 0, 2): ['Mining 40'],
    (0, 0, 5): ['Agility 15'],
    # medium
    (0, 1, 0): ['Agility 30'],
    (0, 1, 1): ['started DRAGON_SLAYER_I'],
    (0, 1, 2): ['started DRAGON_SLAYER_I'],
    (0, 1, 3): ['quest SHILO_VILLAGE'],
    (0, 1, 4): ['Woodcutting 10', 'quest JUNGLE_POTION'],
    (0, 1, 5): ['Cooking 16'],
    (0, 1, 6): ['quest SHILO_VILLAGE'],
    (0, 1, 7): ['Woodcutting 35', 'quest JUNGLE_POTION'],
    (0, 1, 8): ['Woodcutting 50', 'quest JUNGLE_POTION'],
    (0, 1, 9): ['Fishing 65', 'started TAI_BWO_WANNAI_TRIO'],
    (0, 1, 10): ['quest JUNGLE_POTION'],
    (0, 1, 11): ['quest THE_GRAND_TREE'],
    (0, 1, 12): ['Farming 27'],
    (0, 1, 13): ['Hunter 41'],
    (0, 1, 14): ['Woodcutting 10'],
    (0, 1, 15): ['Agility 12'],
    (0, 1, 16): ['Woodcutting 10'],
    (0, 1, 17): ['quest THE_GRAND_TREE'],
    (0, 1, 18): ['Mining 40', ('or', 'quest SHILO_VILLAGE', 'quest JUNGLE_POTION')],
    # hard
    (0, 2, 3): ['Runecraft 44'],
    (0, 2, 4): ['Cooking 30', 'quest TAI_BWO_WANNAI_TRIO'],
    (0, 2, 5): ['Woodcutting 15', 'Strength 50', 'Agility 50', 'Thieving 50', 'Mining 52', 'quest LEGENDS_QUEST'],
    (0, 2, 6): ['Agility 53', 'Ranged 42', 'Strength 21'],
    (0, 2, 7): ['Woodcutting 15', 'quest LEGENDS_QUEST'],
    (0, 2, 8): ['combat 100', 'Slayer 50', 'quest SHILO_VILLAGE'],
    # Varrock: easy
    (1, 0, 1): ['quest RUNE_MYSTERIES'],
    (1, 0, 2): ['Mining 15'],
    (1, 0, 5): ['Agility 13'],
    (1, 0, 9): ['Crafting 8'],
    (1, 0, 11): ['Construction 10'],
    (1, 0, 15): ['Mining 10'],
    (1, 0, 16): ['Fishing 20'],
    # medium
    (1, 1, 1): ['qp 32'],
    (1, 1, 2): ['quest WHAT_LIES_BELOW'],
    (1, 1, 3): ['started RATCATCHERS'],
    (1, 1, 5): ['quest TREE_GNOME_VILLAGE'],
    (1, 1, 7): ['started GARDEN_OF_TRANQUILLITY', 'quest GERTRUDES_CAT'],
    (1, 1, 8): ['started A_SOULS_BANE'],
    (1, 1, 9): ['quest THE_DIG_SITE'],
    (1, 1, 11): ['Thieving 40'],
    (1, 1, 12): ['Magic 25'],
    (1, 1, 13): ['combat 40'],
    (1, 1, 15): ['Farming 25', 'quest GARDEN_OF_TRANQUILLITY'],
    (1, 1, 16): ['Firemaking 40', 'quest ENLIGHTENED_JOURNEY'],
    (1, 1, 17): ['quest GERTRUDES_CAT'],
    (1, 1, 18): ['started FAIRYTALE_II__CURE_A_QUEEN'],
    (1, 1, 19): ['quest DRAGON_SLAYER_I'],
    # hard
    (1, 2, 0): ['Farming 70'],
    (1, 2, 1): ['Agility 51'],
    (1, 2, 2): ['Hunter 69'],  # the server's dashing kebbit catch level (hunter_falconry.rs2); RuneLite's 66 is OSRS's wear level
    (1, 2, 3): ['Smithing 73'],
    (1, 2, 5): ['Cooking 85'],
    (1, 2, 6): ['Crafting 66'],
    (1, 2, 7): ['Construction 40'],  # the server's tropical wood style level (poh_data.dbrow poh_style_4; fancy stone 50)
    (1, 2, 8): ['Magic 25', 'Construction 67'],  # the server's Varrock tablet (poh_use.rs2) and mahogany lectern build level
    (1, 2, 9): ['quest FAMILY_CREST'],
    (1, 2, 10): ['Woodcutting 57'],
    (1, 2, 11): ['quest DESERT_TREASURE_I'],
}


def main():
    src = open(ENUM).read()
    def enum(name):
        body = src.split('[' + name + ']', 1)[1].split('\n[', 1)[0]
        return dict((int(k), v) for k, v in re.findall(r'^val=(\d+),(.*)$', body, re.M))
    texts = enum('diary_task_text')
    counts = enum('diary_task_count')
    areas = dict((int(v), k) for k, v in re.findall(r'^\^diary_(\w+) = (\d+)', open(CONSTANT).read(), re.M))
    quests = set(re.findall(r'"([A-Z0-9_]+)":\["', open(QUESTS).read()))

    def req(r):
        if isinstance(r, tuple):
            parts = [p for p in (req(x) for x in r[1:]) if p]
            return {'or': parts} if len(parts) > 1 else (parts[0] if parts else None)
        kind, arg = r.split(' ', 1) if r.split(' ', 1)[0] in ('combat', 'qp', 'quest', 'started') else ('skill', r)
        if kind in ('quest', 'started'):
            if arg not in quests:
                print('left out (not in our quest list):', arg)
                return None
            return {kind: arg}
        if kind == 'skill':
            skill, level = arg.rsplit(' ', 1)
            return {'skill': skill.upper(), 'level': int(level)}
        return {kind: int(arg)}

    diaries = {}
    for area in sorted(areas):
        title = (areas[area].capitalize() + ' Area Tasks').replace(' ', '_').upper()
        tasks = []
        for tier in range(3):
            for task in range(int(counts[area * 3 + tier])):
                rs = [x for x in (req(r) for r in REQUIREMENTS.get((area, tier, task), [])) if x]
                if rs:
                    tasks.append([texts[(area * 3 + tier) * 32 + task], rs])
        diaries[title] = tasks
    unknown = [k for k in REQUIREMENTS if k[1] > 2 or k[2] >= int(counts[k[0] * 3 + k[1]])]
    assert not unknown, unknown
    js = """// Generated by app/tools/runelite/diaries.py: our 2007 Achievement Diaries (the server's diary.enum task texts) as
// RuneLite's diaries/*DiaryRequirement classes: journal title -> [task, requirements] (Diary Requirements).
(() => {
  const ll = window.__lostlite;
  if (!ll) return;
  ll.__diaryRequirements = %s;
})();
""" % ('{\n' + ',\n'.join('    %s: [\n%s,\n    ]' % (json.dumps(k), ',\n'.join('      ' + json.dumps(t) for t in v)) for k, v in diaries.items()) + ',\n  }')
    open(OUT, 'w').write(js)
    print(', '.join('%s %d' % (k, len(v)) for k, v in diaries.items()), '->', os.path.relpath(OUT, REPO))


if __name__ == '__main__':
    main()
