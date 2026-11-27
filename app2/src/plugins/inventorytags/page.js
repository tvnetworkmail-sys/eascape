// RuneLite's Inventory Tags plugin, cloned from net.runelite.client.plugins.inventorytags (BSD 2-Clause, Copyright (c)
// 2018 kulers and RuneLite contributors): InventoryTagsPlugin, InventoryTagsOverlay, Tag.
// Tags are config keys (inventorytags: tag_<id> = {"color":...} as RuneLite's Gson), so nothing goes to the server.
// 2007: no submenus, so Shift + right-click's "Inventory tag" opens its list (the tag colours in the inventory and
// equipment, Pick, Reset) in the chat box, as Menu Entry Swapper's swaps do; there is no colour picker, so Pick asks for
// the colour as hex in the chat box (RRGGBB). MenuOpened is the Shift-held MenuEntryAdded of the inventory item's
// Examine (the 2007 client builds its menu each frame). The raids storage and gravestone interfaces aren't in 2007.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, WidgetItemOverlay, itemManager, configManager, overlayManager, MenuAction, KeyCode, WidgetUtil, InventoryID, ColorUtil, Color, ImageUtil, Text } = rl;

  const GROUP = 'inventorytags';
  const ITEM_KEY_PREFIX = 'item_';
  const TAG_KEY_PREFIX = 'tag_';
  const INVENTORY = 149; // InterfaceID.INVENTORY
  const EXAMINE_ITEM = 1001; // the 2007 client's held item Examine

  // Gson's java.awt.Color: {"value": argb}
  const toJson = (tag) => JSON.stringify({ color: { value: tag.color.getRGB() | 0 } });
  const fromJson = (s) => { try { const o = JSON.parse(s); if (!o || !o.color) return { color: null }; const v = o.color.value | 0; return { color: new Color((v >> 16) & 255, (v >> 8) & 255, v & 255, (v >>> 24) & 255) }; } catch { return null; } };

  class InventoryTagsOverlay extends WidgetItemOverlay {
    constructor(plugin, config) {
      super(plugin);
      this.plugin = plugin; this.config = config;
      this.showOnEquipment();
      this.showOnInventory();
      this.fillCache = new Map();
      this.tagCache = new Map();
    }
    renderItemOverlay(graphics, itemId, widgetItem) {
      const tag = this.getTag(itemId);
      if (tag == null || tag.color == null) return;
      const color = tag.color;
      const bounds = widgetItem.getCanvasBounds();
      if (this.config.showTagOutline()) {
        const outline = itemManager.getItemOutline(itemId, widgetItem.getQuantity(), color);
        if (outline) graphics.drawImage(outline, bounds.x, bounds.y, null);
      }
      if (this.config.showTagFill()) {
        const image = this.getFillImage(color, widgetItem.getId(), widgetItem.getQuantity());
        if (image) graphics.drawImage(image, bounds.x, bounds.y, null);
      }
      if (this.config.showTagUnderline()) {
        const heightOffSet = bounds.y + bounds.height + 2;
        graphics.setColor(color);
        graphics.drawLine(bounds.x, heightOffSet, bounds.x + bounds.width, heightOffSet);
      }
    }
    getTag(itemId) {
      if (this.tagCache.has(itemId)) return this.tagCache.get(itemId);
      const tag = this.plugin.getTag(itemId);
      if (this.tagCache.size >= 39) this.tagCache.delete(this.tagCache.keys().next().value);
      this.tagCache.set(itemId, tag);
      return tag;
    }
    getFillImage(color, itemId, qty) {
      const key = `${itemId}:${qty}`;
      let image = this.fillCache.get(key);
      if (image == null) {
        const icon = itemManager.getImage(itemId, qty, false);
        if (!icon) return null;
        image = ImageUtil.fillImage(icon, ColorUtil.colorWithAlpha(color, this.config.fillOpacity()));
        if (this.fillCache.size >= 32) this.fillCache.delete(this.fillCache.keys().next().value);
        this.fillCache.set(key, image);
      }
      return image;
    }
    invalidateCache() { this.fillCache.clear(); this.tagCache.clear(); }
  }

  class InventoryTagsPlugin {
    constructor() {
      this.configGroup = GROUP;
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.overlay = new InventoryTagsOverlay(this, this.config);
    }
    startUp() { overlayManager.add(this.overlay); this.convertConfig(); }
    shutDown() { overlayManager.remove(this.overlay); }
    getTag(itemId) {
      const tag = configManager.getConfiguration(GROUP, TAG_KEY_PREFIX + itemId);
      if (tag == null || tag === '') return null;
      return fromJson(tag);
    }
    setTag(itemId, tag) { configManager.setConfiguration(GROUP, TAG_KEY_PREFIX + itemId, toJson(tag)); this.overlay.invalidateCache(); }
    unsetTag(itemId) { configManager.unsetConfiguration(GROUP, TAG_KEY_PREFIX + itemId); this.overlay.invalidateCache(); }
    convertConfig() {
      const migrated = configManager.getConfiguration(GROUP, 'migrated');
      if (String(migrated) !== '1') return;
      for (const key of configManager.getConfigurationKeys(GROUP + '.' + ITEM_KEY_PREFIX)) {
        const i = key.indexOf('.');
        if (i > 0) configManager.unsetConfiguration(key.slice(0, i), key.slice(i + 1));
      }
      configManager.setConfiguration(GROUP, 'migrated', '2');
    }
    onConfigChanged(configChanged) {
      if (configChanged.getGroup() === GROUP) this.overlay.invalidateCache();
    }
    // MenuOpened, as the Shift-held MenuEntryAdded of an inventory item's Examine
    onMenuEntryAdded(event) {
      if (!client.isKeyPressed(KeyCode.KC_SHIFT)) return;
      const entry = event.getMenuEntry();
      const type = entry.getType() >= 2000 ? entry.getType() - 2000 : entry.getType();
      if (type !== EXAMINE_ITEM || WidgetUtil.componentToInterface(entry.getParam1()) !== INVENTORY || entry.getOption() !== 'Examine') return;
      const itemId = entry.getItemId();
      if (itemId < 0) return;
      const tag = this.getTag(itemId);
      const submenu = [];
      const invEquipmentColors = [];
      for (const c of [...this.getColorsFromItemContainer(InventoryID.INV), ...this.getColorsFromItemContainer(InventoryID.WORN)]) {
        if (!invEquipmentColors.some((x) => x.equals(c))) invEquipmentColors.push(c);
      }
      // (RuneLite adds each at index 0 of the submenu, so the list shows Reset, Pick, then the colours last to first)
      for (const color of invEquipmentColors) {
        if (tag == null || !tag.color || !tag.color.equals(color)) submenu.unshift({ option: ColorUtil.prependColorTag('Color', color), fn: () => this.setTag(itemId, { color }) });
      }
      submenu.unshift({ option: 'Pick', fn: () => this.pick(itemId, tag == null || !tag.color ? Color.WHITE : tag.color) });
      if (tag != null) submenu.unshift({ option: 'Reset', fn: () => this.unsetTag(itemId) });
      client.createMenuEntry(-1)
        .setOption('Inventory tag')
        .setTarget(entry.getTarget())
        .setType(MenuAction.RUNELITE)
        .onClick(() => {
          const m = rl.chatboxPanelManager.openTextMenuInput('Inventory tag for ' + Text.removeTags(entry.getTarget()));
          for (const o of submenu) m.option(rl.toGameTags ? rl.toGameTags(o.option) : o.option, o.fn);
          m.build();
        });
    }
    // the colour picker's stand-in: RRGGBB typed in the chat box
    pick(itemId, color) {
      rl.chatboxPanelManager.openTextInput('Inventory Tag colour (RRGGBB)')
        .value(ColorUtil.colorToHexCode(color))
        .onDone((v) => {
          const m = /^#?([0-9a-f]{6})$/i.exec(String(v || '').trim());
          if (!m) return;
          this.setTag(itemId, { color: new Color(parseInt(m[1], 16)) });
        }).build();
    }
    getColorsFromItemContainer(inventoryID) {
      const colors = [];
      const container = client.getItemContainer(inventoryID);
      if (container != null) {
        for (const item of container.getItems()) {
          const tag = item && this.getTag(item.getId());
          if (tag != null && tag.color != null && !colors.some((c) => c.equals(tag.color))) colors.push(tag.color);
        }
      }
      return colors;
    }
  }

  const plugin = new InventoryTagsPlugin();
  ll.__inventorytags = { plugin };
  rl.registerPlugin('inventorytags', plugin);
})();
