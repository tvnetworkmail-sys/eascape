// Lost City. Based on Quest Helper's LostCity (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (warrior_zanaris, shamus,
// quest_zanaris, tree_spirit, cave_monk, entrana_dungeon) and maps.
module.exports = {
  quest: 'zanaris',
  difficulty: 'Experienced',
  members: true,
  start: 'Talk to the warrior with the adventurers camped in the swamp south of Lumbridge.',
  items: {
    axe: { name: 'Any axe', obj: ['bronze_axe', 'iron_axe', 'steel_axe', 'black_axe', 'mithril_axe', 'adamant_axe', 'rune_axe'], tip: 'To find the leprechaun; the monks won\'t take one to Entrana, but the zombies in the cave drop bronze axes' },
    knife: { name: 'Knife', obj: 'knife', tip: 'To carve the Dramen branch into a staff' },
    branch: { name: 'Dramen branch', obj: 'dramen_branch', tip: 'Cut from the Dramen tree' },
    staff: { name: 'Dramen staff', obj: 'dramen_staff', tip: 'Carved from a Dramen branch with a knife' },
    staffworn: { name: 'Dramen staff (wielded)', obj: 'dramen_staff', worn: true },
  },
  required: ['axe', 'knife'],
  skills: ['31 Crafting', '36 Woodcutting', 'Able to defeat the Tree Spirit (level 101) without weapons or armour (Entrana allows none)'],
  zones: {
    dungeon: [2816, 9664, 2880, 9792, 0],
  },
  steps: {
    start: { text: 'Talk to the warrior in the adventurers\' camp in the swamp south of Lumbridge.', npc: 'warrioradventurerpg', at: [3148, 3207, 0], options: ['What are you camped here for?', "If it's hidden how are you planning to find it?", "Looks like you don't know either."] },
    tree: { text: 'Chop the tree west of the camp with your axe: the leprechaun Shamus jumps out. Talk to him before he runs off.', loc: 'leprechauntree', at: [3138, 3212, 0], items: ['axe'] },
    shamus: { text: 'Talk to Shamus the leprechaun.', npc: 'zanarisleprechaun', at: [3138, 3211, 0], spawned: true, options: ['How does it fit in a shed then?'] },
    entrana: { text: 'Leave all weapons, armour and axes behind (keep the knife) and take the monks\' ship from Port Sarim to Entrana. Climb down the ladder by the monk in the north-west of the island (it only goes one way).', loc: 'entranaladdertop', at: [2820, 3374, 0], items: ['knife'], options: ['Well that is a risk I will have to take.'] },
    zombies: { text: 'Kill the zombies near the bottom of the ladder until one drops a bronze axe.', npc: 'zombie_entranan', at: [2846, 9760, 0] },
    spirit: { text: 'Find the Dramen tree in the south-east of the cave and chop it: the Tree Spirit appears. Defeat it (magic or your fists).', loc: 'dramentree', at: [2860, 9734, 0], items: ['axe'] },
    branch: { text: 'Chop the Dramen tree again for a branch (take a spare in case you need another staff).', loc: 'dramentree', at: [2860, 9734, 0], items: ['axe'] },
    carve: { text: 'Use your knife on the Dramen branch to carve a staff.', at: [2860, 9734, 0], items: ['knife', 'branch'] },
    shed: { text: 'Leave the cave (its portal leads to the deep Wilderness, so teleporting out is safer), then wield the Dramen staff and go through the door of the shed in the middle of Lumbridge Swamp.', loc: 'zanarisdoor', at: [3202, 3169, 0], items: ['staffworn'] },
  },
  stages: {
    0: [[null, 'start']],
    1: [
      ['npc:zanarisleprechaun', 'shamus'],
      [null, 'tree'],
    ],
    2: [
      ['in:dungeon & !have:axe', 'zombies'],
      ['in:dungeon', 'spirit'],
      [null, 'entrana'],
    ],
    3: [
      ['in:dungeon & !have:axe', 'zombies'],
      ['in:dungeon', 'branch'],
      [null, 'entrana'],
    ],
    4: [
      ['have:branch', 'carve'],
      ['in:dungeon & !have:axe', 'zombies'],
      ['in:dungeon', 'branch'],
      [null, 'entrana'],
    ],
    5: [
      ['have:staff | wear:staffworn', 'shed'],
      ['have:branch', 'carve'],
      [null, 'entrana'],
    ],
  },
  sections: [
    { title: 'The adventurers', steps: ['start', 'tree', 'shamus'], items: ['axe'] },
    { title: 'The Dramen tree', steps: ['entrana', 'zombies', 'spirit', 'branch', 'carve'], items: ['knife'] },
    { title: 'Zanaris', steps: ['shed'], items: ['staffworn'] },
  ],
  rewards: ['3 Quest Points', 'Access to Zanaris'],
};
