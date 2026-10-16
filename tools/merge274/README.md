# Merging Lost City's 274 game into EASCape

How the 16 Oct 2026 merge was done, kept so the next Lost City update can be merged the same way.

Sources: Lost City Content `377-wip` at f4e09ff (our base) and `274` at 65b754f; their common
ancestor is 3abf2e2. The three trees (base, 274, ours) are extracted side by side and:

1. `ifmap.py` works out which 274 interfaces and components are the same as 377 ones under
   other names, and which 274 interfaces clash by name with a different 377 one (renamed `_274`).
2. `merge274.py` builds the merged `scripts/` tree:
   - configs are merged block by block, key by key. On things the client sees (objs, npcs, locs,
     seqs...) only server-side keys change, so the 377 game data stays exact. 377 wins where
     both sides changed a key.
   - scripts are merged with `git merge-file` (274 wins clashes), falling back to 377's version
     for files listed in `fallback.txt` that wouldn't compile.
   - names 274 renamed are translated back to the 377 name with the same id.
   - procs 274 code needs from a file that kept 377's version are copied in (`needed.txt`).
   - duplicates (274 moved a script to a new file) keep 274's copy.
3. `fixups.py` holds the hand fixes; `post_ifids.py` gives new interfaces their own ids.
4. `remerge.sh` runs everything and builds; `fallback_step.py` reads the build errors and
   updates `fallback.txt` / `needed.txt` for the next run.

`merge-report.json` lists everything the merge did, including what it left out.
The scripts have scratch paths baked in; adjust them before reusing.
