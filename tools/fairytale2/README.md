# Fairytale II content from the 2007 cache

Fairytale II - Cure a Queen's people, items, models, animations and music are ported from the
2007 cache (build 468, from archive.openrs2.org) into our 377 content, with the Warriors' Guild
pipeline (`tools/warriors_guild/js5.py`, `defs451.py`) underneath.

- `cache468.py` reads a flat cache export (`<root>/<archive>/<group>.dat`).
- `defs468.py` is defs451 with the one 468 difference we hit: a seq's frame count is 2 bytes.
- `convert_content.py <cache468 dir>` ports NPCs 4418-4459 and objs 9016-9025 with their models,
  animations, frames, animsets and bases, and writes
  `content/scripts/quests/quest_fairy2/configs/fairy2.{npc,obj,seq}` and the pack ids. Recolours go
  from 468 HSL to our RGB15 the Warriors' Guild way. Held items: 0 hides the hand, 512+ is an obj,
  anything else is left out. A name used twice gets its 468 id (`ft2_fairy_4443`).
- `convert_music.py <cache468 dir>` converts the three Fairytale II tracks to .mid in
  `content/songs` (midi.pack 647-649). `track2midi.py` is a port of RuneLite's TrackLoader; checked
  against our own "7th Realm".

Run with `python3 -I`. `names.pkl` is the converter's own record of the names it gave, kept for the
next steps and not committed.
