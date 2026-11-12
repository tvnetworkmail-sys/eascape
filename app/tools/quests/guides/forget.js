// Forgettable Tale... Based on Quest Helper's ForgettableTale (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (quest_forgettable_tale: ft_start,
// ft_seeds, ft_brew, ft_tunnel, ft_end) and maps. The quest's journal isn't in the extracted
// progress data, so its stages are given here from ft_end.rs2's journal script (each stage
// adds a paragraph).
const L1 = ['Commander Veldaban asked me to find out what the Red Axe', 'is up to. His only lead is a drunken dwarf in the north-east', 'of Keldagrim-East who talks about kebabs a lot.'];
const L2 = ['The drunken dwarf wants Kelda stout. He gave me a Kelda', 'seed; his drinking buddies may have the other three.'];
const L3 = ['Rind the gardener let me grow my Kelda seeds in the', "palace garden's hops patch. They only grow underground."];
const L4 = ['I have my Kelda hops. The brewery is upstairs in the', 'Laughing Miner, in Keldagrim-East.'];
const L5 = ['I brewed some Kelda stout for the drunken dwarf.'];
const L6 = ['The drunken dwarf told me about an old mine south of the', 'city. It is boarded up, south of the cart station.'];
const LC = ["The cart conductor can't open it. Perhaps the director of"];
const L7 = ['The boards have been taken away. I can ride a cart into', 'the old mine from the cart station.'];
const L8 = ["I heard the Red Axe's director talking: they had the boatman", "crash into King Alvis' statue on purpose."];
const L9 = ["I found the Red Axe's records, and the truth about the", 'drunken dwarf: they wiped his memory.'];
const L10 = ["There's another chasm. I'm going deeper into the mines."];
module.exports = {
  quest: 'forget',
  members: true,
  difficulty: 'Intermediate',
  start: 'Talk to Commander Veldaban in the Black Guard headquarters in Keldagrim.',
  items: {
    seeds: { name: 'Kelda seeds', obj: ['kelda_hop_seed', 'kelda_hop_seed_2', 'kelda_hop_seed_3', 'kelda_hop_seed_4', 'kelda_hop_seed_5'], tip: 'The drunken dwarf and his drinking buddies have them' },
    rake: { name: 'Rake', obj: 'rake' },
    spade: { name: 'Seed dibber', obj: 'dibber' },
    hops: { name: 'Kelda hops', obj: 'kelda_hops' },
    bucket: { name: 'Bucket of water', obj: 'bucket_water', qty: 2, tip: 'For the brewing vat' },
    barley: { name: 'Barley malt', obj: 'barley_malt', qty: 2, tip: 'For the brewing vat' },
    yeast: { name: 'Ale yeast', obj: 'ale_yeast', tip: 'A pot of ale yeast for the vat' },
    stout: { name: 'Kelda stout', obj: 'kelda_stout' },
  },
  required: ['rake', 'spade', 'bucket', 'barley', 'yeast'],
  skills: ['22 Cooking', '17 Farming', 'The Giant Dwarf and Fishing Contest completed'],
  journal: [
    { lo: 0, texts: ['I can start this quest by talking to Commander Veldaban in', 'the Black Guard headquarters in Keldagrim.'] },
    { lo: 10, texts: [...L1] },
    { lo: 20, texts: [...L1, ...L2] },
    { lo: 30, texts: [...L1, ...L2, ...L3] },
    { lo: 40, texts: [...L1, ...L2, ...L3, ...L4] },
    { lo: 50, texts: [...L1, ...L2, ...L3, ...L4, ...L5] },
    { lo: 60, texts: [...L1, ...L2, ...L3, ...L4, ...L5, ...L6] },
    { lo: 65, texts: [...L1, ...L2, ...L3, ...L4, ...L5, ...L6, ...LC] },
    { lo: 70, hi: 80, texts: [...L1, ...L2, ...L3, ...L4, ...L5, ...L6, ...L7] },
    { lo: 90, hi: 100, texts: [...L1, ...L2, ...L3, ...L4, ...L5, ...L6, ...L7, ...L8] },
    { lo: 110, texts: [...L1, ...L2, ...L3, ...L4, ...L5, ...L6, ...L7, ...L8, ...L9] },
    { lo: 120, texts: [...L1, ...L2, ...L3, ...L4, ...L5, ...L6, ...L7, ...L8, ...L9, ...L10] },
    { lo: 130, hi: 140, texts: ['Hi hi hi ha ha ha ha.', 'Lalalalalalalalala.'] },
    { lo: 200, hi: 1000000, texts: ['I had a beer and a kebab in the Laughing Miner and told', "everyone a tale. I can't remember what about.", 'QUEST COMPLETE!'] },
  ],
  zones: {
    keldagrim: [2816, 10112, 2943, 10239, 0],
    keldagrim1: [2816, 10112, 2943, 10239, 1],
  },
  steps: {
    travel: { text: 'Go to Keldagrim: take the cart from the dwarven mine under Ice Mountain (150 coins), or the boat from the Keldagrim entrance cave east of Rellekka.', npc: 'dwarf_city_train_conductor7', at: [2995, 9837, 0] },
    start: { text: 'Talk to Commander Veldaban in the Black Guard headquarters.', npc: 'dwarf_city_black_guard_leader', at: [2826, 10215, 0], options: ['Very interested!', 'Yes.'] },
    drunk: { text: 'Talk to the drunken dwarf in the north-east of Keldagrim-East about the Red Axe.', npc: 'dwarf_city_drunken_dwarf_multi', at: [2912, 10222, 0], options: ['I need to know about the Red Axe...'] },
    seeds: { text: "Collect the other three Kelda seeds from the drunken dwarf's drinking buddies, then ask Rind the gardener in the palace garden about growing them.", npc: 'dwarf_city_gardener_dwarf', at: [2854, 10195, 0] },
    grow: { text: "Rake the palace's Kelda hops patch, plant the seeds and pick the hops when they've grown.", loc: 'farming_hops_patch_keldagrim', at: [2853, 10203, 0], items: ['rake', 'spade'] },
    brew: { text: 'Upstairs in the Laughing Miner, put two buckets of water, two barley malt, the Kelda hops and a pot of ale yeast in the brewing vat; once it has fermented, open the valve and fill a glass from the barrel.', loc: 'brewing_vat_1', at: [2917, 10194, 1], items: ['bucket', 'barley', 'hops', 'yeast'] },
    drunk2: { text: 'Give the Kelda stout to the drunken dwarf.', npc: 'dwarf_city_drunken_dwarf_multi', at: [2912, 10222, 0], items: ['stout'] },
    conductor: { text: 'Ask the cart conductor nearest the boarded-up tunnel south of the cart station about it.', npc: 'dwarf_city_train_conductor4', at: [2906, 10171, 0] },
    director: { text: 'Ask the director of your Consortium company to have the boards removed.', npc: 'dwarf_city_director_purple_pewter', at: [2870, 10196, 1] },
    mine: { text: 'Ride a cart into the old mine from the cart station and work through the chasms: set the track junctions so the cart gets across, listening in on the Red Axe and searching their records.', at: [2906, 10171, 0] },
    veldaban: { text: 'Talk to Commander Veldaban.', npc: 'dwarf_city_black_guard_leader', at: [2826, 10215, 0] },
    kebab: { text: 'Go to the Laughing Miner in Keldagrim-East.', at: [2913, 10191, 0] },
  },
  stages: {
    0: [
      ['in:keldagrim | in:keldagrim1', 'start'],
      [null, 'travel'],
    ],
    10: [[null, 'drunk']],
    20: [[null, 'seeds']],
    30: [[null, 'grow']],
    40: [[null, 'brew']],
    50: [[null, 'drunk2']],
    60: [[null, 'conductor']],
    65: [[null, 'director']],
    '70-120': [[null, 'mine']],
    130: [[null, 'veldaban']],
    140: [[null, 'kebab']],
  },
  sections: [
    { title: 'Starting off', steps: ['travel', 'start', 'drunk'] },
    { title: 'Kelda stout', steps: ['seeds', 'grow', 'brew', 'drunk2'], items: ['rake', 'spade', 'bucket', 'barley'] },
    { title: 'The Red Axe', steps: ['conductor', 'director', 'mine', 'veldaban', 'kebab'] },
  ],
  rewards: ['2 Quest Points', '5,000 Cooking experience', '5,000 Farming experience', 'Two mature dwarven stouts'],
};
