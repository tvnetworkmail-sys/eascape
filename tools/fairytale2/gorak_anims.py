# Fairytale II, step 4 part 2: the Goraks' attack, defend and death animations from the August
# 2007 cache (seqs 4300, 4301, 4302: Void's gorak_attack/_defend/_death and 2009Scape's Gorak
# agree on the ids). Step 1 brought only their stand and walk.
# Usage: gorak_anims.py <cache468 flat dir>   (run once; README.md)
import os, sys
W = os.path.dirname(os.path.abspath(__file__)); E = os.path.abspath(W + '/../..')
sys.path.insert(0, W)
from port468 import Porter

pt = Porter(sys.argv[1], f'{E}/content/models/fairytale2')
names = {sid: pt.seq(sid) for sid in (4300, 4301, 4302)}
hdr = ('// EASCape: the Goraks\' attack (4300), defend (4301) and death (4302) animations from the\n'
       '// August 2007 cache, made by tools/fairytale2/gorak_anims.py\n\n')
open(f'{E}/content/scripts/quests/quest_fairy2/configs/fairy2_gorak.seq', 'w').write(hdr + '\n\n'.join(pt.seq_out) + '\n')
pt.save_packs()
print(names)
