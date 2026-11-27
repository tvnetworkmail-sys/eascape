// Lost City. Based on Quest Helper's LostCity (BSD 2-Clause, (c) 2020 Zoinkwiz).
// 2007RS: written from our quest scripts when the server's guides left the game (quest_zanaris:
// shamus, tree_spirit, quest_zanaris; area_lumbridge warrior_zanaris). Shamus and the tree spirit
// only appear when called (chopping the trees).
module.exports = {
  quest: 'zanaris',
  name: 'Lost City',
  difficulty: 'Experienced',
  members: true,
  start: 'Talk to the warrior in the adventurers\' camp in Lumbridge Swamp.',
  items: {
    axe: { name: 'Any axe', category: 'weapon_axe' },
    knife: { name: 'Knife', obj: 'knife' },
    branch: { name: 'Dramen branch', obj: 'dramen_branch' },
    staff: { name: 'Dramen staff', obj: 'dramen_staff', worn: true },
  },
  required: ['axe', 'knife'],
  recommended: [],
  skills: ['31 Crafting', '36 Woodcutting', 'Able to defeat a level 101 tree spirit with no weapons or armour (Entrana)'],
  zones: { entranaCave: [2816, 9664, 2879, 9791, 0] },
  steps: {
    start: { text: "Talk to the warrior in the adventurers' camp in Lumbridge Swamp.", npc: 'warrioradventurerpg', at: [3148, 3207, 0], options: ['What are you camped here for?', "What makes you think it's out here?", 'If it\'s hidden how are you planning to find it?', 'Please tell me?'] },
    shamus: { text: 'Chop the tree to the west of the camp: Shamus the leprechaun appears. Talk to him.', loc: 'leprechauntree', at: [3138, 3212, 0], items: ['axe'], options: ["I've been in that shed, I didn't see a city."] },
    entrana: { text: 'Take the monks\' ship from Port Sarim to Entrana (no weapons or armour allowed; bring an axe and a knife).', npc: 'shipmonk', at: [3045, 3236, 0], items: ['axe', 'knife'] },
    cave: { text: "On Entrana, climb down the ladder in the north of the island into the cave.", loc: 'entranaladdertop', at: [2820, 3374, 0], items: ['axe', 'knife'] },
    spirit: { text: 'Chop the Dramen tree at the far end of the cave: the tree spirit appears. Kill it.', loc: 'dramentree', at: [2860, 9734, 0], items: ['axe'] },
    branch: { text: 'Chop a branch from the Dramen tree.', loc: 'dramentree', at: [2860, 9734, 0], items: ['axe'] },
    staff: { text: 'Use the knife on the Dramen branch to make a Dramen staff (31 Crafting).', anywhere: true, items: ['knife', 'branch'] },
    shed: { text: 'Wield the Dramen staff and go into the shed in the middle of Lumbridge Swamp to reach Zanaris.', loc: 'zanarisdoor', at: [3202, 3169, 0], items: ['staff'] },
  },
  stages: {
    '^zanaris_not_started': [[null, 'start']],
    '^zanaris_started': [[null, 'shamus']],
    '^zanaris_spoken_shamus': [['in:entranaCave', 'spirit'], ['npc:shipmonk2', 'cave'], [null, 'entrana']],
    '^zanaris_spirit_defeated': [['in:entranaCave', 'branch'], [null, 'cave']],
    '^zanaris_tree_chopped': [['have:branch', 'staff'], ['in:entranaCave', 'branch'], [null, 'cave']],
    '^zanaris_staff_made': [[null, 'shed']],
  },
  sections: [
    { title: 'Starting off', steps: ['start', 'shamus'], items: ['axe'] },
    { title: 'The Dramen tree', steps: ['entrana', 'cave', 'spirit', 'branch', 'staff'], items: ['axe', 'knife'] },
    { title: 'Zanaris', steps: ['shed'] },
  ],
  rewards: ['1 Quest Point', 'Access to Zanaris', 'The Dramen staff'],
};
