'use strict';
// RuneLite's Cooking plugin (net.runelite.client.plugins.cooking), cloned 1:1: CookingConfig.
module.exports = {
  id: 'cooking',
  name: 'Cooking',
  description: 'Show cooking statistics',
  tags: ['overlay', 'skilling', 'cook'],
  game: './cooking/game.js',
  page: './cooking/page.js',
  config: {
    group: 'cooking',
    sections: [],
    items: [
      { key: 'statTimeout', name: 'Reset stats', description: 'Configures the time until the session resets and the overlay is hidden (0 = disable feature).', type: 'int', default: 5, unit: ' mins', position: 1 },
      { key: 'fermentTimer', name: 'Show wine ferment timer', description: 'Configures if the timer before wines are fermented is shown.', type: 'boolean', default: true, position: 2 },
    ],
  },
};
