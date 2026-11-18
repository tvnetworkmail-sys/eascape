// Rag and Bone Man. EASCape: steps, items and positions from our scripts (quest_rag) and the cache's
// map; the step texts follow the OSRS wiki's guide.
module.exports = {
  quest: 'rag',
  members: true,
  difficulty: 'Novice',
  start: 'Talk to the Odd Old Man at his shack north-east of Varrock, by the Digsite road.',
  items: {
    coins: { name: 'Coins', obj: 'coins', tip: 'For the vinegar: about 8 jugs' },
    pots: { name: 'Empty pots', obj: 'pot_empty', tip: 'One for each bone' },
    logs: { name: 'Logs', obj: 'logs', tip: 'One for each bone' },
    tinderbox: { name: 'Tinderbox', obj: 'tinderbox' },
    vinegar: { name: 'Jug of vinegar', obj: 'rag_vinegar', tip: 'Fortunato in Draynor market sells it' },
    potvinegar: { name: 'Pot of vinegar', obj: 'rag_pot_vinegar' },
    weapon: { name: 'A weapon' },
  },
  required: ['coins', 'pots', 'logs', 'tinderbox'],
  skills: [],
  steps: {
    start: { text: 'Talk to the Odd Old Man and offer to help him collect bones.', npc: 'rag_odd_old_man', at: [3362, 3503, 0], options: ['Anything I could do to help?', "Yes, I'll give you a hand."] },
    vinegar: { text: "Ask Fortunato, the wine merchant in Draynor market, for vinegar and buy a jug for each bone. Use the vinegar on an empty pot.", npc: 'rag_wine_merchant', at: [3082, 3253, 0], items: ['coins', 'pots'] },
    bones: { text: "Kill one of each: a goblin, a bear, a big frog, a ram, a unicorn, a monkey, a giant rat and a giant bat. While you need one, its bone always drops. Put each bone into a pot of vinegar.", npc: 'goblin', at: [3250, 3240, 0], keepAt: true, spawned: true, items: ['weapon', 'potvinegar'] },
    boil: { text: "At the Odd Old Man's pot-boiler: put logs in, put the pot of bone and vinegar on it, then light the logs. When the vinegar has boiled away, take the clean bone out. Repeat for each bone.", loc: 'rag_multi_potboiler', at: [3360, 3505, 0], items: ['logs', 'tinderbox'] },
    finish: { text: 'Give the Odd Old Man the cleaned bones. When he has all eight, the quest is complete. His wish list on the shack wall has 27 more.', npc: 'rag_odd_old_man', at: [3362, 3503, 0] },
  },
  stages: {
    0: [[null, 'start']],
    1: [['have:vinegar | have:potvinegar', 'bones'], [null, 'vinegar']],
  },
  sections: [
    { title: 'Starting off', steps: ['start'] },
    { title: 'The bones', steps: ['vinegar', 'bones', 'boil', 'finish'] },
  ],
  rewards: ['1 Quest Point', '500 Cooking experience', '500 Prayer experience', "The wish list: a further Quest Point, 5,000 Prayer experience and a ram skull helm or bonesack"],
};
