// Roving Elves. Based on Quest Helper's RovingElves (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (quest_roving: roving_elves, ported from
// 2009scape; quest_waterfall quest_waterfall for Glarial's tombstone) and maps.
module.exports = {
  quest: 'roving_elves',
  members: true,
  difficulty: 'Experienced',
  start: 'Talk to Islwyn, an old elf in the woods of Isafdar.',
  items: {
    pebble: { name: "Glarial's pebble", obj: 'glarials_pebble_waterfall_quest', tip: 'Golrie gives another, in the Tree Gnome Village dungeon' },
    oldSeed: { name: 'Consecration seed', obj: 'roving_old_consecration_seed' },
    newSeed: { name: 'Consecration seed (charged)', obj: 'roving_new_consecration_seed' },
    spade: { name: 'Spade', obj: 'spade' },
  },
  required: ['pebble', 'spade'],
  skills: ['Regicide and Waterfall Quest completed', 'Able to defeat a moss giant (level 84) with no weapons, armour or runes'],
  steps: {
    start: { text: "Talk to Islwyn; tell the truth about his grandmother Glarial's remains and offer to help.", npc: 'roving_islwyn', at: [2291, 3147, 0], options: ['Tell the truth?', 'Maybe I could help.'] },
    eluned: { text: 'Ask Eluned, nearby, how to consecrate the tomb.', npc: 'roving_female_woodelf', at: [2289, 3145, 0] },
    giant: { text: "Leaving weapons, armour and runes behind, use Glarial's pebble on her tombstone and kill the moss giant guarding the tomb for the consecration seed.", npc: 'roving_mossgiant', at: [2541, 9845, 0], items: ['pebble'] },
    charge: { text: 'Give the seed to Eluned to enchant.', npc: 'roving_female_woodelf', at: [2289, 3145, 0], items: ['oldSeed'] },
    plant: { text: "Get into Baxtorian's tomb under the waterfall again (as in the Waterfall Quest) and, next to the chalice, plant the seed with a spade.", at: [2603, 9911, 0], items: ['newSeed', 'spade'] },
    finish: { text: 'Tell Islwyn the tomb is consecrated and choose a crystal bow or shield.', npc: 'roving_islwyn', at: [2291, 3147, 0], options: ['Shields are for wimps! Give me the bow!', "I don't like running and hiding behind mushrooms. Shield please!"] },
  },
  stages: {
    0: [[null, 'start']],
    1: [[null, 'eluned']],
    2: [
      ['have:newSeed', 'plant'],
      ['have:oldSeed', 'charge'],
      [null, 'giant'],
    ],
    3: [[null, 'finish']],
  },
  sections: [
    { title: "Glarial's tomb", steps: ['start', 'eluned', 'giant', 'charge', 'plant', 'finish'], items: ['pebble', 'spade'] },
  ],
  rewards: ['1 Quest Point', '10,000 Strength experience', 'A crystal bow or crystal shield'],
};
