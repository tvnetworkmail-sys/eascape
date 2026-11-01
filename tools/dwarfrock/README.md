# Between a Rock... from the 2007 cache

Run with `python3 -I`, each once, with the August 2007 flat cache (see tools/fairytale2):
- `lore_picture.py <cache468>`: the dwarven lore book's picture (2007 interface 111, model 5826) as
  `book:dwarf_lore_picture`, shown on the book's last spread.
- `schematic_interfaces.py <cache468>`: the schematic puzzle screens (2007 interfaces 113 and 114) as
  `bar_schematic` and `bar_schematic_side`, with their sprites; the puzzle itself is
  `content/scripts/quests/quest_dwarfrock/scripts/dwarfrock_schematic.rs2`.

The web client redraws the side panel when the server hides, moves or re-models a component
(webclient Client.ts, `redrawSide`), which the puzzle's ticks need.
