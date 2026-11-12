// Troll Stronghold. Based on Quest Helper's TrollStronghold (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (quest_troll: quest_troll,
// troll_champion; quest_death death_ig_commander, death_smithy; drop tables mountain_troll,
// troll_commander) and maps; the step texts follow our journal.
module.exports = {
  quest: 'troll',
  members: true,
  difficulty: 'Experienced',
  start: 'Talk to Denulth in his tent at the Imperial Guard camp in Burthorpe.',
  items: {
    boots: { name: 'Climbing boots', obj: 'death_climbingboots', worn: true, tip: 'From Tenzing (Death Plateau)' },
    prisonKey: { name: 'Prison key', obj: 'troll_key_prison', tip: 'Dropped by a troll general in the stronghold' },
    key1: { name: 'Cell key 1', obj: 'troll_key_godric', tip: 'Dropped by the prison guard Twig' },
    key2: { name: 'Cell key 2', obj: 'troll_key_eadgar', tip: 'Dropped by the prison guard Berry' },
  },
  required: ['boots'],
  skills: ['15 Agility', 'Death Plateau completed', 'Able to defeat the level 113 Troll Champion'],
  steps: {
    start: { text: 'Ask Denulth how his fight with the trolls goes and offer to get Godric back.', npc: 'death_ig_commander', at: [2896, 3528, 0], options: ['How goes your fight with the trolls?', 'Is there anything I can do to help?', "I'll get Godric back!"] },
    dad: { text: 'Wearing climbing boots, climb the rocks north of Death Plateau to the troll arena, accept the Troll Champion\'s challenge and defeat him.', npc: 'troll_champion', at: [2911, 3612, 0], items: ['boots'], options: ['I accept your challenge!'] },
    stronghold: { text: 'Go through the arena and over the mountain to the Troll Stronghold. Inside, kill a troll general for the prison key and go down to the prison door.', loc: 'troll_stronghold_prison_door_closed', at: [2848, 10107, 1], items: ['boots'] },
    cells: { text: 'In the prison, kill the guards Twig and Berry for the two cell keys and unlock Godric\'s and Mad Eadgar\'s cells.', loc: 'troll_celldoor_godric', at: [2833, 10078, 0], keepAt: true, items: ['key1', 'key2'] },
    finish: { text: 'Tell Dunstan in Burthorpe that his son is safe.', npc: 'death_smithy', at: [2919, 3574, 0] },
  },
  stages: {
    10: [[null, 'dad']],
    20: [[null, 'stronghold']],
    30: [[null, 'cells']],
    40: [[null, 'finish']],
    0: [[null, 'start']],
  },
  sections: [
    { title: 'Starting off', steps: ['start', 'dad'], items: ['boots'] },
    { title: 'The stronghold', steps: ['stronghold', 'cells', 'finish'] },
  ],
  rewards: ['1 Quest Point', 'A law talisman'],
};
