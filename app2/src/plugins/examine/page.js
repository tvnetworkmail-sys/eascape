// RuneLite's Examine plugin, cloned from net.runelite.client.plugins.examine (BSD 2-Clause, Copyright (c) 2018,
// Adam <Adam@sigterm.info> and RuneLite contributors): ExaminePlugin, PendingExamine.
// 2007: item examines come back as game messages (no ITEM_EXAMINE chat type); a held item's Examine is an item op on
// its inventory component (MenuOptionClicked.isItemOp / getItemId) instead of OSRS's CC_OP_LOW_PRIORITY, with its
// quantity from the component's slot. No GE in 2007 and no prices or values in the app: the price line is only built
// while rl.prices.enabled() (off).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { MenuAction, QuantityFormatter, ChatMessageBuilder, ChatColorType, QueuedMessage } = rl;

  const COINS = 995;
  const ITEM_EXAMINE = 'GAMEMESSAGE'; // (2007's examine replies)

  class PendingExamine {
    constructor() { this.responseType = null; this.id = -1; this.quantity = -1; }
    getResponseType() { return this.responseType; }
    setResponseType(t) { this.responseType = t; }
    getId() { return this.id; }
    setId(i) { this.id = i; }
    getQuantity() { return this.quantity; }
    setQuantity(q) { this.quantity = q; }
  }

  class ExaminePlugin {
    constructor() { this.configGroup = 'examine'; this.pending = []; }
    startUp() {}
    shutDown() { this.pending.length = 0; }
    onGameStateChanged() { this.pending.length = 0; }
    onMenuOptionClicked(event) {
      if (event.getMenuOption() !== 'Examine') return;
      let type; let id; let quantity = -1;
      if (event.getMenuAction() === MenuAction.EXAMINE_ITEM_GROUND) {
        type = ITEM_EXAMINE;
        id = event.getId();
      } else if (event.isItemOp && event.isItemOp()) {
        type = ITEM_EXAMINE;
        const qi = this.findItemFromWidget(event.getParam1(), event.getParam0());
        if (qi == null) return;
        quantity = qi[0];
        id = qi[1];
      } else return;
      const pendingExamine = new PendingExamine();
      pendingExamine.setResponseType(type);
      pendingExamine.setId(id);
      pendingExamine.setQuantity(quantity);
      this.pending.unshift(pendingExamine);
    }
    onChatMessage(event) {
      if (this.pending.length === 0) return;
      const pendingExamine = this.pending[0];
      if (pendingExamine.getResponseType() !== event.getType()) return;
      this.pending.shift();
      const itemId = pendingExamine.getId();
      const itemQuantity = pendingExamine.getQuantity();
      if (itemId === COINS) return;
      const itemComposition = rl.itemManager.getItemComposition(itemId);
      this.getItemPrice(itemComposition.getId(), itemComposition, itemQuantity);
    }
    findItemFromWidget(widgetId, childIdx) {
      // (2007 inventories are one component with slots: the slot's item and quantity)
      const slot = rl.inventorySlot(widgetId, childIdx);
      if (slot == null || slot.id < 0) return null;
      return [slot.quantity, slot.id];
    }
    getItemPrice(id, itemComposition, quantity) {
      if (!rl.prices.enabled()) return; // (no prices or values)
      // quantity is at least 1
      quantity = Math.max(1, quantity);
      const gePrice = rl.itemManager.getItemPrice ? rl.itemManager.getItemPrice(id) : 0;
      const alchPrice = itemComposition.getHaPrice();
      if (gePrice > 0 || alchPrice > 0) {
        const message = new ChatMessageBuilder().append(ChatColorType.NORMAL).append('Price of ').append(ChatColorType.HIGHLIGHT);
        if (quantity > 1) message.append(QuantityFormatter.formatNumber(quantity)).append(' x ');
        message.append(itemComposition.getMembersName()).append(ChatColorType.NORMAL).append(':');
        if (gePrice > 0) {
          message.append(ChatColorType.NORMAL).append(' GE average ').append(ChatColorType.HIGHLIGHT).append(QuantityFormatter.formatNumber(gePrice * quantity));
          if (quantity > 1) message.append(ChatColorType.NORMAL).append(' (').append(ChatColorType.HIGHLIGHT).append(QuantityFormatter.formatNumber(gePrice)).append(ChatColorType.NORMAL).append('ea)');
        }
        if (alchPrice > 0) {
          message.append(ChatColorType.NORMAL).append(' HA value ').append(ChatColorType.HIGHLIGHT).append(QuantityFormatter.formatNumber(alchPrice * quantity));
          if (quantity > 1) message.append(ChatColorType.NORMAL).append(' (').append(ChatColorType.HIGHLIGHT).append(QuantityFormatter.formatNumber(alchPrice)).append(ChatColorType.NORMAL).append('ea)');
        }
        rl.chatMessageManager.queue(QueuedMessage.builder().type('ITEM_EXAMINE').runeLiteFormattedMessage(message.build()).build());
      }
    }
  }

  const plugin = new ExaminePlugin();
  ll.__examine = { plugin };
  rl.registerPlugin('examine', plugin);
})();
