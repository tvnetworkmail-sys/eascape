'use strict';
// RuneLite's Menu Entry Swapper plugin (net.runelite.client.plugins.menuentryswapper), cloned 1:1: MenuEntrySwapperConfig,
// trimmed to Sept 2007 (no GE, POH portal modes, fairy ring ops, jewellery box, portal nexus, diaries' items, Tele to POH,
// Tempoross, birdhouses, the Mage of Zamorak's Teleport (no such op in the 2007 cache), Withdraw-All-But-1, placeholders,
// Buy / Sell 50, worn item and UI swaps). The option-name swaps RuneLite keeps for content this era has, or whose ops
// appear on our server, are back: Admire, Assignment, Chase, Clean (herbs), Exchange (the Tool Leprechaun's op in the
// 2007 cache, not the GE), Quick, box trap Reset and Tan (the 2007 tanner's "Tan 1" / "Tan all" buttons). Era-trimmed:
// Pick and Private (Chambers of Xeric, 2017), Help (Arceuus library, 2016) and Deposit items (no 2007 NPC has the op).
const e = (...names) => names.map((n) => ({ value: n, label: n }));
const b = (key, name, description, section, def, extra) => Object.assign({ key, name, description, type: 'boolean', default: def, position: -1, section }, extra);
module.exports = {
  id: 'menuentryswapper',
  name: 'Menu Entry Swapper',
  description: 'Change the default option that is displayed when hovering over objects',
  tags: ['npcs', 'inventory', 'items', 'objects'],
  enabledByDefault: false,
  game: './menuentryswapper/game.js',
  page: './menuentryswapper/page.js',
  config: {
    group: 'menuentryswapper',
    sections: [
      { key: 'items', name: 'Item swaps', description: 'All options that swap item menu entries.', position: 0, closedByDefault: true },
      { key: 'npcs', name: 'NPC swaps', description: 'All options that swap NPC menu entries.', position: 1, closedByDefault: true },
      { key: 'objects', name: 'Object swaps', description: 'All options that swap object menu entries.', position: 2, closedByDefault: true },
      { key: 'ui', name: 'UI swaps', description: 'All options that swap entries in the UI (except items).', position: 3, closedByDefault: true },
      { key: 'groundItems', name: 'Ground item swaps', description: 'All options that swap ground item menu entries.', position: 4, closedByDefault: true },
    ],
    items: [
      b('leftClickCustomization', 'Customizable left-click', 'Allows customization of left-clicks on items.', 'items', true, { position: -3 }),
      b('shiftClickCustomization', 'Customizable shift-click', 'Allows customization of shift-clicks on items.', 'items', true, { position: -2 }),
      b('objectLeftClickCustomization', 'Customizable left- and shift-click', 'Allows customization of left-clicks on objects.', 'objects', true, { method: 'objectCustomization', position: -2 }),
      b('objectShiftClickWalkHere', 'Shift-click Walk here', 'Swaps Walk here on shift-click on all objects.', 'objects', false, { position: -2 }),
      b('npcLeftClickCustomization', 'Customizable left- and shift-click', 'Allows customization of left-clicks on NPCs.', 'npcs', true, { method: 'npcCustomization', position: -3 }),
      b('npcShiftClickWalkHere', 'Shift-click Walk here', 'Swaps Walk here on shift-click on all NPCs.', 'npcs', false, { position: -2 }),
      b('swapAdmire', 'Admire', 'Swap Admire with Teleport, Spellbook and Perks (max cape) for mounted skill capes.', 'objects', true),
      b('swapAssignment', 'Assignment', 'Swap Talk-to with Assignment for slayer masters. This will take priority over swapping Trade.', 'npcs', true),
      b('swapBanker', 'Bank', 'Swap Talk-to with Bank.', 'npcs', true, { method: 'swapBank' }),
      b('swapBones', 'Bury', 'Swap Bury with Use on bones.', 'items', false),
      b('swapHerbs', 'Clean', 'Swap Clean with Use on herbs.', 'items', false),
      b('swapChase', 'Chase', 'Allows to left-click your cat to Chase.', 'npcs', true),
      b('swapExchange', 'Exchange', 'Swap Talk-to with Exchange.', 'npcs', true),
      b('swapHarpoon', 'Harpoon', 'Swap Cage and N with Harpoon on fishing spots.', 'objects', false),
      b('swapBait', 'Bait', 'Swap Lure and Net with Bait on fishing spots.', 'objects', false),
      b('swapPay', 'Pay', 'Swap Talk-to with Pay.', 'npcs', true),
      b('swapQuick', 'Quick pass/open/start/travel', 'Swap Pass with Quick-pass, Open with Quick-open, Ring with Quick-start and Talk-to with Quick-travel.', 'objects', true),
      b('swapBoxTrap', 'Reset', 'Swap Check with Reset on box trap.', 'objects', true),
      b('swapTeleportItem', 'Teleport item', 'Swap Wear and Wield with Rub, Teleport, and Invoke.', 'items', false),
      b('swapTrade', 'Trade', 'Swap Talk-to with Trade.', 'npcs', true),
      b('swapTravel', 'Travel', 'Swap Talk-to with Travel, Take-boat, Pay-fare, Charter, etc.', 'npcs', true),
      { key: 'bankWithdrawShiftClick', name: 'Bank withdraw shift-click', description: 'Swaps the behavior of shift-click when withdrawing from bank.', type: 'enum', default: 'OFF', options: [{ value: 'WITHDRAW_1', label: 'Withdraw-1' }, { value: 'WITHDRAW_5', label: 'Withdraw-5' }, { value: 'WITHDRAW_10', label: 'Withdraw-10' }, { value: 'WITHDRAW_X', label: 'Withdraw-X' }, { value: 'WITHDRAW_ALL', label: 'Withdraw-All' }, { value: 'OFF', label: 'Off' }], position: -1, section: 'ui' },
      { key: 'bankDepositShiftClick', name: 'Bank deposit shift-click', description: 'Swaps the behavior of shift-click when depositing to bank.', type: 'enum', default: 'OFF', options: [{ value: 'DEPOSIT_1', label: 'Deposit-1' }, { value: 'DEPOSIT_5', label: 'Deposit-5' }, { value: 'DEPOSIT_10', label: 'Deposit-10' }, { value: 'DEPOSIT_X', label: 'Deposit-X' }, { value: 'DEPOSIT_ALL', label: 'Deposit-All' }, { value: 'OFF', label: 'Off' }], position: -1, section: 'ui' },
      { key: 'shopBuy', name: 'Shop buy shift-click', description: 'Swaps the Buy options with Value on items in shops when shift is held.', type: 'enum', default: 'OFF', options: e('OFF', 'BUY_1', 'BUY_5', 'BUY_10'), position: -1, section: 'ui' },
      { key: 'shopSell', name: 'Shop sell shift-click', description: 'Swaps the Sell options with Value on items in your inventory when selling to shops when shift is held.', type: 'enum', default: 'OFF', options: e('OFF', 'SELL_1', 'SELL_5', 'SELL_10'), position: -1, section: 'ui' },
      b('swapEssenceMineTeleport', 'Essence mine teleport', 'Swaps Talk-to with Teleport for NPCs which teleport you to the essence mine.', 'npcs', false),
      b('swapTan', 'Tan', 'Swap Tan 1 with Tan All.', 'ui', false),
      { key: 'swapStairsLeftClick', name: 'Stairs left-click', description: 'Swap this option when left-clicking stairs. Also works on ladders.', type: 'enum', default: 'CLIMB', options: e('CLIMB', 'CLIMB_UP', 'CLIMB_DOWN'), position: -1, section: 'objects' },
      { key: 'swapStairsShiftClick', name: 'Stairs shift-click', description: 'Swap this option when shift-clicking stairs. Also works on ladders.', type: 'enum', default: 'CLIMB', options: e('CLIMB', 'CLIMB_UP', 'CLIMB_DOWN'), position: -1, section: 'objects' },
      b('removeDeadNpcMenus', 'Remove dead NPC menus', 'Remove menu options such as Attack and Talk-to from dead NPCs.', 'npcs', false),
      b('groundItemShiftClickWalkHere', 'Shift-click Walk here', 'Swaps Walk here on shift-click on all ground items.', 'groundItems', false),
    ],
  },
};
