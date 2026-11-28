// RuneLite's Loot Tracker plugin, cloned from net.runelite.client.plugins.loottracker (BSD 2-Clause, Copyright (c) 2018,
// Psikoi <https://github.com/psikoi>, Adam <Adam@sigterm.info> and RuneLite contributors): LootTrackerPlugin,
// LootTrackerItem, LootTrackerRecord, ConfigLoot, and the panel's model (LootTrackerPanel / LootTrackerBox: records,
// grouping, hiding, collapsing, totals); the panel itself is drawn in ui/panels/loottracker.js from what this publishes.
// Trimmed for Sept 2007: NPC loot comes from the core's LootManager (NpcLootReceived; OSRS's ServerNpcLoot is a later
// server feature), PvP loot, pickpocketing and the 2007 chests (Crystal, Muddy, Rogues', Dorgesh-Kaan). The OSRS-only
// sources (raids, minigames, Herbiboar, Wintertodt, seed packs ...) are left out, as is the loot upload to RuneLite's
// server. Prices and values show only with the core's price switch (rl.prices, off until the game has a market).
// There is no Grand Exchange yet: the "GE" price is ItemManager.getItemPrice, the store value in 2007.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Text, QuantityFormatter, InventoryID } = rl;

  const LootRecordType = { NPC: 'NPC', PLAYER: 'PLAYER', EVENT: 'EVENT', PICKPOCKET: 'PICKPOCKET', UNKNOWN: 'UNKNOWN' };
  const MAX_DROPS = 1024;
  const MAX_AGE = 365 * 24 * 3600 * 1000;
  const INVCHANGE_TIMEOUT = 10; // server ticks
  const MAX_SESSION_RECORDS = 1024;
  const MAX_LOOT_BOXES = 500;
  const ITEMS_PER_ROW = 5;
  const COINS = 995;
  const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

  const CHEST_LOOTED_MESSAGE = 'You find some treasure in the chest!';
  const OTHER_CHEST_LOOTED_MESSAGE = 'You steal some loot from the chest.';
  const DORGESH_KAAN_CHEST_LOOTED_MESSAGE = 'You find treasure inside!';
  const ROGUES_CHEST_PATTERN = /^You find (a|some)([a-z\s]*) inside\.$/;
  const LAVA_MAZE_NORTH_EAST_REGION = 12348;
  // (the 2007 ones of CHEST_EVENT_TYPES)
  const CHEST_EVENT_TYPES = new Map([[11573, 'Crystal Chest'], [10835, 'Dorgesh-Kaan Chest'], [10834, 'Dorgesh-Kaan Chest'],
    [13117, "Rogues' Chest"], [LAVA_MAZE_NORTH_EAST_REGION, 'Muddy Chest']]);
  const CLUE_SCROLL_PATTERN = /You have completed [0-9]+ ([a-z]+) Treasure Trails?\./;
  const CASKET = 405;
  const BARROWS_REGION = 14231;
  const CASKET_EVENT = 'Casket';
  const BIRDNEST_EVENT = 'Bird nest';
  // (the 2007 nests: red, green and blue eggs, seeds, ring)
  const BIRDNEST_IDS = new Set([5070, 5071, 5072, 5073, 5074]);
  const PICKPOCKET_REGEX = /^You pick (the )?(?<target>.+)'s? pocket.*$/;

  // a Multiset<Integer> as a Map id -> count
  const multiset = (items) => { const m = new Map(); for (const it of items) if (it.getQuantity() > 0) m.set(it.getId(), (m.get(it.getId()) || 0) + it.getQuantity()); return m; };
  const difference = (a, b) => { const out = new Map(); for (const [k, v] of a) { const d = v - (b.get(k) || 0); if (d > 0) out.set(k, d); } return out; };
  const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s); // WordUtils.capitalize, first word
  const wordsCapitalize = (s) => s.split(' ').map(capitalize).join(' ');

  class LootTrackerItem {
    constructor(id, name, quantity, gePrice, haPrice, ignored) {
      this.id = id; this.name = name; this.quantity = quantity; this.gePrice = gePrice; this.haPrice = haPrice; this.ignored = ignored;
    }
    getId() { return this.id; }
    getName() { return this.name; }
    getQuantity() { return this.quantity; }
    getGePrice() { return this.gePrice; }
    getHaPrice() { return this.haPrice; }
    isIgnored() { return this.ignored; }
    setIgnored(v) { this.ignored = v; }
    getTotalGePrice() { return this.gePrice * this.quantity; }
    getTotalHaPrice() { return this.haPrice * this.quantity; }
  }

  // equal by title and type (@EqualsAndHashCode(of = {"title", "type"}))
  class LootTrackerRecord {
    constructor(title, subTitle, type, items, kills) { this.title = title; this.subTitle = subTitle; this.type = type; this.items = items; this.kills = kills; }
    getTitle() { return this.title; }
    getSubTitle() { return this.subTitle; }
    getType() { return this.type; }
    getItems() { return this.items; }
    getKills() { return this.kills; }
    key() { return `${this.type}\u0000${this.title}`; }
    matches(id, type) { if (id == null) return true; return this.title === id && this.type === type; }
    merge(record) {
      outer:
      for (const item of record.items) {
        for (let idx = 0; idx < this.items.length; ++idx) {
          const r = this.items[idx];
          if (r.getId() === item.getId()) {
            let qty = r.getQuantity() + item.getQuantity();
            if (qty > 2147483647) qty = 2147483647;
            this.items[idx] = new LootTrackerItem(r.getId(), r.getName(), qty, r.getGePrice(), r.getHaPrice(), r.isIgnored());
            continue outer;
          }
        }
        this.items = this.items.concat([item]);
      }
      this.kills += record.kills;
    }
  }

  class ConfigLoot {
    constructor(type, name) { this.type = type; this.name = name; this.kills = 0; this.first = Date.now(); this.last = 0; this.drops = []; }
    add(id, qty) {
      for (let i = 0; i < this.drops.length; i += 2) {
        if (this.drops[i] === id) {
          this.drops[i + 1] += qty;
          if (this.drops[i + 1] > 2147483647) this.drops[i + 1] = 2147483647;
          return;
        }
      }
      this.drops.push(id, qty);
    }
    numDrops() { return this.drops.length / 2; }
    static fromJson(json) {
      const o = JSON.parse(json);
      const c = new ConfigLoot(o.type, o.name);
      c.kills = o.kills | 0; c.first = Date.parse(o.first) || 0; c.last = Date.parse(o.last) || 0; c.drops = Array.isArray(o.drops) ? o.drops.map((n) => n | 0) : [];
      return c;
    }
    toJson() { return JSON.stringify({ type: this.type, name: this.name, kills: this.kills, first: new Date(this.first).toISOString(), last: new Date(this.last).toISOString(), drops: this.drops }); }
  }

  // ---------------------------------------------------------------- LootTrackerPanel / LootTrackerBox (the model)
  class LootTrackerBox {
    constructor(panel, record, eventIgnored) { this.panel = panel; this.record = record; this.eventIgnored = eventIgnored; this.collapsed = false; this.id = ++panel.boxIds; this.totalPrice = 0; this.hidden = false; this.items = []; }
    matches(r, type) {
      if (r instanceof LootTrackerRecord) return r.getType() === this.record.getType() && r.getTitle() === this.record.getTitle();
      if (r == null) return true;
      return this.record.getTitle() === r && this.record.getType() === type;
    }
    rebuild() {
      const ha = this.panel.config.priceType() === 'HIGH_ALCHEMY';
      const getPrice = (i) => (ha ? i.getTotalHaPrice() : i.getTotalGePrice());
      // buildItems (LootTrackerMapping maps nothing in 2007: its items are later)
      const items = new Map();
      for (const item of this.record.getItems().filter((i) => !this.panel.hideIgnoredItems || !i.isIgnored()).sort((a, b) => getPrice(b) - getPrice(a))) {
        const old = items.get(item.getId());
        if (old) {
          let qty = old.getQuantity() + item.getQuantity();
          if (qty > 2147483647) qty = 2147483647;
          items.set(item.getId(), new LootTrackerItem(old.getId(), old.getName(), qty, old.getGePrice(), old.getHaPrice(), old.isIgnored()));
        } else items.set(item.getId(), item);
      }
      this.items = [...items.values()];
      this.hidden = this.items.length === 0;
      this.totalPrice = this.items.reduce((a, i) => a + getPrice(i), 0);
    }
    collapse() { this.collapsed = true; }
    expand() { this.collapsed = false; }
    isCollapsed() { return this.collapsed; }
    state() {
      const showPriceType = this.panel.config.showPriceType();
      const ha = this.panel.config.priceType() === 'HIGH_ALCHEMY';
      const kills = this.record.getKills();
      let missing = false;
      const items = this.items.map((item) => {
        const icon = ll.itemIconUrl ? ll.itemIconUrl(item.getId(), item.getQuantity()) : null;
        if (!icon) missing = true;
        return { id: item.getId(), quantity: item.getQuantity() > 1 ? QuantityFormatter.quantityToStackSize(item.getQuantity()) : null, icon, tooltip: rl.prices.enabled() ? buildToolTip(item) : buildToolTip(item).slice(0, 1), ignored: item.isIgnored(), name: item.getName() };
      });
      if (missing) this.panel.iconsMissing = true;
      const prices = rl.prices.enabled();
      return {
        prices,
        id: this.id, title: Text.removeTags(this.record.getTitle()), eventIgnored: this.eventIgnored, collapsed: this.collapsed,
        subTitle: kills > 1 ? `x ${kills}` : this.record.getSubTitle() || '',
        subTitleTip: prices && kills > 1 ? `${QuantityFormatter.formatNumber(Math.trunc(this.totalPrice / kills))} gp (average)` : null,
        price: `${showPriceType ? (ha ? 'HA: ' : 'GE: ') : ' '}${QuantityFormatter.quantityToStackSize(this.totalPrice)} gp`,
        priceTip: `${QuantityFormatter.formatNumber(this.totalPrice)} gp`,
        rows: Math.ceil(items.length / ITEMS_PER_ROW), items,
      };
    }
  }

  function buildToolTip(item) {
    const name = item.getName(); const quantity = item.getQuantity();
    const lines = [`${name} x ${QuantityFormatter.formatNumber(quantity)}${item.isIgnored() ? ' - Ignored' : ''}`];
    if (item.getId() === COINS) return lines;
    lines.push(`GE: ${QuantityFormatter.quantityToStackSize(item.getTotalGePrice())}${quantity > 1 ? ` (${QuantityFormatter.quantityToStackSize(item.getGePrice())} ea)` : ''}`);
    // (no platinum tokens in 2007)
    lines.push(`HA: ${QuantityFormatter.quantityToStackSize(item.getTotalHaPrice())}${quantity > 1 ? ` (${QuantityFormatter.quantityToStackSize(item.getHaPrice())} ea)` : ''}`);
    return lines;
  }

  class LootTrackerPanel {
    constructor(plugin, config) {
      this.plugin = plugin; this.config = config;
      this.aggregateRecords = new Map(); // key -> record, access order (a get moves it to the end)
      this.sessionRecords = [];
      this.boxes = [];
      this.boxIds = 0;
      this.groupLoot = true;
      this.hideIgnoredItems = true;
      this.currentView = null;
      this.currentType = null;
      this.hasBoxes = false; // the error panel is removed (and the actions and overall shown) with the first box
      this.headerIcon = null;
      this.overall = { kills: '0', value: '0', label: 'Total value: ', tip: [] };
    }
    aggGet(key) { const r = this.aggregateRecords.get(key); if (r) { this.aggregateRecords.delete(key); this.aggregateRecords.set(key, r); } return r; }
    isAllCollapsed() { return this.boxes.filter((b) => b.isCollapsed()).length === this.boxes.length; }
    add(eventName, type, actorLevel, items, kills) {
      const subTitle = type === LootRecordType.PICKPOCKET ? '(pickpocket)' : actorLevel > 0 ? `(lvl-${actorLevel})` : '';
      const sessRecord = new LootTrackerRecord(eventName, subTitle, type, items, kills);
      this.sessionRecords.push(sessRecord);
      if (this.sessionRecords.length > MAX_SESSION_RECORDS) this.sessionRecords.shift();
      let aggRecord = this.aggGet(sessRecord.key());
      if (aggRecord != null) aggRecord.merge(sessRecord);
      else {
        aggRecord = new LootTrackerRecord(eventName, subTitle, type, items.slice(), kills);
        this.aggregateRecords.set(aggRecord.key(), aggRecord);
      }
      if (this.hideIgnoredItems && this.plugin.isEventIgnored(eventName)) return;
      const box = this.buildBox(this.groupLoot ? aggRecord : sessRecord);
      if (box != null) box.rebuild();
      this.updateOverall();
    }
    hasRecord(type, name) { return this.aggregateRecords.has(new LootTrackerRecord(name, null, type, null, 0).key()); }
    clearRecords() { this.aggregateRecords.clear(); this.sessionRecords = []; }
    addRecords(recs) { for (const r of recs) { this.aggregateRecords.delete(r.key()); this.aggregateRecords.set(r.key(), r); } this.rebuild(); }
    changeGrouping(group) { this.groupLoot = group; this.rebuild(); }
    changeItemHiding(hide) { this.hideIgnoredItems = hide; this.rebuild(); }
    changeCollapse() {
      const all = this.isAllCollapsed();
      for (const box of this.boxes) { if (all) box.expand(); else if (!box.isCollapsed()) box.collapse(); }
      this.publish();
    }
    updateIgnoredRecords() {
      for (const record of [...this.aggregateRecords.values(), ...this.sessionRecords]) for (const item of record.getItems()) item.setIgnored(this.plugin.isIgnored(item.getName()));
      this.rebuild();
    }
    rebuild() {
      this.boxes = [];
      if (this.groupLoot) for (const r of this.aggregateRecords.values()) this.buildBox(r);
      else for (const r of this.sessionRecords) if (!this.hideIgnoredItems || !this.plugin.isEventIgnored(r.getTitle())) this.buildBox(r);
      for (const b of this.boxes) b.rebuild();
      this.updateOverall();
    }
    buildBox(record) {
      if (!record.matches(this.currentView, this.currentType)) return null;
      const isIgnored = this.plugin.isEventIgnored(record.getTitle());
      if (this.hideIgnoredItems && isIgnored) return null;
      if (this.groupLoot) {
        const i = this.boxes.findIndex((b) => b.matches(record));
        if (i >= 0) { const box = this.boxes[i]; this.boxes.splice(i, 1); this.boxes.push(box); return box; } // setComponentZOrder(box, 0): to the top
      }
      this.hasBoxes = true;
      const box = new LootTrackerBox(this, record, isIgnored);
      this.boxes.push(box); // logsContainer.add(box, 0): the newest is at the top (the end of this list)
      if (!this.groupLoot && this.boxes.length > MAX_LOOT_BOXES) this.boxes.shift();
      return box;
    }
    resetBox(id) {
      const box = this.boxes.find((b) => b.id === id);
      if (!box) return;
      const record = box.record;
      const match = this.groupLoot ? (r) => r.matches(record.getTitle(), record.getType()) : (r) => r === record;
      this.sessionRecords = this.sessionRecords.filter((r) => !match(r));
      for (const [k, r] of [...this.aggregateRecords]) if (match(r)) this.aggregateRecords.delete(k);
      this.boxes.splice(this.boxes.indexOf(box), 1);
      this.updateOverall();
      if (this.groupLoot) this.plugin.removeLootConfig(record.getType(), record.getTitle());
    }
    resetAll() {
      const v = this.currentView; const t = this.currentType;
      this.sessionRecords = this.sessionRecords.filter((r) => !r.matches(v, t));
      for (const [k, r] of [...this.aggregateRecords]) if (r.matches(v, t)) this.aggregateRecords.delete(k);
      this.boxes = this.boxes.filter((b) => !b.matches(v, t));
      this.updateOverall();
      this.boxes = [];
      if (v != null) this.plugin.removeLootConfig(t, v); else this.plugin.removeAllLoot();
      this.publish();
    }
    viewDetails(id) {
      const box = this.boxes.find((b) => b.id === id);
      if (!box) return;
      this.currentView = box.record.getTitle(); this.currentType = box.record.getType();
      this.rebuild();
    }
    back() { this.currentView = null; this.currentType = null; this.rebuild(); }
    updateOverall() {
      let overallKills = 0; let overallGe = 0; let overallHa = 0;
      for (const record of this.groupLoot ? this.aggregateRecords.values() : this.sessionRecords) {
        if (!record.matches(this.currentView, this.currentType)) continue;
        if (this.hideIgnoredItems && this.plugin.isEventIgnored(record.getTitle())) continue;
        let present = record.getItems().length;
        for (const item of record.getItems()) {
          if (this.hideIgnoredItems && item.isIgnored()) { present--; continue; }
          overallGe += item.getTotalGePrice(); overallHa += item.getTotalHaPrice();
        }
        if (present > 0) overallKills += record.getKills();
      }
      const ha = this.config.priceType() === 'HIGH_ALCHEMY';
      const priceType = this.config.showPriceType() ? (ha ? 'HA ' : 'GE ') : '';
      this.overall = {
        prices: rl.prices.enabled(),
        kills: QuantityFormatter.quantityToStackSize(overallKills), label: `Total ${priceType}value: `,
        value: QuantityFormatter.quantityToStackSize(ha ? overallHa : overallGe),
        tip: [`Total GE price: ${QuantityFormatter.formatNumber(overallGe)}`, `Total HA price: ${QuantityFormatter.formatNumber(overallHa)}`],
      };
      this.publish();
    }
    publish() {
      this.iconsMissing = false;
      const boxes = this.boxes.filter((b) => !b.hidden).map((b) => b.state()).reverse();
      rl.panels.update('loottracker', {
        hasBoxes: this.hasBoxes, groupLoot: this.groupLoot, hideIgnoredItems: this.hideIgnoredItems, allCollapsed: this.isAllCollapsed(),
        detailsTitle: this.currentView != null ? this.currentView : '', back: this.currentView != null,
        headerIcon: this.headerIcon, overall: this.overall, boxes,
      });
    }
  }

  // ---------------------------------------------------------------- LootTrackerPlugin
  class LootTrackerPlugin {
    constructor() {
      this.configGroup = 'loottracker';
      this.config = rl.configProxy('loottracker', () => this.configItems);
      this.ignoredItems = [];
      this.ignoredEvents = [];
      this.queuedLoots = [];
      this.profileKey = null;
      this.inventoryId = -1;
      this.inventorySnapshot = null;
      this.inventorySnapshotCb = null;
      this.inventoryTimeout = 0;
    }

    startUp() {
      this.profileKey = null;
      this.ignoredItems = Text.fromCSV(this.config.getIgnoredItems());
      this.ignoredEvents = Text.fromCSV(this.config.getIgnoredEvents());
      this.panel = new LootTrackerPanel(this, this.config);
      this.loadHeaderIcon();
      this.panel.publish();
      const profileKey = client.getGameState() === 'LOGGED_IN' ? rl.configManager.getRSProfileKey() : null;
      if (profileKey != null) this.switchProfile(profileKey);
    }

    shutDown() {
      this.submitLoot();
      rl.panels.update('loottracker', null);
    }

    // spriteManager.getSpriteAsync(SpriteID.SideIcons.INVENTORY, 0, panel::loadHeaderIcon)
    loadHeaderIcon() {
      if (this.panel.headerIcon) return;
      const s = ll.sprite ? ll.sprite(777, 0) : null;
      if (!s || !s.px || typeof document === 'undefined' || !document.createElement) return;
      try {
        const cv = document.createElement('canvas'); cv.width = s.w; cv.height = s.h;
        const cx = cv.getContext('2d'); const img = cx.createImageData(s.w, s.h);
        for (let i = 0; i < s.px.length; i++) {
          const p = s.px[i];
          img.data[i * 4] = (p >> 16) & 255; img.data[i * 4 + 1] = (p >> 8) & 255; img.data[i * 4 + 2] = p & 255; img.data[i * 4 + 3] = p === 0 ? 0 : 255;
        }
        cx.putImageData(img, 0, 0);
        this.panel.headerIcon = cv.toDataURL('image/png');
      } catch { /* later */ }
    }

    // RuneScapeProfileChanged (the account logged in changed)
    onGameStateChanged(event) {
      if (event.getGameState() !== 'LOGGED_IN') return;
      const profileKey = rl.configManager.getRSProfileKey();
      if (profileKey == null || profileKey === this.profileKey) return;
      this.switchProfile(profileKey);
    }

    switchProfile(profileKey) {
      this.submitLoot();
      this.profileKey = profileKey;
      if (!this.config.rememberLoot()) return;
      let drops = 0;
      const loots = [];
      const old = Date.now() - MAX_AGE;
      for (const key of rl.configManager.getRSProfileConfigurationKeys('loottracker', profileKey, 'drops_')) {
        const json = rl.configManager.getConfiguration('loottracker', profileKey, key);
        let configLoot;
        try { configLoot = ConfigLoot.fromJson(json); } catch {
          rl.configManager.unsetConfiguration('loottracker', profileKey, key);
          continue;
        }
        if (configLoot.last < old) { rl.configManager.unsetConfiguration('loottracker', profileKey, key); continue; }
        if (drops >= MAX_DROPS && loots.length && loots[0].last > configLoot.last) continue;
        let idx = loots.findIndex((l) => l.last > configLoot.last);
        if (idx < 0) idx = loots.length;
        loots.splice(idx, 0, configLoot);
        drops += configLoot.numDrops();
        if (drops >= MAX_DROPS) { const top = loots.shift(); drops -= top.numDrops(); }
      }
      this.panel.clearRecords();
      this.panel.addRecords(loots.map((l) => this.convertToLootTrackerRecord(l)));
    }

    onConfigChanged(event) {
      if (event.getGroup() !== 'loottracker') return;
      const key = event.getKey();
      // (the 2007RS settings channel doesn't say which key changed: null is any)
      if (key == null || key === 'ignoredItems' || key === 'ignoredEvents') {
        this.ignoredItems = Text.fromCSV(this.config.getIgnoredItems());
        this.ignoredEvents = Text.fromCSV(this.config.getIgnoredEvents());
        this.panel.updateIgnoredRecords();
      } else if (key === 'priceType' || key === 'showPriceType') {
        this.panel.rebuild();
      }
    }

    initLoot(type, name) {
      if (this.panel.hasRecord(type, name) || !this.config.rememberLoot()) return;
      const loot = this.getLootConfig(type, name);
      if (loot == null) return;
      this.panel.addRecords([this.convertToLootTrackerRecord(loot)]);
    }

    addLoot(name, combatLevel, type, metadata, items, amount = 1) {
      if (items.length) {
        this.initLoot(type, name);
        const entries = this.buildEntries(stack(items));
        this.panel.add(name, type, combatLevel, entries, amount);
      }
      this.queuedLoots.push({ name, type, drops: items.map((i) => [i.getId(), i.getQuantity()]), amount });
      rl.eventBus.post('LootReceived', { getName: () => name, getCombatLevel: () => combatLevel, getType: () => type, getItems: () => items, getAmount: () => amount, getMetadata: () => metadata });
    }

    onGameTick() {
      // PostClientTick's inventory timeout, in server ticks here (CLIENT_TICK_LENGTH per GAME_TICK_LENGTH)
      if (this.inventoryTimeout > 0 && --this.inventoryTimeout === 0) this.resetEvent();
      // 2006RS-2: the tier of the last clue item in the pack (for our tierless clue reward, onWidgetLoaded)
      if (!ll.c2007 && ll.clueTiers2006) {
        const inv = client.getItemContainer(InventoryID.INV);
        for (const it of inv ? inv.getItems() : []) {
          const id = it.getId();
          const t = id > 0 && Object.keys(ll.clueTiers2006).find((k) => ll.clueTiers2006[k].some(([a, b]) => id >= a && id <= b));
          if (t) { this.lastClueTier = t; break; }
        }
      }
      // (saved each tick rather than at shutdown: the 2007RS window can close without a shutdown event)
      if (this.queuedLoots.length) this.submitLoot();
      if (!this.panel.headerIcon) { this.loadHeaderIcon(); if (this.panel.headerIcon) this.panel.publish(); }
      if (this.panel.iconsMissing) this.panel.publish();
    }

    // ServerNpcLoot's handling, for the core's NpcLootReceived
    onNpcLootReceived(event) {
      const npc = event.getNpc();
      const items = event.getItems();
      const name = Text.removeTags(npc.getName() || '');
      const combat = npc.getCombatLevel();
      if (this.ignorePickpocketLoot === client.getTickCount()) return;
      this.addLoot(name, combat, LootRecordType.NPC, { id: npc.getId() }, items);
      if (rl.prices.enabled() && this.config.npcKillChatMessage()) {
        const prefix = VOWELS.has(name.charAt(0).toLowerCase()) ? 'an' : 'a';
        this.lootReceivedChatMessage(items, `${prefix} ${name}`);
      }
    }

    onPluginLootReceived(event) {
      this.addLoot(event.getName(), event.getCombatLevel(), event.getType(), event.getItems(), event.getItems());
    }

    onPlayerLootReceived(event) {
      // (no Last Man Standing or Soul Wars in 2007)
      const player = event.getPlayer();
      const items = event.getItems();
      const name = player.getName();
      this.addLoot(name, player.getCombatLevel(), LootRecordType.PLAYER, null, items);
      if (rl.prices.enabled() && this.config.pvpKillChatMessage()) this.lootReceivedChatMessage(items, name);
    }

    onChatMessage(event) {
      const chatType = event.getType();
      if (chatType !== 'GAMEMESSAGE' && chatType !== 'SPAM' && chatType !== 'MESBOX') return;
      const message = event.getMessage();
      if (message === CHEST_LOOTED_MESSAGE || message === OTHER_CHEST_LOOTED_MESSAGE || message === DORGESH_KAAN_CHEST_LOOTED_MESSAGE || ROGUES_CHEST_PATTERN.test(message)) {
        const regionID = client.getLocalPlayer().getWorldLocation().getRegionID();
        if (!CHEST_EVENT_TYPES.has(regionID)) return;
        if (regionID === LAVA_MAZE_NORTH_EAST_REGION) {
          this.onInvChange(this.collectInvAndGroundItems(LootRecordType.EVENT, CHEST_EVENT_TYPES.get(regionID), client.getWorld ? client.getWorld() : 1));
          return;
        }
        this.onInvChange(this.collectInvAndGroundItems(LootRecordType.EVENT, CHEST_EVENT_TYPES.get(regionID)));
        return;
      }
      // (pickpocket first, as in RuneLite)
      const m = PICKPOCKET_REGEX.exec(message);
      if (!m) {
        const c = CLUE_SCROLL_PATTERN.exec(Text.removeTags(message));
        if (c) {
          // (no beginner, elite or master clues in 2007)
          const eventType = { easy: 'Clue Scroll (Easy)', medium: 'Clue Scroll (Medium)', hard: 'Clue Scroll (Hard)' }[c[1].toLowerCase()];
          if (!eventType) return;
          // Clue Scrolls use same InventoryID as Barrows
          this.onInvChange(this.collectInvItems(LootRecordType.EVENT, eventType), InventoryID.TRAIL_REWARDINV);
          return;
        }
      }
      if (m) {
        // (PICKPOCKET_DISAMBIGUATION_MAP's H.A.M. members are 2008)
        const pickpocketTarget = wordsCapitalize(m.groups.target);
        this.ignorePickpocketLoot = client.getTickCount();
        this.onInvChange(this.collectInvAndGroundItems(LootRecordType.PICKPOCKET, pickpocketTarget));
      }
    }

    // the reward windows of 2007 (RAIDS, TOB, TOA, the Fortis Colosseum, the Lunar Chest ... are later)
    onWidgetLoaded(widgetLoaded) {
      let event; let container; let metadata = null;
      // 2006RS-2: our clue reward (trail_reward) and Barrows chest (barrows_chest) are two windows, both 2007's 364 here
      // (if2006.js). Our server says "Well done you've completed the Treasure Trail!" with no tier, so the clue's
      // tier is the last clue item seen in the pack (cluetiers2006.js).
      if (!ll.c2007 && widgetLoaded.getGroupId() === rl.InterfaceID.TRAIL_REWARD && ll.api && ll.api.ifOpen && ll.api.ifOpen(6960)) {
        const tier = this.lastClueTier;
        const eventType = { easy: 'Clue Scroll (Easy)', medium: 'Clue Scroll (Medium)', hard: 'Clue Scroll (Hard)' }[tier];
        container = client.getItemContainer(InventoryID.TRAIL_REWARDINV);
        if (!eventType || container == null) return;
        const items = container.getItems().filter((i) => i.getId() > -1).map((i) => new rl.ItemStack(i.getId(), i.getQuantity()));
        if (items.length) this.addLoot(eventType, -1, LootRecordType.EVENT, null, items);
        return;
      }
      switch (widgetLoaded.getGroupId()) {
        case rl.InterfaceID.BARROWS_REWARD:
          // (2007: the same window as the clue reward, so only in the Barrows tunnels)
          if (client.getLocalPlayer().getWorldLocation().getRegionID() !== BARROWS_REGION) return;
          event = 'Barrows';
          container = client.getItemContainer(InventoryID.TRAIL_REWARDINV);
          break;
        case rl.InterfaceID.MISC_COLLECTION:
          event = 'Kingdom of Miscellania';
          container = client.getItemContainer(InventoryID.MISC_RESOURCES_COLLECTED);
          break;
        case rl.InterfaceID.TRAWLER_REWARD:
          event = 'Fishing Trawler';
          metadata = client.getBoostedSkillLevel(rl.Skill.FISHING);
          container = client.getItemContainer(InventoryID.TRAWLER_REWARDINV);
          break;
        default:
          return;
      }
      if (container == null) return;
      const items = container.getItems().filter((i) => i.getId() > -1).map((i) => new rl.ItemStack(i.getId(), i.getQuantity()));
      // (showRaidsLootValue: no raids in 2007)
      if (!items.length) return;
      this.addLoot(event, -1, LootRecordType.EVENT, metadata, items);
    }

    onMenuOptionClicked(event) {
      // (the pickpocket name fallback is for H.A.M. members, 2008; the shade chests are 2009)
      if (!event.isItemOp()) return;
      if (event.getMenuOption() === 'Search' && BIRDNEST_IDS.has(event.getItemId())) {
        this.onInvChange(this.collectInvItems(LootRecordType.EVENT, BIRDNEST_EVENT));
      } else if (event.getMenuOption() === 'Open' && event.getItemId() === CASKET) {
        this.onInvChange(this.collectInvItems(LootRecordType.EVENT, CASKET_EVENT));
      }
    }

    onItemContainerChanged(event) {
      if (this.inventoryId === -1 || event.getContainerId() !== this.inventoryId) return;
      const currentInventory = multiset(event.getItemContainer().getItems());
      const playerLocation = client.getLocalPlayer().getWorldLocation();
      const groundItems = rl.lootManager.getItemSpawns(playerLocation);
      const diff = difference(currentInventory, this.inventorySnapshot);
      const diffr = difference(this.inventorySnapshot, currentInventory);
      const items = [...diff].map(([id, n]) => new rl.ItemStack(id, n));
      if (this.inventorySnapshotCb != null) this.inventorySnapshotCb(items, groundItems, diffr);
      this.resetEvent();
    }

    resetEvent() { this.inventoryId = -1; this.inventorySnapshot = null; this.inventorySnapshotCb = null; this.inventoryTimeout = 0; }
    collectInvItems(type, event, metadata = null) { return (invItems) => this.addLoot(event, -1, type, metadata, invItems); }
    collectInvAndGroundItems(type, event, metadata = null) {
      return (invItems, groundItems) => this.addLoot(event, -1, type, metadata, [...invItems, ...groundItems]);
    }
    onInvChange(cb, inv = InventoryID.INV, timeout = INVCHANGE_TIMEOUT) {
      this.inventoryId = inv;
      this.inventorySnapshotCb = cb;
      this.inventoryTimeout = timeout;
      const itemContainer = client.getItemContainer(inv);
      this.inventorySnapshot = itemContainer != null ? multiset(itemContainer.getItems()) : new Map();
    }

    submitLoot() {
      if (!this.queuedLoots.length) return;
      const copy = this.queuedLoots;
      this.queuedLoots = [];
      this.saveLoot(copy);
    }
    combine(records) {
      const map = new Map();
      for (const record of records) {
        if (!record.drops.length) continue;
        const k = `${record.type}\u0000${record.name}`;
        if (!map.has(k)) map.set(k, new ConfigLoot(record.type, record.name));
        const loot = map.get(k);
        loot.kills += record.amount;
        for (const [id, qty] of record.drops) loot.add(id, qty);
      }
      return [...map.values()];
    }
    saveLoot(records) {
      const now = Date.now();
      for (const record of this.combine(records)) {
        let lootConfig = this.getLootConfig(record.type, record.name);
        if (lootConfig == null) lootConfig = record;
        else {
          lootConfig.kills += record.kills;
          for (let i = 0; i < record.drops.length; i += 2) lootConfig.add(record.drops[i], record.drops[i + 1]);
        }
        lootConfig.last = now;
        this.setLootConfig(lootConfig.type, lootConfig.name, lootConfig);
      }
    }

    toggleItem(name, ignore) {
      const set = new Set(this.ignoredItems);
      if (ignore) set.add(name); else set.delete(name);
      this.setConfig('ignoredItems', Text.toCSV(set));
    }
    isIgnored(name) { return this.ignoredItems.includes(name); }
    toggleEvent(name, ignore) {
      const set = new Set(this.ignoredEvents);
      if (ignore) set.add(name); else set.delete(name);
      this.setConfig('ignoredEvents', Text.toCSV(set));
    }
    isEventIgnored(name) { return this.ignoredEvents.includes(name); }
    // config.setIgnoredItems / setIgnoredEvents, then ConfigChanged
    setConfig(key, value) {
      rl.configManager.setConfiguration('loottracker', key, value);
      this.onConfigChanged({ getGroup: () => 'loottracker', getKey: () => key });
    }

    buildLootTrackerItem(itemId, quantity) {
      const itemComposition = rl.itemManager.getItemComposition(itemId);
      const gePrice = rl.itemManager.getItemPrice(itemId);
      const haPrice = itemComposition.getHaPrice();
      const ignored = this.ignoredItems.includes(itemComposition.getMembersName());
      return new LootTrackerItem(itemId, itemComposition.getMembersName(), quantity, gePrice, haPrice, ignored);
    }
    buildEntries(itemStacks) { return itemStacks.map((s) => this.buildLootTrackerItem(s.getId(), s.getQuantity())); }
    convertToLootTrackerRecord(configLoot) {
      const items = [];
      for (let i = 0; i < configLoot.drops.length; i += 2) items.push(this.buildLootTrackerItem(configLoot.drops[i], configLoot.drops[i + 1]));
      return new LootTrackerRecord(configLoot.name, '', configLoot.type, items, configLoot.kills);
    }

    lootReceivedChatMessage(items, name) {
      const ge = this.config.priceType() === 'GRAND_EXCHANGE';
      const totalPrice = items.reduce((a, item) => a + (ge ? rl.itemManager.getItemPrice(item.getId()) : rl.itemManager.getItemComposition(item.getId()).getHaPrice()) * item.getQuantity(), 0);
      // ChatMessageBuilder HIGHLIGHT, as a CONSOLE message
      client.addChatMessage('CONSOLE', '', `<col=ff0000>You've killed ${name} for ${QuantityFormatter.quantityToStackSize(totalPrice)} loot.`, null);
    }

    getLootConfig(type, name) {
      const profile = this.profileKey;
      if (!profile) return null;
      const json = rl.configManager.getConfiguration('loottracker', profile, `drops_${type}_${name}`);
      if (json == null) return null;
      try { return ConfigLoot.fromJson(json); } catch { return null; }
    }
    setLootConfig(type, name, loot) {
      const profile = this.profileKey;
      if (!profile) return;
      rl.configManager.setConfiguration('loottracker', profile, `drops_${type}_${name}`, loot.toJson());
    }
    removeLootConfig(type, name) {
      const profile = this.profileKey;
      if (!profile) return;
      rl.configManager.unsetConfiguration('loottracker', profile, `drops_${type}_${name}`);
    }
    removeAllLoot() {
      const profile = this.profileKey;
      if (!profile) return;
      for (const key of rl.configManager.getRSProfileConfigurationKeys('loottracker', profile, 'drops_')) rl.configManager.unsetConfiguration('loottracker', profile, key);
    }

    // the panel's buttons and menus (LootTrackerPanel's listeners)
    onPanelAction(a) {
      const p = this.panel;
      switch (a.action) {
        case 'collapseAll': p.changeCollapse(); break;
        case 'group': p.changeGrouping(!!a.group); break;
        case 'hideIgnored': p.changeItemHiding(!!a.hide); break;
        case 'back': p.back(); break;
        case 'resetAll': p.resetAll(); break;
        case 'toggleBox': { const b = p.boxes.find((x) => x.id === a.id); if (b) { if (b.isCollapsed()) b.expand(); else b.collapse(); p.publish(); } break; }
        case 'resetBox': p.resetBox(a.id); break;
        case 'details': p.viewDetails(a.id); break;
        case 'toggleEvent': { const b = p.boxes.find((x) => x.id === a.id); if (b) this.toggleEvent(b.record.getTitle(), !b.eventIgnored); break; }
        case 'toggleItem': {
          const b = p.boxes.find((x) => x.id === a.id);
          const item = b && b.items.find((i) => i.getId() === a.item);
          if (item) { item.setIgnored(!item.isIgnored()); this.toggleItem(item.getName(), item.isIgnored()); }
          break;
        }
        default:
      }
    }
  }

  // LootTrackerPlugin.stack: one stack per item id
  function stack(items) {
    const list = [];
    for (const item of items) {
      let quantity = 0;
      const i = list.findIndex((x) => x.getId() === item.getId());
      if (i >= 0) { quantity = list[i].getQuantity(); list.splice(i, 1); }
      list.push(new rl.ItemStack(item.getId(), item.getQuantity() + quantity));
    }
    return list;
  }

  rl.registerPlugin('loottracker', new LootTrackerPlugin());
  rl.LootRecordType = LootRecordType;
})();
