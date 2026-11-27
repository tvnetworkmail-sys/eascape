// RuneLite's FPS Control, cloned from net.runelite.client.plugins.fps (BSD 2-Clause, Copyright (c)
// 2017, Levi <me@levischuck.com> and RuneLite contributors): FpsPlugin, FpsOverlay.
(() => {
  const rl = window.__lostlite && window.__lostlite.rl;
  if (!rl) return;
  const { client, Overlay, OverlayPosition, OverlayLayer, OverlayPriority, OverlayUtil, Point, Color } = rl;

  class FpsOverlay extends Overlay {
    constructor(plugin) {
      super(plugin); this.config = plugin.config; this.isFocused = true;
      this.setLayer(OverlayLayer.ABOVE_WIDGETS); this.setPriority(OverlayPriority.HIGH); this.setPosition(OverlayPosition.DYNAMIC);
    }
    isEnforced() { return this.config.limitFps() || (this.config.limitFpsUnfocused() && !this.isFocused); }
    render(graphics) {
      if (!this.config.drawFps()) return null;
      const text = client.getFPS() + ' FPS';
      const fm = graphics.getFontMetrics();
      const w = fm.stringWidth(text);
      const h = fm.getAscent() - fm.getDescent();
      OverlayUtil.renderTextLocation(graphics, new Point(client.getCanvasWidth() - w - 1, h + 1), text, this.isEnforced() ? Color.RED : Color.YELLOW);
      return null;
    }
  }
  class FpsPlugin {
    constructor() { this.configGroup = 'fpscontrol'; this.config = rl.configProxy('fpscontrol', () => this.configItems); this.overlay = new FpsOverlay(this); }
    startUp() { rl.overlayManager.add(this.overlay); }
    shutDown() { rl.overlayManager.remove(this.overlay); }
    onFocusChanged(e) { this.overlay.isFocused = e.isFocused(); }
  }
  rl.registerPlugin('fps', new FpsPlugin());
})();
