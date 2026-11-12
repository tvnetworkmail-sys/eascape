// Tree Gnome Village. Based on Quest Helper's TreeGnomeVillage (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and coordinates from our scripts (king_bolren, commander_montai,
// tracker_gnome, quest_tree, khazard_warlord, elkoy) and maps. Our ballista takes the
// coordinates as fixed choices: height 4, x 3, y 5 (quest_tree.rs2).
module.exports = {
  quest: 'tree',
  members: true,
  difficulty: 'Intermediate',
  start: 'Talk to King Bolren in the middle of the Tree Gnome Village maze.',
  items: {
    logs: { name: 'Logs', obj: 'logs', qty: 6, tip: 'Chop normal trees' },
    orb: { name: 'Orb of protection', obj: 'orb_of_protection' },
    orbs: { name: 'Orbs of protection', obj: 'orbs_of_protection' },
  },
  required: ['logs'],
  skills: ['Able to defeat a level 112 Khazard warlord (he can be safespotted)'],
  zones: {
    strongholdTop: [2496, 3250, 2516, 3266, 1],
  },
  steps: {
    start: { text: 'Talk to King Bolren in the middle of the maze. Elkoy at the maze entrance can show you through.', npc: 'king_bolren', at: [2542, 3169, 0], options: ['Can I help at all?', 'I would be glad to help.'] },
    montai: { text: 'Talk to Commander Montai at the battlefield north of the maze.', npc: 'commander_montai', at: [2523, 3211, 0], options: ["Ok, I'll gather some wood."] },
    logs: { text: 'Bring Commander Montai six logs.', npc: 'commander_montai', at: [2523, 3211, 0], items: ['logs'] },
    montai2: { text: 'Talk to Commander Montai again.', npc: 'commander_montai', at: [2523, 3211, 0], options: ["I'll try my best."] },
    tracker1: { text: 'Talk to the tracker gnome by the stronghold for the height coordinate (4).', npc: 'tracker1', at: [2502, 3261, 0] },
    tracker2: { text: 'Talk to the captured tracker gnome through the bars of his cell for the y coordinate (5).', npc: 'tracker2', at: [2524, 3254, 0], keepAt: true },
    tracker3: { text: 'The third tracker gnome answers in riddles; the x coordinate is 3.', npc: 'tracker3', at: [2496, 3235, 0] },
    ballista: { text: 'Fire the ballista: height 0004, x 0003, y 0005.', loc: 'catabow', at: [2508, 3210, 0], options: ['0004', '0003', '0005'] },
    wall: { text: 'Climb over the crumbled wall of the Khazard stronghold. The Khazard commander attacks.', loc: 'khazzacklowwall', at: [2509, 3253, 0] },
    chest: { text: 'Go upstairs and search the open chest for the orb of protection.', loc: 'chestclosed_khazard', at: [2506, 3259, 1] },
    bolren: { text: 'Bring the orb to King Bolren.', npc: 'king_bolren', at: [2542, 3169, 0], items: ['orb'], options: ['I will find the warlord and bring back the orbs.'] },
    warlord: { text: 'Kill the Khazard warlord north-west of the battlefield; you take the orbs from his satchel.', npc: 'khazard_warlord', at: [2457, 3302, 0] },
    finish: { text: 'Bring the orbs to King Bolren.', npc: 'king_bolren', at: [2542, 3169, 0], items: ['orbs'] },
  },
  stages: {
    0: [[null, 'start']],
    1: [[null, 'montai']],
    2: [[null, 'logs']],
    3: [[null, 'montai2']],
    4: [[null, 'ballista']],
    5: [
      ['in:strongholdTop', 'chest'],
      [null, 'wall'],
    ],
    6: [
      ['!have:orb & in:strongholdTop', 'chest'],
      ['!have:orb', 'wall'],
      [null, 'bolren'],
    ],
    7: [[null, 'warlord']],
    8: [
      ['!have:orbs', 'warlord'],
      [null, 'finish'],
    ],
  },
  sections: [
    { title: 'Starting off', steps: ['start', 'montai', 'logs', 'montai2'], items: ['logs'] },
    { title: 'The coordinates', steps: ['tracker1', 'tracker2', 'tracker3', 'ballista'] },
    { title: 'The orb', steps: ['wall', 'chest', 'bolren'] },
    { title: 'The other orbs', steps: ['warlord', 'finish'] },
  ],
  rewards: ['2 Quest Points', '11,450 Attack experience', 'Use of the spirit trees', 'A gnome amulet'],
};
