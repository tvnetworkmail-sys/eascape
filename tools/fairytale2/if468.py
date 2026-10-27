# Decode the 2007 cache's old-style (if1) interface components: a port of RuneLite's cache
# InterfaceLoader.decodeIf1 (BSD 2-Clause, Copyright (c) 2016-2017 Adam and RuneLite
# contributors), before its rev237 change (models are 2 bytes).
import struct

class _In:
    def __init__(self, d): self.d = d; self.p = 0
    def g1(self): v = self.d[self.p]; self.p += 1; return v
    def g2(self): v = struct.unpack('>H', self.d[self.p:self.p + 2])[0]; self.p += 2; return v
    def g2s(self): v = struct.unpack('>h', self.d[self.p:self.p + 2])[0]; self.p += 2; return v
    def g4(self): v = struct.unpack('>i', self.d[self.p:self.p + 4])[0]; self.p += 4; return v
    def gstr(self):
        e = self.d.index(0, self.p); s = self.d[self.p:e].decode('latin-1'); self.p = e + 1; return s

def decode_if1(d):
    r = _In(d); o = {}
    o['type'] = r.g1(); o['menutype'] = r.g1(); o['contenttype'] = r.g2()
    o['x'] = r.g2s(); o['y'] = r.g2s(); o['width'] = r.g2(); o['height'] = r.g2()
    o['trans'] = r.g1()
    v = r.g2(); o['layer'] = None if v == 0xffff else v
    v = r.g2(); o['overlayer'] = None if v == 0xffff else v
    n = r.g1()
    o['comparators'] = [(r.g1(), r.g2()) for _ in range(n)]
    n = r.g1(); scripts = []
    for _ in range(n):
        ln = r.g2(); scripts.append([r.g2() for _ in range(ln)])
    o['scripts'] = scripts
    t = o['type']
    if t == 0:
        o['scroll'] = r.g2(); o['hide'] = r.g1() == 1
    if t == 1:
        r.g2(); r.g1()
    if t == 2:
        o['inv_flags'] = [r.g1() for _ in range(4)]
        o['marginx'] = r.g1(); o['marginy'] = r.g1()
        sl = []
        for _ in range(20):
            if r.g1() == 1: sl.append((r.g2s(), r.g2s(), r.g4()))
            else: sl.append(None)
        o['slots'] = sl
        o['iops'] = [r.gstr() for _ in range(5)]
    if t == 3:
        o['fill'] = r.g1() == 1
    if t in (4, 1):
        o['center'] = r.g1(); o['valign'] = r.g1(); o['lineheight'] = r.g1()
        v = r.g2(); o['font'] = None if v == 0xffff else v
        o['shadowed'] = r.g1() == 1
    if t == 4:
        o['text'] = r.gstr(); o['activetext'] = r.gstr()
    if t in (1, 3, 4):
        o['colour'] = r.g4()
    if t in (3, 4):
        o['activecolour'] = r.g4(); o['overcolour'] = r.g4(); o['activeovercolour'] = r.g4()
    if t == 5:
        o['graphic'] = r.g4(); o['activegraphic'] = r.g4()
    if t == 6:
        v = r.g2(); o['model'] = None if v == 0xffff else v
        v = r.g2(); o['activemodel'] = None if v == 0xffff else v
        v = r.g2(); o['anim'] = None if v == 0xffff else v
        v = r.g2(); o['activeanim'] = None if v == 0xffff else v
        o['zoom'] = r.g2(); o['xan'] = r.g2(); o['yan'] = r.g2()
    if t == 7:
        o['center'] = r.g1()
        v = r.g2(); o['font'] = None if v == 0xffff else v
        o['shadowed'] = r.g1() == 1; o['colour'] = r.g4()
        o['marginx'] = r.g2s(); o['marginy'] = r.g2s(); o['interactable'] = r.g1()
        o['iops'] = [r.gstr() for _ in range(5)]
    if t == 8:
        o['text'] = r.gstr()
    if o['menutype'] == 2 or t == 2:
        o['actionverb'] = r.gstr(); o['action'] = r.gstr(); o['actiontarget'] = r.g2() & 63
    if o['menutype'] in (1, 4, 5, 6):
        o['option'] = r.gstr()
    o['_left'] = len(d) - r.p
    return o
