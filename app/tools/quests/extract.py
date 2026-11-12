#!/usr/bin/env python3
"""Builds the Quest Helper's progress data from Lost City's revision 274 content.

Lost City keeps each quest's progress in a server-side variable that isn't sent to the game
(only the quest list colour is: red not started, yellow started, green done). LostLite works
the stage out from what the game does show:

  journal     the text the quest journal shows for each stage ([if_button,questlist:<q>] in
              the quest's *_journal.rs2), so opening the journal gives the exact stage
  dialogue    lines of dialogue that only appear after the stage variable is set
              (%var = N; ~chatnpc("...")), so talking to people moves the guide on

Usage: extract.py <content> <out.json>

EASCape: copied from LostLite (tools/quests); reads EASCape's content (interfaces/questlist.if,
the questjournal interface) so the journal texts are our own.
"""
import bisect
import json
import os
import re
import sys

TAG = re.compile(r'@[a-z0-9]{3}@|<p,[a-z_]+>|<col=[0-9a-f]+>|</col>')


def norm(s):
    """Text as the player sees it, lower case with single spaces (variables dropped)."""
    s = TAG.sub('', s).replace('|', ' ')
    s = re.sub(r'<[^>]*>', ' ', s)
    s = re.sub(r'[^a-z0-9]+', ' ', s.lower())
    return re.sub(r'\s+', ' ', s).strip()


def read_pack(path):
    ids = {}
    with open(path) as f:
        for line in f:
            m = re.match(r'(\d+)=(\S+)', line.strip())
            if m:
                ids[m.group(2)] = int(m.group(1))
    return ids


def constants(root):
    out = {}
    for dirpath, _, files in os.walk(os.path.join(root, 'scripts')):
        for fn in files:
            if fn.endswith('.constant'):
                with open(os.path.join(dirpath, fn), encoding='utf-8', errors='replace') as f:
                    for line in f:
                        m = re.match(r'\^(\w+)\s*=\s*(-?\d+)', line.strip())
                        if m:
                            out[m.group(1)] = int(m.group(2))
    return out


def value(tok, consts):
    tok = tok.strip()
    if re.fullmatch(r'-?\d+', tok):
        return int(tok)
    if tok.startswith('^') and tok[1:] in consts:
        return consts[tok[1:]]
    return None


SWITCH = re.compile(r'switch_int\s*\(\s*%(\w+)\s*\)')
CASE = re.compile(r'case\s+([\^\w ,]+?)\s*:(?!:)')
COND = re.compile(r'(?:}\s*else\s+)?if\s*\(\s*%(\w+)\s*(=|<|>|<=|>=|!)\s*([\^\w]+)\s*\)\s*\{')
STR = re.compile(r'"((?:[^"\\]|\\.)*)"')


