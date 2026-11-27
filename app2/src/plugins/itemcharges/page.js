// RuneLite's Item Charges plugin, cloned from net.runelite.client.plugins.itemcharges (BSD 2-Clause, Copyright (c) 2017,
// Seth <Sethtroll3@gmail.com>, (c) 2018 Hydrox6 <ikada@protonmail.ch>, (c) 2021 Adam <Adam@sigterm.info> and RuneLite
// contributors): ItemChargePlugin, ItemChargeType, ItemWithCharge, ItemWithConfig, ItemChargeOverlay, ItemChargeInfobox.
// The ItemWithCharge / ItemWithConfig tables are data.js (app/tools/runelite/itemcharges.py: the constants whose items
// are in the 2007 cache). Era-trim (22 Sep 2007): no dodgy necklace, amulets of chemistry / bounty, chronicle, bracelets
// of slaughter / expeditious bracelet, blood essence or explorer's ring (and its LUMBRIDGE_FREE_ALCHS varbit); the
// OBJECTBOX (193) resets were only for those and the ring of forging, and no 2007 item box shows a new ring of forging.
// Kept: teleport jewellery, waterskins, watering cans, fungicide, sacks / baskets, imp-in-a-box, bellows, abyssal
// bracelets, potions, guthix rest, binding necklace (varp 487, NECKLACE_OF_BINDING, as RuneLite), ring of forging and
// bracelet of clay (by their chat messages) and the ring of recoil notification.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Color, WidgetItemOverlay, TextComponent, FontManager, Point, Counter, InventoryID, Text } = rl;
  const data = ll.itemChargesData || { withCharge: [], withConfig: [] };
  const GROUP = 'itemCharge';

  // ItemChargeConfig keys (the ones still in era)
  const KEY_BINDING_NECKLACE = 'bindingNecklace';
  const KEY_RING_OF_FORGING = 'ringOfForging';
  const KEY_BRACELET_OF_CLAY = 'braceletOfClay';

  // ItemChargeType: each type's config switch
  const ItemChargeType = {};
  for (const [name, method] of [
    ['ABYSSAL_BRACELET', 'showAbyssalBraceletCharges'], ['BELLOWS', 'showBellowCharges'], ['FUNGICIDE_SPRAY', 'showFungicideCharges'],
    ['IMPBOX', 'showImpCharges'], ['TELEPORT', 'showTeleportCharges'], ['WATERCAN', 'showWateringCanCharges'],
    ['WATERSKIN', 'showWaterskinCharges'], ['BINDING_NECKLACE', 'showBindingNecklaceCharges'], ['FRUIT_BASKET', 'showBasketCharges'],
    ['SACK', 'showSackCharges'], ['RING_OF_FORGING', 'showRingOfForgingCount'], ['POTION', 'showPotionDoseCount'],
    ['GUTHIX_REST', 'showGuthixRestDoses'], ['BRACELET_OF_CLAY', 'showBraceletOfClayCharges'],
  ]) ItemChargeType[name] = { name, getEnabled: () => ({ test: (config) => !!(config[method] && config[method]()) }) };

  // ItemWithCharge / ItemWithConfig
  const WITH_CHARGE = new Map();
  for (const [name, type, itemId, charges] of data.withCharge) {
    WITH_CHARGE.set(itemId, { name, getType: () => ItemChargeType[type], getId: () => itemId, getCharges: () => charges });
  }
  const ItemWithCharge = { findItem: (id) => WITH_CHARGE.get(id) || null };
  const WITH_CONFIG = new Map();
  for (const [name, itemId, configKey, type] of data.withConfig) {
    WITH_CONFIG.set(itemId, { name, getItemId: () => itemId, getConfigKey: () => configKey, getType: () => ItemChargeType[type] });
  }
  const ItemWithConfig = { findItem: (id) => WITH_CONFIG.get(id) || null };

  // ItemID / VarPlayerID
  const RING_OF_FORGING = 2568;
  const JEWL_BRACELET_OF_CLAY = 11074;
  const NECKLACE_OF_BINDING = 487;
  // EquipmentInventorySlot (slot indices)
  const SLOTS = [0, 1, 2, 3, 4, 5, 7, 9, 10, 12, 13];

  const RING_OF_RECOIL_BREAK_MESSAGE = 'Your Ring of Recoil has shattered.';
  const BINDING_BREAK_TEXT = 'Your Binding necklace has disintegrated.';
  const RING_OF_FORGING_CHECK_PATTERN = /You can smelt ([0-9]+|one) more pieces? of iron ore before a ring melts\./;
  const RING_OF_FORGING_USED_TEXT = 'You retrieve a bar of iron.';
  const RING_OF_FORGING_BREAK_TEXT = 'Your Ring of Forging has melted.';
  const RING_OF_FORGING_VARROCK_PLATEBODY = 'The Varrock platebody enabled you to smelt your next ore simultaneously.';
  const BRACELET_OF_CLAY_USE_TEXT = 'You manage to mine some clay.';
  const BRACELET_OF_CLAY_USE_TEXT_TRAHAEARN = 'You manage to mine some soft clay.';
  const BRACELET_OF_CLAY_BREAK_TEXT = 'Your bracelet of clay crumbles to dust.';
  const BRACELET_OF_CLAY_CHECK_PATTERN = /You can mine (\d{1,2}) more pieces? of soft clay before your bracelet crumbles to dust\./;

  const MAX_BINDING_CHARGES = 16;
  const MAX_RING_OF_FORGING_CHARGES = 140;
  const MAX_BRACELET_OF_CLAY_CHARGES = 28;
  const constrain = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  class ItemChargeInfobox extends Counter {
    constructor(plugin, image, name, charges, item) {
      super(image, plugin, charges);
      this.setTooltip(name);
      this.item = item;
    }
    getPlugin() { return this.plugin; }
    getItem() { return this.item; }
    // (the item icon can be null until the client has drawn it once)
    getImage() { return this.image || (this.image = rl.itemManager.getImage(this.item)); }
    getTextColor() { return this.getPlugin().getColor(this.getCount()); }
  }

  class ItemChargeOverlay extends WidgetItemOverlay {
    constructor(itemChargePlugin) {
      super(itemChargePlugin);
      this.itemChargePlugin = itemChargePlugin;
      this.showOnInventory();
      this.showOnEquipment();
    }
    renderItemOverlay(graphics, itemId, widgetItem) {
      const config = this.itemChargePlugin.config;
      let charges;
      const itemWithConfig = ItemWithConfig.findItem(itemId);
      if (itemWithConfig != null) {
        if (!itemWithConfig.getType().getEnabled().test(config)) return;
        charges = this.itemChargePlugin.getItemCharges(itemWithConfig.getConfigKey());
      } else {
        const chargeItem = ItemWithCharge.findItem(itemId);
        if (chargeItem == null) return;
        const type = chargeItem.getType();
        if (!type.getEnabled().test(config)) return;
        charges = chargeItem.getCharges();
      }
      graphics.setFont(FontManager.getRunescapeSmallFont());
      const bounds = widgetItem.getCanvasBounds();
      const textComponent = new TextComponent();
      textComponent.setPosition(new Point(bounds.x - 1, bounds.y + 15));
      textComponent.setText(charges < 0 ? '?' : String(charges));
      textComponent.setColor(this.itemChargePlugin.getColor(charges));
      textComponent.render(graphics);
    }
  }

  class ItemChargePlugin {
    constructor() {
      this.configGroup = GROUP;
      this.varrockPlatebodySmeltTwo = false;
      this.lastCheckTick = -1;
      this.infoboxes = new Map();
    }
    startUp() {
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.overlay = new ItemChargeOverlay(this);
      rl.overlayManager.add(this.overlay);
      // (no explorer's ring in 2007: RuneLite reads its varbit here)
      this.updateInfoboxes();
    }
    shutDown() {
      rl.overlayManager.remove(this.overlay);
      rl.infoBoxManager.removeIf((b) => b instanceof ItemChargeInfobox);
      this.infoboxes.clear();
      this.lastCheckTick = -1;
    }
    onConfigChanged(event) {
      if (event.getGroup() !== GROUP) return;
      this.updateInfoboxes();
    }
    onChatMessage(event) {
      const t = event.getType();
      if (t !== 'GAMEMESSAGE' && t !== 'SPAM') return;
      const message = Text.removeTags(event.getMessage());
      const config = this.config;
      let m;
      if (message.includes(RING_OF_RECOIL_BREAK_MESSAGE)) {
        if (config.recoilNotification()) rl.notifier.notify('Your Ring of Recoil has shattered');
      } else if (message.includes(BINDING_BREAK_TEXT)) {
        if (config.bindingNotification()) rl.notifier.notify(BINDING_BREAK_TEXT);
        this.updateBindingNecklaceCharges(MAX_BINDING_CHARGES);
      } else if ((m = RING_OF_FORGING_CHECK_PATTERN.exec(message))) {
        const match = m[1];
        let charges = 1;
        if (match !== 'one') charges = parseInt(match, 10);
        this.updateRingOfForgingCharges(charges);
      } else if (message === RING_OF_FORGING_USED_TEXT) {
        const equipment = client.getItemContainer(InventoryID.WORN);
        if (equipment != null && equipment.contains(RING_OF_FORGING)) {
          const chargesUsed = this.varrockPlatebodySmeltTwo ? 2 : 1;
          const charges = constrain(this.getItemCharges(KEY_RING_OF_FORGING) - chargesUsed, 0, MAX_RING_OF_FORGING_CHARGES);
          this.updateRingOfForgingCharges(charges);
        }
      } else if (message === RING_OF_FORGING_BREAK_TEXT) {
        if (config.ringOfForgingNotification()) rl.notifier.notify('Your ring of forging has melted.');
        // This chat message triggers before the used message so add 1 to the max charges to ensure proper sync
        this.updateRingOfForgingCharges(MAX_RING_OF_FORGING_CHARGES + 1);
      } else if ((m = BRACELET_OF_CLAY_CHECK_PATTERN.exec(message))) {
        this.updateBraceletOfClayCharges(parseInt(m[1], 10));
      } else if (message === BRACELET_OF_CLAY_USE_TEXT || message === BRACELET_OF_CLAY_USE_TEXT_TRAHAEARN) {
        const equipment = client.getItemContainer(InventoryID.WORN);
        // Determine if the player mined with a Bracelet of Clay equipped.
        if (equipment != null && equipment.contains(JEWL_BRACELET_OF_CLAY)) {
          const inventory = client.getItemContainer(InventoryID.INV);
          // Charge is not used if only 1 inventory slot is available when mining in Prifddinas
          const ignore = inventory != null && inventory.count() === 27 && message === BRACELET_OF_CLAY_USE_TEXT_TRAHAEARN;
          if (!ignore) {
            const charges = constrain(this.getItemCharges(KEY_BRACELET_OF_CLAY) - 1, 0, MAX_BRACELET_OF_CLAY_CHARGES);
            this.updateBraceletOfClayCharges(charges);
          }
        }
      } else if (message === BRACELET_OF_CLAY_BREAK_TEXT) {
        if (config.braceletOfClayNotification()) rl.notifier.notify('Your bracelet of clay has crumbled to dust');
        this.updateBraceletOfClayCharges(MAX_BRACELET_OF_CLAY_CHARGES);
      }
      this.varrockPlatebodySmeltTwo = message === RING_OF_FORGING_VARROCK_PLATEBODY;
    }
    onItemContainerChanged(event) {
      if (event.getContainerId() !== InventoryID.WORN) return;
      this.updateInfoboxes();
    }
    onVarbitChanged(event) {
      if (event.getVarbitId() === -1 && event.getVarpId() === NECKLACE_OF_BINDING) this.updateBindingNecklaceCharges(event.getValue());
    }
    updateBindingNecklaceCharges(value) { this.setItemCharges(KEY_BINDING_NECKLACE, value); this.updateInfoboxes(); }
    updateRingOfForgingCharges(value) { this.setItemCharges(KEY_RING_OF_FORGING, value); this.updateInfoboxes(); }
    updateBraceletOfClayCharges(value) { this.setItemCharges(KEY_BRACELET_OF_CLAY, value); this.updateInfoboxes(); }
    updateInfoboxes() {
      const itemContainer = client.getItemContainer(InventoryID.WORN);
      if (itemContainer == null || !this.config) return;
      const items = itemContainer.getItems();
      const showInfoboxes = this.config.showInfoboxes();
      for (const slot of SLOTS) {
        if (slot >= items.length) break;
        const i = items[slot];
        const id = i ? i.getId() : -1;
        let type = null;
        let charges = -1;
        const itemWithCharge = ItemWithCharge.findItem(id);
        if (itemWithCharge != null) {
          type = itemWithCharge.getType();
          charges = itemWithCharge.getCharges();
        } else {
          const itemWithConfig = ItemWithConfig.findItem(id);
          if (itemWithConfig != null) {
            type = itemWithConfig.getType();
            charges = this.getItemCharges(itemWithConfig.getConfigKey());
          }
        }
        const enabled = type != null && type.getEnabled().test(this.config);
        if (showInfoboxes && enabled && charges > 0) {
          let infobox = this.infoboxes.get(slot);
          if (infobox != null) {
            if (infobox.getItem() === id) {
              if (infobox.getCount() === charges) continue;
              infobox.setCount(charges);
              continue;
            }
            rl.infoBoxManager.removeInfoBox(infobox);
            this.infoboxes.delete(slot);
          }
          const name = rl.itemManager.getItemComposition(id).getName();
          const image = rl.itemManager.getImage(id);
          infobox = new ItemChargeInfobox(this, image, name, charges, id);
          rl.infoBoxManager.addInfoBox(infobox);
          this.infoboxes.set(slot, infobox);
        } else {
          const infobox = this.infoboxes.get(slot);
          this.infoboxes.delete(slot);
          if (infobox != null) rl.infoBoxManager.removeInfoBox(infobox);
        }
      }
    }
    getItemCharges(key) {
      // (no old non-profile configurations to migrate here)
      const i = rl.configManager.getRSProfileConfiguration(GROUP, key);
      return i == null || i === '' || isNaN(Number(i)) ? -1 : Number(i) | 0;
    }
    setItemCharges(key, value) { rl.configManager.setRSProfileConfiguration(GROUP, key, value); }
    getColor(charges) {
      let color = Color.WHITE;
      if (charges <= this.config.veryLowWarning()) color = this.config.veryLowWarningColor();
      else if (charges <= this.config.lowWarning()) color = this.config.lowWarningolor();
      return color;
    }
  }

  const plugin = new ItemChargePlugin();
  ll.__itemcharges = { plugin, ItemWithCharge, ItemWithConfig, ItemChargeType, ItemChargeInfobox };
  rl.registerPlugin('itemcharges', plugin);
})();
