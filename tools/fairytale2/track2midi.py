# Jagex's packed song format (cache archive 6) to a standard MIDI file: a straight port of
# RuneLite's cache TrackLoader (BSD 2-Clause, Copyright (c) 2017 Adam and RuneLite contributors).
# Checked by converting the 2007 cache's "7th realm" and comparing it with our own copy.

def _s8(b):
    return b - 256 if b > 127 else b

class _In:
    def __init__(self, d): self.d = d; self.p = 0
    def u8(self): v = self.d[self.p]; self.p += 1; return v
    def u16(self): v = (self.d[self.p] << 8) | self.d[self.p + 1]; self.p += 2; return v
    def var(self):
        v = _s8(self.u8()); acc = 0
        while v < 0:
            acc = (acc | (v & 127)) << 7
            v = _s8(self.u8())
        return acc | v

def convert(b):
    a = _In(b)
    a.p = len(b) - 3
    tracks = a.u8(); division = a.u16()
    a.p = 0
    tempo = ctrl = non = noff = wheel = chanp = keyp = prog = 0
    for _ in range(tracks):
        while True:
            st = a.u8(); op = st & 15
            if st == 7: break
            if st == 23: tempo += 1
            elif op == 0: non += 1
            elif op == 1: noff += 1
            elif op == 2: ctrl += 1
            elif op == 3: wheel += 1
            elif op == 4: chanp += 1
            elif op == 5: keyp += 1
            elif op == 6: prog += 1
            else: raise ValueError('bad status')
    var13 = a.p
    n = tracks + tempo + ctrl + non + noff + wheel + chanp + keyp + prog
    for _ in range(n): a.var()
    ctrlIdx = a.p
    sizes = dict(mod=0, mod2=0, vol=0, vol2=0, pan=0, pan2=0, nrmsb=0, nrlsb=0, rmsb=0, rlsb=0, cmd=0, other=0)
    cn = 0
    for _ in range(ctrl):
        cn = (cn + a.u8()) & 127
        if cn in (0, 32): prog += 1
        elif cn == 1: sizes['mod'] += 1
        elif cn == 33: sizes['mod2'] += 1
        elif cn == 7: sizes['vol'] += 1
        elif cn == 39: sizes['vol2'] += 1
        elif cn == 10: sizes['pan'] += 1
        elif cn == 42: sizes['pan2'] += 1
        elif cn == 99: sizes['nrmsb'] += 1
        elif cn == 98: sizes['nrlsb'] += 1
        elif cn == 101: sizes['rmsb'] += 1
        elif cn == 100: sizes['rlsb'] += 1
        elif cn not in (64, 65, 120, 121, 123): sizes['other'] += 1
        else: sizes['cmd'] += 1
    o = {}
    def mark(k, size): o[k] = a.p; a.p += size
    mark('cmd', sizes['cmd']); mark('poly', keyp); mark('chanp', chanp); mark('wheelhi', wheel)
    mark('mod', sizes['mod']); mark('vol', sizes['vol']); mark('pan', sizes['pan'])
    mark('notes', non + noff + keyp); mark('noteson', non); mark('other', sizes['other'])
    mark('notesoff', noff); mark('mod2', sizes['mod2']); mark('vol2', sizes['vol2'])
    mark('pan2', sizes['pan2']); mark('prog', prog); mark('wheello', wheel)
    mark('nrmsb', sizes['nrmsb']); mark('nrlsb', sizes['nrlsb']); mark('rmsb', sizes['rmsb'])
    mark('rlsb', sizes['rlsb']); mark('tempo', tempo * 3)
    out = bytearray()
    def w8(v): out.append(v & 255)
    def w16(v): out.extend(((v >> 8) & 255, v & 255))
    def w32(v): out.extend(((v >> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255))
    def wvar(v):
        bs = [v & 127]; v >>= 7
        while v: bs.append((v & 127) | 128); v >>= 7
        out.extend(reversed(bs))
    def take(k):
        v = _s8(b[o[k]]); o[k] += 1; return v
    w32(1297377380); w32(6); w16(1 if tracks > 1 else 0); w16(tracks); w16(division)
    a.p = var13
    stp = 0
    channel = note = vel_on = vel_off = wheelv = cp = kp = 0
    last = [0] * 128
    cn = 0
    for _ in range(tracks):
        w32(1297379947); lenpos = len(out); w32(0); start = len(out)
        prev = -1
        while True:
            wvar(a.var())
            st = b[stp]; stp += 1
            new = st != prev; prev = st & 15
            if st == 7:
                w8(255); w8(47); w8(0)
                L = len(out) - start
                out[lenpos:lenpos + 4] = bytes(((L >> 24) & 255, (L >> 16) & 255, (L >> 8) & 255, L & 255))
                break
            if st == 23:
                w8(255); w8(81); w8(3)
                for _ in range(3):
                    w8(b[o['tempo']]); o['tempo'] += 1
                continue
            channel ^= st >> 4
            op = prev
            if op == 0:
                if new: w8(0x90 + channel)
                note += take('notes'); vel_on += take('noteson'); w8(note & 127); w8(vel_on & 127)
            elif op == 1:
                if new: w8(0x80 + channel)
                note += take('notes'); vel_off += take('notesoff'); w8(note & 127); w8(vel_off & 127)
            elif op == 2:
                if new: w8(0xB0 + channel)
                cn = (cn + b[ctrlIdx]) & 127; ctrlIdx += 1
                w8(cn)
                k = {0: 'prog', 32: 'prog', 1: 'mod', 33: 'mod2', 7: 'vol', 39: 'vol2', 10: 'pan', 42: 'pan2',
                     99: 'nrmsb', 98: 'nrlsb', 101: 'rmsb', 100: 'rlsb'}.get(cn)
                if k is None:
                    k = 'cmd' if cn in (64, 65, 120, 121, 123) else 'other'
                v = take(k) + last[cn]; last[cn] = v
                w8(v & 127)
            elif op == 3:
                if new: w8(0xE0 + channel)
                wheelv += take('wheello'); wheelv += take('wheelhi') << 7
                w8(wheelv & 127); w8((wheelv >> 7) & 127)
            elif op == 4:
                if new: w8(0xD0 + channel)
                cp += take('chanp'); w8(cp & 127)
            elif op == 5:
                if new: w8(0xA0 + channel)
                note += take('notes'); kp += take('poly'); w8(note & 127); w8(kp & 127)
            elif op == 6:
                if new: w8(0xC0 + channel)
                w8(take('prog'))
            else:
                raise ValueError('bad op')
    return bytes(out)
