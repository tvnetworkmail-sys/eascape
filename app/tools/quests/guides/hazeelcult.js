// Hazeel Cult. Based on Quest Helper's HazeelCult (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (quest_hazeelcult: ceril_carnillean,
// clivet, alomone, claus_the_chef, the valves and the raft) and maps. The valve settings come
// from the valve scripts: each valve's correct way sets its bit, and the raft goes as far as
// the valves are right in order.
module.exports = {
  quest: 'hazeelcult',
  members: true,
  difficulty: 'Novice',
  start: 'Talk to Sir Ceril Carnillean in his house west of the Ardougne Zoo.',
  items: {
    poison: { name: 'Poison', obj: 'poison', tip: 'Clivet gives it (cult side)' },
    mark: { name: 'Mark of Hazeel', obj: 'mark_of_hazeel', tip: 'Clivet gives it (cult side)' },
    chestkey: { name: 'Key (chest)', obj: 'carnilleanchestkey', tip: 'In a crate in the Carnilleans\' basement' },
    scroll: { name: 'Hazeel scroll', obj: 'hazeel_scroll' },
    armour: { name: 'Carnillean armour', obj: 'carnillean_armour', tip: 'Alomone drops it (Carnillean side)' },
  },
  skills: ['Carnillean side: able to defeat Alomone (level 13)'],
  zones: {
    sewerEnd: [2596, 9660, 2620, 9700, 0],
    cave: [2555, 9660, 2620, 9730, 0],
    mansionTop: [2563, 3264, 2576, 3275, 2],
  },
  flags: {
    evil: { on: ['Ok, count me in.'] },
    good: { on: ['The man jumps onto the raft and pushes off down into the sewer system.'] },
  },
  steps: {
    start: { text: 'Talk to Sir Ceril Carnillean in his house west of the Ardougne Zoo.', npc: 'sir_ceril_carnillean', at: [2565, 3271, 0], options: ["What's wrong?", "Yes, of course, I'd be happy to help."] },
    cave: { text: 'Go into the cave south of the mansion and talk to Clivet. To side with the Carnilleans say "I\'ve heard enough of your rubbish."; to join the cult, choose "What do you mean?", "So what would I have to do?" and "Ok, count me in."', npc: 'clivet_hazeel_cultist', at: [2566, 9683, 0] },
    valves: { text: 'Leave the cave and set the five sewer valves around the mansion: the first (west) right, the second right, the third left, the fourth right and the fifth (east) right.', loc: ['sewervalve1', 'sewervalve2', 'sewervalve3', 'sewervalve4', 'sewervalve5'], at: [2585, 3245, 0] },
    raft: { text: 'Go back into the cave and board the raft by Clivet; it takes you to the end of the sewer.', loc: 'hazeelsewerraft', at: [2567, 9679, 0] },
    alomone: { text: 'Kill Alomone at the end of the sewer and pick up the Carnillean armour.', npc: 'alomone_hazeel_cultist', at: [2609, 9670, 0] },
    armour: { text: 'Bring the armour to Sir Ceril.', npc: 'sir_ceril_carnillean', at: [2565, 3271, 0], items: ['armour'] },
    cupboard: { text: 'Search the cupboard upstairs in the mansion with Ceril and Jones nearby.', loc: 'hazeelcbshut', at: [2573, 3267, 1] },
    poison: { text: 'Use the poison on the range in the Carnilleans\' kitchen.', loc: 'carnilleanrange', at: [2564, 9672, 0], items: ['poison'] },
    mark: { text: 'Talk to Clivet in the cave again for the Mark of Hazeel.', npc: 'clivet_hazeel_cultist', at: [2566, 9683, 0] },
    alomoneEvil: { text: 'Talk to Alomone at the end of the sewer.', npc: 'alomone_hazeel_cultist', at: [2609, 9670, 0] },
    crate: { text: 'Search the crate in the Carnilleans\' kitchen for a key.', loc: 'carnilleancrate', at: [2571, 9669, 0] },
    chest: { text: 'Search the wall on the first floor of the mansion for a secret passage, climb up and use the key on the chest for the scroll.', loc: 'carnilleanshutchest', at: [2571, 3269, 2], items: ['chestkey'] },
    scroll: { text: 'Bring the scroll to Alomone.', npc: 'alomone_hazeel_cultist', at: [2609, 9670, 0], items: ['scroll'] },
  },
  stages: {
    0: [[null, 'start']],
    '2-3': [[null, 'cave']],
    4: [
      ['seen:evil | have:poison', 'poison'],
      ['in:sewerEnd', 'alomone'],
      ['in:cave', 'raft'],
      [null, 'valves'],
    ],
    5: [
      ['!have:mark', 'mark'],
      ['in:sewerEnd', 'alomoneEvil'],
      ['in:cave', 'raft'],
      [null, 'valves'],
    ],
    6: [
      ['have:armour', 'armour'],
      ['have:chestkey', 'chest'],
      ['seen:evil | have:mark', 'crate'],
      ['in:sewerEnd', 'alomone'],
      ['in:cave', 'raft'],
      [null, 'valves'],
    ],
    7: [
      ['have:scroll', 'scroll'],
      ['seen:evil', 'scroll'],
      [null, 'cupboard'],
    ],
  },
  sections: [
    { title: 'Starting off', steps: ['start', 'cave'] },
    { title: 'The sewer', steps: ['valves', 'raft'] },
    { title: 'Carnillean side', steps: ['alomone', 'armour', 'cupboard'] },
    { title: 'Cult side', steps: ['poison', 'mark', 'alomoneEvil', 'crate', 'chest', 'scroll'] },
  ],
  rewards: ['1 Quest Point', '1,500 Thieving experience', '2,000 coins'],
};
