// RuneLite's Tile Indicators, cloned from net.runelite.client.plugins.tileindicators (BSD 2-Clause,
// Copyright (c) 2018, Tomasz Kruszewski and RuneLite contributors): TileIndicatorsPlugin, TileIndicatorsOverlay.
// (No cutscene varbit in the 2007 hook; the true tile is the player's server-side route position.)
(() => {
  const rl = window.__lostlite && window.__lostlite.rl;
  if (!rl) return;
  const { client, Overlay, OverlayPosition, OverlayLayer, OverlayPriority, Perspective, OverlayUtil, BasicStroke, LocalPoint } = rl;

  class TileIndicatorsOverlay extends Overlay {
    constructor(plugin) { super(plugin); this.config = plugin.config; this.setPosition(OverlayPosition.DYNAMIC); this.setLayer(OverlayLayer.ABOVE_SCENE); this.setPriority(OverlayPriority.MED); }
    render(graphics) {
      const c = this.config;
      if (c.highlightHoveredTile()) {
        const tile = client.getSelectedSceneTile();
        if (tile) this.renderTile(graphics, tile.getLocalLocation(), c.highlightHoveredColor(), c.hoveredTileBorderWidth(), c.hoveredTileFillColor());
      }
      if (c.highlightDestinationTile()) this.renderTile(graphics, client.getLocalDestinationLocation(), c.highlightDestinationColor(), c.destinationTileBorderWidth(), c.destinationTileFillColor());
      if (c.highlightCurrentTile()) {
        const player = client.getLocalPlayer();
        if (!player) return null;
        const lp = LocalPoint.fromScene(player.info.trueX, player.info.trueZ);
        this.renderTile(graphics, lp, c.highlightCurrentColor(), c.currentTileBorderWidth(), c.currentTileFillColor());
      }
      return null;
    }
    renderTile(graphics, dest, color, borderWidth, fillColor) {
      if (!dest) return;
      const poly = Perspective.getCanvasTilePoly(client, dest);
      if (!poly) return;
      OverlayUtil.renderPolygon(graphics, poly, color, fillColor, new BasicStroke(borderWidth));
    }
  }

  class TileIndicatorsPlugin {
    constructor() { this.configGroup = 'tileindicators'; this.config = rl.configProxy('tileindicators', () => this.configItems); this.overlay = new TileIndicatorsOverlay(this); }
    startUp() { rl.overlayManager.add(this.overlay); }
    shutDown() { rl.overlayManager.remove(this.overlay); }
  }
  rl.registerPlugin('tileindicators', new TileIndicatorsPlugin());
})();
