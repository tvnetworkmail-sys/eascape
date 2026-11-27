'use strict';
// RuneLite's Mage Training Arena plugin (net.runelite.client.plugins.mta), cloned 1:1: MTAConfig.
// Mage Training Arena: released 4 Jan 2006. Our server hasn't built it yet; ids are the 2007 cache's (see page.js).
module.exports = {
  id: 'mta',
  name: 'Mage Training Arena',
  description: 'Show helpful information for the Mage Training Arena minigame',
  tags: ['mta', 'magic', 'minigame', 'overlay'],
  enabledByDefault: false,
  game: './mta/game.js',
  page: './mta/page.js',
  resources: ['reset.png'],
  config: {
    group: 'mta',
    sections: [
    ],
    items: [
      { key: 'alchemy', name: 'Enable alchemy room', description: 'Configures whether or not the alchemy room overlay is enabled.', type: 'boolean', default: true, position: 0 },
      { key: 'graveyard', name: 'Enable graveyard room', description: 'Configures whether or not the graveyard room overlay is enabled.', type: 'boolean', default: true, position: 1 },
      { key: 'telekinetic', name: 'Enable telekinetic room', description: 'Configures whether or not the telekinetic room overlay is enabled.', type: 'boolean', default: true, position: 2 },
      { key: 'enchantment', name: 'Enable enchantment room', description: 'Configures whether or not the enchantment room overlay is enabled.', type: 'boolean', default: true, position: 3 },
    ],
  },
};
