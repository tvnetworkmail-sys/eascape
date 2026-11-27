// RuneLite's Object Markers plugin, cloned from net.runelite.client.plugins.objectindicators (BSD 2-Clause,
// Copyright (c) 2018, Tomas Slusny and RuneLite contributors): ObjectIndicatorsPlugin, ObjectIndicatorsOverlay,
// ObjectPoint, ColorTileObject. On the core's TileObject spawn events (the client's loc hook).
// For 2007: the "Mark border color", "Mark fill color" and "Mark style" submenus are flat (no submenus in the
// 2007 menu) and have no colour picker; the outline is rl.modelOutlineRenderer (corea.js); the
// 2007 client's varbit multilocs aren't resolved (getImpostorIds is null).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Color, ColorUtil, MenuAction, KeyCode, WorldPoint, BasicStroke, Overlay, OverlayPosition, OverlayLayer, OverlayPriority, OverlayUtil,
    GameObject, WallObject, DecorativeObject, GroundObject, configManager, overlayManager } = rl;

  const CONFIG_GROUP = 'objectindicators';
  const MARK = 'Mark object';
  const UNMARK = 'Unmark object';
  const HF_HULL = 0x1;
  const HF_OUTLINE = 0x2;
  const HF_CLICKBOX = 0x4;
  const HF_TILE = 0x8;
  const DEFAULTS = [Color.RED, Color.GREEN, Color.BLUE, Color.YELLOW, Color.MAGENTA];
  const colorJson = (c) => (c == null ? null : '#' + (c.getRGB() >>> 0).toString(16).padStart(8, '0'));
  const strEmpty = (s) => s == null || s.length === 0;

  // ObjectPoint (saved as JSON; "color" is the border colour)
  const toJson = (p) => ({ id: p.id, name: p.name, regionId: p.regionId, regionX: p.regionX, regionY: p.regionY, z: p.z, color: colorJson(p.borderColor),
    fillColor: colorJson(p.fillColor), hull: p.hull, outline: p.outline, clickbox: p.clickbox, tile: p.tile });
  const fromJson = (o) => ({ id: o.id === undefined ? -1 : o.id, name: o.name, regionId: o.regionId, regionX: o.regionX, regionY: o.regionY, z: o.z,
    borderColor: Color.parse(o.color), fillColor: Color.parse(o.fillColor), hull: o.hull == null ? null : o.hull, outline: o.outline == null ? null : o.outline,
    clickbox: o.clickbox == null ? null : o.clickbox, tile: o.tile == null ? null : o.tile });

  class ColorTileObject {
    constructor(tileObject, composition, name, borderColor, fillColor, highlightFlags) {
      this.tileObject = tileObject; this.composition = composition; this.name = name; this.borderColor = borderColor; this.fillColor = fillColor; this.highlightFlags = highlightFlags;
    }
    getTileObject() { return this.tileObject; }
  }

  class ObjectIndicatorsOverlay extends Overlay {
    constructor(plugin) {
      super();
      this.plugin = plugin; this.config = plugin.config;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setPriority(OverlayPriority.LOW);
      this.setLayer(OverlayLayer.ABOVE_SCENE);
    }
    getName() { return 'ObjectIndicatorsOverlay'; }
    render(graphics) {
      const objects = this.plugin.objects;
      if (objects.length === 0) return null;
      const config = this.config;
      const borderWidth = config.borderWidth();
      const stroke = new BasicStroke(borderWidth);
      const tileStroke = new BasicStroke(Math.min(borderWidth, 2));
      const defaultFlags = (config.highlightHull() ? HF_HULL : 0) | (config.highlightOutline() ? HF_OUTLINE : 0)
        | (config.highlightClickbox() ? HF_CLICKBOX : 0) | (config.highlightTile() ? HF_TILE : 0);
      for (const obj of objects) {
        const object = obj.tileObject;
        const wv = object.getWorldView();
        if (wv == null || object.getPlane() !== wv.getPlane()) continue;
        let composition = obj.composition;
        if (composition.getImpostorIds() != null) composition = composition.getImpostor();
        if (composition == null || strEmpty(composition.getName()) || composition.getName() === 'null' || composition.getName() !== obj.name) continue;
        let borderColor = obj.borderColor;
        if (borderColor == null) borderColor = config.markerColor();
        const flags = obj.highlightFlags !== 0 ? obj.highlightFlags : defaultFlags;
        if ((flags & HF_HULL) !== 0) {
          const fillColor = obj.fillColor || new Color(0, 0, 0, 50);
          this.renderConvexHull(graphics, object, borderColor, fillColor, stroke);
        }
        if ((flags & HF_OUTLINE) !== 0) {
          rl.modelOutlineRenderer.drawOutline(object, Math.trunc(config.borderWidth()), borderColor, config.outlineFeather());
        }
        if ((flags & HF_CLICKBOX) !== 0) {
          const clickbox = object.getClickbox();
          if (clickbox != null) {
            const fillColor = obj.fillColor || ColorUtil.colorWithAlpha(borderColor, Math.trunc(borderColor.getAlpha() / 12));
            OverlayUtil.renderPolygon(graphics, clickbox, borderColor, fillColor, stroke);
          }
        }
        if ((flags & HF_TILE) !== 0) {
          const tilePoly = object.getCanvasTilePoly();
          if (tilePoly != null) {
            const fillColor = obj.fillColor || ColorUtil.colorWithAlpha(borderColor, Math.trunc(borderColor.getAlpha() / 12));
            OverlayUtil.renderPolygon(graphics, tilePoly, borderColor, fillColor, tileStroke);
          }
        }
      }
      return null;
    }
    renderConvexHull(graphics, object, color, fillColor, stroke) {
      let polygon; let polygon2 = null;
      if (object instanceof GameObject) polygon = object.getConvexHull();
      else if (object instanceof WallObject) { polygon = object.getConvexHull(); polygon2 = object.getConvexHull2(); }
      else if (object instanceof DecorativeObject) { polygon = object.getConvexHull(); polygon2 = object.getConvexHull2(); }
      else if (object instanceof GroundObject) polygon = object.getConvexHull();
      else polygon = object.getCanvasTilePoly();
      if (polygon != null) OverlayUtil.renderPolygon(graphics, polygon, color, fillColor, stroke);
      if (polygon2 != null) OverlayUtil.renderPolygon(graphics, polygon2, color, fillColor, stroke);
    }
  }

  class ObjectIndicatorsPlugin {
    constructor() {
      this.configGroup = CONFIG_GROUP;
      this.config = rl.configProxy(CONFIG_GROUP, () => this.configItems);
      this.objects = [];
      this.points = new Map(); // region id -> [ObjectPoint]
      this.overlay = new ObjectIndicatorsOverlay(this);
    }

    startUp() {
      overlayManager.add(this.overlay);
      this.loadAllPoints();
    }

    shutDown() {
      overlayManager.remove(this.overlay);
      this.points.clear();
      this.objects = [];
    }

    removeObject(o) { this.objects = this.objects.filter((c) => c.tileObject !== o); }
    onWallObjectSpawned(event) { this.checkObjectPoints(event.getWallObject()); }
    onWallObjectDespawned(event) { this.removeObject(event.getWallObject()); }
    onGameObjectSpawned(event) { this.checkObjectPoints(event.getGameObject()); }
    onDecorativeObjectSpawned(event) { this.checkObjectPoints(event.getDecorativeObject()); }
    onGameObjectDespawned(event) { this.removeObject(event.getGameObject()); }
    onDecorativeObjectDespawned(event) { this.removeObject(event.getDecorativeObject()); }
    onGroundObjectSpawned(event) { this.checkObjectPoints(event.getGroundObject()); }
    onGroundObjectDespawned(event) { this.removeObject(event.getGroundObject()); }

    loadAllPoints() {
      this.points.clear();
      const wv = client.getTopLevelWorldView();
      if (wv == null) return;
      this.loadWorldViewPoints(wv);
    }

    loadWorldViewPoints(wv) {
      const regions = wv.getMapRegions();
      if (regions == null) return;
      for (const regionId of regions) {
        const regionPoints = this.loadPoints(regionId);
        if (regionPoints != null) this.points.set(regionId, regionPoints);
      }
    }

    onWorldViewLoaded(event) { this.loadWorldViewPoints(event.getWorldView()); }

    onWorldViewUnloaded(event) {
      const wv = event.getWorldView();
      this.objects = this.objects.filter((c) => c.tileObject.getWorldView() !== wv);
      if (wv.isTopLevel()) for (const r of wv.getMapRegions()) this.points.delete(r);
    }

    onMenuEntryAdded(event) {
      if (event.getType() !== MenuAction.EXAMINE_OBJECT || !client.isKeyPressed(KeyCode.KC_SHIFT)) return;
      const worldId = event.getMenuEntry().getWorldViewId();
      const wv = client.getWorldView(worldId);
      if (wv == null) return;
      const tileObject = this.findTileObject(wv, event.getActionParam0(), event.getActionParam1(), event.getIdentifier());
      if (tileObject == null) return;
      const marked = this.objects.find((o) => o.tileObject === tileObject);
      // (createMenuEntry(idx--): each under the last; ours go in above the entry, so they're made bottom first)
      const entries = [{ option: marked ? UNMARK : MARK, click: () => this.markObject(worldId, event.getActionParam0(), event.getActionParam1(), event.getIdentifier()) }];
      if (marked) {
        this.createTagBorderColorMenu(entries, tileObject);
        this.createTagFillColorMenu(entries, tileObject);
        this.createTagStyleMenu(entries, tileObject);
      }
      for (const e of entries.reverse()) {
        client.createMenuEntry(-1).setOption(e.option).setTarget(event.getTarget()).setWorldViewId(worldId)
          .setParam0(event.getActionParam0()).setParam1(event.getActionParam1()).setIdentifier(event.getIdentifier()).setType(MenuAction.RUNELITE).onClick(e.click);
      }
    }

    // "Mark border color" submenu, flat
    createTagBorderColorMenu(entries, object) {
      const colors = this.getUsedColors((p) => p.borderColor);
      for (const d of DEFAULTS) if (colors.length < 5 && !colors.some((c) => c.equals(d))) colors.push(d);
      for (const c of colors) entries.push({ option: ColorUtil.prependColorTag('Mark border color', c), click: () => this.updateObjectConfig(object, (p) => { p.borderColor = c; }) });
    }

    // "Mark fill color" submenu, flat
    createTagFillColorMenu(entries, object) {
      const colors = this.getUsedColors((p) => p.fillColor);
      for (let d of DEFAULTS) {
        d = ColorUtil.colorWithAlpha(d, Math.trunc(d.getAlpha() / 12));
        if (colors.length < 5 && !colors.some((c) => c.equals(d))) colors.push(d);
      }
      for (const c of colors) entries.push({ option: ColorUtil.prependColorTag('Mark fill color', ColorUtil.colorWithAlpha(c, 255)), click: () => this.updateObjectConfig(object, (p) => { p.fillColor = c; }) });
      entries.push({ option: 'Mark fill color reset', click: () => this.updateObjectConfig(object, (p) => { p.fillColor = null; }) });
    }

    // "Mark style" submenu, flat
    createTagStyleMenu(entries, object) {
      const toggle = (k) => (p) => { p[k] = p[k] !== true; };
      entries.push({ option: 'Mark style Hull', click: () => this.updateObjectConfig(object, toggle('hull')) });
      entries.push({ option: 'Mark style Outline', click: () => this.updateObjectConfig(object, toggle('outline')) });
      entries.push({ option: 'Mark style Clickbox', click: () => this.updateObjectConfig(object, toggle('clickbox')) });
      entries.push({ option: 'Mark style Tile', click: () => this.updateObjectConfig(object, toggle('tile')) });
      entries.push({ option: 'Mark style reset', click: () => this.updateObjectConfig(object, (c) => { c.hull = null; c.outline = null; c.clickbox = null; c.tile = null; }) });
    }

    markObject(worldViewId, param0, param1, identifier) {
      const wv = client.getWorldView(worldViewId);
      if (wv == null) return;
      const object = this.findTileObject(wv, param0, param1, identifier);
      if (object == null) return;
      const objectDefinition = this.getObjectComposition(object.getId());
      const name = objectDefinition.getName();
      if (strEmpty(name) || name === 'null') return;
      const worldPoint = WorldPoint.fromLocalInstance(client, object.getLocalLocation());
      const regionId = worldPoint.getRegionID();
      const point = { id: object.getId(), name, regionId, regionX: worldPoint.getRegionX(), regionY: worldPoint.getRegionY(), z: worldPoint.getPlane(),
        borderColor: this.config.markerColor(), fillColor: this.config.fillColor(), hull: null, outline: null, clickbox: null, tile: null };
      if (!this.points.has(regionId)) this.points.set(regionId, []);
      const objectPoints = this.points.get(regionId);
      const pred = this.findObjectPredicate(objectDefinition, object, worldPoint);
      if (objectPoints.some(pred)) {
        this.points.set(regionId, objectPoints.filter((p) => !pred(p)));
        this.unmarkObjects(client.getTopLevelWorldView(), worldPoint, objectDefinition);
      } else {
        objectPoints.push(point);
        this.markObjects(client.getTopLevelWorldView(), worldPoint, objectDefinition);
      }
      this.savePoints(regionId, this.points.get(regionId));
    }

    updateObjectConfig(object, c) {
      const worldPoint = WorldPoint.fromLocalInstance(client, object.getLocalLocation());
      const regionId = worldPoint.getRegionID();
      const objectPoints = this.points.get(regionId);
      if (!objectPoints || objectPoints.length === 0) return;
      const objectComposition = this.getObjectComposition(object.getId());
      const objectPoint = objectPoints.find(this.findObjectPredicate(objectComposition, object, worldPoint));
      if (objectPoint == null) return;
      c(objectPoint);
      this.savePoints(regionId, objectPoints);
      for (const o of [...this.objects]) {
        if (o.tileObject.getId() === object.getId()) {
          this.objects.splice(this.objects.indexOf(o), 1);
          this.checkObjectPoints(o.tileObject);
        }
      }
    }

    checkObjectPoints(object) {
      if (object.getPlane() < 0) return;
      const worldPoint = WorldPoint.fromLocalInstance(client, object.getLocalLocation(), object.getPlane());
      const objectPoints = this.points.get(worldPoint.getRegionID());
      if (objectPoints == null) return;
      const objectComposition = client.getObjectDefinition(object.getId());
      if (objectComposition.getImpostorIds() == null) {
        const name = objectComposition.getName();
        if (strEmpty(name) || name === 'null') return;
      }
      for (const objectPoint of objectPoints) {
        if (worldPoint.getRegionX() === objectPoint.regionX && worldPoint.getRegionY() === objectPoint.regionY
          && worldPoint.getPlane() === objectPoint.z && objectPoint.id === object.getId()) {
          const flags = (objectPoint.hull === true ? HF_HULL : 0) | (objectPoint.outline === true ? HF_OUTLINE : 0)
            | (objectPoint.clickbox === true ? HF_CLICKBOX : 0) | (objectPoint.tile === true ? HF_TILE : 0);
          this.objects.push(new ColorTileObject(object, objectComposition, objectPoint.name, objectPoint.borderColor, objectPoint.fillColor, flags));
          break;
        }
      }
    }

    findTileObject(wv, x, y, id) {
      const level = wv.getPlane();
      const tile = wv.getScene().getTiles()[level][x][y];
      if (tile == null) return null;
      const tileWallObject = tile.getWallObject();
      const tileDecorativeObject = tile.getDecorativeObject();
      const groundObject = tile.getGroundObject();
      if (this.objectIdEquals(tileWallObject, id)) return tileWallObject;
      if (this.objectIdEquals(tileDecorativeObject, id)) return tileDecorativeObject;
      if (this.objectIdEquals(groundObject, id)) return groundObject;
      for (const object of tile.getGameObjects()) if (this.objectIdEquals(object, id)) return object;
      return null;
    }

    objectIdEquals(tileObject, id) {
      if (tileObject == null) return false;
      if (tileObject.getId() === id) return true;
      const comp = client.getObjectDefinition(tileObject.getId());
      if (comp.getImpostorIds() != null) for (const impostorId of comp.getImpostorIds()) if (impostorId === id) return true;
      return false;
    }

    markObjects(wv, p, objectConfig) {
      for (const sp of WorldPoint.toLocalInstance(wv, p)) {
        const x = sp.getX() - wv.getBaseX(); const y = sp.getY() - wv.getBaseY();
        const object = this.findTileObject(wv, x, y, objectConfig.getId());
        if (object != null) this.objects.push(new ColorTileObject(object, client.getObjectDefinition(object.getId()), objectConfig.getName(), this.config.markerColor(), this.config.fillColor(), 0));
      }
      for (const sub of wv.worldViews()) this.markObjects(sub, p, objectConfig);
    }

    unmarkObjects(wv, p, objectConfig) {
      for (const sp of WorldPoint.toLocalInstance(wv, p)) {
        const x = sp.getX() - wv.getBaseX(); const y = sp.getY() - wv.getBaseY();
        const object = this.findTileObject(wv, x, y, objectConfig.getId());
        if (object != null) this.removeObject(object);
      }
      for (const sub of wv.worldViews()) this.unmarkObjects(sub, p, objectConfig);
    }

    findObjectPredicate(objectComposition, object, worldPoint) {
      return (op) => ((op.id === -1 || op.id === object.getId()) || op.name === objectComposition.getName())
        && op.regionX === worldPoint.getRegionX() && op.regionY === worldPoint.getRegionY() && op.z === worldPoint.getPlane();
    }

    savePoints(id, points) {
      if (points.length === 0) configManager.unsetConfiguration(CONFIG_GROUP, 'region_' + id);
      else configManager.setConfiguration(CONFIG_GROUP, 'region_' + id, JSON.stringify(points.map(toJson)));
    }

    loadPoints(id) {
      const json = configManager.getConfiguration(CONFIG_GROUP, 'region_' + id);
      if (strEmpty(json)) return null;
      let list;
      try { list = JSON.parse(json); } catch { return null; }
      if (!Array.isArray(list)) return null;
      return list.map(fromJson).filter((point) => point.name !== 'null');
    }

    getObjectComposition(id) {
      const objectComposition = client.getObjectDefinition(id);
      return objectComposition.getImpostorIds() == null ? objectComposition : objectComposition.getImpostor();
    }

    getUsedColors(getColor) {
      const colors = [];
      for (const region of client.getMapRegions()) {
        const points = this.points.get(region);
        if (points != null) {
          for (const p of points) {
            const c = getColor(p);
            if (c != null && !colors.some((x) => x.equals(c))) {
              colors.push(c);
              if (colors.length >= 5) return colors;
            }
          }
        }
      }
      return colors;
    }
  }

  const plugin = new ObjectIndicatorsPlugin();
  ll.__objectindicators = { plugin };
  rl.registerPlugin('objectindicators', plugin);
})();
