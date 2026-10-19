# EASCape test commands

Type these in the chat box starting with `::`. They work while the server runs in test mode
(the default on your PC), where every account is a developer.

## EASCape's own

| Command | What it does |
|---|---|
| `::maxstats` | Every skill to 99, hitpoints and prayer topped up |
| `::barrowset` | Banks what you have, then gives the Barrows magic setup, the ranged switch for Ahrim and supplies |
| `::barrowsgear` | Every Barrows piece and 1,000 bolt racks in your bank; a broken and a 50 Dharok's helm and 100,000 coins in your pack |
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
