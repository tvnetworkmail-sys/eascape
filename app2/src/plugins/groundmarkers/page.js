// RuneLite's Ground Markers plugin, cloned from net.runelite.client.plugins.groundmarkers (BSD 2-Clause,
// Copyright (c) 2018, TheLonelyDev, Jasper Ketelaar and RuneLite contributors): GroundMarkerPlugin,
// GroundMarkerOverlay, GroundMarkerMinimapOverlay, GroundMarkerPoint, ColorTileMarker.
// For 2007: no world map orb for GroundMarkerSharingManager's Import / Export / Clear; the "Color" submenu is flat
// (no submenus in the 2007 menu) and has no colour picker ("Pick").
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Color, ColorUtil, MenuAction, KeyCode, WorldPoint, LocalPoint, Perspective, Polygon, BasicStroke, Overlay, OverlayPosition, OverlayLayer,
    OverlayPriority, OverlayUtil, configManager, overlayManager, chatboxPanelManager } = rl;

  const CONFIG_GROUP = 'groundMarker';
  const REGION_PREFIX = 'region_';
  const MAX_DRAW_DISTANCE = 32;
  const colorJson = (c) => (c == null ? null : '#' + (c.getRGB() >>> 0).toString(16).padStart(8, '0'));
  // GroundMarkerPoint: equal by region and tile (not colour or label)
  const point = (regionId, regionX, regionY, z, color, label) => ({ regionId, regionX, regionY, z, color, label });
  const samePoint = (a, b) => a.regionId === b.regionId && a.regionX === b.regionX && a.regionY === b.regionY && a.z === b.z;

  class GroundMarkerOverlay extends Overlay {
    constructor(plugin) { super(); this.plugin = plugin; this.config = plugin.config; this.setPosition(OverlayPosition.DYNAMIC); this.setPriority(OverlayPriority.LOW); this.setLayer(OverlayLayer.ABOVE_SCENE); }
    getName() { return 'GroundMarkerOverlay'; }
    render(graphics) {
      const points = this.plugin.points;
      if (points.size === 0) return null;
      const stroke = new BasicStroke(this.config.borderWidth());
      for (const [wv, list] of points) {
        for (const p of list) {
          const worldPoint = p.worldPoint;
          if (worldPoint.getPlane() !== wv.getPlane()) continue;
          this.drawTile(graphics, wv, worldPoint, p.color || this.config.markerColor(), p.label, stroke);
        }
      }
      return null;
    }
    drawTile(graphics, wv, pt, color, label, borderStroke) {
      const me = client.getLocalPlayer();
      if (me && pt.distanceTo(me.getWorldLocation()) >= MAX_DRAW_DISTANCE) return;
      const lp = LocalPoint.fromWorld(wv, pt);
      if (lp == null) return;
      const poly = Perspective.getCanvasTilePoly(client, lp);
      if (poly != null) OverlayUtil.renderPolygon(graphics, poly, color, new Color(0, 0, 0, this.config.fillOpacity()), borderStroke);
      if (label != null && label.length) {
        const canvasTextLocation = Perspective.getCanvasTextLocation(client, graphics, lp, label, 0);
        if (canvasTextLocation != null) OverlayUtil.renderTextLocation(graphics, canvasTextLocation, label, color);
      }
    }
  }

  class GroundMarkerMinimapOverlay extends Overlay {
    constructor(plugin) { super(); this.plugin = plugin; this.config = plugin.config; this.setPosition(OverlayPosition.DYNAMIC); this.setPriority(OverlayPriority.LOW); this.setLayer(OverlayLayer.ABOVE_WIDGETS); }
    getName() { return 'GroundMarkerMinimapOverlay'; }
    render(graphics) {
      const points = this.plugin.points;
      if (points.size === 0 || !this.config.drawTileOnMinimmap()) return null;
      for (const [wv, list] of points) {
        for (const p of list) {
          if (p.worldPoint.getPlane() !== wv.getPlane()) continue;
          this.drawOnMinimap(graphics, wv, p.worldPoint, p.color || this.config.markerColor());
        }
      }
      return null;
    }
    drawOnMinimap(graphics, wv, pt, color) {
      const lp = LocalPoint.fromWorld(wv, pt);
      if (lp == null) return;
      const x = lp.getX() & -128;
      const y = lp.getY() & -128;
      const mp1 = Perspective.localToMinimap(client, new LocalPoint(x, y));
      const mp2 = Perspective.localToMinimap(client, new LocalPoint(x, y + 128));
      const mp3 = Perspective.localToMinimap(client, new LocalPoint(x + 128, y + 128));
      const mp4 = Perspective.localToMinimap(client, new LocalPoint(x + 128, y));
      if (mp1 == null || mp2 == null || mp3 == null || mp4 == null) return;
      const poly = new Polygon();
      poly.addPoint(mp1.getX(), mp1.getY());
      poly.addPoint(mp2.getX(), mp2.getY());
      poly.addPoint(mp3.getX(), mp3.getY());
      poly.addPoint(mp4.getX(), mp4.getY());
      graphics.setStroke(new BasicStroke(1));
      graphics.setColor(color);
      graphics.drawPolygon(poly);
    }
  }

  class GroundMarkerPlugin {
    constructor() {
      this.configGroup = CONFIG_GROUP;
      this.config = rl.configProxy(CONFIG_GROUP, () => this.configItems);
      this.points = new Map(); // WorldView -> [ColorTileMarker]
      this.overlay = new GroundMarkerOverlay(this);
      this.minimapOverlay = new GroundMarkerMinimapOverlay(this);
    }

    savePoints(regionId, points) {
      if (points == null || points.length === 0) { configManager.unsetConfiguration(CONFIG_GROUP, REGION_PREFIX + regionId); return; }
      configManager.setConfiguration(CONFIG_GROUP, REGION_PREFIX + regionId, JSON.stringify(points.map((p) => ({ regionId: p.regionId, regionX: p.regionX, regionY: p.regionY, z: p.z, color: colorJson(p.color), label: p.label == null ? undefined : p.label }))));
    }

    getPoints(regionId) {
      const json = configManager.getConfiguration(CONFIG_GROUP, REGION_PREFIX + regionId);
      if (json == null || json === '') return [];
      try {
        return JSON.parse(json).map((o) => point(o.regionId, o.regionX, o.regionY, o.z, Color.parse(o.color), o.label == null ? null : o.label));
      } catch { return []; }
    }

    loadAllPoints() {
      this.points.clear();
      const wv = client.getTopLevelWorldView();
      if (wv == null) return;
      this.loadPoints(wv);
    }

    loadPoints(wv) {
      this.points.delete(wv);
      const regions = wv.getMapRegions();
      if (regions == null) return;
      const list = [];
      for (const regionId of regions) list.push(...this.translateToColorTileMarker(wv, this.getPoints(regionId)));
      this.points.set(wv, list);
    }

    translateToColorTileMarker(wv, points) {
      const out = [];
      for (const p of points) {
        const colorTile = { worldPoint: WorldPoint.fromRegion(p.regionId, p.regionX, p.regionY, p.z), color: p.color, label: p.label };
        for (const wp of WorldPoint.toLocalInstance(wv, colorTile.worldPoint)) out.push({ worldPoint: wp, color: colorTile.color, label: colorTile.label });
      }
      return out;
    }

    startUp() {
      overlayManager.add(this.overlay);
      overlayManager.add(this.minimapOverlay);
      // (sharingManager.addImportExportMenuOptions / addClearMenuOption: no world map orb in 2007)
      this.loadAllPoints();
    }

    shutDown() {
      overlayManager.remove(this.overlay);
      overlayManager.remove(this.minimapOverlay);
      this.points.clear();
    }

    onWorldViewLoaded(event) { this.loadPoints(event.getWorldView()); }
    onWorldViewUnloaded(event) { this.points.delete(event.getWorldView()); }

    onMenuEntryAdded(event) {
      const menuAction = event.getMenuEntry().getType();
      const hotKeyPressed = client.isKeyPressed(KeyCode.KC_SHIFT);
      if (!hotKeyPressed || menuAction !== MenuAction.WALK) return;
      const worldId = event.getMenuEntry().getWorldViewId();
      const wv = client.getWorldView(worldId);
      if (wv == null) return;
      const selectedSceneTile = wv.getSelectedSceneTile();
      if (selectedSceneTile == null) return;
      const worldPoint = WorldPoint.fromLocalInstance(client, selectedSceneTile.getLocalLocation());
      const regionId = worldPoint.getRegionID();
      const regionPoints = this.getPoints(regionId);
      const existing = regionPoints.find((p) => p.regionX === worldPoint.getRegionX() && p.regionY === worldPoint.getRegionY() && p.z === worldPoint.getPlane());
      // (createMenuEntry(-1), (-2), (-3): Mark on top, then Label, then Color; ours go in above Walk here, bottom first)
      const entries = [{ option: existing ? 'Unmark' : 'Mark', click: () => this.markTile(worldPoint) }];
      if (existing) {
        entries.push({ option: 'Label', click: () => this.labelTile(existing) });
        // the "Color" submenu, flat: Reset all, then the colours in use
        if (regionPoints.length > 1) {
          entries.push({ option: 'Color reset all', click: () => chatboxPanelManager.openTextMenuInput('Are you sure you want to reset the color of ' + regionPoints.length + ' tiles?')
            .option('Yes', () => {
              this.savePoints(regionId, regionPoints.map((p) => point(p.regionId, p.regionX, p.regionY, p.z, this.config.markerColor(), p.label)));
              this.loadAllPoints();
            })
            .option('No', () => {})
            .build() });
        }
        const existingColors = [];
        for (const list of this.points.values()) for (const m of list) if (m.color != null && !existingColors.some((c) => c.equals(m.color))) existingColors.push(m.color);
        for (const color of existingColors) {
          if (existing.color == null || !color.equals(existing.color)) entries.push({ option: ColorUtil.prependColorTag('Color', color), click: () => this.colorTile(existing, color) });
        }
      }
      for (const e of entries.reverse()) client.createMenuEntry(-1).setOption(e.option).setTarget('Tile').setType(MenuAction.RUNELITE).onClick(e.click);
    }

    markTile(worldPoint) {
      const regionId = worldPoint.getRegionID();
      const p = point(regionId, worldPoint.getRegionX(), worldPoint.getRegionY(), worldPoint.getPlane(), this.config.markerColor(), null);
      const groundMarkerPoints = [...this.getPoints(regionId)];
      const i = groundMarkerPoints.findIndex((x) => samePoint(x, p));
      if (i >= 0) groundMarkerPoints.splice(i, 1);
      else groundMarkerPoints.push(p);
      this.savePoints(regionId, groundMarkerPoints);
      this.loadAllPoints();
    }

    labelTile(existing) {
      chatboxPanelManager.openTextInput('Tile label')
        .value(existing.label == null ? '' : existing.label)
        .onDone((input) => {
          input = input === '' ? null : input;
          const newPoint = point(existing.regionId, existing.regionX, existing.regionY, existing.z, existing.color, input);
          const points = this.getPoints(existing.regionId).filter((x) => !samePoint(x, existing));
          points.push(newPoint);
          this.savePoints(existing.regionId, points);
          this.loadAllPoints();
        })
        .build();
    }

    colorTile(existing, newColor) {
      const newPoint = point(existing.regionId, existing.regionX, existing.regionY, existing.z, newColor, existing.label);
      const points = this.getPoints(existing.regionId).filter((x) => !samePoint(x, newPoint));
      points.push(newPoint);
      this.savePoints(existing.regionId, points);
      this.loadAllPoints();
    }
  }

  rl.registerPlugin('groundmarkers', new GroundMarkerPlugin());
})();
