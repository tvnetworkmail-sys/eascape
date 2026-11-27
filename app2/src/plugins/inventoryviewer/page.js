// RuneLite's Inventory Viewer plugin, cloned from net.runelite.client.plugins.inventoryviewer (BSD 2-Clause,
// Copyright (c) 2018, AWPH-I and RuneLite contributors): InventoryViewerPlugin, InventoryViewerOverlay.
// 2007: VarClientID.TOPLEVEL_PANEL is the client's open side tab (corea.js); InterfaceID.Bankmain.UNIVERSE is the
// bank being open.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, OverlayPanel, OverlayPosition, ImageComponent, ComponentOrientation, Point, Dimension, InventoryID, VarClientID, HotkeyListener } = rl;

  const INVENTORY_SIZE = 28;
  const ITEM_SPRITE_WIDTH = 36;
  const ITEM_SPRITE_HEIGHT = 32;
  const placeholder = () => {
    try { const c = document.createElement('canvas'); c.width = ITEM_SPRITE_WIDTH; c.height = ITEM_SPRITE_HEIGHT; return c; } catch { return null; }
  };
  const PLACEHOLDER_IMAGE = new ImageComponent(placeholder());

  class InventoryViewerOverlay extends OverlayPanel {
    constructor(plugin, config) {
      super(plugin);
      this.setPosition(OverlayPosition.BOTTOM_RIGHT);
      this.panelComponent.setWrap(true);
      this.panelComponent.setGap(new Point(6, 4));
      this.panelComponent.setPreferredSize(new Dimension(4 * (ITEM_SPRITE_WIDTH + 6), 0));
      this.panelComponent.setOrientation(ComponentOrientation.HORIZONTAL);
      this.config = config;
      this.hidden = false;
    }
    render(graphics) {
      if (this.hidden) return null;
      if ((client.getVarcIntValue(VarClientID.TOPLEVEL_PANEL) === 3 || (ll.bank && ll.bank.open)) && this.config.hideIfInventoryActive()) return null;
      const itemContainer = client.getItemContainer(InventoryID.INV);
      if (itemContainer == null) return null;
      const items = itemContainer.getItems();
      for (let i = 0; i < INVENTORY_SIZE; i++) {
        if (i < items.length) {
          const item = items[i];
          if (item.getQuantity() > 0) {
            const image = this.getImage(item);
            if (image != null) { this.panelComponent.getChildren().push(new ImageComponent(image)); continue; }
          }
        }
        // put a placeholder image so each item is aligned properly and the panel is not resized
        this.panelComponent.getChildren().push(PLACEHOLDER_IMAGE);
      }
      return super.render(graphics);
    }
    getImage(item) {
      const itemComposition = rl.itemManager.getItemComposition(item.getId());
      return rl.itemManager.getImage(item.getId(), item.getQuantity(), itemComposition.isStackable());
    }
    toggle() { this.hidden = !this.hidden; }
  }

  class InventoryViewerPlugin {
    constructor() {
      this.configGroup = 'inventoryViewer';
      this.config = rl.configProxy(this.configGroup, () => this.configItems);
      this.overlay = new InventoryViewerOverlay(this, this.config);
      const self = this;
      this.hotkeyListener = new (class extends HotkeyListener { hotkeyPressed() { self.overlay.toggle(); } })(() => this.config.toggleKeybind());
    }
    startUp() {
      this.overlay.hidden = this.config.hiddenDefault(); // (the overlay is made when the plugin starts)
      rl.overlayManager.add(this.overlay);
      rl.keyManager.registerKeyListener(this.hotkeyListener);
    }
    shutDown() {
      rl.overlayManager.remove(this.overlay);
      rl.keyManager.unregisterKeyListener(this.hotkeyListener);
    }
  }

  const plugin = new InventoryViewerPlugin();
  ll.__inventoryviewer = { plugin };
  rl.registerPlugin('inventoryviewer', plugin);
})();
