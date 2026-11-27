Rendered by tools/worldmap/render2007.py from the September 2007 game cache the game runs
(engine/data/cache2007: cache/ as tools/cache/build.py writes it, OpenRS2 cache 236 with our fills
for the map squares nobody has keys for, and keys.json). Each picture is one 64 x 64 region of one
floor at 4 px per tile, drawn the way the 2007 client draws its minimap (blended underlays,
overlay shapes, texture averages and map colours, white walls, red doors, mapscene sprites); map
function icons go in icons.json, drawn from the 2007 mapfunction sprites (mapfunction.png).
Squares without loc data (no key, no fill) show their terrain without scenery. Re-run it if the
cache changes (from the repo root; `pip install pyoxipng` first to keep the pictures small):

    python3 app/tools/worldmap/render2007.py engine/data/cache2007 app/src/ui/assets/worldmap

Place names (labels.json) came from EASCape's 2006 map (content/maps/labels.txt); the script keeps
the ones on regions the 2007 map has and adds the few in its EXTRA_LABELS. The older
tools/worldmap/render.py drew the 2004/2006 map from Lost City content and is kept for reference.
