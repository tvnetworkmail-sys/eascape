'use strict';
// Port of RuneLite's Barrows Brothers plugin (runelite-client/.../plugins/barrows). The
// drawing is built into the EASCape client (Client.ts, "Barrows plugin"); this sends it the
// settings. Same settings, names, order and defaults as RuneLite's BarrowsConfig, less "Show
// value of chests" (no item prices). EASCape also shows the panel above ground at Barrows.
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
      { key: 'brotherLocColor', name: 'Brother location color', description: 'Change the color of the name displayed on the minimap.', type: 'color', default: '#00FFFF', position: 3 },
      { key: 'deadBrotherLocColor', name: 'Dead brother loc. color', description: 'Change the color of the name displayed on the minimap for a dead brother.', type: 'color', default: '#FF0000', position: 4 },
      { key: 'showPuzzleAnswer', name: 'Show puzzle answer', description: 'Configures if the puzzle answer should be shown.', type: 'boolean', default: true, position: 5 },
      { key: 'showPrayerDrainTimer', name: 'Show prayer drain timer', description: 'Configure whether or not a countdown until the next prayer drain is displayed.', type: 'boolean', default: true, position: 6 },
    ],
  },
};
