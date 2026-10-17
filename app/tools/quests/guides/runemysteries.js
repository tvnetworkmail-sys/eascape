// Rune Mysteries. Based on Quest Helper's RuneMysteries (BSD 2-Clause, (c) 2020 Zoinkwiz),
// with the 2004 stages from Lost City (talisman, package, notes).
module.exports = {
  quest: 'runemysteries',
  difficulty: 'Novice',
  start: 'Talk to Duke Horacio on the first floor of Lumbridge Castle.',
  items: {
    talisman: { name: 'Air talisman', obj: 'air_talisman', tip: 'Duke Horacio gives you another if you lose it' },
    package: { name: 'Research package', obj: 'research_package', tip: 'Sedridor gives you another if you lose it' },
    notes: { name: 'Research notes', obj: 'research_notes', tip: 'Aubury gives you another if you lose them' },
  },
  zones: {
    lumbridgeFirst: [3203, 3206, 3218, 3231, 1],
    basement: [3094, 9553, 3125, 9582, 0],
  },
  steps: {
    goUp: { text: 'Climb the staircase in Lumbridge Castle to the first floor.', loc: 'spiralstairs', at: [3204, 3207, 0] },
    duke: { text: 'Talk to Duke Horacio on the first floor of Lumbridge Castle.', npc: 'duke_of_lumbridge', at: [3212, 3220, 1], options: ['Have you any quests for me?', 'Sure, no problem.'] },
    goDown: { text: 'Climb down the staircase.', loc: 'spiralstairsmiddle', at: [3204, 3207, 1], options: ['Climb down the stairs.'] },
    tower: { text: "Climb down the ladder into the Wizards' Tower basement, south of Draynor.", loc: 'wizards_tower_laddertop', at: [3104, 3162, 0] },
    giveTalisman: { text: 'Give the air talisman to Sedridor, the head wizard, in the basement.', npc: 'head_wizard', at: [3103, 9571, 0], items: ['talisman'], options: ["I'm looking for the head wizard.", 'Ok, here you are.'] },
    getPackage: { text: 'Talk to Sedridor again and agree to take his research package to Aubury.', npc: 'head_wizard', at: [3103, 9571, 0], options: ['Yes, certainly.'] },
    aubury: { text: "Bring the research package to Aubury in his rune shop in south-east Varrock.", npc: 'aubury', at: [3253, 3402, 0], items: ['package'] },
    auburyAgain: { text: 'Talk to Aubury again for his research notes.', npc: 'aubury', at: [3253, 3402, 0] },
    giveNotes: { text: 'Bring the research notes to Sedridor in the Wizards\' Tower basement.', npc: 'head_wizard', at: [3103, 9571, 0], items: ['notes'] },
  },
  stages: {
    0: [['in:lumbridgeFirst', 'duke'], [null, 'goUp']],
    1: [['in:basement', 'giveTalisman'], ['in:lumbridgeFirst', 'goDown'], [null, 'tower']],
    2: [['in:basement', 'getPackage'], [null, 'tower']],
    3: [['!have:package & in:basement', 'getPackage'], ['!have:package', 'tower'], [null, 'aubury']],
    4: [[null, 'auburyAgain']],
    5: [['!have:notes', 'auburyAgain'], ['in:basement', 'giveNotes'], [null, 'tower']],
  },
  sections: [
    { title: 'Starting off', steps: ['goUp', 'duke', 'goDown'] },
    { title: 'The head wizard', steps: ['tower', 'giveTalisman', 'getPackage'] },
    { title: 'Aubury', steps: ['aubury', 'auburyAgain'] },
    { title: 'Finishing up', steps: ['giveNotes'], items: ['notes'] },
  ],
  rewards: ['1 Quest Point', 'Air talisman', 'Access to the Rune Essence mine'],
};
