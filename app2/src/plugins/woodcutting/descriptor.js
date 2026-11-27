'use strict';
// RuneLite's Woodcutting plugin (net.runelite.client.plugins.woodcutting), cloned 1:1: WoodcuttingConfig.
// Trimmed for Sept 2007: no clue nests (2016), redwoods (2017) or Forestry (2023) and its section.
module.exports = {
  id: 'woodcutting',
  name: 'Woodcutting',
  description: 'Show woodcutting statistics and/or bird nest notifications',
  tags: ['birds', 'nest', 'notifications', 'overlay', 'skilling', 'wc'],
  enabledByDefault: false,
  game: './woodcutting/game.js',
  page: ['./woodcutting/trees.js', './woodcutting/page.js'],
  config: {
    group: 'woodcutting',
    sections: [],
    items: [
      { key: 'statTimeout', name: 'Reset stats', description: 'Configures the time until statistic is reset. Also configures when tree indicator is hidden.', type: 'int', default: 5, unit: ' mins', position: 1 },
      { key: 'showNestNotification', name: 'Bird nest notification', description: 'Configures whether to notify you of a bird nest spawn.', type: 'notification', default: true, position: 2 },
      { key: 'showWoodcuttingStats', name: 'Show session stats', description: 'Configures whether to display woodcutting session stats.', type: 'boolean', default: true, position: 4 },
      { key: 'showRespawnTimers', name: 'Show respawn timers', description: 'Configures whether to display the respawn timer overlay.', type: 'boolean', default: true, position: 6 },
    ],
  },
};
