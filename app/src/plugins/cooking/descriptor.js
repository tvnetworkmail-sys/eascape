'use strict';
// Port of RuneLite's Cooking plugin (BSD 2-Clause, Copyright (c) 2018, Seth and Adam, and
// RuneLite contributors) for the 2004 game: the session panel (names, defaults and wording
// from CookingConfig) and the wine ferment timer as an info box.
module.exports = {
  id: 'cooking',
  name: 'Cooking',
  description: 'Show cooking statistics',
  tags: ['overlay', 'skilling', 'cook', 'cooking', 'wine', 'ferment'],
  enabledByDefault: true,
  game: './cooking/game.js',
  page: './cooking/page.js',
  // also listed in the Info Boxes sidebar tab
  infoboxes: ['fermentTimer'],
  config: {
    group: 'cooking',
    sections: [],
    items: [
      { key: 'statTimeout', name: 'Reset stats', description: 'Configures the time until the session resets and the overlay is hidden (0 = disable feature).', type: 'int', default: 5, min: 0, max: 60, unit: 'mins', position: 1 },
      { key: 'fermentTimer', name: 'Show wine ferment timer', description: 'Configures if the timer before wines are fermented is shown.', type: 'boolean', default: true, position: 2 },
      { key: 'panelSize', name: 'Panel size', description: 'The size of this plugin\'s panel on the game view, in percent (100 is RuneLite\'s size). Info Boxes > Layout > Panel size sizes every panel at once.', type: 'int', default: 100, min: 50, max: 300, unit: '%', position: 99 },
    ],
  },
};