def journal(path, consts):
    """[(varp, lo, hi, text)] for each top-level branch of the journal script."""
    with open(path, encoding='utf-8', errors='replace') as f:
        lines = f.read().split('\n')
    out = []
    varp = None
    chain = []  # conditions so far in the current if/else chain: (lo, hi)
    current = None
    common = []  # text shown outside any branch: part of every stage after it
    depth = 0
    alias = {}  # def_int $s = %varp; (journals that read the variable into a local first)
    sw = None  # (varp, depth of its cases) inside switch_int(%varp) { case ...: }
    for line in lines:
        s = line.strip()
        if s.startswith('//'):
            continue
        a = re.match(r'def_int\s+\$(\w+)\s*=\s*%(\w+)\s*;', s)
        if a:
            alias[a.group(1)] = a.group(2)
        for k, v in alias.items():
            s = re.sub(r'\$' + k + r'\b', '%' + v, s)
        sm = SWITCH.search(s)
        if sm and depth == 0 and sw is None:
            sw = (sm.group(1), depth + 1)
            varp = varp or sm.group(1)
            chain = []
        cm = CASE.match(s) if sw else None
        if cm and depth == sw[1] and sw[0] == varp:
            toks = [t.strip() for t in cm.group(1).split(',')]
            if toks == ['default']:
                top = max([h for _, h in chain if h is not None] or [-1])
                runs = [(top + 1, 10**9)]
            else:
                ns = sorted(n for n in (value(t, consts) for t in toks) if n is not None)
                runs = []
                for n in ns:
                    if runs and runs[-1][1] == n - 1:
                        runs[-1] = (runs[-1][0], n)
                    else:
                        runs.append((n, n))
            texts = list(common)
            for lo, hi in runs:
                chain.append((lo, hi))
                current = {'varp': varp, 'lo': lo, 'hi': hi, 'text': None, 'texts': texts, 'case': toks}
                out.append(current)
        if sw and depth == sw[1] and s.startswith('}'):
            sw = None
            current = None
        m = None if sw else COND.search(s)
        if sw is None and depth == 0 and current is not None and not m and not s.startswith('}'):
            current = None  # back at the top level, after a branch
        at = depth - (1 if s.startswith('}') else 0)
        if m and at == 0:
            v, op, tok = m.group(1), m.group(2), m.group(3)
            n = value(tok, consts)
            varp = varp or v
            if v == varp and n is not None:
                lo, hi = {'=': (n, n), '<': (-10**9, n - 1), '<=': (-10**9, n), '>': (n + 1, 10**9), '>=': (n, 10**9), '!': (None, None)}[op]
                if not s.startswith('}'):
                    chain = []
                chain.append((lo, hi))
                current = {'varp': v, 'lo': lo, 'hi': hi, 'text': None, 'texts': list(common)}
                out.append(current)
        elif re.match(r'}\s*else\s*\{', s) and at == 0 and chain:
            # else: above the highest stage the chain names (journals count upwards)
            top = max(h for _, h in chain if h is not None)
            current = {'varp': varp, 'lo': top + 1, 'hi': 10**9, 'text': None, 'texts': list(common)}
            out.append(current)
            chain = []
        if re.search(r'\$\w+\s*=|quest_journal\(', s):
            for lit in STR.findall(s):
                # split at <variables> (counts, names): each fixed piece must show
                for piece in re.split(r'<[a-z_]+\([^>]*\)>|<\$\w+>', lit):
                    t = norm(piece)
                    if len(t) < 10:
                        continue
                    if current is not None:
                        current['texts'].append(t)
                        for b in out:
                            if b['texts'] is current['texts']:
                                b['text'] = b['text'] or lit
                    elif depth == 0:
                        common.append(t)
        depth += s.count('{') - s.count('}')
    return [b for b in out if b['text'] and b['lo'] is not None]


SAY = re.compile(r'~(?:chatnpc|chatplayer|chatnpc_specific|mesbox|objbox|doubleobjbox)\w*\(|\bmes\(')


def transitions(files, varp, consts):
    """{normalized line: stage}. A stage is set by %varp = N inside some block; the dialogue
    shown after it in that block (and the last line shown just before it, which the player
    clicks past to make it happen) only appears at that point of the quest."""
    seen = {}
    assign = re.compile(r'%' + re.escape(varp) + r'\s*=\s*([\^\w]+)\s*;')

    def add(text, stage):
        t = norm(text)
        if len(t) >= 18:
            seen.setdefault(t, set()).add(stage)

    for path in files:
        with open(path, encoding='utf-8', errors='replace') as f:
            lines = f.read().split('\n')
        depth = 0
        active = []  # (stage, depth of the block it was set in)
        recent = []  # (depth, [literals]) dialogue lines since the last assignment in this label
        for line in lines:
            s = line.split('//')[0].strip() if '"' not in line.split('//')[0] else line.strip()
            if s.startswith('['):
                depth, active, recent = 0, [], []
                continue
            m = assign.search(s)
            if m:
                n = value(m.group(1), consts)
                if n is not None:
                    active.append((n, depth))
                    # the line the player clicked past to get here (same block or an enclosing one)
                    # (only from the same block: from an enclosing one, a choice may sit between)
                    if recent and recent[-1][0] == depth:
                        for lit in recent[-1][1]:
                            add(lit, n)
                    recent = []
            elif re.search(r'~p_choice|[~@]multi', s):
                recent = []
            elif SAY.search(s):
                lits = STR.findall(s)
                recent.append((depth, lits))
                if active:
                    for lit in lits:
                        add(lit, active[-1][0])
            closes = len(s) - len(s.lstrip('}'))
            depth -= closes
            while active and depth < active[-1][1]:
                active.pop()
            depth += s.count('{') - (s.count('}') - closes)
            while active and depth < active[-1][1]:
                active.pop()
    return {t: min(v) for t, v in seen.items() if len(v) == 1}


_texts = {}


def text_of(path):
    if path not in _texts:
        with open(path, encoding='utf-8', errors='replace') as f:
            _texts[path] = f.read()
    return _texts[path]


_said = None


