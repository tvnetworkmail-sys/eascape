'use strict';
// RuneLite's Special Attack Counter plugin (net.runelite.client.plugins.specialcounter), cloned 1:1 (era-trimmed to the
// 2007 special weapons; no party).
module.exports = {
  id: 'specialcounter',
  name: 'Special Attack Counter',
  description: 'Track special attacks used on NPCs',
  tags: ['combat', 'npcs', 'overlay'],
  enabledByDefault: false,
  game: './specialcounter/game.js',
  page: './specialcounter/page.js',
  config: {
    group: 'specialcounter',
    sections: [],
    items: [
      { key: 'thresholdNotification', name: 'Threshold notifications', description: 'Sends a notification when your special attack counter exceeds the threshold.', type: 'notification', default: false, position: 0 },
      { key: 'specDrops', name: 'Spec drops', description: 'Draws an overlay over the player when a special attack hits.', type: 'boolean', default: true, position: 1 },
      { key: 'specDropMisses', name: 'Spec drop misses', description: 'Draws an overlay over the player when a special attack misses.', type: 'boolean', default: false, position: 1 },
      { key: 'specDropColor', name: 'Spec drop color', description: 'Text color for spec drops.', type: 'color', default: '#FFFFFFFF', position: 2 },
      { key: 'infobox', name: 'Infobox', description: 'Adds an infobox counting special attacks.', type: 'boolean', default: true, position: 3 },
      // (the Dragon warhammer and Elder maul, its only drains in RuneLite, are later than 2007: it never shows here)
      { key: 'defenceDrainInfobox', name: 'Show defence drain infobox', description: 'If infoboxes are enabled, adds a defence drain percentage infobox for Dragon warhammer and Elder maul.', type: 'boolean', default: true, position: 3 },
      { key: 'bandosGodswordThreshold', name: 'Bandos godsword', description: 'Threshold for Bandos godsword (0 to disable).', type: 'int', default: 0, position: 40 },
    ],
  },
};
