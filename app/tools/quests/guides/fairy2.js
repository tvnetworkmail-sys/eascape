// Fairytale II - Cure a Queen. Based on Quest Helper's FairytaleII (BSD 2-Clause, (c) 2020 Zoinkwiz).
// Quest not in game yet: it is switched off (eascape_switches ^eascape_fairy2_on = 0, hidden in the
// quest list) and the fairy rings with it; the guide is ready for when it comes.
// EASCape: steps, options and items from our scripts (quest_fairy2: fairy2_martin, fairy2_zanaris,
// fairy2_hideout, fairy2_cure; area_fairy_rings fairy_rings and its codes; quest_zanaris for the
// shed door). Our map has no fairy rings, hideout, cosmic plane or Gorak plane yet, so the steps
// there are shown at the Zanaris fairy ring (2412,4434, from Void's Fairytale II tests), where you
// set off; the codes are our scripts'.
module.exports = {
  quest: 'fairy2',
  members: true,
  difficulty: 'Experienced',
  start: 'Talk to Martin the Master Gardener in the Draynor Village market.',
  items: {
    staff: { name: 'Dramen or lunar staff', obj: 'dramen_staff', worn: true },
    certificate: { name: "Fairy Nuff's certificate", obj: 'ft2_nuffs_certificate' },
    secateurs: { name: "Queen's secateurs", obj: 'ft2_queens_secateurs' },
    flower: { name: 'Star flower', obj: 'ft2_star_flower' },
    claws: { name: 'Gorak claws', obj: 'ft2_gorak_claws' },
    powder: { name: 'Gorak claw powder', obj: 'ft2_gorak_claw_powder' },
    unf: { name: 'Unfinished potion (star flower)', obj: 'ft2_unfinished_potion' },
    potion: { name: 'Magic essence potion', obj: ['ft2_magic_essence_4', 'ft2_magic_essence_3', 'ft2_magic_essence_2', 'ft2_magic_essence_1'] },
    vial: { name: 'Vial of water', obj: 'vial_water' },
    pestle: { name: 'Pestle and mortar', obj: 'pestle_and_mortar' },
  },
  required: ['staff', 'vial', 'pestle'],
  skills: ['A Fairy Tale Pt. 1 completed', '40 Thieving, 49 Farming and 57 Herblore to finish it', 'Able to defeat a level 145 Gorak'],
  zones: {
    zanaris: [2368, 4352, 2495, 4479, 0],
  },
  steps: {
    start: { text: 'Talk to Martin the Master Gardener and tell him the Fairy Queen will be well again.', npc: 'martin_the_master_farmer', at: [3078, 3258, 0], options: ['Yes.'] },
    wait: { text: 'Martin has planted some seeds: come back to him in about five minutes.', npc: 'martin_the_master_farmer', at: [3078, 3258, 0] },
    martin: { text: "Talk to Martin about his failing crops.", npc: 'martin_the_master_farmer', at: [3078, 3258, 0] },
    shed: { text: 'Wield your staff and go into Zanaris through the door of the shed in Lumbridge Swamp.', loc: 'zanarisdoor', at: [3202, 3169, 0], items: ['staff'] },
    godfather: { text: "Look in Fairy Nuff's ransacked room (the potion shelves hide a copy of her certificate), then ask the Fairy Godfather where the Queen is; he lets you use the fairy rings.", npc: 'fairy_godfather_multi', at: [2446, 4427, 0], options: ['Where is the Fairy Queen?', 'Do you have any idea who could have done this?', 'Yes, okay.'] },
    hideout: { text: "Read both sides of Fairy Nuff's certificate and the sign by the rune temple; the Co-ordinator explains the fairy rings. Then at the fairy ring dial AIR, DLR, DJQ and AJS one after the other: the last takes you to the fairies' hideout. Talk to Fairy Nuff there.", at: [2412, 4434, 0], items: ['certificate'] },
    nuff: { text: 'In the hideout (AIR, DLR, DJQ, AJS from the fairy ring), talk to Fairy Nuff.', at: [2412, 4434, 0] },
    pickpocket: { text: "Pick the Fairy Godfather's pocket for the Queen's secateurs (40 Thieving) without his orks seeing.", npc: 'fairy_godfather_multi', at: [2446, 4427, 0] },
    giveSecateurs: { text: 'Take the secateurs to Fairy Nuff in the hideout and talk to her again.', at: [2412, 4434, 0], items: ['secateurs'] },
    nuff2: { text: 'Talk to Fairy Nuff in the hideout again; she needs a potion of magic essence.', at: [2412, 4434, 0] },
    ingredients: { text: "Get a star flower from the cosmic entity's plane (fairy ring CKP; 49 Farming to pick) and gorak claws from the Goraks on their plane (DIR). Grind the claws, put the star flower in a vial of water, then add the powder (57 Herblore).", at: [2412, 4434, 0], items: ['vial', 'pestle'] },
    brew: { text: 'Add the gorak claw powder to the unfinished potion.', at: [2412, 4434, 0], items: ['unf', 'powder'] },
    queen: { text: 'In the hideout, use the potion of magic essence on the Fairy Queen.', at: [2412, 4434, 0], items: ['potion'] },
    finish: { text: 'Talk to the Fairy Queen for your reward (have a free space for her lamp).', at: [2412, 4434, 0] },
  },
  stages: {
    0: [[null, 'start']],
    5: [[null, 'wait']],
    10: [[null, 'martin']],
    20: [
      ['in:zanaris', 'godfather'],
      [null, 'shed'],
    ],
    40: [[null, 'hideout']],
    45: [[null, 'nuff']],
    50: [[null, 'pickpocket']],
    60: [[null, 'giveSecateurs']],
    65: [[null, 'nuff2']],
    70: [
      ['have:unf & have:powder', 'brew'],
      [null, 'ingredients'],
    ],
    72: [[null, 'brew']],
    73: [[null, 'queen']],
    '75-90': [[null, 'finish']],
  },
  sections: [
    { title: "Martin's crops", steps: ['start', 'wait', 'martin'] },
    { title: 'The missing Queen', steps: ['shed', 'godfather', 'hideout', 'nuff', 'pickpocket', 'giveSecateurs', 'nuff2'], items: ['staff'] },
    { title: 'A potion of magic essence', steps: ['ingredients', 'brew', 'queen', 'finish'], items: ['vial', 'pestle'] },
  ],
  rewards: ['2 Quest Points', '3,500 Herblore and 2,500 Thieving experience', 'An antique lamp (2,500 experience in a skill of level 30 or more)', 'Use of the fairy rings'],
};
