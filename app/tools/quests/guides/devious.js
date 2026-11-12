// Devious Minds. Based on Quest Helper's DeviousMinds (BSD 2-Clause, (c) 2020 Zoinkwiz).
// Quest not in game yet (released after this era); the guide is ready for it.
// EASCape: steps, options and positions from our scripts (quest_devious: devious_monk,
// devious_entrana, devious_journal and devious.constant; quest_rd rd_start for Sir Tiffy) and
// maps. The stages are the values of devious_main (bits 0-7 of varp devious_base).
module.exports = {
  quest: 'devious',
  members: true,
  difficulty: 'Experienced',
  start: 'Talk to the hooded monk outside Paterdomus, by the River Salve.',
  items: {
    twoh: { name: 'Mithril 2h sword', obj: 'mithril_2h_sword' },
    blade: { name: 'Slender blade', obj: 'devious_slenderblade' },
    bowstring: { name: 'Bow string', obj: 'bow_string' },
    bowsword: { name: 'Bow-sword', obj: 'devious_bowsword' },
    orb: { name: 'Glowing orb', obj: 'devious_glowingorb', tip: 'The monk gives another if you lose it' },
    pouch: { name: 'Large pouch', obj: 'rcu_pouch_large' },
    glowingPouch: { name: 'Pouch with the orb', obj: 'devious_glowingpouch' },
  },
  required: ['twoh', 'bowstring', 'pouch'],
  skills: ['65 Smithing', '50 Fletching', '50 Runecrafting', "Doric's Quest and Troll Stronghold completed", 'Access to the Abyss'],
  zones: {
    entrana: [2800, 3320, 2880, 3400, 0],
  },
  steps: {
    start: { text: 'Talk to the hooded monk outside Paterdomus and offer to help.', npc: 'devious_monk_hooded', at: [3406, 3492, 0], options: ['Sure thing, what do you need?'] },
    grind: { text: "Grind a mithril 2h sword on Doric's whetstone in his hut north of Falador.", loc: 'devious_whetstone', at: [2953, 3451, 0], items: ['twoh'] },
    string: { text: 'String the slender blade with a bow string.', at: [2953, 3451, 0], items: ['blade', 'bowstring'] },
    give: { text: 'Give the bow-sword to the hooded monk; he gives you an orb for Entrana.', npc: 'devious_monk_hooded', at: [3406, 3492, 0], items: ['bowsword'], options: ['Yep, got it right here for you.'] },
    abyss: { text: "Hide the orb in a large pouch. The Entrana monks won't let you sail with it, so have the Mage of Zamorak in the Wilderness send you into the Abyss, go through the Law rift and take the altar's exit portal to Entrana.", npc: 'rcu_zammy_mage1', at: [3106, 3558, 0], items: ['pouch', 'orb'], options: ['Yes'], note: "The orb only passes the Law altar's portal hidden in the pouch." },
    altar: { text: 'Use the pouch with the orb on the altar of the church on Entrana.', loc: 'devious_altar', at: [2853, 3348, 0], items: ['glowingPouch'] },
    body: { text: 'Go back to Paterdomus and search the dead monk.', npc: 'devious_monk_dead', at: [3405, 3492, 0] },
    priest: { text: 'Tell the High Priest of Entrana about the dead monk.', npc: 'high_priest_of_entrana', at: [2851, 3349, 0] },
    tiffy: { text: 'Report to Sir Tiffy Cashien in Falador Park.', npc: 'rd_teleporter_guy', at: [2997, 3373, 0] },
  },
  stages: {
    0: [[null, 'start']],
    10: [
      ['have:bowsword', 'give'],
      ['have:blade', 'string'],
      [null, 'grind'],
    ],
    20: [
      ['in:entrana', 'altar'],
      [null, 'abyss'],
    ],
    30: [[null, 'body']],
    40: [[null, 'priest']],
    50: [[null, 'tiffy']],
  },
  sections: [
    { title: 'The bow-sword', steps: ['start', 'grind', 'string', 'give'], items: ['twoh', 'bowstring'] },
    { title: 'The orb', steps: ['abyss', 'altar', 'body', 'priest', 'tiffy'], items: ['pouch'] },
  ],
  rewards: ['1 Quest Point', '5,000 Fletching experience', '5,000 Runecrafting experience', '6,500 Smithing experience'],
};
