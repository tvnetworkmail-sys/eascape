'use strict';
// Status orbs by the minimap: hitpoints, prayer, run energy and special attack, plus a world
// map button. LostLite's own take on the minimap orbs (drawn here, with the 2004 game's own
// icons), for the 2004 interface. Clicking presses the game's own buttons.
module.exports = {
  id: 'orbs',
  name: 'Status Orbs',
  description: 'Hitpoints, prayer, run energy and special attack orbs by the minimap, and a world map button',
  tags: ['orbs', 'minimap', 'hitpoints', 'prayer', 'run', 'energy', 'special', 'attack', 'world', 'map'],
  enabledByDefault: true,
  game: './orbs/game.js',
  config: {
    group: 'orbs',
    sections: [],
    items: [
      { key: 'showHitpoints', name: 'Hitpoints orb', description: 'Show your hitpoints', type: 'boolean', default: true, position: 0 },
      { key: 'showPrayer', name: 'Prayer orb', description: 'Show your prayer points. Click it to open the prayer tab.', type: 'boolean', default: true, position: 1 },
      { key: 'showRun', name: 'Run energy orb', description: 'Show your run energy. Click it to switch between walking and running.', type: 'boolean', default: true, position: 2 },
      { key: 'showSpecial', name: 'Special attack orb', description: 'Show your special attack energy. Click it to use your weapon\'s special attack, when it has one.', type: 'boolean', default: true, position: 3 },
      { key: 'showWorldMap', name: 'World map button', description: 'Show the world map button by the minimap', type: 'boolean', default: true, position: 4 },
    ],
  },
};
