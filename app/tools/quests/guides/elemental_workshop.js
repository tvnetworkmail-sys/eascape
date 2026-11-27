// Elemental Workshop. Based on Quest Helper's ElementalWorkshopI (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps and positions from our scripts (quest_elemental_workshop: quest_elemental_workshop,
// elemental_workshop_shield_book) and maps. The quest keeps its progress in bits
// (%elemental_workshop_bits: read the book 2, slashed it 4, went in 8192); inside the workshop the
// guide follows what you carry.
module.exports = {
  quest: 'elemental_workshop',
  difficulty: 'Novice',
  members: true,
  start: "Search the bookcase in the house in the north-east of Seers' Village.",
  items: {
    knife: { name: 'Knife', obj: 'knife', tip: 'To slash the book open' },
    pickaxe: { name: 'Any pickaxe', category: 'weapon_pickaxe', tip: 'For the elemental rock' },
    hammer: { name: 'Hammer', obj: 'hammer', tip: 'For the workbench' },
    thread: { name: 'Thread', obj: 'thread', tip: 'To fix the bellows' },
    coal: { name: 'Coal', obj: 'coal', qty: 4, tip: 'To smelt the elemental ore' },
    book: { name: 'Battered book', obj: 'elemental_workshop_shield_book', tip: "In the bookcase in Seers' Village" },
    key: { name: 'Battered key', obj: 'elemental_workshop_key', tip: 'Inside the book' },
    ore: { name: 'Elemental ore', obj: 'elemental_workshop_ore', tip: 'Mined from the elemental rock' },
    bar: { name: 'Elemental bar', obj: 'elemental_workshop_bar', tip: 'Smelted in the workshop furnace' },
  },
  required: ['knife', 'pickaxe', 'hammer', 'thread', 'coal'],
  skills: ['20 Mining', '20 Smithing', '20 Crafting'],
  steps: {
    start: { text: "Search the bookcase in the house in the north-east of Seers' Village for a battered book, and read it.", loc: 'elemental_workshop_bookcase', at: [2716, 3481, 0] },
    slash: { text: 'Use a knife on the book to find a key inside.', loc: 'elemental_workshop_bookcase', at: [2716, 3481, 0], items: ['book', 'knife'] },
    wall: { text: "Use the key on the odd-looking wall north of the house, by the river, and go down the stairs into the workshop.", loc: 'elemental_workshop_oddwall_l', at: [2709, 3495, 0], items: ['key'] },
    water: { text: 'Turn the two valves in the north of the workshop, then pull the water lever to start the water wheel.', loc: 'elemental_workshop_water_lever', at: [2722, 9906, 0] },
    bellows: { text: 'Search the crates for a needle and leather, then fix the bellows in the east with them and your thread; pull the air lever.', loc: 'elemental_workshop_bellows_l', at: [2734, 9882, 0], items: ['thread'] },
    furnace: { text: 'Take a bowl from a crate, fill it at the lava trough and use it on the furnace to light it.', loc: 'elemental_workshop_furnace', at: [2724, 9874, 0] },
    rock: { text: 'With the workshop running, mine the elemental rocks in the west for ore (an earth elemental may jump out).', loc: 'elemental_workshop_rock', at: [2690, 9903, 0], items: ['pickaxe'] },
    smelt: { text: 'Use the elemental ore on the furnace, with 4 coal, to smelt an elemental bar.', loc: 'elemental_workshop_furnace', at: [2724, 9874, 0], items: ['ore', 'coal'] },
    bench: { text: 'Use the bar on the workbench, with your hammer and the book, to make an elemental shield.', loc: 'elemental_workshop_workbench', at: [2717, 9887, 0], items: ['bar', 'hammer', 'book'] },
  },
  stages: {
    '0-1': [[null, 'start']],
    '2-3': [[null, 'slash']],
    '4-8191': [[null, 'wall']],
    '8192-1048574': [
      ['have:bar', 'bench'],
      ['have:ore', 'smelt'],
      [null, 'water'],
    ],
  },
  sections: [
    { title: 'The book', steps: ['start', 'slash', 'wall'], items: ['knife'] },
    { title: 'The workshop', steps: ['water', 'bellows', 'furnace', 'rock'], items: ['thread', 'pickaxe'] },
    { title: 'The shield', steps: ['smelt', 'bench'], items: ['coal', 'hammer'] },
  ],
  rewards: ['1 Quest Point', '5,000 Crafting experience', '5,000 Smithing experience', 'Ability to make elemental shields'],
};
