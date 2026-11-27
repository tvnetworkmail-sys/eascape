# Hand-written data for our server's clues that RuneLite has differently or not at all
# (RuneLite's fields: solution / area / directions / locationName / description).
OVERRIDES = {
    # medium riddle001: our key holder is Black Heather (RuneLite: a Monk in Ardougne Monastery)
    2831: {'solution': 'Search the chest by the stairs in the Varrock church. Kill Black Heather to obtain the key.'},
    # medium anagram001: our scroll reads "Speak to Hazelmere." (RuneLite: Uglug Nar)
    2841: {'solution': 'Hazelmere is found upstairs in his house on the island east of Yanille.'},
    # hard riddle: Lord Iorwerth (RuneLite: General Hining, Tyras Camp)
    3564: {'solution': 'Talk to Lord Iorwerth in the elf camp in Isafdar, Tirannwn.'},
    # medium map002: not in RuneLite
    2829: {'description': "South of Seers' Village, north of the Sorcerer's Tower."},
    # medium sextant006: Baxtorian Falls; no Achievement Diaries in 2007, so always "(Bring rope)"
    2811: {'directions': 'Baxtorian Falls (Bring rope)'},
    # hard sextant028: our 2007 spot is in the Duel Arena (OSRS moved it behind the arena)
    3554: {'directions': 'Inside the Duel Arena.'},
    # anagrams whose NPC stands elsewhere on our server
    2856: {'area': "Seers' Village"},
    3612: {'area': "Brimstail's cave, west of the Tree Gnome Stronghold"},
    # medium anagram003: no Eagles' Peak (2008) in 2007, so 50 animals
    2845: {'answer': '50'},
    # hard emote001: our scroll is the Zamorak temple in the Eastern Wilderness
    10234: {'locationName': 'Zamorak temple, Eastern Wilderness'},
    # our own 2007 emote clues (objs 11764-11771)
    11764: {'locationName': 'Edgeville general store'},
    11765: {'locationName': "Seers' Village court house"},
    11766: {'locationName': 'Catherby beach'},
    11767: {'locationName': 'Lumbridge Swamp Caves'},
    11768: {'locationName': 'TzHaar sword shop'},
    11769: {'locationName': 'Catherby bank'},
    11770: {'locationName': 'Varrock Castle courtyard'},
    11771: {'locationName': 'Falador gem store'},
}
# our clue texts' item names -> the 2007 cache's
ALIAS = {
    'Blue mystic robe bottom': 'Mystic robe bottom',
    'Blue mystic gloves': 'Mystic gloves',
    'Air staff': 'Staff of air',
}
