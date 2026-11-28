# 2006RS-2 (test app)

The owner's test app: the 2007RS app (`tvnetworkmail-sys/2007scape`, `app/`, 0.1.6 at 0df4e636,
23 Nov 2026), RuneLite's shell and 98 RuneLite-style plugins, ported to 2006RS. Only the owner
has it while it's tested; if it works out it becomes the main client in place of `app/`.

- It opens the live worlds (2006rs.com, worlds 1-3 and the test server, world 20) like `app/`:
  `src/main/worlds.js`, `clientLoader.js` and `patcher.js` are `app/`'s. `EASCAPE_SERVER` points it
  at another server, as in `app/`.
- It installs beside the normal app (its own name, app id and settings folder) and never updates
  itself: the owner builds it from this folder (`npm install`, then `npm run dist:win`, or
  `npm start` to run it from here).
- The server knows it as the app (`EASCapeApp/<version>` in its user agent, as `app/`). It tells
  the game it is version 999.0.0, so the game's "Your app needs updating" notice (which follows
  `app/`'s versions) never shows.
- The plugins were written for the 2007 client. They read the game through calls the 2007 client
  gives the app (`webclient/src/client/LostLite.ts` in 2007scape); the 2006 client's own
  `LostLite.ts` now has the same calls (`bridgeApi`), reading the 2006 client. Interfaces there are
  the 377 ones: a component is its own id and an interface is the root layer the server opens (bank
  5292, inventory 3213). The 2007 interface ids the plugins hardcode (packed group << 16 | child)
  are translated by `src/runtime/if2006.js` to the 2006 component showing the same thing; one it
  doesn't know finds nothing, so that part of a plugin does nothing rather than touch a wrong 2006
  component. Calls with no 2006 equivalent (clan chat, 2007 cache sprites, script-made children,
  HD) answer safe empty values; the minimap zoom, the chat box's client variables and the canvas
  scaling are done for the 2006 client.
- Plugins use data the server sends (hidden `~2007rsapp~` chat lines the runtime takes out of the
  chat box), so they don't guess from animations: `::appidle on` and the server's "busy/idle skill
  <stat>" and "busy/idle combat" lines (engine `Player.appIdleTick`) for the Idle Notifier and the
  skilling plugins, `::appfarming on` for Time Tracking. Plugins listen with `ll.onAppMessage`.

## Plugins on 2006RS (checked 28 Nov 2026 in the app against a local server)

`src/runtime/if2006.js` answers the plugins' 2007 interface, component and inventory ids from the 2006 ones showing
the same thing (inventory, bank, worn items, the side tabs, the puzzles, the clue scroll text, the dialogues, the
combat tabs, the reward windows, the Barrows, Trawler and Wilderness overlays, the emote buttons, the fairy ring
screens ...). Where a plugin needs a variable the server kept to itself, the variable is now sent to the client
(display only; nothing saved changes): the essence pouches, the cannon, the Charge spell.

Seen working in the app: Puzzle Solver (clue puzzle box, Monkey Madness), Clue Scroll (cryptic, coordinate, map,
anagram / challenge scrolls, puzzle boxes; read from our clue scroll), Idle Notifier and the skilling plugins
(Woodcutting, Mining, Fishing, Cooking, Smelting: the server's busy / idle data), Ground Items, Inventory Viewer,
Status Bars, XP Globes, XP Drop, Menu Entry Swapper, Attack Styles, Combat Level, Report Button, Virtual Levels, Status
Orbs, Quest List, Inventory Grid, Friend List, Friend Notes (Add / Edit Note on the friends and ignore lists), Music,
Key Remapping, Stretched Mode (on the canvas; the app's Fit to window too), Fairy Rings (the code and log screens),
Bank (search; rearranging while searching moves the real bank slots), Time Tracking (timers; farming from our patches
and the server's growth clock), Loot Tracker (drops; the clue reward as "Clue Scroll (Easy / Medium / Hard)", by the
last clue item's tier as our server names none; the Barrows chest), Screenshot (manual; automatic for levels, quest
scrolls, the clue reward (named by tier) and the Barrows chest), Chat History (kept over a relog, Copy to clipboard on a
chat line, Clear history on the chat box), Minimap (dot colours, zoom 2-8), Runecraft (pouch counts, the abyss rifts),
Barrows Brothers (slain panel and potential underground, the door puzzle's answer), Cannon (it reads the cannon
varps), Blast Furnace (the foreman's ten minutes, read from our NPC dialogue; bars and ores), Run Energy (the energy
text is the controls tab's), World Hopper (Hop-to on the friends list).

Should work (nothing 2007-only left in them, and the data they read reaches the client; not each tried on its own):
NPC Indicators, Object Markers, Ground Markers, Tile Indicators, Mouse Tooltips, Boosts, XP Tracker, Opponent
Information, Timers & Buffs, Chat Filter, Chat Timestamps, Chat Notifications, FPS Control, Custom Cursor, Notes,
Agility, Slayer, Kingdom of Miscellania, Tears of Guthix, Crystal Bow, Poison, Regeneration Meter, Special Attack
Counter, Player Indicators, Interact Highlight, NPC Aggression Timer, Boss Timers, Random Events, Item Charges, Item
Stats, Item Identification, Inventory Tags, Ammo, Examine, Metronome, Screen Markers, Skill Calculator, Quest Helper,
Dialogue Keys, Private Messages, Login Screen, Extras, Developer Tools, Prayer, Bank Tags, World Map, Camera, Fishing
(the Trawler overlay's timer in m:ss over our 10-minute game).

Parts that can't be on 2006RS:
- Bank placeholders (off by default): the server would have to keep them with the account, and the player save stays
  at version 7 with no new fields. Rearranging while searching works without them.
- Friend Notes' note icon after a name: the 2006 client writes the friends list's names itself every frame.
- Fishing's Trawler contribution count: our Trawler (like 2006's) keeps no contribution points; the overlay's own
  catch line stays.
- Blast Furnace's coffer overlay: the coffer came in 2016.
- Minimap's Hide minimap: RuneLite does it only in its resizable frames; this is the fixed frame, as RuneLite's fixed
  mode.
- Clue Scroll's emote clues: our clue set has none (the emote highlighting on our controls tab is mapped and ready).
- World Hopper lists one world on a local server; live has worlds 1-3 and the test server.

For content our game doesn't have (left in, off by default): Diary Requirements (diaries came in 2010), Barbarian
Assault, Hunter and Implings (no Hunter skill), Mage Training Arena, Pyramid Plunder, Player-owned House (no
Construction), Chat Channels (clan chat came in 2007), Team (its clan count), Pest Control (our server has its
scenery but not the minigame yet).

`docs/PLUGIN_PARITY.md` and `docs/BATTLE-PLAN.md` are 2007RS's notes, kept as they were.
