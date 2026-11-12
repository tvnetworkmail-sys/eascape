// Murder Mystery. Based on Quest Helper's MurderMystery (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (quest_murder, poison_salesman.rs2)
// and maps. The murderer is picked at random when the quest starts and isn't shown to the
// game, so the guide goes by the evidence you hold: the thread from the window, the killer's
// print (an unknown print that matched one of the family's prints) and the poison clue.
module.exports = {
  quest: 'murder',
  members: true,
  difficulty: 'Novice',
  start: 'Talk to a guard at the Sinclair Mansion north of Seers\' Village.',
  items: {
    pot: { name: 'Pot', obj: 'pot_empty', tip: 'Sold by the Lumbridge general store' },
    flour: { name: 'Pot of flour', obj: 'pot_flour', tip: 'Use a pot on the flour barrel in the mansion kitchen' },
    flypaper: { name: 'Flypaper', obj: 'murderpaper', tip: 'In the sacks in the mansion' },
    dagger: { name: "Criminal's dagger", obj: ['murderweapon', 'murderweapondust'], tip: 'Lying in the room with the broken window' },
    thread: { name: "Criminal's thread", obj: ['murderthreadr', 'murderthreadg', 'murderthreadb'], tip: 'Caught on the broken window' },
    unknown: { name: 'Unknown print', obj: 'murderfingerprint1' },
    killer: { name: "Killer's print", obj: 'murderfingerprint' },
    pungent: { name: 'Pungent pot', obj: 'murderpot2', tip: 'Lying in the room with the broken window' },
  },
  required: ['pot'],
  flags: {
    salesman: { on: ['Anna, Bob, Carol, David, Elizabeth and Frank all bought a bottle!'] },
    poison: { on: ["It's certainly clear nobody's used poison here.", "These bees definitely don't seem poisoned at all.", "It's certainly clear nobody's cleaned it recently."] },
  },
  steps: {
    start: { text: "Talk to a guard at the Sinclair Mansion north of Seers' Village.", npc: 'murderguard', at: [2741, 3562, 0], options: ["Sure, I'll help."] },
    thread: { text: 'Search the broken window in the room at the east of the mansion for the thread.', loc: 'loc_2666', at: [2748, 3577, 0] },
    dagger: { text: "Pick up the criminal's dagger and the pungent pot in the same room.", obj: 'murderweapon', at: [2746, 3578, 0] },
    flour: { text: 'Use a pot on the flour barrel in the kitchen, and take some flypaper from the sacks next to it.', loc: 'flourbarrel', at: [2735, 3582, 0], items: ['pot'] },
    printDagger: { text: 'Use the pot of flour on the dagger, then the flypaper on the dusted dagger to lift an unknown print.', at: [2735, 3582, 0], items: ['flour', 'flypaper', 'dagger'] },
    silver: { text: "Search the barrels around the mansion for the family's silver items (two on the ground floor, four upstairs). Dust each with flour, lift its print with flypaper, and use it on the unknown print until one matches.", loc: 'murderbarrela', at: [2733, 3575, 0], items: ['unknown', 'pot', 'flypaper'] },
    salesman: { text: "Ask the poison salesman in Seers' Village who he sold poison to.", npc: 'poison_salesman', at: [2695, 3495, 0], options: ['Who did you sell Poison to at the house?'] },
    poison: { text: "Ask the family member whose print matched \"Why'd you buy poison the other day?\", then search the place they say they used it on (the compost heap, beehive, kitchen drain, spiders' nest, fountain or family crest).", npc: ['anna_sinclair', 'bob_sinclair', 'carol_sinclair', 'david_sinclair', 'elizabeth_sinclair', 'frank_sinclair'], at: [2739, 3581, 0], range: 30, keepAt: true, options: ["Why'd you buy poison the other day?"] },
    finish: { text: 'Tell a guard you know who did it.', npc: 'murderguard', at: [2741, 3562, 0], items: ['thread', 'killer'], options: ['I know who did it!'] },
  },
  stages: {
    0: [[null, 'start']],
    1: [
      ['have:thread & have:killer & seen:poison', 'finish'],
      ['!have:thread', 'thread'],
      ['!have:killer & !have:unknown & !have:dagger', 'dagger'],
      ['!have:killer & !have:unknown & !have:flour', 'flour'],
      ['!have:killer & !have:unknown', 'printDagger'],
      ['!have:killer', 'silver'],
      ['!seen:salesman', 'salesman'],
      ['!seen:poison', 'poison'],
      [null, 'finish'],
    ],
  },
  sections: [
    { title: 'Starting off', steps: ['start'] },
    { title: 'Evidence', steps: ['thread', 'dagger', 'flour', 'printDagger', 'silver'], items: ['pot'] },
    { title: 'The poison', steps: ['salesman', 'poison'] },
    { title: 'Solving it', steps: ['finish'] },
  ],
  rewards: ['3 Quest Points', '1,406 Crafting experience', '2,000 coins'],
};
