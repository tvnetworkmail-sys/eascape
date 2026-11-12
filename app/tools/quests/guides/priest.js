// The Restless Ghost. Based on Quest Helper's TheRestlessGhost (BSD 2-Clause, (c) 2020
// Zoinkwiz), for the 2004 quest: the skull lies on the floor of the Wizards' Tower basement.
module.exports = {
  quest: 'priest',
  difficulty: 'Novice',
  start: 'Talk to Father Aereck in the church in Lumbridge.',
  items: {
    amulet: { name: 'Amulet of ghostspeak', obj: 'amulet_of_ghostspeak', worn: true, tip: 'Father Urhney gives you another if you lose it' },
    skull: { name: "Ghost's skull", obj: 'ghostskull' },
  },
  zones: { basement: [3094, 9553, 3125, 9582, 0] },
  steps: {
    aereck: { text: 'Talk to Father Aereck in the Lumbridge church.', npc: 'father_aereck', at: [3244, 3206, 0], options: ["I'm looking for a quest!", 'Ok, let me help then.'] },
    urhney: { text: 'Talk to Father Urhney in his hut in Lumbridge Swamp.', npc: 'father_urhney', at: [3235, 3153, 0], options: ['Father Aereck sent me to talk to you.', "He's got a ghost haunting his graveyard."] },
    coffin: { text: 'Wear the amulet of ghostspeak and open the coffin in the graveyard to make the ghost appear.', loc: ['shutghostcoffin', 'restless_ghost_altar'], at: [3249, 3192, 0], items: ['amulet'] },
    ghost: { text: 'Talk to the ghost while wearing the amulet of ghostspeak.', npc: 'ghostx', at: [3249, 3194, 0], items: ['amulet'], spawned: true, options: ['Yep, now tell me what the problem is.', 'Yes, ok. Do you know why you\'re a ghost?'] },
    tower: { text: "Climb down the ladder into the Wizards' Tower basement, south of Draynor.", loc: 'wizards_tower_laddertop', at: [3104, 3162, 0] },
    skull: { text: "Pick up the ghost's skull in the far corner of the basement. A skeleton appears and attacks: you can just run.", obj: 'ghostskull', at: [3120, 9567, 0] },
    leave: { text: 'Climb back up the ladder.', loc: 'wizards_tower_ladder', at: [3103, 9576, 0], items: ['skull'] },
    openCoffin: { text: 'Open the coffin in the Lumbridge graveyard.', loc: 'shutghostcoffin', at: [3249, 3192, 0], items: ['skull'] },
    putSkull: { text: 'Use the skull on the open coffin to finish the quest.', loc: ['restless_ghost_altar', 'shutghostcoffin'], at: [3249, 3192, 0], items: ['skull'] },
  },
  stages: {
    0: [[null, 'aereck']],
    1: [[null, 'urhney']],
    2: [['npc:ghostx', 'ghost'], [null, 'coffin']],
    3: [['in:basement', 'skull'], [null, 'tower']],
    4: [['have:skull & in:basement', 'leave'], ['have:skull', 'putSkull'], ['in:basement', 'skull'], [null, 'tower']],
  },
  sections: [
    { title: 'Starting off', steps: ['aereck', 'urhney'] },
    { title: 'The ghost', steps: ['coffin', 'ghost'], items: ['amulet'] },
    { title: 'The skull', steps: ['tower', 'skull', 'leave', 'putSkull'] },
  ],
  rewards: ['1 Quest Point', '1,125 Prayer experience'],
};
