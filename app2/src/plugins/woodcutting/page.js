// RuneLite's Woodcutting plugin, cloned from net.runelite.client.plugins.woodcutting (BSD 2-Clause, Copyright (c) 2018,
// Mantautas Jurksa <https://github.com/Juzzed> and RuneLite contributors): WoodcuttingPlugin, WoodcuttingOverlay,
// WoodcuttingSceneOverlay (renderTimers), WoodcuttingSession, TreeRespawn; WOODCUTTING_ANIMS in trees.js
// (app/tools/runelite/woodcutting.py).
// Trimmed for Sept 2007: no clue nests, redwoods, Forestry (its events, highlights, notifications, Leprechaun's Luck) or
// Anima-infused bark, and no gathering buff varp (VarPlayerID.GROUP_GATHERING_ACTIVE_BUFF is Forestry's).
// The respawn's start and length: RuneLite reads them from ADD_OVERLAYTIMER_LOC, which Jagex's server calls since 2023;
// the 2007 server sends no timer, so a tree that despawns as its stump spawns on the same tile starts one with the ticks
// the server's woodcutting data gives that tree (trees.js; a normal tree's random 120-199 takes the longest), and the
// timer ends when the stump turns back into the tree.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl || !ll.woodcuttingTrees) return;
  const { client, Color, LineComponent, TitleComponent, Overlay, OverlayPanel, OverlayPosition, OverlayLayer, LocalPoint, Perspective, ProgressPieComponent } = rl;
  // 2006RS-2: server data: the server says when an action in a skill is going on (::appidle, engine Player.appIdleTick;
  // the runtime's ll.appSkilling), so this needn't rest on the animation alone
  const serverSkilling = (skill) => !!(ll.appSkilling && ll.appSkilling(skill));
  const T = ll.woodcuttingTrees;
  const GAME_TICK_LENGTH = 600;
  const LOCAL_HALF_TILE_SIZE = 64;
  const WOODCUTTING_ANIMS = new Set(T.WOODCUTTING_ANIMS);

  class TreeRespawn {
    constructor(worldLocation, lenX, lenY, startTime, respawnTime) {
      this.worldLocation = worldLocation; this.lenX = lenX; this.lenY = lenY; this.startTime = startTime; this.respawnTime = respawnTime;
    }
    getWorldLocation() { return this.worldLocation; }
    getLenX() { return this.lenX; }
    getLenY() { return this.lenY; }
    getStartTime() { return this.startTime; }
    getRespawnTime() { return this.respawnTime; }
    isExpired() { return Date.now() > this.startTime + this.respawnTime; }
  }

  class WoodcuttingSession {
    constructor() { this.start = Date.now(); this.lastChopping = null; this.logsCut = 0; this.logsPerHr = 0; this.active = true; }
    getLastChopping() { return this.lastChopping; }
    getLogsCut() { return this.logsCut; }
    getLogsPerHr() { return this.logsPerHr; }
    isActive() { return this.active; }
    setActive(a) { this.active = a; }
    setLastChopping() { this.lastChopping = Date.now(); this.setActive(true); }
    incrementLogsCut() {
      ++this.logsCut;
      const elapsedMs = Date.now() - this.start;
      if (this.logsCut >= 3 && elapsedMs > 0) this.logsPerHr = Math.trunc(this.logsCut * 3600000 / elapsedMs);
    }
  }

  // ---------------------------------------------------------------- WoodcuttingOverlay
  const WOODCUTTING_RESET = 'Reset';
  class WoodcuttingOverlay extends OverlayPanel {
    constructor(plugin) {
      super(plugin);
      this.setPosition(OverlayPosition.TOP_LEFT);
      this.plugin = plugin; this.config = plugin.config;
      this.addMenuEntry('RUNELITE_OVERLAY_CONFIG', 'Configure', 'Woodcutting overlay');
      this.addMenuEntry('RUNELITE_OVERLAY', WOODCUTTING_RESET, 'Woodcutting overlay', () => plugin.resetSession());
    }
    render(graphics) {
      const session = this.plugin.getSession();
      if (session == null || !session.isActive() || !this.config.showWoodcuttingStats()) return null;
      const ch = this.panelComponent.getChildren();
      if (WOODCUTTING_ANIMS.has(client.getLocalPlayer().getAnimation()) || serverSkilling('woodcutting')) {
        ch.push(TitleComponent.builder().text('Woodcutting').color(Color.GREEN).build());
      } else {
        ch.push(TitleComponent.builder().text('NOT woodcutting').color(Color.RED).build());
      }
      const logsCut = session.getLogsCut();
      if (logsCut > 0) ch.push(LineComponent.builder().left('Logs cut:').right(String(logsCut)).build());
      const logsPerHr = session.getLogsPerHr();
      if (logsPerHr > 0) ch.push(LineComponent.builder().left('Logs/hr:').right(String(logsPerHr)).build());
      return super.render(graphics);
    }
  }

  // ---------------------------------------------------------------- WoodcuttingSceneOverlay
  class WoodcuttingSceneOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.setLayer(OverlayLayer.ABOVE_SCENE);
      this.setPosition(OverlayPosition.DYNAMIC);
      this.plugin = plugin; this.config = plugin.config;
    }
    render(graphics) {
      this.renderTimers(graphics);
      return null;
    }
    renderTimers(graphics) {
      const respawns = this.plugin.getRespawns();
      if (respawns.length === 0 || !this.config.showRespawnTimers()) return;
      const now = Date.now();
      for (const treeRespawn of respawns) {
        const minLocation = LocalPoint.fromWorld(client, treeRespawn.getWorldLocation());
        if (minLocation == null) continue;
        const centeredLocation = new LocalPoint(
          minLocation.getX() + treeRespawn.getLenX() * LOCAL_HALF_TILE_SIZE,
          minLocation.getY() + treeRespawn.getLenY() * LOCAL_HALF_TILE_SIZE);
        const percent = (now - treeRespawn.getStartTime()) / treeRespawn.getRespawnTime();
        const point = Perspective.localToCanvas(client, centeredLocation, client.getPlane());
        if (point == null || percent > 1.0) continue;
        const ppc = new ProgressPieComponent();
        ppc.setBorderColor(Color.ORANGE);
        ppc.setFill(Color.YELLOW);
        ppc.setPosition(point);
        ppc.setProgress(percent);
        ppc.render(graphics);
      }
    }
  }

  // ---------------------------------------------------------------- WoodcuttingPlugin
  const WOOD_CUT_PATTERN = /^You get (?:some|an)[\w ]+(?:logs?|mushrooms)\.$/;
  class WoodcuttingPlugin {
    constructor() {
      this.config = rl.configProxy('woodcutting', () => this.configItems);
      this.session = null;
      this.respawns = [];
      this.felling = new Map(); // (2007: tile -> a tree that just despawned / its stump that just spawned)
      this.overlay = new WoodcuttingOverlay(this);
      this.treesOverlay = new WoodcuttingSceneOverlay(this);
    }
    getSession() { return this.session; }
    getRespawns() { return this.respawns; }
    resetSession() { this.session = null; }
    startUp() {
      if (ll.appWant) ll.appWant('woodcutting', true);
      rl.overlayManager.add(this.overlay);
      rl.overlayManager.add(this.treesOverlay);
    }
    shutDown() {
      if (ll.appWant) ll.appWant('woodcutting', false);
      rl.overlayManager.remove(this.overlay);
      rl.overlayManager.remove(this.treesOverlay);
      this.respawns = [];
      this.felling.clear();
      this.session = null;
    }
    onGameTick() {
      this.respawns = this.respawns.filter((r) => !r.isExpired());
      if (this.session == null || this.session.getLastChopping() == null) return;
      if (WOODCUTTING_ANIMS.has(client.getLocalPlayer().getAnimation()) || serverSkilling('woodcutting')) {
        this.session.setLastChopping();
        return;
      }
      const statTimeout = this.config.statTimeout() * 60000;
      const sinceCut = Date.now() - this.session.getLastChopping();
      if (sinceCut >= statTimeout) this.session.setActive(false);
    }
    onChatMessage(event) {
      const t = event.getType();
      if (t !== 'SPAM' && t !== 'GAMEMESSAGE' && t !== 'MESBOX') return;
      const msg = event.getMessage();
      if (WOOD_CUT_PATTERN.test(msg)) {
        if (this.session == null) this.session = new WoodcuttingSession();
        this.session.setLastChopping();
        this.session.incrementLogsCut();
      }
      if (msg.includes("A bird's nest falls out of the tree")) {
        // (no clue nests in 2007: every nest notifies)
        if (this.config.showNestNotification()) rl.notifier.notify('A bird nest has spawned!');
      }
    }
    // (2007, in place of ADD_OVERLAYTIMER_LOC: a tree replaced by its stump on the same tick; the stump turning back ends it)
    onGameObjectDespawned(event) {
      const object = event.getGameObject();
      const id = object.getId();
      if (T.STUMPS.includes(id)) {
        const w = object.getWorldLocation();
        this.respawns = this.respawns.filter((r) => !r.getWorldLocation().equals(w));
      }
      const r = T.TREE_RESPAWNS[id];
      if (r) this.pair(object, { stump: r[0], ticks: r[1] }, null);
    }
    onGameObjectSpawned(event) {
      const object = event.getGameObject();
      if (T.STUMPS.includes(object.getId())) this.pair(object, null, object.getId());
    }
    pair(object, tree, stumpId) {
      const point = object.getWorldLocation();
      const key = `${point.getX()},${point.getY()},${point.getPlane()}`;
      const now = Date.now();
      let p = this.felling.get(key);
      if (!p || now - p.time > GAME_TICK_LENGTH) p = { time: now };
      for (const [k, v] of this.felling) if (now - v.time > GAME_TICK_LENGTH) this.felling.delete(k);
      if (tree) { p.tree = tree; p.object = object; }
      if (stumpId != null) p.stumpId = stumpId;
      if (p.tree && p.stumpId === p.tree.stump) {
        this.felling.delete(key);
        // TreeRespawn(worldPoint, sizeX - 1, sizeY - 1, ...) of the tree on the tile
        const o = p.object;
        this.respawns.push(new TreeRespawn(point, o.getSizeX() - 1, o.getSizeY() - 1, now, p.tree.ticks * GAME_TICK_LENGTH));
      } else this.felling.set(key, p);
    }
    onGameStateChanged(event) {
      const s = event.getGameState();
      if (s === 'LOGIN_SCREEN' || s === 'HOPPING') this.respawns = [];
    }
  }

  const plugin = new WoodcuttingPlugin();
  ll.__woodcutting = { plugin, WOODCUTTING_ANIMS };
  rl.registerPlugin('woodcutting', plugin);
})();
