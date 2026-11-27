#!/usr/bin/env python3
"""2007RS: adds the 2007 client's component ids to the Quest Helper's progress data.

The 2007 client's interfaces have their own ids. The server maps EASCape's (2006) components to
them (engine/src/network/game/server/codec/Com2007Table.ts, and the quest journal by hand in
Com2007.ts); this writes the same mapping into progress.json for the quest list colours and the
journal, as packed ids (interface << 16 | component):

  quests[key].com2007      the quest's line in the 2007 quest list (274)
  journal2007              { root: 275, title, lines } the 2007 quest journal

Usage: python3 -I app/tools/quests/com2007.py
"""
import json
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
TABLE = os.path.join(ROOT, 'engine', 'src', 'network', 'game', 'server', 'codec', 'Com2007Table.ts')
PACK = os.path.join(ROOT, 'content', 'pack', 'interface.pack')
PROGRESS = os.path.join(ROOT, 'app', 'src', 'plugins', 'questhelper', 'progress.json')


def main():
    table = {m.group(1): (int(m.group(2)) << 16) | int(m.group(3))
             for m in re.finditer(r'"([a-z0-9_]+:[a-z0-9_]+)": \[(\d+), (\d+)\]', open(TABLE).read())}
    # hand entries (Com2007.ts COMPONENTS_2007_HAND)
    hand = os.path.join(os.path.dirname(TABLE), 'Com2007.ts')
    # (the object's entries, and the ones added after it: COMPONENTS_2007_HAND['x:y'] = com(...))
    for m in re.finditer(r"'([a-z0-9_]+:[a-z0-9_]+)'(?:\]\s*=|:)\s*com\((\d+), (\d+)\)", open(hand).read()):
        table[m.group(1)] = (int(m.group(2)) << 16) | int(m.group(3))
    names = {}
    for line in open(PACK):
        k, _, v = line.strip().partition('=')
        if k.isdigit():
            names[int(k)] = v
    with open(PROGRESS) as f:
        progress = json.load(f)
    missing = []
    for key, q in progress['quests'].items():
        name = names.get(q.get('com'))
        packed = table.get(name) if name else None
        if packed is None:
            missing.append(key)
            q.pop('com2007', None)
        else:
            q['com2007'] = packed
    # the quest journal (Com2007.ts): title 275:2, line n at 275:(n + 3)
    journal = progress['journal']
    progress['journal2007'] = {'root': 275, 'title': (275 << 16) | 2, 'lines': [(275 << 16) | (n + 3) for n in range(1, len(journal['lines']) + 1)]}
    with open(PROGRESS, 'w') as f:
        json.dump(progress, f, indent=1, sort_keys=True)
        f.write('\n')
    print(f"{len(progress['quests']) - len(missing)} quests mapped; not in the 2007 quest list: {', '.join(missing) or 'none'}")


if __name__ == '__main__':
    main()
