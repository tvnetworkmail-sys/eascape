# Warriors' Guild map merge

`convert.py` merges the Warriors' Guild (released 13 June 2006, after our 377 cache) into
`content/maps/m44_55.jm2` from OpenRS2 cache 602 (build 451, March 2007: the earliest cache with
the key for map square 44_55). It was run once, on 21 Oct 2026; it isn't part of the build.

- `js5.py` reads the cache (idx/dat2, containers, reference tables, XTEA); `maps.py` decodes the
  old-style terrain and loc files and reads our jm2 text maps; `locdef.py` decodes build 451 loc
  definitions.
- The merged area is every tile of levels 1-3 and, on level 0, x 18-63 / z 12-38 of the square
  (the guild, its yard and its front steps). The rest of Burthorpe stays as it was in May 2006.
- Locs, models and floors with the same id are byte-identical between 377 and 451, so only the
  39 objects 377 doesn't have get new configs (`content/scripts/areas/area_warriors_guild`), with
  their 29 models in `content/models/loc/warriors_guild`.
- To re-run: download `https://archive.openrs2.org/caches/runescape/602/disk.zip` and `keys.json`,
  extract the map files with `js5.py`, and set the paths at the top of `convert.py`.
