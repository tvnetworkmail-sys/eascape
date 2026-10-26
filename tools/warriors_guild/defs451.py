# Decoders for build-451 npc, obj and seq definitions (config archive 2, groups 9, 10, 12) and
# frames/bases (archives 0 and 1). Each returns a dict; 'unknown' lists an opcode it couldn't read
# (it stops there), so a bad guess at an opcode shows up instead of silently misreading.

class R:
    def __init__(s, d): s.d = d; s.p = 0
    def g1(s): v = s.d[s.p]; s.p += 1; return v
    def g1b(s): v = s.g1(); return v - 256 if v > 127 else v
    def g2(s): v = int.from_bytes(s.d[s.p:s.p + 2], 'big'); s.p += 2; return v
    def g2s(s): v = s.g2(); return v - 65536 if v > 32767 else v
    def g3(s): v = int.from_bytes(s.d[s.p:s.p + 3], 'big'); s.p += 3; return v
    def g4(s): v = int.from_bytes(s.d[s.p:s.p + 4], 'big', signed=True); s.p += 4; return v
    def str(s):
        e = s.d.index(0, s.p); v = s.d[s.p:e].decode('latin-1'); s.p = e + 1; return v
    def more(s): return s.p < len(s.d)

def params(r):
    n = r.g1(); out = {}
    for _ in range(n):
        isstr = r.g1(); k = r.g3()
        out[k] = r.str() if isstr else r.g4()
    return out

def decode_npc(d):
    r = R(d); o = {'ops': {}, 'recol': [], 'retex': [], 'unknown': None}
    while r.more():
        c = r.g1()
        if c == 0: break
        if c == 1: o['models'] = [r.g2() for _ in range(r.g1())]
        elif c == 2: o['name'] = r.str()
        elif c == 3: o['desc'] = r.str()
        elif c == 12: o['size'] = r.g1()
        elif c == 13: o['readyanim'] = r.g2()
        elif c == 14: o['walkanim'] = r.g2()
        elif c == 15: o['turnleftanim'] = r.g2()
        elif c == 16: o['turnrightanim'] = r.g2()
        elif c == 17: o['walkanim'] = r.g2(); o['walkanim_b'] = r.g2(); o['walkanim_r'] = r.g2(); o['walkanim_l'] = r.g2()
        elif 30 <= c < 35: o['ops'][c - 29] = r.str()
        elif c == 40: o['recol'] = [(r.g2(), r.g2()) for _ in range(r.g1())]
        elif c == 41: o['retex'] = [(r.g2(), r.g2()) for _ in range(r.g1())]
        elif c == 60: o['heads'] = [r.g2() for _ in range(r.g1())]
        elif c == 93: o['minimap'] = False
        elif c == 95: o['vislevel'] = r.g2()
        elif c == 97: o['resizeh'] = r.g2()
        elif c == 98: o['resizev'] = r.g2()
        elif c == 99: o['alwaysontop'] = True
        elif c == 100: o['ambient'] = r.g1b()
        elif c == 101: o['contrast'] = r.g1b()
        elif c == 102: o['headicon'] = r.g2()
        elif c == 103: o['turnspeed'] = r.g2()
        elif c == 106:
            vb = r.g2(); vp = r.g2(); n = r.g1(); o['multi'] = (vb, vp, [r.g2() for _ in range(n + 1)])
        elif c == 107: o['active'] = False
        elif c == 109: o['walksmoothing'] = False
        elif c == 111: o['shadow'] = False
        elif c == 113: o['shadowcol'] = (r.g2(), r.g2())
        elif c == 114: o['shadowmod'] = (r.g1b(), r.g1b())
        elif c == 119: o['walkmask'] = r.g1b()
        elif c == 121:
            n = r.g1(); o['modeloff'] = [(r.g1(), r.g1b(), r.g1b(), r.g1b()) for _ in range(n)]
        elif c == 122: o['respawn'] = r.g2()
        elif c == 123: o['height'] = r.g2()
        elif c == 249: o['params'] = params(r)
        else:
            o['unknown'] = c; break
    o['_end'] = r.p; o['_len'] = len(d)
    return o

