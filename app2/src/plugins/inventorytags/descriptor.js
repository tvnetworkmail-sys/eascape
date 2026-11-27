'use strict';
// RuneLite's Inventory Tags plugin (net.runelite.client.plugins.inventorytags), cloned 1:1: InventoryTagsConfig.
module.exports = {
  id: 'inventorytags',
  name: 'Inventory Tags',
  description: 'Add the ability to tag items in your inventory',
  tags: ['highlight', 'items', 'overlay', 'tagging'],
  enabledByDefault: false,
  game: './inventorytags/game.js',
  page: './inventorytags/page.js',
  config: {
    group: 'inventorytags',
    sections: [
      { key: 'tagStyleSection', name: 'Tag display mode', description: 'How tags are displayed in the inventory.', position: 0 },
    ],
    items: [
      { key: 'showTagOutline', name: 'Outline', description: 'Configures whether or not item tags show be outlined.', type: 'boolean', default: true, section: 'tagStyleSection', position: 0 },
      { key: 'tagUnderline', method: 'showTagUnderline', name: 'Underline', description: 'Configures whether or not item tags should be underlined.', type: 'boolean', default: false, section: 'tagStyleSection', position: 1 },
      { key: 'tagFill', method: 'showTagFill', name: 'Fill', description: 'Configures whether or not item tags should be filled.', type: 'boolean', default: false, section: 'tagStyleSection', position: 2 },
      { key: 'fillOpacity', name: 'Fill opacity', description: 'Configures the opacity of the tag fill', type: 'int', default: 50, min: 0, max: 255, section: 'tagStyleSection', position: 3 },
    ],
  },
};
