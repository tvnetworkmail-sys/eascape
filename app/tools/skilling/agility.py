# Builds src/plugins/agility/agility.json for the Agility plugin from Lost City's Content
# (give the 274 checkout, then 377; ids are the same in both, so the tables merge):
#   courses:   name, the course's progress varp, how many obstacles make a lap, the XP of a
#              whole lap and of the last obstacle with the lap bonus (finishXp) (in tenths, as
#              stat_advance gives them) and the obstacles' loc ids
#   shortcuts: { locId: agility level needed } for everything else you need Agility for
# The progress varp isn't sent to the game (scope=perm, no transmit), so a lap is seen the way
# RuneLite sees one: the XP of the last obstacle and the lap bonus arriving together
# ("update_gnome_varp(7)": "if (%gnome_course_progress = 7) { stat_advance(agility, 390) }").
# Usage: python3 tools/skilling/agility.py <Content 274> [<Content 377> ...]
import glob, json, os, re, sys

NAMES = {'gnome': 'Gnome Stronghold', 'barbarian': 'Barbarian Outpost', 'wilderness': 'Wilderness'}
BLOCK = re.compile(r'^\[(oploc\d),([\w]+)\]', re.M)

def pack(content, name):
    ids = {}
    for line in open(os.path.join(content, 'pack', name + '.pack')):
        m = re.match(r'(\d+)=(\S+)', line.strip())
        if m:
            ids[m.group(2)] = int(m.group(1))
    return ids

def categories(content):
    """loc name -> category, from the .loc configs."""
    out = {}
    for f in glob.glob(os.path.join(content, 'scripts', '**', '*.loc'), recursive=True):
        cur = None
        for line in open(f, encoding='utf-8', errors='replace'):
            s = line.strip()
            if s.startswith('[') and s.endswith(']'):
                cur = s[1:-1]
            elif cur and s.startswith('category='):
                out[cur] = s.split('=', 1)[1]
    return out

def blocks(text):
    """[oploc1,name] -> its script text, up to the next trigger."""
    marks = [(m.start(), m.group(0)) for m in re.finditer(r"^\[\w+,\w+\]", text, re.M)]
    out = []
    for i, (pos, _) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(text)
        m = BLOCK.match(text, pos)
        if m:
            out.append((m.group(2), text[pos:end]))
    return out

courses = {}
shortcuts = {}
for content in sys.argv[1:]:
    locs = pack(content, 'loc')
    varps = pack(content, 'varp')
    cats = categories(content)

    def ids(name):
        if name.startswith('_'):
            return [locs[n] for n, c in cats.items() if c == name[1:] and n in locs]
        return [locs[name]] if name in locs else []

    for f in glob.glob(os.path.join(content, 'scripts', 'skill_agility', 'scripts', '*_course.rs2')):
        key = os.path.basename(f)[:-len('_course.rs2')]
        text = open(f, encoding='utf-8', errors='replace').read()
        proc = re.search(r'%(\w+_course_progress) = (\d+)\) \{[^}]*?stat_advance\(agility, (\d+)\)', text, re.S)
        if not proc or proc.group(1) not in varps:
            continue
        xp = sum(int(v) for v in re.findall(r'~agility_\w+\((\d+)', text)) + sum(int(v) for v in re.findall(r'stat_advance\(agility, (\d+)\)', text))
        obstacles = sorted({i for name, _ in blocks(text) for i in ids(name)})
        # the last obstacle: the script part (from its trigger or label) that ends the lap
        call = re.search(r'~update_%s_varp\(%s\)' % (key, proc.group(2)), text)
        start = max(m.start() for m in re.finditer(r'^\[\w+,\w+\]', text[:call.start()], re.M)) if call else 0
        part = text[start:call.start()] if call else ''
        last = sum(int(v) for v in re.findall(r'~agility_\w+\((\d+)', part)) + sum(int(v) for v in re.findall(r'stat_advance\(agility, (\d+)\)', part))
        c = courses.setdefault(key, {'name': NAMES.get(key, key.replace('_', ' ').title()), 'varp': varps[proc.group(1)], 'obstacles': int(proc.group(2)), 'lapXp': xp, 'finishXp': last + int(proc.group(3)), 'locs': []})
        c['locs'] = sorted(set(c['locs']) | set(obstacles))
    course_locs = {i for c in courses.values() for i in c['locs']}
    for f in glob.glob(os.path.join(content, 'scripts', '**', '*.rs2'), recursive=True):
        if f.endswith('_course.rs2'):
            continue
        text = open(f, encoding='utf-8', errors='replace').read()
        if 'agility' not in text:
            continue
        for name, body in blocks(text):
            m = re.search(r'stat\(agility\) < (\d+)', body)
            if not m:
                continue
            for i in ids(name):
                if i not in course_locs:
                    shortcuts.setdefault(str(i), int(m.group(1)))

out = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'plugins', 'agility', 'agility.json')
json.dump({'courses': list(courses.values()), 'shortcuts': shortcuts}, open(out, 'w'), separators=(',', ':'), sort_keys=True)
for c in courses.values():
    print(c['name'], 'varp', c['varp'], c['obstacles'], 'obstacles,', c['lapXp'] / 10, 'xp a lap,', c['finishXp'] / 10, 'xp to finish,', len(c['locs']), 'locs')
print(len(shortcuts), 'shortcuts')
