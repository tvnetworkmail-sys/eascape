// Wanted!. Based on Quest Helper's Wanted (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (quest_wanted: wanted_start,
// wanted_leads, wanted_commorb, wanted_hunt) and maps; the step texts follow our journal.
// The scan places after Canifis are drawn at random, so the chase is one step.
module.exports = {
  quest: 'wanted',
  members: true,
  difficulty: 'Intermediate',
  start: 'Talk to Sir Tiffy Cashien in Falador park.',
  items: {
    orbParts: { name: 'Law rune, enchanted gem and molten glass (or 10,000 coins)', obj: ['lawrune', 'slayer_gem', 'molten_glass'], qty: 3, tip: 'For Sir Tiffy to make your CommOrb' },
    commorb: { name: 'CommOrb', obj: 'wanted_crystal_ball', tip: 'Sir Tiffy gives it' },
    essence: { name: 'Rune essence', obj: 'blankrune', qty: 20, tip: 'The Mage of Zamorak wants 20' },
  },
  required: ['orbParts', 'essence'],
  skills: ['32 Quest Points', 'Recruitment Drive, The Lost Tribe and Priest in Peril completed', 'Able to defeat Solus Dellagar'],
  zones: {
    mine: [2880, 4800, 2943, 4863, 0],
  },
  steps: {
    start: { text: 'Talk to Sir Tiffy Cashien in Falador park.', npc: 'rd_teleporter_guy', at: [2997, 3373, 0], options: ['Yes.'] },
    amik: { text: 'Tell Sir Amik Varze, at the top of the White Knights\' castle, that you want to be a White Knight; turn down being his squire and ask to be deputised.', npc: 'sir_amik_varze', at: [2960, 3336, 2], options: ['No, not right now...'] },
    tiffy: { text: 'Tell Sir Tiffy that Sir Amik can only deputise you in a crisis.', npc: 'rd_teleporter_guy', at: [2997, 3373, 0] },
    amik2: { text: 'Report to Sir Amik Varze for orders.', npc: 'sir_amik_varze', at: [2960, 3336, 2], options: ["Sure, I'll help you!"] },
    tiffy2: { text: 'Ask Sir Tiffy for advice on finding Solus; he makes you a CommOrb from a law rune, an enchanted gem and molten glass (or sells one for 10,000 coins).', npc: 'rd_teleporter_guy', at: [2997, 3373, 0], items: ['orbParts'] },
    savant: { text: 'Use the CommOrb to contact Savant.', at: [2997, 3373, 0], items: ['commorb'] },
    leads: { text: 'Question Lord Daquarius in Taverley Dungeon and the Mage of Zamorak in Varrock (he wants 20 rune essence) about Solus Dellagar.', npc: 'lord_daquarius', at: [2892, 9680, 0], items: ['essence', 'commorb'], options: ['Solus Dellagar.'] },
    mage: { text: 'Ask the Mage of Zamorak in Varrock about Solus Dellagar.', npc: 'rcu_zammy_mage1_edge', at: [3260, 3383, 0], items: ['essence'], options: ['Solus Dellagar.'] },
    hunt: { text: 'Scan for Solus in Canifis with the CommOrb. Each time he teleports away, follow the clue item Savant pulls from his teleport to the next place and scan again, until he is trapped in the rune essence mine.', at: [3510, 3479, 0], items: ['commorb'] },
    aubury: { text: 'Ask Aubury in his rune shop in Varrock to teleport you to the rune essence mine.', npc: 'aubury', at: [3253, 3402, 0] },
    fight: { text: 'Defeat Solus Dellagar in the rune essence mine.', npc: 'wanted_solus', at: [2912, 4833, 0], spawned: true },
    finish: { text: 'Take Solus\'s hat to Sir Amik Varze.', npc: 'sir_amik_varze', at: [2960, 3336, 2] },
  },
  stages: {
    0: [[null, 'start']],
    1: [[null, 'amik']],
    2: [[null, 'tiffy']],
    3: [[null, 'amik2']],
    4: [[null, 'tiffy2']],
    5: [[null, 'savant']],
    6: [[null, 'leads']],
    7: [[null, 'hunt']],
    8: [
      ['in:mine', 'fight'],
      [null, 'aubury'],
    ],
    9: [[null, 'finish']],
  },
  sections: [
    { title: 'Starting off', steps: ['start', 'amik', 'tiffy', 'amik2', 'tiffy2', 'savant'], items: ['orbParts'] },
    { title: 'Solus Dellagar', steps: ['leads', 'mage', 'hunt', 'aubury', 'fight', 'finish'], items: ['essence'] },
  ],
  rewards: ['1 Quest Point', '5,000 Slayer experience'],
};
