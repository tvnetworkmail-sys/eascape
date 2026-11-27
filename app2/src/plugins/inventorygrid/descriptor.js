'use strict';
// RuneLite's Inventory Grid plugin (net.runelite.client.plugins.inventorygrid), cloned 1:1: InventoryGridConfig.
module.exports = {
  id: 'inventorygrid',
  name: 'Inventory Grid',
  description: 'Shows a grid over the inventory and a preview of where items will be dragged',
  tags: ['items', 'overlay'],
  enabledByDefault: false,
  game: './inventorygrid/game.js',
  page: './inventorygrid/page.js',
  config: {
    group: 'inventorygrid',
    sections: [],
    items: [
      { key: 'showItem', name: 'Show item', description: 'Show a preview of the item in the new slot.', type: 'boolean', default: true, position: 6 },
      { key: 'showGrid', name: 'Show grid', description: 'Show a grid on the inventory while dragging.', type: 'boolean', default: true, position: 3 },
      { key: 'showHighlight', name: 'Highlight background', description: 'Show a background highlight on the new slot.', type: 'boolean', default: true, position: 2 },
      { key: 'gridColor', name: 'Grid color', description: 'The color of the grid.', type: 'color', alpha: true, default: '#2DFFFFFF', position: 4 },
      { key: 'highlightColor', name: 'Highlight color', description: 'The color of the new inventory slot highlight.', type: 'color', alpha: true, default: '#2D00FF00', position: 5 },
    ],
  },
};
