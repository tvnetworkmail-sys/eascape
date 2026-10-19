# Doors, ladders and stairs from the map data

The 377 content had nothing behind about 600 doors, ladders, stairs, trapdoors and cave entrances,
mostly in places added after 2004 (the Slayer Tower, Morytania, the Fremennik lands). They are
wired up from the map data itself:

- **Doors** (anything you Open that sits in a wall) swing open as you walk through and shut behind
  you.
- **Ways up and down**: each one's counterpart is the nearest matching way back (Climb-down for a
  Climb-up, and so on) on the floor above or below, or between the surface and underground (6400
  squares north). You arrive where you stood, but by the other one. If that square is blocked, you
  get the nearest free square instead. A ladder with no counterpart goes straight up or down, as
  the game's other ladders do.
- Stairs and ladders that already had a script, but no coordinates for this spot, use the same
  table.
- Quest doors are open for now (your call, 19 Oct 2026). Their locks go back as each quest is
  built.

Where Void (GregHib/void, data/**/*.teles.toml) says a ladder, staircase or trapdoor puts you,
that comes first (866 of its teleports match a 2006 loc). Void's rules: move by a set amount, go
to an exact square, or go to the square of an area nearest to where you stood.

Regenerate after map changes:

    python3 tools/world_links/analyse.py
    python3 tools/world_links/void_teles.py <Void checkout>
    python3 tools/world_links/gen.py tools/world_links content/scripts/eascape_world

Not covered (no counterpart in the map): agility obstacles and shortcuts on one level, and
quest-only ways in. These get their own scripts when that content is built.
