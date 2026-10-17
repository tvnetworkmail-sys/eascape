#!/usr/bin/env python3
"""Builds the Clue Scroll Helper's clue list from Lost City's revision 274 content.

Every clue scroll is an obj (configs/trail_{easy,medium,hard}.obj) with params:
  trail_desc     the text on the scroll ("|" is a line break)
  trail_coord    where to dig or search (level_regionX_regionZ_localX_localZ)
  trail_loc      the coordinate is something to search, not a dig spot
  trail_sextant  a coordinate clue (needs sextant, watch and chart in game)
  trail_guardian the NPC that appears and must be killed first
Map clues open a trail_map interface and have a trail_coord. Clues without a coordinate are
solved by talking to an NPC or searching something; those are found by following the server
scripts that check for the clue (inv_total(inv, <clue>)) back to their trigger
([opnpc1,<npc>] / [oploc1,<loc>]) and any loc_coord test just before.

Usage: extract.py <Content checkout (274)> <out.json>
"""
import json
import os
import re
import sys

COORD = re.compile(r'\b(\d)_(\d+)_(\d+)_(\d+)_(\d+)\b')


def coord(text):
    m = COORD.search(text or '')
    if not m:
        return None
    lv, rx, rz, lx, lz = (int(v) for v in m.groups())
    return {'level': lv, 'x': rx * 64 + lx, 'z': rz * 64 + lz}


def read_pack(path):
    ids = {}
    with open(path) as f:
        for line in f:
            m = re.match(r'(\d+)=(\S+)', line.strip())
            if m:
                ids[m.group(2)] = int(m.group(1))
    return ids


def read_configs(root, ext):
    out = {}
    for dirpath, _, files in os.walk(os.path.join(root, 'scripts')):
        for fn in files:
            if not fn.endswith(ext):
                continue
            cur = None
            with open(os.path.join(dirpath, fn), encoding='utf-8', errors='replace') as f:
                for line in f:
                    line = line.rstrip('\n')
                    s = line.strip()
                    if s.startswith('[') and s.endswith(']'):
                        cur = out.setdefault(s[1:-1], {'params': {}})
                    elif cur is not None and '=' in s and not s.startswith('//'):
                        k, v = s.split('=', 1)
                        if k == 'param':
                            pk, pv = v.split(',', 1)
                            cur['params'][pk] = pv
                        else:
                            cur.setdefault(k, v)
    return out


def npc_spawns(root, npc_ids):
    """npc id -> [{level, x, z}] from the maps' NPC sections."""
    spawns = {}
    mapdir = os.path.join(root, 'maps')
    for fn in os.listdir(mapdir):
        m = re.match(r'm(\d+)_(\d+)\.jm2$', fn)
        if not m:
            continue
        rx, rz = int(m.group(1)), int(m.group(2))
        section = None
        with open(os.path.join(mapdir, fn)) as f:
            for line in f:
                line = line.strip()
                if line.startswith('===='):
                    section = line.strip('= ').upper()
                    continue
                if section != 'NPC' or ':' not in line:
                    continue
                head, rest = line.split(':', 1)
                lv, lx, lz = (int(v) for v in head.split())
                nid = int(rest.split()[0])
                spawns.setdefault(nid, []).append({'level': lv, 'x': rx * 64 + lx, 'z': rz * 64 + lz})
    return spawns


def load_scripts(root):
    files = []
    for dirpath, _, fns in os.walk(os.path.join(root, 'scripts')):
        if '_test' in dirpath:
            continue
        for fn in fns:
            if fn.endswith('.rs2'):
                with open(os.path.join(dirpath, fn), encoding='utf-8', errors='replace') as f:
                    files.append((os.path.join(dirpath, fn), f.read().split('\n')))
    return files


TRIGGER = re.compile(r'^\[(\w+),([\w:]+)\]')


def trigger_at(lines, i):
    for k in range(i, -1, -1):
        m = TRIGGER.match(lines[k])
        if m:
            return m.group(1), m.group(2), k
    return None, None, 0


