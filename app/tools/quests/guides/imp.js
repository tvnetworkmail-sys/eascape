// Imp Catcher. Based on Quest Helper's ImpCatcher (BSD 2-Clause, (c) 2020 Zoinkwiz).
module.exports = {
  quest: 'imp',
  difficulty: 'Novice',
  start: "Talk to Wizard Mizgog at the top of the Wizards' Tower.",
  items: {
    black: { name: 'Black bead', obj: 'black_bead' },
    white: { name: 'White bead', obj: 'white_bead' },
    red: { name: 'Red bead', obj: 'red_bead' },
    yellow: { name: 'Yellow bead', obj: 'yellow_bead' },
  },
  required: ['black', 'white', 'red', 'yellow'],
  zones: { towerFirst: [3089, 3146, 3126, 3176, 1], towerTop: [3089, 3146, 3126, 3176, 2] },
  steps: {
    goUp: { text: "Climb the staircase in the Wizards' Tower.", loc: 'spiralstairs', at: [3103, 3159, 0] },
    goUp2: { text: 'Climb up the staircase again to the top floor.', loc: 'spiralstairsmiddle', at: [3103, 3159, 1], options: ['Climb up'] },
    start: { text: 'Talk to Wizard Mizgog to start the quest.', npc: 'wizard_mizgog', at: [3103, 3163, 2], options: ['Give me a quest please.'] },
    beads: { text: 'Collect one of each bead. Imps drop them; they are all over the land.', npc: 'imp', at: [3103, 3163, 0], keepAt: true, spawned: true, items: ['black', 'white', 'red', 'yellow'] },
    finish: { text: 'Bring the four beads to Wizard Mizgog.', npc: 'wizard_mizgog', at: [3103, 3163, 2], items: ['black', 'white', 'red', 'yellow'] },
  },
  stages: {
    0: [['in:towerTop', 'start'], ['in:towerFirst', 'goUp2'], [null, 'goUp']],
    1: [
      ['have:black & have:white & have:red & have:yellow & in:towerTop', 'finish'],
      ['have:black & have:white & have:red & have:yellow & in:towerFirst', 'goUp2'],
      ['have:black & have:white & have:red & have:yellow', 'goUp'],
      [null, 'beads'],
    ],
  },
  sections: [
    { title: 'Starting off', steps: ['goUp', 'goUp2', 'start'] },
    { title: 'The beads', steps: ['beads', 'finish'], items: ['black', 'white', 'red', 'yellow'] },
  ],
  rewards: ['1 Quest Point', '875 Magic experience', 'Amulet of accuracy'],
};