def said_in(t, files):
    """The scripts that can show this (normalized) line: a line said elsewhere too doesn't
    tell where you are in the quest."""
    global _said
    if _said is None:
        parts, starts, names, at = [], [], [], 0
        for p in files:
            txt = ' ' + ' | '.join(norm(lit) for lit in STR.findall(text_of(p))) + ' '
            parts.append(txt)
            starts.append(at)
            names.append(p)
            at += len(txt)
        _said = (''.join(parts), starts, names)
    big, starts, names = _said
    out = set()
    i = big.find(' ' + t + ' ')
    while i >= 0:
        out.add(names[bisect.bisect_right(starts, i) - 1])
        i = big.find(' ' + t + ' ', i + 1)
    return out


def main(root, out):
    consts = constants(root)
    if_ids = read_pack(os.path.join(root, 'pack', 'interface.pack'))
    scripts = os.path.join(root, 'scripts')
    all_rs2 = []
    for dirpath, _, fns in os.walk(scripts):
        if '_test' in dirpath:
            continue
        all_rs2 += [os.path.join(dirpath, f) for f in fns if f.endswith('.rs2')]

    # quest list names
    names = {}
    buttons = set()
    cur = None
    with open(os.path.join(scripts, 'interfaces', 'questlist.if')) as f:
        for line in f:
            m = re.match(r'\[(\w+)\]', line.strip())
            if m:
                cur = m.group(1)
            elif cur and line.startswith('text='):
                names[cur] = line.strip()[5:]
            elif cur and line.startswith('buttontype=normal'):
                buttons.add(cur)

    quests = {}
    for path in all_rs2:
        with open(path, encoding='utf-8', errors='replace') as f:
            head = f.read(4000)
        m = re.search(r'\[if_button,questlist:(\w+)\]', head)
        if not m:
            continue
        key = m.group(1)
        branches = journal(path, consts)
        if not branches:
            print('  no journal stages:', key, os.path.relpath(path, root))
            continue
        varp = branches[0]['varp']
        # every script that sets the quest's variable (NPC scripts often live with their area)
        qfiles = [p for p in all_rs2 if p != path and ('%' + varp) in text_of(p)]
        # complete value: from send_quest_progress / the journal's last branch
        complete = None
        for p in all_rs2:
            with open(p, encoding='utf-8', errors='replace') as f:
                for mm in re.finditer(r'send_quest_progress\(questlist:' + key + r',\s*%' + varp + r',\s*\^(\w+)\)', f.read()):
                    complete = consts.get(mm.group(1), complete)
        if complete is None:
            complete = consts.get(next((k for k in consts if re.fullmatch(key + r'_(?:quest_)?complete(?:d)?', k)), ''), None)
        if complete is None:
            # a switch_int journal's "case ^<quest>_complete :" branch
            for b in branches:
                if any(re.fullmatch(r'\^\w+_complete(?:d)?', t) for t in b.get('case', [])):
                    complete = b['lo']
        quests[key] = {
            'name': names.get(key, key),
            'com': if_ids.get('questlist:' + key),
            'varp': varp,
            'complete': complete,
            'journal': [{'lo': b['lo'], 'hi': min(b['hi'], 10**6), 'texts': b['texts']} for b in branches],
            'dialogue': {t: n for t, n in transitions(qfiles, varp, consts).items() if said_in(t, all_rs2) <= set(qfiles)},
        }
    # Quests whose journal we couldn't read still show in the list (status from its colour).
    for key in sorted(buttons):
        if key not in quests and key in names and if_ids.get('questlist:' + key):
            quests[key] = {'name': names[key], 'com': if_ids.get('questlist:' + key), 'varp': None, 'complete': None, 'journal': [], 'dialogue': {}}
    data = {
        'list': if_ids.get('questlist'),
        'journal': {'root': if_ids.get('questjournal_scroll'), 'title': if_ids.get('questjournal_scroll:ifquestname'),
                    'lines': [if_ids.get('questjournal_scroll:qj%d' % i) for i in range(1, 101) if if_ids.get('questjournal_scroll:qj%d' % i)]},
        'quests': quests,
    }
    with open(out, 'w') as f:
        json.dump(data, f, indent=1, sort_keys=True)
    print(len(quests), 'quests;', sum(len(q['dialogue']) for q in quests.values()), 'dialogue lines; journal lines', len(data['journal']['lines']))
    for k, q in sorted(quests.items()):
        if q['complete'] is None:
            print('  no complete value:', k)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
