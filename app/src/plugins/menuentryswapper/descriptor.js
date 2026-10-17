'use strict';
// Port of RuneLite's Menu Entry Swapper. Swaps are picked per NPC, object or item from the
// right-click menu (Shift + right-click -> "Swap left click ..."), so the old fixed tick
// boxes (Bank, Trade, Pickpocket, ...) are gone. Wildcard swap and hide lists in the style
// of the "Custom Menu Swaps" Plugin Hub plugin are kept in a closed section for power users.
const helpLines = 'One per line: option, target. Use * as a wildcard, e.g. "pickpocket, man" or "chop down, *tree".';

module.exports = {
  id: 'menuentryswapper',
  name: 'Menu Entry Swapper',
  description: 'Change the default left-click option, and hide right-click options you never use',
  tags: ['menu', 'swap', 'swapper', 'left', 'click', 'npc', 'object', 'item', 'shift', 'drop', 'bank', 'pickpocket', 'trade', 'hide'],
  enabledByDefault: true,
  game: './menuentryswapper/game.js',
  config: {
    group: 'menuentryswapper',
    sections: [
      { key: 'customSection', name: 'Custom Lists', position: 2, closedByDefault: true },
    ],
    items: [
      { key: 'leftClickCustomization', name: 'Customizable left-click', description: 'Hold Shift and right-click an NPC, object or item, then choose "Swap left click" to pick its left-click option', type: 'boolean', default: true, position: 0 },
      { key: 'shiftClickCustomization', name: 'Customizable shift-click', description: 'Hold Shift and right-click an NPC, object or item, then choose "Swap shift click" to pick what Shift + left-click does', type: 'boolean', default: true, position: 1 },
      { section: 'customSection', key: 'customSwaps', name: 'Custom swaps', description: `Make these the left-click option. ${helpLines} The first matching line wins.`, type: 'string', default: '', position: 0 },
      { section: 'customSection', key: 'customShiftSwaps', name: 'Custom shift swaps', description: `Left-click options while Shift is held. ${helpLines}`, type: 'string', default: '', position: 1 },
      { section: 'customSection', key: 'hideOptions', name: 'Hide options', description: `Remove these from the right-click menu. ${helpLines}`, type: 'string', default: '', position: 2 },
    ],
  },
};
