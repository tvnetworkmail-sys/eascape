# LostLite Battle Plan

A RuneLite-style client for Lost City's 2004 worlds: RuneLite's design and quality-of-life
features, our own branding, 2004 content only.

How to use this file:
- [ ] not started
- [~] in progress / delivered, waiting for your test
- [b] built, waiting for Lost City to make it testable (377 content), then bug testing
- [x] done (only after you confirm it works)
- [-] dropped

Rules we agreed:
- Every step is discussed first. I only start building when you say "start".
- Each step ends with a build you can test, plus a short "what to check" list.
- Plugins are ported from RuneLite's open source code (licence checked, credit kept),
  with 2004 data swapped in. Nothing OSRS-only, no RuneLite branding.
- No item prices or values anywhere (14 Oct 2026): 2004 has no Grand Exchange, so nothing
  can know what an item is really worth.
- No OSRS sprites, even where RuneLite uses one (e.g. its Loot Tracker icon is the OSRS
  looting bag): use the 2004 sprite instead (the 2004 backpack side icon there).
- **We are cloning RuneLite.** Before building any feature, first read the RuneLite plugin
  itself (its Plugin, Config, Overlay and Panel files, see "Where to read the code") and
  look at how it looks in RuneLite (screenshots, default settings). Aim for the same layout,
  sizes, colours, fonts, wording, settings (names, order, defaults) and controls. Anything
  that has to differ (2004 data, no OSRS artwork) is said up front.
- RuneLite draws overlays at the screen's resolution, not the game's: LostLite's overlays
  (info boxes onwards) are drawn the same way, so they're RuneLite-sized however big the
  game window is.
- Every plugin that draws a panel on the game view has its own "Panel size" setting (your
  request, 14 Oct 2026), on top of Info Boxes > Layout > Panel size for all of them.
- **Everything is built with 377 in mind (14 Oct 2026)**, so it doesn't need coming back to
  when Lost City moves on. Each feature covers what RuneLite has that exists at 274 *or* 377,
  and its data (item, loc, interface, animation ids, messages) comes from both content
  branches (tools take a 274 and a 377 checkout and merge them; Jagex ids are the same in
  both). Where 377 isn't scripted yet, it's detected the way the 2006 game does it.

"LostLite" is a working name. Change it whenever you like.

## Where to read the code (reverse engineering sources)

Before building any feature, read how these do it first, then port it with 2004 data.

- **RuneLite (the design and behaviour we copy): https://github.com/runelite/runelite**
  BSD 2-Clause licence: keep the copyright notice and credit when porting.
  - `runelite-client/src/main/java/net/runelite/client/plugins/<name>/` - every core
    plugin (138): `<Name>Plugin.java` (logic), `<Name>Config.java` (the settings, names,
    defaults and order to copy), `<Name>Overlay.java` / `<Name>Panel.java` (drawing).
  - `runelite-client/src/main/java/net/runelite/client/ui/overlay/` - overlays: positions,
    Alt-drag moving, `infobox/` (info boxes, groups, Detach / Flip), `components/`.
  - `runelite-client/src/main/java/net/runelite/client/ui/` - sidebar, panels,
    `ColorScheme.java` (the colours), `FontManager.java`.
  - `runelite-client/src/main/java/net/runelite/client/` - `Notifier.java`
    (notifications, flash), `config/` (config system), `game/` (item/skill helpers).
  - `runelite-client/src/main/resources/net/runelite/client/` - icons (RuneLite's own
    only; no OSRS artwork).
  - `runelite-api/` - what the game exposes to plugins (we map these to the 2004 client).
- **Quest Helper (Plugin Hub): https://github.com/Zoinkwiz/quest-helper** - quest steps,
  requirements and conditions (BSD 2-Clause).
- **Lost City (the 2004 game itself), https://github.com/LostCityRS:**
  - `Content` (branch 274) - scripts, configs, maps and sprites: what the game really does
    (quest stages, despawn times, animations, idle logout), and 2004 icons.
  - `Engine-TS` - the server: what it sends and when (logout rules, packets).
  - `Client-TS` - readable 2004 web client: what each obfuscated field in the live
    `client.js` does.
  - Live `client.js` per world: the `bundles` branch of this repo, refreshed by the
    "Snapshot live bundles" workflow; the patcher is tested against all four.

## Target revisions (checked against Lost City's files)

- **Now: revision 274 (November 23, 2004).** This is what the live worlds run today
  (the live client reports version 274). Everything in Phases 1-4 targets 274 first.
