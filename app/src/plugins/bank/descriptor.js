'use strict';
// Port of RuneLite's bank search: a search button on the bank (bottom right, with EASCape's
// Deposit inventory button beside it), a prompt in the chatbox while you type,
// and the bank title showing what you're searching for.
module.exports = {
  id: 'bank',
  name: 'Bank',
  description: 'Search your bank by item name and deposit your whole inventory',
  tags: ['bank', 'search', 'find', 'filter', 'items'],
  enabledByDefault: true,
  game: './bank/game.js',
  config: {
    group: 'bank',
    sections: [],
    items: [
      { key: 'searchHotkey', name: 'Search hotkey', description: 'Start a bank search from the keyboard while the bank is open', type: 'hotkey', default: 'Ctrl+F', position: 0 },
    ],
  },
};
