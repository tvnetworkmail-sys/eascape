'use strict';
// RuneLite's Bank plugin (net.runelite.client.plugins.bank), cloned 1:1: BankConfig. The value options (GE / HA /
// exact bank value) are price settings, hidden while prices are off (rl.prices.enabled()). Left out (not in the 2007
// bank or later): the Deposit worn items, Empty containers and placeholder buttons, the seed vault (2018), the Jagex
// account popup, and Keyboard bankpin (our server has no PIN entry keypad). The search keybind is RuneLite's default.
// 2007RS's own: Bank placeholders, kept with the account on the server and drawn only by the app (AppBank).
// 2006RS-2: off by default: our server has no AppBank, and keeping placeholders would mean a new field in the player
// save, which stays at version 7 with no new fields (app2/README.md).
const P = (o) => Object.assign(o, { prices: true });
module.exports = {
  id: 'bank',
  name: 'Bank',
  description: 'Modifications to the banking interface',
  tags: ['grand', 'exchange', 'high', 'alchemy', 'prices', 'deposit', 'pin'],
  enabledByDefault: true,
  game: './bank/game.js',
  page: './bank/page.js',
  config: {
    group: 'bank',
    sections: [],
    items: [
      P({ key: 'showGE', name: 'Show Grand Exchange price', description: 'Show Grand Exchange price total (GE).', type: 'boolean', default: true, position: 1 }),
      P({ key: 'showHA', name: 'Show high alchemy price', description: 'Show high alchemy price total (HA).', type: 'boolean', default: false, position: 2 }),
      P({ key: 'showExact', name: 'Show exact bank value', description: 'Show exact bank value.', type: 'boolean', default: false, position: 3 }),
      { key: 'rightClickBankInventory', name: 'Disable left-click bank inventory', description: 'Configures whether the bank inventory button will bank your inventory on left-click.', type: 'boolean', default: false, position: 4 },
      { key: 'placeholders', name: 'Bank placeholders', description: "Withdrawing all of an item keeps its spot in the bank (greyed, 0), and banking it again puts it back there. Kept with your account; only the app shows them. Right-click a spot to release it. (Not on 2006RS: its server would have to keep them with your save, which doesn't change, so this does nothing there.)", type: 'boolean', default: false, position: 5 },
      { key: 'searchKeybind', name: 'Search shortcut', description: 'Keyboard shortcut for initiating a bank or seed vault search.', type: 'hotkey', default: 'Ctrl+F', position: 10 },
    ],
  },
};
