import os
"""Generate app/src/plugins/cluescrolls/data.js: RuneLite's clue lists, trimmed to the clues our server
has (Sept 2007), with our server's texts and spots where they differ."""
import sys, json, re, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from compare import OURS, RL, byid, loc_of, ids_of
from overrides import OVERRIDES, ALIAS

N07 = json.load(open(os.environ.get('NAMES07', '/tmp/names07.json')))
ONAME = {int(k): v for k, v in N07['obj'].items() if v}
NPCNAMES = set(v for v in N07['npc'].values() if v)
MAX07 = max(ONAME)
OUT = sys.argv[1] if len(sys.argv) > 1 else None
report = []

ANAGRAM = 'This anagram reveals who to speak to next: '
CIPHER = 'The cipher reveals who to speak to next: '
SLOTS = ['HEAD', 'CAPE', 'AMULET', 'WEAPON', 'BODY', 'SHIELD', 'LEGS', 'GLOVES', 'BOOTS', 'RING', 'AMMO']


def era(s):
    if not isinstance(s, str):
        return s
    return s.replace("Emir's Arena", 'Duel Arena')


def name_ids(rx):
    r = re.compile(rx, re.I)
    return sorted(i for i, n in ONAME.items() if r.match(n))


ANY_CONST = {
    'ANY_TEAM_CAPE': ('Any team cape', r'^Team-\d+ cape$'),
    'ANY_RING_OF_WEALTH': ('Any ring of wealth', r'^Ring of wealth'),
    'ANY_SLAYER_HELMET': ('Any slayer helmet', r'^Slayer helm'),
    'ANY_PHARAOHS_SCEPTRE': ("Pharaoh's sceptre", r"^Pharaoh's sceptre"),
}


def req(v):
    """RuneLite requirement tree -> ours, dropping item ids the 2007 cache doesn't have."""
    if isinstance(v, dict) and 'ref' in v and v['ref'] in ANY_CONST:
        n, rx = ANY_CONST[v['ref']]
        return {'t': 'any', 'name': n, 'reqs': [{'t': 'item', 'id': i} for i in name_ids(rx)]}
    if isinstance(v, dict) and 'fn' in v:
        f, a = v['fn'], v['args']
        if f == 'item':
            return {'t': 'item', 'id': a[0]} if a[0] in ONAME else None
        if f == 'xOfItem':
            return {'t': 'xof', 'id': a[0], 'qty': a[1]} if a[0] in ONAME else None
        if f == 'range':
            if isinstance(a[0], str):
                return {'t': 'range', 'name': a[0], 'start': a[1], 'end': a[2]}
            return {'t': 'range', 'name': None, 'start': a[0], 'end': a[1]}
        if f in ('any', 'all'):
            name = a[0] if isinstance(a[0], str) else ('N/A' if f == 'all' else None)
            rest = a[1:] if isinstance(a[0], str) else a
            reqs = [r for r in (req(x) for x in rest) if r]
            if not reqs:
                return None
            return {'t': f, 'name': name, 'reqs': reqs}
        if f == 'emptySlot':
            slots = []
            for x in a[1:]:
                if isinstance(x, dict) and 'slot' in x:
                    slots.append(x['slot'])
                elif isinstance(x, dict) and x.get('ref') in SLOTS:
                    slots.append(x['ref'])
                elif isinstance(x, dict) and 'code' in x and 'values' in x['code']:
                    slots += SLOTS
            return {'t': 'empty', 'name': a[0], 'slots': slots}
    raise ValueError('req ' + json.dumps(v)[:200])


def wp(v):
    return v['wp'] if isinstance(v, dict) and 'wp' in v else None


def coord_point(text):
    t = text.lower().split(' ')
    degY, minY, degX, minX = int(t[0]), int(t[2]), int(t[5]), int(t[7])
    if t[4] == 'south':
        degY, minY = -degY, -minY
    if t[9] == 'west':
        degX, minX = -degX, -minX
    jround = lambda f: int(f + 0.5) if f >= 0 else -int(-f + 0.5) if (-f) % 1 != 0.5 else int(f + 0.5)
    import math
    x = 2440 + degX * 32 + math.floor(minX / 1.875 + 0.5)
    y = 3161 + degY * 32 + math.floor(minY / 1.875 + 0.5)
    return [x, y, 0]


