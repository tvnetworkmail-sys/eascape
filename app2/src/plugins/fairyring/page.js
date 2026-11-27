// RuneLite's Fairy Rings plugin, cloned from net.runelite.client.plugins.fairyring (BSD 2-Clause, Copyright (c) 2018,
// Abex and RuneLite contributors): FairyRingPlugin, FairyRing.
// 2007: the code screen is 2007's interface 426 (EASCape's fairyrings.if); its "Teleport to this location" text
// (OSRS: Fairyrings.CONFIRM) is found by its text when the screen opens and shows the destination (display only). The
// dials are our server's fairyring_dial1-3, bits 0-2 / 3-5 / 6-8 of varp 777 (the 2007 cache numbers those varbits
// otherwise), with OSRS's letter order (0 A, 1 D, 2 C, 3 B ...). FairyRing is RuneLite's enum trimmed to the 36 codes
// our server's rings lead to (fairy_rings.dbrow); era-trim: DKR's "Grand Exchange" (Nov 2007) and CJR's Falo tags dropped.
// The travel log is EASCape's own interface 620 (2007 has none): slot n's layer is 620:(3 + 12n), its code text +9 and
// its "Select" buttons +2 / +4; it has no search box or fairyringFilter callbacks, so "Edit Tags" goes on the log's
// Select (OSRS: "Use code") and the search is a button by the log's title (the core's widgetButtons) whose filter hides
// the slots that don't match and closes up the rest (display only; the server's positions come back when it closes).
// Tags are kept as RuneLite keeps them ("fairyrings.fairyringtags" + code) under our group "fairyrings", key
// "fairyringtags.<code>".
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Text, Overlay, OverlayPosition, OverlayLayer, Rectangle, Color } = rl;

  const leftDial = ['A', 'D', 'C', 'B'];
  const middleDial = ['I', 'L', 'K', 'J'];
  const rightDial = ['P', 'S', 'R', 'Q'];
  const EDIT_TAGS_MENU_OPTION = 'Edit Tags';
  const CONFIG_GROUP = 'fairyrings';
  const CONFIG_GROUP_TAGS = 'fairyringtags';
  const FAIRYRINGS = 426;
  const FAIRYRINGS_LOG = 620;
  const LOG_TITLE = (FAIRYRINGS_LOG << 16) | 0;
  const LOG_SLOTS = 36;
  const FAIRYRINGS_MULTI = 777;
  const INTERFACE_SELECT1 = 2266;

  const R = (destination, tags = '') => ({ destination, tags });
  const FairyRing = {
    AIQ: R('Mudskipper Point'), AIR: R('(Island) South-east of Ardougne'), AJR: R('Slayer cave'), AJS: R('Penguins near Miscellania'),
    AKQ: R('Piscatoris Hunter area'), AKS: R('Feldip Hunter area'), ALQ: R('Haunted Woods east of Canifis'), ALR: R('Abyssal Area'),
    ALS: R("McGrubor's Wood"), BIP: R('(Island) South-west of Mort Myre'), BIQ: R('Kalphite Hive'), BIS: R('Ardougne Zoo - Unicorns'),
    BJR: R('Realm of the Fisher King'), BKP: R('South of Castle Wars'), BKQ: R('Enchanted Valley'), BKR: R('Mort Myre Swamp, south of Canifis'),
    BKS: R('Zanaris'), BLP: R('TzHaar area'), BLR: R("Legends' Guild"), CIP: R('(Island) Miscellania'), CIQ: R('North-west of Yanille'),
    CJR: R('Sinclair Mansion'), CKP: R("Cosmic entity's plane"), CKR: R('South of Tai Bwo Wannai Village'), CKS: R('Canifis'),
    CLP: R('(Island) South of Draynor Village'), CLS: R("(Island) Hazelmere's home"), DIR: R("Gorak's Plane"), DIS: R("Wizards' Tower"),
    DJP: R('Tower of Life'), DJR: R('Chasm of Fire'), DKP: R('South of Musa Point'), DKR: R('Edgeville'), DKS: R('Polar Hunter area'),
    DLQ: R('North of Nardah'), DLR: R('(Island) Poison Waste south of Isafdar'),
  };
  const forCode = (code) => (Object.prototype.hasOwnProperty.call(FairyRing, code) ? FairyRing[code] : null);
  const valueOf = (code) => { const r = forCode(code); if (!r) throw new Error('IllegalArgumentException'); return r; };

  class SearchButtonOverlay extends Overlay {
    constructor(plugin) { super(plugin); this.plugin = plugin; this.setPosition(OverlayPosition.DYNAMIC); this.setLayer(OverlayLayer.ABOVE_WIDGETS); }
    render(g) {
      const b = this.plugin.searchBounds();
      if (!b) return null;
      const img = rl.spriteManager.getAsset ? rl.spriteManager.getAsset('bank/search.png') : null;
      if (img) g.drawImage(img, b.x, b.y, b.width, b.height);
      if (this.plugin.isSearchOpen()) { g.setColor(new Color(120, 0, 0, 110)); g.fillRect(b.x, b.y, b.width, b.height); }
      return null;
    }
  }

  class FairyRingPlugin {
    constructor() {
      this.configGroup = CONFIG_GROUP;
      this.tagInput = null;
      this.searchInput = null;
      this.confirmId = -1;
      this.saved = null;
    }
    startUp() {
      this.overlay = new SearchButtonOverlay(this);
      rl.overlayManager.add(this.overlay);
      const self = this;
      this.searchButton = rl.widgetButtons.add({
        visible: () => self.searchBounds() != null, bounds: () => self.searchBounds(),
        option: () => (self.isSearchOpen() ? 'Close' : 'Open'), target: () => 'Search',
        onClick: () => (self.isSearchOpen() ? rl.chatboxPanelManager.close() : self.openSearch()),
      });
    }
    shutDown() {
      rl.overlayManager.remove(this.overlay);
      rl.widgetButtons.remove(this.searchButton);
      if (this.isSearchOpen()) rl.chatboxPanelManager.close();
      this.restoreSlots();
    }
    onVarbitChanged() { this.setWidgetTextToDestination(); }
    onWidgetLoaded(e) {
      if (e.getGroupId() === FAIRYRINGS) this.confirmId = -1;
      if (e.getGroupId() === FAIRYRINGS || e.getGroupId() === FAIRYRINGS_LOG) this.setWidgetTextToDestination();
      if (e.getGroupId() === FAIRYRINGS_LOG) this.saved = null;
    }
    /** Fairyrings.CONFIRM: the code screen's "Teleport to this location" text */
    confirmWidget() {
      if (!ll.api.ifOpen(FAIRYRINGS)) return null;
      if (this.confirmId < 0) {
        for (let i = 0; i < 200; i++) {
          const c = ll.api.com((FAIRYRINGS << 16) | i);
          if (c && c.type === 4 && (c.buttonText === 'Teleport to this location' || c.text === 'Teleport to this location' || (c.ops || []).includes('Teleport to this location'))) { this.confirmId = (FAIRYRINGS << 16) | i; break; }
        }
      }
      return this.confirmId < 0 ? null : client.getWidget(this.confirmId);
    }
    setWidgetTextToDestination() {
      const fairyRingTeleportButton = this.confirmWidget();
      if (fairyRingTeleportButton != null && !fairyRingTeleportButton.isHidden()) {
        let destination;
        try {
          const v = client.getVarps()[FAIRYRINGS_MULTI] | 0; // fairyring_dial1-3
          destination = this.getFairyRingDestination(v & 3, (v >> 3) & 3, (v >> 6) & 3).destination;
        } catch {
          destination = 'Invalid location';
        }
        if (fairyRingTeleportButton.getText() !== destination) fairyRingTeleportButton.setText(destination);
      }
    }
    getFairyRingDestination(l, m, r) { return valueOf(leftDial[l] + middleDial[m] + rightDial[r]); }
    onGameTick() {
      const confirm = this.confirmWidget();
      const fairyRingWidgetOpen = confirm != null && !confirm.isHidden();
      const tagInputBoxOpen = this.tagInput != null && rl.chatboxPanelManager.getCurrentInput() === this.tagInput;
      if (!fairyRingWidgetOpen && tagInputBoxOpen) rl.chatboxPanelManager.close();
      if (this.isSearchOpen() && !ll.api.ifOpen(FAIRYRINGS_LOG)) rl.chatboxPanelManager.close();
    }
    /** the code in a travel log slot from one of its components */
    slotOf(componentId) {
      if (componentId >>> 16 !== FAIRYRINGS_LOG) return -1;
      const i = (componentId & 0xffff) - 3;
      return i >= 0 && i < LOG_SLOTS * 12 ? Math.floor(i / 12) : -1;
    }
    slotCode(slot) { const c = ll.api.com((FAIRYRINGS_LOG << 16) | (3 + slot * 12 + 9)); return c ? Text.removeTags(c.text || '').replace(/ /g, '') : ''; }
    onMenuEntryAdded(event) {
      const slot = this.slotOf(event.getActionParam1());
      if (slot < 0 || event.getOption() !== 'Select') return;
      const code = this.slotCode(slot);
      if (!code) return;
      client.createMenuEntry(-1)
        .setParam0(event.getActionParam0())
        .setParam1(event.getActionParam1())
        .setTarget(`<col=ff9040>${code}</col>`)
        .setOption(EDIT_TAGS_MENU_OPTION)
        .setType(rl.MenuAction.RUNELITE)
        .setIdentifier(event.getIdentifier())
        .onClick((e) => this.setTagMenuOpen(e));
    }
    getConfigTags(code) {
      const config = String(rl.configManager.getConfiguration(CONFIG_GROUP, `${CONFIG_GROUP_TAGS}.${code}`) || '').toLowerCase();
      return Text.fromCSV(config);
    }
    setConfigTags(code, tags) {
      if (!tags) rl.configManager.unsetConfiguration(CONFIG_GROUP, `${CONFIG_GROUP_TAGS}.${code}`);
      else rl.configManager.setConfiguration(CONFIG_GROUP, `${CONFIG_GROUP_TAGS}.${code}`, tags);
    }
    setTagMenuOpen(menuEntry) {
      const code = Text.removeTags(menuEntry.getTarget()).replace(/ /g, '');
      const initialValue = Text.toCSV(this.getConfigTags(code));
      client.playSoundEffect(INTERFACE_SELECT1);
      this.tagInput = rl.chatboxPanelManager.openTextInput('Code ' + code + ' tags:')
        .value(initialValue)
        .onDone((s) => { this.setConfigTags(code, s); setTimeout(() => this.openSearch(), 0); })
        .build();
    }
    // ---- the travel log search (OSRS: the log's own search box and its fairyringFilter callbacks)
    searchBounds() {
      const t = client.getWidget(LOG_TITLE);
      if (!t || t.isHidden() || !ll.api.ifOpen(FAIRYRINGS_LOG)) return null;
      const p = t.getCanvasLocation();
      return new Rectangle(p.getX() + 190 - 5 - 18, p.getY() + 2, 18, 17);
    }
    isSearchOpen() { return this.searchInput != null && rl.chatboxPanelManager.getCurrentInput() === this.searchInput; }
    openSearch() {
      if (!ll.api.ifOpen(FAIRYRINGS_LOG)) return;
      this.searchInput = rl.chatboxPanelManager.openTextInput('Search fairy ring codes')
        .onChanged((s) => this.filterSlots(String(s)))
        .onDone(() => false)
        .onClose(() => this.restoreSlots())
        .build();
    }
    /** fairyringFilterDbrow for each shown slot: the code, its enum tags or its config tags contain the filter */
    matches(code, filter) {
      const ring = forCode(code);
      return code.toLowerCase().includes(filter) || (ring && ring.tags && ring.tags.includes(filter)) || this.getConfigTags(code).some((s) => s.includes(filter));
    }
    filterSlots(text) {
      const filter = text.toLowerCase();
      if (!filter) { this.restoreSlots(); return; }
      if (!this.saved) {
        this.saved = [];
        for (let n = 0; n < LOG_SLOTS; n++) {
          const id = (FAIRYRINGS_LOG << 16) | (3 + n * 12);
          const c = ll.api.com(id);
          if (c && !c.hide) this.saved.push({ n, w: client.getWidget(id), x: c.x, y: c.y });
        }
        this.saved.sort((a, b) => a.y - b.y);
      }
      if (!this.saved.length) return;
      let y = this.saved[0].y;
      for (const s of this.saved) {
        const show = this.matches(this.slotCode(s.n), filter);
        s.w.setHidden(!show);
        if (show) { s.w.setOriginalX(s.x).setOriginalY(y).revalidate(); y += s.w.getHeight() || 42; }
      }
    }
    restoreSlots() {
      if (!this.saved) return;
      for (const s of this.saved) { s.w.setHidden(false); s.w.setOriginalX(s.x).setOriginalY(s.y).revalidate(); }
      this.saved = null;
    }
  }

  const plugin = new FairyRingPlugin();
  ll.__fairyring = { plugin, FairyRing };
  rl.registerPlugin('fairyring', plugin);
})();
