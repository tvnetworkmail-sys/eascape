// Vampire Slayer. Based on Quest Helper's VampireSlayer (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (morgan, harlow, quest_vampire,
// count_draynor, cupboards) and maps.
module.exports = {
  quest: 'vampire',
  difficulty: 'Novice',
  start: 'Talk to Morgan in his house in Draynor Village.',
  items: {
    beer: { name: 'Beer', obj: 'beer', tip: 'The bartender in the Blue Moon Inn sells it' },
    stake: { name: 'Stake', obj: 'stake', tip: 'Dr Harlow gives it once you buy him a beer' },
    hammer: { name: 'Hammer', obj: 'hammer', tip: 'General stores sell them' },
    garlic: { name: 'Garlic', obj: 'garlic', tip: "In the cupboard upstairs in Morgan's house" },
  },
  required: ['beer', 'hammer'],
  recommended: ['garlic'],
  skills: ['Able to defeat Count Draynor (level 34)'],
  steps: {
    start: { text: 'Talk to Morgan in his house in Draynor Village.', npc: 'morgan', at: [3098, 3268, 0], options: ["Ok, I'm up for an adventure."] },
    garlic: { text: "Search the cupboard upstairs in Morgan's house for garlic (it weakens the Count).", loc: 'garliccupboardshut', at: [3096, 3269, 1] },
    harlow: { text: 'Talk to Dr Harlow in the Blue Moon Inn in Varrock and buy him a beer for a stake.', npc: 'dr_harlow', at: [3222, 3397, 0], items: ['beer'], options: ['Morgan needs your help'] },
    count: { text: 'Go down to the basement of Draynor Manor, open the coffin and kill Count Draynor. Keep the stake and hammer with you to finish him.', loc: 'loc_2614', at: [3077, 9775, 0], items: ['stake', 'hammer'] },
  },
  stages: {
    0: [[null, 'start']],
    1: [[null, 'harlow']],
    2: [
      ['!have:stake', 'harlow'],
      [null, 'count'],
    ],
  },
  sections: [
    { title: 'Starting off', steps: ['start', 'garlic'] },
    { title: 'The stake', steps: ['harlow'], items: ['beer'] },
    { title: 'Count Draynor', steps: ['count'], items: ['stake', 'hammer'] },
  ],
  rewards: ['3 Quest Points', '4,825 Attack experience'],
};
