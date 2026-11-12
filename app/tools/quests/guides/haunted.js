// Ernest the Chicken. Based on Quest Helper's ErnestTheChicken (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and item sources from our scripts (veronica, professor_oddenstein,
// quest_haunted) and maps. The lever order was worked out from quest_haunted.rs2's door rules
// (recalculate_ernest_doors) and the rooms on our map.
module.exports = {
  quest: 'haunted',
  difficulty: 'Novice',
  start: 'Talk to Veronica outside Draynor Manor.',
  items: {
    fishfood: { name: 'Fish food', obj: 'fish_food', tip: 'On the first floor of Draynor Manor' },
    poison: { name: 'Poison', obj: 'poison', tip: 'On the ground floor of Draynor Manor' },
    poisoned: { name: 'Poisoned fish food', obj: 'poisoned_fish_food', tip: 'Use the poison on the fish food' },
    gauge: { name: 'Pressure gauge', obj: 'pressure_gauge' },
    spade: { name: 'Spade', obj: 'spade', tip: 'One lies outside the east side of Draynor Manor' },
    key: { name: 'Key', obj: 'closet_key', tip: 'Dig in the compost heap with a spade' },
    tube: { name: 'Rubber tube', obj: 'rubber_tube' },
    oilcan: { name: 'Oil can', obj: 'oil_can' },
  },
  required: ['spade'],
  zones: {
    secret: [3091, 3354, 3096, 3364, 0],
    basement: [3088, 9740, 3125, 9775, 0],
  },
  flags: {
    poisoned: { on: ['... then die and float to the surface.'] },
  },
  steps: {
    start: { text: 'Talk to Veronica outside Draynor Manor.', npc: 'veronica', at: [3110, 3330, 0], options: ["Aha, sounds like a quest. I'll help."] },
    oddenstein: { text: 'Go into Draynor Manor and up to the top floor. Talk to Professor Oddenstein.', npc: 'professor_oddenstein', at: [3110, 3367, 2], options: ["I'm looking for a guy called Ernest.", 'Change him back this instant!'] },
    fishfood: { text: 'Pick up the fish food on the first floor of the manor.', obj: 'fish_food', at: [3108, 3356, 1] },
    poison: { text: 'Pick up the poison on the ground floor of the manor.', obj: 'poison', at: [3097, 3366, 0] },
    mix: { text: 'Use the poison on the fish food.', at: [3097, 3366, 0], items: ['poison', 'fishfood'] },
    fountain: { text: 'Use the poisoned fish food on the fountain south-west of the manor.', loc: 'hauntedfountain', at: [3087, 3334, 0], items: ['poisoned'] },
    gauge: { text: 'Search the fountain for the pressure gauge.', loc: 'hauntedfountain', at: [3087, 3334, 0] },
    spade: { text: 'Pick up the spade outside the east side of the manor.', obj: 'spade', at: [3120, 3359, 0] },
    compost: { text: 'Use the spade on the compost heap west of the manor to find a key.', loc: 'hauntedcompostheap', at: [3084, 3360, 0], items: ['spade'] },
    tube: { text: 'Use the key on the door in the manor\'s north-east room and pick up the rubber tube behind it.', loc: 'closet_door', at: [3107, 3367, 0], items: ['key'] },
    bookcase: { text: 'Search the bookcase in the west room of the manor from its east side to find a secret door.', loc: 'hauntedbookcaser', at: [3097, 3359, 0] },
    ladderDown: { text: 'Climb down the ladder in the secret room.', loc: 'puzzle_ladder_top', at: [3092, 3362, 0] },
    puzzle: {
      text: 'Solve the lever puzzle (the doors open by the levers): 1) Pull levers A and B down. 2) Go north into the room with levers C and D and pull D down. '
        + '3) Go west, then south, back to the first room, and pull A and B up. 4) Go north, west, then north into the room with levers E and F and pull both down. '
        + '5) Go east, then east again into the room with C and D, and pull C down. 6) Go west twice back to E and F and pull E up. '
        + '7) Go east, south, south, then west through the door to the oil can, and pick it up.',
      obj: 'oil_can', at: [3092, 9755, 0],
    },
    ladderUp: { text: 'Go back east through the door and climb the ladder.', loc: 'puzzle_ladder', at: [3117, 9754, 0], items: ['oilcan'] },
    lever: { text: 'Pull the lever to open the secret door.', loc: 'hauntedleverup', at: [3096, 3357, 0] },
    finish: { text: 'Bring the pressure gauge, rubber tube and oil can to Professor Oddenstein on the top floor of the manor.', npc: 'professor_oddenstein', at: [3110, 3367, 2], items: ['gauge', 'tube', 'oilcan'] },
  },
  stages: {
    0: [[null, 'start']],
    1: [[null, 'oddenstein']],
    2: [
      ['in:basement & have:oilcan', 'ladderUp'],
      ['in:basement', 'puzzle'],
      ['in:secret & !have:oilcan', 'ladderDown'],
      ['in:secret', 'lever'],
      ['!have:gauge & seen:poisoned', 'gauge'],
      ['!have:gauge & have:poisoned', 'fountain'],
      ['!have:gauge & !have:fishfood', 'fishfood'],
      ['!have:gauge & !have:poison', 'poison'],
      ['!have:gauge', 'mix'],
      ['!have:tube & have:key', 'tube'],
      ['!have:tube & have:spade', 'compost'],
      ['!have:tube', 'spade'],
      ['!have:oilcan', 'bookcase'],
      [null, 'finish'],
    ],
  },
  sections: [
    { title: 'Starting off', steps: ['start', 'oddenstein'] },
    { title: 'The pressure gauge', steps: ['fishfood', 'poison', 'mix', 'fountain', 'gauge'] },
    { title: 'The rubber tube', steps: ['spade', 'compost', 'tube'], items: ['spade'] },
    { title: 'The oil can', steps: ['bookcase', 'ladderDown', 'puzzle', 'ladderUp', 'lever'] },
    { title: 'Finishing up', steps: ['finish'], items: ['gauge', 'tube', 'oilcan'] },
  ],
  rewards: ['4 Quest Points', '300 coins'],
};
