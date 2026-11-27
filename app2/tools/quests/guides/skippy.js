// Skippy and the Mogres (miniquest). 2007RS: written from our script (miniquest_skippy: skippy.rs2
// and skippy.constant) and maps. The stage is the cache's skippy_state varbit (0 drunk, 1 damp,
// 2 hungover, 3 sober, the end). A miniquest has no quest list line: the guide follows the varbit.
module.exports = {
  quest: 'skippy',
  name: 'Skippy and the Mogres',
  miniquest: true,
  varp: 'skippy_state',
  complete: '^skippy_sober',
  members: true,
  difficulty: 'Novice',
  start: 'Talk to Skippy on the coast south-west of Port Sarim (Mudskipper Point).',
  items: {
    water: { name: 'Bucket of water', obj: 'bucket_water' },
    tea: { name: 'Nettle tea', obj: 'bowl_nettletea', tip: 'Nettles (picked with gloves) in a bowl of water, heated' },
    milk: { name: 'Bucket of milk', obj: 'bucket_milk' },
    chocolate: { name: 'Chocolate dust', obj: 'chocolate_dust', tip: 'A chocolate bar ground with a pestle and mortar' },
    snape: { name: 'Snape grass', obj: 'snape_grass' },
    cure: { name: 'Hangover cure', obj: 'hangover_cure', tip: 'Chocolate dust into a bucket of milk, then snape grass' },
  },
  required: ['water', 'tea', 'milk', 'chocolate', 'snape'],
  skills: ['20 Cooking'],
  steps: {
    water: { text: 'Talk to Skippy, then throw a bucket of water over him (Sober-up).', npc: 'multi_skippy', at: [2983, 3196, 0], items: ['water'], options: ['Throw the water!'] },
    tea: { text: 'Give Skippy a nettle tea.', npc: 'multi_skippy', at: [2983, 3196, 0], items: ['tea'] },
    cure: { text: 'Make a hangover cure (chocolate dust into a bucket of milk, then snape grass) and give it to Skippy.', npc: 'multi_skippy', at: [2983, 3196, 0], items: ['cure'] },
    make: { text: 'Make the hangover cure: chocolate dust into the bucket of milk, then snape grass.', anywhere: true, items: ['milk', 'chocolate', 'snape'] },
  },
  stages: {
    0: [[null, 'water']],
    1: [[null, 'tea']],
    2: [
      ['have:cure', 'cure'],
      [null, 'make'],
    ],
  },
  sections: [
    { title: 'Sobering Skippy up', steps: ['water', 'tea', 'make', 'cure'], items: ['water', 'tea', 'milk', 'chocolate', 'snape'] },
  ],
  rewards: ['The ability to fight mogres (Slayer level 32)'],
};
