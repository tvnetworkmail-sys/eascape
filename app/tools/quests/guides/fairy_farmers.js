// A Fairy Tale Pt. 1 (Fairytale I - Growing Pains). Based on Quest Helper's FairytaleI (BSD
// 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (quest_fairy1: fairy1_martin,
// fairy1_gardeners, fairy1_zanaris, fairy1_mages, fairy1_grove; spade) and maps.
module.exports = {
  quest: 'fairy_farmers',
  difficulty: 'Experienced',
  members: true,
  start: 'Talk to Martin the Master Gardener in the Draynor Village market.',
  items: {
    staff: { name: 'Dramen staff', obj: 'dramen_staff', tip: 'To enter Zanaris (Lost City)' },
    spade: { name: 'Spade', obj: 'spade', tip: 'To dig up the skull' },
    secateurs: { name: 'Secateurs', obj: 'secateurs', tip: 'Farming shops sell them' },
    list: { name: 'Symptoms list', obj: 'fairy_symptoms_list', tip: 'Fairy Nuff gives it' },
    skull: { name: 'Skull', obj: 'fairy_skull', tip: 'Dig in the grave behind Draynor Manor' },
    magic: { name: 'Magic secateurs', obj: 'fairy_enchanted_secateurs', tip: 'The Nature Spirit enchants your secateurs' },
    queen: { name: "Queen's secateurs", obj: 'fairy_queen_secateurs', tip: 'The Tanglefoot drops them' },
  },
  required: ['staff', 'spade', 'secateurs'],
  skills: ['Lost City and Nature Spirit completed', 'Able to defeat the Tanglefoot (level 111) with the magic secateurs'],
  steps: {
    start: { text: 'Talk to Martin the Master Gardener in the Draynor Village market.', npc: 'martin_the_master_farmer', at: [3078, 3258, 0], options: ['Anything I can help with?', "Of course I'll help.", 'Yes.'] },
    gardeners: { text: 'Ask five of the gardeners who look after the farming patches whether they are members of the Group of Advanced Gardeners, then go back to Martin.', npc: 'martin_the_master_farmer', at: [3078, 3258, 0], options: ['Are you a member of the Group of Advanced Gardeners?'] },
    godfather: { text: 'Wield your Dramen staff, enter Zanaris through the shed in Lumbridge Swamp and talk to the Fairy Godfather on the throne.', npc: 'fairy_godfather_multi', at: [2446, 4427, 0], items: ['staff'] },
    nuff: { text: 'Talk to Fairy Nuff, the healer, in the north-west of Zanaris; she gives you a list of the Queen\'s symptoms.', npc: 'fairy_nuff', at: [2391, 4468, 0] },
    zandar: { text: 'Take the symptoms list to Zandar Horfyre at the top of the Dark Wizards\' Tower west of Falador.', npc: 'zandar_horfyre', at: [2905, 3334, 2], items: ['list'] },
    malignius: { text: 'Talk to Malignius Mortifer at the crossroads south of Falador.', npc: 'elemental_wizard_boss', at: [2991, 3269, 0] },
    skull: { text: 'Dig in the grave behind Draynor Manor with a spade for a skull.', at: [3106, 3383, 0], items: ['spade'] },
    malignius2: { text: 'Give Malignius Mortifer the skull; he tells you which three items the Nature Spirit needs.', npc: 'elemental_wizard_boss', at: [2991, 3269, 0], items: ['skull'] },
    spirit: { text: 'Take your secateurs and the three items Malignius named to the Nature Spirit\'s grotto in Mort Myre and ask him to enchant the secateurs.', loc: 'grotto_door_druidicspirit', at: [3440, 3337, 0], items: ['secateurs'] },
    tanglefoot: { text: 'In Zanaris, go through the gap by the Cosmic Altar ruins into the grove and kill the Tanglefoot with the magic secateurs (the little ones too); it drops the Queen\'s secateurs.', npc: 'fairy_tanglefoot_sml1', at: [2373, 4389, 0], items: ['magic'] },
    finish: { text: 'Give the Queen\'s secateurs to the Fairy Godfather.', npc: 'fairy_godfather_multi', at: [2446, 4427, 0], items: ['queen'] },
  },
  stages: {
    0: [[null, 'start']],
    10: [[null, 'gardeners']],
    20: [[null, 'godfather']],
    30: [[null, 'nuff']],
    40: [
      ['!have:list', 'nuff'],
      [null, 'zandar'],
    ],
    50: [
      ['have:skull', 'malignius2'],
      [null, 'malignius'],
    ],
    60: [[null, 'spirit']],
    70: [
      ['!have:magic', 'spirit'],
      [null, 'tanglefoot'],
    ],
    80: [
      ['!have:queen', 'tanglefoot'],
      [null, 'finish'],
    ],
  },
  sections: [
    { title: 'The crops', steps: ['start', 'gardeners'] },
    { title: 'Zanaris', steps: ['godfather', 'nuff', 'zandar'], items: ['staff'] },
    { title: 'The secateurs', steps: ['malignius', 'skull', 'malignius2', 'spirit'], items: ['spade', 'secateurs'] },
    { title: 'The Tanglefoot', steps: ['tanglefoot', 'finish'], items: ['magic'] },
  ],
  rewards: ['2 Quest Points', '3,500 Farming experience', '2,000 Attack experience', '1,000 Magic experience', 'Magic secateurs'],
};
