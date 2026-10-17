'use strict';
// Port of RuneLite's Woodcutting plugin for the 2004 game: session stats and respawn timers
// (names, defaults and wording from WoodcuttingConfig).
module.exports = {
  id: 'woodcutting',
  name: 'Woodcutting',
  description: 'Show woodcutting statistics',
  tags: ['skilling', 'wc', 'woodcutting', 'trees', 'respawn', 'overlay'],
  enabledByDefault: false,
  game: './woodcutting/game.js',
  page: './woodcutting/page.js',
  config: {
    group: 'woodcutting',
    sections: [],
    items: [
      { key: 'statTimeout', name: 'Reset stats', description: 'Configures the time until statistic is reset. Also configures when tree indicator is hidden', type: 'int', default: 5, min: 1, max: 60, unit: 'mins', position: 1 },
      { key: 'showWoodcuttingStats', name: 'Show session stats', description: 'Configures whether to display woodcutting session stats', type: 'boolean', default: true, position: 3 },
      { key: 'showRespawnTimers', name: 'Show respawn timers', description: 'Configures whether to display the respawn timer overlay', type: 'boolean', default: true, position: 5 },
      { key: 'panelSize', name: 'Panel size', description: 'The size of this plugin\'s panel on the game view, in percent (100 is RuneLite\'s size). Info Boxes > Layout > Panel size sizes every panel at once.', type: 'int', default: 100, min: 50, max: 300, unit: '%', position: 99 },
    ],
  },
};
