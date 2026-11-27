'use strict';
// RuneLite's Inventory Viewer plugin (net.runelite.client.plugins.inventoryviewer), cloned 1:1: InventoryViewerConfig.
module.exports = {
  id: 'inventoryviewer',
  name: 'Inventory Viewer',
  description: 'Add an overlay showing the contents of your inventory',
  tags: ['alternate', 'items', 'overlay', 'second'],
  enabledByDefault: false,
  game: './inventoryviewer/game.js',
  page: './inventoryviewer/page.js',
  config: {
    group: 'inventoryViewer',
    sections: [],
    items: [
      { key: 'toggleKeybind', name: 'Toggle overlay', description: 'Binds a key (combination) to toggle the overlay.', type: 'keybind', default: '', position: 0 },
      { key: 'hiddenDefault', name: 'Hidden by default', description: 'Whether or not the overlay is hidden by default.', type: 'boolean', default: false, position: 1 },
      { key: 'hideIfInventoryActive', name: 'Hidden on inventory tab', description: 'Whether or not the overlay is hidden when the inventory tab is open.', type: 'boolean', default: false, position: 2 },
    ],
  },
};
