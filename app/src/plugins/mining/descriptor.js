'use strict';
// Port of RuneLite's Mining plugin for the 2004 game: session stats and respawn timers
// (names, defaults and wording from MiningConfig).
module.exports = {
  id: 'mining',
  name: 'Mining',
  description: 'Show mining statistics and ore respawn timers',
  tags: ['overlay', 'skilling', 'timers', 'mining', 'rocks', 'ore', 'respawn'],
  enabledByDefault: false,
  game: './mining/game.js',
  page: './mining/page.js',
  config: {
    group: 'mining',
    sections: [],
    items: [
      { key: 'statTimeout', name: 'Reset stats', description: 'Duration the mining indicator and session stats are displayed before being reset', type: 'int', default: 5, min: 1, max: 60, unit: 'mins', position: 1 },
      { key: 'showMiningStats', name: 'Show session stats', description: 'Configures whether to display mining session stats', type: 'boolean', default: true, position: 2 },
      { key: 'panelSize', name: 'Panel size', description: 'The size of this plugin\'s panel on the game view, in percent (100 is RuneLite\'s size). Info Boxes > Layout > Panel size sizes every panel at once.', type: 'int', default: 100, min: 50, max: 300, unit: '%', position: 99 },
    ],
  },
};
