'use strict';
// RuneLite's Bank Tags plugin (net.runelite.client.plugins.banktags), cloned 1:1: BankTagsConfig (same keys, names,
// defaults; position / tab hidden). Tags, tag tabs and their icons are config keys of group "banktags" as RuneLite
// keeps them (item_<id>, icon_<tag>, tagtabs, hidden_<tag>), so nothing goes to the server.
module.exports = {
  id: 'banktags',
  name: 'Bank Tags',
  description: 'Enable tagging of bank items and searching of bank tags',
  tags: ['searching', 'tagging'],
  enabledByDefault: true,
  game: './banktags/game.js',
  page: './banktags/page.js',
  resources: ['tag-tab.png', 'tag-tab-active.png', 'up-arrow.png', 'down-arrow.png', 'new-tab.png'],
  config: {
    group: 'banktags',
    sections: [],
    items: [
      { key: 'useTabs', name: 'Use tag tabs', description: 'Enable the ability to add tabs to your bank which allow fast access to tags.', type: 'boolean', default: true, position: 1 },
      { key: 'rememberTab', name: 'Remember last tag tab', description: 'Enable the ability to remember last tag tab when closing/opening the bank.', type: 'boolean', default: true, position: 2 },
      { key: 'removeTabSeparators', name: 'Remove tab separators', description: 'Remove the tab separators normally present in tag tabs.', type: 'boolean', default: false, position: 3 },
      { key: 'preventTagTabDrags', name: 'Prevent tag tab item dragging', description: 'Ignore dragged items to prevent unwanted bank item reordering.', type: 'boolean', default: false, position: 4 },
      { key: 'position', name: '', description: '', type: 'int', default: 0, hidden: true },
      { key: 'tab', name: '', description: '', type: 'string', default: '', hidden: true },
    ],
  },
};
