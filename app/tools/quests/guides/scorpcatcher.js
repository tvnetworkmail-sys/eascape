// Scorpion Catcher. Based on Quest Helper's ScorpionCatcher (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (thormac, seer, peksa,
// quest_scorpcatcher) and maps.
module.exports = {
  quest: 'scorpcatcher',
  members: true,
  difficulty: 'Intermediate',
  start: "Talk to Thormac at the top of the Sorcerer's Tower south of Seers' Village.",
  items: {
    cage: { name: 'Scorpion cage', obj: ['scorpioncageempty', 'scorpioncagea', 'scorpioncageb', 'scorpioncagec', 'scorpioncageab', 'scorpioncageac', 'scorpioncagebc', 'scorpioncagefull'], tip: 'Thormac gives it (and another if you lose it)' },
    gotA: { name: 'Cage with the Taverley scorpion', obj: ['scorpioncagea', 'scorpioncageab', 'scorpioncageac', 'scorpioncagefull'] },
    gotB: { name: 'Cage with the Barbarian Outpost scorpion', obj: ['scorpioncageb', 'scorpioncageab', 'scorpioncagebc', 'scorpioncagefull'] },
    gotC: { name: 'Cage with the Monastery scorpion', obj: ['scorpioncagec', 'scorpioncageac', 'scorpioncagebc', 'scorpioncagefull'] },
    full: { name: 'Scorpion cage (full)', obj: 'scorpioncagefull' },
  },
  skills: ['Able to get past the monsters in Taverley Dungeon'],
  steps: {
    start: { text: "Talk to Thormac at the top of the Sorcerer's Tower.", npc: 'thormac', at: [2702, 3405, 3], options: ['What do you need assistance with?', 'So how would I go about catching them then?', 'Ok, I will do it then.'] },
    seer: { text: "Talk to the Seer in Seers' Village.", npc: 'seer', at: [2702, 3475, 0], options: ['I need to locate some scorpions.'] },
    scorpA: { text: 'Go into Taverley Dungeon, through the secret wall, and use the cage on the scorpion.', npc: 'questscorpiona', at: [2877, 9796, 0], items: ['cage'] },
    seer2: { text: 'Talk to the Seer again for where the next scorpion is.', npc: 'seer', at: [2702, 3475, 0] },
    scorpC: { text: 'Use the cage on the scorpion upstairs in the Monastery south of Edgeville.', npc: 'questscorpionc', at: [3058, 3488, 1], items: ['cage'] },
    peksa: { text: 'Ask Peksa in Barbarian Village about his scorpion.', npc: 'peksa', at: [3076, 3429, 0], options: ["I've heard you have a small scorpion in your possession."] },
    scorpB: { text: 'Use the cage on the scorpion at the Barbarian Outpost.', npc: 'questscorpionb', at: [2552, 3570, 0], items: ['cage'] },
    finish: { text: 'Bring the full cage to Thormac.', npc: 'thormac', at: [2702, 3405, 3], items: ['full'] },
  },
  stages: {
    0: [[null, 'start']],
    1: [[null, 'seer']],
    2: [
      ['have:full', 'finish'],
      ['!have:gotA', 'scorpA'],
      [null, 'seer2'],
    ],
    3: [
      ['have:full', 'finish'],
      ['!have:gotA', 'scorpA'],
      ['!have:gotC', 'scorpC'],
      [null, 'scorpB'],
    ],
  },
  sections: [
    { title: 'Starting off', steps: ['start', 'seer'] },
    { title: 'The scorpions', steps: ['scorpA', 'seer2', 'scorpC', 'peksa', 'scorpB', 'finish'], items: ['cage'] },
  ],
  rewards: ['1 Quest Point', '6,625 Strength experience'],
};
