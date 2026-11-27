'use strict';
// RuneLite's Ground Items plugin (net.runelite.client.plugins.grounditems), cloned 1:1: GroundItemsConfig.
// 2007RS: every price and value item (prices: true) shows only with the core's price switch (runelite.showPrices, off
// until the game has a market); while it is off there are no value labels, tiers or value hiding. Lootbeams (hidden)
// need RuneLite's 3D scene objects (RuneLiteObject), which the 2007 client hook doesn't have.
const TIER = [{ value: 'OFF', label: 'OFF' }, { value: 'LOW', label: 'LOW' }, { value: 'MEDIUM', label: 'MEDIUM' }, { value: 'HIGH', label: 'HIGH' }, { value: 'INSANE', label: 'INSANE' }];
const C = (key, name, description, def, position) => ({ key, name, description, type: 'color', alpha: true, default: def, position });
const P = (o) => Object.assign(o, { prices: true });
module.exports = {
  id: 'grounditems',
  name: 'Ground Items',
  description: 'Highlight ground items and/or show price information',
  tags: ['grand', 'exchange', 'high', 'alchemy', 'prices', 'highlight', 'overlay', 'lootbeam'],
  enabledByDefault: true,
  game: './grounditems/game.js',
  page: './grounditems/page.js',
  config: {
    group: 'grounditems',
    sections: [{ key: 'itemLists', name: 'Item lists', description: 'The highlighted and hidden item lists.', position: 0 }],
    items: [
      { key: 'highlightedItems', method: 'getHighlightItems', name: 'Highlighted items', description: 'Configures specifically highlighted ground items. Format: item1, item2, item3', type: 'string', default: '', position: 0, section: 'itemLists' },
      { key: 'hiddenItems', method: 'getHiddenItems', name: 'Hidden items', description: 'Configures hidden ground items. Format: item1, item2, item3', type: 'string', default: 'Vial, Ashes, Coins, Bones, Bucket, Jug, Seaweed', position: 1, section: 'itemLists' },
      { key: 'showHighlightedOnly', name: 'Show highlighted items only', description: 'Configures whether or not to draw items only on your highlighted list.', type: 'boolean', default: false, position: 2 },
      { key: 'dontHideUntradeables', name: 'Do not hide untradeables', description: 'Configures whether or not untradeable items ignore hiding under settings.', type: 'boolean', default: true, position: 3 },
      { key: 'showMenuItemQuantities', name: 'Show menu item quantities', description: 'Configures whether or not to show the item quantities in the menu.', type: 'boolean', default: true, position: 4 },
      { key: 'recolorMenuHiddenItems', name: 'Recolor menu hidden items', description: 'Configures whether or not hidden items in right-click menu will be recolored.', type: 'boolean', default: false, position: 5 },
      { key: 'deprioritizeHiddenItems', name: 'Deprioritize menu hidden items', description: 'Depriotizies the menu options for items which are hidden, requiring a right-click to pick up.', type: 'boolean', default: false, position: 5 },
      { key: 'highlightTiles', name: 'Highlight tiles', description: 'Configures whether or not to highlight tiles containing ground items.', type: 'boolean', default: false, position: 6 },
      { key: 'notifyHighlightedDrops', name: 'Notify for highlighted drops', description: 'Configures whether or not to notify for drops on your highlighted list.', type: 'boolean', default: false, position: 7 },
      P({ key: 'notifyTier', name: 'Notify tier', description: 'Configures which price tiers will trigger a notification on drop.', type: 'enum', default: 'OFF', options: TIER, position: 8 }),
      P({ key: 'priceDisplayMode', name: 'Price display mode', description: 'Configures which price types are shown alongside ground item name.', type: 'enum', default: 'BOTH', options: [{ value: 'HA', label: 'High Alchemy' }, { value: 'GE', label: 'Grand Exchange' }, { value: 'BOTH', label: 'Both' }, { value: 'OFF', label: 'Off' }], position: 9 }),
      { key: 'itemHighlightMode', name: 'Item highlight mode', description: 'Configures how ground items will be highlighted.', type: 'enum', default: 'BOTH', options: [{ value: 'NONE', label: 'None' }, { value: 'OVERLAY', label: 'Overlay' }, { value: 'MENU', label: 'Right-click menu' }, { value: 'BOTH', label: 'Both' }], position: 10 },
      { key: 'menuHighlightMode', name: 'Menu highlight mode', description: 'Configures what to highlight in right-click menu.', type: 'enum', default: 'NAME', options: [{ value: 'OPTION', label: 'Menu option' }, { value: 'NAME', label: 'Menu item name' }, { value: 'BOTH', label: 'Both' }], position: 11 },
      P({ key: 'highlightValueCalculation', method: 'valueCalculationMode', name: 'Highlight value calculation', description: 'Configures which coin value is used to determine highlight color.', type: 'enum', default: 'HIGHEST', options: [{ value: 'HA', label: 'High Alchemy' }, { value: 'GE', label: 'Grand Exchange' }, { value: 'HIGHEST', label: 'Highest' }], position: 12 }),
      P({ key: 'hideUnderValue', method: 'getHideUnderValue', name: 'Hide under value', description: 'Configures hidden ground items under both GE and HA value.', type: 'int', default: 0, position: 13 }),
      C('defaultColor', 'Default items', 'Configures the color for default, non-highlighted items.', '#FFFFFF', 14),
      C('highlightedColor', 'Highlighted items', 'Configures the color for highlighted items.', '#AA00FF', 15),
      C('hiddenColor', 'Hidden items', 'Configures the color for hidden items in right-click menu and when holding ALT.', '#808080', 16),
      P(C('lowValueColor', 'Low value items', 'Configures the color for low value items.', '#66B2FF', 17)),
      P({ key: 'lowValuePrice', name: 'Low value price', description: 'Configures the start price for low value items.', type: 'int', default: 20000, position: 18 }),
      P(C('mediumValueColor', 'Medium value items', 'Configures the color for medium value items.', '#99FF99', 19)),
      P({ key: 'mediumValuePrice', name: 'Medium value price', description: 'Configures the start price for medium value items.', type: 'int', default: 100000, position: 20 }),
      P(C('highValueColor', 'High value items', 'Configures the color for high value items.', '#FF9600', 21)),
      P({ key: 'highValuePrice', name: 'High value price', description: 'Configures the start price for high value items.', type: 'int', default: 1000000, position: 22 }),
      P(C('insaneValueColor', 'Insane value items', 'Configures the color for insane value items.', '#FF66B2', 23)),
      P({ key: 'insaneValuePrice', name: 'Insane value price', description: 'Configures the start price for insane value items.', type: 'int', default: 10000000, position: 24 }),
      { key: 'ownershipFilterMode', name: 'Ownership filter', description: "Show all items, takeable items, or only your or your group's drops.", type: 'enum', default: 'ALL', options: [{ value: 'ALL', label: 'All' }, { value: 'TAKEABLE', label: 'Takeable' }, { value: 'DROPS', label: 'Drops' }], position: 25 },
      { key: 'doubleTapDelay', name: 'Double-tap delay', description: 'Delay for the double-tap ALT to hide ground items. 0 to disable.', type: 'int', default: 250, units: 'ms', position: 26 },
      { key: 'collapseEntries', name: 'Collapse ground item menu', description: 'Collapses ground item menu entries together and appends count.', type: 'boolean', default: false, position: 27 },
      { key: 'groundItemTimers', name: 'Despawn timer', description: "Shows despawn timers for items you've dropped and received as loot.", type: 'enum', default: 'OFF', options: [{ value: 'OFF', label: 'OFF' }, { value: 'PIE', label: 'PIE' }, { value: 'TICKS', label: 'TICKS' }, { value: 'SECONDS', label: 'SECONDS' }], position: 28 },
      { key: 'textOutline', name: 'Text outline', description: 'Use an outline around text instead of a text shadow.', type: 'boolean', default: false, position: 29 },
      { key: 'showLootbeamForHighlighted', hidden: true, name: 'Highlighted item lootbeams', description: 'Configures lootbeams to show for all highlighted items.', type: 'boolean', default: false, position: 30 },
      P({ key: 'showLootbeamTier', hidden: true, name: 'Lootbeam tier', description: 'Configures which price tiers will trigger a lootbeam.', type: 'enum', default: 'HIGH', options: TIER, position: 31 }),
      { key: 'lootbeamStyle', hidden: true, name: 'Lootbeam style', description: 'Style of lootbeam to use.', type: 'enum', default: 'MODERN', options: [{ value: 'LIGHT', label: 'LIGHT' }, { value: 'MODERN', label: 'MODERN' }], position: 32 },
      { key: 'hotkey', name: 'Hotkey', description: 'Configures the hotkey used by the Ground Items plugin.', type: 'hotkey', default: 'Alt', position: 33 },
    ],
  },
};
