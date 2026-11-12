// Pirate's Treasure. Based on Quest Helper's PiratesTreasure (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (quest_hunt: redbeard_frank, luthas,
// banana_crate, food_store, pirate_message, dig; wydin) and maps.
module.exports = {
  quest: 'hunt',
  difficulty: 'Novice',
  start: 'Talk to Redbeard Frank on the docks of Port Sarim.',
  items: {
    coins: { name: 'Coins', obj: 'coins', qty: 60, tip: 'The boat to Karamja and back (30 each way) and the rum' },
    rum: { name: 'Karamjan rum', obj: 'karamja_rum', tip: 'Zambo sells it in the bar on Karamja' },
    apron: { name: 'White apron', obj: 'white_apron', worn: true, tip: 'Thessalia sells them in Varrock' },
    key: { name: 'Chest key', obj: 'chest_key' },
    message: { name: 'Pirate message', obj: 'piratemessage' },
    spade: { name: 'Spade', obj: 'spade' },
  },
  required: ['coins', 'apron', 'spade'],
  skills: ['Able to fight off a gardener (level 4)'],
  zones: {
    karamja: [2740, 3130, 2990, 3240, 0],
  },
  flags: {
    shipped: { on: ["Well done, here's your payment."], off: ['You find your bottle of rum amongst the bananas.'] },
  },
  steps: {
    start: { text: 'Talk to Redbeard Frank on the docks of Port Sarim.', npc: 'redbeard_frank', at: [3053, 3250, 0], options: ["I'm in search of treasure.", "Ok thanks, I'll go and get it."] },
    rum: { text: 'Take the boat from Port Sarim to Karamja and buy a Karamjan rum from Zambo in the bar.', npc: 'zambo', at: [2925, 3143, 0], items: ['coins'] },
    luthas: { text: 'Talk to Luthas at the banana plantation and ask for work.', npc: 'luthas', at: [2939, 3154, 0], options: ['Could you offer me employment on your plantation?'] },
    stash: { text: 'Use the rum on the crate, then pick 10 bananas from the trees and put them in the crate. Then tell Luthas.', loc: 'bananacrate', at: [2943, 3151, 0], items: ['rum'] },
    wydin: { text: 'Back in Port Sarim, wear a white apron and ask Wydin for a job, then search the crate in the back room of his store.', npc: 'wydin', at: [3014, 3204, 0], items: ['apron'], options: ['Can I get a job here?'] },
    crate: { text: 'Search the crate in the back of Wydin\'s store for your rum.', loc: 'grocerycrate', at: [3009, 3207, 0], items: ['apron'] },
    frank: { text: 'Give the rum to Redbeard Frank.', npc: 'redbeard_frank', at: [3053, 3250, 0], items: ['rum'] },
    chest: { text: 'Use the key on the chest upstairs in the Blue Moon Inn in Varrock, then read the message.', loc: 'piratechest', at: [3218, 3396, 1], items: ['key'] },
    read: { text: 'Read the pirate message.', at: [3218, 3396, 1], items: ['message'] },
    dig: { text: 'Dig with a spade in the flower bed in Falador park; the gardener attacks, then dig again.', at: [2999, 3383, 0], items: ['spade'] },
  },
  stages: {
    0: [[null, 'start']],
    1: [
      ['have:rum & in:karamja', 'stash'],
      ['have:rum', 'frank'],
      ['seen:shipped', 'crate'],
      [null, 'rum'],
    ],
    2: [
      ['have:message', 'read'],
      [null, 'chest'],
    ],
    3: [[null, 'dig']],
  },
  sections: [
    { title: 'Starting off', steps: ['start'] },
    { title: 'The rum', steps: ['rum', 'luthas', 'stash', 'wydin', 'crate', 'frank'], items: ['coins', 'apron'] },
    { title: 'The treasure', steps: ['chest', 'read', 'dig'], items: ['spade'] },
  ],
  rewards: ['2 Quest Points', 'One-Eyed Hector\'s treasure: 450 coins, a gold ring and an emerald'],
};
