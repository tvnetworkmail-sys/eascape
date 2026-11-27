'use strict';
// RuneLite's Ammo plugin (net.runelite.client.plugins.ammo), cloned 1:1 (it has no config).
module.exports = {
  id: 'ammo',
  name: 'Ammo',
  description: 'Shows the current ammo the player has equipped',
  tags: ['bolts', 'darts', 'chinchompa', 'equipment'],
  enabledByDefault: false,
  game: './ammo/game.js',
  page: './ammo/page.js',
  config: { group: 'ammo', sections: [], items: [] },
};
