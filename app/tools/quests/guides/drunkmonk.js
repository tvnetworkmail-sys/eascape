// Monk's Friend. Based on Quest Helper's MonksFriend (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (brother_omad, brother_cedric,
// quest_drunkmonk) and maps.
module.exports = {
  quest: 'drunkmonk',
  members: true,
  difficulty: 'Novice',
  start: 'Talk to Brother Omad in the monastery south-west of Ardougne.',
  items: {
    blanket: { name: "Child's blanket", obj: 'childs_blanket', tip: 'In the thieves\' den under the stone circle south of Ardougne' },
    water: { name: 'Jug of water', obj: 'jug_water', tip: 'Fill a jug at a sink, well or fountain' },
    logs: { name: 'Logs', obj: 'logs', tip: 'Chop a normal tree' },
  },
  required: ['water', 'logs'],
  zones: {
    den: [2540, 9590, 2590, 9640, 0],
  },
  steps: {
    start: { text: 'Talk to Brother Omad in the monastery south-west of Ardougne.', npc: 'brother_omad', at: [2604, 3209, 0], options: ["Why can't you sleep, what's wrong?", 'Can I help at all?'] },
    ladder: { text: 'Go to the stone circle south of Ardougne; a ladder appears in the middle. Climb down it.', at: [2561, 3222, 0] },
    blanket: { text: "Pick up the child's blanket in the thieves' den.", obj: 'childs_blanket', at: [2570, 9604, 0] },
    giveBlanket: { text: 'Bring the blanket to Brother Omad.', npc: 'brother_omad', at: [2604, 3209, 0], items: ['blanket'] },
    omad: { text: 'Talk to Brother Omad again about the party.', npc: 'brother_omad', at: [2604, 3209, 0], options: ["Who's Brother Cedric?", 'Where should I look?'] },
    cedric: { text: 'Find Brother Cedric in the woods north of the monastery.', npc: 'brother_cedric', at: [2614, 3259, 0] },
    water: { text: 'Give Brother Cedric a jug of water.', npc: 'brother_cedric', at: [2614, 3259, 0], items: ['water'] },
    cart: { text: 'Talk to Brother Cedric again and offer to help with his cart.', npc: 'brother_cedric', at: [2614, 3259, 0], options: ["Yes, I'd be happy to!"] },
    logs: { text: 'Give Brother Cedric some logs.', npc: 'brother_cedric', at: [2614, 3259, 0], items: ['logs'] },
    finish: { text: 'Return to Brother Omad for the party.', npc: 'brother_omad', at: [2604, 3209, 0] },
  },
  stages: {
    0: [[null, 'start']],
    10: [
      ['have:blanket', 'giveBlanket'],
      ['in:den', 'blanket'],
      [null, 'ladder'],
    ],
    20: [[null, 'omad']],
    30: [[null, 'cedric']],
    40: [[null, 'water']],
    50: [[null, 'cart']],
    60: [[null, 'logs']],
    70: [[null, 'finish']],
  },
  sections: [
    { title: 'Starting off', steps: ['start', 'ladder', 'blanket', 'giveBlanket'] },
    { title: 'Brother Cedric', steps: ['omad', 'cedric', 'water', 'cart', 'logs'], items: ['water', 'logs'] },
    { title: 'The party', steps: ['finish'] },
  ],
  rewards: ['1 Quest Point', '2,000 Woodcutting experience', '8 law runes'],
};
