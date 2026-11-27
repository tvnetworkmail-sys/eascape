'use strict';
// RuneLite's Item Stats plugin (net.runelite.client.plugins.itemstats), cloned 1:1: ItemStatConfig.
// Era-trim (22 Sep 2007): no "Enable GE item information" (the Grand Exchange opened 26 Nov 2007).
module.exports = {
  id: 'itemstats',
  name: 'Item Stats',
  description: 'Show information about food and potion effects',
  tags: ['food', 'inventory', 'overlay', 'potion'],
  enabledByDefault: true,
  game: './itemstats/game.js',
  page: ['./itemstats/changes.js', './itemstats/page.js'],
  config: {
    group: 'itemstat',
    sections: [
    ],
    items: [
      { key: 'consumableStats', name: 'Enable consumable stats', description: 'Enables tooltips for consumable items (food, boosts).', type: 'boolean', default: true, position: -1 },
      { key: 'equipmentStats', name: 'Enable equipment stats', description: 'Enables tooltips for equipment items (combat bonuses, weight, prayer bonuses).', type: 'boolean', default: true, position: -1 },
      { key: 'relative', name: 'Show relative', description: 'Show relative stat change in tooltip.', type: 'boolean', default: true, position: -1 },
      { key: 'absolute', name: 'Show absolute', description: 'Show absolute stat change in tooltip.', type: 'boolean', default: true, position: -1 },
      { key: 'theoretical', name: 'Show theoretical', description: 'Show theoretical stat change in tooltip.', type: 'boolean', default: false, position: -1 },
      { key: 'showWeight', name: 'Show weight', description: 'Show weight in tooltip.', type: 'boolean', default: true, position: -1 },
      { key: 'showStatsInBank', name: 'Show stats in bank', description: 'Show item stats on bank items tooltip.', type: 'boolean', default: true, position: -1 },
      { key: 'alwaysShowBaseStats', name: 'Always show base stats', description: 'Always include the base items stats in the tooltip.', type: 'boolean', default: false, position: -1 },
      { key: 'colorBetterUncapped', name: 'Better (uncapped)', description: 'Color to show when the stat change is fully consumed.', type: 'color', default: '#33EE33', position: 10 },
      { key: 'colorBetterSomecapped', method: 'colorBetterSomeCapped', name: 'Better (some capped)', description: 'Color to show when some stat changes are capped, but some are not.', type: 'color', default: '#9CEE33', position: 11 },
      { key: 'colorBetterCapped', name: 'Better (capped)', description: 'Color to show when the stat change is positive, but not fully consumed.', type: 'color', default: '#EEEE33', position: 12 },
      { key: 'colorNoChange', name: 'No change', description: 'Color to show when there is no change.', type: 'color', default: '#EEEEEE', position: 13 },
      { key: 'colorWorse', name: 'Worse', description: 'Color to show when the stat goes down.', type: 'color', default: '#EE3333', position: 14 },
    ],
  },
};
