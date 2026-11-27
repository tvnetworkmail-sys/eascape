// RuneLite's Bank Tags plugin, cloned from net.runelite.client.plugins.banktags (BSD 2-Clause, Copyright (c) 2018,
// Tomas Slusny <slusnucky@gmail.com>, Ron Young <https://github.com/raiyni>, Adam <Adam@sigterm.info> and RuneLite
// contributors): BankTagsPlugin, BankTag, BankTagsService, TagManager, tabs/TabInterface, tabs/TabManager,
// tabs/TagTab, tabs/TabSprites.
//
// The 2007 bank (interface 12) is if1 and has no tabs, so TabInterface's widgets are drawn by an overlay at the
// same place as OSRS's: the tab column left of the items, in the bank's item layer (12:91, whose empty left 38 px
// OSRS's tab column also takes), new tab button on top, then the up arrow, the tabs and the down arrow; their
// widget ops are the menu entries of what the mouse is over (the core's menuBuildHooks). The bank's filtering is the
// runtime's (the bankSearchFilter and getSearchingTagTab script callbacks), its title the runtime's display-only
// title. Adapted: Change icon types the item's name (ChatboxItemSearch's results grid is OSRS's); dragging an item
// onto a tab is followed with the core's mouse listener. Left out: layouts (Layout / LayoutManager / AutoLayout,
// 2024: their drag and duplicate handling need the 2007 bank to keep empty slots), PotionStorage (2023), the Grand
// Exchange tag search (no GE in Sept 2007), Tag-equipment (the 2007 bank has no Deposit worn items button), tab
// separators (no bank tabs in 2007: Remove tab separators does nothing), and item dragging inside a tag tab (the
// runtime's filtered view, as the bank search, keeps the bank's order: Prevent tag tab item dragging is always so).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Text, chatboxPanelManager, configManager, itemManager, Overlay, OverlayPosition, OverlayLayer, Color } = rl;

  const CONFIG_GROUP = 'banktags';
  const TAG_ICON_PREFIX = 'icon_';
  const TAG_TABS_CONFIG = 'tagtabs';
  const ITEM_KEY_PREFIX = 'item_';
  const TAG_HIDDEN_PREFIX = 'hidden_';
  const TAG_SEARCH = 'tag:';
  const EDIT_TAGS_MENU_OPTION = 'Edit-tags';
  const VAR_TAG_SUFFIX = '*';
  const SEARCH_BANK_INPUT_TEXT = 'Show items whose names or tags contain the following text:<br>'
    + "(To show only tagged items, start your search with 'tag:')";
  const SEARCH_BANK_INPUT_TEXT_FOUND = 'Show items whose names or tags contain the following text: (%d found)<br>'
    + "(To show only tagged items, start your search with 'tag:')";
  const OPTION_ALLOW_MODIFICATIONS = 0x1;
  const OPTION_HIDE_TAG_NAME = 0x2;
  const OPTION_NO_LAYOUT = 0x4;
  const OPTION_ITEMS_NOT_IN_LAYOUT_AT_BOTTOM = 0x8;
  const SPADE = 952; // ItemID.SPADE
  const BANKMAIN = 12;
  const developerMode = false;

  // TabInterface
  const HILIGHT_COLOR = new Color(255, 144, 64); // JagexColors.MENU_TARGET
  const SCROLL_UP = 'Scroll up';
  const SCROLL_DOWN = 'Scroll down';
  const NEW_TAB = 'New tag tab';
  const REMOVE_TAB = 'Delete tag tab';
  const EXPORT_TAB = 'Export tag tab';
  const IMPORT_TAB = 'Import tag tab';
  const VIEW_TAB = 'View tag tab';
  const RENAME_TAB = 'Rename tag tab';
  const CHANGE_ICON = 'Change icon';
  const REMOVE_TAG = 'Remove-tag';
  const TAG_INVENTORY = 'Tag-inventory';
  const TAGTABS = 'tagtabs';
  const OPEN_TAB_MENU = 'View tag tabs';
  const TAB_HEIGHT = 40;
  const TAB_WIDTH = 39;
  const BUTTON_HEIGHT = 20;
  const MARGIN = 1;
  const SCROLL_TICK = 500;
  const FILTERED_CHARS = (c) => '</>:'.indexOf(c) === -1;
  const filtered = (s) => [...String(s)].filter(FILTERED_CHARS).join('');
  const wrap = (s) => rl.ColorUtil.wrapWithColorTag(s, HILIGHT_COLOR);
  const ITEM_SPRITE_WIDTH = 36; // Constants.ITEM_SPRITE_WIDTH / HEIGHT
  const ITEM_SPRITE_HEIGHT = 32;

  const sendChatMessage = (message) => client.addChatMessage('CONSOLE', '', message);

  // ---- TagManager
  class TagManager {
    constructor() { this.customTags = new Map(); }
    getTagString(itemId, variation) {
      itemId = this.getItemId(itemId, variation);
      const config = configManager.getConfiguration(CONFIG_GROUP, ITEM_KEY_PREFIX + itemId);
      return config == null ? '' : String(config);
    }
    getTags(itemId, variation) { return new Set(Text.fromCSV(this.getTagString(itemId, variation).toLowerCase())); }
    setTagString(itemId, tags, variation) {
      itemId = this.getItemId(itemId, variation);
      if (!tags) configManager.unsetConfiguration(CONFIG_GROUP, ITEM_KEY_PREFIX + itemId);
      else configManager.setConfiguration(CONFIG_GROUP, ITEM_KEY_PREFIX + itemId, tags);
    }
    addTags(itemId, t, variation) {
      const tags = this.getTags(itemId, variation);
      const n = tags.size;
      for (const x of t) tags.add(x);
      if (tags.size !== n) this.setTags(itemId, tags, variation);
    }
    addTag(itemId, tag, variation) {
      const tags = this.getTags(itemId, variation);
      const s = Text.standardize(tag);
      if (!tags.has(s)) { tags.add(s); this.setTags(itemId, tags, variation); }
    }
    setTags(itemId, tags, variation) { this.setTagString(itemId, Text.toCSV(tags), variation); }
    findTag(itemId, search) {
      const tags = this.getTags(itemId, false);
      for (const t of this.getTags(itemId, true)) tags.add(t);
      const s = Text.standardize(search);
      for (const tag of tags) if (tag.startsWith(s)) return true;
      return false;
    }
    getItemsForTag(tag) {
      const prefix = CONFIG_GROUP + '.' + ITEM_KEY_PREFIX;
      return configManager.getConfigurationKeys(prefix)
        .map((item) => parseInt(item.replace(prefix, ''), 10))
        .filter((item) => this.getTags(item, false).has(tag) || this.getTags(item, true).has(tag));
    }
    removeTagEverywhere(tag) {
      const prefix = CONFIG_GROUP + '.' + ITEM_KEY_PREFIX;
      for (const item of configManager.getConfigurationKeys(prefix)) this.removeTag(parseInt(item.replace(prefix, ''), 10), tag);
      this.setHidden(tag, false);
    }
    removeTag(itemId, tag) {
      const s = Text.standardize(tag);
      let tags = this.getTags(itemId, false);
      if (tags.delete(s)) this.setTags(itemId, tags, false);
      tags = this.getTags(itemId, true);
      if (tags.delete(s)) this.setTags(itemId, tags, true);
    }
    renameTag(oldTag, newTag) {
      for (const id of this.getItemsForTag(Text.standardize(oldTag))) {
        const tags = this.getTags(id, id < 0);
        tags.delete(Text.standardize(oldTag));
        tags.add(Text.standardize(newTag));
        this.setTags(id, tags, id < 0);
      }
    }
    isHidden(tag) { const v = configManager.getConfiguration(CONFIG_GROUP, TAG_HIDDEN_PREFIX + Text.standardize(tag)); return v === true || v === 'true'; }
    setHidden(tag, hidden) {
      if (hidden) configManager.setConfiguration(CONFIG_GROUP, TAG_HIDDEN_PREFIX + Text.standardize(tag), true);
      else configManager.unsetConfiguration(CONFIG_GROUP, TAG_HIDDEN_PREFIX + Text.standardize(tag));
    }
    getItemId(itemId, variation) {
      itemId = Math.abs(itemId);
      itemId = itemManager.canonicalize(itemId);
      if (variation) itemId = rl.ItemVariationMapping.map(itemId) * -1;
      return itemId;
    }
    registerTag(name, tag) { this.customTags.set(name, tag); }
    unregisterTag(name) { this.customTags.delete(name); }
    findCustomTag(name) { return this.customTags.get(name) || null; }
  }

  // ---- TagTab / TabManager
  class TagTab {
    constructor(iconItemId, tag) { this.iconItemId = iconItemId; this.tag = tag; }
    getTag() { return this.tag; }
    setTag(t) { this.tag = t; }
    getIconItemId() { return this.iconItemId; }
    setIconItemId(i) { this.iconItemId = i; }
  }
  class TabManager {
    constructor() { this.tabs = []; }
    getTabs() { return this.tabs; }
    add(tagTab) { if (!this.contains(tagTab.getTag())) this.tabs.push(tagTab); }
    clear() { this.tabs.length = 0; }
    find(tag) { const s = Text.standardize(tag); return this.tabs.find((t) => t.getTag() === s) || null; }
    loadAllTabNames() { return Text.fromCSV(configManager.getConfiguration(CONFIG_GROUP, TAG_TABS_CONFIG) || ''); }
    load(tag) {
      let tagTab = this.find(tag);
      if (tagTab == null) {
        tag = Text.standardize(tag);
        const item = configManager.getConfiguration(CONFIG_GROUP, TAG_ICON_PREFIX + tag);
        const n = parseInt(item, 10);
        tagTab = new TagTab(Number.isFinite(n) ? n : SPADE, tag);
      }
      return tagTab;
    }
    saveTab(tab) { this.setIcon(tab.getTag(), tab.getIconItemId()); }
    swap(tagToMove, tagDestination) {
      tagToMove = Text.standardize(tagToMove); tagDestination = Text.standardize(tagDestination);
      if (this.contains(tagToMove) && this.contains(tagDestination)) {
        const a = this.indexOf(tagToMove); const b = this.indexOf(tagDestination);
        [this.tabs[a], this.tabs[b]] = [this.tabs[b], this.tabs[a]];
      }
    }
    insert(tagToMove, tagDestination) {
      tagToMove = Text.standardize(tagToMove); tagDestination = Text.standardize(tagDestination);
      if (this.contains(tagToMove) && this.contains(tagDestination)) {
        const moved = this.tabs.splice(this.indexOf(tagToMove), 1)[0];
        this.tabs.splice(this.indexOf(tagDestination), 0, moved);
      }
    }
    remove(tag) {
      const tagTab = this.find(tag);
      if (tagTab != null) { this.tabs.splice(this.tabs.indexOf(tagTab), 1); this.removeIcon(tag); }
    }
    save() {
      configManager.setConfiguration(CONFIG_GROUP, TAG_TABS_CONFIG, Text.toCSV(this.tabs.map((t) => t.getTag())));
      for (const tab of this.tabs) this.saveTab(tab);
    }
    removeIcon(tag) { configManager.unsetConfiguration(CONFIG_GROUP, TAG_ICON_PREFIX + Text.standardize(tag)); }
    setIcon(tag, itemId) { configManager.setConfiguration(CONFIG_GROUP, TAG_ICON_PREFIX + Text.standardize(tag), itemId); }
    size() { return this.tabs.length; }
    contains(tag) { return this.tabs.some((t) => t.getTag() === tag); }
    indexOf(tag) { return this.tabs.indexOf(this.find(tag)); }
  }

  // ---- where the 2007 bank's parts are on the canvas: the item layer (12:91, ITEMS_CONTAINER) and the items (12:89)
  function bankGeometry() {
    const api = ll.api;
    if (!api || !api.com || !ll.BANK) return null;
    const inv = api.com(ll.BANK.inv);
    const layer = inv && inv.layer >= 0 ? api.com(inv.layer) : null;
    if (!inv || !layer || !inv.screen || !layer.screen) return null;
    return {
      x: layer.screen[0], y: layer.screen[1], w: layer.width, h: layer.height, scroll: layer.scrollPos | 0,
      itemX: inv.screen[0], itemY: inv.screen[1], cols: inv.width || 8, dx: ITEM_SPRITE_WIDTH - 4 + (inv.marginX | 0), dy: ITEM_SPRITE_HEIGHT + (inv.marginY | 0),
    };
  }
  const inRect = (r, p) => r && p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;

  // ---- TabInterface
  class TabInterface {
    constructor(plugin, tagManager, tabManager, config) {
      this.plugin = plugin; this.tagManager = tagManager; this.tabManager = tabManager; this.config = config;
      this.enabled = false;
      this.activeTag = null; this.activeLayout = null; this.activeOptions = 0;
      this.tagTabActive = false;
      this.tabScrollOffset = 0;
      this.startScroll = 0;
      this.tabCount = 0;
      this.parent = null; // the tab column's rectangles while the bank is open (the widgets OSRS's init creates)
    }
    isTagTabActive() { return this.tagTabActive; }
    getActiveTag() { return this.activeTag; }

    /** ScriptPreFired: BANKMAIN_INIT (the bank opened), BANKMAIN_SEARCH_TOGGLE, BANKMAIN_FINISHBUILDING */
    onScriptPreFired(event) {
      const id = event.getScriptId();
      if (id === rl.ScriptID.BANKMAIN_INIT) {
        const tabs = this.config.tabs();
        if (this.enabled !== tabs) {
          this.enabled = tabs;
          if (tabs) this.init();
          else this.deinit(); // this is probably the "Use Tag Tabs" option being toggled off when the bank is open
        }
      } else if (id === rl.ScriptID.BANKMAIN_SEARCH_TOGGLE) {
        if (this.activeTag != null || this.tagTabActive) this.closeTag(false); // close the active tab when search is pressed
      } else if (id === rl.ScriptID.BANKMAIN_FINISHBUILDING && this.enabled) {
        this.repositionButtons();
        // Apply our own title
        if (this.tagTabActive) ll.bankTitle('Tag tab tab'); // Tag tab tab has its own title since it isn't a real tag
        else if (this.activeTag != null) ll.bankTitle('Tag tab @red@' + this.activeTag);
      }
    }

    onWidgetClosed(event) {
      if (event.getGroupId() === BANKMAIN) {
        this.enabled = false;
        this.parent = null;
        this.activeTag = null; this.activeLayout = null; this.activeOptions = 0;
        this.plugin.openTag(null, null);
        this.tagTabActive = false;
      }
    }

    init() {
      this.parent = {};
      this.tabManager.clear();
      for (const t of this.tabManager.loadAllTabNames()) this.loadTab(t);
      this.tabScrollOffset = this.config.position();
      this.repositionButtons();
      this.scrollTab(0);
      if (this.config.rememberTab() && this.config.tab()) {
        const tab = this.config.tab();
        this.plugin.openTag(tab, null);
      }
    }

    deinit() {
      this.enabled = false;
      this.activeTag = null; this.activeLayout = null; this.activeOptions = 0;
      this.plugin.openTag(null, null);
      this.parent = null;
      this.tabManager.clear();
    }

    handleDeposit(target, inventory) {
      const container = client.getItemContainer(rl.InventoryID.INV);
      if (container == null) return;
      const items = container.getItems().filter((i) => i != null).map((i) => i.getId()).filter((id) => id !== -1);
      if (target) {
        if (this.activeTag != null && Text.removeTags(target) === this.activeTag) {
          for (const item of items) this.tagManager.addTag(item, this.activeTag, false);
          this.reloadActiveTab();
        }
        return;
      }
      chatboxPanelManager.openTextInput((inventory ? 'Inventory' : 'Equipment') + ' tags:')
        .onDone((newTags) => {
          const tags = Text.fromCSV(filtered(newTags).toLowerCase());
          for (const item of items) this.tagManager.addTags(item, tags, false);
          this.reloadActiveTab();
        })
        .build();
    }

    handleNewTab(op) {
      switch (op) {
        case NEW_TAB:
          chatboxPanelManager.openTextInput('Tag name')
            .onDone((tagName) => {
              tagName = filtered(tagName);
              if (tagName) {
                this.loadTab(tagName);
                this.tabManager.save();
                this.repositionButtons();
                this.rebuildTabs();
              }
            })
            .build();
          break;
        case IMPORT_TAB: {
          const clip = navigator.clipboard && navigator.clipboard.readText ? navigator.clipboard.readText() : Promise.reject(new Error('no clipboard'));
          clip.then((text) => {
            const dataString = String(text).trim();
            const dataIter = Text.fromCSV(dataString)[Symbol.iterator]();
            const tab = this.importTag(dataIter);
            if (tab == null) { sendChatMessage('Failed to import tag tab from clipboard, invalid format.'); return; }
            this.tabManager.add(tab);
            this.tabManager.save();
            this.repositionButtons();
            this.rebuildTabs();
            if (tab.getTag() === this.activeTag) rl.bankSearch.reset(true);
            sendChatMessage("Tag tab '" + tab.getTag() + "' has been imported from your clipboard!");
          }).catch(() => sendChatMessage('Failed to import tag tab from clipboard, invalid format.'));
          break;
        }
        case OPEN_TAB_MENU:
          this.plugin.openTag(TAGTABS, null, 0);
          break;
        default:
      }
    }

    /** importTag: "banktags,1,<name>,<icon>,<items...>[,layout,<idx>,<item>...]" (a layout's items are tagged; the
     *  layout itself is left out with layouts) */
    importTag(dataIter) {
      const next = () => { const r = dataIter.next(); if (r.done) throw new Error('no such element'); return r.value; };
      try {
        let name = next();
        if (name === 'banktags') { next(); name = next(); } // version
        name = filtered(name);
        if (!name) return null;
        const tab = this.tabManager.load(name);
        const icon = parseInt(next(), 10);
        if (!Number.isFinite(icon)) return null;
        tab.setIconItemId(icon);
        let token;
        while (!(token = dataIter.next()).done) {
          if (token.value === 'layout') break;
          const itemId = parseInt(token.value, 10);
          if (!Number.isFinite(itemId)) return null;
          this.tagManager.addTag(itemId, name, itemId < 0);
        }
        // (a layout's positions and items: the items are tagged)
        while (!(token = dataIter.next()).done) {
          const itemId = parseInt(next(), 10);
          if (!Number.isFinite(itemId)) return null;
          this.tagManager.addTag(itemId, name, false);
        }
        return tab;
      } catch {
        return null;
      }
    }

    opTagTab(op, tag) {
      switch (op) {
        case VIEW_TAB:
          if (tag === this.activeTag) this.closeTag(true);
          else this.plugin.openTag(tag, null);
          break;
        case CHANGE_ICON:
          // (ChatboxItemSearch: the item's name is typed; the first item of the 2007 cache with that name, or whose
          // name starts with it, is the icon)
          chatboxPanelManager.openTextInput(CHANGE_ICON + ' (' + tag + ')')
            .onDone((name) => {
              const itemId = findItem(name);
              const tab = this.tabManager.find(tag);
              if (tab != null && itemId > 0) {
                tab.setIconItemId(itemId);
                this.tabManager.save();
                this.rebuildTabs();
              }
            })
            .build();
          break;
        case REMOVE_TAB: {
          const target = Text.standardize(tag);
          chatboxPanelManager.openTextMenuInput('Delete ' + target)
            .option('1. Tab and tag from all items', () => { this.tagManager.removeTagEverywhere(target); this.deleteTab(target); })
            .option('2. Only tab', () => this.deleteTab(target))
            .option('3. Cancel', () => {})
            .build();
          break;
        }
        case EXPORT_TAB: {
          const tagTab = this.tabManager.find(tag);
          if (!tagTab) break;
          const data = ['banktags', '1', tagTab.getTag(), String(tagTab.getIconItemId())];
          for (const item of this.tagManager.getItemsForTag(tagTab.getTag())) data.push(String(item));
          const text = Text.toCSV(data);
          const done = () => sendChatMessage("Tag tab '" + tagTab.getTag() + "' has been copied to your clipboard!");
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => {});
          break;
        }
        case RENAME_TAB:
          this.renameTab(Text.standardize(tag));
          break;
        default:
      }
    }

    /** onMenuEntryAdded: Remove-tag on the bank's items in a tag tab, Tag-inventory on the Deposit inventory button */
    onMenuEntryAdded(event) {
      const option = event.getOption();
      if ((this.activeOptions & OPTION_ALLOW_MODIFICATIONS) !== 0 && event.getActionParam1() === ll.BANK.inv && option === 'Examine') {
        const hidden = this.tagManager.isHidden(this.activeTag);
        const activeTag = this.activeTag;
        client.createMenuEntry(-1)
          .setParam0(event.getActionParam0())
          .setParam1(event.getActionParam1())
          .setTarget(event.getTarget())
          .setOption(!hidden && (this.activeOptions & OPTION_HIDE_TAG_NAME) === 0 ? REMOVE_TAG + ' (' + activeTag + ')' : REMOVE_TAG)
          .setType(rl.MenuAction.RUNELITE)
          .setIdentifier(event.getIdentifier())
          .setItemId(event.getIdentifier())
          .onClick((e) => {
            this.tagManager.removeTag(e.getItemId(), activeTag);
            rl.bankSearch.layoutBank(); // re-layout to filter the removed item out
          });
      } else if (option === 'Deposit inventory' && rl.bankButtons.inBox(rl.bankButtons.DEPOSIT_BOX, client.getMouseCanvasPosition())) {
        this.createMenuEntry(event, TAG_INVENTORY, event.getTarget());
        if (this.activeTag != null && !this.tagManager.isHidden(this.activeTag)
          && (this.activeOptions & (OPTION_ALLOW_MODIFICATIONS | OPTION_HIDE_TAG_NAME)) === OPTION_ALLOW_MODIFICATIONS) {
          this.createMenuEntry(event, TAG_INVENTORY, wrap(this.activeTag));
        }
      }
    }

    createMenuEntry(event, option, target) {
      // (-2, under the button's own op: OSRS's menu sort keeps Deposit inventory the left click, which the 2007 menu
      // doesn't sort)
      client.createMenuEntry(-2)
        .setParam0(event.getActionParam0())
        .setParam1(event.getActionParam1())
        .setTarget(target)
        .setOption(option)
        .setType(rl.MenuAction.RUNELITE)
        .setIdentifier(event.getIdentifier())
        .onClick(() => this.handleDeposit(target, true));
    }

    /** an item of the bank dragged onto a tag tab is tagged (Shift: a variation tag); a tab dragged onto another moves */
    onDragReleased(dragged, p, shiftDown) {
      if (!this.enabled || !this.parent) return;
      const on = this.hitTest(p);
      if (!on || !on.tab) return;
      if (dragged.itemId != null && !this.tagTabActive) {
        this.tagManager.addTag(dragged.itemId, on.tab.getTag(), shiftDown);
        this.reloadActiveTab();
      } else if (dragged.tab && dragged.tab !== on.tab) {
        this.moveTagTab(dragged.tab.getTag(), on.tab.getTag());
      }
    }

    moveTagTab(source, dest) {
      if (!dest) return;
      // (Varbits BANK_INSERTMODE: the 2007 bank's Rearrange mode Insert, varp 304)
      const insert = (client.getVarpValue ? client.getVarpValue(304) : 0) === 1;
      if (!insert) this.tabManager.swap(source, dest);
      else this.tabManager.insert(source, dest);
      this.tabManager.save();
      this.rebuildTabs();
    }

    loadTab(tag) { this.tabManager.add(this.tabManager.load(tag)); }

    deleteTab(tag) {
      if (tag === this.activeTag) this.closeTag(true);
      this.tabManager.remove(tag);
      this.tabManager.save();
      this.repositionButtons();
      this.rebuildTabs();
      this.scrollTab(0);
    }

    renameTab(oldTag) {
      chatboxPanelManager.openTextInput('Enter new tag name for tag "' + oldTag + '":')
        .onDone((newTag) => {
          newTag = filtered(newTag);
          if (!newTag || newTag.toLowerCase() === oldTag.toLowerCase()) return;
          if (this.tabManager.find(newTag) == null) {
            const tagTab = this.tabManager.find(oldTag);
            this.tabManager.remove(oldTag); // remove the icon
            tagTab.setTag(Text.standardize(newTag));
            this.tabManager.add(tagTab);
            this.tabManager.save();
            if (this.activeTag === oldTag) this.activeTag = Text.standardize(newTag);
            this.tagManager.renameTag(oldTag, newTag); // rename tag on items
            this.rebuildTabs();
            this.reloadActiveTab();
          } else {
            chatboxPanelManager.openTextMenuInput('The specified bank tag already exists.')
              .option('1. Merge into existing tag "' + newTag + '".', () => {
                this.tagManager.renameTag(oldTag, newTag);
                this.deleteTab(oldTag);
                if (oldTag === this.activeTag) this.plugin.openBankTag(newTag);
                else this.reloadActiveTab();
              })
              .option('2. Choose a different name.', () => this.renameTab(oldTag))
              .build();
          }
        })
        .build();
    }

    scrollTick(direction) {
      // This ensures that dragging on scroll buttons does not scroll too fast
      if (Date.now() - this.startScroll >= SCROLL_TICK) { this.startScroll = Date.now(); this.scrollTab(direction); }
    }

    scrollTab(d) {
      this.tabScrollOffset += d;
      const maxScroll = this.tabManager.size() - this.tabCount;
      if (this.tabScrollOffset > maxScroll) this.tabScrollOffset = maxScroll;
      if (this.tabScrollOffset < 0) this.tabScrollOffset = 0;
      if (this.config.position() !== this.tabScrollOffset) this.config.position(this.tabScrollOffset);
    }

    openTag(tag, layout, options, relayout) {
      this.activeTag = tag;
      this.activeLayout = layout;
      this.activeOptions = options;
      this.tagTabActive = TAGTABS === tag;
      this.config.tab(tag);
      if (relayout) rl.bankSearch.reset(true);
    }

    closeTag(relayout) {
      this.activeTag = null; this.activeLayout = null; this.activeOptions = 0;
      this.tagTabActive = false;
      this.plugin.openTag(null, null);
      this.config.tab('');
      if (relayout) rl.bankSearch.reset(true);
    }

    reloadActiveTab() { if (this.activeTag != null) this.plugin.openBankTag(this.activeTag); }

    /** repositionButtons: the new tab button at the top of the item layer, the up arrow, as many tabs as fit, the down
     *  arrow (OSRS's offsets from ITEMS_CONTAINER's top; the 2007 layer's bottom has no buttons in it) */
    repositionButtons() {
      if (!this.parent) return;
      const g = bankGeometry();
      if (!g) return;
      const x = g.x - 1 + MARGIN; // (the 2007 layer's left gap is 38 px: the 39 px tabs start a pixel left of it)
      const height = g.h;
      const scrollY = 41 + BUTTON_HEIGHT;
      const tabLayerHeight = height - scrollY - BUTTON_HEIGHT; // the bottom button
      this.tabCount = Math.max(0, Math.floor(tabLayerHeight / (TAB_HEIGHT + MARGIN)));
      this.parent = {
        x, y: g.y,
        newTab: { x, y: g.y, w: TAB_WIDTH, h: 39 },
        up: { x, y: g.y + 41, w: TAB_WIDTH, h: BUTTON_HEIGHT },
        scroll: { x, y: g.y + scrollY, w: TAB_WIDTH + MARGIN * 2, h: this.tabCount * (TAB_HEIGHT + MARGIN) },
        down: { x, y: g.y + scrollY + this.tabCount * (TAB_HEIGHT + MARGIN) + MARGIN, w: TAB_WIDTH, h: BUTTON_HEIGHT },
      };
    }

    rebuildTabs() { this.scrollTab(0); }

    /** layoutTabs: the tabs shown, at their places */
    visibleTabs() {
      const out = [];
      const p = this.parent;
      if (!p || !p.scroll) return out;
      const tabs = this.tabManager.getTabs();
      let y = p.scroll.y + MARGIN;
      for (let i = this.tabScrollOffset; i < this.tabScrollOffset + this.tabCount && i < tabs.length; ++i) {
        out.push({ tab: tabs[i], x: p.x, y, w: TAB_WIDTH, h: TAB_HEIGHT });
        y += TAB_HEIGHT + MARGIN;
      }
      return out;
    }

    /** rebuildTagTabTab: in the tag tab tab, every tab as an item in the bank's grid */
    tagTabTabItems() {
      if (!this.tagTabActive) return [];
      const g = bankGeometry();
      if (!g) return [];
      const out = [];
      this.tabManager.getTabs().forEach((tab, i) => {
        out.push({ tab, x: g.itemX + (i % g.cols) * g.dx, y: g.itemY + Math.floor(i / g.cols) * g.dy, w: ITEM_SPRITE_WIDTH - 4, h: ITEM_SPRITE_HEIGHT, clip: g });
      });
      return out;
    }

    /** what of the tab column (or the tag tab tab) is at canvas point p */
    hitTest(p) {
      const P = this.parent;
      if (!P || !P.newTab) return null;
      if (inRect(P.newTab, p)) return { newTab: true };
      if (inRect(P.up, p)) return { up: true };
      if (inRect(P.down, p)) return { down: true };
      for (const t of this.visibleTabs()) if (inRect(t, p)) return t;
      for (const t of this.tagTabTabItems()) if (inRect(t, p) && inRect(t.clip, p)) return t;
      if (inRect(P.scroll, p)) return { scroll: true };
      return null;
    }

    /** the widget ops of what the mouse is over, as menu entries (first op on top) */
    menuEntries(p) {
      const on = this.hitTest(p);
      if (!on) return null;
      if (on.newTab) return [NEW_TAB, IMPORT_TAB, OPEN_TAB_MENU].map((o) => ({ option: o, target: '', run: () => this.handleNewTab(o) }));
      if (on.up) return [{ option: SCROLL_UP, target: '', run: () => this.scrollTab(-1) }];
      if (on.down) return [{ option: SCROLL_DOWN, target: '', run: () => this.scrollTab(1) }];
      if (on.tab) {
        const tag = on.tab.getTag();
        // (addTabActions; Enable layout is left out with layouts)
        return [VIEW_TAB, CHANGE_ICON, EXPORT_TAB, RENAME_TAB, REMOVE_TAB].map((o) => ({ option: o, target: wrap(tag), run: () => this.opTagTab(o, tag) }));
      }
      return on.scroll ? [] : null;
    }
  }

  /** the item with that name (ignoring case), or else the first whose name starts with it */
  function findItem(name) {
    const want = String(name || '').trim().toLowerCase();
    if (!want) return -1;
    let starts = -1;
    for (let id = 0; id < 12000; id++) {
      const comp = client.getItemDefinition(id);
      const n = comp.getName();
      if (!n || n === 'null' || comp.getNote() !== -1) continue;
      const l = n.toLowerCase();
      if (l === want) return id;
      if (starts < 0 && l.startsWith(want)) starts = id;
    }
    return starts;
  }

  // ---- the tab column, drawn where OSRS's widgets are (TabSprites)
  class TabOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_WIDGETS);
    }
    getName() { return 'BankTagsTabs'; }
    render(g) {
      const ti = this.plugin.tabInterface;
      if (!ti.enabled || !ti.parent || !ll.bank || !ll.bank.open) return null;
      ti.repositionButtons();
      const P = ti.parent;
      if (!P.newTab) return null;
      const res = this.plugin.resources || {};
      const img = (k, r) => { if (res[k]) g.drawImage(res[k], r.x, r.y, r.w, r.h); };
      img('new-tab.png', P.newTab);
      img('up-arrow.png', P.up);
      img('down-arrow.png', P.down);
      for (const t of ti.visibleTabs()) {
        img(t.tab.getTag() === ti.activeTag ? 'tag-tab-active.png' : 'tag-tab.png', t);
        const icon = itemManager.getImage(t.tab.getIconItemId(), 1);
        if (icon) g.drawImage(icon, t.x + MARGIN + 3 - MARGIN, t.y + 4);
      }
      // the tag tab tab's items, in the bank's item area
      for (const t of ti.tagTabTabItems()) {
        const c = t.clip;
        if (t.y + t.h <= c.y || t.y >= c.y + c.h) continue;
        const icon = itemManager.getImage(t.tab.getIconItemId(), 1);
        if (icon) g.drawImage(icon, t.x, t.y);
      }
      return null;
    }
  }

  // ---- BankTagsPlugin
  class BankTagsPlugin {
    constructor() {
      this.configGroup = CONFIG_GROUP;
      this.activeTag = null; this.activeBankTag = null; this.activeLayout = null; this.options = 0;
    }
    getActiveTag() { return this.activeTag; }
    getActiveBankTag() { return this.activeBankTag; }
    getActiveLayout() { return this.activeLayout; }
    getOptions() { return this.options; }

    startUp() {
      const cfg = rl.configProxy(CONFIG_GROUP, () => this.configItems);
      // (BankTagsConfig's getters and setters, by RuneLite's method names)
      this.config = {
        tabs: () => cfg.useTabs(), rememberTab: () => cfg.rememberTab(), removeSeparators: () => cfg.removeTabSeparators(),
        preventTagTabDrags: () => cfg.preventTagTabDrags(),
        position: (v) => (v === undefined ? cfg.position() : configManager.setConfiguration(CONFIG_GROUP, 'position', v)),
        tab: (v) => (v === undefined ? cfg.tab() || '' : configManager.setConfiguration(CONFIG_GROUP, 'tab', v == null ? '' : v)),
      };
      this.tagManager = new TagManager();
      this.tabManager = new TabManager();
      this.tabInterface = new TabInterface(this, this.tagManager, this.tabManager, this.config);
      this.cleanConfig();
      this.overlay = new TabOverlay(this);
      rl.overlayManager.add(this.overlay);
      // the tab column's widget ops while the mouse is over it
      this.menuHook = (c) => {
        if (!ll.bank || !ll.bank.open || client.isMenuOpen()) return;
        const entries = this.tabInterface.menuEntries(client.getMouseCanvasPosition());
        if (!entries) return;
        for (let i = entries.length - 1; i >= 0; --i) {
          const e = entries[i];
          ll.insertMenuEntry(c, c[ll.fields.menuCount] | 0, rl.toGameTags(e.option) + (e.target ? ' ' + rl.toGameTags(e.target) : ''), e.run);
        }
      };
      rl.menuBuildHooks.push(this.menuHook);
      // dragging a bank item or a tab onto a tab (WidgetDrag)
      this.dragging = null;
      this.mouseListener = {
        mousePressed: (e) => {
          this.dragging = null;
          if (e.getButton() !== 0 || !this.tabInterface.enabled || !ll.bank || !ll.bank.open) return e;
          const on = this.tabInterface.hitTest(e.getPoint());
          if (on && on.tab) { this.dragging = { tab: on.tab, x: e.getX(), y: e.getY() }; return e; }
          const entries = client.getMenuEntries();
          const top = entries[entries.length - 1];
          if (top && top.getParam1() === ll.BANK.inv && top.getIdentifier() > 0) this.dragging = { itemId: top.getIdentifier(), x: e.getX(), y: e.getY() };
          return e;
        },
        mouseReleased: (e) => {
          const d = this.dragging;
          this.dragging = null;
          if (!d || (Math.abs(e.getX() - d.x) <= 5 && Math.abs(e.getY() - d.y) <= 5)) return e;
          this.tabInterface.onDragReleased(d, e.getPoint(), client.isKeyPressed(rl.KeyCode.KC_SHIFT));
          return e;
        },
      };
      rl.mouseManager.registerMouseListener(this.mouseListener);
      // the mouse wheel over the tab column scrolls the tabs (the scroll component's onScrollWheel)
      this.wheel = (e) => {
        if (!this.tabInterface.enabled || !ll.bank || !ll.bank.open || !e.deltaY) return;
        const P = this.tabInterface.parent;
        const p = client.getMouseCanvasPosition();
        if (!P || !P.scroll || !(inRect(P.scroll, p) || inRect(P.up, p) || inRect(P.down, p) || inRect(P.newTab, p))) return;
        e.preventDefault(); e.stopImmediatePropagation();
        this.tabInterface.scrollTab(e.deltaY > 0 ? 1 : -1);
      };
      window.addEventListener('wheel', this.wheel, { capture: true, passive: false });
      if (ll.bank && ll.bank.open) this.onScriptPreFired({ getScriptId: () => rl.ScriptID.BANKMAIN_INIT });
      this.reinitBank();
    }

    shutDown() {
      rl.overlayManager.remove(this.overlay);
      const i = rl.menuBuildHooks.indexOf(this.menuHook);
      if (i >= 0) rl.menuBuildHooks.splice(i, 1);
      rl.mouseManager.unregisterMouseListener(this.mouseListener);
      window.removeEventListener('wheel', this.wheel, { capture: true });
      // since the tab interface is unregistered, manually deinit it and then reinit the bank
      this.tabInterface.deinit();
      this.reinitBank();
    }

    /** [clientscript,bankmain_init]: the bank's view again, with or without a tag */
    reinitBank() { if (ll.bank && ll.bank.open) rl.bankSearch.layoutBank(); }

    resetConfiguration() {
      for (const prefix of [ITEM_KEY_PREFIX, TAG_ICON_PREFIX, TAG_TABS_CONFIG]) {
        for (const key of configManager.getConfigurationKeys(CONFIG_GROUP + '.' + prefix)) {
          const str = key.split('.');
          if (str.length >= 2) configManager.unsetConfiguration(str[0], key.slice(str[0].length + 1));
        }
      }
      this.reinitBank();
    }

    /** @Deprecated cleanConfig: tags and icons from older versions with "<>/:" in them */
    cleanConfig() {
      this.removeInvalidTags(TAG_TABS_CONFIG);
      for (const s of configManager.getConfigurationKeys(CONFIG_GROUP + '.item_')) this.removeInvalidTags(s.slice(CONFIG_GROUP.length + 1));
      for (const s of configManager.getConfigurationKeys(CONFIG_GROUP + '.icon_')) {
        const key = s.slice(CONFIG_GROUP.length + 1);
        const replaced = key.replace(/[<>/]/g, '');
        if (key !== replaced) {
          const value = configManager.getConfiguration(CONFIG_GROUP, key);
          configManager.unsetConfiguration(CONFIG_GROUP, key);
          if (replaced.length > 'icon_'.length) configManager.setConfiguration(CONFIG_GROUP, replaced, value);
        }
      }
    }

    removeInvalidTags(key) {
      const value = configManager.getConfiguration(CONFIG_GROUP, key);
      if (value == null) return;
      let replaced = String(value).replace(/[<>:/]/g, '');
      if (String(value) !== replaced) {
        replaced = Text.toCSV(Text.fromCSV(replaced));
        if (!replaced) configManager.unsetConfiguration(CONFIG_GROUP, key);
        else configManager.setConfiguration(CONFIG_GROUP, key, replaced);
      }
    }

    // (the TabInterface is registered on the event bus with the plugin: its subscribers are called from here)
    onScriptPreFired(event) { this.tabInterface.onScriptPreFired(event); }
    onWidgetLoaded(event) {
      // the bank opened: [clientscript,bankmain_init]
      if (event.getGroupId() === BANKMAIN) this.tabInterface.onScriptPreFired({ getScriptId: () => rl.ScriptID.BANKMAIN_INIT });
    }
    onWidgetClosed(event) { this.tabInterface.onWidgetClosed(event); }

    onScriptCallbackEvent(event) {
      const eventName = event.getEventName();
      const intStack = client.getIntStack();
      const objectStack = client.getObjectStack();
      const intStackSize = client.getIntStackSize();
      const objectStackSize = client.getObjectStackSize();
      switch (eventName) {
        case 'setSearchBankInputText':
          objectStack[objectStackSize - 1] = SEARCH_BANK_INPUT_TEXT;
          break;
        case 'setSearchBankInputTextFound': {
          const matches = intStack[intStackSize - 1];
          objectStack[objectStackSize - 1] = SEARCH_BANK_INPUT_TEXT_FOUND.replace('%d', String(matches));
          break;
        }
        case 'bankSearchFilter': {
          const itemId = intStack[intStackSize - 1];
          let searchfilter = String(objectStack[objectStackSize - 1] || '');
          let tag = this.activeBankTag;
          let tagSearch = true;
          const bankOpen = client.getItemContainer(rl.InventoryID.BANK) != null;
          if (tag == null || !bankOpen) {
            if (!searchfilter) return;
            tagSearch = searchfilter.startsWith(TAG_SEARCH);
            if (tagSearch) searchfilter = searchfilter.slice(TAG_SEARCH.length).trim();
            // Build a temporary BankTag using the search filter
            tag = this.buildSearchFilterBankTag(searchfilter);
          }
          if (itemId === -1 && this.activeLayout != null) return; // item -1 always passes on a laid out tab
          if (itemId > -1 && tag.contains(itemId)) intStack[intStackSize - 2] = 1;
          // if the item isn't tagged we return false to prevent the item matching if the item name happens to
          // contain the tag name.
          else if (tagSearch) intStack[intStackSize - 2] = 0;
          break;
        }
        case 'getSearchingTagTab':
          intStack[intStackSize - 1] = this.activeBankTag != null ? 1 : 0;
          break;
        default:
      }
    }

    onMenuEntryAdded(event) {
      if (event.getActionParam1() === ll.BANK.inv && event.getOption() === 'Examine') {
        const itemId = event.getIdentifier();
        const tags = this.tagManager.getTags(itemId, false);
        for (const t of this.tagManager.getTags(itemId, true)) tags.add(t);
        const tagCount = [...tags].filter((tag) => developerMode || !this.tagManager.isHidden(tag)).length;
        let text = EDIT_TAGS_MENU_OPTION;
        if (tagCount > 0) text += ' (' + tagCount + ')';
        client.createMenuEntry(-1)
          .setParam0(event.getActionParam0())
          .setParam1(event.getActionParam1())
          .setTarget(event.getTarget())
          .setOption(text)
          .setType(rl.MenuAction.RUNELITE)
          .setIdentifier(event.getIdentifier())
          .setItemId(itemId)
          .onClick((e) => this.editTags(e));
      }
      this.tabInterface.onMenuEntryAdded(event);
    }

    editTags(entry) {
      const itemId = entry.getItemId();
      const name = itemManager.getItemComposition(itemId).getName();
      // Get both tags and vartags and append * to end of vartags name
      const tags = [...this.tagManager.getTags(itemId, false)].filter((tag) => developerMode || !this.tagManager.isHidden(tag));
      for (const tag of this.tagManager.getTags(itemId, true)) if (developerMode || !this.tagManager.isHidden(tag)) tags.push(tag + '*');
      const initialValue = Text.toCSV(tags);
      // (the 2007 chat box prompt has one line for the title: RuneLite's second "<br>" line is left out)
      chatboxPanelManager.openTextInput(name + ' tags:')
        .value(initialValue)
        .onDone((newValue) => {
          // Split inputted tags to vartags (ending with *) and regular tags
          const newTags = Text.fromCSV(filtered(newValue).toLowerCase());
          const newVarTags = newTags.filter((s) => s.endsWith(VAR_TAG_SUFFIX)).map((s) => s.slice(0, s.length - VAR_TAG_SUFFIX.length));
          const plain = newTags.filter((s) => !s.endsWith(VAR_TAG_SUFFIX));
          // And save them
          this.tagManager.setTagString(itemId, Text.toCSV(plain), false);
          this.tagManager.setTagString(itemId, Text.toCSV(newVarTags), true);
          // If a tab if active, rebuild the bank to apply the changes
          this.tabInterface.reloadActiveTab();
        })
        .build();
    }

    onConfigChanged(event) {
      // (the app's config changes come without a key: the "Use tag tabs" toggle is noticed by its value)
      if (event.getGroup() === CONFIG_GROUP && (event.getKey() === 'useTabs' || event.getKey() == null) && ll.bank && ll.bank.open
        && this.tabInterface.enabled !== this.config.tabs()) {
        this.onScriptPreFired({ getScriptId: () => rl.ScriptID.BANKMAIN_INIT });
        this.reinitBank();
      }
    }

    openTag(tag, layout, options = OPTION_ALLOW_MODIFICATIONS) {
      if (tag == null) {
        this.activeTag = null; this.activeBankTag = null; this.activeLayout = null; this.options = 0;
        return;
      }
      this.activeTag = tag;
      this.activeBankTag = this.buildSearchFilterBankTag(tag);
      this.activeLayout = layout;
      this.options = options;
      this.tabInterface.openTag(tag, layout, options, true);
    }

    buildSearchFilterBankTag(tag) {
      // custom tags are combined with the tab
      const custom = this.tagManager.findCustomTag(tag);
      return { contains: (itemId) => this.tagManager.findTag(itemId, tag) || (custom != null && custom.contains(itemId)) };
    }

    /** BankTagsService.openBankTag(name, options) (layouts: none) */
    openBankTag(name, options = OPTION_ALLOW_MODIFICATIONS) { this.openTag(name, null, options); }

    closeBankTag() {
      this.tabInterface.closeTag(false);
      this.activeTag = null; this.activeBankTag = null; this.activeLayout = null; this.options = 0;
      rl.bankSearch.layoutBank();
    }
  }

  const plugin = new BankTagsPlugin();
  rl.registerPlugin('banktags', plugin);
  // BankTagsService for other plugins (Clue Scroll's, ...)
  rl.bankTagsService = {
    OPTION_ALLOW_MODIFICATIONS, OPTION_HIDE_TAG_NAME, OPTION_NO_LAYOUT, OPTION_ITEMS_NOT_IN_LAYOUT_AT_BOTTOM,
    openBankTag: (tag, options) => plugin.openBankTag(tag, options),
    closeBankTag: () => plugin.closeBankTag(),
    getActiveTag: () => plugin.getActiveTag(),
    getActiveBankTag: () => plugin.getActiveBankTag(),
    getActiveLayout: () => null,
  };
  ll.bankTagsTest = { plugin, TagManager, TabManager, TagTab, findItem };

  // ---- 2007RS: the tags kept with the account on the server (engine AppBank), so they follow the player to any
  // computer's app (only the app uses them). At login the app asks for them (::appbank get); the server's replace the
  // ones here, except the first time, when the server has none and these are sent up. Each change after that goes
  // up as it's made. Keys and values go URI-encoded (a command is lower case, 80 characters at most), a few a tick.
  const SYNCED = /^(item_\d+|icon_.+|hidden_.+|tagtabs)$/;
  const enc = (v) => encodeURIComponent(String(v)).replace(/[!'()*]/g, (ch) => '%' + ch.charCodeAt(0).toString(16)).toLowerCase();
  const dec = (v) => { try { return decodeURIComponent(v); } catch { return v; } };
  const sync = { queue: [], timer: null, applying: false, incoming: null, account: null };
  function pump() {
    if (!sync.queue.length) { clearInterval(sync.timer); sync.timer = null; return; }
    if (client.getGameState() !== rl.GameState.LOGGED_IN || !ll.api || !ll.api.command) return;
    // (the server reads 5 of a player's commands and clicks a tick: 2 a tick leaves room for play)
    for (let i = 0; i < 2 && sync.queue.length; i++) ll.api.command(sync.queue.shift());
  }
  function send(cmd) {
    sync.queue.push(cmd);
    if (!sync.timer) sync.timer = setInterval(pump, 300);
  }
  function sendKey(key, value) {
    const k = enc(key);
    if (value === undefined || value === null || value === '') { send('appbank del ' + k); return; }
    const v = enc(value);
    const line = `appbank set ${k} ${v}`;
    if (line.length <= 80) { send(line); return; }
    send('appbank k ' + k);
    for (let i = 0; i < v.length;) {
      // (never split a %xx)
      let end = Math.min(i + 68, v.length);
      while (end < v.length && v.lastIndexOf('%', end - 1) > end - 3) end--;
      send('appbank v ' + v.slice(i, end));
      i = end;
    }
    send('appbank put');
  }
  const localKeys = () => configManager.getConfigurationKeys(CONFIG_GROUP + '.').map((k) => k.slice(CONFIG_GROUP.length + 1)).filter((k) => SYNCED.test(k));
  const origSet = configManager.setConfiguration;
  configManager.setConfiguration = function setConfiguration(group, a, b) {
    const r = origSet.apply(this, arguments);
    if (group === CONFIG_GROUP && arguments.length === 3 && !sync.applying && sync.account && SYNCED.test(String(a))) sendKey(String(a), b);
    return r;
  };
  ll.appBankListeners.add((rec) => {
    const sp = rec.indexOf(' ');
    const kind = sp < 0 ? rec : rec.slice(0, sp);
    const rest = sp < 0 ? '' : rec.slice(sp + 1);
    if (kind === 'begin') { sync.incoming = new Map(); return; }
    if (kind === 'kv' && sync.incoming) {
      const s2 = rest.indexOf(' ');
      if (s2 > 0) sync.incoming.set(dec(rest.slice(0, s2)), dec(rest.slice(s2 + 1)));
      return;
    }
    if (kind !== 'end' || !sync.incoming) return;
    const incoming = sync.incoming;
    sync.incoming = null;
    const mine = localKeys();
    const account = String(client.getAccountHash());
    // (the account these tags were last kept for; not sent up)
    const owner = configManager.getConfiguration(CONFIG_GROUP, 'syncedaccount');
    sync.account = account;
    origSet.call(configManager, CONFIG_GROUP, 'syncedaccount', account);
    if (!incoming.size && (!owner || owner === account)) {
      // the server has none yet: these go up (this computer's tags, the first login with them)
      if (mine.length) {
        send('appbank reset');
        for (const k of mine) sendKey(k, configManager.getConfiguration(CONFIG_GROUP, k));
      }
      return;
    }
    // (an account with none, after another account's: it starts with none, not the other's)
    sync.applying = true;
    try {
      for (const k of mine) if (!incoming.has(k)) configManager.unsetConfiguration(CONFIG_GROUP, k);
      for (const [k, v] of incoming) if (SYNCED.test(k) && String(configManager.getConfiguration(CONFIG_GROUP, k)) !== v) configManager.setConfiguration(CONFIG_GROUP, k, v);
    } finally {
      sync.applying = false;
    }
    const ti = plugin.tabInterface;
    if (ti && ti.enabled) ti.init();
  });
  // at each login, the account's tags
  rl.eventBus.register({
    onGameStateChanged(e) {
      // (once a login: LOGGED_IN comes again after each map load)
      const s = e.getGameState();
      if (s === rl.GameState.LOGIN_SCREEN) { sync.account = null; sync.asked = false; sync.queue.length = 0; }
      else if (s === rl.GameState.LOGGED_IN && !sync.asked) { sync.asked = true; send('appbank get'); }
    },
  });
  if (client.getGameState() === rl.GameState.LOGGED_IN) { sync.asked = true; send('appbank get'); }
  ll.bankTagsSync = sync;
})();
