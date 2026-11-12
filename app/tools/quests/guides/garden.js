// Garden of Tranquillity. Based on Quest Helper's GardenOfTranquillity (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (quest_garden: got_ellamaria, got_wom,
// got_farmers, got_statues, got_garden) and its constants; the step texts follow our journal.
// The journal isn't in the extracted progress data, so its stages are given here from
// got_ellamaria.rs2's journal script. Most of the gardeners' "(Charm)" answers need the opened
// Ring of Charos worn. The Wise Old Man's test needs six of its first six questions right (the
// seventh doesn't count).
const L1 = ['Queen Ellamaria wants a garden of peace and serenity for', 'King Roald. She gave me a list, and told me to learn the art', 'of persuasion from the Wise Old Man in Draynor Village.'];
const L2 = ['The Wise Old Man opened the power of the Ring of Charos.', 'It only works whilst I am wearing it.'];
const L3 = ['The garden is finished. Queen Ellamaria wants me to fetch', 'King Roald to see it.'];
module.exports = {
  quest: 'garden',
  members: true,
  difficulty: 'Experienced',
  start: 'Talk to Queen Ellamaria in the garden east of Varrock palace.',
  journal: [
    { lo: 0, texts: ['I can start this quest by talking to Queen Ellamaria in the', 'garden to the east of Varrock palace.'] },
    { lo: 10, texts: [...L1] },
    { lo: 20, texts: [...L1, ...L2] },
    { lo: 30, texts: [...L1, ...L2, ...L3] },
    { lo: 60, hi: 1000000, texts: [...L1, ...L2, ...L3, 'King Roald saw his new garden, and the Queen rewarded me.', 'QUEST COMPLETE!'] },
  ],
  items: {
    ring: { name: 'Ring of charos', obj: ['ring_of_charos', 'ring_of_charos_unlocked'], tip: 'From Creature of Fenkenstrain' },
    ringU: { name: 'Ring of charos(u)', obj: 'ring_of_charos_unlocked', worn: true, tip: 'The Wise Old Man opens it' },
    list: { name: 'List', obj: 'garden_list', tip: 'Queen Ellamaria gives it (and another if you lose it)' },
    trolley: { name: 'Trolley', obj: 'garden_trolley_obj', tip: 'Ask Queen Ellamaria how to move the statues' },
    secateurs: { name: 'Secateurs', obj: ['secateurs', 'fairy_enchanted_secateurs'], tip: 'To cut the White Tree shoot' },
    shoot: { name: 'White tree shoot', obj: ['garden_white_tree_shoot', 'garden_white_tree_plantpot_shoot', 'garden_white_tree_plantpot_shoot_watered'] },
    sapling: { name: 'White tree sapling', obj: 'garden_white_tree_plantpot_sapling' },
    marigold: { name: 'Marigolds', obj: 'marigold', tip: "Grown in Elstan's flower patch" },
    plantCure: { name: 'Plant cure', obj: 'plant_cure', qty: 2, tip: 'One for the first try, one for the strong cure' },
    essence: { name: 'Rune essence', obj: ['blankrune'], tip: 'Crushed with a hammer, ground with a pestle and mortar' },
    hammer: { name: 'Hammer', obj: 'hammer' },
    pestle: { name: 'Pestle and mortar', obj: 'pestle_and_mortar' },
    strongCure: { name: 'Plant cure (strong)', obj: 'plant_cure_strong' },
    rod: { name: 'Fishing rod', obj: ['fishing_rod', 'fly_fishing_rod'], tip: 'To fish the ring back out of the Edgeville well' },
    seeds: { name: 'Garden seeds', obj: ['garden_delphinium_seed', 'garden_snowdrop_seed', 'garden_vine_seed', 'garden_rosebush_seed_red', 'garden_rosebush_seed_pink', 'garden_rosebush_seed_white', 'garden_orchid_pink_seed', 'garden_orchid_yellow_seed'] },
    spade: { name: 'Seed dibber, rake and spade', obj: ['dibber', 'rake', 'spade'], qty: 3 },
    farmSeeds: { name: 'Marigold seeds, onion seeds and cabbage seeds', obj: ['marigold_seed', 'onion_seed', 'cabbage_seed'], qty: 3, tip: 'For Elstan, Lyra and Kragen' },
  },
  required: ['ring', 'secateurs', 'plantCure', 'essence', 'hammer', 'pestle', 'rod', 'spade', 'farmSeeds'],
  skills: ['25 Farming', 'Creature of Fenkenstrain completed'],
  steps: {
    start: { text: 'Talk to Queen Ellamaria in the garden east of Varrock palace and agree to help.', npc: 'queen_ellamaria', at: [3228, 3477, 0], options: ['I would be happy to help someone who is so in touch with the people.'] },
    wom: { text: 'Ask the Wise Old Man in Draynor Village for guidance and bring him the Ring of Charos. Pass his test: 1 show them a range of colours, 2 take the kebab, 3 "It\'s absolutely, unquestionably the most interesting thing...", 4 put on the silly helmet, 5 "You of course Pkmaster0036...", 6 "Ask me nicely and I might consider it."; the seventh answer doesn\'t matter.', npc: 'wise_old_man', at: [3088, 3255, 0], items: ['ring'], options: ['Queen Ellamaria has sent me to seek your guidance.', "I've brought the Ring of Charos, as instructed.", 'Can I retake the diplomacy test?'] },
    overview: { text: 'Gather everything on the list (the steps below) wearing the opened Ring of Charos, and plant it all in the garden\'s patches. When everything has grown, tell Queen Ellamaria.', npc: 'queen_ellamaria', at: [3228, 3477, 0], items: ['ringU', 'list'], options: ["Well, I think that's everything..."] },
    elstan: { text: 'Ask Elstan at the farming patches south of Falador for delphinium seeds, charm him and agree to grow marigolds in his flower patch; pick them and give them to him.', npc: 'elstan', at: [3053, 3308, 0], items: ['ringU', 'farmSeeds'], options: ['Do you have any delphinium seeds to spare?', '(Charm) That is why I have come to an expert for advice.', '(Charm) Not just AN expert, Elstan - they say you are THE expert.', '(Charm) Oh no, I love listening to gardening stories...', '(Charm) Millions? Ah, just what I wanted to hear...', "Okay, I'll grow you some marigolds."] },
    lyra: { text: 'Ask Lyra at the farming patches west of Port Phasmatys for orchid seeds, charm her and agree to grow a patch of onions; then tell her they\'ve grown.', npc: 'lyra', at: [3601, 3527, 0], items: ['ringU', 'farmSeeds'], options: ['Do you have any orchid seeds to spare?', '(Charm) If you tell me your problems, I may be able to help you.', '(Charm) Yes, I was wondering about that.', '(Charm) Times must be very hard for you.', "(Charm) Whatever you've done, I'm sure you had just cause.", '(Charm) And what is the nature of this fee that you pay?', '(Charm) If not yours, then whose blood are you offering?', '(Charm) How can you deal with so much guilt?', "That's a deal - I'll grow a patch of onions for you.", "Okay, I've grown those onions like you asked."] },
    kragen: { text: 'Ask Kragen at the farming patches north of Ardougne for snowdrop seeds, charm him and agree to grow cabbages; then tell him they\'ve grown.', npc: 'kragen', at: [2668, 3374, 0], items: ['ringU', 'farmSeeds'], options: ['Do you have any snowdrop seeds to spare?', '(Charm) You seem to be a little irritable, my friend.', "(Charm) I don't like to see a fellow human being so upset.", '(Charm) So what ails you, my friend?', '(Charm) Well, is there anything I can do for you?', '(Charm) So what can I do for you?', "That's a deal - I'll let you know when your cabbages are ready.", "Okay, I've grown those cabbages like you asked."] },
    dantaera: { text: 'Ask Dantaera at the farming patches in Catherby how to grow a White Tree and charm her into letting you take a cutting.', npc: 'dantaera', at: [2808, 3464, 0], items: ['ringU'], options: ['Do you know how I could grow a White Tree?', '(Charm) I think that there is something that you are not telling me.', '(Charm) A secret is a dreadful burden to have to keep to yourself.', '(Charm) Unless you allow me to do this she will die anyway.'] },
    shoot: { text: 'Cut a shoot from the dead White Tree on Ice Mountain with secateurs.', loc: 'garden_white_tree_dead', at: [3007, 3497, 0], items: ['secateurs'] },
    pot: { text: 'Put the shoot in a plant pot of soil and water it until it grows into a sapling.', at: [3007, 3497, 0], items: ['shoot'] },
    bernald: { text: 'Talk to Bernald in Burthorpe, charm him and accept his deal; use a plant cure on his diseased vines.', npc: 'bernald', at: [2918, 3534, 0], items: ['ringU', 'plantCure'], options: ['(Charm) But it is the only way that these vines will be cured.', 'I accept the deal.'] },
    alain: { text: 'Ask Alain at the tree patch in Taverley about strong plant cures (not with a charm). Then crush rune essence with a hammer, grind the shards with a pestle and mortar and mix the dust into a plant cure.', npc: 'farming_gardener_tree_1', at: [2933, 3438, 0], items: ['essence', 'hammer', 'pestle', 'plantCure'], options: ['I need to ask you about strong plant cures.', "Are you sure there's nothing you can suggest?"] },
    vines: { text: "Use the strong plant cure on Bernald's vines, then get the vine seeds from him.", loc: 'garden_burthorpe_vines', at: [2913, 3534, 0], items: ['strongCure'] },
    althric: { text: "Admire Brother Althric's rosebushes at Edgeville Monastery with the ring on; he tells you to get rid of it.", npc: 'brother_althric', at: [3049, 3507, 0], items: ['ringU'], options: ['(Charm) These are the most beautiful rosebushes I\'ve ever seen.'] },
    well: { text: 'Throw the Ring of Charos(u) down the well west of Edgeville bank, talk to Brother Althric again and take seeds from his red, pink and white rosebushes. Fish the ring back out of the well with a fishing rod.', at: [3084, 3502, 0], items: ['ringU', 'rod'] },
    statues: { text: 'Ask Queen Ellamaria for a trolley, use it on the statue of Saradomin in Falador park and on the statue of a king outside Lumbridge Castle, and push each back to its plinth in the garden within about five minutes.', loc: 'falador_statue_saradomin', at: [2965, 3381, 0], items: ['trolley'], options: ['How am I supposed to move statues all the way here?'] },
    plant: { text: 'Plant the seeds and the sapling in their patches in the garden and wait for everything to grow.', loc: 'garden_white_tree_patch', at: [3229, 3474, 0], items: ['seeds', 'sapling', 'spade'] },
    roald: { text: 'Fetch King Roald from the palace and charm him into following you to the garden.', npc: 'king_roald', at: [3222, 3476, 0], items: ['ringU'], options: ['Would you like to follow me for a minute?', '(Charm) Of course, your majesty - please forgive me.', '(Charm) The Queen asked me to bring you.'] },
  },
  stages: {
    0: [[null, 'start']],
    10: [[null, 'wom']],
    20: [
      ['have:sapling | have:seeds', 'plant'],
      ['have:shoot', 'pot'],
      ['have:strongCure', 'vines'],
      [null, 'overview'],
    ],
    30: [[null, 'roald']],
  },
  sections: [
    { title: 'Starting off', steps: ['start', 'wom'], items: ['ring'] },
    { title: 'Seeds', steps: ['overview', 'elstan', 'lyra', 'kragen', 'dantaera', 'shoot', 'pot', 'bernald', 'alain', 'vines', 'althric', 'well'], items: ['farmSeeds', 'secateurs', 'plantCure', 'essence', 'hammer', 'pestle', 'rod'] },
    { title: 'The garden', steps: ['statues', 'plant', 'roald'], items: ['spade'] },
  ],
  rewards: ['2 Quest Points', '5,000 Farming experience', 'An acorn and an apple tree seed', '5 guam seeds', 'A compost potion'],
};