- **End goal: revision 377 (May 5, 2006).** Lost City lists it as work-in-progress,
  for developers only. Two things to know:
  - Its game files contain far more than is playable yet. Lost City are still scripting it
    (for example Farming, Construction and Pest Control exist as empty folders).
  - It currently only has a Java client, no web client. Our app runs Lost City's web client,
    so 377 support depends on them releasing a 377 web client. We follow them as they go.
- 377 plugins are built now with 377 IDs from the game files (Tier 11), so most of the
  work is done ahead of time and only bug testing remains when the content goes live.
- 274 plugins come first in each batch, because they prove the shared code works.

---

## Phase 0: Foundation (DONE - confirmed 12 Oct 2026)

- [x] 0.1 Desktop app (Electron) that runs Lost City's own live client, so login is theirs
- [x] 0.2 Hook added to the live client as it loads (survives Lost City client updates)
- [x] 0.3 First game data read: skills, levels and XP
- [x] 0.4 YOUR TEST of build 0.2.0: logged in on world 2, sidebar showed "hook installed"
      and "captured", total level 977 matched the game

## Phase 1: Base build (the RuneLite-style shell) - DONE except auto-update (confirmed 12 Oct 2026)

Note on Windows Smart App Control: unsigned builds can be blocked outright. You've turned
it off for testing; code signing (5.1) is needed before public release.

Note on 1.10: the app checks GitHub for updates, but GitHub only lets it see releases of a
public repository. While the repo is private, auto-update reports "check failed" and you
download new versions from the Releases page by hand.

- [x] 1.1 Window and title bar in RuneLite's layout and colours, our own logo (confirmed 12 Oct 2026)
- [x] 1.1b Camera Zoom: scroll the mouse wheel to zoom the game camera (confirmed 12 Oct 2026)
- [x] 1.1c Draw distance raised from the original 25 tiles (up to 50) so zooming out shows
      more (confirmed 12 Oct 2026)
- [x] 1.1d Middle-button drag rotates and tilts the camera (confirmed 12 Oct 2026)
- [x] 1.2 Sidebar with tab strip, sliding panels, open/close button and hotkey (confirmed 12 Oct 2026)
- [x] 1.3 Game area shows only the game (no website around it), fixed or fit to window (confirmed 12 Oct 2026)
- [x] 1.4 Configuration panel: plugin list, search, on/off switches, favourites (confirmed 12 Oct 2026)
- [x] 1.5 Settings editor for each plugin (checkboxes, numbers, colours, dropdowns, hotkeys) (confirmed 12 Oct 2026)
- [x] 1.6 Info panel: version, world, links (Lost City site, forums, support) (confirmed 12 Oct 2026)
- [x] 1.7 World Hopper: 2004 worlds 1, 2, 3, 5 and 7, flags, player counts, ping,
      favourites, click to switch (confirmed 12 Oct 2026)
- [x] 1.8 Settings saved between sessions and profiles (confirmed 12 Oct 2026; default profile
      tested, extra profiles use the same code)
- [x] 1.9 Logs saved to a file for troubleshooting (confirmed 12 Oct 2026)
- [~] 1.10 Windows installer, desktop shortcut and auto-update (auto-update needs public releases, see note)
- [x] 1.11 Full-size downloads: GitHub builds every update and publishes it on the repo's
      Releases page (github.com/tvnetworkmail-sys/lostlite/releases)

## Phase 2: Game data (what plugins need to read)

- [x] 2.1 Local player: name, combat level, world tile and plane, region, animation, moving,
      hitpoints, in combat, combat target (confirmed 12 Oct 2026, 0.7.0)
- [x] 2.2 Other players and NPCs in view: name, ID, combat level, position, health (confirmed
      12 Oct 2026 in the Developer Tools panel, 0.9.0)
- [x] 2.3 Inventory, worn equipment and bank contents (bank contents done for bank search;
      inventory and equipment with names and quantities; confirmed 12 Oct 2026, 0.7.0)
- [x] 2.4 Ground items (confirmed 12 Oct 2026, 0.8.0)
- [x] 2.5 Objects in the scene (trees, rocks, doors, crates and so on) - 0.17.0, shown in Developer Tools (confirmed 13 Oct 2026)
- [ ] 2.6 Quest progress and other game variables
- [x] 2.7 Chat messages (game, public, private) - 0.17.0, shown in Developer Tools (confirmed 13 Oct 2026)
- [x] 2.8 Right-click menu: read entries, swap their order, hide entries, add new entries and
      handle clicks on them (built early for the Menu Entry Swapper; confirmed 12 Oct 2026)
- [~] 2.9 Open interfaces (bank, shop, puzzle box, dialogue) (main interface + bank done)
- [x] 2.10 Run energy, prayer points, weight, special attack energy (confirmed 12 Oct 2026, 0.7.0)
- [~] 2.11 Item and NPC definitions (names, values, stackable, members) (item names, values and
      stackable done in 0.8.0)

