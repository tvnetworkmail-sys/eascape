'use strict';
// Port of RuneLite's bank search: a search button on the bank (in the gap between Insert
// and Item, since the 2004 bank has no button bar), a prompt in the chatbox while you type,
// and the bank title showing what you're searching for.
module.exports = {
  id: 'bank',
  name: 'Bank',
  description: 'Search your bank by item name, and keep placeholders',
  tags: ['bank', 'search', 'find', 'filter', 'items', 'placeholders'],
  enabledByDefault: true,
  game: './bank/game.js',
  config: {
    group: 'bank',
    sections: [],
    items: [
      { key: 'placeholders', name: 'Bank placeholders', description: 'When you take all of an item out of the bank, keep its place with a faded icon ("0") so it goes back there. Right-click a placeholder to release it. EASCape keeps this layout on this PC, per account; the game itself still keeps its own order.', type: 'boolean', default: true, position: 1 },
      { key: 'searchHotkey', name: 'Search hotkey', description: 'Start a bank search from the keyboard while the bank is open', type: 'hotkey', default: 'Ctrl+F', position: 0 },
    ],
  },
};
