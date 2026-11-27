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
  find nothing on purpose, so those parts of a plugin do nothing rather than touch a wrong 2006
  component. Calls with no 2006 equivalent (clan chat, varcs, 2007 cache sprites, script-made
  children, minimap zoom, HD and canvas scaling) answer safe empty values.
- Plugins are moving to data the server sends (hidden `~2007rsapp~` chat lines the runtime takes
  out of the chat box, as 2007RS's bank already does), so they don't guess from animations. The
  Idle Notifier is the first: `::appidle on` and the server's "busy/idle skill <stat>" and
  "busy/idle combat" lines (engine `Player.appIdleTick`). Plugins listen with `ll.onAppMessage`.

## Plugins on 2006RS (checked 27 Nov 2026 on a local server)

Seen working: Idle Notifier (server data), Ground Items, Woodcutting, Inventory Viewer, Status Bars,
XP Globes, XP Drop. Should work (nothing 2007-only in them; the data they read is there now): NPC
Indicators, Object Markers, Ground Markers, Tile Indicators, Mouse Tooltips, Boosts, XP Tracker,
Opponent Information, Timers & Buffs, Chat Filter, Chat Timestamps, Chat Notifications, FPS
Control, Custom Cursor, Notes, Mining, Cooking, Fishing (not the Trawler overlay), Smelting,
Agility, Slayer, Kingdom of Miscellania, Tears of Guthix, Crystal Bow, Cannon, Poison, Regeneration
Meter, Special Attack Counter, Player Indicators, Interact Highlight, NPC Aggression Timer, Boss
Timers, Random Events, Item Charges, Item Stats, Item Identification, Inventory Tags (drawing),
Ammo, Examine, Metronome, Screen Markers, Screenshot (manual), Skill Calculator, Quest Helper,
Dialogue Keys, Private Messages (Tab to reply), Login Screen, Extras, Loot Tracker (drops),
Developer Tools, Prayer, Bank and Bank Tags (search, tags), World Map, Camera (zoom).

Partly (some features look up 2007 interfaces, which do nothing here): Menu Entry Swapper
(inventory swaps), Attack Styles and Combat Level (combat tab), Barrows (2007 overlay; the 2006
client has its own Barrows plugin), Blast Furnace and Pest Control (their 2007 overlays), Clue
Scroll (emote tab), Run Energy, Minimap (dot colours work; hide/zoom don't), Chat History, World
Hopper (one world locally), Time Tracking (timers work; farming patches use 2007 varbits, and our
farming keeps its own variables), Runecraft (pouches work; the abyss rifts use later varbits), Bank
(placeholders and dragging while searching need the 2007 server's AppBank commands, which this
server doesn't have), Loot Tracker (reward windows), Screenshot (automatic ones), Friend Notes.

Don't work (built on 2007 interfaces): Puzzle Solver, Virtual Levels, Report Button, Quest List,
Inventory Grid, Friend List, Fairy Rings (the content is there, the 2007 interface isn't), Music,
Key Remapping, Stretched Mode (the 2006 client has no stretched scaling; the app's own Fit to window
does the job). Status Orbs: the 2006 client draws its own.

For content 2006RS doesn't have (left in, to turn off): Achievement Diary (diaries came in 2010),
Barbarian Assault, Hunter and Implings (no Hunter skill), Mage Training Arena, Pyramid Plunder,
Player-owned House (no Construction), Chat Channels (clan chat came in 2007), Team (its clan count).

`docs/PLUGIN_PARITY.md` and `docs/BATTLE-PLAN.md` are 2007RS's notes, kept as they were.
