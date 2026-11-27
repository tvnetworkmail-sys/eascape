'use strict';
// RuneLite's Fairy Rings plugin (net.runelite.client.plugins.fairyring), cloned 1:1: FairyRingConfig (no items; the
// tags are kept in the "fairyrings.fairyringtags" group by code).
module.exports = {
  id: 'fairyring',
  name: 'Fairy Rings',
  description: 'Show the location of the fairy ring teleport',
  tags: ['teleportation'],
  enabledByDefault: true,
  game: './fairyring/game.js',
  page: './fairyring/page.js',
  config: { group: 'fairyrings', sections: [], items: [] },
};
