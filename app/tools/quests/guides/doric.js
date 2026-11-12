// Doric's Quest. Based on Quest Helper's DoricsQuest (BSD 2-Clause, (c) 2020 Zoinkwiz).
module.exports = {
  quest: 'doric',
  difficulty: 'Novice',
  start: 'Talk to Doric in his house north of Falador.',
  items: {
    clay: { name: 'Clay (not noted)', obj: 'clay', qty: 6 },
    copper: { name: 'Copper ore (not noted)', obj: 'copper_ore', qty: 4 },
    iron: { name: 'Iron ore (not noted)', obj: 'iron_ore', qty: 2 },
  },
  required: ['clay', 'copper', 'iron'],
  skills: ['15 Mining to mine the iron ore yourself'],
  steps: {
    start: { text: 'Talk to Doric in his house north of Falador.', npc: 'doric', at: [2952, 3451, 0], options: ['I wanted to use your anvils.', 'Yes, I will get you materials.', 'Yes I will get you materials'] },
    finish: { text: 'Bring Doric 6 clay, 4 copper ore and 2 iron ore. You can mine them in the Dwarven Mine or south-east of Varrock.', npc: 'doric', at: [2952, 3451, 0], items: ['clay', 'copper', 'iron'] },
  },
  stages: {
    0: [[null, 'start']],
    '1-99': [[null, 'finish']],
  },
  sections: [{ title: 'The materials', steps: ['start', 'finish'], items: ['clay', 'copper', 'iron'] }],
  rewards: ['1 Quest Point', '1,300 Mining experience', '180 coins', "Use of Doric's anvils"],
};
