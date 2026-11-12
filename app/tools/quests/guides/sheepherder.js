// Sheep Herder. Based on Quest Helper's SheepHerder (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (quest_sheepherder: councillor_halgrive,
// doctor_orbon, diseased_sheep, the gate and the furnace) and maps.
module.exports = {
  quest: 'sheepherder',
  members: true,
  difficulty: 'Novice',
  start: 'Talk to Councillor Halgrive in East Ardougne.',
  items: {
    coins: { name: 'Coins', obj: 'coins', qty: 100, tip: 'For the protective clothing' },
    feed: { name: 'Poisoned sheep feed', obj: 'poisoned_feed', tip: 'Councillor Halgrive gives it (and more if you lose it)' },
    jacket: { name: 'Protective jacket', obj: 'plague_jacket', worn: true, tip: 'Doctor Orbon sells the outfit for 100 coins' },
    trousers: { name: 'Protective trousers', obj: 'plague_trousers', worn: true },
    prod: { name: 'Cattleprod', obj: 'cattleprod', worn: true, tip: 'Lies in the sheep pen by Farmer Brumty' },
    bones: { name: 'Sheep bones', obj: ['sheepbonesa', 'sheepbonesb', 'sheepbonesc', 'sheepbonesd'] },
  },
  required: ['coins'],
  steps: {
    start: { text: 'Talk to Councillor Halgrive in Ardougne.', npc: 'councillor_halgrive', at: [2617, 3299, 0], options: ["What's wrong?", 'I can do that for you.'] },
    orbon: { text: 'Buy protective clothing from Doctor Orbon, next to the councillor.', npc: 'doctor_orbon', at: [2614, 3306, 0], items: ['coins'], options: ["Ok, I'll take it."] },
    prod: { text: 'Wear the protective clothing, go into the pen north of Ardougne by Farmer Brumty and pick up the cattleprod.', obj: 'cattleprod', at: [2604, 3357, 0], items: ['jacket', 'trousers'] },
    sheep: { text: 'Wield the cattleprod and prod each of the four diseased sheep (around the farms north of Ardougne) into the pen, then use the poisoned feed on each one there. When all four are burnt, talk to Councillor Halgrive.', npc: ['plaguesheep_1', 'plaguesheep_2', 'plaguesheep_3', 'plaguesheep_4'], at: [2609, 3344, 0], items: ['jacket', 'trousers', 'prod', 'feed'] },
    burn: { text: 'Put the sheep bones in the furnace by the pen.', loc: 'plaguesheep_furnace', at: [2605, 3360, 0], items: ['bones'] },
    finish: { text: 'Once all four sheep are burnt, return to Councillor Halgrive.', npc: 'councillor_halgrive', at: [2617, 3299, 0] },
  },
  stages: {
    0: [[null, 'start']],
    1: [[null, 'orbon']],
    2: [
      ['have:bones', 'burn'],
      ['!have:prod', 'prod'],
      [null, 'sheep'],
    ],
  },
  sections: [
    { title: 'Starting off', steps: ['start', 'orbon'], items: ['coins'] },
    { title: 'The sheep', steps: ['prod', 'sheep', 'burn', 'finish'] },
  ],
  rewards: ['4 Quest Points', '3,100 coins'],
};
