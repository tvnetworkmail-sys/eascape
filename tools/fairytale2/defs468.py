# Build-468 differences from tools/warriors_guild/defs451.py: seq op 1's frame count is two bytes.
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'warriors_guild'))
from defs451 import R, decode_npc, decode_obj, params  # noqa: F401

def decode_seq(d):
    r = R(d); o = {'unknown': None}
    while r.more():
        c = r.g1()
        if c == 0: break
        if c == 1:
            n = r.g2()  # 468: a two-byte count (451: one byte)
            delays = [r.g2() for _ in range(n)]
            files = [r.g2() for _ in range(n)]
            groups = [r.g2() for _ in range(n)]
            o['delays'] = delays; o['frames'] = [(g << 16) | f for g, f in zip(groups, files)]
        elif c == 2: o['replayoff'] = r.g2()
        elif c == 3: o['walkmerge'] = [r.g1() for _ in range(r.g1())]
        elif c == 4: o['stretches'] = True
        elif c == 5: o['priority'] = r.g1()
        elif c == 6: o['righthand'] = r.g2()
        elif c == 7: o['lefthand'] = r.g2()
        elif c == 8: o['replaycount'] = r.g1()
        elif c == 9: o['preanim_move'] = r.g1()
        elif c == 10: o['postanim_move'] = r.g1()
        elif c == 11: o['replacemode'] = r.g1()
        elif c == 12:
            n = r.g1(); files = [r.g2() for _ in range(n)]; groups = [r.g2() for _ in range(n)]
            o['iframes'] = [(g << 16) | f for g, f in zip(groups, files)]
        elif c == 13:
            n = r.g1(); o['sounds'] = [r.g3() for _ in range(n)]
        elif c == 14: o['op14'] = True
        elif c == 15: o['op15'] = True
        elif c == 16: o['op16'] = True
        else:
            o['unknown'] = c; break
    o['_end'] = r.p; o['_len'] = len(d)
    return o

