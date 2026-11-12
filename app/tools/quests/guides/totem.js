// Tribal Totem. Based on Quest Helper's TribalTotem (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (kangai_mau, quest_totem, rdpt_employee,
// wizard_cromperty) and maps. The door combination is the one quest_totem.rs2 checks
// (10, 20, 17, 19 on the alphabet: K U R T).
module.exports = {
  quest: 'totem',
  members: true,
  difficulty: 'Intermediate',
  start: 'Talk to Kangai Mau in the food store in Brimhaven.',
  items: {
    label: { name: 'Address label', obj: 'tribal_totem_label', tip: 'Peeled off a crate in the RPDT depot in Ardougne' },
    totem: { name: 'Totem', obj: 'tribal_totem' },
  },
  skills: ['21 Thieving'],
  zones: {
    mansion: [2625, 3315, 2645, 3330, 0],
    mansionUp: [2625, 3315, 2645, 3330, 1],
  },
  steps: {
    start: { text: 'Talk to Kangai Mau in the food store in Brimhaven.', npc: 'kangai_mau', at: [2791, 3182, 0], options: ["I'm in search of adventure!", 'Tell me of this mission.', 'Ok, I will get it back.'] },
    label: { text: 'Investigate the crate in the RPDT depot in Ardougne and take its label.', loc: 'horncrate', at: [2650, 3273, 0] },
    crate: { text: 'Use the label on the other crate in the depot.', loc: 'teleportcrate', at: [2650, 3271, 0], items: ['label'] },
    employee: { text: 'Talk to the RPDT employee and ask about the delivery.', npc: 'rpdt_employee', at: [2644, 3274, 0], options: ['So, when are you going to deliver this crate?'] },
    cromperty: { text: 'Talk to Wizard Cromperty in north-east Ardougne and have him teleport you.', npc: 'ardounge_wizard', at: [2683, 3326, 0], options: ['So what have you invented?', 'Can I be teleported please?', 'Yes, that sounds good. Teleport me!'] },
    door: { text: 'Open the door with the combination K U R T.', loc: 'combodoor', at: [2634, 3323, 0] },
    stairs: { text: 'Search the stairs for traps (21 Thieving) to note the trap, then climb them.', loc: 'totemtrapstairs', at: [2631, 3322, 0] },
    chest: { text: 'Open the chest upstairs and take the totem.', loc: 'totemshutchest', at: [2638, 3324, 1] },
    finish: { text: 'Bring the totem to Kangai Mau in Brimhaven.', npc: 'kangai_mau', at: [2791, 3182, 0], items: ['totem'] },
  },
  stages: {
    0: [[null, 'start']],
    1: [
      ['have:label', 'crate'],
      [null, 'label'],
    ],
    2: [[null, 'employee']],
    3: [[null, 'cromperty']],
    4: [
      ['have:totem', 'finish'],
      ['in:mansionUp', 'chest'],
      [null, 'stairs'],
    ],
  },
  sections: [
    { title: 'Starting off', steps: ['start'] },
    { title: 'The delivery', steps: ['label', 'crate', 'employee', 'cromperty'] },
    { title: 'Handelmort Mansion', steps: ['door', 'stairs', 'chest', 'finish'] },
  ],
  rewards: ['1 Quest Point', '1,775 Thieving experience', '5 swordfish'],
};
