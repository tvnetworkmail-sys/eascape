// The Knight's Sword. Based on Quest Helper's TheKnightsSword (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (squire, quest_squire, reldo, thurgo,
// cupboards) and maps.
module.exports = {
  quest: 'squire',
  difficulty: 'Intermediate',
  start: 'Talk to the Squire in the courtyard of Falador castle.',
  items: {
    pie: { name: 'Redberry pie', obj: 'redberry_pie', tip: 'Use redberries on a pie shell and bake it on a range (10 Cooking)' },
    portrait: { name: 'Portrait', obj: 'knights_portrait', tip: "In Sir Vyvin's cupboard" },
    blurite: { name: 'Blurite ore', obj: 'blurite_ore', tip: 'Mine it in the Asgarnian Ice Dungeon south of Port Sarim (10 Mining)' },
    iron: { name: 'Iron bar', obj: 'iron_bar', qty: 2, tip: 'Smelt iron ore at a furnace (15 Smithing)' },
    pickaxe: { name: 'Pickaxe', category: 'weapon_pickaxe' },
    sword: { name: 'Blurite sword', obj: 'faladian_sword' },
  },
  required: ['pie', 'iron', 'pickaxe'],
  skills: ['10 Mining'],
  zones: {
    dungeon: [3000, 9530, 3080, 9600, 0],
  },
  steps: {
    start: { text: 'Talk to the Squire in the courtyard of Falador castle.', npc: 'squire', at: [2977, 3342, 0], options: ['And how is life as a squire?', 'Is he angry?', 'Well, the kingdom is fairly abundant with swords...', 'So would these dwarves make another one?', "Ok, I'll give it a go."] },
    reldo: { text: 'Talk to Reldo in the Varrock Palace library.', npc: 'reldo', at: [3209, 3495, 0], options: ['What do you know about the Imcando dwarves?'] },
    pie: { text: 'Bring a redberry pie to Thurgo on the cliffs south of Port Sarim.', npc: 'thurgo', at: [3001, 3144, 0], items: ['pie'], options: ['Would you like a redberry pie?'] },
    thurgo: { text: 'Talk to Thurgo again and ask him to make the sword.', npc: 'thurgo', at: [3001, 3144, 0] },
    squire: { text: 'Talk to the Squire again.', npc: 'squire', at: [2977, 3342, 0] },
    cupboard: { text: "Search Sir Vyvin's cupboard on the top floor of Falador castle for the portrait, while Sir Vyvin is not near it.", loc: 'vyvincupboardshut', at: [2984, 3336, 2] },
    portrait: { text: 'Bring the portrait to Thurgo.', npc: 'thurgo', at: [3001, 3144, 0], items: ['portrait'] },
    blurite: { text: 'Mine a blurite ore in the Asgarnian Ice Dungeon (in the cave south of Port Sarim). Ice warriors and giants guard it.', loc: 'bluriterock', at: [3059, 9564, 0], items: ['pickaxe'] },
    sword: { text: 'Bring the blurite ore and 2 iron bars to Thurgo.', npc: 'thurgo', at: [3001, 3144, 0], items: ['blurite', 'iron'] },
    finish: { text: 'Bring the sword to the Squire.', npc: 'squire', at: [2977, 3342, 0], items: ['sword'] },
  },
  stages: {
    0: [[null, 'start']],
    1: [[null, 'reldo']],
    2: [[null, 'pie']],
    3: [[null, 'thurgo']],
    4: [[null, 'squire']],
    5: [
      ['have:portrait', 'portrait'],
      [null, 'cupboard'],
    ],
    6: [
      ['have:sword', 'finish'],
      ['have:blurite', 'sword'],
      [null, 'blurite'],
    ],
  },
  sections: [
    { title: 'Starting off', steps: ['start', 'reldo'] },
    { title: 'Thurgo', steps: ['pie', 'thurgo', 'squire'], items: ['pie'] },
    { title: 'The portrait', steps: ['cupboard', 'portrait'] },
    { title: 'The sword', steps: ['blurite', 'sword', 'finish'], items: ['pickaxe', 'iron'] },
  ],
  rewards: ['1 Quest Point', '12,725 Smithing experience'],
};
