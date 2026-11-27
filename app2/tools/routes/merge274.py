#!/usr/bin/env python3
# EASCape: the route data is built from our 377 content (build.js ../content <dir>); a few
# regions and ladders only the old 274 build had are kept from it.
# Usage: merge274.py <old collision.bin> <old transports.json> <new dir> <out dir>
import json, struct, sys, zlib

def load(f):
    r = zlib.decompress(open(f, 'rb').read()); n = struct.unpack('<H', r[4:6])[0]; o = 6; d = {}
    for _ in range(n):
        k = (r[o], r[o + 1]); d[k] = r[o + 2:o + 2 + 4 * 64 * 64 * 2]; o += 2 + 4 * 64 * 64 * 2
    return d

oc, ot, nd, out = sys.argv[1:5]
old = load(oc); new = load(nd + '/collision.bin')
for k, v in old.items():
    new.setdefault(k, v)
buf = bytearray(b'LLC1' + struct.pack('<H', len(new)))
for k in sorted(new, key=lambda k: (k[0] << 8) | k[1]):
    buf += bytes(k) + new[k]
open(out + '/collision.bin', 'wb').write(zlib.compress(bytes(buf), 9))
nt = json.load(open(nd + '/transports.json')); seen = {(t['x'], t['z'], t['level']) for t in nt}
nt += [t for t in json.load(open(ot)) if (t['x'], t['z'], t['level']) not in seen]
json.dump(nt, open(out + '/transports.json', 'w'), separators=(',', ':'))
print(len(new), 'regions,', len(nt), 'transports')