## Phase 3: Core systems (shared by many plugins)

- [~] 3.1 Overlay system: tile outlines, NPC/object highlights, text labels, corner panels
      (text, boxes and tile outlines confirmed working 12 Oct 2026 with Ground Items; 0.8.0: drawn into the game's own 3D view with its fonts - text, boxes, lines, tile
      outlines, clickable areas; any colour in menus. NPC/object highlights come with 2.2/2.5)
- [x] 3.2 Info boxes (small icons with timers/counters, like RuneLite's) (confirmed 14 Oct 2026) - 0.18.0; drawn at screen size like RuneLite in 0.18.1 (Boosts confirmed working)
  - Built to the agreed design (13 Oct 2026): RuneLite's InfoBoxOverlay drawn in the
    game view; layout saved on this PC.
  - 0.21.0 (your call, LostLite's own way): boxes sit in groups by what they are (Logout timer,
    Boosts, Potions, Prayer, Spells, Other), each group its own row. Hold Alt and drag a group
    (or a panel) anywhere; Alt + right-click puts it back. (0.20.0 moved single boxes; 0.18 had
    RuneLite's Detach / Flip / Delete.)
  - 0.28.3: each panel plugin's own Panel size too (Opponent Information, Woodcutting, Mining,
    Agility, Cooking), times the Info Boxes one (global and per-plugin sizes confirmed 15 Oct 2026)
  - 0.27.0: Layout > Panel size (50-300%) scales every panel (Opponent Information, the
    skilling panels, and any later ones), like Box size does for boxes.
  - First boxes: Boosts, Logout Timer (last 30 s of the 90 s idle logout), active prayers.
  - 0.20.0: Prayer potion reminder (LostLite's own, your request): pops up when a dose won't
    be wasted (prayer potion 7 + 25%, super restore 8 + 25%) or below a level you set.
- [x] 3.3 Off-screen arrows pointing to targets (confirmed 15 Oct 2026) - 0.26.0: when the hint arrow (the game's, the
      Quest Helper's or the Clue Helper's) points at something out of view, an arrow at the edge
      of the view points the way (also when it's behind you or outside the loaded area).
      Settings: Info Boxes > Hint arrow (on, colour)
- [x] 3.4 Desktop notifications (with sound, only when the window isn't focused) - 0.17.0, settings under LostLite > Notifications (confirmed 13 Oct 2026)
- [x] 3.5 World map: button by the minimap opens a 2004 map rendered from Lost City's map
      data, showing your position, with markers that plugins can add (0.11.0: the whole 274
      map, all four floors, in the minimap's own style; place names, map icons, you; drag,
      zoom, Ctrl+M; over the game view only, closes on a click elsewhere, yellow cross for you.
      Confirmed 12 Oct 2026, 0.11.1)
  - [~] Markers that plugins can add (0.12.0, used by the Clue Helper)
- [x] 3.6 Hotkey system (confirmed 14 Oct 2026) - 0.26.0: RuneLite's KeyManager / HotkeyListener for plugins: a hotkey
      setting, pressed and released once per press, a modifier on its own ("Alt") or with keys,
      kept from the game when used. World map (Ctrl+M), bank search (Ctrl+F) and PM reply (Tab)
      now use it
- [~] 3.7 Item and skill icons taken from the 2004 client itself - item icons drawn by the game
      (0.21.0), now one shared service any panel can use (0.26.0, the Loot Tracker uses it);
      skill icons are the 2004 stat icons

## Phase 4: Plugins

Ordered by priority. Reorder however you want.

Sidebar icons (to decide together when we start this phase): like RuneLite, a plugin gets
its own icon in the sidebar only when it has a panel of its own that you look at while
playing. Everything else stays in the plugin list as settings. Plugins marked (icon) below
are the ones that have a sidebar icon in RuneLite; nothing gets an icon without your OK.
Likely icons: XP Tracker, Hiscore, Notes, Loot Tracker, Quest Helper,
Screen Markers, Skill Calculator. Timers and info boxes stay as overlays (no icon).

### Tier 1: Quick wins
- [x] XP Tracker: XP gained, XP/hour and time to level, per skill (icon) - 0.17.0; RuneLite layout 0.17.2; saved across restarts 0.17.6 (confirmed 13 Oct 2026)
- [x] XP Drops: floating XP drops when you gain XP - 0.17.0, drawn in the game view from 0.17.1 (confirmed 13 Oct 2026)
- [x] Ground Items: names and quantities on dropped items, highlight and hide lists
      (Deprioritize menu hidden items: hidden items go under Walk here so a left click walks; confirmed 15 Oct 2026)
      (confirmed 12 Oct 2026, 0.8.0: RuneLite's overlay and menu options, Alt + click [X]/[+] boxes, double-tap Alt,
      list editor in its settings. 0.21.1: prices and price colours removed at your request,
      since 2004 can't know what items are worth)
  - [x] Despawn timers - 0.17.0 (items you drop: 3:00, monster loot: 2:00) (confirmed 13 Oct 2026)
  - [ ] Loot beams, drop notifications
- [x] Idle Notifier: alerts when you stop skilling or fighting, or are about to be logged out - 0.17.0, fixed in 0.17.3-0.17.5 (chat box messages, 90 s logout from the game's timer, screen flash) (confirmed 13 Oct 2026)
- [x] Boosts: boosted and drained stat levels (confirmed 14 Oct 2026) - info boxes and next boost drop timer in 0.18.0
- [ ] Run Energy: exact run energy percentage
- [ ] FPS: frame rate display and limiter
- [ ] Screenshot: hotkey, and automatic on level-ups, quest completions and clue rewards

- [~] Dialogue Keys (0.14.0, your request): Space presses "Click here to continue", keys 1-5
      pick "Select an Option" options top to bottom, numbers shown in front of the options.
      One key press = one click (holding a key doesn't repeat); off while typing an amount or
      a private message

### Tier 2: The big helpers
- [~] Clue Scroll Helper: identifies your clue, shows the solution, highlights the NPC,
      object or dig spot, map button shows the location (0.12.0: 202 clues, challenge scrolls
      and puzzle boxes built from Lost City's own trail scripts; answer panel, NPC/tile
      highlight, the game's hint arrow, world map marker; 0.13.0: no tile numbers, the panel
      gives the clue's own wording plus "Dig near <place>" only for map and coordinate clues.
      Medium clue done start to finish in game, 13 Oct 2026)
      0.27.3 (confirmed 14 Oct 2026): a challenge scroll's answer shows while you also carry the anagram it came from
      (the challenge or puzzle box is the step you're on, so it's shown first)
      0.27.4: locked drawers: "Kill Guard for the key, then search the drawer" with the NPC
      highlighted and the hint arrow on it, until the key is in your pack (7 medium clues, from
      the trail scripts' key drops)
- [~] Puzzle Solver: solves sliding puzzle boxes from clues and shows the next move
      (274 has three sliding puzzle pictures; no light box). 0.13.0: solves the open puzzle
      box in a few ms, outlines the next 3 pieces to click (arrow on the first), counts moves
      left, re-solves if you go off-plan; setting "Puzzle solver" (on by default)
- [~] Quest Helper (icon): step-by-step guide that follows your progress automatically, with an
      item checklist, highlights and map markers. Built in batches:
      - [~] Engine (0.15.0): Lost City doesn't send quest progress, so the stage comes from
            the quest list colours, the quest journal when you open it, and the lines of
            dialogue that only appear as a quest moves on (all read from Lost City's own
            scripts), saved per account on each PC
      - [~] Walking routes (0.15.0): line on the ground and on the world map to the next
            step, through doors and up/down stairs, ladders and trapdoors; built from Lost
            City's maps the way its server builds collision. Not yet: minimap line
      - [~] Overlays (0.15.0): NPC outline, object squares, ground items, the game's hint
            arrow, dialogue option in green (after the number from Dialogue Keys)
      - [~] Sidebar (0.15.0): all 63 quests with their status and search; quest page with
            current step, items needed (have / in bank), sections, rewards; right-click a
            step for "I'm on this step"; auto start when you start a guided quest
      - [x] 0.15.1 (confirmed 13 Oct 2026): quest list colours read properly (the server sends them at 5 bits per
            colour, so green arrived as 0x00f800 and nothing was marked done); the list is
            only trusted a few seconds after login; no step shown until the list is read;
            route lines no longer jump across the world map at ladders into dungeons
      - [~] Batch 1 (0.15.0): Cook's Assistant, Sheep Shearer, Rune Mysteries, Romeo & Juliet,
            The Restless Ghost, Imp Catcher, Doric's Quest, Witch's Potion
      - [~] 0.16.0: Horror from the Deep (your request, to test a members quest end to end):
            bridge, key, lighthouse light, the strange wall and both fights, with the part
            steps followed from the game's messages; routes now also use the basalt rocks,
            the lighthouse stairs and the bridge
      - [x] 0.16.1 (confirmed 13 Oct 2026): routes across the map (Lumbridge or Falador to the lighthouse): a second,
            faster search when the target is far away, so the line shows instead of nothing
      - [x] 0.16.2 (confirmed 13 Oct 2026): routes walked through the air on upper floors (up a ladder in Falador,
            then across the first floor to the Barbarian Outpost): upper floors now only count
            where there is a floor. Routes are worked out in a background thread, so long ones
            (Falador to the lighthouse, ~800 squares) never hold up the game
      - [~] 0.16.3: game froze after dragging the world map with a route on it (cause not
            known yet, waiting on the log): every call from the game into LostLite is now
            guarded so a LostLite error can't stop the game's loop; the ground line stops at
            the draw distance instead of floating in the dark
      - [ ] Batch 2: remaining free-to-play quests
      - [ ] Batch 3+: members quests (63 quests in total at 274, listed in the appendix)
- [~] Quest List: all quests with status and search (part of the Quest Helper panel, 0.15.0)
- [ ] World Map plugin: quest start icons, agility course and skilling spot markers
- [ ] Shortest Path (Plugin Hub): walking route to any point you click on the world map

### Tier 3: Highlighting
- [x] NPC Indicators: highlight NPCs by name, with names and outlines (confirmed 12 Oct 2026, 0.9.2: hull, tile, true
      tile, south-west tiles, names above, menu colours, Alt + right-click Tag / Tag-All (0.9.1),
      ignore dead NPCs.)
  - [ ] Model outline style, names on the minimap, respawn timer
- [x] Object Indicators (confirmed 14 Oct 2026): mark objects you choose (rocks, trees, doors) - 0.21.0 as RuneLite's "Object
      Markers" (off by default, like RuneLite): Shift + right-click > Mark object; hull or tile
- [x] Ground Markers (confirmed 14 Oct 2026): mark tiles, with colours and labels - 0.21.0: Shift + right-click > Mark tile
      (labels, per-tile colours and the minimap still to do)
- [ ] Tile Indicators: destination tile and current tile
- [ ] Player Indicators: friends, clan and other players, coloured and named
- [ ] Interact Highlight: outlines what you're hovering over or interacting with
- [ ] Mouse Highlight: hover tooltips showing the action

### Tier 4: Combat
- [x] Opponent Information: your target's health bar and health percentage (confirmed 14 Oct 2026) - 0.20.0 (RuneLite's
      panel and colours; exact hitpoints, which the 2004 game sends with each hit)
- [ ] Attack Styles: current style, with warnings for unwanted styles
- [ ] Combat Level: exact combat level and levels needed for the next one
- [ ] Prayer: prayer points remaining, flick helper
- [ ] Poison: poison damage and timer
- [ ] Regeneration Meter: time until the next hitpoint and next stat restore
- [ ] Status Bars: health and prayer bars next to the inventory
- [x] Timers & Buffs: potion, poison, teleblock and freeze timers (where 2004 has them) (confirmed 14 Oct 2026) - 0.19.0:
      antifire, antipoison / superantipoison, charge, freeze (bind, snare, entangle), pickpocket
      stun, as info boxes (274 has no teleblock, stamina or venom)
- [ ] Special Attack Counter: special attack energy and hits (confirmed in 274)
- [ ] Dwarf Multicannon: cannon range and ammo remaining

### Tier 5: Skilling
- [x] Agility (confirmed 14 Oct 2026): obstacle highlights and lap counter for the Gnome, Barbarian and Wilderness
      courses, plus shortcuts (marks of grace are OSRS only) - 0.28.0: RuneLite's clickboxes
      (overlay colour, faint fill, darker under the mouse), shortcuts in red when your level is
      too low (31 from Lost City's scripts, 274 + 377), lap counter from each course's progress
      varp ("Total Laps", "Laps until goal" = next level, "Laps per hour"). Agility Arena: 377
      Highlights confirmed 14 Oct 2026. 0.28.2: the lap counter never showed - the game isn't
      sent the course progress - so laps now come from the last obstacle's XP + lap bonus
      (Gnome 46.5, Barbarian 54.5, Wilderness 498.9) while you're at the course, like RuneLite
      Lap counter confirmed 14 Oct 2026
- [x] Woodcutting: session stats, tree respawn timers - 0.21.0 (off by default, like RuneLite) (confirmed 14 Oct 2026)
- [~] Mining: rock respawn timers, session stats - 0.21.0 (off by default, like RuneLite)
- [x] Fishing: fishing spot highlights and spot type (0.29.0, RuneLite's Fishing plugin): each
      spot's tile outlined (Display spot tiles, on), the game's own icon of its best fish
      (Display spot icons, on; "Spot icon size", 50% from 0.29.1) and its fish by name (Display spot names, off); "Display only
      currently fished fish"; overlay colour (cyan); the session panel "Fishing" / "NOT fishing",
      "Caught fish:", "Fish/hr:", reset after 5 minutes; its own Panel size. 42 spot NPCs read
      from the 274 and 377 spot scripts. Not drawn: spots on the minimap (no minimap hook yet);
      minnows, aerial fishing and the rest aren't in the game.
- [~] Cooking: session stats, burn count - 0.28.0: RuneLite's panel ("Cooking"/"NOT cooking",
      "Cooked: n (x/hr)", "Burnt: n (p%)") from Lost City's own cook/burn messages (274 + 377)
      and RuneLite's; wine ferment info box (20 ticks, red in the last 3 s)
- [ ] Smelting: bars made per session
- [ ] Runecraft: altar highlights, pouch tracking
- [ ] Skill Calculator: actions needed to reach a goal, using 2004 XP rates (icon)
- [ ] Virtual Levels: levels past 99 and exact XP to max

### Tier 6: Items and bank
- [-] Item Prices: dropped (your call, 14 Oct 2026): 2004 has no real item values, so LostLite
      shows no prices anywhere
- [ ] Item Stats: stat changes when hovering food, potions and gear
- [ ] Item Charges: charges on jewellery that has them in 2004
- [ ] Bank Tags: tag and filter items in the bank
- [x] Bank placeholders (your request, 15 Oct 2026; OSRS's, not a RuneLite plugin) (confirmed 15 Oct 2026) - 0.30.0:
      take all of an item out and its place stays, a faded icon with "0"; putting it back fills
      that place. Right-click > Release removes one. Bank > "Bank placeholders" (on).
      LostLite lays the bank out itself (saved on this PC, per account): the game's server has
      no placeholders and puts deposits at the end, so dragging items rearranges LostLite's
      layout and not the server's order (another client shows the game's own order). No
      "Release all" button yet. Searching still works; no dragging while a search is shown.
      0.30.1: dragging picked up the wrong item once a placeholder was in the bank (the item
      in the real slot); fixed.
- [x] Bank: no bank value (no prices, your call 14 Oct 2026)
  - [x] Bank search: search button between Insert and Item, RuneLite-style chatbox prompt drawn
        by the game on the real chatbox background, title shows the search, Ctrl+F hotkey
        (confirmed 12 Oct 2026, 0.6.2)
- [ ] Inventory Tags: colour-tag inventory items
- [ ] Inventory Grid: grid while dragging items
- [ ] Inventory Viewer: inventory shown as an overlay when another tab is open
- [ ] Examine: examine text (no item values)
- [x] Loot Tracker: drops from NPCs, clues and other sources, with totals (icon) (confirmed 15 Oct 2026: clue stacking, pickpocket entries) - 0.21.0: NPC kills;
      0.21.1: no prices (kill counts and item totals only), 2004 backpack icon
      0.21.2: Treasure Trail rewards, an entry per tier ("Clue Scroll (Medium)"); NPC kills confirmed;
      clue rewards confirmed 14 Oct 2026
      Pickpocketing confirmed 14 Oct 2026 (men, women); 0.28.1: its own entry, "Guard (pickpocket)",
      apart from the guards you kill (they shared one before)
      0.22.0: every RuneLite source that exists at 274 or 377, by RuneLite's names: pickpocketing
      (the NPC's name), "Casket", "Bird nest" (377), "Crystal Chest", "Rogues' Chest", "Fishing
      Trawler", "Barrows" (377), "Kingdom of Miscellania" (377) and PvP kills. Like RuneLite,
      skilling (logs, ore, fish) isn't loot. Woodcutting/Mining tables now cover 377 too.
      0.27.2: clue scrolls dropped by monsters stack as one item per tier ("Clue scroll (easy)",
      RuneLite's LootTrackerMapping), also in loot saved before

### Tier 7: Chat and social
- [x] Private Messages: Tab to reply to the last private message, using the game's own message
      prompt (friends who are online, like the friends list's Message option); key can be changed
      (built at your request; confirmed 12 Oct 2026, 0.7.1)
- [ ] Chat Commands: !lvl, !total and similar, using Lost City's hiscores
- [ ] Chat Filter: hide spam and chosen words
- [ ] Chat History: keep chat across logins, recall sent messages
- [~] Chat Notifications: alerts on your name or keywords - 0.21.0 (off by default, like RuneLite;
      2004's chat box can't recolour words, so it notifies but doesn't highlight)
- [ ] Timestamp: timestamps on chat messages
- [ ] Friend Notes: notes on friends list entries
- [ ] Friends List: online count and world numbers
- [ ] Emojis: text emoticons as images
- [ ] Hiscore: Lost City hiscore lookup in the sidebar (icon)

### Tier 8: Interface and comfort
- [x] Mouse wheel scrolling (your request, 0.27.0, confirmed 14 Oct 2026): the wheel scrolls the part of an interface
      under the mouse that has a scroll bar (bank, skill guides, quest journal, side tabs,
      chat-box interfaces); elsewhere in the game view it still zooms
- [x] Sidebar order (your request, 0.27.0, confirmed 14 Oct 2026): LostLite > Sidebar > Sidebar order, move icons
      up and down, Reset (LostLite's own: RuneLite's order is fixed). 0.27.5: the list now
      follows each move (it only moved once before)
- [x] Bigger sidebar icons (your request, 0.27.1, confirmed 14 Oct 2026): 34 px rows with a gap and 20 px icons (RuneLite:
      26 px, 16 px), so they're easy to hit
- [ ] HD (117 HD) - ON THE BACK BURNER (14 Oct 2026): tried in 0.23-0.25 (texture swaps, sky,
      the ground on the graphics card); not close enough to 117 HD to be worth it. Removed in
      0.26.0. If it comes back it's its own stand-alone project: a full graphics-card renderer.
- Roofs: Camera > Hide roofs confirmed working (14 Oct 2026), no separate plugin needed.
- [x] Menu Entry Swapper: set default left-click options (confirmed 12 Oct 2026, 0.4.4):
      Shift + right-click "Swap left/shift click <option>" per NPC, object and item, Reset,
      your choice beats the tick boxes, bank booth Use-quickly, NPC swaps, shift-click drop,
      custom swaps and hides
  - [x] 0.6.2 (confirmed 12 Oct 2026): NPC Swaps / Item Swaps tick boxes removed (per-target swaps cover them). Settings
        are now just the two Customizable left/shift-click switches, plus a closed "Custom
        Lists" section (wildcard swaps and hide options) for power users
  - [x] 0.13.1 (confirmed 14 Oct 2026): a left click set for an NPC or object now also wins when the game buried it
        under Walk here or a ground item (Attack on NPCs above your level, items lying under
        the NPC); never over another NPC, player or object in front
- [x] 0.13.3 (marked working 14 Oct 2026, not retested): black game screen on a first visit (found by you: the site's "I agree" rules
      page was hidden by "Hide website around the game"). The website now stays visible while
      the site asks you to agree, and hides itself once you have. Also from 0.13.2: setting
      "Hardware acceleration", graphics card and driver in the log, overlay can't stop a frame
- [x] Esc closes interfaces: Esc does what the Close button does on the bank, shops and other
      windows (switch in LostLite > Game Area). Not while typing an amount or a search.
      (confirmed 12 Oct 2026, 0.6.2)
- [ ] Key Remapping: WASD camera, number-key spellbook and F-keys
- [ ] Camera: pitch and other camera tweaks (scroll-wheel zoom moved to 1.1b)
- [x] Status Orbs (confirmed 14 Oct 2026): hitpoints, prayer, run energy and special attack orbs by the minimap with the
      2004 icons; click run to toggle running, spec to use the special attack, prayer to open
      the prayer tab; world map button (built at your request, 0.10.0). Quick prayers left
      out for now (2004 had none)
  - [x] Orbs show, special attack orb works, prayer orb (confirmed 13 Oct 2026)
  - [x] Run orb (fixed in 0.11.2, confirmed 13 Oct 2026)
- [x] Hide roofs: Camera plugin setting that always hides roofs and floors above you, without
      low detail mode (built at your request; confirmed 13 Oct 2026, 0.9.3)
- [ ] Custom Cursor
- [ ] Stretched Mode: scale the game to fill the window
- [ ] Anti Drag: stops accidental item dragging
- [ ] Entity Hider: hide other players, NPCs or pets
- [ ] Notes: notepad in the sidebar (icon)
- [ ] Screen Markers: draw boxes on the screen (icon)
- [x] Login Screen: tick boxes on the login box for Remember username, Remember password
      (stored encrypted with your Windows account) and Hide username (confirmed 12 Oct 2026, 0.5.0;
      centred row at the top of the box confirmed in 0.6.2)
- [x] Logout Timer: time until idle logout - info box in 0.18.0 (last 30 s of the 90 s) (confirmed 14 Oct 2026)
- [ ] Metronome: tick metronome
- [ ] Random Events: alerts when a random event appears (27 random events in 274)
- [ ] Discord: rich presence showing what you're doing
- [ ] Wiki: link items and NPCs to a 2004 wiki (Lost City's or the 2004-era wiki)

### Tier 9: 274 minigames (confirmed in Lost City's files)
- [ ] Duel Arena: opponent stats, rules summary, win/loss tracker
- [ ] Brimhaven Agility Arena: active pillar and ticket helper
- [ ] Fishing Trawler: leak and net timer helper
- [ ] Shades of Mort'ton: temple repair and sanctity helper
- [ ] Ranging Guild: target score tracker
- [ ] Gnomeball and Burthorpe Games Room: score and game helpers
- [ ] Falador Party Room: drop timer

### Tier 10: Developer tools (for building plugins, hidden from players)
- [~] Dev Tools: sidebar panel (off by default, turn on in the plugin list) showing live player,
      inventory and equipment data (confirmed 12 Oct 2026, 0.7.0). NPC/object IDs and game
      variables come with 2.2-2.6
- [ ] Data mapper: re-finds scrambled game names when Lost City updates their client

### Tier 11: Revision 377 content (build now, bug test when Lost City makes it live)

What 377 adds over 274. Brackets show its state in Lost City's files today:

- [ ] Slayer: task tracker, kill counter, task location on the map (scripted)
- [ ] Castle Wars: game timer, team scores, flag status (scripted)
- [ ] Abyss and runecrafting pouches: pouch tracking (scripted)
- [ ] Board games (Burthorpe): helpers (scripted)
- [ ] Barrows: brother tracker, tunnel map, reward potential (partly in files)
- [ ] Farming and Time Tracking: crop timers, birdhouse-style reminders (empty in files)
- [ ] Construction / Player-Owned House: room planner helpers (empty in files)
- [ ] Pest Control: portal health, points (empty in files)
- [ ] Champions' Challenge: scroll tracker (empty in files)
- [ ] Kingdom of Miscellania: approval and coffer tracker (via Throne of Miscellania)
- [ ] Clue Helper update: 377 restructures clue data, so the extractor needs updating
- [ ] Quest Helper: about 41 more quests (8 scripted so far: Cabin Fever, The Golem,
      Mourning's Ends Part 2, Recruitment Drive, Troll Romance, Monkey Madness,
      the 100th quest, and the Abyss miniquest)

## Phase 5: Polish and release

- [ ] 5.1 Code signing, so Windows stops showing the SmartScreen warning
- [ ] 5.2 macOS and Linux builds
- [ ] 5.3 Crash and error reporting
- [ ] 5.4 Website or GitHub page with downloads and changelog

---

## Not included

These RuneLite plugins are skipped because the content doesn't exist even at 377, or is
OSRS-only:
Grand Exchange, Achievement Diaries, Hunter, Implings, Herbiboar, Barbarian Assault,
Mage Training Arena, Blast Furnace, Motherlode Mine, Blast Mine, Wintertodt, Tithe Farm,
Pyramid Plunder, Nightmare Zone, Raids, Corp, Zalcano, Fight Caves, Fairy Rings,
Kourend Library, Driftnet, Rune Pouch, DPS Counter, Party, Team, Twitch, Jagex accounts,
Crowdsourcing, XP Globes and the full GPU / HD plugin (lighting, shadows, water: a separate
huge project, not promised; its textures are in Tier 8 as HD Textures).

Notes from the check:
- Tears of Guthix is in 377's quest list but not scripted yet. It moves into Tier 11 if
  Lost City scripts it.
- Fight Caves and Fairy Rings weren't found in either revision's scripts.
- No emote clues in 274.

## Appendix: the 63 quests at revision 274

Free: Black Knight's Fortress, Cook's Assistant, Demon Slayer, Doric's Quest, Dragon
Slayer, Ernest the Chicken, Goblin Diplomacy, Imp Catcher, Pirate's Treasure, Prince Ali
Rescue, Romeo & Juliet, Rune Mysteries, Sheep Shearer, Shield of Arrav, The Knight's
Sword, The Restless Ghost, Vampire Slayer, Witch's Potion.

Members: Big Chompy Bird Hunting, Biohazard, Clock Tower, Death Plateau, Digsite Quest,
Druidic Ritual, Dwarf Cannon, Eadgar's Ruse, Elemental Workshop, Family Crest, Fight Arena,
Fishing Contest, Gertrude's Cat, Hazeel Cult, Hero's Quest, Holy Grail, Horror from the
Deep, Jungle Potion, Legends Quest, Lost City, Merlin's Crystal, Monk's Friend, Murder
Mystery, Nature Spirit, Observatory Quest, Plague City, Priest in Peril, Regicide, Scorpion
Catcher, Sea Slug Quest, Shades of Mort'ton, Sheep Herder, Shilo Village, Tai Bwo Wannai
Trio, Temple of Ikov, The Fremennik Trials, The Grand Tree, The Tourist Trap, Tree Gnome
Village, Tribal Totem, Troll Stronghold, Underground Pass, Watch Tower, Waterfall Quest,
Witch's House.

## Open questions for you

- Final app name and logo?
- Which plugins move up or down the order?
- Any plugins you want that aren't listed?
