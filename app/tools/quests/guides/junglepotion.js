// Jungle Potion. Based on Quest Helper's JunglePotion (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (trufitus, quest_junglepotion) and maps.
// Each herb is picked grimy and must be cleaned (Herblore) before Trufitus takes it.
module.exports = {
  quest: 'junglepotion',
  members: true,
  difficulty: 'Novice',
  start: 'Talk to Trufitus in Tai Bwo Wannai, Karamja.',
  items: {
    gsnake: { name: 'Herb (snake weed, grimy)', obj: 'unidentified_snake_weed' },
    snake: { name: 'Snake weed', obj: 'snake_weed' },
    gardrigal: { name: 'Herb (ardrigal, grimy)', obj: 'unidentified_ardrigal' },
    ardrigal: { name: 'Ardrigal', obj: 'ardrigal' },
    gsito: { name: 'Herb (sito foil, grimy)', obj: 'unidentified_sito_foil' },
    sito: { name: 'Sito foil', obj: 'sito_foil' },
    gmoss: { name: 'Herb (volencia moss, grimy)', obj: 'unidentified_volencia_moss' },
    moss: { name: 'Volencia moss', obj: 'volencia_moss' },
    gpurse: { name: "Herb (rogue's purse, grimy)", obj: 'unidentified_rogues_purse' },
    purse: { name: "Rogue's purse", obj: 'rogues_purse' },
  },
  skills: ['3 Herblore', 'Druidic Ritual'],
  zones: {
    cave: [2810, 9480, 2850, 9530, 0],
  },
  steps: {
    start: { text: 'Talk to Trufitus in Tai Bwo Wannai, Karamja.', npc: 'trufitus', at: [2809, 3086, 0], options: ["It's a nice village, where is everyone?", 'Me? How can I help?', 'It sounds like just the challenge for me.'] },
    pickSnake: { text: 'Search the vine by the river south-west of the village for snake weed.', loc: 'snake_vine_full', at: [2758, 3042, 0], keepAt: true },
    giveSnake: { text: 'Clean the snake weed and use it on Trufitus.', npc: 'trufitus', at: [2809, 3086, 0], items: ['snake'] },
    pickArdrigal: { text: 'Search the palm trees north-east of the village for ardrigal.', loc: 'ardrigal_palm_full', at: [2870, 3115, 0] },
    giveArdrigal: { text: 'Clean the ardrigal and use it on Trufitus.', npc: 'trufitus', at: [2809, 3086, 0], items: ['ardrigal'] },
    pickSito: { text: 'Search the scorched earth west of the village for sito foil.', loc: 'sito_soil_full', at: [2784, 3067, 0] },
    giveSito: { text: 'Clean the sito foil and use it on Trufitus.', npc: 'trufitus', at: [2809, 3086, 0], items: ['sito'] },
    pickMoss: { text: 'Search the rocks south-east of the village for volencia moss.', loc: 'volencia_moss_rock_full', at: [2850, 3035, 0] },
    giveMoss: { text: 'Clean the volencia moss and use it on Trufitus.', npc: 'trufitus', at: [2809, 3086, 0], items: ['moss'] },
    cave: { text: 'Climb down the pothole north of the village ("Yes, I\'ll enter the cave.").', loc: 'pothole_cave_entrance', at: [2824, 3118, 0], options: ["Yes, I'll enter the cave."] },
    pickPurse: { text: "Search the cave wall for rogue's purse.", loc: 'rogues_purse_cave_full', at: [2829, 9493, 0] },
    givePurse: { text: "Clean the rogue's purse and use it on Trufitus.", npc: 'trufitus', at: [2809, 3086, 0], items: ['purse'] },
    finish: { text: 'Talk to Trufitus to finish.', npc: 'trufitus', at: [2809, 3086, 0] },
  },
  stages: {
    0: [[null, 'start']],
    '1-2': [['have:snake | have:gsnake', 'giveSnake'], [null, 'pickSnake']],
    '3-4': [['have:ardrigal | have:gardrigal', 'giveArdrigal'], [null, 'pickArdrigal']],
    '5-6': [['have:sito | have:gsito', 'giveSito'], [null, 'pickSito']],
    '7-8': [['have:moss | have:gmoss', 'giveMoss'], [null, 'pickMoss']],
    '9-10': [['have:purse | have:gpurse', 'givePurse'], ['in:cave', 'pickPurse'], [null, 'cave']],
    11: [[null, 'finish']],
  },
  sections: [
    { title: 'Starting off', steps: ['start'] },
    { title: 'The herbs', steps: ['pickSnake', 'giveSnake', 'pickArdrigal', 'giveArdrigal', 'pickSito', 'giveSito', 'pickMoss', 'giveMoss', 'cave', 'pickPurse', 'givePurse', 'finish'] },
  ],
  rewards: ['1 Quest Point', '775 Herblore experience'],
};
