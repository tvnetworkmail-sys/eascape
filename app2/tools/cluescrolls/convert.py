import os
"""RuneLite clue lists -> JSON-able python (with markers), for compare.py / gen.py."""
import sys, json, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jparse import *

ENUMS = {'Emote', 'STASHUnit', 'Enemy'}


def val(e, sc):
    k = e[0]
    if k in ('str', 'num'):
        return e[1]
    if k == 'lit':
        return {'true': True, 'false': False, 'null': None}[e[1]]
    if k == 'field' and e[1][0] == 'name':
        base, n = e[1][1], e[2]
        if base == 'ItemID':
            return ITEM[n]
        if base == 'ObjectID':
            return OBJ[n]
        if base == 'NpcID':
            return NPC[n]
        if base == 'EquipmentInventorySlot':
            return {'slot': n}
        if base == 'VarbitID':
            return {'varbit': n}
        if base in ENUMS:
            return {'ref': base + '.' + n}
        return {'code': base + '.' + n}
    if k == 'new' and e[1] == 'WorldPoint':
        return {'wp': [val(a, sc) for a in e[2]]}
    if k == 'new':
        return {'new': e[1], 'args': [val(a, sc) for a in e[2]]}
    if k == 'name':
        n = e[1]
        if n in sc:
            return sc[n]
        if n in EMOTES:
            return {'ref': 'Emote.' + n}
        if n in STASH:
            return {'ref': 'STASHUnit.' + n}
        if n in ENEMIES:
            return {'ref': 'Enemy.' + n}
        return {'ref': n}
    if k == 'fn':
        return {'fn': e[1], 'args': [val(a, sc) for a in e[2]]}
    if k == 'call':
        # builder chain?
        chain = []
        x = e
        while x[0] == 'call':
            chain.append((x[2], x[3]))
            x = x[1]
        chain.reverse()
        if x[0] == 'name' and chain and chain[0][0] == 'builder':
            obj = {'cls': x[1]}
            for m, a in chain[1:]:
                if m == 'build':
                    continue
                v = val(a[0], sc) if len(a) == 1 else [val(y, sc) for y in a]
                if m == 'npcRegion':
                    obj.setdefault('npcRegions', []).append(v)
                else:
                    obj[m] = v
            return obj
        if x[0] == 'name' and x[1] in ('Set', 'List', 'ImmutableSet', 'ImmutableList') and chain[0][0] == 'of':
            return [val(a, sc) for a in chain[0][1]]
        return {'code': repr(e)[:200]}
    if k == 'ref':
        return {'code': (e[1][1] if e[1][0] == 'name' else '?') + '::' + e[2]}
    if k == 'lambda':
        return {'code': e[1]}
    if k == 'bin' and e[1] == '+':
        a, b = val(e[2], sc), val(e[3], sc)
        if isinstance(a, str) and isinstance(b, str):
            return a + b
        return {'concat': [a, b]}
    return {'code': repr(e)[:200]}


def enum_names(path):
    src = open(path).read()
    body = src[src.index('{', src.index(' enum ')) + 1:]
    return set(re.findall(r'^\t([A-Z][A-Z0-9_]+)\(', body, re.M))


EMOTES = enum_names(CL + 'emote/Emote.java')
STASH = enum_names(CL + 'emote/STASHUnit.java')
ENEMIES = enum_names(CL + 'Enemy.java')


def load(cls, pat=None):
    path = CL + cls + '.java'
    src = open(path).read()
    if pat is None:
        m = re.search(r'CLUES = (?:ImmutableList\.of|List\.of)\(', src)
        pat = m.group(0)
    lst, src = list_of(path, pat)
    sc = strconsts(src)
    # static item-requirement constants (EmoteClue's ANY_*), WorldPoint constants
    out = [val(e, sc) for e in lst]
    return out


if __name__ == '__main__':
    for c in ['CrypticClue', 'AnagramClue', 'CipherClue', 'CoordinateClue', 'MapClue', 'EmoteClue', 'FairyRingClue']:
        try:
            d = load(c)
            print(c, len(d))
        except Exception as ex:
            print(c, 'ERR', repr(ex)[:300])
