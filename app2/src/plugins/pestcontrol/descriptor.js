'use strict';
// RuneLite's Pest Control plugin (net.runelite.client.plugins.pestcontrol), cloned 1:1 (no config).
module.exports = {
  id: 'pestcontrol',
  name: 'Pest Control',
  description: 'Show helpful information for the Pest Control minigame',
  tags: ['minigame', 'overlay'],
  enabledByDefault: true,
  game: './pestcontrol/game.js',
  page: './pestcontrol/page.js',
  config: { group: 'pestcontrol', sections: [], items: [] },
};
