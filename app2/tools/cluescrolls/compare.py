import os
import sys, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from convert import load

OURS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'server_clues.json')))
CLASSES = ['CrypticClue', 'AnagramClue', 'CipherClue', 'CoordinateClue', 'MapClue', 'EmoteClue', 'FairyRingClue']
RL = {c: load(c) for c in CLASSES}


def ids_of(c, e):
    if c == 'MapClue':
        return [e['args'][0]]
    if c == 'EmoteClue':
        return [e['args'][0]]
    if 'itemIds' in e:
        return e['itemIds'] if isinstance(e['itemIds'], list) else [e['itemIds']]
    return [e.get('itemId', -1)]


def loc_of(c, e):
    if c == 'MapClue':
        return e['args'][1].get('wp')
    if c == 'EmoteClue':
        for a in e['args']:
            if isinstance(a, dict) and 'wp' in a:
                return a['wp']
    l = e.get('location')
    return l.get('wp') if isinstance(l, dict) else None


def text_of(c, e):
    if c == 'EmoteClue':
        return e['args'][1]
    if c == 'AnagramClue':
        return 'This anagram reveals who to speak to next: ' + e['text'] if isinstance(e.get('text'), str) else None
    if c == 'CipherClue':
        return 'The cipher reveals who to speak to next: ' + e['text']
    t = e.get('text')
    return t if isinstance(t, str) else None


byid = collections.defaultdict(list)
for c, lst in RL.items():
    for i, e in enumerate(lst):
        for iid in ids_of(c, e):
            byid[iid].append((c, i, e))

if __name__ == '__main__':
    stats = collections.Counter()
    for k, o in sorted(OURS.items(), key=lambda kv: int(kv[0])):
        hits = byid.get(int(k), [])
        if not hits:
            stats['nomatch', o['kind']] += 1
            print('NOMATCH', k, o['kind'], o['name'], (o.get('text') or '')[:70])
            continue
        c, i, e = hits[0]
        loc = loc_of(c, e)
        ot = o.get('text')
        rt = text_of(c, e)
        tdiff = ot and rt and ot.lower().strip() != rt.lower().strip() and not (e.get('question') and ot.lower() == e['question'].lower())
        ox, oz = o.get('x'), o.get('z')
        if ox is None and o.get('spawns'):
            ox, oz = o['spawns'][0]['x'], o['spawns'][0]['z']
        d = abs(loc[0] - ox) + abs(loc[1] - oz) if loc and ox is not None else None
        bad = (d is not None and d > 6) or tdiff
        stats[('diff' if bad else 'ok'), c] += 1
        if bad:
            print('DIFF', k, c, o['kind'], 'dist', d, '|', (ot or '')[:60], '|', (rt or '')[:60])
    for s in sorted(stats.items()):
        print(s)
