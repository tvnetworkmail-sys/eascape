// RuneLite's Ground Items plugin, cloned from net.runelite.client.plugins.grounditems (BSD 2-Clause,
// Copyright (c) 2017, Aria <aria@ar1as.space>, Tomas Slusny, Adam and RuneLite contributors):
// GroundItemsPlugin, GroundItemsOverlay, GroundItem, ItemList, ItemThreshold, GroundItemHotkeyListener,
// GroundItemMouseAdapter, MenuEntryWithCount, HighlightTier.
// 2007RS: no prices while the core's switch is off (rl.prices.enabled()): no GE / HA labels, value tiers, value hiding or
// value notifications (the GE and HA prices are taken as 0). The 2007 protocol has no item ownership, despawn or
// visible times (ownership is OWNERSHIP_NONE, so the timers never show), and no ironmen. Lootbeams need RuneLiteObject
// (left out). The "Color" submenu is flat (the 2007 menu has no submenus) and has no colour picker.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Color, Point, Rectangle, Overlay, OverlayPosition, OverlayLayer, BackgroundComponent, TextComponent, Perspective, LocalPoint,
    QuantityFormatter, Text, ColorUtil, MenuAction, KeyCode, HotkeyListener, SwingUtilities, WildcardMatcher, OverlayUtil, itemManager } = rl;

  const GROUP = 'grounditems';
  const HIGHLIGHT_COLOR_PREFIX = 'highlight_';
  const COINS = 995;
  const OWNERSHIP_NONE = 0; const OWNERSHIP_SELF = 1; const OWNERSHIP_OTHER = 2; const OWNERSHIP_GROUP = 3;
  const GAME_TICK_MS = 600;
  const NONE = 0; const HIGHLIGHTED = 1; const HIDDEN = 2;
  const GROUND_ITEM_TYPES = new Set([MenuAction.GROUND_ITEM_FIRST_OPTION, MenuAction.GROUND_ITEM_SECOND_OPTION, MenuAction.GROUND_ITEM_THIRD_OPTION,
    MenuAction.GROUND_ITEM_FOURTH_OPTION, MenuAction.GROUND_ITEM_FIFTH_OPTION]);

  // ---- ItemThreshold / ItemList
  class ItemThreshold {
    constructor(name, quantity, inequality, wildcard) { this.name = name; this.quantity = quantity; this.inequality = inequality; this.wildcard = wildcard; }
    static fromName(entry) {
      if (!entry) return null;
      let operator = 'MORE_THAN'; let qty = 0;
      const wildcard = entry.includes('*');
      for (let i = entry.length - 1; i >= 0; i--) {
        const c = entry.charAt(i);
        if ((c >= '0' && c <= '9') || /\s/.test(c)) continue;
        switch (c) {
          case '<':
            operator = 'LESS_THAN';
          // fallthrough
          case '>':
            if (i + 1 < entry.length) {
              const t = entry.substring(i + 1).trim();
              qty = /^[+-]?\d+$/.test(t) && Math.abs(Number(t)) <= 2147483647 ? Number(t) : 0;
              if (c === '>') operator = 'MORE_THAN';
              entry = entry.substring(0, i);
            }
            break;
          default:
            break;
        }
        break;
      }
      return new ItemThreshold(entry.trim(), qty, operator, wildcard);
    }
    quantityHolds(itemCount) { return this.inequality === 'LESS_THAN' ? itemCount < this.quantity : itemCount > this.quantity; }
  }
  class ItemList {
    constructor(items) { this.items = items.map(ItemThreshold.fromName).filter((x) => x != null); }
    static get NONE() { return 0; }
    static get WILDCARD() { return 1; }
    static get EXACT() { return 2; }
    matches(item) {
      for (const it of this.items) if (!it.wildcard && it.name.toLowerCase() === item.getName().toLowerCase() && it.quantityHolds(item.getQuantity())) return ItemList.EXACT;
      for (const it of this.items) if (it.wildcard && WildcardMatcher.matches(it.name, item.getName()) && it.quantityHolds(item.getQuantity())) return ItemList.WILDCARD;
      return ItemList.NONE;
    }
  }

  // ---- GroundItem
  class GroundItem {
    constructor(o) {
      Object.assign(this, o);
      this.offset = 0; this.highlighted = false; this.hidden = false; this.color = null;
    }
    getId() { return this.id; }
    getItemId() { return this.itemId; }
    getName() { return this.name; }
    getQuantity() { return this.quantity; }
    setQuantity(q) { this.quantity = q; }
    getItemLayer() { return this.itemLayer; }
    getHaPrice() { return this.haPrice * this.quantity; }
    getGePrice() { return this.gePrice * this.quantity; }
    setHaPrice(p) { this.haPrice = p; }
    setGePrice(p) { this.gePrice = p; }
    getOffset() { return this.offset; }
    setOffset(o) { this.offset = o; }
    isTradeable() { return this.tradeable; }
    getOwnership() { return this.ownership; }
    isPrivate() { return this.private; }
    getSpawnTime() { return this.spawnTime; }
    setSpawnTime(t) { this.spawnTime = t; }
    isStackable() { return this.stackable; }
    getDespawnTime() { return this.despawnTime; }
    getVisibleTime() { return this.visibleTime; }
    getColor() { return this.color; }
    reset() { this.highlighted = this.hidden = false; this.color = null; }
  }

  // HashBasedTable<WorldPoint, Integer, GroundItem>
  class Table {
    constructor() { this.rows = new Map(); }
    key(wp) { return `${wp.x},${wp.y},${wp.plane}`; }
    get(wp, id) { const r = this.rows.get(this.key(wp)); return r ? r.get(id) || null : null; }
    put(wp, id, v) { const k = this.key(wp); if (!this.rows.has(k)) this.rows.set(k, new Map()); this.rows.get(k).set(id, v); }
    remove(wp, id) { const k = this.key(wp); const r = this.rows.get(k); if (!r) return; r.delete(id); if (!r.size) this.rows.delete(k); }
    values() { const out = []; for (const r of this.rows.values()) for (const v of r.values()) out.push(v); return out; }
    clear() { this.rows.clear(); }
  }

  // ---- GroundItemsOverlay
  const MAX_DISTANCE = 2500;
  const OFFSET_Z = 20;
  const STRING_GAP = 15;
  const RECTANGLE_SIZE = 8;
  const PUBLIC_TIMER_COLOR = Color.YELLOW;
  const PRIVATE_TIMER_COLOR = Color.GREEN;
  const TIMER_OVERLAY_DIAMETER = 10;

  class GroundItemsOverlay extends Overlay {
    constructor(plugin) {
      super();
      this.plugin = plugin; this.config = plugin.config;
      this.backgroundComponent = new BackgroundComponent();
      this.textComponent = new TextComponent();
      this.offsetMap = new Map();
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_SCENE);
    }

    render(graphics) {
      const { plugin, config } = this;
      const mode = config.itemHighlightMode();
      const dontShowOverlay = (mode === 'MENU' || mode === 'NONE' || plugin.hideAll) && !plugin.hotKeyPressed;
      if (dontShowOverlay && !config.highlightTiles()) return null;
      const fm = graphics.getFontMetrics();
      const player = client.getLocalPlayer();
      if (player == null) return null;
      const offsetMap = this.offsetMap;
      offsetMap.clear();
      const bump = (wp) => { const k = `${wp.x},${wp.y},${wp.plane}`; const v = offsetMap.has(k) ? offsetMap.get(k) + 1 : 0; offsetMap.set(k, v); return v; };
      const mousePos = client.getMouseCanvasPosition();
      let groundItemList = plugin.collectedGroundItems.values();
      let topGroundItem = null;
      if (plugin.hotKeyPressed) {
        let groundItem = null;
        for (const item of groundItemList) {
          item.setOffset(bump(item.getItemLayer().getWorldLocation()));
          if (groundItem != null) continue;
          if (plugin.textBoxBounds != null && item === plugin.textBoxBounds[1] && plugin.textBoxBounds[0].contains(mousePos)) { groundItem = item; continue; }
          if (plugin.hiddenBoxBounds != null && item === plugin.hiddenBoxBounds[1] && plugin.hiddenBoxBounds[0].contains(mousePos)) { groundItem = item; continue; }
          if (plugin.highlightBoxBounds != null && item === plugin.highlightBoxBounds[1] && plugin.highlightBoxBounds[0].contains(mousePos)) groundItem = item;
        }
        if (groundItem != null) {
          groundItemList = groundItemList.filter((g) => g !== groundItem);
          groundItemList.push(groundItem);
          topGroundItem = groundItem;
        }
      }
      plugin.textBoxBounds = null; plugin.hiddenBoxBounds = null; plugin.highlightBoxBounds = null;
      const localLocation = player.getLocalLocation();
      const groundItemTimers = config.groundItemTimers();
      const outline = config.textOutline();
      const ownershipFilterMode = config.ownershipFilterMode();
      const accountType = 0; // (no ironmen in 2007: VarbitID.IRONMAN)
      const prices = rl.prices.enabled();
      for (const item of groundItemList) {
        const groundPoint = LocalPoint.fromWorld(client, item.getItemLayer().getWorldLocation());
        if (groundPoint == null || localLocation.distanceTo(groundPoint) > MAX_DISTANCE
          || !plugin.shouldDisplayItem(ownershipFilterMode, item.getOwnership(), accountType)) continue;
        plugin.updateItemColor(item);
        if (!item.highlighted && !plugin.hotKeyPressed) {
          if (item.hidden) continue;
          if (config.showHighlightedOnly()) continue;
        }
        const color = item.color;
        if (config.highlightTiles()) {
          const poly = Perspective.getCanvasTilePoly(client, groundPoint, item.getItemLayer().getHeight());
          if (poly != null) OverlayUtil.renderPolygon(graphics, poly, color);
        }
        if (dontShowOverlay) continue;
        let itemString = item.getName();
        if (item.getQuantity() > 1) itemString += ' (' + QuantityFormatter.quantityToStackSize(item.getQuantity()) + ')';
        if (item.getId() !== COINS && prices) {
          const displayMode = config.priceDisplayMode();
          if (displayMode === 'BOTH') {
            if (item.getGePrice() > 0) itemString += ' (GE: ' + QuantityFormatter.quantityToStackSize(item.getGePrice()) + ' gp)';
            if (item.getHaPrice() > 0) itemString += ' (HA: ' + QuantityFormatter.quantityToStackSize(item.getHaPrice()) + ' gp)';
          } else if (displayMode !== 'OFF') {
            const price = displayMode === 'GE' ? item.getGePrice() : item.getHaPrice();
            if (price > 0) itemString += ' (' + QuantityFormatter.quantityToStackSize(price) + ' gp)';
          }
        }
        const textPoint = Perspective.getCanvasTextLocation(client, graphics, groundPoint, itemString, item.getItemLayer().getHeight() + OFFSET_Z);
        if (textPoint == null) continue;
        const offset = plugin.hotKeyPressed ? item.getOffset() : bump(item.getItemLayer().getWorldLocation());
        const textX = textPoint.getX();
        const textY = textPoint.getY() - STRING_GAP * offset;
        if (plugin.hotKeyPressed) {
          const stringWidth = fm.stringWidth(itemString);
          const stringHeight = fm.getHeight();
          let x = textX - 2; let y = textY - stringHeight - 2; let width = stringWidth + 4; let height = stringHeight + 4;
          const itemBounds = new Rectangle(x, y, width, height);
          x += width + 2;
          y = textY - Math.trunc((RECTANGLE_SIZE + stringHeight) / 2);
          width = height = RECTANGLE_SIZE;
          const itemHiddenBox = new Rectangle(x, y, width, height);
          x += width + 2;
          const itemHighlightBox = new Rectangle(x, y, width, height);
          const mouseInBox = itemBounds.contains(mousePos.getX(), mousePos.getY());
          const mouseInHiddenBox = itemHiddenBox.contains(mousePos.getX(), mousePos.getY());
          const mouseInHighlightBox = itemHighlightBox.contains(mousePos.getX(), mousePos.getY());
          if (mouseInBox) plugin.textBoxBounds = [itemBounds, item];
          else if (mouseInHiddenBox) plugin.hiddenBoxBounds = [itemHiddenBox, item];
          else if (mouseInHighlightBox) plugin.highlightBoxBounds = [itemHighlightBox, item];
          const topItem = topGroundItem === item;
          if (topItem && (mouseInBox || mouseInHiddenBox || mouseInHighlightBox)) {
            this.backgroundComponent.setRectangle(itemBounds);
            this.backgroundComponent.render(graphics);
          }
          this.drawRectangle(graphics, itemHiddenBox, topItem && mouseInHiddenBox ? Color.RED : color, item.hidden, true);
          this.drawRectangle(graphics, itemHighlightBox, topItem && mouseInHighlightBox ? Color.GREEN : color, item.highlighted, false);
        }
        if (groundItemTimers === 'PIE' || plugin.hotKeyPressed) {
          this.drawTimerPieOverlay(graphics, textX, textY, item);
        } else if (groundItemTimers === 'SECONDS' || groundItemTimers === 'TICKS') {
          const despawnTime = this.calculateDespawnTime(item);
          const timerColor = this.getItemTimerColor(item);
          if (despawnTime != null && timerColor != null) {
            const despawnTimeMillis = despawnTime - Date.now();
            const timerText = groundItemTimers === 'SECONDS' ? ` - ${(despawnTimeMillis / 1000).toFixed(1)}` : ` - ${Math.trunc(despawnTimeMillis / 600)}`;
            this.textComponent.setText(timerText);
            this.textComponent.setColor(timerColor);
            this.textComponent.setOutline(outline);
            this.textComponent.setPosition(new Point(textX + fm.stringWidth(itemString), textY));
            this.textComponent.render(graphics);
          }
        }
        this.textComponent.setText(itemString);
        this.textComponent.setColor(color);
        this.textComponent.setOutline(outline);
        this.textComponent.setPosition(new Point(textX, textY));
        this.textComponent.render(graphics);
      }
      return null;
    }

    // (times in epoch ms)
    calculateDespawnTime(groundItem) {
      const spawnTime = groundItem.getSpawnTime();
      if (spawnTime == null) return null;
      const despawnTime = spawnTime + groundItem.getDespawnTime();
      if (Date.now() > despawnTime) return null;
      return despawnTime;
    }

    getItemTimerColor(groundItem) {
      const spawnTime = groundItem.getSpawnTime();
      if (spawnTime == null) return null;
      const now = Date.now();
      const despawnTime = spawnTime + groundItem.getDespawnTime();
      if (groundItem.isPrivate()) return despawnTime > now ? PRIVATE_TIMER_COLOR : null;
      const visibleTime = spawnTime + groundItem.getVisibleTime();
      if (visibleTime > now) return PRIVATE_TIMER_COLOR;
      if (despawnTime > now) return PUBLIC_TIMER_COLOR;
      return null;
    }

    // ProgressPieComponent
    drawTimerPieOverlay(graphics, textX, textY, groundItem) {
      const now = Date.now();
      const spawnTime = groundItem.getSpawnTime();
      const despawnTime = this.calculateDespawnTime(groundItem);
      const fillColor = this.getItemTimerColor(groundItem);
      if (spawnTime == null || despawnTime == null || fillColor == null) return;
      const percent = (now - spawnTime) / (despawnTime - spawnTime);
      const d = TIMER_OVERLAY_DIAMETER;
      const x = textX - d; const y = textY - Math.trunc(d / 2);
      const ctx = graphics.ctx;
      const progress = 1 - percent;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, d / 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); ctx.closePath();
      ctx.fillStyle = fillColor.css(); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, d / 2, 0, Math.PI * 2); ctx.strokeStyle = fillColor.css(); ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }

    drawRectangle(graphics, rect, color, inList, hiddenBox) {
      graphics.setColor(Color.BLACK);
      graphics.drawRect(rect.x + 1, rect.y + 1, rect.width, rect.height);
      graphics.setColor(color);
      graphics.drawRect(rect.x, rect.y, rect.width, rect.height);
      if (inList) graphics.fillRect(rect.x, rect.y, rect.width, rect.height);
      graphics.setColor(Color.WHITE);
      graphics.drawLine(rect.x + 2, rect.y + Math.trunc(rect.height / 2), rect.x + rect.width - 2, rect.y + Math.trunc(rect.height / 2));
      if (!hiddenBox) graphics.drawLine(rect.x + Math.trunc(rect.width / 2), rect.y + 2, rect.x + Math.trunc(rect.width / 2), rect.y + rect.height - 2);
    }
  }

  // ---- GroundItemHotkeyListener
  class GroundItemHotkeyListener extends HotkeyListener {
    constructor(plugin) {
      super(() => plugin.config.hotkey());
      this.plugin = plugin; this.lastPress = null;
    }
    hotkeyPressed() {
      const { plugin } = this;
      if (plugin.hideAll) {
        plugin.hideAll = false; plugin.hotKeyPressed = true; this.lastPress = null;
      } else if (this.lastPress != null && !plugin.hotKeyPressed && plugin.config.doubleTapDelay() > 0 && Date.now() - this.lastPress < plugin.config.doubleTapDelay()) {
        plugin.hideAll = true; this.lastPress = null;
      } else {
        plugin.hotKeyPressed = true; this.lastPress = Date.now();
      }
    }
    hotkeyReleased() {
      const { plugin } = this;
      plugin.hotKeyPressed = false;
      plugin.textBoxBounds = null; plugin.hiddenBoxBounds = null; plugin.highlightBoxBounds = null;
    }
  }

  // ---- GroundItemMouseAdapter
  class GroundItemMouseAdapter {
    constructor(plugin) { this.plugin = plugin; }
    mousePressed(e) {
      const { plugin } = this;
      const mousePos = e.getPoint();
      if (plugin.hotKeyPressed) {
        if (SwingUtilities.isLeftMouseButton(e)) {
          if (plugin.hiddenBoxBounds != null && plugin.hiddenBoxBounds[0].contains(mousePos)) { plugin.updateList(plugin.hiddenBoxBounds[1].getName(), true); e.consume(); return e; }
          if (plugin.highlightBoxBounds != null && plugin.highlightBoxBounds[0].contains(mousePos)) { plugin.updateList(plugin.highlightBoxBounds[1].getName(), false); e.consume(); return e; }
          if (plugin.textBoxBounds != null && plugin.textBoxBounds[0].contains(mousePos)) { plugin.updateList(plugin.textBoxBounds[1].getName(), false); e.consume(); return e; }
        } else if (SwingUtilities.isRightMouseButton(e)) {
          if (plugin.textBoxBounds != null && plugin.textBoxBounds[0].contains(mousePos)) { plugin.updateList(plugin.textBoxBounds[1].getName(), true); e.consume(); return e; }
        }
      }
      return e;
    }
  }

  // ---- GroundItemsPlugin
  class GroundItemsPlugin {
    constructor() {
      this.configGroup = GROUP;
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.textBoxBounds = null; this.hiddenBoxBounds = null; this.highlightBoxBounds = null;
      this.hotKeyPressed = false; this.hideAll = false;
      this.highlightedItems = new ItemList([]);
      this.hiddenItems = new ItemList([]);
      this.collectedGroundItems = new Table();
      this.priceChecks = [];
      this.overlay = new GroundItemsOverlay(this);
      this.hotkeyListener = new GroundItemHotkeyListener(this);
      this.mouseAdapter = new GroundItemMouseAdapter(this);
    }

    startUp() {
      rl.overlayManager.add(this.overlay);
      rl.mouseManager.registerMouseListener(this.mouseAdapter);
      rl.keyManager.registerKeyListener(this.hotkeyListener);
      this.migrate();
      this.reset();
    }

    shutDown() {
      rl.overlayManager.remove(this.overlay);
      rl.mouseManager.unregisterMouseListener(this.mouseAdapter);
      rl.keyManager.unregisterKeyListener(this.hotkeyListener);
      this.collectedGroundItems.clear();
    }

    onConfigChanged(event) { if (event.getGroup() === GROUP) this.reset(); }
    onProfileChanged() { this.migrate(); }

    migrate() {
      const onlyShowOwnItems = rl.configManager.getConfiguration(GROUP, 'onlyShowLoot');
      if (onlyShowOwnItems != null) {
        if (onlyShowOwnItems === true || onlyShowOwnItems === 'true') rl.configManager.setConfiguration(GROUP, 'ownershipFilterMode', 'DROPS');
        rl.configManager.unsetConfiguration(GROUP, 'onlyShowLoot');
      }
    }

    onItemSpawned(itemSpawned) {
      const item = itemSpawned.getItem();
      const tile = itemSpawned.getTile();
      const layer = { getWorldLocation: () => tile.getWorldLocation(), getHeight: () => 0 };
      const groundItem = this.buildGroundItem(layer, item);
      const existing = this.collectedGroundItems.get(tile.getWorldLocation(), item.getId());
      if (existing != null) {
        existing.setQuantity(existing.getQuantity() + groundItem.getQuantity());
        existing.reset();
      } else {
        this.collectedGroundItems.put(tile.getWorldLocation(), item.getId(), groundItem);
      }
      if (this.shouldDisplayItem(this.config.ownershipFilterMode(), groundItem.getOwnership(), 0)) this.notifyHighlightedItem(groundItem);
    }

    updateItemColor(item) {
      if (item.color != null) return;
      const highlighted = this.getHighlighted(item);
      const hidden = this.isHidden(item);
      item.highlighted = highlighted != null;
      item.hidden = hidden;
      item.color = this.getItemColorFor(highlighted, hidden);
    }

    onItemDespawned(itemDespawned) {
      const item = itemDespawned.getItem();
      const tile = itemDespawned.getTile();
      const groundItem = this.collectedGroundItems.get(tile.getWorldLocation(), item.getId());
      if (groundItem == null) return;
      if (groundItem.getQuantity() <= item.getQuantity()) {
        this.collectedGroundItems.remove(tile.getWorldLocation(), item.getId());
      } else {
        groundItem.setQuantity(groundItem.getQuantity() - item.getQuantity());
        groundItem.setSpawnTime(null);
        groundItem.reset();
      }
    }

    onItemQuantityChanged(e) {
      const item = e.getItem();
      const tile = e.getTile();
      const diff = e.getNewQuantity() - e.getOldQuantity();
      const groundItem = this.collectedGroundItems.get(tile.getWorldLocation(), item.getId());
      if (groundItem != null) {
        groundItem.setQuantity(groundItem.getQuantity() + diff);
        groundItem.reset();
      }
    }

    onClientTick() {
      if (!this.config.collapseEntries()) return;
      const menuEntries = client.getMenuEntries();
      const newEntries = [];
      outer:
      for (let i = menuEntries.length - 1; i >= 0; i--) {
        const menuEntry = menuEntries[i];
        const menuType = menuEntry.getType();
        if (GROUND_ITEM_TYPES.has(menuType) || menuType === MenuAction.EXAMINE_ITEM_GROUND) {
          for (const entryWCount of newEntries) {
            if (entryWCount.entry.equals(menuEntry)) { entryWCount.count++; continue outer; }
          }
        }
        newEntries.push({ entry: menuEntry, count: 1 });
      }
      newEntries.reverse();
      client.setMenuEntries(newEntries.map((e) => {
        if (e.count > 1) e.entry.setTarget(e.entry.getTarget() + ' x ' + e.count);
        return e.entry;
      }));
    }

    buildGroundItem(layer, item) {
      const itemId = item.getId();
      const itemComposition = itemManager.getItemComposition(itemId);
      const realItemId = itemComposition.getNote() !== -1 ? itemComposition.getLinkedNoteId() : itemId;
      const prices = rl.prices.enabled();
      const alchPrice = prices ? itemComposition.getHaPrice() : 0;
      // (the 2007 protocol has no despawn or visible times: TileItem's are 0)
      const despawnTime = (item.getDespawnTime ? item.getDespawnTime() : 0) - client.getTickCount();
      const visibleTime = (item.getVisibleTime ? item.getVisibleTime() : 0) - client.getTickCount();
      const groundItem = new GroundItem({
        id: itemId, itemId: realItemId, quantity: item.getQuantity(), itemLayer: layer, name: itemComposition.getName(), haPrice: alchPrice,
        tradeable: itemComposition.isGeTradeable(), ownership: item.getOwnership ? item.getOwnership() : OWNERSHIP_NONE, private: item.isPrivate ? item.isPrivate() : false,
        spawnTime: Date.now(), stackable: itemComposition.isStackable(), despawnTime: despawnTime * GAME_TICK_MS, visibleTime: visibleTime * GAME_TICK_MS,
        gePrice: 0,
      });
      if (!prices) return groundItem;
      if (realItemId === COINS) { groundItem.setHaPrice(1); groundItem.setGePrice(1); } else groundItem.setGePrice(itemManager.getItemPrice(realItemId));
      return groundItem;
    }

    reset() {
      const config = this.config;
      this.highlightedItems = new ItemList(Text.fromCSV(config.getHighlightItems()));
      this.hiddenItems = new ItemList(Text.fromCSV(config.getHiddenItems()));
      const checks = [];
      if (rl.prices.enabled()) {
        if (config.insaneValuePrice() > 0) checks.push({ price: config.insaneValuePrice(), color: config.insaneValueColor() });
        if (config.highValuePrice() > 0) checks.push({ price: config.highValuePrice(), color: config.highValueColor() });
        if (config.mediumValuePrice() > 0) checks.push({ price: config.mediumValuePrice(), color: config.mediumValueColor() });
        if (config.lowValuePrice() > 0) checks.push({ price: config.lowValuePrice(), color: config.lowValueColor() });
      }
      this.priceChecks = checks;
      for (const g of this.collectedGroundItems.values()) g.reset();
    }

    onMenuEntryAdded(event) {
      const type = MenuAction.of(event.getType());
      const hotKeyPressed = client.isKeyPressed(KeyCode.KC_SHIFT);
      const config = this.config;
      if (GROUND_ITEM_TYPES.has(type) || type === MenuAction.WIDGET_TARGET_ON_GROUND_ITEM) {
        const itemId = event.getIdentifier();
        const sceneX = event.getActionParam0();
        const sceneY = event.getActionParam1();
        const lastEntry = event.getMenuEntry();
        const worldPoint = new rl.WorldPoint(client.getBaseX() + sceneX, client.getBaseY() + sceneY, client.getPlane());
        const groundItem = this.collectedGroundItems.get(worldPoint, itemId);
        if (groundItem == null) return; // (RuneLite would throw)
        this.updateItemColor(groundItem);
        const quantity = groundItem.getQuantity();
        const canBeRecolored = groundItem.highlighted || (groundItem.hidden && config.recolorMenuHiddenItems());
        const ihm = config.itemHighlightMode();
        if ((ihm === 'MENU' || ihm === 'BOTH') && canBeRecolored && !groundItem.color.equals(config.defaultColor())) {
          const mode = config.menuHighlightMode();
          if (mode === 'BOTH' || mode === 'OPTION') lastEntry.setOption(ColorUtil.prependColorTag(lastEntry.getOption(), groundItem.color));
          if (mode === 'BOTH' || mode === 'NAME') {
            const target = lastEntry.getTarget();
            const i = target.lastIndexOf('>');
            if (i >= 11) lastEntry.setTarget(target.substring(0, i - 11) + ColorUtil.prependColorTag('', groundItem.color) + target.substring(i + 1));
          }
        }
        if (config.showMenuItemQuantities() && groundItem.isStackable() && quantity > 1) lastEntry.setTarget(lastEntry.getTarget() + ' (' + quantity + ')');
        if (groundItem.hidden && !groundItem.highlighted && config.deprioritizeHiddenItems()) lastEntry.setDeprioritized(true);
      } else if (hotKeyPressed && type === MenuAction.EXAMINE_ITEM_GROUND) {
        // (RuneLite: a "Color" entry with a submenu; the 2007 menu has none, so its entries go in the menu itself)
        const itemId = event.getIdentifier();
        const color = this.getItemColor(itemId);
        if (color != null) {
          client.createMenuEntry(-1).setOption('Reset color').setTarget(event.getTarget()).setType(MenuAction.RUNELITE).onClick(() => this.unsetItemColor(itemId));
        }
        const colors = [];
        for (const c of [...this.collectedGroundItems.values().map((g) => g.getColor()).filter((c) => c != null), Color.RED, Color.GREEN, Color.BLUE, Color.YELLOW, Color.MAGENTA]) {
          if (!colors.some((x) => x.equals(c))) colors.push(c);
          if (colors.length >= 5) break;
        }
        colors.filter((c) => !c.equals(color)).forEach((c) => client.createMenuEntry(-1)
          .setOption(ColorUtil.prependColorTag('Color', c)).setTarget(event.getTarget()).setType(MenuAction.RUNELITE).onClick(() => this.setItemColor(itemId, c)));
      }
    }

    updateList(item, hiddenList) {
      const hiddenItemSet = [...Text.fromCSV(this.config.getHiddenItems())];
      const highlightedItemSet = [...Text.fromCSV(this.config.getHighlightItems())];
      const eq = (x) => x.toLowerCase() === item.toLowerCase();
      const removeIf = (arr) => { let r = false; for (let i = arr.length - 1; i >= 0; i--) if (eq(arr[i])) { arr.splice(i, 1); r = true; } return r; };
      if (hiddenList) removeIf(highlightedItemSet); else removeIf(hiddenItemSet);
      const items = hiddenList ? hiddenItemSet : highlightedItemSet;
      if (!removeIf(items)) items.push(item);
      rl.configManager.setConfiguration(GROUP, 'hiddenItems', Text.toCSV(hiddenItemSet));
      rl.configManager.setConfiguration(GROUP, 'highlightedItems', Text.toCSV(highlightedItemSet));
      this.reset();
    }

    getHighlighted(groundItem) {
      const itemColor = this.getItemColor(groundItem.getItemId());
      const hiddenOrHighlighted = this.isHiddenOrHighlighted(groundItem);
      if (hiddenOrHighlighted === HIGHLIGHTED) return itemColor != null ? itemColor : this.config.highlightedColor();
      if (hiddenOrHighlighted === HIDDEN) return null;
      if (itemColor != null) return itemColor;
      const price = this.getValueByMode(groundItem.getGePrice(), groundItem.getHaPrice());
      for (const highlight of this.priceChecks) if (price > highlight.price) return highlight.color;
      return null;
    }

    isHidden(groundItem) {
      const hiddenOrHighlighted = this.isHiddenOrHighlighted(groundItem);
      const hideUnder = rl.prices.enabled() ? this.config.getHideUnderValue() : 0;
      const canBeHidden = groundItem.getGePrice() > 0 || groundItem.isTradeable() || !this.config.dontHideUntradeables();
      const underGe = groundItem.getGePrice() < hideUnder;
      const underHa = groundItem.getHaPrice() < hideUnder;
      return hiddenOrHighlighted === HIDDEN || (hiddenOrHighlighted !== HIGHLIGHTED && canBeHidden && underGe && underHa);
    }

    isHiddenOrHighlighted(item) {
      const hl = this.highlightedItems.matches(item);
      if (hl === ItemList.EXACT) return HIGHLIGHTED;
      const hi = this.hiddenItems.matches(item);
      if (hi === ItemList.EXACT) return HIDDEN;
      if (hl === ItemList.WILDCARD) return HIGHLIGHTED;
      if (hi === ItemList.WILDCARD) return HIDDEN;
      return NONE;
    }

    getItemColorFor(highlighted, hidden) {
      if (highlighted != null) return highlighted;
      if (hidden) return this.config.hiddenColor();
      return this.config.defaultColor();
    }

    onFocusChanged(focusChanged) { if (!focusChanged.isFocused()) this.hotKeyPressed = false; }

    notifyHighlightedItem(item) {
      const config = this.config;
      const hiddenOrHighlighted = this.isHiddenOrHighlighted(item);
      const shouldNotifyHighlighted = config.notifyHighlightedDrops() && hiddenOrHighlighted === HIGHLIGHTED;
      const tier = config.notifyTier();
      const shouldNotifyTier = rl.prices.enabled() && tier !== 'OFF' && this.getValueByMode(item.getGePrice(), item.getHaPrice()) > this.tierValue(tier) && hiddenOrHighlighted !== HIDDEN;
      let dropType;
      if (shouldNotifyHighlighted) dropType = 'highlighted';
      else if (shouldNotifyTier) dropType = 'valuable';
      else return;
      let s = 'You received a ' + dropType + ' drop: ' + item.getName();
      if (item.getQuantity() > 1) s += ' (' + QuantityFormatter.quantityToStackSize(item.getQuantity()) + ')';
      rl.notifier.notify(s);
    }

    // HighlightTier.getValueFromTier
    tierValue(tier) {
      const c = this.config;
      return { LOW: c.lowValuePrice(), MEDIUM: c.mediumValuePrice(), HIGH: c.highValuePrice(), INSANE: c.insaneValuePrice() }[tier];
    }

    getValueByMode(gePrice, haPrice) {
      switch (this.config.valueCalculationMode()) {
        case 'GE': return gePrice;
        case 'HA': return haPrice;
        default: return Math.max(gePrice, haPrice);
      }
    }

    getItemColor(itemId) { const v = rl.configManager.getConfiguration(GROUP, HIGHLIGHT_COLOR_PREFIX + itemId); return v == null ? null : Color.parse(v); }
    setItemColor(itemId, color) { rl.configManager.setConfiguration(GROUP, HIGHLIGHT_COLOR_PREFIX + itemId, '#' + color.getRGB().toString(16).padStart(8, '0')); this.reset(); }
    unsetItemColor(itemId) { rl.configManager.unsetConfiguration(GROUP, HIGHLIGHT_COLOR_PREFIX + itemId); this.reset(); }

    shouldDisplayItem(filterMode, ownership, accountType) {
      switch (filterMode) {
        case 'DROPS': return ownership === OWNERSHIP_SELF || ownership === OWNERSHIP_GROUP;
        case 'TAKEABLE': return ownership !== OWNERSHIP_OTHER || accountType === 0;
        default: return true;
      }
    }
  }

  rl.registerPlugin('grounditems', new GroundItemsPlugin());
})();
