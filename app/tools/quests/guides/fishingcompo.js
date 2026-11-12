// Fishing Contest. Based on Quest Helper's FishingContest (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (mountain_dwarf, bonzo, quest_fishingcompo,
// hemenster_fishing, mcgrubors_wood) and maps.
module.exports = {
  quest: 'fishingcompo',
  members: true,
  difficulty: 'Novice',
  start: 'Talk to a dwarf by the tunnel stairs on White Wolf Mountain (either end).',
  items: {
    rod: { name: 'Fishing rod', obj: 'fishing_rod', tip: 'Fishing shops sell them' },
    spade: { name: 'Spade', obj: 'spade', tip: 'To dig up red vine worms' },
    garlic: { name: 'Garlic', obj: 'garlic', tip: "In the cupboard upstairs in Morgan's house, Draynor" },
    coins: { name: 'Coins', obj: 'coins', qty: 5, tip: 'The entry fee' },
    pass: { name: 'Fishing pass', obj: 'fishing_competition_pass', tip: 'The dwarves give it' },
    worms: { name: 'Red vine worm', obj: 'red_vine_worm', tip: "Dig them up with a spade at the vines in McGrubor's Wood" },
    carp: { name: 'Raw giant carp', obj: 'raw_giant_carp' },
    trophy: { name: 'Fishing trophy', obj: 'hemenster_fishing_trophy' },
  },
  required: ['rod', 'spade', 'garlic', 'coins'],
  skills: ['10 Fishing'],
  flags: {
    stashed: { on: ['You stash the garlic in the pipe.'] },
  },
  steps: {
    start: { text: 'Talk to a dwarf by the tunnel stairs on White Wolf Mountain.', npc: ['tunnel_dwarf', 'tunnel_dwarf1'], at: [2877, 3483, 0], options: ['I was just wondering what was down those stairs?', 'Why not?', "If you were my friend I wouldn't mind.", "Well, let's be friends!", 'And how am I meant to do that?', "Fortunately I'm alright at fishing!"] },
    worms: { text: "Dig up some red vine worms with a spade at the vines in McGrubor's Wood (through the loose railing).", loc: 'red_worm_vine', at: [2631, 3498, 0], items: ['spade'] },
    garlic: { text: 'Show Morris your pass at the Hemenster gate, then use the garlic on the pipe by the Sinister Stranger\'s spot.', loc: 'garlicpipe', at: [2637, 3446, 0], items: ['garlic', 'pass'] },
    enter: { text: 'Pay Bonzo 5 coins to enter the competition.', npc: 'bonzo', at: [2641, 3437, 0], items: ['coins'], options: ["I'll enter the competition please."] },
    fish: { text: 'Fish at the spot by the pipe with your rod and the red vine worms until you catch a giant carp, then give it to Bonzo.', npc: '0_41_53_sinisterfishspot', at: [2637, 3444, 0], items: ['rod', 'worms'] },
    bonzo: { text: 'Bring the giant carp to Bonzo.', npc: 'bonzo', at: [2641, 3437, 0], items: ['carp'] },
    finish: { text: 'Bring the trophy to the dwarves on White Wolf Mountain.', npc: ['tunnel_dwarf', 'tunnel_dwarf1'], at: [2877, 3483, 0], items: ['trophy'] },
  },
  stages: {
    0: [[null, 'start']],
    1: [
      ['!have:worms', 'worms'],
      ['!seen:stashed', 'garlic'],
      [null, 'enter'],
    ],
    '2-3': [
      ['have:carp', 'bonzo'],
      [null, 'fish'],
    ],
    4: [[null, 'finish']],
  },
  sections: [
    { title: 'Starting off', steps: ['start'] },
    { title: 'The competition', steps: ['worms', 'garlic', 'enter', 'fish', 'bonzo'], items: ['rod', 'spade', 'garlic', 'coins'] },
    { title: 'Finishing up', steps: ['finish'] },
  ],
  rewards: ['1 Quest Point', '2,437 Fishing experience', 'Use of the White Wolf Mountain tunnel'],
};
