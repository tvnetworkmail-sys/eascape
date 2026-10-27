# Fairytale II, step 2c: the code screen's dials turn as in 2007. The August 2007 cache has the
# turning animations (seqs 4290-4297, base 1002: an origin and a rotation of the toadstools'
# label 1): 4290-4293 turn a dial a quarter clockwise from 0, 90, 180 and 270 degrees, 4294-4297 a
# quarter anticlockwise back. They turn one layer of toadstools (each dial's A, I or P layer), so
# that layer stays shown and its angle says the letter.
# Our choices: the animations hold their last frame (loops=1: our server doesn't swap layers on a
# timer as 2007's did), and for the travel log two-quarter turns are the 2007 frames of two
# quarters one after the other (a three-quarter turn goes one quarter the other way).
# Usage: ring_dial_anim.py <cache468 flat dir>   (run once; README.md)
import os, sys, re
W = os.path.dirname(os.path.abspath(__file__)); E = os.path.abspath(W + '/../..')
sys.path.insert(0, W)
from port468 import Porter

pt = Porter(sys.argv[1], f'{E}/content/models/fairytale2')
names = {sid: pt.seq(sid) for sid in range(4290, 4298)}
frames = {}
for block in pt.seq_out:
    nm = re.match(r'\[([a-z0-9_]+)\]', block)[1]
    frames[nm] = re.findall(r'^(frame\d+=anim_\d+)\ndelay\d+=(\d+)', block, re.M)
out = []
for block in pt.seq_out:
    out.append(block + '\nloops=1')

def combo(name, parts):
    lines = [f'[{name}]']; k = 0
    for p in parts:
        for fr, dly in frames[names[p]]:
            k += 1
            lines.append(f"frame{k}={fr.split('=')[1]}"); lines.append(f'delay{k}={dly}')
    lines.append('loops=1')
    out.append('\n'.join(lines))
    pt.newid('seq', name)
for s in range(4):
    # two quarters clockwise from s quarters, and anticlockwise from s quarters
    combo(f'ft2_dial_cw2_{s}', [4290 + s, 4290 + (s + 1) % 4])
    combo(f'ft2_dial_acw2_{s}', [4294 + (s + 3) % 4, 4294 + (s + 2) % 4])

# a dial standing at 1, 2 or 3 quarters (0 is the layer as it is): the last frame of 4290-4292
for q in (1, 2, 3):
    fr, dly = frames[names[4289 + q]][-1]
    out.append(f"[ft2_dial_at_{q}]\nframe1={fr.split('=')[1]}\ndelay1=100\nloops=1")
    pt.newid('seq', f'ft2_dial_at_{q}')

hdr = ('// EASCape: the fairy ring dials turning, from the August 2007 cache (seqs 4290-4297), made by\n'
       '// tools/fairytale2/ring_dial_anim.py; ft2_dial_*2_<n> are two quarters from n quarters.\n\n')
open(f'{E}/content/scripts/areas/area_fairy_rings/configs/fairy_rings_dials.seq', 'w').write(hdr + '\n\n'.join(out) + '\n')
pt.save_packs()
print(names)
