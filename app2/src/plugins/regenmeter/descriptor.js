'use strict';
// RuneLite's Regeneration Meter plugin (net.runelite.client.plugins.regenmeter), cloned 1:1.
module.exports = {
  id: 'regenmeter',
  name: 'Regeneration Meter',
  description: 'Track and show the hitpoints and special attack regeneration timers',
  tags: ['combat', 'health', 'hitpoints', 'special', 'attack', 'overlay', 'notifications'],
  enabledByDefault: true,
  game: './regenmeter/game.js',
  page: './regenmeter/page.js',
  config: {
    group: 'regenmeter',
    sections: [],
    items: [
      { key: 'showHitpoints', name: 'Show hitpoints regen', description: 'Show a ring around the hitpoints orb.', type: 'boolean', default: true, position: 1 },
      { key: 'showSpecial', name: 'Show spec. attack regen', description: 'Show a ring around the special attack orb.', type: 'boolean', default: true, position: 2 },
      { key: 'showWhenNoChange', name: 'Show at full hitpoints', description: 'Always show the hitpoints regen orb, even if there will be no stat change.', type: 'boolean', default: false, position: 3 },
      { key: 'notifyBeforeHpRegenDuration', name: 'Hitpoint notification', description: 'Notify approximately when your next hitpoint is about to regen. A value of 0 will disable notification.', type: 'int', default: 0, unit: 's', position: 4 },
    ],
  },
};
