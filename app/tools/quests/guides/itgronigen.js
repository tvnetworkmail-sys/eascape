// Observatory Quest. Based on Quest Helper's ObservatoryQuest (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (quest_itgronigen: observatory_professor,
// observatory_assistant, quest_itgronigen) and maps; the step texts follow our journal. The
// constellation you see (and so your reward) is random.
module.exports = {
  quest: 'itgronigen',
  members: true,
  difficulty: 'Novice',
  start: 'Talk to the professor in the Observatory reception, south-west of Ardougne.',
  items: {
    planks: { name: 'Planks', obj: 'woodplank', qty: 3, tip: 'Lying around at the Barbarian Outpost north-east of Ardougne, as the assistant says' },
    bronze: { name: 'Bronze bar', obj: 'bronze_bar', tip: 'Smelt tin and copper ore at a furnace' },
    glass: { name: 'Molten glass', obj: 'molten_glass', tip: 'The professor gives it back after you bring the lens mould' },
    mould: { name: 'Lens mould', obj: 'lens_mould', tip: 'Under a sack in the goblins\' dungeon' },
    key: { name: 'Keep key', obj: 'keep_key', tip: 'In a chest in the goblins\' dungeon' },
    lens: { name: 'Lens', obj: 'lens' },
  },
  required: ['planks', 'bronze', 'glass'],
  skills: [],
  steps: {
    start: { text: 'Talk to the professor in the Observatory reception and offer to help with the telescope.', npc: 'observatory_professor', at: [2438, 3186, 0], options: ["I'd like to have a look through that telescope.", 'Sounds interesting, what can I do for you?'] },
    planks: { text: 'Bring the professor three planks.', npc: 'observatory_professor', at: [2438, 3186, 0], items: ['planks'] },
    bronze: { text: 'Bring the professor a bronze bar.', npc: 'observatory_professor', at: [2438, 3186, 0], items: ['bronze'] },
    glass: { text: 'Bring the professor some molten glass.', npc: 'observatory_professor', at: [2438, 3186, 0], items: ['glass'] },
    key: { text: 'Climb down the ladder by the reception into the goblins\' dungeon and search the chests for the keep key.', loc: 'loc_2197', at: [2428, 9419, 0] },
    mould: { text: 'Unlock the gate in the west of the dungeon with the keep key (the goblin guard attacks) and search the sack behind it for the lens mould.', loc: 'loc_2212', at: [2390, 9454, 0], keepAt: true, items: ['key'] },
    giveMould: { text: 'Give the lens mould to the professor; he gives the molten glass back.', npc: 'observatory_professor', at: [2438, 3186, 0], items: ['mould'] },
    lens: { text: 'Use the molten glass on the lens mould to make the lens, and give it to the professor.', npc: 'observatory_professor', at: [2438, 3186, 0], items: ['mould', 'glass'] },
    telescope: { text: 'Go through the dungeon and up the ladder into the Observatory, then look through the telescope with the professor there and tell him what you see.', loc: 'telescope', at: [2440, 3157, 0], options: ['I can see a constellation.'] },
  },
  stages: {
    0: [[null, 'start']],
    1: [[null, 'planks']],
    2: [[null, 'bronze']],
    3: [[null, 'glass']],
    4: [
      ['have:mould', 'giveMould'],
      ['have:key', 'mould'],
      [null, 'key'],
    ],
    5: [[null, 'lens']],
    6: [[null, 'telescope']],
  },
  sections: [
    { title: 'Telescope parts', steps: ['start', 'planks', 'bronze', 'glass'], items: ['planks', 'bronze', 'glass'] },
    { title: 'The lens', steps: ['key', 'mould', 'giveMould', 'lens'] },
    { title: 'The telescope', steps: ['telescope'] },
  ],
  rewards: ['2 Quest Points', '2,250 Crafting experience', 'An uncut sapphire', 'A reward depending on the constellation you see'],
};
