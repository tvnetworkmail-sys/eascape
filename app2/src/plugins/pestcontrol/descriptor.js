'use strict';
// RuneLite's Pest Control plugin (net.runelite.client.plugins.pestcontrol), cloned 1:1 (no config).
module.exports = {
  id: 'pestcontrol',
  name: 'Pest Control',
  description: 'Show helpful information for the Pest Control minigame',
  tags: ['minigame', 'overlay'],
  // 2006RS-2: off by default: our server hasn't built Pest Control yet (only its scenery is there; app2/README.md)
  enabledByDefault: false,
  game: './pestcontrol/game.js',
  page: './pestcontrol/page.js',
  config: { group: 'pestcontrol', sections: [], items: [] },
};
