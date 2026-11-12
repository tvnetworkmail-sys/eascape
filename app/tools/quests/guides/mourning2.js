// Mourning's End Part II. Based on Quest Helper's MourningsEndPartII (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (quest_mourning2: me2_npcs, me2_temple,
// me2_light, me2_thorgel, me2_journal; quest_mourning1 me1_hq and me1_lletya for the Head Mourner
// and Arianwyn; skill_runecraft runecraft_altars for the Death altar) and maps. The light maze is
// not solved here step by step: the step says what the doors need.
const temple = 'in:temple0 | in:temple1 | in:temple2 | in:basement';
const inTemple = (cond, step) => ['temple0', 'temple1', 'temple2', 'basement'].map((z) => [`in:${z} & ${cond}`, step]);
module.exports = {
  quest: 'mourning2',
  members: true,
  difficulty: 'Grandmaster',
  start: 'Talk to the Head Mourner in the basement of the Mourner headquarters in West Ardougne, in the mourner outfit.',
  items: {
    gasmask: { name: 'Gas mask', obj: 'gasmask', worn: true },
    top: { name: 'Mourner top', obj: 'mourning_mourner_top', worn: true },
    legs: { name: 'Mourner trousers', obj: 'mourning_mourner_legs', worn: true },
    cloak: { name: 'Mourner cloak', obj: 'mourning_mourner_cloak', worn: true },
    gloves: { name: 'Mourner gloves', obj: 'mourning_mourner_gloves', worn: true },
    boots: { name: 'Mourner boots', obj: 'mourning_mourner_boots', worn: true },
    newKey: { name: 'New key', obj: 'mourning_excavation_key', tip: "The Head Mourner's desk has copies" },
    chisel: { name: 'Chisel', obj: 'chisel' },
    sample: { name: 'Blackened crystal', obj: 'mourning_crystal_sample' },
    newCrystal: { name: 'Newly made crystal', obj: 'mourning_crystal_new_sample', tip: 'Arianwyn has Eluned make another' },
    powered: { name: 'Newly made crystal (powered)', obj: 'mourning_crystal_new_powered' },
    talisman: { name: 'Death talisman', obj: 'death_talisman', tip: 'Thorgel gives one for the things on his list' },
    wheel: { name: 'Colour wheel', obj: 'mourning_colour_wheel' },
    journal: { name: "Edern's journal", obj: 'mourning_ederns_journal' },
  },
  required: ['chisel'],
  skills: ["Mourning's End Part I completed (and Arianwyn told what the Head Mourner said)", '60 Agility', 'Able to fight the shadows in the temple'],
  zones: {
    basement: [2016, 4608, 2063, 4671, 0],
    temple0: [1792, 4544, 1983, 4735, 0],
    temple1: [1792, 4544, 1983, 4735, 1],
    temple2: [1792, 4544, 1983, 4735, 2],
  },
  flags: {
    thorgelMet: { on: ['Funny, I was just going to ask you the same thing.'] },
  },
  steps: {
    hq: { text: 'Put on the mourner outfit and go down the trapdoor in the Mourner headquarters in West Ardougne.', loc: 'mourning_hideout_trap_door', at: [2542, 3327, 0], items: ['gasmask', 'top', 'legs', 'cloak', 'gloves', 'boots'] },
    start: { text: 'Wearing the mourner outfit, talk to the Head Mourner; he gives you a newly cut key to the excavation.', npc: 'mourner_hideout_head_mourner', at: [2044, 4628, 0], items: ['gasmask', 'top', 'legs', 'cloak', 'gloves', 'boots'] },
    digteam: { text: 'Unlock the door with the new key and follow the excavation west to the temple, where the dig team lies dead; search the dead mourner for a colour wheel and a journal.', loc: 'mourning_dead_guard1', at: [1925, 4642, 0], items: ['newKey'] },
    up: { text: 'Go back up the ladder out of the Mourner basement.', loc: 'mourner_hideout_ladder1', at: [2044, 4650, 0] },
    arianwyn: { text: 'Tell Arianwyn in Lletya about the temple.', npc: 'mourning_arianwyn', at: [2352, 3172, 0] },
    down: { text: 'Go back down the trapdoor in the Mourner headquarters to the temple.', loc: 'mourning_hideout_trap_door', at: [2542, 3327, 0] },
    sample: { text: "Get to the top floor of the temple and chip a blackened shard off the great crystal with a chisel.", loc: 'mourning_temple_obsidian_crystal', at: [1908, 4638, 2], items: ['chisel'] },
    showSample: { text: 'Show Arianwyn the blackened crystal; Eluned comes.', npc: 'mourning_arianwyn', at: [2352, 3172, 0], items: ['sample'] },
    eluned: { text: 'Give Eluned the blackened crystal.', npc: 'roving_female_woodelf_temp', at: [2352, 3171, 0], items: ['sample'] },
    eluned2: { text: 'Talk to Eluned for the newly made crystal.', npc: 'roving_female_woodelf_temp', at: [2352, 3171, 0] },
    arianwyn2: { text: 'Ask Arianwyn what to do with the new crystal.', npc: 'mourning_arianwyn', at: [2352, 3172, 0], items: ['newCrystal'] },
    maze: { text: "In the temple, bounce the light beam with the mirrors and coloured crystals from the chests into the pillars to open the light doors: a door opens to light of its opposite colour on the colour wheel (yellow doors blue light, cyan doors red, magenta doors green, the blue door yellow, the black door white). Go through the black door on the ground floor; Thorgel the dwarf meets you there.", loc: 'mourning_door_1_c', at: [1865, 4639, 0], items: ['wheel'] },
    thorgel: { text: 'Agree to fetch the things on Thorgel\'s list; he gives you a death talisman for them.', npc: 'mourning_deathalter_dwarf', at: [1860, 4641, 0], options: ['Okay, sure thing. What do you need?', "I've got some of them with me.", 'Yeah, sure.'] },
    altar: { text: 'With the death talisman, enter the ruins next to Thorgel and put the new crystal on the Death altar to power it.', loc: 'death_altar', at: [2204, 4835, 0], items: ['talisman', 'newCrystal'] },
    place: { text: 'Back on the top floor of the temple, put the powered crystal among the blackened shards of the great crystal.', loc: 'mourning_temple_obsidian_crystal', at: [1908, 4638, 2], items: ['powered'] },
    finish: { text: 'Tell Arianwyn the safeguards are restored.', npc: 'mourning_arianwyn', at: [2352, 3172, 0] },
  },
  stages: {
    0: [
      ['in:basement', 'start'],
      [null, 'hq'],
    ],
    10: [[null, 'digteam']],
    20: [
      [temple, 'up'],
      [null, 'arianwyn'],
    ],
    30: [
      ['have:sample & in:temple0', 'up'],
      ['have:sample & in:temple1', 'up'],
      ['have:sample & in:temple2', 'up'],
      ['have:sample & in:basement', 'up'],
      ['have:sample', 'showSample'],
      [temple, 'sample'],
      [null, 'down'],
    ],
    40: [[null, 'eluned']],
    45: [[null, 'eluned2']],
    50: [[null, 'arianwyn2']],
    60: [
      ['have:talisman', 'altar'],
      ...inTemple('seen:thorgelMet', 'thorgel'),
      [temple, 'maze'],
      ['seen:thorgelMet', 'down'],
      [null, 'down'],
    ],
    70: [[null, 'place']],
    80: [
      [temple, 'up'],
      [null, 'finish'],
    ],
  },
  sections: [
    { title: 'The temple', steps: ['hq', 'start', 'digteam', 'up', 'arianwyn', 'down', 'sample', 'showSample'], items: ['chisel'] },
    { title: 'A new crystal', steps: ['eluned', 'eluned2', 'arianwyn2', 'maze', 'thorgel', 'altar', 'place', 'finish'] },
  ],
  rewards: ['2 Quest Points', '20,000 Agility experience', 'Access to the Death altar', 'A crystal trinket'],
};
