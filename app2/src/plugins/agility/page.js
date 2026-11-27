// RuneLite's Agility plugin, cloned from net.runelite.client.plugins.agility (BSD 2-Clause, Copyright (c) 2018, Cas
// <https://github.com/casvandongen>, Seth <Sethtroll3@gmail.com> and RuneLite contributors): AgilityPlugin, AgilityOverlay,
// LapCounterOverlay, AgilitySession, AgilityArenaTimer, Courses, Obstacle, Obstacles (obstacles.js).
// Trimmed for Sept 2007: no marks of grace, Prifddinas portals, Hallowed Sepulchre NPCs or Colossal Wyrm courses; the
// courses are the 2007 ones (Gnome, Agility Pyramid, Penguin, Barbarian, Ape Atoll, Wilderness, Werewolf), the Gnome
// course at its 2007 XP (86.5 a lap; OSRS raised it to 110.5 in 2016).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl || !ll.agilityObstacles) return;
  const { client, Skill, Experience, Color, LineComponent, Overlay, OverlayPanel, OverlayPosition, OverlayLayer, OverlayPriority, Timer, ColorUtil, WorldPoint } = rl;
  const AGILITY = Skill.AGILITY;
  const O = ll.agilityObstacles;

  // ---------------------------------------------------------------- Obstacles
  const Obstacles = {
    OBSTACLE_IDS: new Set(O.OBSTACLE_IDS),
    PORTAL_OBSTACLE_IDS: new Set(O.PORTAL_OBSTACLE_IDS),
    TRAP_OBSTACLE_IDS: new Set(O.TRAP_OBSTACLE_IDS),
    TRAP_OBSTACLE_REGIONS: O.TRAP_OBSTACLE_REGIONS,
    SEPULCHRE_OBSTACLE_IDS: new Set(O.SEPULCHRE_OBSTACLE_IDS),
    SEPULCHRE_SKILL_OBSTACLE_IDS: new Set(O.SEPULCHRE_SKILL_OBSTACLE_IDS),
    SHORTCUT_OBSTACLE_IDS: new Map(), // id -> [AgilityShortcut] (a multimap)
  };
  for (const item of rl.AgilityShortcut ? rl.AgilityShortcut.values() : []) {
    for (const obstacle of item.getObstacleIds()) {
      if (!Obstacles.SHORTCUT_OBSTACLE_IDS.has(obstacle)) Obstacles.SHORTCUT_OBSTACLE_IDS.set(obstacle, []);
      Obstacles.SHORTCUT_OBSTACLE_IDS.get(obstacle).push(item);
    }
  }

  // ---------------------------------------------------------------- Courses
  const wp = (x, y, p) => new WorldPoint(x, y, p);
  const COURSES = [];
  const coursesByRegion = new Map();
  function course(name, totalXp, regionId, ...ends) {
    const c = { name, totalXpProvider: typeof totalXp === 'function' ? totalXp : () => totalXp, regionId, courseEndWorldPoints: ends };
    COURSES.push(c);
    if (regionId !== -1) coursesByRegion.set(regionId, c);
    return c;
  }
  const Courses = {
    GNOME: course('GNOME', 86.5, 9781, wp(2484, 3437, 0), wp(2487, 3437, 0)),
    PYRAMID: course('PYRAMID', 722.0, 13356, wp(3364, 2830, 0)),
    PENGUIN: course('PENGUIN', 540.0, 10559, wp(2652, 4039, 1)),
    BARBARIAN: course('BARBARIAN', 153.2, 10039, wp(2543, 3553, 0)),
    APE_ATOLL: course('APE_ATOLL', 580.0, 11050, wp(2770, 2747, 0)),
    WILDERNESS: course('WILDERNESS', 571.4, 11837, wp(2993, 3933, 0), wp(2994, 3933, 0), wp(2995, 3933, 0)),
    WEREWOLF: course('WEREWOLF', 730.0, 14234, wp(3528, 9873, 0)),
    getCourse(regionId) { return coursesByRegion.get(regionId) || null; },
  };

  // ---------------------------------------------------------------- AgilitySession
  class AgilitySession {
    constructor(c) { this.course = c; this.lastLapCompleted = null; this.totalLaps = 0; this.lapsTillGoal = 0; this.lastLapTimes = []; this.lapsPerHour = 0; }
    getCourse() { return this.course; }
    getLastLapCompleted() { return this.lastLapCompleted; }
    setLastLapCompleted(v) { this.lastLapCompleted = v; }
    getTotalLaps() { return this.totalLaps; }
    getLapsTillGoal() { return this.lapsTillGoal; }
    getLapsPerHour() { return this.lapsPerHour; }
    incrementLapCount(xpTrackerService) {
      this.calculateLapsPerHour();
      ++this.totalLaps;
      this.recalculateLapsTillGoal(xpTrackerService);
    }
    recalculateLapsTillGoal(xpTrackerService) {
      const currentExp = client.getSkillExperience(AGILITY);
      const goalXp = xpTrackerService.getEndGoalXp(AGILITY);
      const goalRemainingXp = goalXp - currentExp;
      let courseTotalExp = this.course.totalXpProvider(client);
      if (this.course === Courses.PYRAMID) {
        // agility pyramid has a bonus exp drop on the last obstacle that scales with player level and caps at 1000
        // the bonus is not already accounted for in the total exp number in the courses enum
        courseTotalExp += Math.min(300 + 8 * client.getRealSkillLevel(AGILITY), 1000);
      }
      this.lapsTillGoal = goalRemainingXp > 0 ? Math.ceil(goalRemainingXp / courseTotalExp) : 0;
    }
    calculateLapsPerHour() {
      const now = Date.now();
      if (this.lastLapCompleted != null) {
        const timeSinceLastLap = now - this.lastLapCompleted;
        if (timeSinceLastLap >= 0) {
          this.lastLapTimes.push(timeSinceLastLap);
          if (this.lastLapTimes.length > 30) this.lastLapTimes.shift(); // EvictingQueue.create(30)
          const sum = this.lastLapTimes.reduce((a, b) => a + b, 0);
          const averageLapTime = Math.trunc(sum / this.lastLapTimes.length);
          if (averageLapTime > 0) this.lapsPerHour = Math.trunc(3600000 / averageLapTime);
        }
      }
      this.lastLapCompleted = now;
    }
  }

  // ---------------------------------------------------------------- AgilityArenaTimer
  class AgilityArenaTimer extends Timer {
    constructor(plugin, image) {
      super(60 * 1000, image, plugin);
      this.setTooltip('Time left until location changes');
    }
  }

  // ---------------------------------------------------------------- AgilityOverlay
  const MAX_DISTANCE = 2350;
  const SHORTCUT_HIGH_LEVEL_COLOR = Color.ORANGE;
  class AgilityOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_SCENE);
      this.plugin = plugin; this.config = plugin.config;
    }
    render(graphics) {
      const cameraFocus = client.getCameraFocusEntity();
      if (cameraFocus == null) return null;
      const config = this.config; const plugin = this.plugin;
      const playerLocation = cameraFocus.getCameraFocus();
      const mousePosition = client.getMouseCanvasPosition();
      const stickTile = plugin.getStickTile();
      plugin.getObstacles().forEach((obstacle, object) => {
        const id = object.getId();
        if ((Obstacles.SHORTCUT_OBSTACLE_IDS.has(id) && !config.highlightShortcuts())
          || (Obstacles.TRAP_OBSTACLE_IDS.has(id) && !config.showTrapOverlay())
          || (Obstacles.OBSTACLE_IDS.has(id) && !config.showClickboxes())) return;
        const tile = obstacle.tile;
        if (tile.getPlane() === client.getPlane() && object.getLocalLocation().distanceTo(playerLocation) < MAX_DISTANCE) {
          // This assumes that the obstacle is not clickable.
          if (Obstacles.TRAP_OBSTACLE_IDS.has(id)) {
            const polygon = object.getCanvasTilePoly();
            if (polygon != null) rl.OverlayUtil.renderPolygon(graphics, polygon, config.getTrapColor());
            return;
          }
          const objectClickbox = object.getClickbox();
          if (objectClickbox != null) {
            const agilityShortcut = obstacle.shortcut;
            const configColor = agilityShortcut == null || agilityShortcut.getLevel() <= plugin.getAgilityLevel() ? config.getOverlayColor() : SHORTCUT_HIGH_LEVEL_COLOR;
            if (mousePosition && objectClickbox.contains(mousePosition.getX(), mousePosition.getY())) graphics.setColor(configColor.darker());
            else graphics.setColor(configColor);
            graphics.draw(objectClickbox);
            graphics.setColor(ColorUtil.colorWithAlpha(configColor, Math.trunc(configColor.a / 5)));
            graphics.fill(objectClickbox);
          }
        }
      });
      if (stickTile != null && config.highlightStick()) this.highlightTile(graphics, playerLocation, stickTile, config.stickHighlightColor());
      return null;
    }
    highlightTile(graphics, playerLocation, tile, color) {
      const layer = tile.getItemLayer();
      if (tile.getPlane() === client.getPlane() && layer != null && tile.getLocalLocation().distanceTo(playerLocation) < MAX_DISTANCE) {
        const poly = layer.getCanvasTilePoly();
        if (poly != null) rl.OverlayUtil.renderPolygon(graphics, poly, color);
      }
    }
  }

  // ---------------------------------------------------------------- LapCounterOverlay
  class LapCounterOverlay extends OverlayPanel {
    constructor(plugin) {
      super(plugin);
      this.setPosition(OverlayPosition.TOP_LEFT);
      this.setPriority(OverlayPriority.LOW);
      this.plugin = plugin; this.config = plugin.config;
      this.addMenuEntry('RUNELITE_OVERLAY_CONFIG', 'Configure', 'Agility overlay');
      this.addMenuEntry('RUNELITE_OVERLAY', 'Reset', 'Agility overlay', () => plugin.setSession(null));
    }
    render(graphics) {
      const session = this.plugin.getSession();
      if (!this.config.showLapCount() || session == null || session.getLastLapCompleted() == null || session.getCourse() == null) return null;
      const lapTimeout = this.config.lapTimeout() * 60000;
      const sinceLap = Date.now() - session.getLastLapCompleted();
      if (sinceLap >= lapTimeout) {
        // timeout session
        session.setLastLapCompleted(null);
        return null;
      }
      const ch = this.panelComponent.getChildren();
      ch.push(LineComponent.builder().left('Total Laps:').right(String(session.getTotalLaps())).build());
      if (this.config.lapsToLevel() && session.getLapsTillGoal() > 0) ch.push(LineComponent.builder().left('Laps until goal:').right(String(session.getLapsTillGoal())).build());
      if (this.config.lapsPerHour() && session.getLapsPerHour() > 0) ch.push(LineComponent.builder().left('Laps per hour:').right(String(session.getLapsPerHour())).build());
      return super.render(graphics);
    }
  }

  // ---------------------------------------------------------------- AgilityPlugin
  const AGILITY_ARENA_REGION_ID = 11157;
  const ItemID = { AGILITYARENA_TICKET: 2996, WAA_STICK: 4179 };
  class AgilityPlugin {
    constructor() {
      this.config = rl.configProxy('agility', () => this.configItems);
      this.obstacles = new Map(); // TileObject -> { tile, shortcut }
      this.session = null;
      this.lastAgilityXp = 0;
      this.lastArenaTicketPosition = null;
      this.agilityLevel = 0;
      this.stickTile = null;
      this.agilityOverlay = new AgilityOverlay(this);
      this.lapCounterOverlay = new LapCounterOverlay(this);
    }
    getObstacles() { return this.obstacles; }
    getSession() { return this.session; }
    setSession(s) { this.session = s; }
    getAgilityLevel() { return this.agilityLevel; }
    getStickTile() { return this.stickTile; }
    startUp() {
      rl.overlayManager.add(this.agilityOverlay);
      rl.overlayManager.add(this.lapCounterOverlay);
      this.agilityLevel = client.getBoostedSkillLevel(AGILITY);
    }
    shutDown() {
      rl.overlayManager.remove(this.agilityOverlay);
      rl.overlayManager.remove(this.lapCounterOverlay);
      this.obstacles.clear();
      this.session = null;
      this.agilityLevel = 0;
      this.stickTile = null;
    }
    onGameStateChanged(event) {
      switch (event.getGameState()) {
        case 'HOPPING':
        case 'LOGIN_SCREEN':
          this.session = null;
          this.lastArenaTicketPosition = null;
          this.removeAgilityArenaTimer();
          break;
        case 'LOADING':
          this.obstacles.clear();
          this.stickTile = null;
          break;
        case 'LOGGED_IN':
          if (!this.isInAgilityArena()) {
            this.lastArenaTicketPosition = null;
            this.removeAgilityArenaTimer();
          }
          break;
        default:
      }
    }
    onConfigChanged() {
      if (!this.config.showAgilityArenaTimer()) this.removeAgilityArenaTimer();
    }
    onStatChanged(statChanged) {
      if (statChanged.getSkill() !== AGILITY) return;
      this.agilityLevel = statChanged.getBoostedLevel();
      // Store previous agility level for possible goal laps recalculation
      const previousLevel = Experience.getLevelForXp(this.lastAgilityXp);
      // Determine how much EXP was actually gained
      const agilityXp = statChanged.getXp();
      this.lastAgilityXp = agilityXp;
      const me = client.getLocalPlayer();
      if (!me) return;
      const here = me.getWorldLocation();
      // Get course
      const c = Courses.getCourse(here.getRegionID());
      if (c == null || !this.config.showLapCount()) return;
      if (!c.courseEndWorldPoints.some((w) => w.equals(here))) {
        if (this.session != null && previousLevel !== statChanged.getLevel()) this.session.recalculateLapsTillGoal(rl.xpTrackerService);
        return;
      }
      this.trackSession(c);
    }
    onItemSpawned(itemSpawned) {
      if (this.obstacles.size === 0) return;
      const item = itemSpawned.getItem();
      const tile = itemSpawned.getTile();
      if (item.getId() === ItemID.WAA_STICK) this.stickTile = tile;
    }
    onItemDespawned(itemDespawned) {
      const item = itemDespawned.getItem();
      const tile = itemDespawned.getTile();
      // (our tiles are per event: the same tile is the same world point)
      if (item.getId() === ItemID.WAA_STICK && this.stickTile != null && this.stickTile.equals(tile)) this.stickTile = null;
    }
    onGameTick() {
      if (this.isInAgilityArena()) {
        // Hint arrow has no plane, and always returns the current plane
        const newTicketPosition = client.getHintArrowPoint();
        if (newTicketPosition == null) return;
        const oldTickPosition = this.lastArenaTicketPosition;
        this.lastArenaTicketPosition = newTicketPosition;
        if (oldTickPosition != null && (oldTickPosition.getX() !== newTicketPosition.getX() || oldTickPosition.getY() !== newTicketPosition.getY())) {
          if (this.config.notifyAgilityArena()) rl.notifier.notify('Ticket location changed');
          if (this.config.showAgilityArenaTimer()) this.showNewAgilityArenaTimer();
        }
      }
    }
    trackSession(c) {
      if (this.session == null || this.session.getCourse() !== c) this.session = new AgilitySession(c);
      this.session.incrementLapCount(rl.xpTrackerService);
    }
    isInAgilityArena() {
      const local = client.getLocalPlayer();
      if (local == null) return false;
      return local.getWorldLocation().getRegionID() === AGILITY_ARENA_REGION_ID;
    }
    removeAgilityArenaTimer() { rl.infoBoxManager.removeIf((infoBox) => infoBox instanceof AgilityArenaTimer); }
    showNewAgilityArenaTimer() {
      this.removeAgilityArenaTimer();
      rl.infoBoxManager.addInfoBox(new AgilityArenaTimer(this, rl.itemManager.getImage(ItemID.AGILITYARENA_TICKET)));
    }
    onGameObjectSpawned(e) { this.onTileObject(e.getTile(), null, e.getGameObject()); }
    onGameObjectDespawned(e) { this.onTileObject(e.getTile(), e.getGameObject(), null); }
    onGroundObjectSpawned(e) { this.onTileObject(e.getTile(), null, e.getGroundObject()); }
    onGroundObjectDespawned(e) { this.onTileObject(e.getTile(), e.getGroundObject(), null); }
    onWallObjectSpawned(e) { this.onTileObject(e.getTile(), null, e.getWallObject()); }
    onWallObjectDespawned(e) { this.onTileObject(e.getTile(), e.getWallObject(), null); }
    onDecorativeObjectSpawned(e) { this.onTileObject(e.getTile(), null, e.getDecorativeObject()); }
    onDecorativeObjectDespawned(e) { this.onTileObject(e.getTile(), e.getDecorativeObject(), null); }
    onTileObject(tile, oldObject, newObject) {
      if (oldObject) this.obstacles.delete(oldObject);
      if (newObject == null) return;
      const id = newObject.getId();
      if (Obstacles.OBSTACLE_IDS.has(id) || Obstacles.PORTAL_OBSTACLE_IDS.has(id)
        || (Obstacles.TRAP_OBSTACLE_IDS.has(id) && Obstacles.TRAP_OBSTACLE_REGIONS.includes(newObject.getWorldLocation().getRegionID()))
        || Obstacles.SEPULCHRE_OBSTACLE_IDS.has(id) || Obstacles.SEPULCHRE_SKILL_OBSTACLE_IDS.has(id)) {
        this.obstacles.set(newObject, { tile, shortcut: null });
      }
      if (Obstacles.SHORTCUT_OBSTACLE_IDS.has(id)) {
        let closestShortcut = null;
        let distance = -1;
        // Find the closest shortcut to this object
        for (const shortcut of Obstacles.SHORTCUT_OBSTACLE_IDS.get(id)) {
          if (!shortcut.matches(client, newObject)) continue;
          if (shortcut.getWorldLocation() == null) { closestShortcut = shortcut; break; }
          const w = shortcut.getWorldLocation(); const o = newObject.getWorldLocation();
          const newDistance = Math.max(Math.abs(w.x - o.x), Math.abs(w.y - o.y)); // distanceTo2D
          if (closestShortcut == null || newDistance < distance) { closestShortcut = shortcut; distance = newDistance; }
        }
        if (closestShortcut != null) this.obstacles.set(newObject, { tile, shortcut: closestShortcut });
      }
    }
  }

  const plugin = new AgilityPlugin();
  ll.__agility = { plugin, Courses, Obstacles };
  rl.registerPlugin('agility', plugin);
})();
