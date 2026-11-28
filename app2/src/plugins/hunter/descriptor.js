'use strict';
// RuneLite's Hunter plugin (net.runelite.client.plugins.hunter), cloned 1:1: HunterConfig.
// Trimmed for Sept 2007 (Hunter, 27 Nov 2006): no Maniacal monkey notification (Ape Atoll monkey traps, 2014).
module.exports = {
  id: 'hunter',
  name: 'Hunter',
  description: 'Show the state of your traps',
  tags: ['overlay', 'skilling', 'timers'],
  // 2006RS-2: off by default: the game this plugin is for isn't in our 2006 game (app2/README.md)
  enabledByDefault: false,
  game: './hunter/game.js',
  page: './hunter/page.js',
  config: {
    group: 'hunterplugin',
    sections: [],
    items: [
      { key: 'hexColorOpenTrap', method: 'getOpenTrapColor', name: 'Open trap', description: 'Color of open trap timer.', type: 'color', alpha: true, default: '#FFFFFF00', position: 1 },
      { key: 'hexColorFullTrap', method: 'getFullTrapColor', name: 'Full trap', description: 'Color of full trap timer.', type: 'color', alpha: true, default: '#FF00FF00', position: 2 },
      { key: 'hexColorEmptyTrap', method: 'getEmptyTrapColor', name: 'Empty trap', description: 'Color of empty trap timer.', type: 'color', alpha: true, default: '#FFFF0000', position: 3 },
      { key: 'hexColorTransTrap', method: 'getTransTrapColor', name: 'Transitioning trap', description: 'Color of transitioning trap timer.', type: 'color', alpha: true, default: '#FFFFC800', position: 4 },
    ],
  },
};
