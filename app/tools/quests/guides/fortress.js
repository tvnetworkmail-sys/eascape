// Black Knights' Fortress. Based on Quest Helper's BlackKnightFortress (BSD 2-Clause, (c) 2020
// Zoinkwiz). EASCape: steps, options and positions from our scripts (sir_amik_varze,
// quest_blackknight, fortress_guard) and maps.
module.exports = {
  quest: 'fortress',
  difficulty: 'Novice',
  start: 'Talk to Sir Amik Varze on the top floor of Falador castle (12 quest points needed).',
  items: {
    helm: { name: 'Bronze med helm', obj: 'bronze_med_helm', worn: true, tip: 'Peksa sells them in Barbarian Village' },
    chain: { name: 'Iron chainbody', obj: 'iron_chainbody', worn: true, tip: 'Wayne sells them in Falador, Horvik in Varrock' },
    cabbage: { name: 'Cabbage', obj: 'cabbage', tip: 'Pick one in the field by the Monastery, west of the fortress (not a Draynor Manor cabbage)' },
  },
  required: ['helm', 'chain', 'cabbage'],
  skills: ['12 Quest Points'],
  steps: {
    start: { text: 'Talk to Sir Amik Varze on the top floor of Falador castle.', npc: 'sir_amik_varze', at: [2960, 3336, 2], options: ['I seek a quest!', 'I laugh in the face of danger!'] },
    enter: { text: 'Wear the bronze med helm and iron chainbody and go in through the guards\' door of the Black Knights\' Fortress.', loc: 'bkfortressdoor1', at: [3016, 3514, 0], items: ['helm', 'chain'] },
    grill: { text: 'Listen at the grill to hear the Black Knights\' plan.', loc: 'witchgrill', at: [3025, 3507, 0], items: ['helm', 'chain'] },
    cabbage: { text: 'Pick a cabbage in the field by the Monastery.', loc: 'cabbage', at: [3050, 3503, 0] },
    hole: { text: 'Use the cabbage on the hole upstairs, above the witch\'s cauldron.', loc: 'blackknighthole', at: [3031, 3507, 1], items: ['cabbage', 'helm', 'chain'] },
    finish: { text: 'Return to Sir Amik Varze.', npc: 'sir_amik_varze', at: [2960, 3336, 2] },
  },
  stages: {
    0: [[null, 'start']],
    1: [[null, 'grill']],
    2: [
      ['!have:cabbage', 'cabbage'],
      [null, 'hole'],
    ],
    3: [[null, 'finish']],
  },
  sections: [
    { title: 'Starting off', steps: ['start'] },
    { title: 'The secret weapon', steps: ['enter', 'grill', 'cabbage', 'hole'], items: ['helm', 'chain', 'cabbage'] },
    { title: 'Finishing up', steps: ['finish'] },
  ],
  rewards: ['3 Quest Points', '2,500 coins'],
};
