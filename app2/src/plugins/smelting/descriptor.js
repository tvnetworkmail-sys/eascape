'use strict';
// RuneLite's Smelting plugin (net.runelite.client.plugins.smelting), cloned 1:1.
module.exports = {
  id: 'smelting',
  name: 'Smelting',
  description: 'Show Smelting stats',
  tags: ['overlay', 'skilling'],
  enabledByDefault: true,
  game: './smelting/game.js',
  page: './smelting/page.js',
  config: {
    group: 'smelting',
    sections: [],
    items: [
      { key: 'statTimeout', name: 'Reset stats', description: 'The time it takes for the current smelting session to be reset.', type: 'int', default: 5, unit: ' mins', position: 1 },
    ],
  },
};
