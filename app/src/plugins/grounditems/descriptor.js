'use strict';
// Port of RuneLite's Ground Items plugin (GroundItemsConfig), for 2004. No prices or price
// colours: the 2004 game has no way to know what an item is really worth (no Grand Exchange).
// Loot beams and drop notifications come in a later build.
const color = (key, name, description, def, position) => ({ key, name, description, type: 'color', default: def, position });

module.exports = {
  id: 'grounditems',
  name: 'Ground Items',
  description: 'Highlight ground items and/or show their price',
  tags: ['grand', 'exchange', 'high', 'alchemy', 'prices', 'highlight', 'overlay', 'ground', 'items', 'loot', 'drops'],
  enabledByDefault: true,
  game: './grounditems/game.js',
  page: './grounditems/page.js',
  config: {
    group: 'grounditems',
    sections: [
      { key: 'itemLists', name: 'Item Lists', position: 0 },
    ],
    items: [
      { section: 'itemLists', key: 'highlightedItems', name: 'Highlighted items', description: 'Items that are always highlighted. Hold Alt and click an item\'s + box (or its name) to add it. Use * as a wildcard and > or < for amounts, e.g. "Coins > 1000".', type: 'itemlist', default: '', position: 0 },
      { section: 'itemLists', key: 'hiddenItems', name: 'Hidden items', description: 'Items that are hidden. Hold Alt and click an item\'s - box (or right-click its name) to add it.', type: 'itemlist', default: 'Vial, Ashes, Coins, Bones, Bucket, Jug, Seaweed', position: 1 },
      { key: 'showHighlightedOnly', name: 'Show highlighted items only', description: 'Configures whether or not to draw items only on your highlighted list', type: 'boolean', default: false, position: 2 },
      { key: 'showMenuItemQuantities', name: 'Show menu item quantities', description: 'Configures whether or not to show the item quantities in the menu', type: 'boolean', default: true, position: 4 },
      { key: 'recolorMenuHiddenItems', name: 'Recolor menu hidden items', description: 'Configures whether or not hidden items in right-click menu will be recolored', type: 'boolean', default: false, position: 5 },
      { key: 'deprioritizeHiddenItems', name: 'Deprioritize menu hidden items', description: 'Depriotizies the menu options for items which are hidden, requiring a right-click to pick up', type: 'boolean', default: false, position: 6 },
      { key: 'highlightTiles', name: 'Highlight tiles', description: 'Configures whether or not to highlight tiles containing ground items', type: 'boolean', default: false, position: 7 },
      { key: 'itemHighlightMode', name: 'Item highlight mode', description: 'Configures how ground items will be highlighted', type: 'enum', default: 'both', options: [{ value: 'overlay', label: 'Overlay' }, { value: 'menu', label: 'Menu' }, { value: 'both', label: 'Both' }, { value: 'none', label: 'None' }], position: 10 },
      { key: 'menuHighlightMode', name: 'Menu highlight mode', description: 'Configures what to highlight in right-click menu', type: 'enum', default: 'name', options: [{ value: 'option', label: 'Option' }, { value: 'name', label: 'Name' }, { value: 'both', label: 'Both' }], position: 11 },
      color('defaultColor', 'Default items', 'Configures the color for default, non-highlighted items', '#FFFFFF', 14),
      color('highlightedColor', 'Highlighted items', 'Configures the color for highlighted items', '#AA00FF', 15),
      color('hiddenColor', 'Hidden items', 'Configures the color for hidden items in right-click menu and when holding Alt', '#808080', 16),
      { key: 'doubleTapDelay', name: 'Double-tap delay', description: 'Delay for the double-tap Alt to hide ground items. 0 to disable.', type: 'int', default: 250, min: 0, max: 10000, unit: 'ms', position: 26 },
      { key: 'collapseEntries', name: 'Collapse ground item menu', description: 'Collapses ground item menu entries together and appends count', type: 'boolean', default: false, position: 27 },
      { key: 'despawnTimer', name: 'Despawn timer', description: 'Time left before an item disappears, for items you saw dropped (by you or a monster you were near)', type: 'enum', default: 'seconds', options: [{ value: 'off', label: 'Off' }, { value: 'seconds', label: 'Seconds' }, { value: 'ticks', label: 'Ticks' }], position: 29 },
      { key: 'textOutline', name: 'Text outline', description: 'Use an outline around text instead of a text shadow', type: 'boolean', default: false, position: 29 },
      { key: 'hotkey', name: 'Hotkey', description: 'Configures the hotkey used by the Ground Items plugin', type: 'hotkey', default: 'Alt', position: 33 },
    ],
  },
};
