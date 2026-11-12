// Temple of Ikov. Based on Quest Helper's TempleOfIkov (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (quest_ikov: lucien, ikov_dungeon,
// fire_warrior_of_leskarus, winelda, guardian_of_armadyl, quest_ikov) and maps. The guide follows
// the Guardians of Armadyl's side; taking the staff to Lucien instead is shown if you pick it up.
// The bridge over the lava only holds you while you weigh less than nothing (boots of lightness on).
module.exports = {
  quest: 'ikov',
  members: true,
  difficulty: 'Experienced',
  start: 'Talk to Lucien in the Flying Horse Inn in East Ardougne.',
  items: {
    pendantL: { name: 'Pendant of Lucien', obj: 'ikov_pendantoflucien', tip: 'Lucien gives it (and another if you lose it)' },
    light: { name: 'Any lit light source', category: 'light_source_lit' },
    boots: { name: 'Boots of lightness', obj: ['ikov_bootsoflightness', 'ikov_bootsoflightnessworn'] },
    lever: { name: 'Lever', obj: 'ikov_lever' },
    arrows: { name: 'Ice arrows', obj: 'ice_arrow', tip: 'In the chests of the ice cavern' },
    bow: { name: 'Any bow', category: 'weapon_bow' },
    roots: { name: 'Limpwurt roots', obj: 'limpwurt_root', qty: 20 },
    pendantA: { name: 'Pendant of Armadyl', obj: 'ikov_pendantofarmardyl', tip: 'The guardians give another if you lose it' },
    staff: { name: 'Staff of Armadyl', obj: 'ikov_staffofarmardyl' },
  },
  required: ['light', 'bow', 'roots'],
  skills: ['42 Thieving', '40 Ranged', 'Able to defeat a level 84 Fire Warrior with ice arrows, and Lucien (level 14, with the pendant)'],
  flags: {
    leverPulled: { on: ['You hear the clunking of some hidden machinery.'] },
  },
  steps: {
    start: { text: 'Talk to Lucien in the Flying Horse Inn and agree to fetch the Staff of Armadyl; he gives you a pendant.', npc: 'ikov_lucien1', at: [2573, 3321, 0], options: ["I'm a mighty hero!", 'That sounds like a laugh!'] },
    boots: { text: 'With a lit light source, go down the trapdoor near Hemenster and the dark stairs beyond. Pick up the boots of lightness.', obj: 'ikov_bootsoflightness', at: [2654, 9766, 0], keepAt: true, items: ['light', 'pendantL'] },
    trap: { text: 'Search the lever in the north of the dungeon for traps and disable the trap.', loc: 'ikov_traplever', at: [2665, 9855, 0], },
    pull: { text: 'Pull the lever.', loc: 'ikov_traplever', at: [2665, 9855, 0] },
    leverPiece: { text: 'Wear the boots of lightness and carry as little as you can, cross the lava bridge westward and pick up the lever in the room beyond.', obj: 'ikov_lever', at: [2637, 9820, 0], keepAt: true, items: ['boots'], note: 'The bridge gives way unless you weigh less than nothing.' },
    bracket: { text: 'Fit the lever into the bracket on the wall and pull it; the gate to the ice cavern opens.', loc: 'ikov_leverbracket', at: [2671, 9804, 0], items: ['lever'] },
    arrows: { text: 'Search the chests in the ice cavern for ice arrows.', loc: 'ikov_chestclosed', at: [2719, 9838, 0] },
    warrior: { text: 'Wearing the pendant of Lucien, go through the door of fear and the door past the trap lever, and kill the Fire Warrior of Lesarkus with ice arrows.', loc: 'ikov_firewarriordoor', at: [2646, 9870, 0], items: ['pendantL', 'bow', 'arrows'] },
    winelda: { text: 'Talk to Winelda by the lava; she will teleport you across for 20 limpwurt roots.', npc: 'ikov_winelda', at: [2656, 9875, 0], options: ['Yes I do!'] },
    roots: { text: 'Bring Winelda 20 limpwurt roots.', npc: 'ikov_winelda', at: [2656, 9875, 0], items: ['roots'] },
    guardian: { text: 'Take off the pendant of Lucien and talk to a Guardian of Armadyl. Ask about them, the Mahjarrat and Lucien, accept the bath and agree to help.', npc: 'ikov_guardianmale', at: [2638, 9899, 0], options: ['What are your kind and what are you doing here?', 'Who are the Mahjarrat?', 'Did you say Lucien?', "You're right, it's time for my yearly bath.", "Ok! I'll help!"] },
    lucien: { text: 'Wear the pendant of Armadyl and kill Lucien in his house north of Varrock.', npc: 'ikov_lucien2', at: [3176, 3476, 0], items: ['pendantA'] },
    giveStaff: { text: '(Lucien\'s side) Give the Staff of Armadyl to Lucien in his house north of Varrock.', npc: 'ikov_lucien2', at: [3176, 3476, 0], items: ['staff'], options: ['Yes! Here it is.'] },
  },
  stages: {
    0: [[null, 'start']],
    10: [
      ['have:boots', 'trap'],
      [null, 'boots'],
    ],
    20: [[null, 'pull']],
    30: [
      ['have:arrows', 'warrior'],
      ['seen:leverPulled', 'arrows'],
      ['have:lever', 'bracket'],
      [null, 'leverPiece'],
    ],
    40: [[null, 'winelda']],
    50: [[null, 'roots']],
    60: [
      ['have:staff', 'giveStaff'],
      [null, 'guardian'],
    ],
    70: [[null, 'lucien']],
  },
  sections: [
    { title: 'Starting off', steps: ['start'] },
    { title: 'The temple', steps: ['boots', 'trap', 'pull', 'leverPiece', 'bracket', 'arrows', 'warrior'], items: ['light', 'bow'] },
    { title: 'Across the lava', steps: ['winelda', 'roots', 'guardian', 'lucien'], items: ['roots'] },
  ],
  rewards: ['1 Quest Point', '10,500 Ranged experience', '8,000 Fletching experience'],
};
