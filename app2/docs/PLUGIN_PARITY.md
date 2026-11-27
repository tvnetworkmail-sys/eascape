# Plugin parity: EASCape (2006 client) vs 2007RS (2007 client)

Every app plugin, feature by feature, against EASCape's version (`tvnetworkmail-sys/eascape`,
`app/src/plugins`). The plugin code is EASCape's; what differs is the client under it: the 2007
client shows itself to the runtime through `webclient/src/client/LostLite.ts`, and the runtime
takes its `c2007` path where the clients differ.

Status words:
- **works**: does what EASCape's does on the 2007 game (tried in the app where it says *tried*,
  otherwise checked in the code against what LostLite.ts gives)
- **fixed**: was broken or missing on 2007, fixed in this pass (commit given)
- **upgraded**: more than EASCape's, because the 2007 game or RuneLite does it
- **not possible**: and why

Commits of this pass: d12f578d (worn jewellery), f05258c8 (Menu Entry Swapper), bb3547c3
(overlay scaling, bank drag), a89d5fb8 (world map, clue scroll), fdf10321 (Quest Helper "Mark done"),
bec82132 (Opponent Information hitpoints), f425f476 (this file).

## Things that affect every plugin

| Feature | Status |
| --- | --- |
| Overlays at "Fit to window" | **fixed** (bb3547c3): info boxes and every overlay panel (Clue Scroll, Opponent Information, Slayer, XP Tracker, Woodcutting, Mining, Fishing, Cooking, Agility, timers) were laid out at 1x while the game was scaled up, so they looked tiny. They're laid out at the game's own size and scaled with the canvas, drawn at screen resolution (crisp), Alt-drag and tooltips mapped through the same scale. *Tried* at 2x. Everything else drawn on the game (outlines, names, ground item text, markers) is drawn into the game's own pixels and always scaled with it; the orbs, bank buttons, login tick boxes and world map window already followed the canvas. |
| Item ids | the server shows some of our objs to the 2007 client by other ids (`ids.json`); the plugins' item lists use ids below 7989, which 2007 kept, so they match |
| NPC ids | 215 of our NPCs are shown by other 2007 ids (Man variants, Gnome pilot ...). Plugins matching NPCs by id now match by name too where it matters (Clue Scroll); NPC Indicators, Slayer and Quest Helper match by name already |
| Loc ids | the 2007 map draws 2007's locs; the plugins' loc lists (trees, rocks, agility obstacles) are ids 2007 kept (checked against `locs.json`: none moved except two agility shortcuts, below) |
| Varps | the server sends EASCape's varps unchanged, so Barrows, Slayer, Farming, Kingdom, Crystal Bow, prayers and timers read the same values |
| Chat | the 2007 client's chat goes through `lostliteChat` (types mapped in `CHAT_KINDS`) |
| Menu | see Menu Entry Swapper |

## Worn jewellery (not a plugin)

| Feature | Status |
| --- | --- |
| Right-click a worn amulet of glory: Edgeville, Karamja, Draynor Village, Al Kharid | **fixed** (d12f578d), *tried*: each teleports, charges count down |
| Worn ring of dueling: Duel Arena, Castle Wars | **fixed**, *tried* |
| Worn games necklace: Burthorpe, Barbarian Outpost | **fixed**, *tried* |
| Warriors' Guild defensive shield: Block stab/blunt/slash/magic | **fixed** (same table; the catapult answers it) |
| Skills necklace, combat bracelet | **not possible**: our game doesn't have them (no content), as in EASCape |

How: the 2007 cache's objs have no worn options, so the client gets EASCape's `wornop1-4`
names from a table by 2007 obj id (`webclient/src/client/WornOps2007.ts`, keep it in step with
the `wornop` lines in content). They replace 2007's "Operate" (the tab's op 2, the same button 2)
and send the tab's button 2-5, which `eascape_worn_jewellery.rs2` already answers.

## Menu Entry Swapper

