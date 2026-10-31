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
| `::fairytale1pack` | The items A Fairy Tale Pt. 1 (Fairytale I) needs: secateurs, a spade, a ghostspeak amulet and a dramen staff; once Malignius has named them, run it again for the three items the Nature Spirit needs. `::questdone fairytale1` marks it done; `::questhelper fairy_farmers` follows its guide |
| `::fairytale2pack` | What Fairytale II - Cure a Queen needs you to bring: a dramen staff, a vial of water and a pestle and mortar, plus Nuff's certificate while the quest needs it. `::questdone fairytale2` marks it done (and leaves the fairy rings working); `::questhelper fairy2` follows its guide |
| `::abysspack` | For the Abyss: a rune pickaxe, rune axe and tinderbox for the outer ring's obstacles, the four essence pouches and 20 pure essence. `::teleabyss` drops you straight into the Abyss |
| `::ft2look` | Fairytale II (being built): puts the 25 new people and creatures from the 2007 cache around you for a minute, so you can check how they look and move |
| `::ft2song 1` / `2` / `3` | Fairytale II (being built): plays its new music: 1 We are the Fairies, 2 Dimension X, 3 All's Fairy in Love & War |
| `::ft2place 1`-`5` | Fairytale II (being built): takes you next to the fairy ring in each place the 2007 map adds: 1 the Fairy Resistance hideout, 2 the cosmic entity's plane, 3 Gorak's plane, 4 the Enchanted Valley, 5 the Abyssal area |
| `::fairyrings` / `::fairyrings 2` | Fairytale II (being built): the fairy rings work without the quest's permission, and gives you a dramen staff to wield; `2` also fills the travel log with every code. Run `::fairyrings` again to lock them |
| `::spellbookswap` | Swaps between the normal spells and the Ancient Magicks. `::spellbookswap ancient` or `::spellbookswap normal` picks one. Works whether or not Desert Treasure is done |
| `::allrunes` | 100,000 of each of the 13 runes in the 2006 game (air, water, earth, fire, mind, body, cosmic, chaos, nature, law, death, blood, soul) |
| `::warriorsguildpack` | Warriors' Guild testing (needs 12 free spaces): a bronze and a rune full helm, platebody and platelegs for the animators, 200 tokens for the cyclopes, a pestle and mortar, ashes and ground ashes for the shot put, and an iron defender to show Kamfreena |
| `::wgtokens 50` | Puts that many tokens in your Warriors' Guild ledger, to claim from any of the staff |
| `::farmingpack` | Farming testing (needs 22 free spaces): rake, seed dibber, spade, a full watering can, 10 compost and 10 supercompost (noted: unnote at a bank), 3 plant cures, and seeds for every patch type: potato, sweetcorn, watermelon, marigold, nasturtium, limpwurt, guam, ranarr, torstol, barley, hammerstone, wildblood, jute, and a scarecrow |
| `::farmtreepack` | Farming step 2a testing (needs 24 free spaces): spade, rake, secateurs, gardening trowel, full watering can, rune axe, 10 plant pots (noted: unnote at a bank), 3 each of acorns, magic, apple and palm tree seeds, a sapling of every tree and of apple, banana, orange, papaya and palm, 5 compost (noted), a seed dibber and 3 each of redberry and poison ivy bush seeds (needs 27 free spaces). `::farmgrow` brings planted trees to their health check; `::farmtick 32` runs 160 minutes (a fruit tree tick) |
| `::farmgrow` | Grows every planted patch straight to harvest, with no disease |
| `::farmtick 16` | Runs that many 5-minute growth ticks now (most 128), disease chances included. 16 ticks is 80 minutes: herbs go from seed to grown |
| `::jewels` | One of each 2006 enchanted jewellery piece in your pack, fully charged (glory, dueling, games necklace, wealth, life, recoil, forging) |
| `::slayertask dustdevil 20` | Gives you that Slayer task with that many left to kill (no level or quest check). `::slayertask list` shows the monster names |
| `::questhelper cook` | Quest Helper: follow that quest (chat line on each new step, the yellow arrow, the step in its journal). `::questhelper off` stops, `::questhelper list` shows the keys of all 70 guides (one for every quest in the game). Opening a quest's journal starts its guide too. Works for every player, not just in test mode |
| `::questpacks` | Lists every quest pack command |
| `::demonpack` (and so on) | The items one quest needs (the wiki's "Items required", as our items). One for each of the 69 quests built (Desert Treasure keeps its own `::dtpack`; quests that need no items just say so): the name is the quest's key, the same one `::questhelper` uses, plus `pack`. What doesn't fit in your pack goes to your bank. Skills and the quests it needs first: `::maxstats` and `::questdone` |
| `::fightwave 30` | Into the TzHaar Fight Cave starting at that wave (`::fightwave 63` is TzTok-Jad) |
| `::tele barrows` | By Ahrim's mound |
| `::tele bob` | Bob in Lumbridge (Barrows repairs) |
| `::tele tzhaar` | Mor Ul Rek, by the Fight Cave entrance |
| `::tele fightpit` | Outside the Fight Pit's waiting room door |
| `::tele warriorsguild` | Just inside the Warriors' Guild's front door |
| `::tele wyverns` | Outside the Icy Cavern to the skeletal wyverns (Asgarnian Ice Dungeon) |
| `::tele lavamaze` | By the Lava Maze's rune rocks |
| `::tele wildmine` | The Wilderness mine with mithril, adamantite and iron rocks |

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
