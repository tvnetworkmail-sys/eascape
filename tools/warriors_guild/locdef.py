# Decode build-451 loc definitions (config archive 2, group 6).
import struct

def gstr(d, p):
    e = d.index(0, p)
    return d[p:e].decode('latin-1'), e + 1

def decode_loc(d):
    p = 0; o = {'ops': {}, 'recol': [], 'retex': [], 'models': [], 'unknown': []}
    def g1():
        nonlocal p; v = d[p]; p += 1; return v
    def g1b():
        v = g1(); return v - 256 if v > 127 else v
    def g2():
        nonlocal p; v = int.from_bytes(d[p:p + 2], 'big'); p += 2; return v
    def g2s():
        v = g2(); return v - 65536 if v > 32767 else v
    def g4():
        nonlocal p; v = int.from_bytes(d[p:p + 4], 'big'); p += 4; return v
    while p < len(d):
        c = g1()
        if c == 0:
            break
        if c == 1:
            n = g1(); o['models'] = [(g2(), g1()) for _ in range(n)]
        elif c == 2:
            o['name'], p = gstr(d, p)
        elif c == 3:
            o['desc'], p = gstr(d, p)
        elif c == 5:
            n = g1(); o['models'] = [(g2(), 10) for _ in range(n)]
        elif c == 14: o['width'] = g1()
        elif c == 15: o['length'] = g1()
        elif c == 17: o['blockwalk'] = False; o['blockrange'] = False
        elif c == 18: o['blockrange'] = False
        elif c == 19: o['active'] = g1()
        elif c == 21: o['hillskew'] = True
        elif c == 22: o['sharelight'] = True
        elif c == 23: o['occlude'] = True
        elif c == 24:
            v = g2(); o['anim'] = None if v == 65535 else v
        elif c == 25: o['hasalpha'] = True
        elif c == 27: o['blockwalk1'] = True
        elif c == 28: o['wallwidth'] = g1()
        elif c == 29: o['ambient'] = g1b()
        elif c == 39: o['contrast'] = g1b()
        elif 30 <= c < 35:
            s, p = gstr(d, p); o['ops'][c - 29] = s
        elif c == 40:
            n = g1(); o['recol'] = [(g2(), g2()) for _ in range(n)]
        elif c == 41:
            n = g1(); o['retex'] = [(g2(), g2()) for _ in range(n)]
        elif c == 60: o['mapfunction'] = g2()
        elif c == 62: o['mirror'] = True
        elif c == 64: o['shadow'] = False
        elif c == 65: o['resizex'] = g2()
        elif c == 66: o['resizey'] = g2()
        elif c == 67: o['resizez'] = g2()
        elif c == 68: o['mapscene'] = g2()
        elif c == 69: o['forceapproach'] = g1()
        elif c == 70: o['offsetx'] = g2s()
        elif c == 71: o['offsety'] = g2s()
        elif c == 72: o['offsetz'] = g2s()
        elif c == 73: o['forcedecor'] = True
        elif c == 74: o['breakroutefinding'] = True
        elif c == 75: o['raiseobject'] = g1()
        elif c == 77:
            vb = g2(); vp = g2(); n = g1()
            o['multi'] = (vb, vp, [g2() for _ in range(n + 1)])
        elif c == 78:
            o['bgsound'] = (g2(), g1())
        elif c == 79:
            a = g2(); b = g2(); cc = g1(); n = g1(); o['randsound'] = (a, b, cc, [g2() for _ in range(n)])
        elif c == 81:
            o['hillskew_amount'] = g1()
        elif c == 82:
            o['mapicon'] = g2()
        elif c == 249:
            n = g1(); prm = {}
            for _ in range(n):
                isstr = g1(); k = int.from_bytes(d[p:p + 3], 'big'); p += 3
                if isstr:
                    v, p = gstr(d, p)
                else:
                    v = g4()
                prm[k] = v
            o['params'] = prm
        else:
            o['unknown'].append(c)
            break
    o['_end'] = p; o['_len'] = len(d)
    return o
