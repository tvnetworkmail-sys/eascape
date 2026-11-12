// Druidic Ritual. Based on Quest Helper's DruidicRitual (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (kaqemeex, sanfew, quest_druid) and maps.
module.exports = {
  quest: 'druid',
  members: true,
  difficulty: 'Novice',
  start: 'Talk to Kaqemeex at the stone circle north of Taverley.',
  items: {
    rat: { name: 'Raw rat meat', obj: 'raw_rat_meat', tip: 'Kill a giant rat' },
    beef: { name: 'Raw beef', obj: 'raw_beef', tip: 'Kill a cow, or buy from Wydin in Port Sarim' },
    bear: { name: 'Raw bear meat', obj: 'raw_bear_meat', tip: 'Kill a bear' },
    chicken: { name: 'Raw chicken', obj: 'raw_chicken', tip: 'Kill a chicken, or buy from Wydin in Port Sarim' },
    erat: { name: 'Enchanted rat', obj: 'enchanted_rat_meat' },
    ebeef: { name: 'Enchanted beef', obj: 'enchanted_beef' },
    ebear: { name: 'Enchanted bear', obj: 'enchanted_bear_meat' },
    echicken: { name: 'Enchanted chicken', obj: 'enchanted_chicken' },
  },
  required: ['rat', 'beef', 'bear', 'chicken'],
  skills: ['Able to get past the monsters near the start of Taverley Dungeon'],
  steps: {
    start: { text: 'Talk to Kaqemeex at the stone circle north of Taverley.', npc: 'kaqemeex', at: [2925, 3486, 0], options: ["I'm in search of a quest.", 'Ok, I will try and help.'] },
    sanfew: { text: 'Talk to Sanfew upstairs in the house in south Taverley.', npc: 'sanfew', at: [2897, 3426, 1], options: ["I've been sent to help purify the Varrock stone circle.", "Ok, I'll do that then."] },
    cauldron: { text: 'Go into Taverley Dungeon and use each raw meat on the Cauldron of Thunder.', loc: 'cauldron_of_thunder', at: [2893, 9831, 0], items: ['rat', 'beef', 'bear', 'chicken'] },
    give: { text: 'Bring the four enchanted meats to Sanfew.', npc: 'sanfew', at: [2897, 3426, 1], items: ['erat', 'ebeef', 'ebear', 'echicken'] },
    finish: { text: 'Return to Kaqemeex.', npc: 'kaqemeex', at: [2925, 3486, 0] },
  },
  stages: {
    0: [[null, 'start']],
    1: [[null, 'sanfew']],
    2: [
      ['have:erat & have:ebeef & have:ebear & have:echicken', 'give'],
      [null, 'cauldron'],
    ],
    3: [[null, 'finish']],
  },
  sections: [
    { title: 'Starting off', steps: ['start', 'sanfew'] },
    { title: 'The enchanted meat', steps: ['cauldron', 'give'], items: ['rat', 'beef', 'bear', 'chicken'] },
    { title: 'Finishing up', steps: ['finish'] },
  ],
  rewards: ['4 Quest Points', '250 Herblore experience', 'Access to the Herblore skill'],
};
