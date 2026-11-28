'use strict';
// RuneLite's Player-owned House plugin (net.runelite.client.plugins.poh), cloned 1:1 and era-trimmed to Sep 2007.
const ICONS = ['exitportal', 'varrock', 'falador', 'lumbridge', 'ardougne', 'yanille', 'camelot', 'kharyll', 'altar', 'glory', 'repair'];
module.exports = {
  id: 'poh',
  name: 'Player-owned House',
  description: 'Show minimap icons and mark unlit/lit burners',
  tags: ['construction', 'poh', 'minimap', 'overlay'],
  // 2006RS-2: off by default: the game this plugin is for isn't in our 2006 game (app2/README.md)
  enabledByDefault: false,
  game: './poh/game.js',
  page: './poh/page.js',
  resources: ICONS.map((i) => i + '.png'),
  config: {
    group: 'poh',
    sections: [],
    items: [
      { key: 'showPortals', name: 'Show portals', description: 'Configures whether to display teleport portals.', type: 'boolean', default: true },
      { key: 'showAltar', name: 'Show altar', description: 'Configures whether or not the altar is displayed.', type: 'boolean', default: true },
      { key: 'showGlory', name: 'Show glory mount', description: 'Configures whether or not the mounted glory is displayed.', type: 'boolean', default: true },
      { key: 'showRepairStand', name: 'Show repair stand', description: 'Configures whether or not the repair stand is displayed.', type: 'boolean', default: true },
      { key: 'showExitPortal', name: 'Show exit portal', description: 'Configures whether or not the exit portal is displayed.', type: 'boolean', default: true },
      { key: 'showBurner', name: 'Show incense burner timers', description: 'Configures whether or not unlit/lit burners are displayed.', type: 'boolean', default: true },
    ],
  },
};
