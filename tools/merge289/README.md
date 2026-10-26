# Merging Lost City's 289 quests into EASCape

Done 26 Oct 2026, the same way as the 274 merge (tools/merge274, whose scripts this reuses).

Sources: Lost City Content `289` at 8efdb33 (18 Oct 2026), merged three ways against
`663a3da` (where 289 split off 274) into our tree. Only Lost City's 289 work on the quests is
taken - `scripts/quests/**`, Miscellania (`areas/area_miscellania`,
`minigames/game_managing_miscellania`) and the quests' interfaces - so our own changes to the
rest of the game stay as they are. What that brings:

- 4 quests we didn't have: Monkey Madness, Throne of Miscellania, Haunted Mine, In Search of the
  Myreque
- Lost City's fixes since then to quests we had (journals, dialogue, constants)

Steps:
1. Set up `base/` (663a3da), `t274/` (289), `eas/` (ours) with only the folders above, plus
   `base.full/` and `t274.full/` (whole trees: procs and constants the quests need are copied
   from there, `needed.txt`), and `mm/` with both games' pack files (name translation by id).
2. `ifmap.py` (tools/merge274) on the full trees, then `merge289.py <dir> content/pack`.
3. `post289.py out/scripts eas/scripts t274.full/scripts`: the hand fixes (our quest-complete
   scroll with its reward lines and our world_delay values kept; the new quests' rewards from
   the wiki; Miscellania's market stalls in our stall system; and a few name fixes).
4. `post_ifids.py` (tools/merge274) for the new interfaces' ids.
5. `spawns289.py`: NPCs Lost City's 289 maps place that ours didn't have anywhere (Juliet,
   Edmond, Vanstrom Klause, the Tai Bwo Wannai trio...).

`merge-report.json` lists what the merge did.

## Follow-up (26 Oct 2026): 289's hooks in the shared scripts

The merge took only the quest folders, so the lines 289 added to shared scripts for its
quests were missing. Ported by hand from a three-way diff (663a3da -> 289 against ours),
quest hooks only; 289's other changes to those files (castle wars, holiday events, the
Brimhaven dungeon, combat tweaks) were left out:
- Monkey Madness: greegree on/off (equip.rs2, appearance.rs2), no attacking, fishing or
  alchemy as a monkey, greegree off when you're hit (auto_retaliate.rs2), the zoo keeper,
  stringing the monkeyspeak amulet, Ape Atoll food, the monkey in your backpack on
  teleport, mm_login, the sigil's timer
- Throne of Miscellania: the kingdom's fishing, mining, woodcutting (Leif), wheat and
  stalls, the emotes, Ghrim's book's pages, the castle and Etceteria stairs
- Haunted Mine: the fungus on death and teleport, the boss only fighting its player
- Troll Romance: the sled on death and unequip
- Horror from the Deep and Mort'ton: the diaries' and serum book's pages
- Shilo Village: no telegrab on the corpse
