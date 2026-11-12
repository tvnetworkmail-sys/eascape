// Tears of Guthix. Based on Quest Helper's TearsOfGuthix (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (quest_tog: tog_juna, tog_chasm;
// area_lumbridge lumbridge_swamp_caves) and maps; the step texts follow our journal. Juna is a
// loc in the chasm below the Lumbridge Swamp Caves.
module.exports = {
  quest: 'tog',
  members: true,
  difficulty: 'Intermediate',
  start: 'Talk to Juna the serpent in the chasm deep beneath the Lumbridge Swamp Caves.',
  items: {
    light: { name: 'A light source', obj: ['lit_candle', 'lit_black_candle', 'torch_lit', 'bullseye_lantern_lit', 'tog_sapphire_lantern_lit'], tip: 'The Lumbridge Swamp Caves are dark' },
    lantern: { name: 'Bullseye lantern', obj: ['bullseye_lantern_nolens', 'bullseye_lantern_empty', 'bullseye_lantern_unlit', 'bullseye_lantern_lit', 'tog_sapphire_lantern_empty', 'tog_sapphire_lantern_unlit'], tip: 'Its lens is swapped for a sapphire' },
    sapphire: { name: 'Sapphire', obj: 'sapphire', tip: 'Cut, for the lantern lens (20 Crafting)' },
    sapphireLantern: { name: 'Sapphire lantern (lit)', obj: 'tog_sapphire_lantern_lit' },
    tinderbox: { name: 'Tinderbox', obj: 'tinderbox', tip: 'To light the lantern' },
    pickaxe: { name: 'Any pickaxe', category: 'weapon_pickaxe' },
    chisel: { name: 'Chisel', obj: 'chisel' },
    stone: { name: 'Magic stone', obj: 'tog_stone' },
    bowl: { name: 'Stone bowl', obj: 'tog_bowl' },
  },
  required: ['light', 'lantern', 'sapphire', 'tinderbox', 'pickaxe', 'chisel'],
  skills: ['43 Quest Points', '49 Firemaking', '20 Crafting', '20 Mining'],
  steps: {
    start: { text: 'With a light, go down into the Lumbridge Swamp Caves (the hole by the swamp south-west of Lumbridge), cross the stepping stones and climb down into the chasm. Climb the rocks to Juna and tell her a story.', loc: 'hidey_unbuilt_bush_easy', at: [3252, 9516, 2], items: ['light'], options: ['Okay...'] },
    lantern: { text: 'Use a sapphire on your bullseye lantern for a sapphire lens (20 Crafting) and light it.', at: [3252, 9516, 2], items: ['lantern', 'sapphire', 'tinderbox'] },
    cross: { text: "From the chasm's north ledge, shine the sapphire lantern on a light creature; it carries you across to the south. Mine some magic stone from the blue rocks there.", loc: 'tog_blue_stone_rocks1', at: [3224, 9491, 2], keepAt: true, items: ['sapphireLantern', 'pickaxe'] },
    bowl: { text: 'Use a chisel on the magic stone to make a stone bowl.', at: [3224, 9491, 2], items: ['stone', 'chisel'] },
    finish: { text: 'Climb down the rocks east of the south ledge and take the bowl back to Juna.', loc: 'hidey_unbuilt_bush_easy', at: [3252, 9516, 2], items: ['bowl'] },
  },
  stages: {
    0: [[null, 'start']],
    1: [
      ['have:bowl', 'finish'],
      ['have:stone', 'bowl'],
      ['have:sapphireLantern', 'cross'],
      [null, 'lantern'],
    ],
  },
  sections: [
    { title: 'Juna', steps: ['start'], items: ['light'] },
    { title: 'The stone bowl', steps: ['lantern', 'cross', 'bowl', 'finish'], items: ['lantern', 'sapphire', 'tinderbox', 'pickaxe', 'chisel'] },
  ],
  rewards: ['1 Quest Point', '1,000 Crafting experience', 'Access to the Tears of Guthix cave'],
};
