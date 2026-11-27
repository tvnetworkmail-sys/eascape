'use strict';
// RuneLite's Boss Timers plugin (net.runelite.client.plugins.bosstimer), cloned 1:1 (it has no config).
// Trimmed for Sept 2007: only the bosses of the time (God Wars generals, Chaos Elemental, King Black Dragon,
// Dagannoth Kings, Giant Mole, Kalphite Queen); the boss pets RuneLite shows as icons are 2014+, so each timer has
// one of the boss's 2007 drops as its icon.
module.exports = {
  id: 'bosstimer',
  name: 'Boss Timers',
  description: 'Show boss spawn timer overlays',
  tags: ['combat', 'pve', 'overlay', 'spawn'],
  enabledByDefault: true,
  game: './bosstimer/game.js',
  page: './bosstimer/page.js',
  config: { group: 'bosstimer', sections: [], items: [] },
};