def item_id(name):
    name = ALIAS.get(name, name)
    ids = sorted(i for i, n in ONAME.items() if n.lower() == name.lower())
    if not ids:
        report.append(f'item not in 2007 cache: {name}')
        return None
    return ids[0]


def own_emote(iid, o, ov):
    em = [x.upper().replace(' ', '_').replace('BLOW_A_KISS', 'BLOW_KISS').replace('JUMP_FOR_JOY', 'JUMP_FOR_JOY') for x in o['emotes']]
    r = {'itemId': iid, 'text': o['text'], 'locationName': ov.get('locationName'), 'stashUnit': None, 'location': our_loc(o), 'firstEmote': em[0]}
    if len(em) > 1:
        r['secondEmote'] = em[1]
    if o.get('agent'):
        r['enemy'] = {65: 'DOUBLE_AGENT_65', 108: 'DOUBLE_AGENT_108', 141: 'DOUBLE_AGENT_141'}[o['agent']]
    reqs = []
    for n in o.get('items', []):
        i = item_id(n)
        if i is not None:
            reqs.append({'t': 'item', 'id': i})
    for sl in o.get('empty', []):
        reqs.append({'t': 'empty', 'name': 'Nothing on your ' + sl, 'slots': [{'feet': 'BOOTS', 'head': 'HEAD', 'legs': 'LEGS', 'chest': 'BODY'}.get(sl, sl.upper())]})
    if o.get('noItems'):
        reqs.append({'t': 'empty', 'name': 'Nothing at all', 'slots': SLOTS})
    r['reqs'] = reqs
    if not r['locationName']:
        report.append(f'emote {iid}: NEEDS locationName; {o["text"]}')
    report.append(f'emote {iid}: ours only: {o["emotes"]} {o.get("items")} {o.get("empty")}')
    return r


out = collections.defaultdict(list)
# challenge scrolls: their parent clue's question
challenges = {}
for k, o in OURS.items():
    if o['kind'] == 'challenge':
        parent = o['name'].replace('_challenge', '')
        challenges[parent] = o


def our_loc(o):
    if 'x' in o:
        return [o['x'], o['z'], o.get('level', 0)]
    if o.get('spawns'):
        s = o['spawns'][0]
        return [s['x'], s['z'], s.get('level', 0)]
    return None


