# Hiscores: Boss kills and NPC kills (website pages for eascape-live)

The game side is in eascape (engine/Hiscores.ts, engine/KillStore.ts, web.ts). The website's
hiscores pages exist only in eascape-live, so they're built there from this. The owner approved
the mockups here on 16 Nov 2026 (names and numbers in them are made up).

- `npc_kills_mockup.png`: far left is the real Overall table for comparison, then the NPC kills
  page: the opening list, typing "giant", an NPC's hiscores, and an NPC nobody has killed.
- `boss_kills_mockup.png`: the left list with Boss kills, and a boss's table (it should start at
  the top of its box, like the NPC kills tables do).
- `player_page_mockup.png`: a player's page with Boss kills and NPC kills under the skills (the
  skills table keeps its normal layout; it only shifted in this mockup).

## Data, from the game's web server (`http://127.0.0.1:8888`, like `/hiscores/player/:name`)

- `GET /hiscores/player/:name` also returns `bosses: [{key, name, rank, kills}]` and
  `npcs: {total: {rank, kills}, list: [{name, rank, kills}]}` (most kills first; rank -1 = none).
- `GET /hiscores/kills?table=<key>&rank=<n>` or `&name=<player>` returns
  `{title, rows: [{rank, name, kills}], total}`. `table`: a boss key (`dagannoth_rex`,
  `dagannoth_prime`, `dagannoth_supreme`, `barrows`, `kalphite_queen`, `king_black_dragon`,
  `tztok_jad`), `npc:<NPC name>` or `npc:all`. No rows = nobody has killed it yet; 404 = no such
  table.
- `GET /hiscores/kills/tables` returns `{bosses: [{key, name}], npcs: [every NPC name, A to Z]}`.
- `GET /hiscores/kills/records` returns `[{npc, name, kills}]`: the most kills of each NPC and who
  has them, most first.

## Pages (`lc/hiscores/index.ejs`, `lc/hiscores/player.ejs`, `webpages.ts`), in the normal design

1. Left list, under Runecraft: a white bold "Boss kills" heading, the 7 bosses as normal green
   links, then a white bold "NPC kills" link.
2. A boss's table: built like the skill tables (one cell per column, rows split by `<br>`), with
   Rank, Name and Kills, titled "<Boss> kills". Search by rank and by name work as now.
3. The NPC kills page, in the same black table area (no extra boxes or backgrounds):
   - "Find an NPC" and a plain text search box at the top.
   - Before typing: "Most kills of each NPC", with NPC, Player and Kills (from `/records`).
   - While typing: every matching NPC from `/tables`, "N NPCs match - pick one", with NPC, Top
     player and Kills ("Nobody yet" and "-" when no one has killed it). Enter picks the top match.
     It works like the item search on `/test/rs2.cgi`.
   - Picking an NPC: "<NPC> - all NPCs" (a link back) and its Rank, Name and Kills table, or
     "Nobody has killed a <NPC> yet."
4. Spacing: about 24px before the Kills column, about 10px between the other columns.
5. Every hiscores table starts at the top of its box (top-aligned), not halfway down.
6. The player page: under the skills, "Boss kills" (all 7 bosses, Rank and Kills, "-" when
   unranked), then "NPC kills" ("All NPCs", then each NPC they've killed, most first), with the
   same columns and green links as the skills; each link opens that table.

Bosses are left out of NPC kills; Chaos Elemental and Giant Mole count as ordinary NPCs.
