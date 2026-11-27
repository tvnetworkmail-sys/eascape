// RuneLite's Screen Markers plugin, cloned from net.runelite.client.plugins.screenmarkers (BSD 2-Clause, Copyright (c)
// 2018, Kamiel <https://github.com/Kamielvf>, Psikoi <https://github.com/psikoi> and RuneLite contributors):
// ScreenMarkerPlugin, ScreenMarker, ScreenMarkerOverlay, ScreenMarkerCreationOverlay, ScreenMarkerRenderable,
// ScreenMarkerWidgetHighlightOverlay, ScreenMarkerMouseListener. The panels (ScreenMarkerPluginPanel, ScreenMarkerPanel,
// ScreenMarkerCreationPanel) are ui/panels/screenmarkers.js, drawn from the state this publishes; their actions come back
// through onPanelAction. Markers are saved as RuneLite's JSON (gson: a Color is {"value": argb}).
// Our overlay bounds are in game coordinates and an overlay draws in UI pixels (1 / the game's enlargement): the
// preferred sizes made by dragging are turned into UI pixels (rl.uiScale) and the creation overlay draws its preferred size.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Overlay, OverlayPosition, OverlayLayer, OverlayPriority, Color, BasicStroke, Dimension, Point, Rectangle, SwingUtilities } = rl;
  const CONFIG_GROUP = 'screenmarkers';
  const CONFIG_KEY = 'markers';
  const DEFAULT_MARKER_NAME = 'Marker';
  const DEFAULT_SIZE = new Dimension(2, 2);
  // ScreenMarkerPluginPanel
  const SELECTED_COLOR = Color.GREEN;
  const SELECTED_FILL_COLOR = new Color(0, 255, 0, 0);
  const SELECTED_BORDER_THICKNESS = 3;
  const PRIORITY_HIGH = OverlayPriority ? OverlayPriority.HIGH : 100;
  const argb = (c) => (c.getRGB() | 0);
  const colorOf = (v) => { const n = v >>> 0; return new Color((n >> 16) & 255, (n >> 8) & 255, n & 255, (n >>> 24) & 255); };

  class ScreenMarker {
    constructor(id, name, borderThickness, color, fill, visible, labelled) {
      Object.assign(this, { id, name, borderThickness, color, fill, visible, labelled });
    }
    getId() { return this.id; } getName() { return this.name; } setName(n) { this.name = n; }
    getBorderThickness() { return this.borderThickness; } setBorderThickness(t) { this.borderThickness = t; }
    getColor() { return this.color; } setColor(c) { this.color = c; }
    getFill() { return this.fill; } setFill(c) { this.fill = c; }
    isVisible() { return this.visible; } setVisible(v) { this.visible = v; }
    isLabelled() { return this.labelled; } setLabelled(v) { this.labelled = v; }
    toJSON() { return { id: this.id, name: this.name, borderThickness: this.borderThickness, color: { value: argb(this.color) }, fill: { value: argb(this.fill) }, visible: this.visible, labelled: this.labelled }; }
    static fromJSON(o) { return new ScreenMarker(o.id, o.name, o.borderThickness | 0, colorOf(o.color ? o.color.value : 0), colorOf(o.fill ? o.fill.value : 0), !!o.visible, !!o.labelled); }
  }

  class ScreenMarkerRenderable {
    render(graphics) {
      const thickness = this.borderThickness;
      const width = this.size.width; const height = this.size.height;
      // draw the fill
      graphics.setColor(this.fill);
      graphics.fillRect(thickness, thickness, width - thickness * 2, height - thickness * 2);
      // because the stroke is centered on the rectangle we draw, we need to translate where we draw the rectangle
      // this is to ensure that the rectangle we draw is our preferred size
      const offset = Math.trunc(thickness / 2);
      graphics.setColor(this.color);
      graphics.setStroke(this.stroke);
      if (thickness > 0) graphics.drawRect(offset, offset, width - thickness, height - thickness);
      if (this.label) graphics.drawString(this.label, 0, 0);
      return this.size;
    }
  }

  class ScreenMarkerOverlay extends Overlay {
    constructor(marker) {
      super(null);
      this.marker = marker;
      this.screenMarkerRenderable = new ScreenMarkerRenderable();
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ALWAYS_ON_TOP);
      this.setPriority(PRIORITY_HIGH);
      this.setMovable(true);
      this.setResizable(true);
      this.setMinimumSize(16);
      this.setResettable(false);
    }
    getMarker() { return this.marker; }
    getName() { return 'marker' + this.marker.getId(); }
    render(graphics) {
      if (!this.marker.isVisible()) return null;
      const preferredSize = this.getPreferredSize();
      // overlay has no preferred size in the renderer configuration!
      if (preferredSize == null) return null;
      const r = this.screenMarkerRenderable;
      r.borderThickness = this.marker.getBorderThickness();
      r.color = this.marker.getColor();
      r.fill = this.marker.getFill();
      r.stroke = new BasicStroke(this.marker.getBorderThickness());
      r.size = preferredSize;
      r.label = this.marker.isLabelled() ? this.marker.getName() : '';
      return r.render(graphics);
    }
  }

  class ScreenMarkerCreationOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_WIDGETS);
      this.setPriority(PRIORITY_HIGH);
      this.setMovable(true);
    }
    render(graphics) {
      const marker = this.plugin.getCurrentMarker();
      if (marker == null || !this.getPreferredSize()) return null;
      const thickness = marker.getBorderThickness();
      const offset = Math.trunc(thickness / 2);
      const size = this.getPreferredSize(); // (UI pixels: see the top)
      const width = size.width - thickness;
      const height = size.height - thickness;
      // createStripedStroke: dashes of 9
      graphics.setStroke(new BasicStroke(thickness, 0, 2, 0, [9], 0));
      graphics.setColor(marker.getColor());
      graphics.drawRect(offset, offset, width, height);
      return size;
    }
  }

  class ScreenMarkerWidgetHighlightOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_WIDGETS);
      this.setPriority(PRIORITY_HIGH);
      this.setMovable(true);
    }
    render(graphics) {
      if (!this.plugin.isCreatingScreenMarker() || this.plugin.isDrawingScreenMarker()) return null;
      const menuEntries = client.getMenuEntries();
      if (client.isMenuOpen() || menuEntries.length === 0) { this.plugin.setSelectedWidgetBounds(null); return null; }
      const menuEntry = menuEntries[menuEntries.length - 1];
      const childIdx = menuEntry.getParam0();
      const widgetId = menuEntry.getParam1();
      // (2007: only component menu entries name a component in param1)
      const widget = widgetId > 0xffff ? client.getWidget(widgetId) : null;
      if (widget == null) { this.plugin.setSelectedWidgetBounds(null); return null; }
      let bounds = null;
      if (childIdx > -1 && widget.getChild) {
        const child = widget.getChild(childIdx);
        if (child != null) bounds = child.getBounds();
      } else {
        bounds = widget.getBounds();
      }
      if (bounds == null || bounds.isEmpty()) { this.plugin.setSelectedWidgetBounds(null); return null; }
      graphics.setColor(Color.GREEN);
      graphics.draw(bounds);
      this.plugin.setSelectedWidgetBounds(bounds);
      return null;
    }
  }

  class ScreenMarkerMouseListener {
    constructor(plugin) { this.plugin = plugin; }
    mouseClicked(event) { if (SwingUtilities.isMiddleMouseButton(event)) return event; event.consume(); return event; }
    mousePressed(event) {
      if (SwingUtilities.isMiddleMouseButton(event)) return event;
      if (SwingUtilities.isLeftMouseButton(event)) {
        const bounds = this.plugin.getSelectedWidgetBounds();
        if (bounds != null) this.plugin.startCreation(new Point(bounds.x, bounds.y), new Dimension(bounds.width, bounds.height));
        else this.plugin.startCreation(event.getPoint());
      } else if (this.plugin.isCreatingScreenMarker()) {
        this.plugin.finishCreation(true);
      }
      event.consume();
      return event;
    }
    mouseReleased(event) {
      if (SwingUtilities.isMiddleMouseButton(event)) return event;
      // Set the creation panel as "ready" (because the marker area as been drawn)
      if (SwingUtilities.isLeftMouseButton(event) && this.plugin.isCreatingScreenMarker()) this.plugin.completeSelection();
      event.consume();
      return event;
    }
    mouseDragged(event) {
      if (!this.plugin.isCreatingScreenMarker()) return event;
      if (SwingUtilities.isLeftMouseButton(event)) this.plugin.resizeMarker(event.getPoint());
      return event;
    }
  }

  // game coordinates -> UI pixels for a preferred size
  const toUi = (w, h) => { const s = rl.uiScale ? rl.uiScale() : 1; return new Dimension(Math.max(1, Math.round(w / s)), Math.max(1, Math.round(h / s))); };

  class ScreenMarkerPlugin {
    constructor() {
      this.configGroup = CONFIG_GROUP;
      this.screenMarkers = [];
      this.currentMarker = null;
      this.creatingScreenMarker = false;
      this.drawingScreenMarker = false;
      this.selectedWidgetBounds = null;
      this.startLocation = null;
      this.confirmLocked = true;
      this.creation = false;
    }
    getScreenMarkers() { return this.screenMarkers; }
    getCurrentMarker() { return this.currentMarker; }
    isCreatingScreenMarker() { return this.creatingScreenMarker; } setCreatingScreenMarker(b) { this.creatingScreenMarker = b; }
    isDrawingScreenMarker() { return this.drawingScreenMarker; }
    getSelectedWidgetBounds() { return this.selectedWidgetBounds; } setSelectedWidgetBounds(b) { this.selectedWidgetBounds = b; }
    startUp() {
      this.overlay = this.overlay || new ScreenMarkerCreationOverlay(this);
      this.widgetHighlight = this.widgetHighlight || new ScreenMarkerWidgetHighlightOverlay(this);
      rl.overlayManager.add(this.overlay);
      rl.overlayManager.add(this.widgetHighlight);
      this.screenMarkers.push(...this.loadConfig(rl.configManager.getConfiguration(CONFIG_GROUP, CONFIG_KEY)));
      this.screenMarkers.forEach((m) => rl.overlayManager.add(m));
      this.mouseListener = new ScreenMarkerMouseListener(this);
      this.rebuild();
    }
    shutDown() {
      rl.overlayManager.remove(this.overlay);
      rl.overlayManager.remove(this.widgetHighlight);
      rl.overlayManager.removeIf((o) => o instanceof ScreenMarkerOverlay);
      this.screenMarkers.length = 0;
      this.setMouseListenerEnabled(false);
      this.creatingScreenMarker = false;
      this.drawingScreenMarker = false;
      this.currentMarker = null;
      this.mouseListener = null;
      this.selectedWidgetBounds = null;
      this.creation = false;
      rl.panels.update(CONFIG_GROUP, null);
    }
    setMouseListenerEnabled(enabled) {
      if (!this.mouseListener) return;
      if (enabled) rl.mouseManager.registerMouseListener(this.mouseListener);
      else rl.mouseManager.unregisterMouseListener(this.mouseListener);
    }
    startCreation(location, size) {
      const fromDrag = size === undefined;
      this.currentMarker = new ScreenMarker(Date.now(), DEFAULT_MARKER_NAME + ' ' + (this.screenMarkers.length + 1),
        SELECTED_BORDER_THICKNESS, SELECTED_COLOR, SELECTED_FILL_COLOR, true, false);
      // Set overlay creator bounds to current position and default size
      this.startLocation = location;
      this.overlay.setPreferredLocation(location);
      this.overlay.setPreferredSize(fromDrag ? DEFAULT_SIZE : toUi(size.width, size.height));
      // Stop the highlighting so we don't get rectangles around widgets while trying to make normal screen markers
      if (fromDrag && this.selectedWidgetBounds == null) this.drawingScreenMarker = true;
    }
    finishCreation(aborted) {
      const marker = this.currentMarker;
      if (!aborted && marker != null) {
        const screenMarkerOverlay = new ScreenMarkerOverlay(marker);
        const b = this.overlay.getBounds();
        screenMarkerOverlay.setPreferredLocation(new Point(b.x, b.y));
        screenMarkerOverlay.setPreferredSize(this.overlay.getPreferredSize());
        this.screenMarkers.push(screenMarkerOverlay);
        rl.overlayManager.saveOverlay(screenMarkerOverlay);
        rl.overlayManager.add(screenMarkerOverlay);
        this.updateConfig();
      }
      this.creatingScreenMarker = false;
      this.drawingScreenMarker = false;
      this.selectedWidgetBounds = null;
      this.startLocation = null;
      this.currentMarker = null;
      this.overlay.setPreferredLocation(null);
      this.setMouseListenerEnabled(false);
      this.setCreation(false);
    }
    completeSelection() { this.confirmLocked = false; this.rebuild(); }
    deleteMarker(marker) {
      const i = this.screenMarkers.indexOf(marker);
      if (i >= 0) this.screenMarkers.splice(i, 1);
      rl.overlayManager.remove(marker);
      rl.overlayManager.resetOverlay(marker);
      this.updateConfig();
    }
    resizeMarker(point) {
      this.drawingScreenMarker = true;
      const s = this.startLocation;
      const x1 = Math.min(s.x, point.x); const y1 = Math.min(s.y, point.y);
      this.overlay.setPreferredLocation(new Point(x1, y1));
      this.overlay.setPreferredSize(toUi(Math.max(s.x, point.x) - x1, Math.max(s.y, point.y) - y1));
    }
    updateConfig() {
      if (this.screenMarkers.length === 0) rl.configManager.unsetConfiguration ? rl.configManager.unsetConfiguration(CONFIG_GROUP, CONFIG_KEY) : rl.configManager.setConfiguration(CONFIG_GROUP, CONFIG_KEY, '');
      else rl.configManager.setConfiguration(CONFIG_GROUP, CONFIG_KEY, JSON.stringify(this.screenMarkers.map((o) => o.getMarker())));
      this.rebuild();
    }
    loadConfig(json) {
      if (!json) return [];
      let data;
      try { data = JSON.parse(json); } catch { return []; }
      return (Array.isArray(data) ? data : []).filter((o) => o != null).map((o) => new ScreenMarkerOverlay(ScreenMarker.fromJSON(o)));
    }
    // ScreenMarkerPluginPanel.setCreation
    setCreation(on) {
      this.creation = on;
      if (on) {
        this.confirmLocked = true;
        this.setMouseListenerEnabled(true);
        this.setCreatingScreenMarker(true);
      }
      this.rebuild();
    }
    // the panel's state (ScreenMarkerPluginPanel.rebuild)
    rebuild() {
      const hex = (c) => '#' + (c.getRGB() >>> 0).toString(16).toUpperCase().padStart(8, '0');
      rl.panels.update(CONFIG_GROUP, {
        creation: this.creation,
        confirmLocked: this.confirmLocked,
        markers: this.screenMarkers.map((o) => {
          const m = o.getMarker();
          return { id: String(m.getId()), name: m.getName(), borderThickness: m.getBorderThickness(), color: hex(m.getColor()), fill: hex(m.getFill()), visible: m.isVisible(), labelled: m.isLabelled() };
        }),
      });
    }
    onPanelAction(a) {
      const o = this.screenMarkers.find((x) => String(x.getMarker().getId()) === String(a.id));
      const m = o && o.getMarker();
      switch (a.action) {
        case 'add': this.setCreation(true); break;
        case 'confirm': if (!this.confirmLocked) this.finishCreation(false); break;
        case 'cancel': this.finishCreation(true); break;
        case 'rename': if (m) { m.setName(String(a.name || '')); this.updateConfig(); } break;
        case 'color': if (m) { m.setColor(Color.parse(a.value) || m.getColor()); this.updateConfig(); } break;
        case 'fill': if (m) { m.setFill(Color.parse(a.value) || m.getFill()); this.updateConfig(); } break;
        case 'thickness': if (m) { m.setBorderThickness(Math.max(0, a.value | 0)); this.updateConfig(); } break;
        case 'visible': if (m) { m.setVisible(!!a.value); this.updateConfig(); } break;
        case 'preview': if (m && !a.persisted) m.setVisible(!!a.value); break; // ScreenMarkerPanel.preview (only while hidden)
        case 'labelled': if (m) { m.setLabelled(!!a.value); this.updateConfig(); } break;
        case 'delete': if (o) this.deleteMarker(o); break;
        default: break;
      }
    }
  }

  const plugin = new ScreenMarkerPlugin();
  ll.__screenmarkers = { plugin, ScreenMarker, ScreenMarkerOverlay };
  rl.registerPlugin('screenmarkers', plugin);
})();
