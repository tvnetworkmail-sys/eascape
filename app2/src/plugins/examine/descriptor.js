'use strict';
// RuneLite's Examine plugin (net.runelite.client.plugins.examine), cloned 1:1 (it has no config).
// No prices or values: its only output is the GE average / HA value line, which stays off while rl.prices is off.
module.exports = {
  id: 'examine',
  name: 'Examine',
  description: 'Shows additional examine information (eg. GE Average, HA Value)',
  tags: ['npcs', 'items', 'inventory', 'objects', 'prices', 'high alchemy'],
  enabledByDefault: true,
  game: './examine/game.js',
  page: './examine/page.js',
  config: { group: 'examine', sections: [], items: [] },
};
