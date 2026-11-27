// RuneLite's Minimap plugin, cloned from net.runelite.client.plugins.minimap (BSD 2-Clause, Copyright (c) 2018,
// Adam <Adam@sigterm.info> and RuneLite contributors): MinimapPlugin, MinimapDot.
// 2007: the dots are the client's mapdots sprites 0-4 (client hook mapDot, display only); Hide minimap is "resizable
// only" in RuneLite (it hides the resizable frames' minimap widgets) and 2007 has only the fixed frame, so it does
// nothing, as in RuneLite's fixed mode (the 2007 client ignores the hide flag on the frame's minimap layer 548:85); the zoom is the client's minimap scale (client hook minimapZoom,
// pixels per tile, 4 = the 2007 minimap), turned by the wheel over the minimap while Zoom is on (corea.js).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, configManager } = rl;

  const DOT_ITEM = 0; const DOT_NPC = 1; const DOT_PLAYER = 2; const DOT_FRIEND = 3; const DOT_TEAM = 4;
  const GROUP = 'minimap';
  const MAP_MINIMAP = (548 << 16) | 85;

  const MinimapDot = {
    MAP_DOT_WIDTH: 4, MAP_DOT_HEIGHT: 5,
    createPixels(color) {
      const rgb = color.getRGB() & 0xffffff;
      return [0, rgb, rgb, 0, rgb, rgb, rgb, rgb, rgb, rgb, rgb, rgb, 1, rgb, rgb, 1, 0, 1, 1, 0];
    },
    create(color) { return { px: MinimapDot.createPixels(color), w: MinimapDot.MAP_DOT_WIDTH, h: MinimapDot.MAP_DOT_HEIGHT }; },
  };

  class MinimapPlugin {
    constructor() {
      this.configGroup = GROUP;
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.saveTimer = null;
    }
    startUp() {
      this.updateMinimapWidgetVisibility(this.config.hideMinimap());
      this.replaceMapDots();
      client.setMinimapZoom(this.config.zoom());
      const zoomLevel = Number(configManager.getConfiguration(GROUP, 'zoomLevel'));
      if (zoomLevel > 0) client.setMinimapZoom(zoomLevel);
      this.saveTimer = setInterval(() => this.saveZoom(), 11000);
    }
    shutDown() {
      if (this.saveTimer) clearInterval(this.saveTimer);
      this.updateMinimapWidgetVisibility(false);
      this.restoreOriginalDots();
      client.setMinimapZoom(false);
    }
    onGameStateChanged(event) {
      if (event.getGameState() === 'LOGGED_IN') { this.replaceMapDots(); this.updateMinimapWidgetVisibility(this.config.hideMinimap()); }
    }
    onConfigChanged(event) {
      if (event.getGroup() !== GROUP) return;
      // (our config change events carry no key: everything is reapplied)
      this.updateMinimapWidgetVisibility(this.config.hideMinimap());
      if (!this.config.zoom()) client.setMinimapZoom(false);
      else client.setMinimapZoom(true);
      this.restoreOriginalDots();
      this.replaceMapDots();
    }
    saveZoom() {
      configManager.setConfiguration(GROUP, 'zoomLevel', client.getMinimapZoom());
    }
    updateMinimapWidgetVisibility(hide) {
      if (client.getGameState() !== 'LOGGED_IN') return;
      // RuneLite hides ToplevelOsrsStretch / ToplevelPreEoc MAP_MINIMAP and ORBS: resizable frames, not in 2007
      void hide; void MAP_MINIMAP;
    }
    replaceMapDots() {
      if (!client.getMapDots()) return;
      this.applyDot(DOT_ITEM, this.config.itemColor());
      this.applyDot(DOT_NPC, this.config.npcColor());
      this.applyDot(DOT_PLAYER, this.config.playerColor());
      this.applyDot(DOT_FRIEND, this.config.friendColor());
      this.applyDot(DOT_TEAM, this.config.teamColor());
    }
    applyDot(id, color) {
      if (id < client.getMapDots().length && color != null) client.setMapDot(id, MinimapDot.create(color));
    }
    restoreOriginalDots() {
      const n = client.getMapDots() ? client.getMapDots().length : 0;
      for (let i = 0; i < n; i++) client.setMapDot(i, null);
    }
  }

  const plugin = new MinimapPlugin();
  ll.__minimap = { plugin, MinimapDot };
  rl.registerPlugin('minimap', plugin);
})();
