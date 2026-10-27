# Read a 377 jag archive (our built data/pack/client/config etc.)
import bz2

def _g3(d, p): return int.from_bytes(d[p:p + 3], 'big')
def _bz(b): return bz2.decompress(b'BZh1' + b)

def jag_hash(name):
    h = 0
    for ch in name.upper():
        h = (h * 61 + ord(ch) - 32) & 0xffffffff
    return h - (1 << 32) if h >= 1 << 31 else h

def read_jag(path):
    d = open(path, 'rb').read()
    usize, csize = _g3(d, 0), _g3(d, 3)
    whole = usize != csize
    body = _bz(d[6:6 + csize]) if whole else d[6:]
    n = int.from_bytes(body[0:2], 'big'); p = 2
    off = 2 + n * 10
    files = {}
    for _ in range(n):
        h = int.from_bytes(body[p:p + 4], 'big', signed=True); fu = _g3(body, p + 4); fc = _g3(body, p + 7); p += 10
        raw = body[off:off + fc]; off += fc
        files[h] = raw if whole else _bz(raw)
    return files

def jag_file(files, name):
    return files.get(jag_hash(name))
