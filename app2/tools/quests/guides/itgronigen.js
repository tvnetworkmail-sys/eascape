// Observatory Quest. Based on Quest Helper's ObservatoryQuest (BSD 2-Clause, (c) 2020 Zoinkwiz).
// 2007RS: the quest as reworked on 17 July 2007 (the 2007 map's observatory, reception, goblin
// settlement and dungeon), steps, options and positions from our scripts (quest_itgronigen:
// observatory_professor, observatory_assistant, quest_itgronigen) and maps; the stages are the
// quest's own (0-8, unchanged). The kitchen key's chest and the constellation you see are random.
module.exports = {
  quest: 'itgronigen',
  members: true,
  difficulty: 'Novice',
  start: 'Talk to the professor in the Observatory reception, north of Castle Wars.',
  items: {
    planks: { name: 'Planks', obj: 'woodplank', qty: 3, tip: 'Ordinary planks: Port Khazard, the Barbarian Outpost or the Sawmill Operator, as the assistant says' },
    bronze: { name: 'Bronze bar', obj: 'bronze_bar', tip: 'Smelt tin and copper ore at a furnace' },
    glass: { name: 'Molten glass', obj: 'molten_glass', tip: 'The professor gives it back after you bring the lens mould' },
    mould: { name: 'Lens mould', obj: 'lens_mould', tip: 'In the goblins\' stove, behind the kitchen gate in the dungeon' },
    key: { name: 'Goblin kitchen key', obj: 'keep_key', tip: 'In one of the three south-eastern chests of the dungeon' },
    lens: { name: 'Observatory lens', obj: 'lens' },
  },
  required: ['planks', 'bronze', 'glass'],
  skills: [],
  zones: {
    dungeon: [2295, 9340, 2370, 9410, 0],
    dome: [2433, 3154, 2448, 3169, 0],
    domeTop: [2433, 3154, 2448, 3169, 1],
  },
  steps: {
    start: { text: 'Talk to the professor in the Observatory reception and offer to help with the telescope.', npc: 'obs_professor_6119', at: [2440, 3187, 0], options: ['Talk about the Observatory quest.', 'An Observatory?', 'Yes.'] },
    planks: { text: 'Bring the professor three planks.', npc: 'obs_professor_6119', at: [2440, 3187, 0], options: ['Talk about the Observatory quest.'], items: ['planks'] },
    bronze: { text: 'Bring the professor a bronze bar.', npc: 'obs_professor_6119', at: [2440, 3187, 0], options: ['Talk about the Observatory quest.'], items: ['bronze'] },
    glass: { text: 'Bring the professor some molten glass.', npc: 'obs_professor_6119', at: [2440, 3187, 0], options: ['Talk about the Observatory quest.'], items: ['glass'] },
    enter: { text: 'Climb down the stairs in the goblin settlement east of the reception into the dungeon.', loc: 'obs_settlement_stairs_25432', at: [2458, 3186, 0] },
    key: { text: 'Search the three chests in the south-east of the dungeon for the kitchen key (the others hold poisonous spiders).', loc: ['obs_chest_25385', 'obs_chest_25387', 'obs_chest_25389'], at: [2360, 9366, 0] },
    mould: { text: 'Prod the sleeping guard by the kitchen gate in the north-west and kill him (or lure him away from the gate), unlock the gate with the key and inspect the goblin stove for the lens mould.', loc: 'obs_stove_25442', at: [2326, 9389, 0], keepAt: true, items: ['key'] },
    giveMould: { text: 'Take the lens mould back to the professor; he gives the molten glass back.', npc: 'obs_professor_6119', at: [2440, 3187, 0], options: ['Talk about the Observatory quest.'], items: ['mould'] },
    lens: { text: 'Use the molten glass on the lens mould to make the lens, and give it to the professor.', npc: 'obs_professor_6119', at: [2440, 3187, 0], options: ['Talk about the Observatory quest.'], items: ['mould', 'glass'] },
    toDome: { text: 'Go back down into the dungeon and follow it round anti-clockwise to the southern stairs up into the Observatory.', loc: 'obs_dungeon_stairs_25429', at: [2335, 9351, 0] },
    upstairs: { text: 'Climb the stairs in the Observatory to the telescope.', loc: 'obs_observatory_stairs_up_25431', at: [2444, 3159, 0] },
    telescope: { text: 'Look through the telescope, then tell the professor which constellation you saw (the star charts downstairs show them all).', loc: 'obs_telescope_25591', at: [2440, 3159, 1] },
  },
  stages: {
    0: [[null, 'start']],
    1: [[null, 'planks']],
    2: [[null, 'bronze']],
    3: [[null, 'glass']],
    4: [
      ['have:mould', 'giveMould'],
      ['have:key & in:dungeon', 'mould'],
      ['in:dungeon', 'key'],
      [null, 'enter'],
    ],
    5: [[null, 'lens']],
    6: [
      ['in:domeTop', 'telescope'],
      ['in:dome', 'upstairs'],
      [null, 'toDome'],
    ],
  },
  sections: [
    { title: 'Telescope parts', steps: ['start', 'planks', 'bronze', 'glass'], items: ['planks', 'bronze', 'glass'] },
    { title: 'The lens', steps: ['enter', 'key', 'mould', 'giveMould', 'lens'] },
    { title: 'The telescope', steps: ['toDome', 'upstairs', 'telescope'] },
  ],
  rewards: ['2 Quest Points', '2,250 Crafting experience', 'An uncut sapphire', 'A reward depending on the constellation you see'],
};
