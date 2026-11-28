// RuneLite's Menu Entry Swapper plugin, cloned from net.runelite.client.plugins.menuentryswapper (BSD 2-Clause,
// Copyright (c) 2018, Adam <Adam@sigterm.info>, Kamiel and RuneLite contributors): MenuEntrySwapperPlugin, Swap.
// Trimmed for Sept 2007 (see the descriptor). The 2007 client has no submenus: "Swap left-click" / "Swap shift-click"
// (Shift + right-click on an item, NPC or object) open their list in the chat box (ChatboxPanelManager's text menu)
// instead of a submenu. Item shift-click swaps are kept in this plugin's group as `shift_item_<id>` (RuneLite's
// "shiftclick" group isn't sent to the page). Bank and shop swaps go by the 2007 option names (the 2007 bank and
// shop are interface ops, not CC_OPs). Worn item and UI (CC_OP) swaps are left out: the 2007 interfaces have no CC ops.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, MenuAction, Text, KeyCode, WidgetUtil } = rl;

  const GROUP = 'menuentryswapper';
  const ITEM_KEY_PREFIX = 'item_';
  const ITEM_SHIFT_KEY_PREFIX = 'shift_item_';
  const OBJECT_KEY_PREFIX = 'object_';
  const OBJECT_SHIFT_KEY_PREFIX = 'object_shift_';
  const NPC_KEY_PREFIX = 'npc_';
  const NPC_SHIFT_KEY_PREFIX = 'npc_shift_';
  const INVENTORY = 149; // InterfaceID.INVENTORY
  const EXAMINE_ITEM = 1001; // the 2007 client's held item Examine
  const NPC_MENU_TYPES = [MenuAction.NPC_FIRST_OPTION, MenuAction.NPC_SECOND_OPTION, MenuAction.NPC_THIRD_OPTION, MenuAction.NPC_FOURTH_OPTION, MenuAction.NPC_FIFTH_OPTION];
  const OBJECT_MENU_TYPES = [MenuAction.GAME_OBJECT_FIRST_OPTION, MenuAction.GAME_OBJECT_SECOND_OPTION, MenuAction.GAME_OBJECT_THIRD_OPTION, MenuAction.GAME_OBJECT_FOURTH_OPTION, MenuAction.GAME_OBJECT_FIFTH_OPTION];
  const GROUND_ITEM_TYPES = [MenuAction.GROUND_ITEM_FIRST_OPTION, MenuAction.GROUND_ITEM_SECOND_OPTION, MenuAction.GROUND_ITEM_THIRD_OPTION, MenuAction.GROUND_ITEM_FOURTH_OPTION, MenuAction.GROUND_ITEM_FIFTH_OPTION];
  const ESSENCE_MINE_NPCS = new Set(['aubury', 'archmage sedridor', 'wizard distentor', 'wizard cromperty', 'brimstail']);
  // ShiftWithdrawMode / ShiftDepositMode, BuyMode / SellMode: the option each mode moves to the top
  // 2006RS-2: our bank's ops (bank_main.if / bank_side.if: "Withdraw 1" ... "Withdraw X", "Deposit 1" ... "Deposit X")
  const WITHDRAW = { WITHDRAW_1: 'withdraw 1', WITHDRAW_5: 'withdraw 5', WITHDRAW_10: 'withdraw 10', WITHDRAW_X: 'withdraw x', WITHDRAW_ALL: 'withdraw all' };
  const DEPOSIT = { DEPOSIT_1: 'deposit 1', DEPOSIT_5: 'deposit 5', DEPOSIT_10: 'deposit 10', DEPOSIT_X: 'deposit x', DEPOSIT_ALL: 'deposit all' };

  const baseType = (t) => (t >= 2000 ? t - 2000 : t);
  const lower = (s) => Text.removeTags(s).toLowerCase();
  // a loc entry's identifier: an op's is the scene tag, with the loc's id in bits 32-62 (not RuneLite's plain id, so
  // RuneLite's `identifier & 0xFFFF` would read the tag's square instead); Examine's is the loc's id
  // (2006RS-2: the 2006 client's loc entries, ops and Examine alike, carry its 32-bit typecode: the loc id in bits 14-28)
  // (its square in the low 14 bits, as the entry's x and z: a plain id, as 2007's Examine carries, doesn't match them)
  const typecode06 = (raw, e) => !ll.c2007 && typeof raw === 'number' && raw >= 0 && raw <= 0x7fffffff && e
    && (raw & 0x7f) === (e.getParam0() & 0x7f) && ((raw >> 7) & 0x7f) === (e.getParam1() & 0x7f);
  const locIdOf = (raw, e) => (typecode06(raw, e) ? (raw >> 14) & 0x7fff : typeof raw === 'bigint' ? Number((raw >> 32n) & 0x7fffffffn)
    : Number(raw) > 0x7fffffff ? Math.floor(Number(raw) / 4294967296) & 0x7fffffff : Number(raw) | 0);
  const sameLoc = (a, b) => a.getParam0() === b.getParam0() && a.getParam1() === b.getParam1() && a.getTarget() === b.getTarget();
  const alwaysTrue = () => true;
  const equalTo = (t) => (s) => s === t;

  class Swap {
    constructor(optionPredicate, targetPredicate, swappedOption, enabled, strict) {
      this.optionPredicate = optionPredicate; this.targetPredicate = targetPredicate; this.swappedOption = swappedOption; this.enabled = enabled; this.strict = strict;
    }
  }

  class MenuEntrySwapperPlugin {
    constructor() {
      this.configGroup = GROUP;
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.swaps = new Map(); // option -> [Swap]
      this.lastShift = false; this.curShift = false;
    }
    startUp() { this.setupSwaps(); }
    shutDown() { this.swaps.clear(); }

    put(option, swap) { if (!this.swaps.has(option)) this.swaps.set(option, []); this.swaps.get(option).push(swap); }
    swap(option, target, swappedOption, enabled) {
      if (enabled === undefined) { enabled = swappedOption; swappedOption = target; target = alwaysTrue; }
      const pred = typeof target === 'function' ? target : equalTo(target);
      this.put(option, new Swap(alwaysTrue, pred, swappedOption, enabled, true));
    }
    swapContains(option, targetPredicate, swappedOption, enabled) { this.put(option, new Swap(alwaysTrue, targetPredicate, swappedOption, enabled, false)); }

    setupSwaps() {
      const c = this.config;
      const s = (...a) => this.swap(...a);
      s('talk-to', 'bank', () => c.swapBank());
      s('talk-to', 'exchange', () => c.swapExchange());
      // make sure assignment swap is higher priority than trade swap for slayer masters
      s('talk-to', 'assignment', () => c.swapAssignment());
      s('talk-to', 'pay', () => c.swapPay());
      this.swapContains('talk-to', alwaysTrue, 'pay (', () => c.swapPay());
      s('talk-to', 'trade', () => c.swapTrade());
      s('talk-to', 'trade-with', () => c.swapTrade());
      s('talk-to', 'shop', () => c.swapTrade());
      for (const o of ['travel', 'pay-fare', 'charter', 'take-boat', 'fly', 'jatizso', 'neitiznot', 'rellekka', 'pirate\'s cove', 'waterbirth island', 'miscellania', 'follow', 'transport']) s('talk-to', o, () => c.swapTravel());
      s('talk-to', 'quick-travel', () => c.swapQuick());
      s('talk-to', (t) => ESSENCE_MINE_NPCS.has(t), 'teleport', () => c.swapEssenceMineTeleport());
      s('pass', 'energy barrier', 'pay-toll(2-ecto)', () => c.swapTravel());
      s('open', 'gate', 'pay-toll(10gp)', () => c.swapTravel());
      s('inspect', 'trapdoor', 'travel', () => c.swapTravel());
      s('board', 'travel cart', 'pay-fare', () => c.swapTravel());
      s('check', 'reset', () => c.swapBoxTrap());
      s('dismantle', 'reset', () => c.swapBoxTrap());
      s('take', 'lay', () => c.swapBoxTrap());
      s('pick-up', 'chase', () => c.swapChase());
      s('enter', 'quick-enter', () => c.swapQuick());
      s('ring', 'quick-start', () => c.swapQuick());
      s('pass', 'quick-pass', () => c.swapQuick());
      s('pass', 'quick pass', () => c.swapQuick());
      s('open', 'quick-open', () => c.swapQuick());
      s('climb-down', 'quick-start', () => c.swapQuick());
      s('climb-down', 'pay', () => c.swapQuick());
      s('admire', 'teleport', () => c.swapAdmire());
      s('admire', 'spellbook', () => c.swapAdmire());
      s('admire', 'perks', () => c.swapAdmire());
      s('cage', 'harpoon', () => c.swapHarpoon());
      s('big net', 'harpoon', () => c.swapHarpoon());
      s('net', 'harpoon', () => c.swapHarpoon());
      s('lure', 'bait', () => c.swapBait());
      s('net', 'bait', () => c.swapBait());
      s('small net', 'bait', () => c.swapBait());
      s('value', 'buy 1', () => this.shiftModifier() && c.shopBuy() === 'BUY_1');
      s('value', 'buy 5', () => this.shiftModifier() && c.shopBuy() === 'BUY_5');
      s('value', 'buy 10', () => this.shiftModifier() && c.shopBuy() === 'BUY_10');
      s('value', 'sell 1', () => this.shiftModifier() && c.shopSell() === 'SELL_1');
      s('value', 'sell 5', () => this.shiftModifier() && c.shopSell() === 'SELL_5');
      s('value', 'sell 10', () => this.shiftModifier() && c.shopSell() === 'SELL_10');
      s('wear', 'rub', () => c.swapTeleportItem());
      s('wear', 'teleport', () => c.swapTeleportItem());
      s('wield', 'teleport', () => c.swapTeleportItem());
      s('wield', 'invoke', () => c.swapTeleportItem());
      s('wear', 'teleports', () => c.swapTeleportItem());
      s('bury', 'use', () => c.swapBones());
      s('clean', 'use', () => c.swapHerbs());
      s('climb', 'climb-up', () => (this.shiftModifier() ? c.swapStairsShiftClick() : c.swapStairsLeftClick()) === 'CLIMB_UP');
      s('climb', 'climb-down', () => (this.shiftModifier() ? c.swapStairsShiftClick() : c.swapStairsLeftClick()) === 'CLIMB_DOWN');
    }

    // ---- saved swaps
    getInt(key) { const v = rl.configManager.getConfiguration(GROUP, key); if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; }
    setInt(key, v) { rl.configManager.setConfiguration(GROUP, key, String(v)); }
    unset(key) { rl.configManager.unsetConfiguration(GROUP, key); }
    getItemSwapConfig(shift, itemId) { return this.getInt((shift ? ITEM_SHIFT_KEY_PREFIX : ITEM_KEY_PREFIX) + itemId); }
    setItemSwapConfig(shift, itemId, index) { this.setInt((shift ? ITEM_SHIFT_KEY_PREFIX : ITEM_KEY_PREFIX) + itemId, index); }
    unsetItemSwapConfig(shift, itemId) { this.unset((shift ? ITEM_SHIFT_KEY_PREFIX : ITEM_KEY_PREFIX) + itemId); }
    getObjectSwapConfig(shift, objectId) { return this.getInt((shift ? OBJECT_SHIFT_KEY_PREFIX : OBJECT_KEY_PREFIX) + objectId); }
    setObjectSwapConfig(shift, objectId, index) { this.setInt((shift ? OBJECT_SHIFT_KEY_PREFIX : OBJECT_KEY_PREFIX) + objectId, index); }
    unsetObjectSwapConfig(shift, objectId) { this.unset((shift ? OBJECT_SHIFT_KEY_PREFIX : OBJECT_KEY_PREFIX) + objectId); }
    getNpcSwapConfig(shift, npcId) { return this.getInt((shift ? NPC_SHIFT_KEY_PREFIX : NPC_KEY_PREFIX) + npcId); }
    setNpcSwapConfig(shift, npcId, index) { this.setInt((shift ? NPC_SHIFT_KEY_PREFIX : NPC_KEY_PREFIX) + npcId, index); }
    unsetNpcSwapConfig(shift, npcId) { this.unset((shift ? NPC_SHIFT_KEY_PREFIX : NPC_KEY_PREFIX) + npcId); }

    shiftModifier() { return client.isKeyPressed(KeyCode.KC_SHIFT); }
    message(name, shift, what) { client.addChatMessage('CONSOLE', '', `The default ${shift ? 'shift' : 'left'} click option for '${Text.removeTags(name)}' ${what}`); }

    // ---- onMenuOpened: Shift + right-click adds "Swap left-click" / "Swap shift-click" (their lists open in the chat box)
    onMenuEntryAdded(event) {
      if (!this.shiftModifier()) return;
      const entry = event.getMenuEntry();
      const type = baseType(entry.getType());
      if (type === MenuAction.EXAMINE_OBJECT && this.config.objectCustomization()) this.configureObjectClick(entry);
      else if (type === MenuAction.EXAMINE_NPC && this.config.npcCustomization()) this.configureNpcClick(entry);
      else if (type === EXAMINE_ITEM && WidgetUtil.componentToInterface(entry.getParam1()) === INVENTORY) this.configureItems(entry);
    }
    addSwapEntries(target, fill) {
      for (const shift of [false, true]) {
        const list = [];
        fill(shift, (option, fn) => list.push({ option, fn }));
        if (!list.length) continue;
        client.createMenuEntry(-1).setOption(shift ? 'Swap shift-click' : 'Swap left-click').setTarget(target).setType(MenuAction.RUNELITE)
          .onClick(() => {
            const m = rl.chatboxPanelManager.openTextMenuInput(`${shift ? 'Shift' : 'Left'}-click option for ${Text.removeTags(target)}`);
            for (const o of list) m.option(o.option, o.fn);
            m.build();
          });
      }
    }
    // RuneLite's ObjectComposition.getImpostor for a loc entry: the 2007 client's Examine entry for the loc has the id of
    // the loc a multiloc shows as now (its varbit / varp state; Client.ts LocType.getMultiLoc), so the loc's op entries
    // take the id of the Examine at the same square with the same name
    objectIdOf(menuEntries, menuEntry) {
      if (baseType(menuEntry.getType()) === MenuAction.EXAMINE_OBJECT) return locIdOf(menuEntry.getIdentifier(), menuEntry);
      for (const e of menuEntries) if (baseType(e.getType()) === MenuAction.EXAMINE_OBJECT && sameLoc(e, menuEntry)) return locIdOf(e.getIdentifier(), e);
      const objectId = locIdOf(menuEntry.getIdentifier(), menuEntry);
      const composition = client.getObjectDefinition(objectId);
      const impostor = composition.getImpostorIds() != null ? composition.getImpostor() : null;
      return impostor ? impostor.getId() : objectId;
    }
    // the loc's ops (EntityOps): its definition's, and any the menu shows in a free slot (the 2007 client adds some per
    // placement, ExtraOps2007.ts / FairyRings2007.ts)
    objectOps(composition, entry) {
      const ops = Array.from({ length: OBJECT_MENU_TYPES.length }, (_, i) => composition.getActions()[i] || null);
      for (const e of client.getMenuEntries()) {
        const slot = OBJECT_MENU_TYPES.indexOf(baseType(e.getType()));
        if (slot !== -1 && !ops[slot] && sameLoc(e, entry)) ops[slot] = Text.removeTags(e.getOption());
      }
      return ops;
    }
    configureObjectClick(entry) {
      const composition = client.getObjectDefinition(this.objectIdOf([], entry));
      const actions = this.objectOps(composition, entry);
      this.addSwapEntries(entry.getTarget(), (shift, add) => {
        actions.forEach((op, opIdx) => {
          if (!op) return;
          add(op, () => { this.message(composition.getName(), shift, `has been set to '${op}'.`); this.setObjectSwapConfig(shift, composition.getId(), opIdx); });
        });
        add('Walk here', () => { this.message(composition.getName(), shift, 'has been set to Walk here.'); this.setObjectSwapConfig(shift, composition.getId(), -1); });
        if (this.getObjectSwapConfig(shift, composition.getId()) != null) add('Reset', () => { this.message(composition.getName(), shift, 'has been reset.'); this.unsetObjectSwapConfig(shift, composition.getId()); });
      });
    }
    defaultAction(composition) {
      const actions = composition.getActions();
      for (let i = 0; i < NPC_MENU_TYPES.length; ++i) if (actions[i]) return NPC_MENU_TYPES[i];
      return null;
    }
    configureNpcClick(entry) {
      const npc = entry.getNpc();
      if (!npc) return;
      const composition = npc.getTransformedComposition();
      const actions = composition.getActions();
      const hasAttack = actions.some((a) => a && a.toLowerCase() === 'attack');
      this.addSwapEntries(entry.getTarget(), (shift, add) => {
        const cfg = this.getNpcSwapConfig(shift, composition.getId());
        const current = cfg == null ? (hasAttack ? null : this.defaultAction(composition)) : (cfg === -1 ? MenuAction.WALK : NPC_MENU_TYPES[cfg]);
        actions.forEach((op, actionIdx) => {
          if (!op || op.toLowerCase() === 'attack' || actionIdx >= NPC_MENU_TYPES.length) return;
          if (NPC_MENU_TYPES[actionIdx] === current) return;
          add(op, () => { this.message(composition.getName(), shift, `has been set to '${op}'.`); this.setNpcSwapConfig(shift, composition.getId(), actionIdx); });
        });
        add('Walk here', () => { this.message(composition.getName(), shift, 'has been set to Walk here.'); this.setNpcSwapConfig(shift, composition.getId(), -1); });
        if (cfg != null) add('Reset', () => { this.message(composition.getName(), shift, 'has been reset.'); this.unsetNpcSwapConfig(shift, composition.getId()); });
      });
    }
    defaultOp(itemComposition, shift) {
      if (shift) { const i = itemComposition.getShiftClickActionIndex(); if (i >= 0) return i; }
      // take the first op above Use
      const actions = itemComposition.getInventoryActions();
      for (let actionIdx = 0; actionIdx < 3; ++actionIdx) if (actions[actionIdx]) return actionIdx;
      return -1; // use
    }
    configureItems(entry) {
      const itemComposition = rl.itemManager.getItemComposition(Number(entry.getIdentifier()) | 0);
      const actions = itemComposition.getInventoryActions();
      const name = itemComposition.getMembersName();
      this.addSwapEntries(entry.getTarget(), (shift, add) => {
        if (shift ? !this.config.shiftClickCustomization() : !this.config.leftClickCustomization()) return;
        const op = this.getItemSwapConfig(shift, itemComposition.getId());
        const def = this.defaultOp(itemComposition, shift);
        for (let actionIdx = 0; actionIdx < actions.length; ++actionIdx) {
          const opName = actions[actionIdx];
          if (opName && def !== actionIdx && (op == null || op !== actionIdx)) {
            add(opName, () => { client.addChatMessage('CONSOLE', '', `The default ${shift ? 'shift' : 'left'} click option for '${name}' has been set to '${opName}'.`); this.setItemSwapConfig(shift, itemComposition.getId(), actionIdx); });
          }
          if (actionIdx + 1 === 4 && def !== -1) {
            add('Use', () => { client.addChatMessage('CONSOLE', '', `The default ${shift ? 'shift' : 'left'} click option for '${name}' has been set to 'Use'.`); this.setItemSwapConfig(shift, itemComposition.getId(), -1); });
          }
        }
        if (op != null) add('Reset', () => { client.addChatMessage('CONSOLE', '', `The default held ${shift ? 'shift' : 'left'}-click option for '${name}' has been reset.`); this.unsetItemSwapConfig(shift, itemComposition.getId()); });
      });
    }

    // ---- the swaps
    swapMenuEntry(menu, menuEntries, index, menuEntry) {
      const eventId = Number(menuEntry.getIdentifier()) | 0;
      const menuAction = baseType(menuEntry.getType());
      const option = lower(menuEntry.getOption());
      const target = lower(menuEntry.getTarget());
      const w = menuEntry.getWidget ? menuEntry.getWidget() : null;
      if (w != null && WidgetUtil.componentToInterface(w.getId()) === INVENTORY
        && (this.lastShift ? this.config.shiftClickCustomization() : this.config.leftClickCustomization())) {
        const swapIndex = this.getItemSwapConfig(this.lastShift, w.getItemId());
        if (swapIndex != null) {
          if (swapIndex === -1) this.swapByOption(menu, menuEntries, 'use', target, index, true);
          else if (swapIndex + 1 === menuEntry.getItemOp()) this.swapIdx(menu, menuEntries, index, menuEntries.length - 1);
          return;
        }
      }
      const objMenuIdx = OBJECT_MENU_TYPES.indexOf(menuAction);
      if (objMenuIdx !== -1) {
        const objectId = this.objectIdOf(menuEntries, menuEntry);
        const customOption = this.getObjectSwapConfig(this.shiftModifier(), objectId);
        if (customOption != null && customOption >= 0) {
          if (customOption === objMenuIdx) this.swapIdx(menu, menuEntries, index, menuEntries.length - 1);
          return;
        }
      }
      if (NPC_MENU_TYPES.includes(menuAction)) {
        const npc = menuEntry.getNpc();
        const composition = npc && npc.getTransformedComposition();
        const customOption = composition ? this.getNpcSwapConfig(this.shiftModifier(), composition.getId()) : null;
        if (customOption != null && customOption >= 0) {
          if (NPC_MENU_TYPES[customOption] === menuAction) {
            let i = index;
            while (i < menuEntries.length - 1 && NPC_MENU_TYPES.includes(baseType(menuEntries[i + 1].getType()))) ++i;
            this.swapIdx(menu, menuEntries, index, i);
            return;
          }
        }
      }
      if (this.swapBank(menu, menuEntry, option)) return;
      if (this.swapTan(menu, menuEntries, index, option, target)) return;
      const hintArrowNpc = client.getHintArrowNpc ? client.getHintArrowNpc() : null;
      if (hintArrowNpc != null && hintArrowNpc.getIndex() === eventId && NPC_MENU_TYPES.includes(menuAction)) return;
      for (const swap of this.swaps.get(option) || []) {
        if (swap.targetPredicate(target) && swap.enabled()) {
          if (this.swapByOption(menu, menuEntries, swap.swappedOption, target, index, swap.strict)) break;
        }
      }
    }

    // swapBank: the 2007 bank's ops by name (the first op is Withdraw-1 / Deposit-1)
    swapBank(menu, menuEntry, option) {
      if (!this.shiftModifier()) return false;
      const deposit = this.config.bankDepositShiftClick();
      if (deposit !== 'OFF' && option === DEPOSIT.DEPOSIT_1 && menuEntry === menu.top) { this.bankModeSwap(menu, DEPOSIT[deposit]); return true; }
      const withdraw = this.config.bankWithdrawShiftClick();
      if (withdraw !== 'OFF' && option === WITHDRAW.WITHDRAW_1 && menuEntry === menu.top) { this.bankModeSwap(menu, WITHDRAW[withdraw]); return true; }
      return false;
    }
    // swap("tan 1", "tan all"): the 2007 tanner (interface 324) has one button per op, stacked, each its own entry:
    // "Tan 1 <col>Soft Leather" and "Tan all <col>Soft Leathers" (the target differs by its plural)
    swapTan(menu, menuEntries, index, option, target) {
      if (option !== 'tan 1' || !this.config.swapTan()) return false;
      for (let i = index - 1; i >= 0; i--) {
        if (lower(menuEntries[i].getOption()) === 'tan all' && lower(menuEntries[i].getTarget()).startsWith(target)) {
          this.swapIdx(menu, menuEntries, i, index);
          return true;
        }
      }
      return false;
    }
    bankModeSwap(menu, option) {
      const menuEntries = menu.getMenuEntries();
      for (let i = menuEntries.length - 1; i >= 0; --i) {
        const entry = menuEntries[i];
        if (lower(entry.getOption()) === option) {
          menuEntries[i] = menuEntries[menuEntries.length - 1];
          menuEntries[menuEntries.length - 1] = entry;
          menu.setMenuEntries(menuEntries);
          break;
        }
      }
    }

    onClientTick() {
      this.lastShift = this.curShift;
      this.curShift = this.shiftModifier();
      if (client.isMenuOpen()) return;
      const menuEntries = client.getMenu().getMenuEntries();
      for (const menuEntry of menuEntries) {
        const type = baseType(menuEntry.getType());
        if (OBJECT_MENU_TYPES.includes(type)) {
          const objectId = this.objectIdOf(menuEntries, menuEntry);
          const shift = this.shiftModifier();
          const customOption = this.getObjectSwapConfig(shift, objectId);
          if ((customOption == null && shift && this.config.objectShiftClickWalkHere()) || customOption === -1) menuEntry.setDeprioritized(true);
        } else if (NPC_MENU_TYPES.includes(type)) {
          const npc = menuEntry.getNpc();
          const composition = npc && npc.getTransformedComposition();
          if (!composition) continue;
          const shift = this.shiftModifier();
          const customOption = this.getNpcSwapConfig(shift, composition.getId());
          if ((customOption == null && shift && this.config.npcShiftClickWalkHere()) || customOption === -1) menuEntry.setDeprioritized(true);
        } else if (GROUND_ITEM_TYPES.includes(type)) {
          if (this.shiftModifier() && this.config.groundItemShiftClickWalkHere()) menuEntry.setDeprioritized(true);
        }
      }
    }

    onPostMenuSort() {
      if (client.isMenuOpen()) return;
      const root = client.getMenu();
      const menuEntries = root.getMenuEntries();
      root.top = menuEntries[menuEntries.length - 1];
      for (let idx = 0; idx < menuEntries.length; idx++) this.swapMenuEntry(root, menuEntries, idx, menuEntries[idx]);
      if (this.config.removeDeadNpcMenus()) this.removeDeadNpcs();
    }
    removeDeadNpcs() {
      const oldEntries = client.getMenuEntries();
      const newEntries = oldEntries.filter((e) => { const npc = e.getNpc(); return npc == null || !rl.npcUtil.isDying(npc); });
      if (oldEntries.length !== newEntries.length) client.setMenuEntries(newEntries);
    }

    swapByOption(menu, menuEntries, option, target, index, strict) {
      const optionIdx = this.findIndex(menuEntries, index, option, target, strict);
      if (optionIdx >= 0) { this.swapIdx(menu, menuEntries, optionIdx, index); return true; }
      return false;
    }
    findIndex(entries, limit, option, target, strict) {
      for (let i = limit - 1; i >= 0; i--) {
        const entryOption = lower(entries[i].getOption());
        const entryTarget = lower(entries[i].getTarget());
        if ((strict ? entryOption === option : entryOption.includes(option.toLowerCase())) && entryTarget === target) return i;
      }
      return -1;
    }
    swapIdx(menu, entries, index1, index2) {
      if (index1 === index2) return;
      const entry1 = entries[index1]; const entry2 = entries[index2];
      entries[index1] = entry2; entries[index2] = entry1;
      menu.setMenuEntries(entries);
    }
  }

  rl.registerPlugin('menuentryswapper', new MenuEntrySwapperPlugin());
})();