def dist(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + 100 * abs(a[2] - b[2]) if a and b else 0


for k, o in sorted(OURS.items(), key=lambda kv: int(kv[0])):
    iid = int(k)
    kind = o['kind']
    if kind in ('challenge', 'puzzle'):
        continue  # challenge scrolls: their parent's question; puzzle boxes: the Puzzle Solver plugin's
    ov = OVERRIDES.get(iid, {})
    hits = byid.get(iid, [])
    loc = our_loc(o)
    text = o.get('text')
    ch = challenges.get(o['name'])
    if o['npc'] if 'npc' in o and kind == 'npc' else False:
        if o['npc'] not in NPCNAMES:
            report.append(f'npc name not in 2007 cache: {iid} {o["npc"]}')
    if hits:
        c, _, e = hits[0]
        e = json.loads(json.dumps(e))
    else:
        c, e = None, None

    if kind == 'map' or c == 'MapClue':
        objId = -1
        if e and c == 'MapClue':
            a = e['args']
            objId = a[2] if len(a) > 2 and isinstance(a[2], int) else -1
            desc = a[-1] if isinstance(a[-1], str) else None
            if dist(wp(a[1]), loc) > 0:
                report.append(f'map {iid}: our spot {loc} (RuneLite {wp(a[1])})')
                desc = ov.get('description', desc)
        else:
            desc = ov.get('description')
            report.append(f'map {iid}: ours only {loc} {o.get("object")}')
        if o.get('object') and objId == -1:
            objId = ov.get('objectId', -1)
        out['map'].append({'itemId': iid, 'location': loc, 'objectId': objId, 'description': era(desc)})
        continue

    if kind == 'coordinate':
        p = coord_point(text)
        if p[:2] != loc[:2]:
            report.append(f'coordinate {iid}: text gives {p}, server {loc}')
        r = {'itemId': iid, 'location': p, 'directions': None}
        if e and c == 'CoordinateClue' and dist(wp(e['location']), p) == 0:
            r['directions'] = era(e.get('directions'))
            if e.get('enemy'):
                r['enemy'] = e['enemy']['ref'].split('.')[1]
            if e.get('lightSourceVarbitId'):
                report.append(f'coordinate {iid}: light source varbit')
        else:
            if e:
                report.append(f'coordinate {iid}: RuneLite spot {wp(e["location"])} differs from ours {p}')
                if e.get('enemy'):
                    r['enemy'] = e['enemy']['ref'].split('.')[1]
        if o.get('guardian') and 'enemy' not in r:
            r['enemy'] = {'Zamorak Wizard': 'ZAMORAK_WIZARD', 'Saradomin Wizard': 'SARADOMIN_WIZARD'}.get(o['guardian'])
            report.append(f'coordinate {iid}: enemy from our guardian {o["guardian"]}')
        if 'directions' in ov:
            r['directions'] = ov['directions']
        if r['directions'] is None:
            report.append(f'coordinate {iid}: NEEDS directions {p}')
        if 'directionsProvider' in ov:
            r['directionsProvider'] = ov['directionsProvider']
        out['coordinate'].append(r)
        continue

    if kind == 'emote':
        if e and c == 'EmoteClue' and not ov.get('own'):
            a = e['args']
            rest = a[5:]
            r = {'itemId': iid, 'text': text, 'locationName': era(a[2]), 'stashUnit': None, 'location': wp(a[4])}
            if dist(r['location'], loc) > 0:
                ar = o.get('area')
                inside = ar and ar['x1'] <= r['location'][0] <= ar['x2'] and ar['z1'] <= r['location'][1] <= ar['z2'] and r['location'][2] == o.get('level', 0)
                if not inside:
                    report.append(f'emote {iid}: RuneLite spot {r["location"]} outside our area {ar}; using ours {loc}')
                    r['location'] = loc
                    if 'locationName' in ov:
                        r['locationName'] = ov['locationName']
            i = 0
            if isinstance(rest[i], dict) and rest[i].get('ref', '').startswith('Enemy.'):
                r['enemy'] = rest[i]['ref'].split('.')[1]; i += 1
            r['firstEmote'] = rest[i]['ref'].split('.')[1]; i += 1
            if i < len(rest) and isinstance(rest[i], dict) and rest[i].get('ref', '').startswith('Emote.'):
                r['secondEmote'] = rest[i]['ref'].split('.')[1]; i += 1
            if i < len(rest) and isinstance(rest[i], dict) and 'varbit' in rest[i]:
                r['firePitVarbitId'] = rest[i]['varbit']; i += 1
            r['reqs'] = [x for x in (req(v) for v in rest[i:]) if x]
            if o.get('agent') and 'enemy' not in r:
                report.append(f'emote {iid}: our double agent {o["agent"]} not in RuneLite')
            ours_em = [x.upper().replace(' ', '_') for x in o.get('emotes', [])]
            rl_em = [r['firstEmote']] + ([r['secondEmote']] if 'secondEmote' in r else [])
            if ours_em and [x.replace('BLOW_A_KISS', 'BLOW_KISS') for x in ours_em] != rl_em:
                report.append(f'emote {iid}: emotes ours {ours_em} RuneLite {rl_em}')
            out['emote'].append(r)
        else:
            out['emote'].append(own_emote(iid, o, ov))
        continue

    # text clues: cryptic / anagram / cipher (npc, search, dig)
    is_anagram = text and text.startswith(ANAGRAM)
    is_cipher = text and text.startswith(CIPHER)
    if is_anagram:
        r = {'itemId': iid, 'text': text[len(ANAGRAM):]}
        if e and c == 'AnagramClue':
            for f in ('npc', 'location', 'area', 'question', 'answer', 'objectId'):
                if f in e:
                    r[f] = e[f] if f != 'location' else wp(e[f])
            r['area'] = era(r.get('area'))
        if o.get('npc') and r.get('npc') != o['npc']:
            report.append(f'anagram {iid}: npc ours {o["npc"]} RuneLite {r.get("npc")}')
            r['npc'] = o['npc']
        if dist(r.get('location'), loc) > 40 or not r.get('location'):
            report.append(f'anagram {iid}: spot ours {loc} RuneLite {r.get("location")} ({r.get("area")})')
            r['location'] = loc
        r.update(ov)
        if ch:
            r['question'] = ch['text']; r['answer'] = str(ch['answer'])
        out['anagram'].append(r)
        continue
    if is_cipher:
        report.append(f'cipher {iid}: ours: {text}')
        continue
    r = {'itemIds': [iid], 'text': text, 'objectId': -1, 'npcRegions': []}
    if e and c == 'CrypticClue':
        for f in ('npc', 'objectId', 'solution', 'questionText', 'answer', 'requiresLight', 'npcRegions'):
            if f in e:
                r[f] = e[f]
        r['location'] = wp(e.get('location'))
        r['solution'] = era(r.get('solution'))
        for f in ('npcProvider', 'locationProvider', 'solutionProvider'):
            if f in e:
                report.append(f'cryptic {iid}: {f} {e[f]}')
    elif e:
        report.append(f'cryptic {iid}: RuneLite has it as {c}')
    if kind == 'npc':
        if r.get('npc') != o['npc']:
            report.append(f'cryptic {iid}: npc ours {o["npc"]} RuneLite {r.get("npc")}; text {text}')
            r['npc'] = o['npc']; r['location'] = loc; r['solution'] = None; r['npcRegions'] = []; r.pop('objectId', None); r['objectId'] = -1
        elif dist(r.get('location'), loc) > 40:
            report.append(f'cryptic {iid}: spot ours {loc} RuneLite {r.get("location")}')
            r['location'] = loc; r['npcRegions'] = []
    else:
        key = o.get('key')
        if r.get('npc') and not key:
            report.append(f'cryptic {iid}: RuneLite npc {r["npc"]} but ours is {kind}')
            r.pop('npc')
        if key:
            kn = key['from'][4:] if key['from'].startswith('any ') else key['from']
            if (r.get('npc') or '').lower() != kn.lower():
                report.append(f'cryptic {iid}: key from ours {key["from"]} RuneLite {r.get("npc")}')
                r['npc'] = kn[0].upper() + kn[1:]; r['npcRegions'] = []
        if dist(r.get('location'), loc) > 0:
            report.append(f'cryptic {iid} {kind}: spot ours {loc} RuneLite {r.get("location")} obj {r.get("objectId")} {o.get("object")}')
            r['location'] = loc
        if kind == 'search' and r['objectId'] == -1:
            report.append(f'cryptic {iid}: search without objectId ({o.get("object")})')
        if kind == 'dig' and r['objectId'] != -1:
            r['objectId'] = -1
    if ch:
        r['questionText'] = ch['text']; r['answer'] = str(ch['answer'])
    r.update(ov)
    if not r.get('solution'):
        report.append(f'cryptic {iid}: NEEDS solution ({kind} {o.get("npc") or o.get("object")} {loc}) {text}')
    out['cryptic'].append(r)

# The emote clues' Emote enum (name, 2007 emote tab): the full enum is kept
print('\n'.join(report))
counts = {k: len(v) for k, v in out.items()}
print(counts)
if OUT:
    js = ('// Generated by the converter in the clone\'s notes from RuneLite\'s clue lists (CrypticClue, AnagramClue,\n'
          '// CipherClue, CoordinateClue, MapClue, EmoteClue), trimmed to the clues our server has (Sept 2007).\n'
          '(() => {\n  const ll = window.__lostlite;\n  if (!ll) return;\n  ll.cluescrollsData = ' +
          json.dumps(out, separators=(',', ':'), ensure_ascii=False) + ';\n})();\n')
    open(OUT, 'w').write(js)
