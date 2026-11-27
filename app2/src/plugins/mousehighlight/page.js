// RuneLite's Mouse Tooltips, cloned from net.runelite.client.plugins.mousehighlight (BSD 2-Clause,
// Copyright (c) 2017, Aria <aria@ar1as.space> and RuneLite contributors): MouseHighlightPlugin,
// MouseHighlightOverlay. The 2007 client's menu actions aren't OSRS's MenuAction values, so "is this
// an interface entry" is where the mouse is: outside the game view (the chat box below it, the
// spellbook when the magic tab is open in the side panel). No tooltip varcs in 2007.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Overlay, OverlayPosition, OverlayLayer, Tooltip } = rl;
  const MAGIC_TAB = 6;

  class MouseHighlightOverlay extends Overlay {
    constructor(plugin) { super(plugin); this.config = plugin.config; this.setPosition(OverlayPosition.DYNAMIC); this.setLayer(OverlayLayer.ABOVE_WIDGETS); }
    render() {
      if (client.isMenuOpen()) return null;
      const entries = client.getMenuEntries();
      const last = entries.length - 1;
      if (last < 0) return null;
      const e = entries[last];
      const option = e.getOption();
      const target = e.getTarget();
      if (!option) return null;
      switch (option) {
        case 'Walk here': case 'Cancel': case 'Continue': case 'Set heading': return null;
        case 'Move': if (target.includes('Sliding piece')) return null; break;
        default:
      }
      const m = client.getMouseCanvasPosition();
      const vx = client.getViewportXOffset(); const vy = client.getViewportYOffset();
      const inView = m.x >= vx && m.y >= vy && m.x < vx + client.getViewportWidth() && m.y < vy + client.getViewportHeight();
      if (!inView) {
        if (!this.config.uiTooltip()) return null;
        if (!this.config.chatboxTooltip() && m.y >= 338 && m.x < 519) return null;
        const tabs = ll.read && ll.read('sideIcon');
        if (this.config.disableSpellbooktooltip() && m.x >= 519 && tabs && tabs[MAGIC_TAB] !== -1 && tabs[MAGIC_TAB] !== 0 && ll.client && ll.client.selectedTab === MAGIC_TAB) return null;
      }
      rl.tooltipManager.addFront(new Tooltip(option + (target ? ' ' + target : '')));
      return null;
    }
  }

  class MouseHighlightPlugin {
    constructor() { this.configGroup = 'mousehighlight'; this.config = rl.configProxy('mousehighlight', () => this.configItems); this.overlay = new MouseHighlightOverlay(this); }
    startUp() { rl.overlayManager.add(this.overlay); }
    shutDown() { rl.overlayManager.remove(this.overlay); }
  }
  rl.registerPlugin('mousehighlight', new MouseHighlightPlugin());
})();
