// RuneLite's Quest List plugin, cloned from net.runelite.client.plugins.questlist (BSD 2-Clause, Copyright (c) 2019,
// Spudjb and RuneLite contributors): QuestListPlugin.
// 2007: the quest list is if1 interface 274 (header 274:10, the diary swap button 274:11 at the header's right, lines
// 274:13.. in scroll layer 274:0, 15 px apart), with no QUESTLIST_INIT script or questFilter callback. The search button
// (OSRS: a GeSmallicons.SEARCH child of Questlist.UNIVERSE, 18 x 17, 5 px from the right) is drawn by an overlay left of
// the swap button, with its op through the core's widgetButtons ("Open" / "Close" Search). The filter is applied with the
// core's display-only writes: quests whose name doesn't contain the text are hidden and the rest close up (the headers
// stay, as OSRS's filter only hides quests); everything goes back when the search closes.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Overlay, OverlayPosition, OverlayLayer, Rectangle, Color } = rl;
  const MENU_OPEN = 'Open';
  const MENU_CLOSE = 'Close';
  const MENU_SEARCH = 'Search';
  const QUESTLIST = 274;
  const CONTAINER = (QUESTLIST << 16) | 0;
  const SWAP_BUTTON = (QUESTLIST << 16) | 11;
  const FIRST_LINE = 13;

  class QuestSearchButtonOverlay extends Overlay {
    constructor(plugin) { super(plugin); this.plugin = plugin; this.setPosition(OverlayPosition.DYNAMIC); this.setLayer(OverlayLayer.ABOVE_WIDGETS); }
    render(g) {
      const b = this.plugin.searchButtonBounds();
      if (!b) return null;
      const img = this.plugin.searchIcon();
      if (img) g.drawImage(img, b.x, b.y, b.width, b.height);
      if (this.plugin.isChatboxOpen()) { g.setColor(new Color(120, 0, 0, 110)); g.fillRect(b.x, b.y, b.width, b.height); }
      return null;
    }
  }

  class QuestListPlugin {
    constructor() { this.configGroup = 'questlist'; this.searchInput = null; this.questSearchButton = null; this.saved = null; }
    startUp() {
      this.overlay = new QuestSearchButtonOverlay(this);
      rl.overlayManager.add(this.overlay);
      this.addQuestButtons();
    }
    shutDown() {
      rl.overlayManager.remove(this.overlay);
      if (this.questSearchButton) rl.widgetButtons.remove(this.questSearchButton);
      this.questSearchButton = null;
      if (this.isChatboxOpen()) rl.chatboxPanelManager.close();
      this.restoreQuests();
    }
    addQuestButtons() {
      const self = this;
      this.questSearchButton = rl.widgetButtons.add({
        action: MENU_OPEN,
        listener: () => self.openSearch(),
        visible: () => self.searchButtonBounds() != null,
        bounds: () => self.searchButtonBounds(),
        option() { return this.action; },
        target: () => MENU_SEARCH,
        onClick() { this.listener(); },
      });
    }
    /** left of the 2007 swap button, where OSRS's button sits at the header's right */
    searchButtonBounds() {
      const header = client.getWidget(SWAP_BUTTON);
      if (header == null || header.isHidden()) return null;
      const p = header.getCanvasLocation();
      return new Rectangle(p.getX() - 18 - 5, p.getY(), 18, 17);
    }
    searchIcon() { return rl.spriteManager.getAsset ? rl.spriteManager.getAsset('bank/search.png') : null; }
    onClientTick() {
      // (OSRS: onVarbitChanged / onVarClientIntChanged TOPLEVEL_PANEL)
      if (this.isChatboxOpen() && !this.isOnQuestTab()) rl.chatboxPanelManager.close();
    }
    isOnQuestTab() { const w = client.getWidget(CONTAINER); return w != null && !w.isHidden(); }
    isChatboxOpen() { return this.searchInput != null && rl.chatboxPanelManager.getCurrentInput() === this.searchInput; }
    closeSearch() {
      rl.chatboxPanelManager.close();
      this.redrawQuests();
    }
    openSearch() {
      const btn = this.questSearchButton;
      btn.action = MENU_CLOSE;
      btn.listener = () => this.closeSearch();
      this.searchInput = rl.chatboxPanelManager.openTextInput('Search quest list')
        .onChanged(() => this.redrawQuests())
        .onDone(() => false)
        .onClose(() => {
          this.redrawQuests();
          btn.listener = () => this.openSearch();
          btn.action = MENU_OPEN;
        })
        .build();
    }
    /** the quest lines (the questFilter callback's work: a quest is shown if its name contains the filter) */
    redrawQuests() {
      const filter = this.isChatboxOpen() ? this.searchInput.getValue() : '';
      if (!filter) { this.restoreQuests(); return; }
      const lines = this.questLines();
      if (!lines.length) return;
      if (!this.saved) this.saved = lines.map((w) => ({ w, x: w.getOriginalX(), y: w.getOriginalY() }));
      let y = this.saved[0].y; const step = this.saved.length > 1 ? this.saved[1].y - this.saved[0].y : 15;
      for (const { w, x } of this.saved) {
        const quest = (w.getActions() || []).some((a) => a && a.trim());
        const show = !quest || w.getText().toLowerCase().includes(filter.toLowerCase());
        w.setHidden(!show);
        if (show) { w.setOriginalX(x).setOriginalY(y).revalidate(); y += step; }
      }
    }
    restoreQuests() {
      if (!this.saved) return;
      for (const { w, x, y } of this.saved) { w.setHidden(false); w.setOriginalX(x).setOriginalY(y).revalidate(); }
      this.saved = null;
    }
    questLines() {
      const ws = [];
      for (let i = FIRST_LINE; ; i++) {
        const w = client.getWidget(QUESTLIST, i);
        if (w == null || !ll.api.com((QUESTLIST << 16) | i) || ll.api.com((QUESTLIST << 16) | i).type !== 4) break;
        if (w.getText()) ws.push(w);
      }
      return ws;
    }
  }

  const plugin = new QuestListPlugin();
  ll.__questlist = { plugin };
  rl.registerPlugin('questlist', plugin);
})();
