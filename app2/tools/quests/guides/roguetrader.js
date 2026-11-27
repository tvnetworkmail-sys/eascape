// Rogue Trader (miniquest). 2007RS: written from our scripts (miniquest_rogue_trader: rt_ali,
// rt_npcs, rt_sudoku and rogue_trader.constant; aubury.rs2, the Feud's blackjack seller and
// urchins, Icthlarin's Little Helper's Siamun) and maps. The stage is the cache's
// roguetrader_started varbit (0, 1 under way, 2 done); the three errands are its other varbits. A
// miniquest has no quest list line: the guide follows the varbits.
module.exports = {
  quest: 'roguetrader',
  name: 'Rogue Trader',
  miniquest: true,
  varp: 'roguetrader_started',
  complete: '^rt_finished',
  vars: { bj: 'roguetrader_blackjacks', bjtold: 'roguetrader_bjtold_ali', runes: 'roguetrader_runes', clothes: 'roguetrader_clothes', garments: 'roguetrader_justchanged_garments', obt: 'roguetrader_justobt_runes' },
  members: true,
  difficulty: 'Intermediate',
  start: 'Talk to Ali Morrisane in the Al Kharid market (The Feud done).',
  items: {
    dyes: { name: 'Red dyes (3)', obj: 'reddye', qty: 3, tip: 'For Siamun: Menaphite clothes (or animal pelts for a desert outfit)' },
    cowhides: { name: 'Cowhides (3)', obj: 'cow_hide', qty: 3, tip: 'For Siamun' },
    lockpick: { name: 'Lockpick', obj: 'lockpick', tip: 'To pick the casket locks' },
    coins: { name: 'Coins', obj: 'coins', tip: 'The urchin, carpets and caskets' },
  },
  required: ['dyes', 'cowhides'],
  recommended: ['lockpick', 'coins'],
  skills: ['The Feud, Rune Mysteries and Icthlarin\'s Little Helper completed'],
  steps: {
    start: { text: 'Talk to Ali Morrisane in the Al Kharid market and offer to help with his business.', npc: 'feud_ali_m', at: [3304, 3211, 0] },
    seller: { text: 'Talk to the blackjack seller in Pollnivneach about a new kind of blackjack, then either think of a cunning plan (the urchin) or bet he can\'t knock you out (two Defence rolls).', npc: 'feud_black_jack_seller_multi', at: [3351, 2971, 0], options: ['Hmm... I\'ll have to think of a cunning plan.'] },
    urchin: { text: 'Talk to the street urchin in Pollnivneach and pay him to rob the blackjack seller.', npc: 'feud_street_urchin', at: [3355, 2972, 0] },
    seller2: { text: 'Talk to the blackjack seller again: he agrees to make a new blackjack for Ali.', npc: 'feud_black_jack_seller_multi', at: [3351, 2971, 0] },
    aubury: { text: 'Put Ali\'s business proposal to Aubury in his Varrock rune shop.', npc: 'aubury', at: [3253, 3402, 0], options: ["Actually, I'm here with a business proposal from Ali Morrisane."] },
    siamun: { text: 'Ask Siamun in Sophanem about clothes for Ali, then bring him 3 red dyes and 3 cowhides (or the pelts he asks for).', npc: 'ics_little_linen2', at: [3315, 2786, 0], items: ['dyes', 'cowhides'] },
    caskets: { text: 'Ask Ali about runes and open a small and a large casket: force or pick the small one, or solve either lock (Examine lock): every row, column and box holds each rune once.', npc: 'feud_ali_m', at: [3304, 3211, 0], items: ['lockpick'] },
    ali: { text: 'Tell Ali Morrisane how it went.', npc: 'feud_ali_m', at: [3304, 3211, 0] },
  },
  stages: {
    0: [[null, 'start']],
    1: [
      ['var:bj=^rt_bj_robbed', 'seller2'],
      ['var:bj=^rt_bj_urchin', 'urchin'],
      ['var:bj>=^rt_bj_told & var:bj<^rt_bj_agreed', 'seller'],
      ['var:bj=^rt_bj_agreed & var:bjtold=0', 'ali'],
      ['var:runes=^rt_runes_aubury', 'aubury'],
      ['var:runes=^rt_runes_deal & var:obt=1', 'ali'],
      ['var:runes>=^rt_runes_deal & var:runes<^rt_runes_both', 'caskets'],
      ['var:clothes>=^rt_clothes_told & var:clothes<^rt_clothes_menaphite', 'siamun'],
      [null, 'ali'],
    ],
  },
  sections: [
    { title: 'Ali Morrisane', steps: ['start', 'ali'] },
    { title: 'Blackjacks', steps: ['seller', 'urchin', 'seller2'] },
    { title: 'Runes', steps: ['aubury', 'caskets'], items: ['lockpick'] },
    { title: 'Clothes', steps: ['siamun'], items: ['dyes', 'cowhides'] },
  ],
  rewards: ["Ali's stock: blackjacks, runes and clothes", 'Cheaper carpet rides'],
};
