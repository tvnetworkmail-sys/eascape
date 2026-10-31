# The August 2007 cache's IF3 interface components (build 468: no size/position modes yet).
# decode_if3(bytes) -> dict with the common fields and the type's own; the rest (name, ops,
# listeners) isn't read.
import struct

class R:
    def __init__(s, d): s.d = d; s.p = 0
    def g1(s): v = s.d[s.p]; s.p += 1; return v
    def g1s(s): v = struct.unpack('>b', s.d[s.p:s.p + 1])[0]; s.p += 1; return v
    def g2(s): v = struct.unpack('>H', s.d[s.p:s.p + 2])[0]; s.p += 2; return v
    def g2s(s): v = struct.unpack('>h', s.d[s.p:s.p + 2])[0]; s.p += 2; return v
    def g4(s): v = struct.unpack('>i', s.d[s.p:s.p + 4])[0]; s.p += 4; return v
    def gs(s):
        e = s.d.index(0, s.p); v = s.d[s.p:e].decode('latin-1'); s.p = e + 1; return v

def decode_if3(d):
    r = R(d)
    assert r.g1() == 255
    o = {'type': r.g1(), 'content': r.g2(), 'x': r.g2s(), 'y': r.g2s(), 'w': r.g2()}
    o['h'] = r.g2s() if o['type'] == 9 else r.g2()
    p = r.g2(); o['parent'] = None if p == 65535 else p
    o['hidden'] = r.g1() == 1
    t = o['type']
    if t == 0:
        o['scrollw'] = r.g2(); o['scrollh'] = r.g2(); o['noclick'] = r.g1() == 1
    elif t == 5:
        o['sprite'] = r.g4(); o['texture'] = r.g2(); o['tiling'] = r.g1() == 1; o['alpha'] = r.g1()
        o['border'] = r.g1(); o['shadow'] = r.g4(); o['vflip'] = r.g1() == 1; o['hflip'] = r.g1() == 1
    elif t == 4:
        o['font'] = r.g2(); o['text'] = r.gs(); o['lineh'] = r.g1(); o['xalign'] = r.g1()
        o['yalign'] = r.g1(); o['shadowed'] = r.g1() == 1; o['colour'] = r.g4()
    elif t == 3:
        o['colour'] = r.g4(); o['filled'] = r.g1() == 1; o['alpha'] = r.g1()
    elif t == 6:
        o['model'] = r.g2()
    return o
