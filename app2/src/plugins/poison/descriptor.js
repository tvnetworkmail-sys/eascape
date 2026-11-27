'use strict';
// RuneLite's Poison plugin (net.runelite.client.plugins.poison), cloned. Era-trim: poison only (venom is 2014).
module.exports = {
  id: 'poison',
  name: 'Poison',
  description: 'Tracks current damage values for Poison and Venom',
  tags: ['combat', 'poison', 'venom', 'heart', 'hp'],
  enabledByDefault: true,
  game: './poison/game.js',
  page: './poison/page.js',
  config: {
    group: 'poison',
    sections: [],
    items: [
      { key: 'showInfoboxes', name: 'Show infoboxes', description: 'Configures whether to show the infoboxes.', type: 'boolean', default: false, position: 0 },
      { key: 'changeHealthIcon', name: 'Change HP orb icon', description: 'Configures whether the HP orb icon should change color to match poison/disease.', type: 'boolean', default: true, position: 1 },
    ],
  },
};
