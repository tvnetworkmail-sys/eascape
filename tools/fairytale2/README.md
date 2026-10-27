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

## Step 2: the places the rings lead to, and the rings

- `maps468.py` reads the 2007 map squares (terrain plain, locs with the OpenRS2 XTEA keys); `jag.py`
  reads our built 377 config archive, so the converter can compare 2007 configs with ours.
- `port468.py` is the shared porting (new ids after ours, colours, animations), reusing the names
  step 1 gave (`names.pkl`).
- `convert_maps.py <cache468 dir> <keys.json> <void data dir>` adds the five map squares our 2006
  map lacks (36_69 the Fairy Resistance hideout, 32_75 the cosmic entity's plane, 47_83 Gorak's
  plane, 47_70 the Enchanted Valley, 47_76 the Abyssal area) and puts every 2007 fairy ring on the
  squares we have the way 2007 has it (the header of the script says exactly what changes). New
  locs are in `content/scripts/areas/area_fairy_rings`, their models in
  `content/models/loc/fairytale2`. Spawns are Void's. Left out: loc sounds (no 377 equivalent),
  the Enchanted Valley's fishing spot and General Gromblod (after 2007), the Dream World above
  the cosmic plane (Lunar Diplomacy's), and the rings on Lunar Isle and south of Dorgesh-Kaan
  (squares we don't have).
- `convert_music.py` also brought over On the Wing, the Enchanted Valley's music.

## Step 2b: the ring network

Run after `convert_maps.py`, once each:
- `ring_ops.py` gives the rings the OSRS right-click options (Zanaris, Configure,
  Last-destination; Configure and Last-destination on the Zanaris ring) and examines.
- `ring_interface.py <cache468 dir>` makes the code screen from the 2007 interface 426
  (`area_fairy_rings/interfaces/fairyrings.if`) with its models.
- `ring_log_interface.py` makes the travel log side panel (ours, laid out like the OSRS one: 2007
  has none) on the side panel's stone, with our heart sprite (`content/sprites/eascape_hearts`);
  it breaks each place's name into the log's lines, measured in the p12 font (`fontwidth.py`),
  and writes them to `fairy_rings.dbrow`, with the row enums and buttons. Re-run after changing a
  code's name.
- `ring_dial_anim.py <cache468 dir>` brings over the 2007 dial-turning animations (seqs
  4290-4297) and makes the two-quarter turns and still positions from their frames.

The network itself is `content/scripts/areas/area_fairy_rings/scripts/fairy_rings.rs2` and the
codes `configs/fairy_rings.dbrow`; its header says where each rule comes from.

## Step 4: the quest

Run once each:
- `scroll_interfaces.py <cache468 dir>` makes the quest's four scrolls from the 2007 interfaces
  (Nuff's certificate read and studied, the rune temple sign, the Godfather's contract), the two
  symbol texts drawn from the 2007 fonts into sprites (`if468.py`, `sprites468.py`).
- `zanaris_ft2.py <cache468 dir>` puts the quest's 2007 multilocs in Fairy Nuff's room and the
  rune temple sign by the Cosmic Altar ruins (`loc468.py` ports locs), and the quest's people in
  Zanaris and the hideout (its header says where each comes from).

The quest is `content/scripts/quests/quest_fairy2`.
