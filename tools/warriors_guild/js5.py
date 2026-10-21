# Minimal JS5 disk cache reader (build ~451): idx/dat2 sectors, containers, reference tables,
# multi-file groups, XTEA.
import struct, zlib, bz2, gzip, io, os

class Cache:
    def __init__(self, path):
        self.dat = open(os.path.join(path, 'main_file_cache.dat2'), 'rb').read()
        self.idx = {}
        for f in os.listdir(path):
            if f.startswith('main_file_cache.idx'):
                self.idx[int(f[19:])] = open(os.path.join(path, f), 'rb').read()
        self.refs = {}

    def raw(self, archive, group):
        idx = self.idx[archive]
        if (group + 1) * 6 > len(idx):
            return None
        e = idx[group * 6:group * 6 + 6]
        size = int.from_bytes(e[0:3], 'big'); sector = int.from_bytes(e[3:6], 'big')
        if size == 0 or sector == 0:
            return None
        out = bytearray(); part = 0
        big = group > 0xFFFF
        while len(out) < size:
            off = sector * 520
            if big:
                nxt = int.from_bytes(self.dat[off + 6:off + 9], 'big'); hdr = 10
            else:
                nxt = int.from_bytes(self.dat[off + 4:off + 7], 'big'); hdr = 8
            n = min(520 - hdr, size - len(out))
            out += self.dat[off + hdr:off + hdr + n]
            sector = nxt; part += 1
        return bytes(out)

    @staticmethod
    def decompress(data, key=None):
        comp = data[0]; length = int.from_bytes(data[1:5], 'big')
        body = data[5:]
        if key and any(key):
            enc_len = length + (4 if comp else 0)
            body = xtea_decrypt(body[:enc_len], key) + body[enc_len:]
        if comp == 0:
            return body[:length]
        ulen = int.from_bytes(body[0:4], 'big')
        payload = body[4:4 + length]
        if comp == 1:
            return bz2.decompress(b'BZh1' + payload)
        return gzip.decompress(payload)

    def ref(self, archive):
        if archive in self.refs:
            return self.refs[archive]
        d = self.decompress(self.raw(255, archive))
        b = io.BytesIO(d)
        fmt = b.read(1)[0]
        if fmt >= 6:
            b.read(4)
        flags = b.read(1)[0]
        n = int.from_bytes(b.read(2), 'big')
        ids = []; acc = 0
        for _ in range(n):
            acc += int.from_bytes(b.read(2), 'big'); ids.append(acc)
        names = {}
        if flags & 1:
            for g in ids:
                names[g] = int.from_bytes(b.read(4), 'big', signed=True)
        b.read(4 * n)  # crc
        if flags & 4:
            b.read(64 * n)
        b.read(4 * n)  # version
        counts = [int.from_bytes(b.read(2), 'big') for _ in range(n)]
        files = {}
        for g, c in zip(ids, counts):
            acc = 0; fl = []
            for _ in range(c):
                acc += int.from_bytes(b.read(2), 'big'); fl.append(acc)
            files[g] = fl
        r = {'ids': ids, 'names': names, 'files': files}
        self.refs[archive] = r
        return r

    def group_by_name(self, archive, name):
        h = name_hash(name)
        r = self.ref(archive)
        for g, nh in r['names'].items():
            if nh == h:
                return g
        return None

    def files(self, archive, group, key=None):
        raw = self.raw(archive, group)
        if raw is None:
            return None
        d = self.decompress(raw, key)
        fl = self.ref(archive)['files'][group]
        if len(fl) == 1:
            return {fl[0]: d}
        chunks = d[-1]
        pos = len(d) - 1 - chunks * len(fl) * 4
        sizes = [[0] * len(fl) for _ in range(chunks)]
        p = pos
        for c in range(chunks):
            acc = 0
            for i in range(len(fl)):
                acc += int.from_bytes(d[p:p + 4], 'big', signed=True); p += 4
                sizes[c][i] = acc
        out = [bytearray() for _ in fl]
        off = 0
        for c in range(chunks):
            for i in range(len(fl)):
                out[i] += d[off:off + sizes[c][i]]; off += sizes[c][i]
        return {fid: bytes(out[i]) for i, fid in enumerate(fl)}

def name_hash(s):
    h = 0
    for ch in s.lower():
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return h - (1 << 32) if h >= (1 << 31) else h

def xtea_decrypt(data, key):
    out = bytearray(data)
    k = [x & 0xFFFFFFFF for x in key]
    for i in range(0, len(data) - len(data) % 8, 8):
        v0, v1 = struct.unpack('>II', data[i:i + 8])
        s = (0x9E3779B9 * 32) & 0xFFFFFFFF
        for _ in range(32):
            v1 = (v1 - ((((v0 << 4) ^ (v0 >> 5)) + v0) ^ (s + k[(s >> 11) & 3]))) & 0xFFFFFFFF
            s = (s - 0x9E3779B9) & 0xFFFFFFFF
            v0 = (v0 - ((((v1 << 4) ^ (v1 >> 5)) + v1) ^ (s + k[s & 3]))) & 0xFFFFFFFF
        out[i:i + 8] = struct.pack('>II', v0, v1)
    return bytes(out)
