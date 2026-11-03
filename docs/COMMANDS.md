# EASCape test commands

Type these in the chat box starting with `::`. They work while the server runs in test mode
(the default on your PC), where every account is a developer.

## EASCape's own

| Command | What it does |
|---|---|
| `::maxstats` | Every skill to 99, hitpoints and prayer topped up |
| `::restore` | Every stat back to its normal level (hitpoints and prayer full, boosts and drains gone), full run energy, poison cured |
| `::clearinv bank` | Empties your bank (no undo). `::clearinv` on its own empties your pack, `::clearinv worn` what you're wearing |
| `::herbset` | 1,000 of every herb (grimy and clean), every secondary ingredient and 1,000 vials of water in your bank; a pestle and mortar in your pack |
| `::barrowset` | Banks what you have, then gives the Barrows magic setup, the ranged switch for Ahrim and supplies |
| `::barrowsgear` | Every Barrows piece and 1,000 bolt racks in your bank; a broken and a 50 Dharok's helm and 100,000 coins in your pack |
| `::onehit` / `::onehitoff` | Every melee, ranged or spell hit kills what you're fighting / back to normal (also off when you log out) |
| `::questdone priestperil` | Marks a quest complete on your own account, to test past its locks (`::questdone naturespirit` for Nature Spirit's Mort Myre gate; `::questdone deserttreasure` for the Ancient Magicks altar). `::questdone list` shows every quest's name. It gives what finishing the quest gives: quest points, experience, the reward items (on the ground if your pack is full) and the quest's "Quest complete" scroll; Tourist Trap and Legends' Quest ask which skills. A quest already done is left alone. The app's quest list has "Mark done" for every quest in the game |
| `::dtpack` | Every item Desert Treasure needs (needs 24 free spaces): 10,000 coins, the magic logs, steel bars and molten glass as notes, ashes, charcoal, a blood rune, bones, a silver bar, garlic powder, spice, a cake, spiked and climbing boots, a facemask, a tinderbox, ice gloves, 10 Shantay passes, 2 waterskins, 3 lockpicks and 50 noted. One pack like this is added for every quest from now on |
| `::fairytale1pack` | The items A Fairy Tale Pt. 1 (Fairytale I) needs: secateurs, a spade, a ghostspeak amulet and a dramen staff; once Malignius has named them, run it again for the three items the Nature Spirit needs. `::questdone fairytale1` marks it done; `::questhelper fairy_farmers` follows its guide |
| `::fairytale2pack` | What Fairytale II - Cure a Queen needs you to bring: a dramen staff, a vial of water and a pestle and mortar, plus Nuff's certificate while the quest needs it, and a star flower and gorak claws once Fairy Nuff wants the potion of magic essence. `::questdone fairytale2` marks it done with its rewards (Herblore and Thieving XP, the antique lamp, the fairy rings); `::questhelper fairy2` follows its guide |
| `::abysspack` | For the Abyss: a rune pickaxe, rune axe and tinderbox for the outer ring's obstacles, the four essence pouches and 20 pure essence. `::teleabyss` drops you straight into the Abyss |
| `::rcupack` | For the RuneCraft update: a tiara mould, 5 silver bars, air/water/earth/fire talismans, 100 of each elemental rune, 20 cosmic runes, 2 emerald necklaces and 10 pure essence |
| `::ft2look` | Fairytale II (being built): puts the 25 new people and creatures from the 2007 cache around you for a minute, so you can check how they look and move |
| `::ft2song 1` / `2` / `3` | Fairytale II (being built): plays its new music: 1 We are the Fairies, 2 Dimension X, 3 All's Fairy in Love & War |
| `::ft2place 1`-`5` | Fairytale II (being built): takes you next to the fairy ring in each place the 2007 map adds: 1 the Fairy Resistance hideout, 2 the cosmic entity's plane, 3 Gorak's plane, 4 the Enchanted Valley, 5 the Abyssal area |
| `::fairyrings` / `::fairyrings 2` | Fairytale II (being built): the fairy rings work without the quest's permission, and gives you a dramen staff to wield; `2` also fills the travel log with every code. Run `::fairyrings` again to lock them |
| `::combat07` | The 2007 combat tabs on or off (what the app's "2007 interface" plugin does), so you can try them in the web game |
| `::crystalbow <n>` / `::crystalshield <n>` | Use up n charges of the crystal bow / shield you are wearing (as n shots / hits), then say what is left |
| `::spellbookswap` | Swaps between the normal spells and the Ancient Magicks. `::spellbookswap ancient` or `::spellbookswap normal` picks one. Works whether or not Desert Treasure is done |
| `::allrunes` | 100,000 of each of the 13 runes in the 2006 game (air, water, earth, fire, mind, body, cosmic, chaos, nature, law, death, blood, soul) |
| `::warriorsguildpack` | Warriors' Guild testing (needs 12 free spaces): a bronze and a rune full helm, platebody and platelegs for the animators, 200 tokens for the cyclopes, a pestle and mortar, ashes and ground ashes for the shot put, and an iron defender to show Kamfreena |
| `::wgtokens 50` | Puts that many tokens in your Warriors' Guild ledger, to claim from any of the staff |
| `::farmingpack` | Farming testing (needs 22 free spaces): rake, seed dibber, spade, a full watering can, 10 compost and 10 supercompost (noted: unnote at a bank), 3 plant cures, and seeds for every patch type: potato, sweetcorn, watermelon, marigold, nasturtium, limpwurt, guam, ranarr, torstol, barley, hammerstone, wildblood, jute, and a scarecrow |
| `::farmtreepack` | Farming step 2a testing (needs 24 free spaces): spade, rake, secateurs, gardening trowel, full watering can, rune axe, 10 plant pots (noted: unnote at a bank), 3 each of acorns, magic, apple and palm tree seeds, a sapling of every tree and of apple, banana, orange, papaya and palm, 5 compost (noted), a seed dibber and 3 each of redberry and poison ivy bush seeds (needs 27 free spaces). `::farmgrow` brings planted trees to their health check; `::farmtick 32` runs 160 minutes (a fruit tree tick) |
| `::farmspecialpack` | Farming step 2c testing (needs 12 free spaces): spade, rake, seed dibber, secateurs, rune axe, 2 plant cures, 2 each of cactus, belladonna and mushroom seeds, a calquat sapling and a spirit tree sapling. Grow with `::farmgrow` |
| `::farmerpack` | Farming step 2e: potato seeds and 2 buckets of compost (allotment farmers), an oak sapling and a basket of tomatoes (tree gardeners), 5 monkey nuts and a monkey bar (Frizzy Skernip), empty basket and sack, tomatoes and potatoes. Needs 13 free spaces. |
| `::miscstatus` | Managing Miscellania check: approval % (and out of 127), coffer, resource points, minutes to the next daily update, how the 10 workers are split (herbs or flax) and what Advisor Ghrim would hand over if you collected now. |
| `::miscday 3` | Pretends that many days (1-30) have passed, runs the kingdom's daily update and shows the coffer and approval before and after, then `::miscstatus`. Needs Throne of Miscellania done (`::questdone misc`). |
| `::miscapproval 75` | Sets your kingdom approval to that percentage. |
| `::farmgrow` | Grows every planted patch straight to harvest, with no disease |
| `::farmtick 16` | Runs that many 5-minute growth ticks now (most 128), disease chances included. 16 ticks is 80 minutes: herbs go from seed to grown |
| `::jewels` | One of each 2006 enchanted jewellery piece in your pack, fully charged (glory, dueling, games necklace, wealth, life, recoil, forging) |
| `::slayertask dustdevil 20` | Gives you that Slayer task with that many left to kill (no level or quest check). `::slayertask list` shows the monster names |
| `::questhelper cook` | Quest Helper: follow that quest (chat line on each new step, the yellow arrow, the step in its journal). `::questhelper off` stops, `::questhelper list` shows the keys of all 70 guides (one for every quest in the game). Opening a quest's journal starts its guide too. Works for every player, not just in test mode |
| `::questpacks` | Lists every quest pack command |
| `::demonpack` (and so on) | The items one quest needs (the wiki's "Items required", as our items). One for each of the 69 quests built (Desert Treasure keeps its own `::dtpack`; quests that need no items just say so): the name is the quest's key, the same one `::questhelper` uses, plus `pack`. What doesn't fit in your pack goes to your bank. Skills and the quests it needs first: `::maxstats` and `::questdone` |
| `::ghostsahoypack` | The items Ghosts Ahoy needs: a ghostspeak amulet, leather gloves, a bowl of water, a bucket of milk, silk, a needle, 5 thread, a knife, one dye of each colour, an oak longbow, a spade, a bucket of ectoplasm, 100 ectotokens and 500 coins. `::questdone ghostsahoy` marks it done |
| `::ectopack` | A start at the Ectofuntus: 7 empty pots, 7 bones and 6 empty buckets (anything that doesn't fit goes to your bank) |
| `::hampack` | A lockpick, and puts you by the H.A.M. Hideout's trapdoor between Lumbridge and Draynor |
| `::onesmallfavourpack` | The items One Small Favour needs: 3 steel bars, a bowl of water, an empty cup, a harralander, 2 guam leaves, a marrentill, 3,000 coins, a chisel, a hammer, a bronze, iron and steel bar, a rune pickaxe, 5 pigeon cages and an empty pot |
| `::osfstage <n>` | Sets One Small Favour's stage to test one favour (the OSRS values: 5 forester, 10 Shanks, 15 Brian, 20 Aggie, 25 Johanhus, 45 Fred, 50 Seth, 55 Horvik, 60 Apothecary, 65 Tassie, 70 Hammerspike, 75 Sanfew, 80 tea for Bleemadge, 88 Arhein, 90 Farsight, 95 sculpture, 100 Cromperty, 105 Tindel, 110 Rantz, 115 Gnormadium, 120 landing lights, 130 Rantz, 135 Tindel, 140 Cromperty, 145 the scroll, 152 free Petra, 155 Farsight, 160 weather vane, 170 the report, 175 Bleemadge, 180 Sanfew, 185 Hammerspike, 195 Tassie, 200 pot lid, 205 Horvik, 210 pigeon cages, 215 Seth, 220 Johanhus, 225 Aggie, 230 Brian, 235 forester, 240 Yanni). `::questdone onesmallfavour` finishes it |
| `::mountaindaughterpack` | The items Mountain Daughter needs: a rope, a pickaxe, an axe, a plank, a staff and leather gloves |
| `::mdstage <n>` | Sets Mountain Daughter's stage (ours: 10 Hamal lets you search, 20 Asleif's two tasks, 30 both done, 40 find her killer, 50 the Kendal dead, 60 the burial). `::questdone mdaughter` finishes it |
| `::betweenarockpack` | The items Between a Rock... needs: a rune pickaxe, 4 gold bars, a hammer, an ammo mould and 1,000 coins |
| `::barstage <n>` | Sets Between a Rock...'s stage (ours: 10 Dondakan, 20 find Rolad, 30 find the pages, 40 the book, 50 read it, 60 a new material, 70 the schematics, 80 been inside the rock, 90 the avatar dead). `::questdone dwarfrock` finishes it |
| `::feudpack` | The items The Feud needs: 2,000 coins, a Kharidian headpiece and fake beard, 3 beers, a bucket and leather gloves (you need 30 Thieving to start) |
| `::feudstage <n>` | Sets The Feud's stage (the OSRS game's values: 1 started, 2 Drunken Ali told, 3 gangs asked, 4 camels bought, 5 camels refused, 6 joined, 7-12 the three pockets, 13 keys, 14 staked out, 15 jewels, 16 traitor task, 17 traitor found, 18 snake given, 22 poison, 23 drink poisoned, 24 meet the leader, 25 Menaphites beaten, 26 bandits beaten, 27 mayor thanked). `::questdone feud` finishes it |
| `::icspack` | The items Icthlarin's Little Helper needs: a kitten, a full waterskin, a tinderbox, willow logs, a bucket, a knife, 100 coins and a ghostspeak amulet (you need Gertrude's Cat done to start) |
| `::icssupplies` | The embalmer's three things for Icthlarin's Little Helper: a sheet of linen, the purified salt and a bucket of sap |
| `::ltpack` | The items The Lost Tribe needs: a pickaxe, a lit candle and a tinderbox (you need Goblin Diplomacy and Rune Mysteries done, 13 Agility, 13 Thieving, 17 Mining) |
| `::ltstage 45` | Sets The Lost Tribe's stage: 10 started, 20 Bob told, 30 Duke's permission, 35 tunnel dug, 40 brooch shown, 41 Reldo, 43 book read, 44 generals, 45 Duke told, 46 met Mistag, 47 silverware missing, 48 robes, 49 silverware found, 50 treaty, 100 complete. `::questdone losttribe` marks it done |
| `::gdpack` | The items The Giant Dwarf needs: 2,000 coins, coal, logs, a tinderbox, air and law runes (Telekinetic Grab), an iron bar, three cut sapphires and a redberry pie, plus (noted) 5 each of clay and the ores and 4 each of the bars the Consortium's errands ask for (you need 12 Crafting, 16 Firemaking, 33 Magic, 14 Thieving; the errands want them un-noted) |
| `::gdstage 50` | Sets The Giant Dwarf's stage: 10 crashed and arrested, 20 Veldaban agreed, 30 Blasidar's errands, 40 Riki has everything, 50 the Consortium (also gives 100 points with, and membership of, the Purple Pewter), 60 promised to speak for the Purple Pewter (go to Veldaban for the meeting), 100 complete; 0 resets it all. Riki and the statue follow. `::questdone giantdwarf` marks it done |
| `::gdcrash` | Plays The Giant Dwarf's opening film (the story text, the titles and the boat hitting the statue on the map) and brings you back, without changing the quest |
| `::rdstage <n>` | The Rogues' Den maze. `::rdstage 0` takes you to Brian O'Richard and lets you into the maze as if you had talked to him; 1-12 start a game (carry and wear nothing, as the doorway wants; already in the maze it just moves you) at: 1 the doorway, 2 the first contortion bars, 3 the first ledge, 4 the floor blades, 5 the mosaic tiles, 6 the grill room, 7 the gear door, 8 the flash powder and guards, 9 the last two pendulums, 10 the wall safes, 11 the spin blade corridors, 12 the room of death. Thieving and Agility start at your own levels |
| `::togfly` | The nearest light creature carries you across the Chasm of Tears (the same as using the lit sapphire lantern on it) |
| `::icsstage <n>` | Sets Icthlarin's Little Helper's stage (1 supplies, 2 hypnotised, 3 remembered, 4 Sphinx's token, 5 return the jar, 6 jar stolen in the flashback, 7 jar returned, 8 ceremony preparations, 19 symbol hidden, 20 the fight, 22 priest beaten, 25 back to town); also clears a flashback and sets the jar, the ghost and the pots for that stage. `::questdone ics` finishes it |
| `::togpack` | The items Tears of Guthix needs: a lit sapphire lantern (and a bullseye lantern frame, a sapphire and swamp tar to make one), a tinderbox, a chisel, a pickaxe and a rope (you need 43 quest points, 49 Firemaking, 20 Crafting and 20 Mining) |
| `::togstage <n>` | Sets Tears of Guthix's stage (0 not started, 1 make the bowl, 2 complete); `::togstage 3` also forgets your last visit so Juna lets you into the Tears again. `::questdone tog` finishes it |
| `::zogrepack` | The items Zogre Flesh Eaters needs: an ogre bow and arrows, a knife, papyrus and charcoal, and for the extras: bronze nails, flighted ogre arrows, achey logs, wolf bones, a bow string, rogue's purse, snake weed and a vial of water (you need Jungle Potion, Big Chompy Bird Hunting and 30 Ranged to start) |
| `::zogrestage <n>` | Sets Zogre Flesh Eaters' stage (the game's values: 2 investigate, 3 barricade down, 4 potion given, 6 potion in Sithik's tea, 8 the spell is permanent, 10 Grish's key, 12 Slash Bash killed); 3+ knocks the barricade down, 8+ sets what Sithik told you. `::questdone zogre` finishes it |
| `::womtask <n>` | Gives you a Wise Old Man task (talk to him once first): 0 clears it, 1-7 a letter (1 Father Aereck, 2 High Priest of Entrana, 3 Reldo, 4 Thurgo, 5 Father Lawrence, 6 Abbot Langley, 7 the Oracle; gives you the letter), 8 the thing under his bed (kick the bed upstairs), 9 fetch 3 bones (gives you them) |
| `::womjunk` | Banks the Wise Old Man's three books (always junk) and two of Imp Catcher's beads (junk once Imp Catcher is done) for his junk check |
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
