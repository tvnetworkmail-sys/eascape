// Recruitment Drive. Based on Quest Helper's RecruitmentDrive (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (quest_rd: rd_start, rd_rooms,
// rd_cheevers) and maps. The five test rooms are picked at random, so they share one step.
module.exports = {
  quest: 'rd',
  difficulty: 'Novice',
  members: true,
  start: 'Talk to Sir Amik Varze at the top of Falador castle.',
  skills: ["Black Knights' Fortress and Druidic Ritual completed", 'Bring no items or equipment to the tests'],
  steps: {
    start: { text: 'Talk to Sir Amik Varze at the top of Falador castle and ask for a quest.', npc: 'sir_amik_varze', at: [2960, 3336, 2], options: ['Do you have any other quests for me to do?', 'Yes please.'] },
    tiffy: { text: 'Bank everything, including what you wear, then talk to Sir Tiffy Cashien in Falador Park; he takes you to the testing grounds.', npc: 'rd_teleporter_guy', at: [2997, 3373, 0], options: ['Yes, let\'s go!'] },
    tests: { text: 'Pass five of the seven test rooms, one after another: each is a puzzle with a knight or lady watching (talk to them for the rules). Quitting a room clears your progress. After the fifth, talk to Sir Tiffy.', npc: 'rd_teleporter_guy', at: [2997, 3373, 0] },
  },
  stages: {
    0: [[null, 'start']],
    1: [[null, 'tiffy']],
  },
  sections: [
    { title: 'Joining up', steps: ['start', 'tiffy', 'tests'] },
  ],
  rewards: ['1 Quest Point', '1,000 Prayer, Herblore and Agility experience', 'Gaze of Saradomin', "Temple Knight's initiate helm"],
};
