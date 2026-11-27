// RuneLite's Item Identification plugin, cloned from net.runelite.client.plugins.itemidentification (BSD 2-Clause,
// Copyright (c) 2019, Hydrox6 <ikada@protonmail.ch> and RuneLite contributors): ItemIdentificationPlugin,
// ItemIdentificationOverlay, ItemIdentification (data.js: app/tools/runelite/itemidentification.py, the enum trimmed
// to the 2007 cache's items), ItemIdentificationMode.
// 2007: the overlay shows on the inventory and the bank; the other interfaces RuneLite lists (death's office, GE price
// checker, looting bag, seed box) aren't in 2007, except the Kingdom of Miscellania collection box (MISC_COLLECTION).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { WidgetItemOverlay, TextComponent, FontManager, itemManager, InterfaceID, overlayManager, Point } = rl;

  // Type -> the config method that turns it on
  const TYPE_ENABLED = {
    SEED_HERB: 'showHerbSeeds', SEED_BERRY: 'showBerrySeeds', SEED_ALLOTMENT: 'showAllotmentSeeds', SEED_SPECIAL: 'showSpecialSeeds',
    SEED_TREE: 'showTreeSeeds', SEED_FRUIT_TREE: 'showFruitTreeSeeds', SEED_FLOWER: 'showFlowerSeeds', HOPS_SEED: 'showHopsSeeds',
    CORAL_FRAG: 'showCoralFrags', SACK: 'showSacks', HERB: 'showHerbs', LOGS: 'showLogs', LOGS_PYRE: 'showPyreLogs',
    LOGS_SAP_TREATED: 'showSapTreatedLogs', PLANK: 'showPlanks', REPAIR_KIT: 'showRepairKits', YARN: 'showYarn', CLOTH: 'showCloth',
    SAPLING: 'showSaplings', COMPOST: 'showComposts', ORE: 'showOres', BAR: 'showBars', GEM: 'showGems', POTION: 'showPotions',
    BUTTERFLY_MOTH_JAR: 'showButterflyMothJars', IMPLING_JAR: 'showImplingJars', TABLET: 'showTablets', SCROLL: 'showTeleportScrolls',
    JEWELLERY: 'showJewellery', JEWELLERY_ENCHANTED: 'showEnchantedJewellery', WINES: 'showWines',
  };
  const itemIdentifications = new Map();
  for (const [name, type, medName, shortName, ids] of ll.itemIdentificationData || []) {
    const iden = { name, type, medName, shortName, itemIDs: ids };
    for (const id of ids) itemIdentifications.set(id, iden);
  }
  const ItemIdentification = { get: (id) => itemIdentifications.get(id) || null };

  class ItemIdentificationOverlay extends WidgetItemOverlay {
    constructor(plugin, config) {
      super(plugin);
      this.config = config;
      this.showOnInventory();
      this.showOnBank();
      this.showOnInterfaces(InterfaceID.MISC_COLLECTION);
    }
    renderItemOverlay(graphics, itemId, widgetItem) {
      const iden = this.findItemIdentification(itemId);
      if (iden == null) return;
      const m = this.config[TYPE_ENABLED[iden.type]];
      if (!m || !m()) return;
      graphics.setFont(FontManager.getRunescapeSmallFont());
      this.renderText(graphics, widgetItem.getCanvasBounds(), iden);
    }
    renderText(graphics, bounds, iden) {
      const textComponent = new TextComponent();
      textComponent.setPosition(new Point(bounds.x - 1, bounds.y + bounds.height - 1));
      textComponent.setColor(this.config.textColor());
      switch (this.config.identificationType()) {
        case 'SHORT': textComponent.setText(iden.shortName); break;
        case 'MEDIUM': textComponent.setText(iden.medName); break;
        default: break;
      }
      textComponent.render(graphics);
    }
    findItemIdentification(itemID) {
      return ItemIdentification.get(itemManager.canonicalize(itemID));
    }
  }

  class ItemIdentificationPlugin {
    constructor() {
      this.configGroup = 'itemidentification';
      this.config = rl.configProxy(this.configGroup, () => this.configItems);
      this.overlay = new ItemIdentificationOverlay(this, this.config);
    }
    startUp() { overlayManager.add(this.overlay); }
    shutDown() { overlayManager.remove(this.overlay); }
  }

  const plugin = new ItemIdentificationPlugin();
  ll.__itemidentification = { plugin, ItemIdentification };
  rl.registerPlugin('itemidentification', plugin);
})();
