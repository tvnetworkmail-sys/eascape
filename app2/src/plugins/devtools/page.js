// RuneLite's Developer Tools plugin, cloned from net.runelite.client.plugins.devtools (BSD 2-Clause, Copyright (c)
// 2017, Kronos <https://github.com/KronosDesign>, (c) 2018, Adam and RuneLite contributors): DevToolsPlugin,
// DevToolsConfig, DevToolsPanel / DevToolsButton (the sidebar panel draws the buttons from this plugin's state),
// DevToolsOverlay, LocationOverlay, CameraOverlay, SceneOverlay, VarInspector (shown in the panel while active).
// Left out (2007 / app): Detached Camera (oculus orb), World Map Location / map regions (the world map is the app's),
// Sound Effects, Script Inspector (no script events), Widget Inspector, Inventory Inspector, Disconnect, Shell, Swing
// Defaults and the Swing inspector hotkey, World Entities (Sailing); Line Of Sight and Valid Movement (WorldArea's
// collision walks are not in the core yet); the Menus button's submenus (2007 menus have none); var names (OSRS's
// gameval names) and the VarClient logs. Commands: the read-only and config ones (logger, getvarp, getvarb, msg,
// getconf, setconf); the ones that write client state (setvarp, setvarb, addxp, setstat, anim, gfx, transform, wear,
// tex, alpha, zsort, sound, modicons) are left out. Typed commands it handles are not sent to the server.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Color, Overlay, OverlayPanel, OverlayPosition, OverlayLayer, OverlayPriority, OverlayUtil, LineComponent, Perspective, LocalPoint, WorldPoint, MenuAction, Counter, OverlayMenuEntry, ColorUtil, BasicStroke } = rl;
  const GROUP = 'devtools';

  // ---- DevToolsButton (the panel's toggle buttons: green while active)
  class DevToolsButton {
    constructor(title) { this.title = title; this.active = false; }
    isActive() { return this.active; }
    setActive(active) { this.active = active; }
  }

  // ---- DevToolsOverlay
  const RED = new Color(221, 44, 0);
  const GREEN = new Color(0, 200, 83);
  const ORANGE = new Color(255, 109, 0);
  const YELLOW = new Color(255, 214, 0);
  const CYAN = new Color(0, 184, 212);
  const BLUE = new Color(41, 98, 255);
  const DEEP_PURPLE = new Color(98, 0, 234);
  const PURPLE = new Color(170, 0, 255);
  const GRAY = new Color(158, 158, 158);
  const MAGENTA = new Color(255, 0, 255);
  const TILE_FLAG_BRIDGE = 2; const TILE_FLAG_VIS_BELOW = 8; const TILE_FLAG_UNDER_ROOF = 4;
  // MovementFlag (CollisionDataFlag)
  const MOVEMENT_FLAGS = [['BLOCK_MOVEMENT_NORTH_WEST', 0x1], ['BLOCK_MOVEMENT_NORTH', 0x2], ['BLOCK_MOVEMENT_NORTH_EAST', 0x4], ['BLOCK_MOVEMENT_EAST', 0x8],
    ['BLOCK_MOVEMENT_SOUTH_EAST', 0x10], ['BLOCK_MOVEMENT_SOUTH', 0x20], ['BLOCK_MOVEMENT_SOUTH_WEST', 0x40], ['BLOCK_MOVEMENT_WEST', 0x80],
    ['BLOCK_MOVEMENT_OBJECT', 0x100], ['BLOCK_MOVEMENT_FLOOR_DECORATION', 0x40000], ['BLOCK_MOVEMENT_FLOOR', 0x200000], ['BLOCK_MOVEMENT_FULL', 0x100 | 0x40000 | 0x200000]];
  const getSetFlags = (data) => MOVEMENT_FLAGS.filter(([, f]) => (data & f) !== 0).map(([n]) => n);

  /** OverlayUtil.renderTileOverlay(graphics, TileObject, text, color) */
  function renderTileOverlay(graphics, tileObject, text, color) {
    const poly = tileObject.getCanvasTilePoly();
    if (poly != null) OverlayUtil.renderPolygon(graphics, poly, color);
    const minimapLocation = tileObject.getMinimapLocation();
    if (minimapLocation != null) OverlayUtil.renderMinimapLocation(graphics, minimapLocation, color);
    const textLocation = tileObject.getCanvasTextLocation(graphics, text, 0);
    if (textLocation != null) OverlayUtil.renderTextLocation(graphics, textLocation, text, color);
  }

  class DevToolsOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_WIDGETS);
      this.setPriority(OverlayPriority.HIGHEST);
    }
    render(graphics) {
      if (client.getCameraFocusEntity() == null) return null;
      const p = this.plugin;
      graphics.setFont(rl.FontManager.getRunescapeBoldFont ? rl.FontManager.getRunescapeBoldFont() : graphics.getFont());
      if (p.players.isActive()) this.renderPlayers(graphics);
      if (p.npcs.isActive()) this.renderNpcs(graphics);
      if (p.groundItems.isActive() || p.groundObjects.isActive() || p.gameObjects.isActive() || p.walls.isActive() || p.decorations.isActive() || p.tileLocation.isActive() || p.movementFlags.isActive()) this.renderTileObjects(graphics);
      if (p.projectiles.isActive()) this.renderProjectiles(graphics);
      if (p.graphicsObjects.isActive()) this.renderGraphicsObjects(graphics);
      if (p.tileFlags.isActive()) this.renderTileFlags(graphics);
      return null;
    }
    renderTileFlags(graphics) {
      const settings = client.getTileSettings();
      const z = client.getPlane();
      for (let x = 0; x < 104; ++x) {
        for (let y = 0; y < 104; ++y) {
          const isbridge = (settings[1][x][y] & TILE_FLAG_BRIDGE) !== 0;
          const flag = settings[z][x][y];
          const isvisbelow = (flag & TILE_FLAG_VIS_BELOW) !== 0;
          const hasroof = (flag & TILE_FLAG_UNDER_ROOF) !== 0;
          if (!isbridge && !isvisbelow && !hasroof) continue;
          let s = '';
          if (isbridge) s += 'B';
          if (isvisbelow) s += 'V';
          if (hasroof) s += 'R';
          const lp = new LocalPoint(x << 7, y << 7);
          const loc = Perspective.getCanvasTextLocation(client, graphics, lp, s, z);
          if (loc == null) continue;
          OverlayUtil.renderTextLocation(graphics, loc, s, Color.RED);
        }
      }
    }
    renderPlayers(graphics) {
      const local = client.getLocalPlayer();
      for (const p of client.getPlayers()) {
        if (local && p.getIndex() === local.getIndex()) continue;
        const text = `${p.getName()} (A: ${p.getAnimation()}) (P: ${p.getPoseAnimation()}) (G: ${p.getGraphic()})`;
        OverlayUtil.renderActorOverlay(graphics, p, text, BLUE);
      }
      if (local != null) {
        const text = `${local.getName()} (A: ${local.getAnimation()}) (P: ${local.getPoseAnimation()}) (G: ${local.getGraphic()})`;
        OverlayUtil.renderActorOverlay(graphics, local, text, CYAN);
      }
    }
    renderNpcs(graphics) {
      for (const npc of client.getNpcs()) {
        const composition = npc.getComposition();
        const color = composition.getCombatLevel() > 1 ? YELLOW : ORANGE;
        // (2007 multi-NPCs are resolved by the server: no configs / transform here)
        const text = `${composition.getName()} (ID:${composition.getId()}) (A: ${npc.getAnimation()}) (P: ${npc.getPoseAnimation()}) (G: ${npc.getGraphic()})`;
        OverlayUtil.renderActorOverlay(graphics, npc, text, color);
      }
    }
    renderTileObjects(graphics) {
      const p = this.plugin;
      const z = client.getPlane();
      // (the scene's tile objects and items, rather than walking 104 x 104 tiles)
      for (const o of rl.sceneTileObjects()) {
        if (o.getPlane() !== z) continue;
        if (o.kind === 3 && p.groundObjects.isActive()) renderTileOverlay(graphics, o, 'ID: ' + o.getId(), PURPLE);
        else if (o.kind === 2 && p.gameObjects.isActive()) renderTileOverlay(graphics, o, 'ID: ' + o.getId(), GREEN);
        else if (o.kind === 0 && p.walls.isActive()) renderTileOverlay(graphics, o, 'ID: ' + o.getId(), GRAY);
        else if (o.kind === 1 && p.decorations.isActive()) {
          renderTileOverlay(graphics, o, 'ID: ' + o.getId(), DEEP_PURPLE);
          const hull = o.getConvexHull();
          if (hull != null) { graphics.setColor(DEEP_PURPLE); graphics.draw(hull); }
        }
      }
      if (p.groundItems.isActive()) this.renderGroundItems(graphics);
      if (p.tileLocation.isActive() || p.movementFlags.isActive()) {
        // (RuneLite tests every tile's polygon against the mouse; the tile under the mouse comes from the client here)
        const m = client.getMouseCanvasPosition();
        const sel = client.getSelectedSceneTile();
        const lp = sel ? sel.getLocalLocation() : null;
        const poly = lp ? Perspective.getCanvasTilePoly(client, lp) : null;
        if (poly != null && poly.contains(m.getX(), m.getY())) {
          if (p.tileLocation.isActive()) this.renderTileTooltip(graphics, lp, poly, lp.getSceneX(), lp.getSceneY());
          if (p.movementFlags.isActive()) this.renderMovementInfo(graphics, poly, lp.getSceneX(), lp.getSceneY());
        }
      }
      return null;
    }
    renderTileTooltip(graphics, lp, poly, sx, sy) {
      const worldLocation = WorldPoint.fromLocalInstance(client, lp);
      const flags = client.getTileSettings()[client.getPlane()][sx][sy];
      const tooltip = `World location: ${worldLocation.getX()}, ${worldLocation.getY()}, ${worldLocation.getPlane()}<br>`
        + `Region ID: ${worldLocation.getRegionID()} location: ${worldLocation.getRegionX()}, ${worldLocation.getRegionY()}<br>`
        + `Flags: ${flags}`;
      rl.tooltipManager.add(new rl.Tooltip(tooltip));
      OverlayUtil.renderPolygon(graphics, poly, GREEN);
    }
    renderMovementInfo(graphics, poly, sx, sy) {
      const maps = client.getCollisionMaps();
      if (maps != null) {
        const data = maps[client.getPlane()].getFlags()[sx][sy];
        const movementFlags = getSetFlags(data);
        if (movementFlags.length === 0) rl.tooltipManager.add(new rl.Tooltip('No movement flags'));
        else movementFlags.forEach((flag) => rl.tooltipManager.add(new rl.Tooltip(flag)));
        OverlayUtil.renderPolygon(graphics, poly, GREEN);
      }
    }
    renderGroundItems(graphics) {
      const z = client.getPlane();
      for (const [packed, items] of rl.lootManager && rl.lootManager.itemSpawns ? rl.lootManager.itemSpawns : []) {
        const lp = LocalPoint.fromScene(packed >> 8, packed & 0xff);
        const poly = Perspective.getCanvasTilePoly(client, lp);
        for (const item of items) {
          if (item.getPlane && item.getPlane() !== z) continue;
          const text = `ID: ${item.getId()} Qty:${item.getQuantity()}`;
          if (poly != null) OverlayUtil.renderPolygon(graphics, poly, RED);
          const t = Perspective.getCanvasTextLocation(client, graphics, lp, text, 0);
          if (t != null) OverlayUtil.renderTextLocation(graphics, t, text, RED);
        }
      }
    }
    renderProjectiles(graphics) {
      for (const projectile of client.getProjectiles()) {
        const text = `(ID: ${projectile.getId()})`;
        const projectilePoint = new LocalPoint(projectile.getX() | 0, projectile.getY() | 0);
        const textLocation = Perspective.getCanvasTextLocation(client, graphics, projectilePoint, text, 0);
        if (textLocation != null) OverlayUtil.renderTextLocation(graphics, textLocation, text, Color.RED);
      }
    }
    renderGraphicsObjects(graphics) {
      for (const graphicsObject of client.getTopLevelWorldView().getGraphicsObjects()) {
        const lp = graphicsObject.getLocation();
        const poly = Perspective.getCanvasTilePoly(client, lp);
        if (poly != null) OverlayUtil.renderPolygon(graphics, poly, MAGENTA);
        const infoString = `(ID: ${graphicsObject.getId()})`;
        const textLocation = Perspective.getCanvasTextLocation(client, graphics, lp, infoString, 0);
        if (textLocation != null) OverlayUtil.renderTextLocation(graphics, textLocation, infoString, Color.WHITE);
      }
    }
  }

  // ---- LocationOverlay
  class LocationOverlay extends OverlayPanel {
    constructor(plugin) { super(plugin); this.plugin = plugin; this.setPosition(OverlayPosition.TOP_LEFT); }
    render(graphics) {
      if (!this.plugin.location.isActive()) return null;
      const me = client.getLocalPlayer();
      if (!me) return null;
      const worldPoint = me.getWorldLocation();
      const localPoint = me.getLocalLocation();
      const ch = this.panelComponent.getChildren();
      ch.push(LineComponent.builder().left('Local').right(`${localPoint.getX()}, ${localPoint.getY()}`).build());
      ch.push(LineComponent.builder().left('World').right(`${worldPoint.getX()}, ${worldPoint.getY()}, ${client.getPlane()}`).build());
      ch.push(LineComponent.builder().left('Scene').right(`${localPoint.getSceneX()}, ${localPoint.getSceneY()}`).build());
      // (no instances in 2007)
      ch.push(LineComponent.builder().left('Base').right(`${client.getBaseX()}, ${client.getBaseY()}`).build());
      const regions = client.getMapRegions() || [];
      for (let i = 0; i < regions.length; i++) {
        const region = regions[i];
        ch.push(LineComponent.builder().left(i === 0 ? 'Map regions' : ' ').right(`${region >> 8}, ${region & 0xff}`)
          .rightColor(region === worldPoint.getRegionID() ? Color.GREEN : Color.WHITE).build());
      }
      return super.render(graphics);
    }
  }

  // ---- CameraOverlay
  class CameraOverlay extends OverlayPanel {
    constructor(plugin) { super(plugin); this.plugin = plugin; this.setPosition(OverlayPosition.TOP_LEFT); }
    render(graphics) {
      if (!this.plugin.cameraPosition.isActive()) return null;
      this.panelComponent.setPreferredSize(new rl.Dimension(175, 0));
      const camX = client.getCameraX(); const camY = client.getCameraZ(); const camZ = client.getCameraY();
      const ch = this.panelComponent.getChildren();
      ch.push(LineComponent.builder().left('Camera').right(`${camX}, ${camY}, ${camZ}`).build());
      ch.push(LineComponent.builder().left('Pitch').right(String(client.getCameraPitch())).build());
      ch.push(LineComponent.builder().left('Yaw').right(String(client.getCameraYaw())).build());
      ch.push(LineComponent.builder().left('Scale').right(String(client.getScale())).build());
      return super.render(graphics);
    }
  }

  // ---- SceneOverlay
  const MAP_SQUARE_COLOR = Color.GREEN;
  const CHUNK_BORDER_COLOR = Color.BLUE;
  const INTERACTING_COLOR = Color.CYAN;
  const LOCAL_TILE_SIZE = 128; const CHUNK_SIZE = 8; const SCENE_SIZE = 104;
  const MAP_SQUARE_SIZE = CHUNK_SIZE * CHUNK_SIZE; // 64
  const CULL_CHUNK_BORDERS_RANGE = 16;
  const STROKE_WIDTH = 4;
  const INTERACTING_SHIFT = -16;
  /** GeneralPath of moveTo / lineTo, drawn as lines */
  class Path {
    constructor() { this.segs = []; this.last = null; }
    moveTo(x, y) { this.last = [x, y]; }
    lineTo(x, y) { if (this.last) this.segs.push([this.last[0], this.last[1], x, y]); this.last = [x, y]; }
    draw(g) { for (const s of this.segs) g.drawLine(s[0], s[1], s[2], s[3]); }
  }
  class SceneOverlay extends Overlay {
    constructor(plugin) { super(plugin); this.plugin = plugin; this.setPosition(OverlayPosition.DYNAMIC); this.setLayer(OverlayLayer.ABOVE_SCENE); }
    render(graphics) {
      const p = this.plugin;
      if (!client.getLocalPlayer()) return null;
      if (p.zoneBorders.isActive()) this.renderZoneBorders(graphics);
      if (p.mapSquares.isActive()) this.renderMapSquares(graphics);
      if (p.loadingLines.isActive()) this.renderLoadingLines(graphics);
      if (p.interacting.isActive()) this.renderInteracting(graphics);
      return null;
    }
    renderZoneBorders(graphics) {
      const startX = CHUNK_SIZE; const startZ = CHUNK_SIZE; const endX = SCENE_SIZE - CHUNK_SIZE; const endZ = SCENE_SIZE - CHUNK_SIZE;
      graphics.setStroke(new BasicStroke(STROKE_WIDTH));
      graphics.setColor(CHUNK_BORDER_COLOR);
      const path = new Path();
      for (let x = startX; x <= endX; x += CHUNK_SIZE) {
        let first = true;
        for (let z = startZ; z <= endZ; z += CHUNK_SIZE) {
          const pt = Perspective.localToCanvas(client, new LocalPoint(x << 7, z << 7), client.getPlane());
          if (pt != null) { if (first) { path.moveTo(pt.getX(), pt.getY()); first = false; } else path.lineTo(pt.getX(), pt.getY()); }
        }
      }
      for (let z = startZ; z <= endZ; z += CHUNK_SIZE) {
        let first = true;
        for (let x = startX; x <= endX; x += CHUNK_SIZE) {
          const pt = Perspective.localToCanvas(client, new LocalPoint(x << 7, z << 7), client.getPlane());
          if (pt != null) { if (first) { path.moveTo(pt.getX(), pt.getY()); first = false; } else path.lineTo(pt.getX(), pt.getY()); }
        }
      }
      path.draw(graphics);
    }
    renderLoadingLines(graphics) {
      graphics.setStroke(new BasicStroke(STROKE_WIDTH));
      graphics.setColor(CHUNK_BORDER_COLOR);
      const off = 16 * LOCAL_TILE_SIZE; const max = SCENE_SIZE * LOCAL_TILE_SIZE;
      const points = [new LocalPoint(off, off), new LocalPoint(off, max - off), new LocalPoint(max - off, max - off), new LocalPoint(max - off, off)];
      for (let i = 0; i < 4; ++i) {
        const p0 = Perspective.localToCanvas(client, points[i], client.getPlane());
        const p1 = Perspective.localToCanvas(client, points[(i + 1) % 4], client.getPlane());
        if (p0 != null && p1 != null) graphics.drawLine(p0.getX(), p0.getY(), p1.getX(), p1.getY());
      }
    }
    renderMapSquares(graphics) {
      const wp = client.getLocalPlayer().getWorldLocation();
      const div = (a) => Math.floor(a / MAP_SQUARE_SIZE) * MAP_SQUARE_SIZE;
      const startX = div(wp.getX() - CULL_CHUNK_BORDERS_RANGE + MAP_SQUARE_SIZE - 1);
      const startY = div(wp.getY() - CULL_CHUNK_BORDERS_RANGE + MAP_SQUARE_SIZE - 1);
      const endX = div(wp.getX() + CULL_CHUNK_BORDERS_RANGE);
      const endY = div(wp.getY() + CULL_CHUNK_BORDERS_RANGE);
      graphics.setStroke(new BasicStroke(STROKE_WIDTH));
      graphics.setColor(MAP_SQUARE_COLOR);
      const path = new Path();
      for (let x = startX; x <= endX; x += MAP_SQUARE_SIZE) {
        const lp1 = LocalPoint.fromWorld(client, x, wp.getY() - CULL_CHUNK_BORDERS_RANGE);
        const lp2 = LocalPoint.fromWorld(client, x, wp.getY() + CULL_CHUNK_BORDERS_RANGE);
        if (!lp1 || !lp2) continue;
        let first = true;
        for (let y = lp1.getY(); y <= lp2.getY(); y += LOCAL_TILE_SIZE) {
          const pt = Perspective.localToCanvas(client, new LocalPoint(lp1.getX() - LOCAL_TILE_SIZE / 2, y - LOCAL_TILE_SIZE / 2), client.getPlane());
          if (pt != null) { if (first) { path.moveTo(pt.getX(), pt.getY()); first = false; } else path.lineTo(pt.getX(), pt.getY()); }
        }
      }
      for (let y = startY; y <= endY; y += MAP_SQUARE_SIZE) {
        const lp1 = LocalPoint.fromWorld(client, wp.getX() - CULL_CHUNK_BORDERS_RANGE, y);
        const lp2 = LocalPoint.fromWorld(client, wp.getX() + CULL_CHUNK_BORDERS_RANGE, y);
        if (!lp1 || !lp2) continue;
        let first = true;
        for (let x = lp1.getX(); x <= lp2.getX(); x += LOCAL_TILE_SIZE) {
          const pt = Perspective.localToCanvas(client, new LocalPoint(x - LOCAL_TILE_SIZE / 2, lp1.getY() - LOCAL_TILE_SIZE / 2), client.getPlane());
          if (pt != null) { if (first) { path.moveTo(pt.getX(), pt.getY()); first = false; } else path.lineTo(pt.getX(), pt.getY()); }
        }
      }
      path.draw(graphics);
    }
    renderInteracting(graphics) {
      this.renderInteractingSet(graphics, client.getPlayers());
      this.renderInteractingSet(graphics, client.getNpcs());
    }
    renderInteractingSet(graphics, set) {
      for (const fa of set) {
        const ta = fa.getInteracting();
        if (ta == null) continue; // (RuneLite returns here, skipping the rest of the set)
        const fs = Perspective.localToCanvas(client, fa.getLocalLocation(), client.getPlane(), fa.getLogicalHeight() / 2);
        if (fs == null) continue;
        const fsx = fs.getX(); const fsy = fs.getY() - INTERACTING_SHIFT;
        const ts = Perspective.localToCanvas(client, ta.getLocalLocation(), client.getPlane(), ta.getLogicalHeight() / 2);
        if (ts == null) continue;
        const tsx = ts.getX(); const tsy = ts.getY() - INTERACTING_SHIFT;
        graphics.setColor(INTERACTING_COLOR);
        graphics.drawLine(fsx, fsy, tsx, tsy);
        // ARROW_HEAD (0,0) (-3,-5) (3,-5), rotated to point along the line, at the target
        const a = Math.atan2(tsy - fsy, tsx - fsx) - Math.PI / 2;
        const rot = (x, y) => [tsx + x * Math.cos(a) - y * Math.sin(a), tsy + x * Math.sin(a) + y * Math.cos(a)];
        const pts = [rot(0, 0), rot(-3, -5), rot(3, -5)];
        graphics.fillPolygon(new rl.Polygon(pts.map((q) => q[0]), pts.map((q) => q[1]), 3));
      }
    }
  }

  // ---- VarInspector (a log of varbit / varp changes, shown in the panel while its button is active)
  const MAX_LOG_ENTRIES = 10000;
  class VarInspector {
    constructor(plugin) { this.plugin = plugin; this.log = []; this.lastTick = -1; this.types = { VARBIT: true, VARP: true }; this.oldVarps = null; }
    open() {
      this.oldVarps = client.getVarps().slice();
      rl.eventBus.register(this);
    }
    close() { rl.eventBus.unregister(this); this.log = []; this.lastTick = -1; this.oldVarps = null; }
    addVarLog(type, name, old, neew) {
      if (!this.types[type]) return;
      const tick = client.getTickCount();
      if (tick !== this.lastTick) { this.lastTick = tick; this.log.push({ header: `Tick ${tick}` }); }
      this.log.push({ text: `${type === 'VARBIT' ? 'Varbit' : 'VarPlayer'} ${name} changed: ${old} -> ${neew}` });
      while (this.log.length > MAX_LOG_ENTRIES) this.log.shift();
      this.plugin.publish();
    }
    onVarbitChanged(e) {
      // (the core posts each varp change, then each changed varbit on it: log once per varp)
      if (e.getVarbitId() !== -1 || !this.oldVarps) return;
      const index = e.getVarpId();
      const varps = client.getVarps();
      const old = this.oldVarps[index] | 0; const neew = varps[index] | 0;
      for (const [id, lsb, msb] of rl.varbitsOf ? rl.varbitsOf(index) : []) {
        const mask = msb - lsb === 31 ? -1 : ((1 << (msb - lsb + 1)) - 1);
        const o = (old >>> lsb) & mask; const n = (neew >>> lsb) & mask;
        if (o !== n) this.addVarLog('VARBIT', String(id), o, n);
      }
      if (old !== neew) this.addVarLog('VARP', String(index), old, neew);
      this.oldVarps = varps.slice();
    }
  }

  // ---- DevToolsPlugin
  const EXAMINE_MENU_ACTIONS = [MenuAction.EXAMINE_ITEM, MenuAction.EXAMINE_ITEM_GROUND, MenuAction.EXAMINE_NPC, MenuAction.EXAMINE_OBJECT].filter((x) => x !== undefined);
  const BUTTONS = ['players:Players', 'npcs:NPCs', 'groundItems:Ground Items', 'groundObjects:Ground Objects', 'gameObjects:Game Objects',
    'graphicsObjects:Graphics Objects', 'walls:Walls', 'decorations:Decorations', 'projectiles:Projectiles', 'location:Location',
    'tileLocation:Tile Location', 'cameraPosition:Camera Position', 'zoneBorders:Zone Borders', 'mapSquares:Map Squares',
    'loadingLines:Loading Lines', 'movementFlags:Movement Flags', 'interacting:Interacting', 'examine:Examine',
    'varInspector:Var Inspector', 'tileFlags:Tile flags', 'menus:Menus'];
  // DevToolsPanel's order: the buttons, with the Notification / Infobox / Clear Infobox action buttons where RuneLite has them
  const PANEL = ['players', 'npcs', 'groundItems', 'groundObjects', 'gameObjects', 'graphicsObjects', 'walls', 'decorations', 'projectiles',
    'location', 'tileLocation', 'cameraPosition', 'zoneBorders', 'mapSquares', 'loadingLines', 'movementFlags', 'interacting', 'examine',
    'varInspector', '!notification:Notification', '!infobox:Infobox', '!clearInfobox:Clear Infobox', 'tileFlags', 'menus'];

  class DevToolsPlugin {
    constructor() { this.configGroup = GROUP; }
    startUp() {
      this.config = rl.configProxy(GROUP, () => this.configItems);
      for (const b of BUTTONS) { const [k, title] = b.split(':'); this[k] = new DevToolsButton(title); }
      this.overlay = new DevToolsOverlay(this);
      this.locationOverlay = new LocationOverlay(this);
      this.sceneOverlay = new SceneOverlay(this);
      this.cameraOverlay = new CameraOverlay(this);
      this.varInspectorFrame = new VarInspector(this);
      for (const o of [this.overlay, this.locationOverlay, this.sceneOverlay, this.cameraOverlay]) rl.overlayManager.add(o);
      this.publish();
    }
    shutDown() {
      for (const o of [this.overlay, this.locationOverlay, this.sceneOverlay, this.cameraOverlay]) rl.overlayManager.remove(o);
      if (this.varInspector.isActive()) this.varInspectorFrame.close();
      rl.panels.update(GROUP, null);
    }
    /** the panel's buttons (NavigationButton "Developer Tools", priority 1) */
    publish() {
      const buttons = PANEL.map((k) => {
        if (k[0] === '!') { const [id, title] = k.slice(1).split(':'); return { id, title, action: true }; }
        return { id: k, title: this[k].title, active: this[k].isActive() };
      });
      const vi = this.varInspector.isActive() ? { types: this.varInspectorFrame.types, log: this.varInspectorFrame.log.slice(-500) } : null;
      rl.panels.update(GROUP, { buttons, varInspector: vi });
    }
    onPanelAction(data) {
      if (data.action === 'toggle' && this[data.id] instanceof DevToolsButton) {
        const b = this[data.id];
        b.setActive(!b.isActive());
        // DevToolsButton.addFrame: the Var Inspector frame opens / closes with its button
        if (b === this.varInspector) { if (b.isActive()) this.varInspectorFrame.open(); else this.varInspectorFrame.close(); }
      } else if (data.action === 'notification') {
        setTimeout(() => rl.notifier.notify(this.config.notification(), 'Wow!'), 3000);
      } else if (data.action === 'infobox') {
        const counter = new Counter(this.resources['devtools_icon.png'], this, 42);
        // Give the infobox a unique name to test infobox splitting
        const name = 'devtools-' + Math.floor(Math.random() * 0x7fffffff);
        counter.getName = () => name;
        if (counter.getMenuEntries) counter.getMenuEntries().push(new OverlayMenuEntry(MenuAction.RUNELITE_INFOBOX || MenuAction.RUNELITE_OVERLAY, 'Test', 'DevTools'));
        rl.infoBoxManager.addInfoBox(counter);
      } else if (data.action === 'clearInfobox') {
        rl.infoBoxManager.removeIf(() => true);
      } else if (data.action === 'varType' && data.type in this.varInspectorFrame.types) {
        this.varInspectorFrame.types[data.type] = !!data.on;
      } else if (data.action === 'varClear') {
        this.varInspectorFrame.log = []; this.varInspectorFrame.lastTick = -1;
      }
      this.publish();
    }
    onCommandExecuted(commandExecuted) {
      const args = commandExecuted.getArguments();
      const msg = (m) => client.addChatMessage('GAMEMESSAGE', '', m, null);
      switch (String(commandExecuted.getCommand()).toLowerCase()) {
        case 'logger': {
          // (no logback here: the level is always INFO)
          commandExecuted.consume();
          msg(args.length < 1 ? 'Logger level is currently set to INFO' : 'Logger level has been set to INFO');
          break;
        }
        case 'getvarp': {
          commandExecuted.consume();
          const varp = Number.parseInt(args[0], 10);
          msg(`VarPlayer ${varp}: ${client.getVarps()[varp] | 0}`);
          break;
        }
        case 'getvarb': {
          commandExecuted.consume();
          const varbit = Number.parseInt(args[0], 10);
          msg(`Varbit ${varbit}: ${client.getVarbitValue(client.getVarps(), varbit)}`);
          break;
        }
        case 'msg': {
          commandExecuted.consume();
          msg(args.join(' '));
          break;
        }
        case 'setconf': {
          commandExecuted.consume();
          const group = args[0];
          let key = args[1]; let value = '';
          for (let i = 2; i < args.length; ++i) {
            if (args[i] === '=') { value = args.slice(i + 1).join(' '); break; }
            key += ' ' + args[i];
          }
          const current = rl.configManager.getConfiguration(group, key);
          let message;
          if (value === '') {
            rl.configManager.unsetConfiguration(group, key);
            message = `Unset configuration ${group}.${key} (was: ${current})`;
          } else {
            rl.configManager.setConfiguration(group, key, value);
            message = `Set configuration ${group}.${key} to ${value} (was: ${current})`;
          }
          msg(message);
          break;
        }
        case 'getconf': {
          commandExecuted.consume();
          const group = args[0]; const key = args.slice(1).join(' ');
          msg(`${group}.${key} = ${rl.configManager.getConfiguration(group, key)}`);
          break;
        }
        default: break;
      }
    }
    onMenuEntryAdded(event) {
      if (!this.examine.isActive()) return;
      const action = event.getType();
      if (!EXAMINE_MENU_ACTIONS.includes(action)) return;
      const entry = event.getMenuEntry();
      const identifier = event.getIdentifier();
      let info = 'ID: ';
      if (action === MenuAction.EXAMINE_NPC) {
        const npc = entry.getNpc();
        info += npc ? npc.getId() : identifier;
      } else {
        info += identifier;
        if (action === MenuAction.EXAMINE_OBJECT) {
          const point = new WorldPoint(client.getBaseX() + entry.getParam0(), client.getBaseY() + entry.getParam1(), client.getPlane());
          info += ` X: ${point.getX()} Y: ${point.getY()}`;
        }
      }
      entry.setTarget(entry.getTarget() + ' ' + ColorUtil.prependColorTag('(' + info + ')', new Color(255, 144, 64))); // JagexColors.MENU_TARGET
    }
    onClientTick() {
      if (!this.menus.isActive() || client.isMenuOpen()) return;
      for (let i = 0; i < 100; ++i) {
        const i_ = i;
        // (no submenus in 2007: RuneLite's pmenu entries are plain entries)
        client.createMenuEntry(1).setOption((i % 30 === 0 ? 'pmenu' : 'menu') + i)
          .setTarget(i % 60 === 0 ? 'devtools devtools devtools devtools' : 'devtools').setType(MenuAction.RUNELITE)
          .onClick(() => client.addChatMessage('GAMEMESSAGE', '', 'menu ' + i_, null));
      }
    }
  }

  const plugin = new DevToolsPlugin();
  ll.__devtools = { plugin, DevToolsOverlay, getSetFlags };
  rl.registerPlugin(GROUP, plugin);
})();
