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
| `::questdone priestperil` | Marks a quest complete on your own account, to test past its locks (`::questdone naturespirit` for Nature Spirit's Mort Myre gate; `::questdone deserttreasure` for the Ancient Magicks altar). `::questdone list` shows every quest's name |
| `::dtpack` | Every item Desert Treasure needs (needs 24 free spaces): 10,000 coins, the magic logs, steel bars and molten glass as notes, ashes, charcoal, a blood rune, bones, a silver bar, garlic powder, spice, a cake, spiked and climbing boots, a facemask, a tinderbox, ice gloves, 10 Shantay passes, 2 waterskins, 3 lockpicks and 50 noted. One pack like this is added for every quest from now on |
| `::spellbookswap` | Swaps between the normal spells and the Ancient Magicks. `::spellbookswap ancient` or `::spellbookswap normal` picks one. Works whether or not Desert Treasure is done |
| `::allrunes` | 100,000 of each of the 13 runes in the 2006 game (air, water, earth, fire, mind, body, cosmic, chaos, nature, law, death, blood, soul) |
| `::warriorsguildpack` | Warriors' Guild testing (needs 12 free spaces): a bronze and a rune full helm, platebody and platelegs for the animators, 200 tokens for the cyclopes, a pestle and mortar, ashes and ground ashes for the shot put, and an iron defender to show Kamfreena |
| `::wgtokens 50` | Puts that many tokens in your Warriors' Guild ledger, to claim from any of the staff |
| `::farmingpack` | Farming testing (needs 22 free spaces): rake, seed dibber, spade, a full watering can, 10 compost and 10 supercompost (noted: unnote at a bank), 3 plant cures, and seeds for every patch type: potato, sweetcorn, watermelon, marigold, nasturtium, limpwurt, guam, ranarr, torstol, barley, hammerstone, wildblood, jute, and a scarecrow |
| `::farmgrow` | Grows every planted patch straight to harvest, with no disease |
| `::farmtick 16` | Runs that many 5-minute growth ticks now (most 128), disease chances included. 16 ticks is 80 minutes: herbs go from seed to grown |
| `::jewels` | One of each 2006 enchanted jewellery piece in your pack, fully charged (glory, dueling, games necklace, wealth, life, recoil, forging) |
| `::slayertask dustdevil 20` | Gives you that Slayer task with that many left to kill (no level or quest check). `::slayertask list` shows the monster names |
| `::questhelper cook` | Quest Helper: follow that quest (chat line on each new step, the yellow arrow, the step in its journal). `::questhelper off` stops, `::questhelper list` shows the quests with guides (cook, priestperil, waterfall, troll, ikov, itexam, desertrescue, deserttreasure). Works for every player, not just in test mode |
| `::fightwave 30` | Into the TzHaar Fight Cave starting at that wave (`::fightwave 63` is TzTok-Jad) |
| `::tele barrows` | By Ahrim's mound |
| `::tele bob` | Bob in Lumbridge (Barrows repairs) |
| `::tele tzhaar` | Mor Ul Rek, by the Fight Cave entrance |
| `::tele fightpit` | Outside the Fight Pit's waiting room door |
| `::tele warriorsguild` | Just inside the Warriors' Guild's front door |

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
