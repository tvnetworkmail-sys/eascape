// 2007RS: made from the server's Quest Helper guide for our own quest (quest_tog); EASCape's app guide (tog.js) has the same steps, this keeps the 2007RS changes (the lamp oil, crossing back), when the server's guides
// left the game (13 Nov 2026). Based on RuneLite's Quest Helper (BSD 2-Clause, (c) 2020 Zoinkwiz).
// The stage is the quest's own variable (varp), live from the server; vars: are its other
// variables, for var: / bit: rules. Steps are numbered as the server guide had them.

module.exports = {
  quest: 'tog',
  name: 'Tears of Guthix',
  members: true,
  difficulty: 'Intermediate',
  start: 'Talk to Juna in the Chasm of Tears below the Lumbridge Swamp Caves.',
  varp: 'tog_juna_bowl',
  items: {
    bullseye_lantern_nolens: { name: 'Bullseye lantern', obj: 'bullseye_lantern_nolens' },
    sapphire: { name: 'Sapphire', obj: 'sapphire' },
    swamp_tar: { name: 'Swamp tar', obj: 'swamp_tar' },
    tinderbox: { name: 'Tinderbox', obj: 'tinderbox' },
    chisel: { name: 'Chisel', obj: 'chisel' },
    bronze_pickaxe: { name: 'Bronze pickaxe', obj: 'bronze_pickaxe' },
    rope: { name: 'Rope', obj: 'rope' },
    tog_sapphire_lantern_empty: { name: 'Sapphire lantern', obj: 'tog_sapphire_lantern_empty' },
    tog_sapphire_lantern_unlit: { name: 'Sapphire lantern', obj: 'tog_sapphire_lantern_unlit' },
    tog_sapphire_lantern_lit: { name: 'Sapphire lantern', obj: 'tog_sapphire_lantern_lit', worn: true },
    tog_stone: { name: 'Magic stone', obj: 'tog_stone' },
    tog_bowl: { name: 'Stone bowl', obj: 'tog_bowl' },
  },
  required: ['bullseye_lantern_nolens', 'sapphire', 'swamp_tar', 'tinderbox', 'chisel', 'bronze_pickaxe'],
  recommended: ['rope'],
  skills: ['43 Quest Points', '49 Firemaking', '20 Crafting', '20 Mining'],
  zones: { z1: [3200, 9472, 3263, 9535, 2], south: [3200, 9472, 3263, 9515, 2] },
  steps: {
    s1: {
      text: 'Go into the Lumbridge Swamp Caves (the hole in the swamp needs a rope; take a light source) and climb down the tunnel at their east end into the Chasm of Tears.',
      loc: 'tog_cave_down',
      at: [3225, 9539, 0],
      items: ['rope', 'tinderbox'],
    },
    s2: {
      text: 'Talk to Juna, the serpent in the rock east of the chasm, and tell her a story. Needs 43 quest points.',
      loc: 'hidey_unbuilt_bush_easy',
      at: [3252, 9516, 2],
      options: ['Okay...'],
    },
    s3: {
      text: 'Make a sapphire lantern: use a sapphire on a bullseye lantern frame (20 Crafting). A bullseye lantern with its lens works too: the sapphire replaces the lens.',
      items: ['bullseye_lantern_nolens', 'sapphire'],
      anywhere: true,
    },
    s4: {
      text: 'Fill the sapphire lantern with lamp oil at the still in Rimmington\'s chemist\'s house: use swamp tar on the still, then the lantern.',
      loc: 'lamp_oil_still',
      at: [2937, 3210, 0],
      items: ['swamp_tar', 'tog_sapphire_lantern_empty'],
    },
    s5: {
      text: 'Light the sapphire lantern with a tinderbox (49 Firemaking).',
      items: ['tog_sapphire_lantern_unlit', 'tinderbox'],
      anywhere: true,
    },
    s6: {
      text: 'Use the lit sapphire lantern on one of the light creatures flying in the chasm. It carries you across to the south side.',
      npc: 'tog_light_creature',
      at: [3224, 9530, 2],
      keepAt: true, // the north ledge you shine it from (the creatures fly over the chasm)
      items: ['tog_sapphire_lantern_lit'],
    },
    s7: {
      text: 'Mine some magic stone from the blue rocks in the cave on the south side (20 Mining).',
      loc: 'tog_blue_stone_rocks1',
      at: [3218, 9491, 2],
      items: ['bronze_pickaxe'],
    },
    s8: { text: 'Use a chisel on the magic stone to make a stone bowl.', items: ['chisel', 'tog_stone'], anywhere: true },
    s9: {
      text: 'Use the lit sapphire lantern on a light creature again to cross back to the north side.',
      npc: 'tog_light_creature',
      at: [3224, 9504, 2],
      keepAt: true, // the south ledge
      items: ['tog_sapphire_lantern_lit'],
    },
    s10: {
      text: 'Bring the stone bowl to Juna. She keeps it, and lets you collect the Tears of Guthix once a week.',
      loc: 'hidey_unbuilt_bush_easy',
      at: [3252, 9516, 2],
      items: ['tog_bowl'],
    },
  },
  stages: {
    '0': [['!in:z1', 's1'], [null, 's2']],
    '1-1000000': [
      ['have:tog_bowl & in:z1 & in:south', 's9'],
      ['have:tog_bowl & !in:z1', 's1'],
      ['have:tog_bowl', 's10'],
      ['have:tog_stone', 's8'],
      ['have:tog_sapphire_lantern_lit & in:z1 & in:south', 's7'],
      ['wear:tog_sapphire_lantern_lit & in:z1 & in:south', 's7'],
      ['have:tog_sapphire_lantern_lit & !in:z1', 's1'],
      ['wear:tog_sapphire_lantern_lit & !in:z1', 's1'],
      ['have:tog_sapphire_lantern_lit', 's6'],
      ['wear:tog_sapphire_lantern_lit', 's6'],
      ['have:tog_sapphire_lantern_unlit', 's5'],
      ['have:tog_sapphire_lantern_empty', 's4'],
      [null, 's3'],
    ],
  },
  sections: [
    { title: 'Starting off', steps: ['s1', 's2'] },
    { title: 'The sapphire lantern', steps: ['s3', 's4', 's5'] },
    { title: 'The stone bowl', steps: ['s6', 's7', 's8', 's9'] },
    { title: 'Finishing off', steps: ['s10'] },
  ],
  rewards: ['1 Quest Point', '1,000 Crafting experience', 'Access to the Tears of Guthix minigame'],
};