def sites(files, needle):
    """Lines that use a name, with their trigger and the nearest loc coordinate above."""
    pat = re.compile(r'\b' + re.escape(needle) + r'\b')
    out = []
    for path, lines in files:
        for i, line in enumerate(lines):
            if not pat.search(line) or TRIGGER.match(line):
                continue
            kind, name, start = trigger_at(lines, i)
            c = None
            for k in range(i, max(start, i - 8) - 1, -1):
                if 'coord' in lines[k] or 'case ' in lines[k]:
                    c = coord(lines[k])
                    if c:
                        break
            out.append({'path': path, 'line': i, 'trigger': kind, 'name': name, 'coord': c})
    return out


def main(root, out):
    obj_ids = read_pack(os.path.join(root, 'pack', 'obj.pack'))
    npc_ids = read_pack(os.path.join(root, 'pack', 'npc.pack'))
    objs = read_configs(root, '.obj')
    npcs = read_configs(root, '.npc')
    locs = read_configs(root, '.loc')
    spawns = npc_spawns(root, npc_ids)
    files = load_scripts(root)
    trail_dir = os.path.join(root, 'scripts', 'minigames', 'game_trail')

    # Labels in the trail scripts that hand out the next clue for one clue:
    # [label,riddle_loc_easy_exp008] ... @trail_clue_easy_loc_interact(trail_clue_easy_vague003)
    label_of = {}
    for path, lines in files:
        if not path.startswith(trail_dir):
            continue
        current = None
        for line in lines:
            m = TRIGGER.match(line)
            if m:
                current = m.group(2) if m.group(1) == 'label' else None
                continue
            if current:
                for c in re.findall(r'\b(trail_clue_(?:easy|medium|hard)_\w+?\d+)\b', line):
                    label_of.setdefault(c, set()).add(current)

    def category_npcs(cat):
        return [n for n, d in npcs.items() if d.get('category') == cat]

    def display_npc(name):
        if name.startswith('_'):
            members = category_npcs(name[1:])
            if members:
                return display_npc(members[0])
        d = npcs.get(name, {})
        return d.get('name', name.replace('_', ' ').capitalize())

    def display_loc(name):
        d = locs.get(name, {})
        return d.get('name', name.lstrip('_').replace('_', ' ').capitalize())

    clues = {}
    for name, d in objs.items():
        cat = d.get('category', '')
        m = re.match(r'trail_clue_(easy|medium|hard)$', cat)
        if name not in obj_ids:
            continue
        if m:
            tier = m.group(1)
        elif cat in ('trail_challenge', 'trail_puzzle'):
            t = re.search(r'_(easy|medium|hard)_', name)
            tier = t.group(1) if t else 'medium'
        else:
            continue
        p = d['params']
        e = {'name': name, 'tier': tier}
        if 'trail_desc' in p:
            t = re.sub(r'@[a-z0-9]{3}@', '', p['trail_desc'])  # colour tags on the scroll
            e['text'] = re.sub(r'\s+', ' ', t.replace('-|', '-').replace('|', ' ')).strip()
        c = coord(p.get('trail_coord'))
        if p.get('trail_challenge_answer'):
            e['kind'] = 'challenge'
            e['answer'] = int(p['trail_challenge_answer'])
        elif cat == 'trail_puzzle':
            e['kind'] = 'puzzle'
        if c:
            e.update(c)
            if 'kind' not in e:
                if 'degree' in e.get('text', '').lower():
                    e['kind'] = 'coordinate'
                elif '_map' in name:
                    e['kind'] = 'map'
                    e['action'] = 'search' if p.get('trail_loc') in ('^true', 'true') else 'dig'
                elif p.get('trail_loc') in ('^true', 'true'):
                    e['kind'] = 'search'
                else:
                    e['kind'] = 'dig'
        if 'trail_guardian' in p:
            e['guardian'] = display_npc(p['trail_guardian'])
        if 'kind' not in e or e['kind'] in ('challenge', 'puzzle'):
            # Follow the scripts: who checks for this clue?
            found = [s for s in sites(files, name) if not s['path'].startswith(trail_dir)]
            for lab in label_of.get(name, ()):
                found += [s for s in sites(files, '@' + lab if False else lab) if not s['path'].startswith(trail_dir)]
            npc = next((s for s in found if s['trigger'] and s['trigger'].startswith('opnpc')), None)
            loc = next((s for s in found if s['trigger'] and s['trigger'].startswith('oploc')), None)
            if npc and 'kind' not in e:
                e['kind'] = 'npc'
                nm = npc['name']
                e['npc'] = display_npc(nm)
                names = category_npcs(nm[1:]) if nm.startswith('_') else [nm]
                e['npcIds'] = [npc_ids[n] for n in names if n in npc_ids]
                e['spawns'] = [sp for n in names for sp in spawns.get(npc_ids.get(n), [])][:24]
            elif npc:
                nm = npc['name']
                e['npc'] = display_npc(nm)
                names = category_npcs(nm[1:]) if nm.startswith('_') else [nm]
                e['npcIds'] = [npc_ids[n] for n in names if n in npc_ids]
                e['spawns'] = [sp for n in names for sp in spawns.get(npc_ids.get(n), [])][:24]
            elif loc and 'kind' not in e:
                e['kind'] = 'search'
                e['object'] = display_loc(loc['name'])
                if loc['coord']:
                    e.update(loc['coord'])
        if 'kind' not in e:
            e['kind'] = 'unknown'
        clues[obj_ids[name]] = e

    # Keys: some search clues are locked until you kill an NPC that drops the key while you
    # carry the clue: "if (npc_type = ardougne_guard & inv_total(inv, <clue>) > 0 &
    # ~obj_gettotal(<clue>_key) = 0) obj_add(npc_coord, <clue>_key, ...)"
    KEY = re.compile(r'(?:npc_type = (\w+)|npc_category = (\w+)|compare\(npc_name, "([^"]+)"\) = 0) & inv_total\(inv, (trail_clue_\w+)\) > 0 & ~obj_gettotal\((\w+)\) = 0')
    for path, lines in files:
        if not path.startswith(trail_dir):
            continue
        for line in lines:
            km = KEY.search(line)
            if not km:
                continue
            ntype, ncat, nname, clue, key = km.groups()
            cid = obj_ids.get(clue)
            if cid is None or cid not in clues:
                continue
            if ntype:
                who, names = display_npc(ntype), [ntype]
            elif ncat:
                names = category_npcs(ncat)
                who = 'any ' + (display_npc(names[0]) if names else ncat.replace('_', ' ')).lower()
            else:
                names = [n for n, d in npcs.items() if d.get('name') == nname]
                who = 'any ' + nname.lower()
            clues[cid]["key"] = {'from': who, 'id': obj_ids.get(key), 'npcIds': [npc_ids[n] for n in names if n in npc_ids][:40]}

    # Sliding puzzle pieces: trail_slidingpuzzle<b|c|d><01..24>; piece N belongs in slot N-1
    # (the gap ends in slot 24). The puzzle is the trail_puzzle interface's 5x5 inventory.
    pieces = {}
    for name, oid in obj_ids.items():
        pm = re.match(r'trail_slidingpuzzle([a-z])(\d\d)$', name)
        if pm:
            pieces[oid] = int(pm.group(2)) - 1
    if_ids = read_pack(os.path.join(root, 'pack', 'interface.pack'))
    puzzle = {'pieces': pieces, 'root': if_ids.get('trail_puzzle'), 'inv': if_ids.get('trail_puzzle:com_2')}
    with open(out, 'w') as f:
        json.dump(clues, f, indent=1, sort_keys=True)
    with open(os.path.join(os.path.dirname(out), 'puzzle.json'), 'w') as f:
        json.dump(puzzle, f)
    print('puzzle pieces', len(pieces), puzzle['root'], puzzle['inv'])
    from collections import Counter
    print(len(clues), Counter(e['kind'] for e in clues.values()), Counter(e['tier'] for e in clues.values()))
    for e in clues.values():
        if e['kind'] == 'unknown' or (e['kind'] in ('search', 'npc') and 'x' not in e and not e.get('spawns')):
            print('  unresolved', e['name'], e.get('text', '')[:70])


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
