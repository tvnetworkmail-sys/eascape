#!/bin/bash
# rerun merge and rebuild; prints first error
S=/tmp/claude-0/-home-claude/75994f91-c279-5580-8356-99c172c3a22d/scratchpad
python3 $S/merge274.py $S/mt $S/mt/pack377/pack > $S/merge.out || exit 1
cd /home/claude/eascape/content && rm -rf scripts && cp -r $S/mt/out/scripts scripts && rm -f  pack/category.pack pack/dbrow.pack pack/dbtable.pack pack/enum.pack pack/hunt.pack pack/mesanim.pack pack/param.pack pack/script.pack pack/struct.pack pack/varn.pack pack/vars.pack && cp /tmp/claude-0/-home-claude/75994f91-c279-5580-8356-99c172c3a22d/scratchpad/mt/pack377/pack/*.pack /tmp/claude-0/-home-claude/75994f91-c279-5580-8356-99c172c3a22d/scratchpad/mt/pack377/pack/*.order pack/ 2>/dev/null
[ -f $S/post.sh ] && bash $S/post.sh
cd ../engine && export PATH=$S/node24/bin:$PATH && timeout 900 npx tsx tools/pack/Build.ts > $S/build.log 2>&1
grep -v "^\s*$" $S/build.log | tail -${1:-8}
