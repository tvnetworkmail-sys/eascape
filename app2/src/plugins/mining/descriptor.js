'use strict';
// RuneLite's Mining plugin (net.runelite.client.plugins.mining), cloned 1:1: MiningConfig.
// Trimmed for Sept 2007: no Daeyalt essence, Arceuus dense essence, Motherlode Mine, amethyst or Camdozaal rocks.
module.exports = {
  id: 'mining',
  name: 'Mining',
  description: 'Show mining statistics and ore respawn timers',
  tags: ['overlay', 'skilling', 'timers'],
  enabledByDefault: false,
  game: './mining/game.js',
  page: ['./mining/rocks.js', './mining/page.js'],
  config: {
    group: 'mining',
    sections: [],
    items: [
      { key: 'statTimeout', name: 'Reset stats', description: 'Duration the mining indicator and session stats are displayed before being reset.', type: 'int', default: 5, unit: ' mins', position: 0 },
      { key: 'showMiningStats', name: 'Show session stats', description: 'Configures whether to display mining session stats.', type: 'boolean', default: true, position: 1 },
    ],
  },
};
