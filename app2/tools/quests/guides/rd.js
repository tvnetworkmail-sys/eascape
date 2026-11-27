// Recruitment Drive. 2007RS: written from our scripts (quest_rd: rd_start, rd_rooms, rd_cheevers
// and rd.constant) and maps. The stage is %rd_main (0, 1 started, 2 done); the run's own state
// isn't one number, so inside the training grounds the step goes by the room you stand in.
module.exports = {
  quest: 'rd',
  name: 'Recruitment Drive',
  varp: 'rd_main',
  complete: '^rcd_complete',
  members: true,
  difficulty: 'Novice',
  start: 'Talk to Sir Amik Varze on the top floor of the White Knights\' Castle in Falador.',
  items: {},
  required: [],
  skills: ["Black Knights' Fortress and Druidic Ritual completed", 'Sir Leye can only be beaten by a woman (Makeover Mage, or the room\'s own way round it)'],
  zones: {
    grounds: [2432, 4928, 2495, 4991, 0],
    spishyus: [2478, 4962, 2495, 4984, 0],
    table: [2450, 4972, 2470, 4988, 0],
    kuam: [2445, 4958, 2463, 4971, 0],
    tinley: [2464, 4950, 2478, 4962, 0],
    ren: [2432, 4950, 2446, 4962, 0],
    cheevers: [2458, 4932, 2478, 4949, 0],
    hynn: [2443, 4928, 2457, 4942, 0],
  },
  steps: {
    start: { text: "Talk to Sir Amik Varze on the top floor of the White Knights' Castle and agree to join the recruitment drive.", npc: 'sir_amik_varze', at: [2960, 3336, 2], options: ['Yes please.'] },
    tiffy: { text: 'Bank everything you carry and wear, then talk to Sir Tiffy Cashien in Falador Park and go to the training grounds (or, with five rooms passed, to finish).', npc: 'rd_teleporter_guy', at: [2997, 3373, 0], options: ["Yes, let's go!"] },
    spishyus: { text: "Sir Spishyus: get the fox, the chicken and the grain across the bridge one at a time, never leaving the fox with the chicken or the chicken with the grain.", at: [2490, 4972, 0] },
    table: { text: 'Lady Table: look at the statues, then find the one that has gone missing when they come back and put it in its place.', at: [2460, 4979, 0] },
    kuam: { text: 'Sir Kuam Ferentse: defeat Sir Leye (only a woman can).', at: [2455, 4964, 0] },
    tinley: { text: "Sir Tinley: do nothing at all until he speaks again; patience is the test.", at: [2471, 4956, 0] },
    ren: { text: "Sir Ren Itchood: ask him for clues and work out the four-letter password, then set it on the door's lock.", at: [2439, 4956, 0] },
    cheevers: { text: 'Miss Cheevers: use the shelves, crates and chemicals to open the stone door (vials on the spade in the door) and then the wooden door.', at: [2467, 4940, 0] },
    hynn: { text: 'Ms. Hynn Terprett: answer her riddle.', npc: 'rd_observer_room_7', at: [2451, 4939, 0] },
  },
  stages: {
    0: [[null, 'start']],
    1: [
      ['in:spishyus', 'spishyus'],
      ['in:table', 'table'],
      ['in:kuam', 'kuam'],
      ['in:tinley', 'tinley'],
      ['in:ren', 'ren'],
      ['in:cheevers', 'cheevers'],
      ['in:hynn', 'hynn'],
      [null, 'tiffy'],
    ],
  },
  sections: [
    { title: 'Joining up', steps: ['start', 'tiffy'] },
    { title: 'The training grounds (five of the seven rooms)', steps: ['spishyus', 'table', 'kuam', 'tinley', 'ren', 'cheevers', 'hynn'] },
  ],
  rewards: ['1 Quest Point', '1,000 Prayer, Herblore and Agility experience', 'Gaze of Saradomin (respawn in Falador, from Sir Tiffy)', "Temple Knight's Initiate helm"],
};
