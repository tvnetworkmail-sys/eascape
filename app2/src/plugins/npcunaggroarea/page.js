// RuneLite's NPC Aggression Timer plugin, cloned from net.runelite.client.plugins.npcunaggroarea (BSD 2-Clause,
// Copyright (c) 2018, Woox <https://github.com/wooxsolo> and RuneLite contributors): NpcAggroAreaPlugin,
// NpcAggroAreaConfig, NpcAggroAreaOverlay, AggressionTimer, UncalibratedInfobox.
// Our server keeps OSRS's two remembered tiles (Player.afkZones: 21x21 around each, 1000 ticks = RuneLite's 600 s).
// 2007: the infobox icon is the skull (964; OSRS's ensouled demon head is later). Geometry.clipPath / splitIntoSegments
// over the safe Area is done directly: the outline is the union's boundary tile edges, one tile long each, clipped to
// the scene. Slayer targets come from the Slayer clone (ll.__slayer).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Color, Overlay, OverlayPosition, OverlayLayer, OverlayPriority, BasicStroke, InfoBox, Timer, WorldPoint, WorldArea, LocalPoint, Perspective, WildcardMatcher, GameState } = rl;
  const CONFIG_GROUP = 'npcUnaggroArea';
  const CONFIG_CENTER1 = 'center1';
  const CONFIG_CENTER2 = 'center2';
  const CONFIG_LOCATION = 'location';
  const CONFIG_DURATION = 'duration';
  const ICON_ITEM = 964; // (skull; OSRS: ItemID.ARCEUUS_CORPSE_DEMON_INITIAL)
  const MAX_Z = 4;
  const SCENE_SIZE = 104;
  const LOCAL_TILE_SIZE = 128;

  const SAFE_AREA_RADIUS = 10;
  const UNKNOWN_AREA_RADIUS = SAFE_AREA_RADIUS * 2;
  const AGGRESSIVE_TIME_DURATION = 600 * 1000;
  const splitNames = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
  const WILDERNESS_ABOVE_GROUND = new WorldArea(2944, 3523, 448, 448, 0);
  const WILDERNESS_UNDERGROUND = new WorldArea(2944, 9918, 320, 442, 0);
  // (RuneLite's config serializers: WorldPoint as "x:y:plane", Duration as ISO-8601 seconds)
  const wpToString = (p) => `${p.x}:${p.y}:${p.plane}`;
  const wpFrom = (s) => { if (s == null || s === '') return null; const a = String(s).split(':').map(Number); return a.length === 3 && a.every(Number.isFinite) ? new WorldPoint(a[0], a[1], a[2]) : null; };
  const durToString = (ms) => `PT${(ms / 1000).toFixed(3)}S`;
  const durFrom = (s) => { const m = /^PT(-?[\d.]+)S$/.exec(String(s || '')); return m ? Number(m[1]) * 1000 : null; };

  class AggressionTimer extends Timer {
    constructor(durationMs, image, plugin) {
      super(durationMs, image, plugin);
      this.setTooltip('Time until NPCs become unaggressive');
      this.plugin = plugin;
    }
    getEndTime() { return this.end; }
    getTextColor() {
      const timeLeft = this.end - Date.now();
      if (Math.trunc(timeLeft / 1000) < 60) return Color.RED.brighter();
      return Color.WHITE;
    }
    render() { return this.plugin.shouldDisplayTimer() && super.render(); }
  }

  class UncalibratedInfobox extends InfoBox {
    constructor(image, plugin) {
      super(image, plugin);
      this.plugin = plugin;
      this.setTooltip('Unaggressive NPC timers require calibration.</br>Teleport far away or enter a dungeon, then run until this infobox disappears.');
      this.setPriority(rl.InfoBoxPriority ? rl.InfoBoxPriority.HIGH : 2);
    }
    getText() { return '?'; }
    getTextColor() { return Color.WHITE; }
    render() { return this.plugin.getSafeCenters()[1] == null; }
  }

  const MAX_LOCAL_DRAW_LENGTH = 20 * LOCAL_TILE_SIZE;
  class NpcAggroAreaOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.setLayer(OverlayLayer.ABOVE_SCENE);
      this.setPriority(OverlayPriority.LOW);
      this.setPosition(OverlayPosition.DYNAMIC);
    }
    render(graphics) {
      const plugin = this.plugin; const config = plugin.config;
      if (!plugin.isActive() || plugin.getSafeCenters()[1] == null) return null;
      const localPlayer = client.getLocalPlayer();
      if (localPlayer.getHealthScale() === -1 && config.hideIfOutOfCombat()) return null;
      const lines = plugin.getLinesToDisplay()[client.getPlane()];
      if (lines == null) return null;
      let outlineColor = config.unaggroAreaColor();
      if (outlineColor == null || (plugin.getEndTime() != null && Date.now() < plugin.getEndTime())) outlineColor = config.aggroAreaColor();
      this.renderPath(graphics, lines, outlineColor);
      return null;
    }
    renderPath(graphics, path, color) {
      const playerLp = client.getLocalPlayer().getLocalLocation();
      const vx0 = playerLp.getX() - MAX_LOCAL_DRAW_LENGTH; const vy0 = playerLp.getY() - MAX_LOCAL_DRAW_LENGTH;
      const vx1 = vx0 + MAX_LOCAL_DRAW_LENGTH * 2; const vy1 = vy0 + MAX_LOCAL_DRAW_LENGTH * 2;
      graphics.setColor(color);
      graphics.setStroke(new BasicStroke(1));
      const plane = client.getPlane();
      for (const [x0, y0, x1, y1] of path) {
        // (Geometry.clipPath to the view area: the segments are one tile long, so a segment is in or out)
        if (Math.max(x0, x1) < vx0 || Math.min(x0, x1) > vx1 || Math.max(y0, y1) < vy0 || Math.min(y0, y1) > vy1) continue;
        const p1 = Perspective.localToCanvas(client, new LocalPoint(x0, y0), plane);
        const p2 = Perspective.localToCanvas(client, new LocalPoint(x1, y1), plane);
        if (p1 == null || p2 == null) continue;
        graphics.drawLine(p1.getX(), p1.getY(), p2.getX(), p2.getY());
      }
    }
  }

  class NpcAggroAreaPlugin {
    constructor() {
      this.configGroup = CONFIG_GROUP;
      this.subscribePriority = -1; // (@Subscribe(priority = -1) on NpcSpawned: after the Slayer plugin)
      this.safeCenters = [null, null];
      this.linesToDisplay = new Array(MAX_Z).fill(null);
      this.active = false; this.endTime = null; this.lastPlayerLocation = null; this.previousUnknownCenter = null;
      this.loggingIn = false; this.notifyOnce = false; this.npcNamePatterns = null;
    }
    getSafeCenters() { return this.safeCenters; }
    getLinesToDisplay() { return this.linesToDisplay; }
    isActive() { return this.active; }
    getEndTime() { return this.endTime; }
    startUp() {
      this.config = rl.configProxy(CONFIG_GROUP, () => this.configItems);
      this.overlay = new NpcAggroAreaOverlay(this);
      rl.overlayManager.add(this.overlay);
      this.npcNamePatterns = splitNames(this.config.npcNamePatterns());
      rl.infoBoxManager.addInfoBox(this.withIcon(new UncalibratedInfobox(this.icon(), this)));
      setTimeout(() => this.scanNpcs(), 0);
    }
    // (ItemManager.getImage is an AsyncBufferedImage in RuneLite: the 2007 icon may still be loading, so it's read when drawn)
    icon() { return null; }
    withIcon(box) { Object.defineProperty(box, 'image', { get() { return this._img || (this._img = rl.itemManager.getImage(ICON_ITEM) || null); }, set(v) { this._img = v; } }); return box; }
    shutDown() {
      this.removeTimer();
      rl.overlayManager.remove(this.overlay);
      rl.infoBoxManager.removeIf((b) => b instanceof UncalibratedInfobox);
      this.safeCenters.fill(null);
      this.lastPlayerLocation = null; this.endTime = null; this.loggingIn = false; this.npcNamePatterns = null; this.active = false;
      this.linesToDisplay.fill(null);
    }
    /** the safe Area's outline: boundary tile edges of the union of the squares, as world segments */
    generateSafeAreaEdges(clip) {
      const centers = this.safeCenters.filter((c) => c != null);
      const inside = (x, y) => centers.some((wp) => x >= wp.x - SAFE_AREA_RADIUS && x <= wp.x + SAFE_AREA_RADIUS && y >= wp.y - SAFE_AREA_RADIUS && y <= wp.y + SAFE_AREA_RADIUS);
      const edges = [];
      const inClip = (x0, y0, x1, y1) => Math.min(x0, x1) >= clip.x && Math.max(x0, x1) <= clip.x + clip.w && Math.min(y0, y1) >= clip.y && Math.max(y0, y1) <= clip.y + clip.h;
      for (const wp of centers) {
        for (let x = wp.x - SAFE_AREA_RADIUS; x <= wp.x + SAFE_AREA_RADIUS + 1; x++) {
          for (let y = wp.y - SAFE_AREA_RADIUS; y <= wp.y + SAFE_AREA_RADIUS + 1; y++) {
            const here = inside(x, y);
            // the edge on the tile's west side (between x-1 and x) and south side (between y-1 and y)
            if (here !== inside(x - 1, y) && inClip(x, y, x, y + 1)) edges.push([x, y, x, y + 1]);
            if (here !== inside(x, y - 1) && inClip(x, y, x + 1, y)) edges.push([x, y, x + 1, y]);
          }
        }
      }
      // (two squares share edge cells: drop duplicates)
      const seen = new Set();
      return edges.filter((e) => { const k = e.join(','); if (seen.has(k)) return false; seen.add(k); return true; });
    }
    calculateLinesToDisplay() {
      if (!this.active || !this.config.showAreaLines()) { this.linesToDisplay.fill(null); return; }
      const sceneRect = { x: client.getBaseX() + 1, y: client.getBaseY() + 1, w: SCENE_SIZE - 2, h: SCENE_SIZE - 2 };
      const lines = [];
      for (const [x0, y0, x1, y1] of this.generateSafeAreaEdges(sceneRect)) {
        // (LocalPoint.fromWorld is relative to the scene base, so it is valid for these clipped points)
        const bx = client.getBaseX(); const by = client.getBaseY();
        const a = [(x0 - bx) * LOCAL_TILE_SIZE, (y0 - by) * LOCAL_TILE_SIZE];
        const b = [(x1 - bx) * LOCAL_TILE_SIZE, (y1 - by) * LOCAL_TILE_SIZE];
        lines.push([a[0], a[1], b[0], b[1]]);
      }
      for (let i = 0; i < this.linesToDisplay.length; i++) this.linesToDisplay[i] = lines;
    }
    removeTimer() {
      rl.infoBoxManager.removeIf((t) => t instanceof AggressionTimer);
      this.endTime = null;
      this.notifyOnce = false;
    }
    createTimer(durationMs) {
      this.removeTimer();
      this.endTime = Date.now() + durationMs;
      this.notifyOnce = true;
      if (durationMs < 0) return;
      rl.infoBoxManager.addInfoBox(this.withIcon(new AggressionTimer(durationMs, this.icon(), this)));
    }
    resetTimer() { this.createTimer(AGGRESSIVE_TIME_DURATION); }
    static isInWilderness(location) { return location.isInArea2D(WILDERNESS_ABOVE_GROUND, WILDERNESS_UNDERGROUND); }
    isNpcMatch(npc) {
      const composition = npc.getTransformedComposition();
      if (composition == null) return false;
      if (!composition.getName()) return false;
      const playerLvl = client.getLocalPlayer().getCombatLevel();
      const npcLvl = composition.getCombatLevel();
      const npcName = composition.getName().toLowerCase();
      if (npcLvl > 0 && playerLvl > npcLvl * 2 && !NpcAggroAreaPlugin.isInWilderness(npc.getWorldLocation())) return false;
      if (this.config.showOnSlayerTask()) {
        const slayer = ll.__slayer && ll.__slayer.plugin;
        const targets = slayer && slayer.getTargets ? slayer.getTargets() : [];
        if (targets.some((t) => t === npc || (t.getIndex && npc.getIndex && t.getIndex() === npc.getIndex()))) return true;
      }
      for (const pattern of this.npcNamePatterns || []) if (WildcardMatcher.matches(pattern, npcName)) return true;
      return false;
    }
    scanNpcs() {
      if (!this.config) return;
      const wv = client.getTopLevelWorldView();
      if (wv == null) return;
      this.active = this.config.alwaysActive();
      if (!this.active && client.getLocalPlayer()) {
        for (const npc of wv.npcs()) {
          if (npc == null) continue;
          if (this.isNpcMatch(npc)) { this.active = true; break; }
        }
      }
      this.calculateLinesToDisplay();
    }
    onNpcSpawned(event) {
      if (this.active) return;
      if (this.isNpcMatch(event.getNpc())) { this.active = true; this.calculateLinesToDisplay(); }
    }
    onGameTick() {
      const local = client.getLocalPlayer();
      if (!local) return;
      const newLocation = local.getWorldLocation();
      if (this.active && this.notifyOnce && Date.now() > this.endTime) {
        if (this.config.notifyExpire()) rl.notifier.notify('NPC aggression has expired!');
        this.notifyOnce = false;
      }
      if (this.lastPlayerLocation != null) {
        if (this.safeCenters[1] == null && newLocation.distanceTo2D(this.lastPlayerLocation) > SAFE_AREA_RADIUS * 4) {
          this.safeCenters[0] = null;
          this.safeCenters[1] = newLocation;
          this.resetTimer();
          this.calculateLinesToDisplay();
          this.previousUnknownCenter = this.lastPlayerLocation;
        }
      }
      if (this.safeCenters[0] == null && this.previousUnknownCenter != null && this.previousUnknownCenter.distanceTo2D(newLocation) <= UNKNOWN_AREA_RADIUS) {
        this.safeCenters[1] = null;
        this.removeTimer();
        this.calculateLinesToDisplay();
      }
      if (this.safeCenters[1] != null) {
        if (!this.safeCenters.some((x) => x != null && x.distanceTo2D(newLocation) <= SAFE_AREA_RADIUS)) {
          this.safeCenters[0] = this.safeCenters[1];
          this.safeCenters[1] = newLocation;
          this.resetTimer();
          this.calculateLinesToDisplay();
          this.previousUnknownCenter = null;
        }
      }
      this.lastPlayerLocation = newLocation;
    }
    onConfigChanged(event) {
      switch (event.getKey()) {
        case 'npcUnaggroAlwaysActive':
        case 'showOnSlayerTask':
          setTimeout(() => this.scanNpcs(), 0);
          break;
        case 'npcUnaggroCollisionDetection':
        case 'npcUnaggroShowAreaLines':
          this.calculateLinesToDisplay();
          break;
        case 'npcUnaggroNames':
          this.npcNamePatterns = splitNames(this.config.npcNamePatterns());
          setTimeout(() => this.scanNpcs(), 0);
          break;
        default:
          // (our settings editor saves the whole group without a key: treat it as every key)
          if (event.getKey() == null && this.config) { this.npcNamePatterns = splitNames(this.config.npcNamePatterns()); setTimeout(() => this.scanNpcs(), 0); }
          break;
      }
    }
    shouldDisplayTimer() { return this.active && this.config.showTimer(); }
    loadConfig() {
      const cm = rl.configManager;
      this.safeCenters[0] = wpFrom(cm.getRSProfileConfiguration(CONFIG_GROUP, CONFIG_CENTER1));
      this.safeCenters[1] = wpFrom(cm.getRSProfileConfiguration(CONFIG_GROUP, CONFIG_CENTER2));
      this.lastPlayerLocation = wpFrom(cm.getRSProfileConfiguration(CONFIG_GROUP, CONFIG_LOCATION));
      const timeLeft = durFrom(cm.getRSProfileConfiguration(CONFIG_GROUP, CONFIG_DURATION));
      if (timeLeft != null) this.createTimer(timeLeft);
    }
    resetConfig() {
      const cm = rl.configManager;
      for (const k of [CONFIG_CENTER1, CONFIG_CENTER2, CONFIG_LOCATION, CONFIG_DURATION]) cm.unsetRSProfileConfiguration(CONFIG_GROUP, k);
    }
    saveConfig() {
      if (this.safeCenters[0] == null || this.safeCenters[1] == null || this.lastPlayerLocation == null || this.endTime == null) this.resetConfig();
      else {
        const cm = rl.configManager;
        cm.setRSProfileConfiguration(CONFIG_GROUP, CONFIG_CENTER1, wpToString(this.safeCenters[0]));
        cm.setRSProfileConfiguration(CONFIG_GROUP, CONFIG_CENTER2, wpToString(this.safeCenters[1]));
        cm.setRSProfileConfiguration(CONFIG_GROUP, CONFIG_LOCATION, wpToString(this.lastPlayerLocation));
        cm.setRSProfileConfiguration(CONFIG_GROUP, CONFIG_DURATION, durToString(this.endTime - Date.now()));
      }
    }
    onLogin() {
      this.loadConfig();
      this.resetConfig();
      const newLocation = client.getLocalPlayer().getWorldLocation();
      if (this.lastPlayerLocation == null || newLocation.distanceTo(this.lastPlayerLocation) !== 0) {
        this.safeCenters[0] = null;
        this.safeCenters[1] = null;
        this.lastPlayerLocation = newLocation;
      }
    }
    onGameStateChanged(event) {
      switch (event.getGameState()) {
        case GameState.LOGGED_IN:
          if (this.loggingIn) { this.loggingIn = false; if (client.getLocalPlayer()) this.onLogin(); }
          this.scanNpcs();
          break;
        case GameState.LOGGING_IN:
          this.loggingIn = true;
          break;
        case GameState.LOGIN_SCREEN:
          if (this.lastPlayerLocation != null) this.saveConfig();
          this.safeCenters[0] = null;
          this.safeCenters[1] = null;
          this.lastPlayerLocation = null;
          this.endTime = null;
          break;
        default: break;
      }
    }
  }

  const plugin = new NpcAggroAreaPlugin();
  ll.__npcunaggroarea = { plugin, AggressionTimer, UncalibratedInfobox };
  rl.registerPlugin('npcunaggroarea', plugin);
})();
