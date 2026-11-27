// Shield of Arrav. Based on Quest Helper's ShieldOfArravPhoenixGang and ShieldOfArravBlackArmGang
// (BSD 2-Clause, (c) 2020 Zoinkwiz), as one guide for both gangs.
// EASCape: steps, options and positions from our scripts (reldo, baraek, straven, tramp, katrine,
// quest_blackarmgang, jonny_the_beard, curator, king_roald) and maps. The app follows the Black
// Arm Gang's variable, so the Phoenix Gang's progress comes from what the game has said and what
// you carry.
module.exports = {
  quest: 'blackarmgang',
  difficulty: 'Novice',
  start: 'Phoenix Gang: talk to Reldo in Varrock Palace\'s library. Black Arm Gang: talk to the tramp by the Blue Moon Inn. You need a friend in the other gang.',
  items: {
    coins: { name: 'Coins', obj: 'coins', qty: 20, tip: 'For Baraek (Phoenix Gang)' },
    book: { name: "'The Shield of Arrav'", obj: 'the_shield_of_arrav', tip: 'In the bookcase in the palace library' },
    report: { name: 'Intelligence report', obj: 'intelligence_report', tip: 'Jonny the Beard drops it' },
    key: { name: 'Weapon store key', obj: 'phoenixkey2', tip: 'Straven gives it when you join the Phoenix Gang' },
    crossbow: { name: 'Phoenix crossbow', obj: 'phoenix_crossbow', qty: 2, tip: 'In the Phoenix Gang\'s weapon store' },
    shield1: { name: 'Shield of Arrav (left half)', obj: 'arravshield1', tip: 'In the Phoenix Gang\'s chest' },
    shield2: { name: 'Shield of Arrav (right half)', obj: 'arravshield2', tip: 'In the Black Arm Gang\'s cupboard' },
    cert: { name: 'Certificate', obj: 'arravcertificate', tip: 'The museum curator gives two for the whole shield' },
  },
  required: ['coins'],
  skills: ['A friend doing the quest for the other gang', 'Phoenix Gang: able to defeat Jonny the Beard (level 2)'],
  flags: {
    reldo: { on: "If you look in a book called 'The Shield of Arrav', you'll find a quest in there." },
    reldo2: { on: "If I were you I would talk to Baraek, the fur trader in the market place." },
    baraek: { on: 'Ok, to get to the gang hideout, enter Varrock through the south gate.' },
    straven: { on: 'Kill him and bring back his intelligence report.' },
    joined: { on: 'Ok! You can join the Phoenix Gang! I am Straven, one of the gang leaders.' },
  },
  steps: {
    start: { text: 'Phoenix Gang: talk to Reldo in the palace library (Black Arm Gang: talk to the tramp by the Blue Moon Inn instead).', npc: 'reldo', at: [3209, 3495, 0], options: ["I'm in search of a quest."] },
    book: { text: "Search the bookcase in the library for 'The Shield of Arrav' and read it.", loc: 'questbookcase', at: [3212, 3493, 0] },
    reldo2: { text: 'Tell Reldo you have read the book.', npc: 'reldo', at: [3209, 3495, 0], items: ['book'] },
    baraek: { text: 'Ask Baraek in Varrock Square where the Phoenix Gang is, and give him 20 coins.', npc: 'baraek', at: [3218, 3435, 0], items: ['coins'], options: ['Can you tell me where I can find the Phoenix Gang?', 'Okay. Have 20 gold coins.'] },
    straven: { text: 'Go down the ladder at the end of the alley south of the first turning east from Varrock\'s south gate, and talk to Straven at the door.', loc: 'phoenixdoor', at: [3247, 9779, 0], options: ['I know who you are!', "I'd like to offer you my services."] },
    jonny: { text: 'Kill Jonny the Beard in the Blue Moon Inn and take his intelligence report.', npc: 'jonny_the_beard', at: [3223, 3395, 0] },
    report: { text: 'Bring Straven the intelligence report at the Phoenix Gang\'s door.', loc: 'phoenixdoor', at: [3247, 9779, 0], items: ['report'] },
    chest: { text: 'Search the chest in the Phoenix Gang\'s hideout for half of the shield. Give your friend the weapon store key so they can join the Black Arm Gang.', loc: 'phoenixshutchest', at: [3235, 9761, 0] },
    tramp: { text: 'Black Arm Gang: give the tramp by the Blue Moon Inn a coin and ask him about the alleyway.', npc: 'tramppg', at: [3208, 3391, 0], options: ['Ok. Here you go.', 'Is there anything down this alleyway?', 'Do you think they would let me join?'] },
    katrine: { text: 'Talk to Katrine at the end of the alley.', npc: 'katrine', at: [3186, 3385, 0], options: ["I've heard you're the Black Arm Gang.", "I'd rather not reveal my sources.", 'I want to become a member of your gang.', 'Well, you can give me a try can\'t you?', 'Ok, no problem.'] },
    crossbows: { text: 'With the key from your Phoenix Gang friend, unlock the weapon store east of the Blue Moon Inn and take the two crossbows upstairs.', obj: 'phoenix_crossbow', at: [3245, 3385, 1] },
    katrine2: { text: 'Give Katrine the two crossbows.', npc: 'katrine', at: [3186, 3385, 0], items: ['crossbow'] },
    cupboard: { text: 'Search the cupboard upstairs in the Black Arm Gang\'s house for half of the shield.', loc: 'blackarmcupboardshut', at: [3189, 3385, 1] },
    curator: { text: 'Put both halves together (trade with your friend) and take them to the curator of Varrock Museum for two certificates; give one to your friend.', npc: 'curator', at: [3255, 3445, 0], items: ['shield1', 'shield2'] },
    king: { text: 'Take your certificate to King Roald in Varrock Palace.', npc: 'king_roald', at: [3222, 3476, 0], items: ['cert'] },
  },
  stages: {
    0: [
      ['have:cert', 'king'],
      ['have:shield1 & have:shield2', 'curator'],
      ['have:shield1', 'curator'],
      ['seen:joined', 'chest'],
      ['have:report', 'report'],
      ['seen:straven', 'jonny'],
      ['seen:baraek', 'straven'],
      ['seen:reldo2', 'baraek'],
      ['have:book', 'reldo2'],
      ['seen:reldo', 'book'],
      [null, 'start'],
    ],
    1: [[null, 'katrine']],
    2: [
      ['have:crossbow:2', 'katrine2'],
      [null, 'crossbows'],
    ],
    3: [
      ['have:cert', 'king'],
      ['have:shield2', 'curator'],
      [null, 'cupboard'],
    ],
  },
  sections: [
    { title: 'Phoenix Gang', steps: ['start', 'book', 'reldo2', 'baraek', 'straven', 'jonny', 'report', 'chest'], items: ['coins'] },
    { title: 'Black Arm Gang', steps: ['tramp', 'katrine', 'crossbows', 'katrine2', 'cupboard'] },
    { title: 'The reward', steps: ['curator', 'king'], items: ['shield1', 'shield2'] },
  ],
  rewards: ['1 Quest Point', '600 coins'],
};
