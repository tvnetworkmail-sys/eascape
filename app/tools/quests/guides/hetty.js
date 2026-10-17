// Witch's Potion. Based on Quest Helper's WitchsPotion (BSD 2-Clause, (c) 2020 Zoinkwiz).
module.exports = {
  quest: 'hetty',
  difficulty: 'Novice',
  start: 'Talk to Hetty in her house in Rimmington.',
  items: {
    tail: { name: "Rat's tail", obj: 'rats_tail', tip: 'Kill a rat once Hetty has asked for it' },
    onion: { name: 'Onion', obj: 'onion', tip: 'Pick one in the field north of Rimmington' },
    meat: { name: 'Burnt meat', obj: 'burnt_meat', tip: 'Cook meat on a range or fire until it burns' },
    eye: { name: 'Eye of newt', obj: 'eye_of_newt', tip: 'Betty sells them in Port Sarim' },
  },
  required: ['onion', 'meat', 'eye'],
  steps: {
    start: { text: 'Talk to Hetty in Rimmington.', npc: 'hetty', at: [2968, 3206, 0], options: ['I am in search of a quest.', 'Yes, help me become one with my darker side.'] },
    onion: { text: 'Pick an onion in the field north of Rimmington.', loc: 'onion', at: [2946, 3251, 0] },
    eye: { text: 'Buy an eye of newt from Betty in Port Sarim.', npc: 'betty', at: [3012, 3259, 0] },
    meat: { text: 'Burn some meat: cook raw meat on a range or fire until it burns, or keep cooking cooked meat.', at: [2968, 3206, 0] },
    rat: { text: "Kill a rat in the house to the west for a rat's tail.", npc: 'rat', at: [2955, 3202, 0], range: 8 },
    give: { text: 'Bring the ingredients to Hetty.', npc: 'hetty', at: [2968, 3206, 0], items: ['onion', 'eye', 'meat', 'tail'] },
    drink: { text: 'Drink from the cauldron to finish the quest.', loc: 'hettycauldron', at: [2967, 3205, 0] },
  },
  stages: {
    0: [[null, 'start']],
    1: [
      ['!have:onion', 'onion'],
      ['!have:eye', 'eye'],
      ['!have:meat', 'meat'],
      ['!have:tail', 'rat'],
      [null, 'give'],
    ],
    2: [[null, 'drink']],
  },
  sections: [
    { title: 'Starting off', steps: ['start'] },
    { title: 'The ingredients', steps: ['onion', 'eye', 'meat', 'rat'] },
    { title: 'Finishing up', steps: ['give', 'drink'], items: ['onion', 'eye', 'meat', 'tail'] },
  ],
  rewards: ['1 Quest Point', '325 Magic experience'],
};
