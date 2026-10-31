'use strict';
// Port of RuneLite's Kingdom of Miscellania plugin (BSD 2-Clause, RuneLite contributors): an
// info box in Miscellania and Etceteria with your approval (favour) as a percentage, and the
// coffer in its tooltip. The server sends both in varps 361 (approval, bits 18-24, out of 127)
// and 362 (coffer, bits 0-26). EASCape: it shows while you're doing Throne of Miscellania too
// (your call, 31 Oct 2026); the coins icon is ours.
module.exports = {
  id: 'kingdom',
  name: 'Kingdom of Miscellania',
  description: 'Show amount of favor when inside Miscellania',
  tags: ['favor', 'favour', 'managing', 'kingdom', 'miscellania', 'approval', 'coffer'],
  enabledByDefault: true,
  game: './kingdom/game.js',
  page: './kingdom/page.js',
  config: {
    group: 'kingdomofmiscellania',
    sections: [],
    items: [
      { key: 'showInfoboxAnywhere', name: 'Show kingdom infobox anywhere', description: 'Show the kingdom infobox everywhere, not just inside Miscellania and Etceteria.', type: 'boolean', default: false, position: 1 },
    ],
  },
};
