// Sheep Shearer. Based on Quest Helper's SheepShearer (BSD 2-Clause, (c) 2020 Zoinkwiz).
// In 2004 Fred counts the balls as you hand them in; the journal says how many are left.
module.exports = {
  quest: 'sheep',
  difficulty: 'Novice',
  start: 'Talk to Fred the Farmer north-west of Lumbridge.',
  items: {
    balls: { name: 'Balls of wool', obj: 'ball_of_wool', qty: 20, qtyFromStage: [-1, 21] },
    wool: { name: 'Wool', obj: 'wool' },
    shears: { name: 'Shears', obj: 'shears', tip: 'There is a pair in the house north of the sheep field' },
  },
  required: ['balls'],
  recommended: ['shears'],
  zones: { castleFirst: [3200, 3205, 3220, 3232, 1] },
  journalCount: { re: 'collect (\\d+) more balls', a: -1, b: 21 },
  steps: {
    start: { text: 'Talk to Fred the Farmer north-west of Lumbridge to start the quest.', npc: 'fred_the_farmer', at: [3189, 3273, 0], options: ["I'm looking for a quest.", 'Yes okay. I can do that.', 'Yes, okay. I can do that.'] },
    getShears: { text: 'Pick up the shears in the house north of the sheep field.', obj: 'shears', at: [3152, 3306, 0] },
    shear: { text: 'Shear the sheep in the field next to Fred until you have enough wool.', npc: 'sheepunsheered', at: [3196, 3259, 0], items: ['shears'] },
    goUp: { text: 'Climb the staircase in Lumbridge Castle to the spinning wheel.', loc: 'spiralstairs', at: [3204, 3207, 0], items: ['wool'] },
    spin: { text: 'Spin your wool into balls of wool on the spinning wheel.', loc: 'spinningwheel', at: [3209, 3212, 1], items: ['wool'] },
    goDown: { text: 'Climb down the staircase.', loc: 'spiralstairsmiddle', at: [3204, 3207, 1], options: ['Climb down the stairs.'] },
    handIn: { text: 'Bring Fred your balls of wool. You can hand in some at a time.', npc: 'fred_the_farmer', at: [3189, 3273, 0], items: ['balls'] },
  },
  stages: {
    0: [[null, 'start']],
    '1-21': [
      ['have:balls & !have:wool & in:castleFirst', 'goDown'],
      ['have:balls & !have:wool', 'handIn'],
      ['have:wool & in:castleFirst', 'spin'],
      ['have:wool:20', 'goUp'],
      ['have:shears', 'shear'],
      ['have:wool', 'goUp'],
      [null, 'getShears'],
    ],
  },
  sections: [
    { title: 'Starting off', steps: ['start'] },
    { title: 'Making balls of wool', steps: ['getShears', 'shear', 'goUp', 'spin', 'goDown'], items: ['shears'] },
    { title: 'Finishing up', steps: ['handIn'], items: ['balls'] },
  ],
  rewards: ['1 Quest Point', '150 Crafting experience', '60 coins'],
};