def decode_obj(d):
    r = R(d); o = {'ops': {}, 'iops': {}, 'recol': [], 'retex': [], 'unknown': None}
    while r.more():
        c = r.g1()
        if c == 0: break
        if c == 1: o['model'] = r.g2()
        elif c == 2: o['name'] = r.str()
        elif c == 3: o['desc'] = r.str()
        elif c == 4: o['zoom2d'] = r.g2()
        elif c == 5: o['xan2d'] = r.g2()
        elif c == 6: o['yan2d'] = r.g2()
        elif c == 7: o['xof2d'] = r.g2s()
        elif c == 8: o['yof2d'] = r.g2s()
        elif c == 10: o['op10'] = r.g2()
        elif c == 11: o['stackable'] = True
        elif c == 12: o['cost'] = r.g4()
        elif c == 16: o['members'] = True
        elif c == 23: o['manwear'] = (r.g2(), r.g1b())
        elif c == 24: o['manwear2'] = r.g2()
        elif c == 25: o['womanwear'] = (r.g2(), r.g1b())
        elif c == 26: o['womanwear2'] = r.g2()
        elif 30 <= c < 35: o['ops'][c - 29] = r.str()
        elif 35 <= c < 40: o['iops'][c - 34] = r.str()
        elif c == 40: o['recol'] = [(r.g2(), r.g2()) for _ in range(r.g1())]
        elif c == 41: o['retex'] = [(r.g2(), r.g2()) for _ in range(r.g1())]
        elif c == 42: o['op42'] = r.g1b()
        elif c == 65: o['tradeable'] = True
        elif c == 78: o['manwear3'] = r.g2()
        elif c == 79: o['womanwear3'] = r.g2()
        elif c == 90: o['manhead'] = r.g2()
        elif c == 91: o['womanhead'] = r.g2()
        elif c == 92: o['manhead2'] = r.g2()
        elif c == 93: o['womanhead2'] = r.g2()
        elif c == 95: o['zan2d'] = r.g2()
        elif c == 96: o['dummy'] = r.g1()
        elif c == 97: o['certlink'] = r.g2()
        elif c == 98: o['certtemplate'] = r.g2()
        elif 100 <= c < 110: o.setdefault('countobj', []).append((c - 99, r.g2(), r.g2()))
        elif c == 110: o['resizex'] = r.g2()
        elif c == 111: o['resizey'] = r.g2()
        elif c == 112: o['resizez'] = r.g2()
        elif c == 113: o['ambient'] = r.g1b()
        elif c == 114: o['contrast'] = r.g1b()
        elif c == 115: o['team'] = r.g1()
        elif c == 121: o['lentlink'] = r.g2()
        elif c == 122: o['lenttemplate'] = r.g2()
        elif c == 249: o['params'] = params(r)
        else:
            o['unknown'] = c; break
    o['_end'] = r.p; o['_len'] = len(d)
    return o

def decode_seq(d):
    r = R(d); o = {'unknown': None}
    while r.more():
        c = r.g1()
        if c == 0: break
        if c == 1:
            n = r.g1()
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

def decode_base(d):
    r = R(d); n = r.g1()
    types = [r.g1() for _ in range(n)]
    labels = [[r.g1() for _ in range(r.g1())] for _ in range(n)]
    return {'types': types, 'labels': labels, '_end': r.p, '_len': len(d)}

def decode_frame(d):
    # base id, then one flag byte per transform group, then the signed-smart values
    r = R(d); base = r.g2(); n = r.g1()
    flags = [r.g1() for _ in range(n)]
    start = r.p
    for f in flags:
        for bit in (1, 2, 4):
            if f & bit:
                r.p += 1 if r.d[r.p] < 0x80 else 2
    return {'base': base, 'flags': flags, 'values': d[start:r.p], '_end': r.p, '_len': len(d)}
