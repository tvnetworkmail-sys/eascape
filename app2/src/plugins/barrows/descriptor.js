'use strict';
// RuneLite's Barrows Brothers plugin (net.runelite.client.plugins.barrows), cloned 1:1: BarrowsConfig.
// "Show value of chests" is a price: hidden while the prices switch is off.
module.exports = {
  id: 'barrows',
  name: 'Barrows Brothers',
  description: 'Show helpful information for the Barrows minigame',
  tags: ['combat', 'minigame', 'bosses', 'pve', 'pvm'],
  enabledByDefault: true,
  game: './barrows/game.js',
  page: './barrows/page.js',
  config: {
    group: 'barrows',
    sections: [],
    items: [
      { key: 'showBrotherLoc', name: 'Show brothers location', description: 'Configures whether or not the brothers location is displayed.', type: 'boolean', default: true, position: 1 },
      { key: 'showChestValue', name: 'Show value of chests', description: 'Configure whether to show total exchange value of chest when opened.', type: 'boolean', default: true, position: 2, prices: true },
      { key: 'brotherLocColor', name: 'Brother location color', description: 'Change the color of the name displayed on the minimap.', type: 'color', default: '#00FFFF', position: 3 },
      { key: 'deadBrotherLocColor', name: 'Dead brother loc. color', description: 'Change the color of the name displayed on the minimap for a dead brother.', type: 'color', default: '#FF0000', position: 4 },
      { key: 'showPuzzleAnswer', name: 'Show puzzle answer', description: 'Configures if the puzzle answer should be shown.', type: 'boolean', default: true, position: 5 },
      { key: 'showPrayerDrainTimer', name: 'Show prayer drain timer', description: 'Configure whether or not a countdown until the next prayer drain is displayed.', type: 'boolean', default: true, position: 6 },
    ],
  },
};
