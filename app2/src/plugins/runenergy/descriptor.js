'use strict';
// RuneLite's Run Energy plugin (net.runelite.client.plugins.runenergy), cloned 1:1 (era-trimmed: no Ring of endurance).
module.exports = {
  id: 'runenergy',
  name: 'Run Energy',
  description: 'Show various information related to run energy',
  tags: ['overlay', 'stamina'],
  enabledByDefault: true,
  game: './runenergy/game.js',
  page: './runenergy/page.js',
  config: {
    group: 'runenergy',
    sections: [],
    items: [
      { key: 'replaceOrbText', name: 'Replace orb text with run time left', description: 'Show the remaining run time (in seconds) next in the energy orb.', type: 'boolean', default: false },
    ],
  },
};
