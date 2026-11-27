// RuneLite's Inventory Grid plugin, cloned from net.runelite.client.plugins.inventorygrid (BSD 2-Clause,
// Copyright (c) 2018, Jeremy Plsek <https://github.com/jplsek> and RuneLite contributors): InventoryGridPlugin,
// InventoryGridOverlay.
// 2007: the dragged item is the client's objDragCom / objDragSlot (client.getDraggedWidget, corea.js) on the inventory
// (149:0) or the bank's inventory (15:0); 2007 has no worn-items bank side (Bankside.WORNOPS). A 2007 inventory is one
// component with slots, so a slot's item and bounds come from rl.inventorySlot instead of if3 children.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Overlay, OverlayPosition, OverlayLayer, AlphaComposite } = rl;

  const INVENTORY_SIZE = 28;
  const DISTANCE_TO_ACTIVATE_HOVER = 5;
  const BANKSIDE_ITEMS = (15 << 16) | 0;
  const INVENTORY_ITEMS = (149 << 16) | 0;

  class InventoryGridOverlay extends Overlay {
    constructor(plugin, config) {
      super(plugin);
      this.config = config;
      this.initialMousePoint = null;
      this.hoverActive = false;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_WIDGETS);
    }
    render(graphics) {
      const draggingWidget = client.getDraggedWidget();
      if (draggingWidget == null) {
        this.initialMousePoint = null;
        this.hoverActive = false;
        // not dragging
        return null;
      }
      // grid is only supported on bank inventory and inventory
      if (draggingWidget.getId() !== BANKSIDE_ITEMS && draggingWidget.getId() !== INVENTORY_ITEMS) return null;
      const inventoryWidget = draggingWidget.getId();
      const mouse = client.getMouseCanvasPosition();
      const mousePoint = { x: mouse.getX(), y: mouse.getY() };
      const draggedItemIndex = draggingWidget.getIndex();
      const draggedItem = InventoryGridOverlay.getWidgetItem(inventoryWidget, draggedItemIndex);
      if (draggedItem == null) return null;
      const initialBounds = draggedItem.bounds;
      if (this.initialMousePoint == null) this.initialMousePoint = mousePoint;
      const dist = Math.hypot(this.initialMousePoint.x - mousePoint.x, this.initialMousePoint.y - mousePoint.y);
      if (draggedItem.id === -1 || !(client.getDragTime() > draggingWidget.getDragDeadTime()) || (!this.hoverActive && dist < DISTANCE_TO_ACTIVATE_HOVER)) return null;
      this.hoverActive = true;
      for (let i = 0; i < INVENTORY_SIZE; ++i) {
        const targetWidgetItem = InventoryGridOverlay.getWidgetItem(inventoryWidget, i);
        if (targetWidgetItem == null) continue;
        const bounds = targetWidgetItem.bounds;
        const inBounds = bounds.contains(mousePoint.x, mousePoint.y);
        if (this.config.showItem() && inBounds) {
          this.drawItem(graphics, bounds, draggedItem);
          this.drawItem(graphics, initialBounds, targetWidgetItem);
        }
        if (this.config.showHighlight() && inBounds) {
          graphics.setColor(this.config.highlightColor());
          graphics.fill(bounds);
        } else if (this.config.showGrid()) {
          graphics.setColor(this.config.gridColor());
          graphics.fill(bounds);
        }
      }
      return null;
    }
    static getWidgetItem(parentWidget, idx) { return rl.inventorySlot(parentWidget, idx); }
    drawItem(graphics, bounds, item) {
      if (item.id === -1) return;
      const draggedItemImage = rl.itemManager.getImage(item.id, item.quantity, false);
      if (!draggedItemImage) return;
      graphics.setComposite(AlphaComposite.SrcOver.derive(0.3));
      graphics.drawImage(draggedItemImage, bounds.x, bounds.y, null);
      graphics.setComposite(AlphaComposite.SrcOver);
    }
  }

  class InventoryGridPlugin {
    constructor() {
      this.configGroup = 'inventorygrid';
      this.config = rl.configProxy(this.configGroup, () => this.configItems);
      this.overlay = new InventoryGridOverlay(this, this.config);
    }
    startUp() { rl.overlayManager.add(this.overlay); }
    shutDown() { rl.overlayManager.remove(this.overlay); }
  }

  const plugin = new InventoryGridPlugin();
  ll.__inventorygrid = { plugin, InventoryGridOverlay };
  rl.registerPlugin('inventorygrid', plugin);
})();
