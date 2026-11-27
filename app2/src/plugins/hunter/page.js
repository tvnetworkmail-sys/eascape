// RuneLite's Hunter plugin, cloned from net.runelite.client.plugins.hunter (BSD 2-Clause, Copyright (c) 2017,
// Robin Weymans <Robin.weymans@gmail.com> and RuneLite contributors): HunterPlugin, HunterTrap, TrapOverlay.
// 2007 (Hunter, 27 Nov 2006): our server's trap locs are its own (content/scripts/skill_hunter: 2009scape's loc ids,
// 19174-19681, some of which OSRS later gave to other locs), so RuneLite's ObjectID cases take the server loc with the same role.
// Era-trim: no crab traps (2025), maniacal monkeys (2014), jerboas / letveks / pyre foxes / tecu salamanders (Varlamore),
// no black chinchompas (2010; our "carnivorous" chinchompa is the 2007 red one).
// Net traps: our server bends the young tree on its own tile (the catching / caught / failed locs replace it there)
// and lays the net beside it, so the trap is the tree's tile, laid from the tile next to it (RuneLite: the net loc's
// tile, translated for south / west facing traps, laid from that tile). Our net traps fail as their own failed loc
// (RuneLite has a failed loc only for the tecu salamander), which is EMPTY here as RuneLite's.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Overlay, OverlayPosition, OverlayLayer, LocalPoint, Perspective, ProgressPieComponent, ColorUtil } = rl;

  // ObjectID (our server's locs, content/scripts/skill_hunter/configs/hunter.loc: the client's ids are the names' numbers)
  const O = {
    HUNTING_OJIBWAY_TRAP: 19175, HUNTING_OJIBWAY_TRAP_BROKEN: 19174,
    HUNTING_OJIBWAY_TRAP_TRAPPING_COLOURED: 19177, HUNTING_OJIBWAY_TRAP_FULL_COLOURED: 19178,
    HUNTING_OJIBWAY_TRAP_TRAPPING_JUNGLE: 19179, HUNTING_OJIBWAY_TRAP_FULL_JUNGLE: 19180,
    HUNTING_OJIBWAY_TRAP_TRAPPING_POLAR: 19181, HUNTING_OJIBWAY_TRAP_FULL_POLAR: 19182,
    HUNTING_OJIBWAY_TRAP_TRAPPING_DESERT: 19183, HUNTING_OJIBWAY_TRAP_FULL_DESERT: 19184,
    HUNTING_OJIBWAY_TRAP_TRAPPING_WOODLAND: 19185, HUNTING_OJIBWAY_TRAP_FULL_WOODLAND: 19186,
    HUNTING_BOXTRAP_EMPTY: 19187, HUNTING_BOXTRAP_TRAPPING: 19188, // box_trap_catching (RuneLite: one per creature and side)
    HUNTING_BOXTRAP_FULL_FERRET: 19189, HUNTING_BOXTRAP_FULL_CHINCHOMPA: 19190, HUNTING_BOXTRAP_FULL_CHINCHOMPA_BIG: 19191,
    HUNTING_BOXTRAP_FAILED: 19192,
    HUNTING_IMPTRAP_EMPTY: 19223, HUNTING_IMPTRAP_FAILED: 19224, HUNTING_IMPTRAP_TRAPPING: 19225, HUNTING_IMPTRAP_FULL: 19226,
    HUNTING_DEADFALL_BOULDER: 19205, HUNTING_DEADFALL_TRAP: 19206,
    HUNTING_DEADFALL_TRAPPING_SPIKE: 19207, HUNTING_DEADFALL_TRAPPING_SPIKE_M: 19208, HUNTING_DEADFALL_TRAPPING_SABRE: 19209,
    HUNTING_DEADFALL_TRAPPING_SABRE_M: 19210, HUNTING_DEADFALL_TRAPPING_BARBED: 19211, HUNTING_DEADFALL_TRAPPING_BARBED_M: 19212,
    HUNTING_DEADFALL_TRAPPING_CLAW: 19213, HUNTING_DEADFALL_TRAPPING_CLAW_M: 19214,
    HUNTING_DEADFALL_FULL_SPIKE: 19215, HUNTING_DEADFALL_FULL_SABRE: 19216, HUNTING_DEADFALL_FULL_BARBED: 19217, HUNTING_DEADFALL_FULL_CLAW: 19218,
    // net traps: young tree (UP), bent (NET_SET), failing, failed, catching, caught; swamp (green), orange, red, black
    HUNTING_SAPLING_UP_SWAMP: 19679, HUNTING_SAPLING_NET_SET_SWAMP: 19678, HUNTING_SAPLING_FAILING_SWAMP: 19676,
    HUNTING_SAPLING_FAILED_SWAMP: 19677, HUNTING_SAPLING_CATCHING_GREEN: 19674, HUNTING_SAPLING_FULL_GREEN: 19675,
    HUNTING_SAPLING_UP_ORANGE: 19652, HUNTING_SAPLING_NET_SET_ORANGE: 19650, HUNTING_SAPLING_FAILING_ORANGE: 19657,
    HUNTING_SAPLING_FAILED_ORANGE: 19656, HUNTING_SAPLING_CATCHING_ORANGE: 19655, HUNTING_SAPLING_FULL_ORANGE: 19654,
    HUNTING_SAPLING_UP_RED: 19663, HUNTING_SAPLING_NET_SET_RED: 19662, HUNTING_SAPLING_FAILING_RED: 19660,
    HUNTING_SAPLING_FAILED_RED: 19661, HUNTING_SAPLING_CATCHING_RED: 19658, HUNTING_SAPLING_FULL_RED: 19659,
    HUNTING_SAPLING_UP_BLACK: 19671, HUNTING_SAPLING_NET_SET_BLACK: 19670, HUNTING_SAPLING_FAILING_BLACK: 19668,
    HUNTING_SAPLING_FAILED_BLACK: 19669, HUNTING_SAPLING_CATCHING_BLACK: 19666, HUNTING_SAPLING_FULL_BLACK: 19667,
  };
  const PLACE_NEAR = [O.HUNTING_DEADFALL_TRAP];
  const PLACE_ON = [O.HUNTING_IMPTRAP_EMPTY, O.HUNTING_BOXTRAP_EMPTY, O.HUNTING_OJIBWAY_TRAP];
  const PLACE_NET = [O.HUNTING_SAPLING_NET_SET_SWAMP, O.HUNTING_SAPLING_NET_SET_ORANGE, O.HUNTING_SAPLING_NET_SET_RED, O.HUNTING_SAPLING_NET_SET_BLACK];
  const CAUGHT = [O.HUNTING_IMPTRAP_FULL, O.HUNTING_BOXTRAP_FULL_CHINCHOMPA, O.HUNTING_BOXTRAP_FULL_CHINCHOMPA_BIG, O.HUNTING_BOXTRAP_FULL_FERRET,
    O.HUNTING_DEADFALL_FULL_SPIKE, O.HUNTING_DEADFALL_FULL_SABRE, O.HUNTING_DEADFALL_FULL_BARBED, O.HUNTING_DEADFALL_FULL_CLAW,
    O.HUNTING_OJIBWAY_TRAP_FULL_JUNGLE, O.HUNTING_OJIBWAY_TRAP_FULL_POLAR, O.HUNTING_OJIBWAY_TRAP_FULL_DESERT, O.HUNTING_OJIBWAY_TRAP_FULL_WOODLAND,
    O.HUNTING_OJIBWAY_TRAP_FULL_COLOURED, O.HUNTING_SAPLING_FULL_GREEN, O.HUNTING_SAPLING_FULL_RED, O.HUNTING_SAPLING_FULL_ORANGE,
    O.HUNTING_SAPLING_FULL_BLACK];
  const FAILED = [O.HUNTING_IMPTRAP_FAILED, O.HUNTING_BOXTRAP_FAILED, O.HUNTING_OJIBWAY_TRAP_BROKEN, O.HUNTING_DEADFALL_BOULDER,
    O.HUNTING_SAPLING_FAILED_SWAMP, O.HUNTING_SAPLING_FAILED_ORANGE, O.HUNTING_SAPLING_FAILED_RED, O.HUNTING_SAPLING_FAILED_BLACK];
  const TRANSITION = [O.HUNTING_IMPTRAP_TRAPPING, O.HUNTING_BOXTRAP_TRAPPING,
    O.HUNTING_OJIBWAY_TRAP_TRAPPING_COLOURED, O.HUNTING_OJIBWAY_TRAP_TRAPPING_JUNGLE, O.HUNTING_OJIBWAY_TRAP_TRAPPING_POLAR,
    O.HUNTING_OJIBWAY_TRAP_TRAPPING_DESERT, O.HUNTING_OJIBWAY_TRAP_TRAPPING_WOODLAND,
    O.HUNTING_DEADFALL_TRAPPING_SPIKE, O.HUNTING_DEADFALL_TRAPPING_SPIKE_M, O.HUNTING_DEADFALL_TRAPPING_SABRE, O.HUNTING_DEADFALL_TRAPPING_SABRE_M,
    O.HUNTING_DEADFALL_TRAPPING_BARBED, O.HUNTING_DEADFALL_TRAPPING_BARBED_M, O.HUNTING_DEADFALL_TRAPPING_CLAW, O.HUNTING_DEADFALL_TRAPPING_CLAW_M,
    O.HUNTING_SAPLING_CATCHING_GREEN, O.HUNTING_SAPLING_FAILING_SWAMP, O.HUNTING_SAPLING_CATCHING_ORANGE, O.HUNTING_SAPLING_FAILING_ORANGE,
    O.HUNTING_SAPLING_CATCHING_RED, O.HUNTING_SAPLING_FAILING_RED, O.HUNTING_SAPLING_CATCHING_BLACK, O.HUNTING_SAPLING_FAILING_BLACK];
  const YOUNG_TREES = [O.HUNTING_SAPLING_UP_ORANGE, O.HUNTING_SAPLING_UP_RED, O.HUNTING_SAPLING_UP_BLACK, O.HUNTING_SAPLING_UP_SWAMP];

  const State = { OPEN: 'OPEN', EMPTY: 'EMPTY', FULL: 'FULL', TRANSITION: 'TRANSITION', NOT_PLACED: 'NOT_PLACED' };
  class HunterTrap {
    constructor(gameObject, worldLocation) {
      this.state = State.OPEN;
      this.placedOn = Date.now();
      this.objectId = gameObject.getId();
      this.worldLocation = worldLocation || gameObject.getWorldLocation();
      this.varbitId = -1;
      this.ignoreTimer = false;
    }
    getPlacedOn() { return this.placedOn; }
    getState() { return this.state; }
    setState(s) { this.state = s; }
    getObjectId() { return this.objectId; }
    getWorldLocation() { return this.worldLocation; }
    getVarbitId() { return this.varbitId; }
    isIgnoreTimer() { return this.ignoreTimer; }
    setIgnoreTimer(b) { this.ignoreTimer = b; }
    getTrapTimeRelative() {
      const duration = Date.now() - this.placedOn;
      return duration < HunterTrap.TRAP_TIME ? duration / HunterTrap.TRAP_TIME : 1;
    }
    resetTimer() { this.placedOn = Date.now(); }
  }
  HunterTrap.TRAP_TIME = 60000;
  HunterTrap.State = State;

  const TIMER_LOW = 0.25; // When the timer is under a quarter left, if turns red.
  class TrapOverlay extends Overlay {
    constructor(plugin, config) {
      super(plugin);
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_SCENE);
      this.plugin = plugin; this.config = config;
    }
    render(graphics) { this.drawTraps(graphics); return null; }
    updateConfig() {
      const half = (c) => ColorUtil.colorWithAlpha(c, Math.trunc(c.getAlpha() / 2.5));
      this.colorEmptyBorder = this.config.getEmptyTrapColor(); this.colorEmpty = half(this.colorEmptyBorder);
      this.colorFullBorder = this.config.getFullTrapColor(); this.colorFull = half(this.colorFullBorder);
      this.colorOpenBorder = this.config.getOpenTrapColor(); this.colorOpen = half(this.colorOpenBorder);
      this.colorTransBorder = this.config.getTransTrapColor(); this.colorTrans = half(this.colorTransBorder);
    }
    drawTraps(graphics) {
      for (const trap of this.plugin.getTraps().values()) {
        switch (trap.getState()) {
          case State.OPEN: this.drawTimerOnTrap(graphics, trap, this.colorOpen, this.colorOpenBorder, this.colorEmpty, this.colorOpenBorder); break;
          case State.EMPTY: this.drawTimerOnTrap(graphics, trap, this.colorEmpty, this.colorEmptyBorder, this.colorEmpty, this.colorEmptyBorder); break;
          case State.FULL: this.drawTimerOnTrap(graphics, trap, this.colorFull, this.colorFullBorder, this.colorFull, this.colorFullBorder); break;
          case State.TRANSITION: this.drawCircleOnTrap(graphics, trap, this.colorTrans, this.colorTransBorder); break;
          default: break;
        }
      }
    }
    drawTimerOnTrap(graphics, trap, fill, border, fillTimeLow, borderTimeLow) {
      if (trap.getWorldLocation().getPlane() !== client.getPlane()) return;
      const localLoc = LocalPoint.fromWorld(client, trap.getWorldLocation());
      if (localLoc == null) return;
      const loc = Perspective.localToCanvas(client, localLoc, client.getPlane());
      if (loc == null) return;
      if (trap.isIgnoreTimer()) { this.drawCircleOnTrap(graphics, trap, fill, border); return; }
      const timeLeft = 1 - trap.getTrapTimeRelative();
      const pie = new ProgressPieComponent();
      pie.setFill(timeLeft > TIMER_LOW ? fill : fillTimeLow);
      pie.setBorderColor(timeLeft > TIMER_LOW ? border : borderTimeLow);
      pie.setPosition(loc);
      pie.setProgress(timeLeft);
      pie.render(graphics);
    }
    drawCircleOnTrap(graphics, trap, fill, border) {
      if (trap.getWorldLocation().getPlane() !== client.getPlane()) return;
      const localLoc = LocalPoint.fromWorld(client, trap.getWorldLocation());
      if (localLoc == null) return;
      const loc = Perspective.localToCanvas(client, localLoc, client.getPlane());
      if (loc == null) return;
      const pie = new ProgressPieComponent();
      pie.setFill(fill);
      pie.setBorderColor(border);
      pie.setPosition(loc);
      pie.setProgress(1);
      pie.render(graphics);
    }
  }

  const key = (wp) => `${wp.getX()},${wp.getY()},${wp.getPlane()}`;
  class HunterPlugin {
    constructor() {
      this.configGroup = 'hunterplugin';
      this.config = rl.configProxy(this.configGroup, () => this.configItems);
      this.overlay = new TrapOverlay(this, this.config);
      this.traps = new Map(); // WorldPoint key -> HunterTrap
      this.lastTickLocalPlayerLocation = null;
    }
    getTraps() { return this.traps; }
    startUp() {
      rl.overlayManager.add(this.overlay);
      this.overlay.updateConfig();
    }
    shutDown() {
      rl.overlayManager.remove(this.overlay);
      this.traps.clear();
    }
    onGameObjectSpawned(event) {
      const gameObject = event.getGameObject();
      const trapLocation = gameObject.getWorldLocation();
      const myTrap = this.traps.get(key(trapLocation));
      const localPlayer = client.getLocalPlayer();
      const id = gameObject.getId();
      if (localPlayer == null) return;
      if (PLACE_NEAR.includes(id)) {
        // If player is right next to "object" trap assume that player placed the trap
        if (localPlayer.getWorldLocation().distanceTo(trapLocation) <= 2) this.traps.set(key(trapLocation), new HunterTrap(gameObject));
      } else if (PLACE_ON.includes(id)) {
        // If the player is on that tile, assume he is the one that placed the trap. A player can move and set up a
        // trap in the same tick, so this compares to the player's location on the last tick.
        if (this.lastTickLocalPlayerLocation != null && trapLocation.distanceTo(this.lastTickLocalPlayerLocation) === 0) {
          this.traps.set(key(trapLocation), new HunterTrap(gameObject));
        }
      } else if (PLACE_NET.includes(id)) {
        // 2007: the bent tree on its own tile, laid from the tile next to it
        if (this.lastTickLocalPlayerLocation != null && trapLocation.distanceTo(this.lastTickLocalPlayerLocation) <= 1) {
          this.traps.set(key(trapLocation), new HunterTrap(gameObject));
        }
      } else if (CAUGHT.includes(id)) {
        if (myTrap != null) { myTrap.setState(State.FULL); myTrap.resetTimer(); }
      } else if (FAILED.includes(id)) {
        if (myTrap != null) { myTrap.setState(State.EMPTY); myTrap.resetTimer(); }
      } else if (TRANSITION.includes(id)) {
        if (myTrap != null) myTrap.setState(State.TRANSITION);
      }
    }
    /** Removes the traps that are gone from the local player's trap collection. */
    onGameTick() {
      const tiles = client.getScene().getTiles();
      const expire = Date.now() - HunterTrap.TRAP_TIME * 2;
      for (const [k, trap] of [...this.traps]) {
        const world = trap.getWorldLocation();
        const local = LocalPoint.fromWorld(client, world);
        // Not within the client's viewport
        if (local == null) {
          // Cull very old traps
          if (trap.getPlacedOn() < expire) this.traps.delete(k);
          continue;
        }
        const tile = tiles[world.getPlane()][local.getSceneX()][local.getSceneY()];
        let containsBoulder = false; let containsAnything = false; let containsYoungTree = false;
        for (const object of tile.getGameObjects()) {
          if (object == null) continue;
          containsAnything = true;
          if (object.getId() === O.HUNTING_DEADFALL_BOULDER) { containsBoulder = true; break; }
          // young trees (salamanders): otherwise the timers never disappear after a trap is dismantled
          if (YOUNG_TREES.includes(object.getId())) containsYoungTree = true;
        }
        if (!containsAnything || containsYoungTree) this.traps.delete(k);
        else if (containsBoulder) this.traps.delete(k); // deadfalls: when the trap is gone the boulder is still there
      }
      const lp = client.getLocalPlayer();
      if (lp != null) this.lastTickLocalPlayerLocation = lp.getWorldLocation();
    }
    onConfigChanged(event) {
      if (event.getGroup() === 'hunterplugin') this.overlay.updateConfig();
    }
  }

  const plugin = new HunterPlugin();
  ll.__hunter = { plugin, HunterTrap, ObjectID: O };
  rl.registerPlugin('hunter', plugin);
})();