| Feature | Status |
| --- | --- |
| Custom swaps (`option, target` lines, wildcards) | works, *tried* (NPCs, objects, items) |
| Custom shift swaps | works, *tried* (shift-click Use on an item) |
| Hide options | works |
| Shift + right-click "Swap left click / Swap shift click / Reset" on NPCs | works, *tried* (Banker) |
| ... on objects | **fixed** (f05258c8): none appeared, and an object's Examine couldn't be swapped. The 2007 client gives an object's options its scene typecode but its Examine the plain loc id, so the runtime never saw them as one object. *Tried*: bank booth Use-quickly as the left click opens the bank |
| ... on inventory items | works, *tried* (Drop as left click drops) |
| ... on ground items | works, *tried* |
| ... on worn items (incl. the jewellery teleports) | works, *tried* |
| ... in the bank (Withdraw) and beside it (Deposit) | works, *tried* |
| Item choices kept per place | **upgraded** (as RuneLite): Withdraw-All in the bank, Deposit-All beside it, Drop in the inventory and a worn teleport no longer replace each other. Choices saved before keep applying everywhere |
| Charges and doses | **upgraded** (RuneLite's ItemVariationMapping): a swap set on Ring of dueling(8) applies at (6) |
| Swaps on NPCs whose Attack the game puts under Walk here (higher level) | works (the buried swap), unit-tested |
| "Walk here" swaps and hides | works (the 2007 client writes the NPC's name on Walk here; the rules still see it as Walk here) |
| Players | no customise entries (as RuneLite and EASCape) |
| Colour tags the app makes (`@~xx@`) | **fixed**: no longer stop a target being recognised |

## Camera

| Feature | Status |
| --- | --- |
| Mouse wheel zoom, inner/outer limits, speed, invert | works (LostLite `lostliteZoom`) |
| Ctrl to reset zoom | works |
| Middle-button camera, speed, invert yaw/pitch | works (the runtime turns the 2007 client's orbit camera) |
| Draw distance 25-50 (SD and HD) | works (2007-only setting) |
| Hide roofs | works (`lostliteHideRoofs`) |

## Login Screen

| Feature | Status |
| --- | --- |
| Remember username / password | works (the 2007 login box's own fields) |
| Hide username | works (`lostliteLoginUser` draws stars) |
| Tick boxes on the login box | works, scaled with the game |

## Bank

| Feature | Status |
| --- | --- |
| Search (button, Ctrl+F, chat box prompt, title shows the search) | works |
| Deposit inventory button | kept at the user's request (their own bank-all feature, `::appbankall`) |
| Dragging items while a search is showing | **fixed** (bb3547c3): the 2007 client sent the server a swap of the *shown* slots, moving the wrong items. The client now asks the app first (`lostliteInvDrag`, as EASCape's client did) |
| Placeholders | taken out in EASCape too (user's call, 31 Oct 2026) |
| Item swaps (Withdraw-X etc.) | see Menu Entry Swapper |

## Ground Items

| Feature | Status |
| --- | --- |
| Names, values, highlighted/hidden lists, colours, despawn timers, collapse, tile highlight | works (ground items from `api.groundItems`) |
| Menu: quantities, recolour/deprioritise hidden | works (menuAfter, after the swaps) |
| Hotkey, double-tap | works |

## NPC Indicators

| Feature | Status |
| --- | --- |
| Hull, tile, true tile, south-west tiles, colours, width | works (2007 client draws hulls on request: `lostliteWantsHull`) |
| Names over NPCs, menu colouring, ignore dead | works |
| Shift + right-click Tag | works (menu entry) |

## Object Markers, Ground Markers

| Feature | Status |
| --- | --- |
| Shift + right-click Mark object / Mark tile, outlines, colours | works (objects by the 2007 loc id the client shows) |

## Status Orbs

| Feature | Status |
| --- | --- |
| Hitpoints, prayer, run, special orbs (the Sept 2007 frame has none of its own) | works, scaled with the game |
| Run orb toggles run, prayer orb opens prayers, special orb turns the special on, poisoned HP orb drinks an antipoison | works (the 2007 options tab's run button, its own tab script) |
| World map button | works |

## Dialogue Keys

| Feature | Status |
| --- | --- |
| Space to continue, 1-5 choose, numbers shown | works (2007 dialogue components, pause buttons) |
| Light the chosen option | works differently: the 2007 game's own feedback replaces the chosen line with "Please wait..." until the server answers (keys and clicks both), so the app's colour isn't added |

## Idle Notifier

| Feature | Status |
| --- | --- |
| Animation idle, interaction idle, logout warning, timeout | works (`idleTimer` from the 2007 client's idle cycles; skilling animation ids are the ones 2007 kept) |
| Low hitpoints / prayer / run / special | works |

## XP Drops, XP Tracker

| Feature | Status |
| --- | --- |
| Drops with the 2007 game's skill icons, colour, duration, counter, grouping | works |
| Tracker panel, rates, per-skill, save state, pause on logout, on-screen panel | works (23 skills: Hunter and Construction added) |

## Info Boxes

| Feature | Status |
| --- | --- |
| Boosts, boost timer, logout timer, prayers, prayer potion | works (prayer varps 83-97, 2007 sprites) |
| Layout: size, vertical, wrap, gap, font, outline, background, Alt-drag, reset | works; **fixed**: scaled with the game |
| Off-screen hint arrow | works |

## Opponent Information

| Feature | Status |
| --- | --- |
| Name and health bar for 5 s after the fight | works |
| Hitpoints display ("5/7") | **upgraded**: the 2007 game sends a health bar, not hitpoints, so it showed a percentage only. As RuneLite does, NPCs with known hitpoints (`npchp.json`, from our content by 2007 id) get them back from the bar. Players and unknown NPCs: percentage (**not possible** otherwise: the 2007 protocol doesn't carry hitpoints) |

## Woodcutting, Mining, Fishing, Cooking

| Feature | Status |
| --- | --- |
| Session panels (logs, ores, fish, cooked/burnt), timeouts | works (chat messages and animations unchanged) |
| Tree stumps / rock respawn timers | works (2007 tree and rock ids are the ones in the lists; the 2007 Varrock rocks were added earlier) |
| Fishing spot highlights, icons, names | works |
| Cooking ferment timer | works |

## Agility

| Feature | Status |
| --- | --- |
| Clickboxes, lap count, laps to level, laps per hour, shortcut highlights | works for the three courses our game has (Gnome, Barbarian, Wilderness) |
| Two shortcuts (our locs 2830 and 2831, levels 25 and 1) | **not possible** to tell apart: the 2007 map draws both as one 2007 loc (2836), so they aren't highlighted with a level |
| Ape Atoll, Werewolf, Pyramid courses | **not possible**: not in our game's content |

## Timers and Buffs

(Full rewrite left for later, as asked.)

| Feature | Status |
| --- | --- |
| Antipoison, antifire, charge, freezes (bind/snare/entangle, ancients), pickpocket stun, teleblock, TzHaar | works (chat messages, spot animations 2007 kept, varps; 2007 spell sprites) |

## Slayer

| Feature | Status |
| --- | --- |
| Task info box, count on the enchanted gem, highlights, weakness prompt, !task | works (task varps 394/395) |

## Barrows Brothers

| Feature | Status |
| --- | --- |
| Brothers panel and reward potential, minimap letters, prayer drain timer, puzzle answer | works (drawn by the plugin on 2007; EASCape's client drew it itself) |

## Kingdom of Miscellania, Farming (Time Tracking), Crystal Bow

| Feature | Status |
| --- | --- |
| Approval/coffer info box | works (varps) |
| Patch states and timers from the server's farming varps | works |
| Charges warning | works (varp 801) |

## Quest Helper

| Feature | Status |
| --- | --- |
| Guides, highlights, routes (game view and world map), hint arrow, option marking | works on the 2007 quest list and journal (component ids from `tools/quests/com2007.py`) |
| Dev "Mark done" on the quest list | **fixed**: the 2007 list's lines say "Read Journal" (the quest is the line's text), so the entry never appeared. It reads the line now, knows the 2007 names (Rune Mysteries, The Digsite, Sea Slug, Watchtower, Fairytale I - Growing Pains) and the quests added after 2006 that `::questdone` completes (Between a Rock..., The Feud, Ghosts Ahoy, Icthlarin's Little Helper, Mountain Daughter, One Small Favour, Roving Elves, Creature of Fenkenstrain). *Tried*: Black Knights' Fortress completes with the reward scroll, 3 quest points, 2,500 coins. Quests our game doesn't have (Clock Tower, Elemental Workshop, ...) get no entry |

## Clue Scroll

| Feature | Status |
| --- | --- |
| Clue found from the inventory, answer panel (riddles, anagrams, coordinates, maps, NPCs, searches, keys, challenges, puzzle boxes) | works (the user saw "Speak to Ulizius"); the panel now scales with the game |
| Highlight and hint arrow on the NPC | **fixed**: also by name, since some NPCs reach the 2007 client by other ids |
| World map marker | works |
| Route line on the world map, map opening on you and the spot | **upgraded** (a89d5fb8): every spot marked, a line along the walking route to the nearest (straight while it's worked out), the map opens zoomed to show you and the spot. *Tried* (Al Kharid tanner from Varrock) |
| Puzzle box solver | works on the 2007 puzzle window |
| Clue data | refreshed from our content where newer (Ellis, Karim, more key droppers) |
| The 58 clue scrolls 377 added (medium/hard anagrams 21-26, maps, riddles, sextants) | **not possible yet**: our content has their objs but no clue data or scripts (the server never hands them out), so there's nothing to show. They need content first |

## Loot Tracker, Chat Notifications, Private Messages

| Feature | Status |
| --- | --- |
| Kills, Barrows chest (2007's 364), clue caskets | works |
| Highlight words/regex, own name, trade/duel/PM notifications | works (2007 chat types mapped) |
| Tab to reply | works (the friends list's own prompt) |

## World Map

| Feature | Status |
| --- | --- |
| The 2007 map, labels, icons, floors, you, follow, hotkey | works |
| Dungeons drawn as islands north of the land | **fixed** (a89d5fb8): surface only, as the 2007 map; dragging stays on the surface; underground there's no "you" and the map opens where you last were on the surface |
| Markers and routes from Quest Helper and Clue Scroll | works |

## Developer Tools, Extras, Info panel, World switcher

| Feature | Status |
| --- | --- |
| Player, inventory, equipment, NPCs, players, objects | works |
| Attack style kept between logins, autocast set again | works (`::appextras`) |
| Info panel, world switcher | works (app-side, not client-specific) |
