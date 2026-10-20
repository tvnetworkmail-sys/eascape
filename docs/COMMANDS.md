# EASCape test commands

Type these in the chat box starting with `::`. They work while the server runs in test mode
(the default on your PC), where every account is a developer.

## EASCape's own

| Command | What it does |
|---|---|
| `::maxstats` | Every skill to 99, hitpoints and prayer topped up |
| `::restore` | Every stat back to its normal level (hitpoints and prayer full, boosts and drains gone), full run energy, poison cured |
| `::herbset` | 1,000 of every herb (grimy and clean), every secondary ingredient and 1,000 vials of water in your bank; a pestle and mortar in your pack |
| `::barrowset` | Banks what you have, then gives the Barrows magic setup, the ranged switch for Ahrim and supplies |
| `::barrowsgear` | Every Barrows piece and 1,000 bolt racks in your bank; a broken and a 50 Dharok's helm and 100,000 coins in your pack |
| `::onehit` / `::onehitoff` | Every melee, ranged or spell hit kills what you're fighting / back to normal (also off when you log out) |
| `::questdone priestperil` | Marks a quest complete on your own account, to test past its locks (`::questdone naturespirit` for Nature Spirit's Mort Myre gate). `::questdone list` shows every quest's name |
| `::jewels` | One of each 2006 enchanted jewellery piece in your pack, fully charged (glory, dueling, games necklace, wealth, life, recoil, forging) |
| `::slayertask dustdevil 20` | Gives you that Slayer task with that many left to kill (no level or quest check). `::slayertask list` shows the monster names |
| `::questhelper cook` | Quest Helper: follow that quest (chat line on each new step, the yellow arrow, the step in its journal). `::questhelper off` stops, `::questhelper list` shows the quests with guides. Works for every player, not just in test mode |
| `::fightwave 30` | Into the TzHaar Fight Cave starting at that wave (`::fightwave 63` is TzTok-Jad) |
| `::tele barrows` | By Ahrim's mound |
| `::tele bob` | Bob in Lumbridge (Barrows repairs) |
| `::tele tzhaar` | Mor Ul Rek, by the Fight Cave entrance |
| `::tele fightpit` | Outside the Fight Pit's waiting room door |

## Moving around

| Command | What it does |
|---|---|
| `::tele 0,50,50,22,18` | To a coordinate: level, map square x, map square y, tile x, tile y |
| `::getcoord` | Shows where you are, in the same form |
| `::~home` | Lumbridge (also `::~varrock`, `::~falador`, `::~draynor`, `::~portsarim`, `::~rimmington`, `::~alkharid`, `::~seers`, `::~ardy`, `::~brimhaven`, `::~entrana`, `::~cw`, `::~duel`, `::~ma`, `::~kbd`, `::~kq`, `::~mortton`, `::~trawler`, `::~gamesroom`, `::~teleabyss`) |
| `::~north 5` | Steps you 5 squares north (also `::~south`, `::~east`, `::~west`) |
| `::fly` | Toggles walking through anything |
| `::speed 600` | Sets how long a game tick lasts, in milliseconds (600 is normal; lower runs the whole world faster) |

## Items and stats

| Command | What it does |
|---|---|
| `::give shark 10` | Adds an item (the item's name with underscores) |
| `::givemany shark` | Up to 1,000 of an item |
| `::setstat attack 99` | Sets a skill to a level |
| `::advancestat attack 99` | Levels a skill up to that level, with the level-up messages |
| `::minme` | Every skill back to 1 (hitpoints 10) |

## Game settings and testing

| Command | What it does |
|---|---|
| `::setvar name 1` / `::getvar name` | Sets / shows one of your game settings by name |
| `::npcadd name` | Spawns an NPC next to you |
| `::locadd name` | Puts a scenery object where you stand |
| `::reload` | Reloads changed scripts without restarting |
| `::rebuild` | Rebuilds the game files and reloads them |
