// RuneLite's Bank plugin, cloned from net.runelite.client.plugins.bank (BSD 2-Clause, Copyright (c) 2018, TheLonelyDev
// <https://github.com/TheLonelyDev>, Jeremy Plsek <https://github.com/jplsek> and RuneLite contributors): BankPlugin,
// BankSearch (the core's rl.bankSearch: the 2007 bank has no search of its own, so the core emulates OSRS's search and
// Deposit inventory buttons over it), ContainerPrices.
// Adapted: no prices (rl.prices.enabled() off): the value title and the ge / ha / alch value searches only work with
// prices on; qty searches always do. Left out (not in the 2007 bank, or later): Deposit worn items, Empty containers,
// the group storage and the seed vault, the potion store, the Jagex account popup, the bank pin keypad.
// 2007RS's own: placeholders (OSRS's, 2016), kept with the account by the server (engine AppBank) and drawn only here:
// the runtime's bank view leaves their positions empty, this draws the item greyed with a 0, and a spot's menu
// releases it (the server's ::appbank commands). The browser client never sees them.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, QuantityFormatter, Overlay, OverlayPosition, OverlayLayer, itemManager, Color } = rl;

  // ---- placeholders (2007RS)
  const SLOT = 32;
  // the item's sprite at half strength (Graphics2D here has no composite), kept by item
  const faded = new Map();
  function fadedIcon(id) {
    if (faded.has(id)) return faded.get(id);
    const img = rl.toImage ? rl.toImage(itemManager.getImage(id, 1)) : null;
    if (!img || !img.width) return null;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const cx = c.getContext('2d');
    cx.globalAlpha = 0.5;
    cx.drawImage(img, 0, 0);
    faded.set(id, c);
    return c;
  }
  /** The bank's slots on the canvas: [{ slot, id, x, y }] for each placeholder in view, and the item layer's clip. */
  function placeholderSlots() {
    const b = ll.bank;
    if (!b || !b.open || !b.installed || !b.ph || !b.ph.size || !ll.api || !ll.api.com) return null;
    const inv = ll.api.com(ll.BANK.inv);
    if (!inv || !inv.screen || inv.hide) return null;
    const layer = inv.layer >= 0 ? ll.api.com(inv.layer) : null;
    const clip = layer && layer.screen ? { x: layer.screen[0], y: layer.screen[1], w: layer.width, h: layer.height } : null;
    const cols = Math.max(1, inv.width | 0);
    const out = [];
    const n = b.map ? b.map.length : 0;
    for (let i = 0; i < n; i++) {
      const id = ll.bankPlaceholderAt(i);
      if (id < 0) continue;
      const x = inv.screen[0] + (i % cols) * (SLOT + (inv.marginX | 0));
      const y = inv.screen[1] + Math.floor(i / cols) * (SLOT + (inv.marginY | 0));
      if (clip && (y + SLOT <= clip.y || y >= clip.y + clip.h)) continue;
      out.push({ slot: i, id, x, y });
    }
    return { list: out, clip };
  }
  // the placeholder's position counting the others (what the server keeps)
  function combinedOf(id) {
    for (const [c, x] of ll.bank.ph) if (x === id) return c;
    return -1;
  }
  class PlaceholderOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_WIDGETS);
    }
    getName() { return 'BankPlaceholders'; }
    render(g) {
      const p = placeholderSlots();
      if (!p) return null;
      if (p.clip) g.setClip(new rl.Rectangle(p.clip.x, p.clip.y, p.clip.w, p.clip.h));
      g.setFont(rl.FontManager.getRunescapeSmallFont());
      for (const s of p.list) {
        const icon = fadedIcon(s.id);
        if (icon) g.drawImage(icon, s.x, s.y);
        g.setColor(Color.BLACK);
        g.drawString('0', s.x + 1, s.y + 10);
        g.setColor(Color.YELLOW);
        g.drawString('0', s.x, s.y + 9);
      }
      g.setClip(null);
      return null;
    }
  }

  const DEPOSIT_INVENTORY = 'Deposit inventory';
  const NUMBER_REGEX = '[0-9]+(\\.[0-9]+)?[kmb]?';
  const VALUE_SEARCH_PATTERN = new RegExp('^(?<mode>qty|ge|ha|alch)?'
    + ' *(?<individual>i|iv|individual|per)?'
    + ' *(((?<op>[<>=]|>=|<=) *(?<num>' + NUMBER_REGEX + '))|'
    + '((?<num1>' + NUMBER_REGEX + ') *- *(?<num2>' + NUMBER_REGEX + ')))$', 'i');

  // QuantityFormatter.parseQuantity: "1.5k" -> 1500 (ParseException as null)
  function parseQuantity(s) {
    const m = /^([0-9]+(?:\.[0-9]+)?)([kmb]?)$/i.exec(String(s).trim());
    if (!m) return null;
    const mult = { '': 1, k: 1e3, m: 1e6, b: 1e9 }[m[2].toLowerCase()];
    return Math.trunc(Number(m[1]) * mult);
  }

  class BankPlugin {
    constructor() { this.configGroup = 'bank'; }

    startUp() {
      this.config = rl.configProxy('bank', () => this.configItems);
      this.bankSearch = rl.bankSearch;
      this.forceRightClickFlag = false;
      this.bankOpen = false;
      this.itemQuantities = null;
      this.searchHotkeyListener = {
        keyTyped() {},
        keyPressed: (e) => {
          if (!rl.Keybind.matches(this.config.searchKeybind(), e)) return;
          if (this.bankOpen) {
            this.bankSearch.initSearch();
            e.consume();
          }
          // (group storage and the seed vault: not in 2007)
        },
        keyReleased() {},
      };
      rl.keyManager.registerKeyListener(this.searchHotkeyListener);
      // placeholders: drawn over the bank, released from their menu (left click: Release)
      this.placeholderOverlay = new PlaceholderOverlay(this);
      rl.overlayManager.add(this.placeholderOverlay);
      this.placeholderMenu = (c) => {
        if (client.isMenuOpen()) return;
        const p = placeholderSlots();
        if (!p) return;
        const m = client.getMouseCanvasPosition();
        const mx = m.getX(); const my = m.getY();
        if (p.clip && (mx < p.clip.x || my < p.clip.y || mx >= p.clip.x + p.clip.w || my >= p.clip.y + p.clip.h)) return;
        const s = p.list.find((x) => mx >= x.x && mx < x.x + SLOT && my >= x.y && my < x.y + SLOT);
        if (!s) return;
        const name = rl.toGameTags('<col=ff9040>' + itemManager.getItemComposition(s.id).getName() + '</col>');
        const n = () => c[ll.fields.menuCount] | 0;
        ll.insertMenuEntry(c, n(), 'Release-all placeholders', () => ll.api.command('appbank releaseall'));
        ll.insertMenuEntry(c, n(), 'Release ' + name, () => { const at = combinedOf(s.id); if (at >= 0) ll.api.command('appbank release ' + at); });
      };
      rl.menuBuildHooks.push(this.placeholderMenu);
      this.sendPlaceholders();
    }

    /** The placeholders setting to the server (it answers with the bank's placeholders). */
    sendPlaceholders(force = true) {
      const on = !!this.config.placeholders();
      if (!force && on === this.sentPlaceholders) return;
      if (client.getGameState() !== rl.GameState.LOGGED_IN || !ll.api || !ll.api.command) return;
      if (ll.api.command('appbank ph ' + (on ? 'on' : 'off')) !== false) this.sentPlaceholders = on;
    }

    // (once a login: LOGGED_IN comes again after each map load)
    onGameStateChanged(event) {
      const s = event.getGameState();
      if (s === rl.GameState.LOGIN_SCREEN) this.sentPlaceholders = undefined;
      else if (s === rl.GameState.LOGGED_IN && this.sentPlaceholders === undefined) this.sendPlaceholders();
    }

    // (the app's config updates come with no key: only a change of the setting is sent)
    onConfigChanged(event) { if (event.getGroup() === 'bank') this.sendPlaceholders(false); }

    shutDown() {
      rl.keyManager.unregisterKeyListener(this.searchHotkeyListener);
      rl.overlayManager.remove(this.placeholderOverlay);
      const at = rl.menuBuildHooks.indexOf(this.placeholderMenu);
      if (at >= 0) rl.menuBuildHooks.splice(at, 1);
      this.bankSearch.reset(false);
      this.forceRightClickFlag = false;
      this.bankOpen = false;
      this.itemQuantities = null;
    }

    onMenuShouldLeftClick(event) {
      if (!this.forceRightClickFlag) return;
      this.forceRightClickFlag = false;
      for (const entry of client.getMenuEntries()) {
        if (entry.getOption() === DEPOSIT_INVENTORY && this.config.rightClickBankInventory()) {
          event.setForceRightClick(true);
          return;
        }
      }
    }

    onMenuEntryAdded(event) {
      if (event.getOption() === DEPOSIT_INVENTORY && this.config.rightClickBankInventory()) this.forceRightClickFlag = true;
    }

    onScriptCallbackEvent(event) {
      const intStack = client.getIntStack();
      const objectStack = client.getObjectStack();
      const intStackSize = client.getIntStackSize();
      const objectStackSize = client.getObjectStackSize();
      if (event.getEventName() === 'bankSearchFilter') {
        const itemId = intStack[intStackSize - 1];
        const search = objectStack[objectStackSize - 1];
        if (this.valueSearch(itemId, search)) intStack[intStackSize - 2] = 1;
      }
    }

    onWidgetLoaded(event) { if (event.getGroupId() === 12) this.bankOpen = true; } // InterfaceID.BANKMAIN: 12 in 2007
    onWidgetClosed(event) { if (event.getGroupId() === 12) this.bankOpen = false; }

    onItemContainerChanged(event) {
      if (event.getContainerId() === 95) this.itemQuantities = null; // InventoryID.BANK
    }

    createValueText(gePrice, haPrice) {
      let s = '';
      if (this.config.showGE() && gePrice !== 0) {
        s += ' (';
        if (this.config.showHA()) s += 'GE: ';
        s += this.config.showExact() ? QuantityFormatter.formatNumber(gePrice) : QuantityFormatter.quantityToStackSize(gePrice);
        s += ')';
      }
      if (this.config.showHA() && haPrice !== 0) {
        s += ' (';
        if (this.config.showGE()) s += 'HA: ';
        s += this.config.showExact() ? QuantityFormatter.formatNumber(haPrice) : QuantityFormatter.quantityToStackSize(haPrice);
        s += ')';
      }
      return s;
    }

    valueSearch(itemId, str) {
      const matcher = VALUE_SEARCH_PATTERN.exec(String(str));
      if (!matcher) return false;
      const g = matcher.groups;
      if (this.itemQuantities == null) this.itemQuantities = this.getBankItemSet();
      const qty = g.individual != null ? 1 : (this.itemQuantities.get(itemId) || 0);
      const mode = g.mode;
      let value;
      if (rl.prices.enabled()) {
        const comp = rl.itemManager.getItemComposition(itemId);
        const gePrice = rl.itemManager.getItemPrice(itemId) * qty;
        const haPrice = comp.getHaPrice() * qty;
        value = Math.max(gePrice, haPrice);
        if (mode) value = { qty, ge: gePrice, ha: haPrice, alch: haPrice }[mode.toLowerCase()];
      } else {
        // no prices: only qty searches
        if (!mode || mode.toLowerCase() !== 'qty') return false;
        value = qty;
      }
      if (g.op != null) {
        const compare = parseQuantity(g.num);
        if (compare == null) return false;
        switch (g.op) {
          case '>': return value > compare;
          case '<': return value < compare;
          case '=': return value === compare;
          case '>=': return value >= compare;
          case '<=': return value <= compare;
          default: return false;
        }
      }
      if (g.num1 != null && g.num2 != null) {
        const compare1 = parseQuantity(g.num1); const compare2 = parseQuantity(g.num2);
        if (compare1 == null || compare2 == null) return false;
        return compare1 <= value && compare2 >= value;
      }
      return false;
    }

    getBankItemSet() {
      const set = new Map();
      const container = client.getItemContainer(95);
      if (!container) return set;
      for (const item of container.getItems()) {
        if (item.getId() !== -1) set.set(item.getId(), (set.get(item.getId()) || 0) + item.getQuantity());
      }
      return set;
    }
  }

  const plugin = new BankPlugin();
  rl.registerPlugin('bank', plugin);
  ll.bankTest = { plugin, parseQuantity };
})();
