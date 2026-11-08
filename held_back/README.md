# Held back: the Warriors' Guild and the fairy rings / Fairytale II places

On 8 Nov 2026 the Warriors' Guild and the fairy rings (with the places only Fairytale II's rings
reach) were taken off the world map. This folder holds every file that change touched, exactly as
it was before, so they can be put back. It sits outside `content/`, so the packer never reads it
(the build reads only `content/`, see `BUILD_SRC_DIR` in `engine/src/util/Environment.ts`).

The git tag `held-back-wg-fairyrings` (commit 29d08c06, the last commit with both on the map)
marks the same state.

Their scripts and configs were never removed: they are still in `content/scripts` (switched off
in `content/scripts/eascape_world/configs/eascape_switches.constant`), and so are their loc, npc,
obj and floor definitions and models. Only the map placement went.

## What is here

- `content/maps/m44_55.jm2` - Burthorpe with the Warriors' Guild building (all four levels), its
  staff, shop keepers, activity NPCs and objects, and Jade by the bank booths.
- `content/maps/m36_69.jm2`, `m32_75.jm2`, `m47_83.jm2`, `m47_70.jm2`, `m47_76.jm2` - the five
  squares only fairy rings reach: the Fairy Resistance hideout, the cosmic entity's plane,
  Gorak's plane, the Enchanted Valley and the Abyssal area. These were deleted from `content/maps`.
- The other 36 `content/maps/*.jm2` - squares with a fairy ring: the 2007 ring and its flowers
  (and, on six squares, the walkable ground around the ring). In Zanaris (`m37_68`, `m37_69`,
  `m38_69`) also Fairytale II's things in Fairy Nuff's room, the rune temple sign, and Fairytale
  II's people. `m48_50` also has the Draynor seed stall change of 3 Nov 2026 (874e0b28), which is
  still in the live map too.
- `content/pack/map.pack` - with the ids 1390-1399 for the five squares above.
- `app/src/ui/assets/worldmap/` - the app's world map drawn with the Warriors' Guild (`0/44_55.png`,
  the upper floors `1-3/44_55.png`, and `icons.json` / `index.json`).

The 377 cache's own mushroom rings (the "Fairy ring" scenery with the sparkle, three in Zanaris and five on
the overworld squares m36_56, m41_54, m42_55, m48_50 and m48_54) were taken off as well. They are not in these files, since the files
here are the state just before the change; they are in the map history before Fairytale II
(commit a546b133's parent), if they are ever wanted.

## How to put it back

From the repository root:

    cp -r held_back/content held_back/app .

That brings the five squares back, puts their ids back in `map.pack`, and overwrites the changed
squares and app map images with the versions here. Then:

1. Rebuild (`cd engine && npm run build`) and restart the server.
2. To make them work again, set `^eascape_warriors_guild_on` and `^eascape_fairy2_on` to 1 in
   `content/scripts/eascape_world/configs/eascape_switches.constant` and rebuild.

If maps were changed after 8 Nov 2026 on any of these squares, copying over would undo those
changes: check `git log -- content/maps/<square>` first and merge by hand where needed (or use
`git diff` against the tag).
