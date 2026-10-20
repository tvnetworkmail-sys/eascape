// Temple of Ikov. Based on Quest Helper's TempleOfIkov (BSD 2-Clause, (c) 2020 Zoinkwiz), for
// this server's quest (content/scripts/quests/quest_ikov): the boots of lightness and the lava
// bridge (you must weigh under 0 kg), the lever, the ice arrow chests, the trap lever (Thieving
// 42), the Fire Warrior, Winelda's 20 limpwurt roots and the Guardians, as built here. The guide
// takes the Armadyl ending (kill Lucien); taking the staff to Lucien also completes the quest.
module.exports = {
  quest: 'ikov',
  difficulty: 'Experienced',
  start: 'Talk to Lucien in the Flying Horse Inn in East Ardougne.',
  items: {
    limpwurt: { name: 'Limpwurt root', obj: 'limpwurt_root', qty: 20 },
    pendant: { name: "Pendant of Lucien", obj: 'ikov_pendantoflucien', qty: 1 },
    boots: { name: 'Boots of lightness', obj: 'ikov_bootsoflightness', qty: 1 },
    lever: { name: 'Lever', obj: 'ikov_lever', qty: 1 },
    arrows: { name: 'Ice arrows', obj: 'ice_arrow', qty: 1 },
    armadyl: { name: 'Pendant of Armadyl', obj: 'ikov_pendantofarmardyl', qty: 1 },
    staff: { name: 'Staff of Armadyl', obj: 'ikov_staffofarmardyl', qty: 1 },
  },
  required: ['limpwurt'],
  skills: ['A light source (lit candle, torch or lantern) and a tinderbox', 'A bow that fires ice arrows (shortbow or longbow)', 'Level 42 Thieving', 'Level 40 Ranged', 'You must weigh under 0 kg to cross the lava bridge'],
  steps: {
    lucien: { text: 'Talk to Lucien in the Flying Horse Inn in East Ardougne and agree to get the Staff of Armadyl.', npc: 'ikov_lucien1', at: [2573, 3321, 0], options: ["I'm a mighty hero!", 'That sounds like a laugh!'] },
    enter: { text: 'With a light source, a bow and 20 limpwurt roots, climb down the ladder into the Temple of Ikov, by the statues north-east of East Ardougne.', loc: 'loc_1754', at: [2677, 3405, 0] },
    darkStairs: { text: 'Go down the dark stairs in the west with your light source lit.', loc: 'ikov_darkstairsdown', at: [2650, 9804, 0] },
    boots: { text: 'Pick up the boots of lightness, then go back up the stairs.', obj: 'ikov_bootsoflightness', at: [2654, 9767, 0] },
    bridge: { text: 'Wear the boots of lightness and bank or drop enough to weigh under 0 kg, cross the lava bridge and pick up the lever on the far side.', obj: 'ikov_lever', at: [2637, 9819, 0], items: ['boots'] },
    bracket: { text: 'Use the lever on the lever bracket in the east, then pull it to open the gate south of it.', loc: 'ikov_leverbracket', at: [2671, 9804, 0], items: ['lever'] },
    chests: { text: 'Go through the south gate and search the chests in the ice spiders\' cave until you find ice arrows.', loc: 'ikov_chestclosed', at: [2729, 9850, 0] },
    trap: { text: "Wear Lucien's pendant, go through the north door (it fills you with fear without it) and search the lever for traps (Thieving 42).", loc: 'ikov_traplever', at: [2665, 9855, 0], items: ['pendant'] },
    pull: { text: 'Pull the lever.', loc: 'ikov_traplever', at: [2665, 9855, 0] },
    warrior: { text: 'Go through the door to the west and kill the Fire Warrior of Lesarkus with ice arrows (wield a bow).', npc: 'ikov_firewarrior', at: [2646, 9866, 0], items: ['arrows'] },
    winelda: { text: 'Talk to Winelda in the north.', npc: 'ikov_winelda', at: [2656, 9875, 0], options: ['Yes I do!'] },
    roots: { text: 'Bring Winelda 20 limpwurt roots (not noted) and talk to her: she teleports you across.', npc: 'ikov_winelda', at: [2656, 9875, 0], items: ['limpwurt'] },
    guardian: { text: "Take off Lucien's pendant and talk to a Guardian of Armadyl: side with them against Lucien.", npc: ['ikov_guardianmale', 'ikov_guardianfemale'], at: [2638, 9899, 0], options: ['I seek the Staff of Armadyl.', 'Lucien will give me a grand reward for it!', "You're right, it's time for my yearly bath.", "Ok! I'll help!"] },
    giveStaff: { text: "Take the Staff of Armadyl to Lucien in his house in north-west Varrock.", npc: 'ikov_lucien2', at: [3176, 3476, 0], items: ['staff'], options: ['Yes! Here it is.'] },
    killLucien: { text: 'Wear the Pendant of Armadyl and kill Lucien in his house in north-west Varrock.', npc: 'ikov_lucien2', at: [3176, 3476, 0], items: ['armadyl'] },
  },
  sections: [
    { title: 'Starting off', steps: ['lucien', 'enter'] },
    { title: 'The boots and the lever', steps: ['darkStairs', 'boots', 'bridge', 'bracket'] },
    { title: 'The Fire Warrior', steps: ['chests', 'trap', 'pull', 'warrior'] },
    { title: 'Winelda and the Guardians', steps: ['winelda', 'roots', 'guardian', 'giveStaff', 'killLucien'] },
  ],
  rewards: ['1 Quest Point', '10,500 Ranged experience', '8,000 Fletching experience'],
};
