'use strict';
// RuneLite's Virtual Levels plugin (net.runelite.client.plugins.virtuallevels), cloned 1:1.
module.exports = {
  id: 'virtuallevels',
  name: 'Virtual Levels',
  description: 'Shows virtual levels (beyond 99) and virtual skill total on the skills tab.',
  tags: ['skill', 'total', 'max'],
  enabledByDefault: false,
  game: './virtuallevels/game.js',
  page: './virtuallevels/page.js',
  config: {
    group: 'virtuallevels',
    sections: [],
    items: [
      { key: 'virtualTotalLevel', name: 'Virtual total level', description: 'Count virtual levels towards total level.', type: 'boolean', default: true, position: 0 },
    ],
  },
};
