// RuneLite's Mining plugin, cloned from net.runelite.client.plugins.mining (BSD 2-Clause, Copyright (c) 2019, Adam
// <Adam@sigterm.info>, (c) 2020, Jordan Zomerlei and RuneLite contributors): MiningPlugin, MiningOverlay,
// MiningRocksOverlay, MiningSession, Rock, RockRespawn, MiningAnimation (rocks.js, app/tools/runelite/mining.py).
// Trimmed for Sept 2007: no Daeyalt essence (its hint arrow), Arceuus dense essence, Motherlode Mine (its upper floor
// test), amethyst, Camdozaal or star rocks, so every respawn is Rock.ROCK.
// The respawn's start and length: RuneLite reads them from ADD_OVERLAYTIMER_LOC, which Jagex's server calls since 2023;
// the 2007 server sends no timer, so a rock that despawns as its depleted loc spawns on the same tile starts one with
// the ticks the server's mining data gives that rock (rocks.js), and the timer ends when the rock is back.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl || !ll.miningRocks) return;
  const { client, Skill, Color, LineComponent, TitleComponent, Overlay, OverlayPanel, OverlayPosition, OverlayLayer, LocalPoint, Perspective, ProgressPieComponent } = rl;
  // 2006RS-2: server data: the server says when an action in a skill is going on (::appidle, engine Player.appIdleTick;
  // the runtime's ll.appSkilling), so this needn't rest on the animation alone
  const serverSkilling = (skill) => !!(ll.appSkilling && ll.appSkilling(skill));
  const R = ll.miningRocks;
  const GAME_TICK_LENGTH = 600;

  const MiningAnimation = {
    MINING_ANIMATIONS: new Set(R.MINING_ANIMATIONS),
    WAll_ANIMATIONS: new Set(R.WALL_ANIMATIONS),
  };

  // Rock (zOffset)
  const Rock = { ROCK: { name: 'ROCK', getZOffset: () => 0 } };

  class RockRespawn {
    constructor(rock, worldPoint, startTime, respawnTime, zOffset) {
      this.rock = rock; this.worldPoint = worldPoint; this.startTime = startTime; this.respawnTime = respawnTime; this.zOffset = zOffset;
    }
    getRock() { return this.rock; }
    getWorldPoint() { return this.worldPoint; }
    getStartTime() { return this.startTime; }
    getRespawnTime() { return this.respawnTime; }
    getZOffset() { return this.zOffset; }
    isExpired() { return Date.now() > this.startTime + this.respawnTime; }
  }

  class MiningSession {
    constructor() { this.lastMined = null; }
    getLastMined() { return this.lastMined; }
    setLastMined() { this.lastMined = Date.now(); }
  }

  // ---------------------------------------------------------------- MiningOverlay
  const MINING_RESET = 'Reset';
  class MiningOverlay extends OverlayPanel {
    constructor(plugin) {
      super(plugin);
      this.setPosition(OverlayPosition.TOP_LEFT);
      this.plugin = plugin; this.config = plugin.config;
      this.addMenuEntry('RUNELITE_OVERLAY_CONFIG', 'Configure', 'Mining overlay');
      this.addMenuEntry('RUNELITE_OVERLAY', MINING_RESET, 'Mining overlay', () => plugin.setSession(null));
    }
    render(graphics) {
      const session = this.plugin.getSession();
      if (session == null || session.getLastMined() == null || !this.config.showMiningStats()) return null;
      const currentAnim = client.getLocalPlayer().getAnimation();
      const ch = this.panelComponent.getChildren();
      if (serverSkilling('mining') || (this.plugin.isMining()
        && (MiningAnimation.MINING_ANIMATIONS.has(currentAnim)
          // when receiving ore from a wall the animation sets to -1 before starting up again
          || (MiningAnimation.WAll_ANIMATIONS.has(this.plugin.getLastActionAnimationId())
            && this.plugin.getLastAnimationChange() > Date.now() - 1800)))) {
        ch.push(TitleComponent.builder().text('Mining').color(Color.GREEN).build());
      } else {
        ch.push(TitleComponent.builder().text('NOT mining').color(Color.RED).build());
      }
      const actions = rl.xpTrackerService.getActions(Skill.MINING);
      if (actions > 0) {
        ch.push(LineComponent.builder().left('Total mined:').right(String(actions)).build());
        if (actions > 2) ch.push(LineComponent.builder().left('Mined/hr:').right(String(rl.xpTrackerService.getActionsHr(Skill.MINING))).build());
      }
      return super.render(graphics);
    }
  }

  // ---------------------------------------------------------------- MiningRocksOverlay
  class MiningRocksOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_SCENE);
      this.plugin = plugin;
    }
    render(graphics) {
      const respawns = this.plugin.getRespawns();
      if (respawns.length === 0) return null;
      const now = Date.now();
      for (const rockRespawn of respawns) {
        const loc = LocalPoint.fromWorld(client, rockRespawn.getWorldPoint());
        if (loc == null) continue;
        const percent = (now - rockRespawn.getStartTime()) / rockRespawn.getRespawnTime();
        const point = Perspective.localToCanvas(client, loc, client.getPlane(), rockRespawn.getZOffset());
        if (point == null || percent > 1.0) continue;
        const ppc = new ProgressPieComponent();
        ppc.setBorderColor(Color.ORANGE);
        ppc.setFill(Color.YELLOW);
        ppc.setPosition(point);
        ppc.setProgress(percent);
        ppc.render(graphics);
      }
      return null;
    }
  }

  // ---------------------------------------------------------------- MiningPlugin
  const MINING_PATTERN = /^You swing your pick at the (?:rock|star|deposit)(?:\.|!)$/;
  class MiningPlugin {
    constructor() {
      this.config = rl.configProxy('mining', () => this.configItems);
      this.session = null;
      this.respawns = [];
      this.mining = false;
      this.lastAnimationChange = 0;
      this.lastActionAnimationId = -1;
      this.depleting = new Map(); // (2007: tile -> a rock that just despawned / its depleted loc that just spawned)
      this.overlay = new MiningOverlay(this);
      this.rocksOverlay = new MiningRocksOverlay(this);
    }
    getSession() { return this.session; }
    setSession(s) { this.session = s; }
    getRespawns() { return this.respawns; }
    isMining() { return this.mining; }
    getLastAnimationChange() { return this.lastAnimationChange; }
    getLastActionAnimationId() { return this.lastActionAnimationId; }
    startUp() {
      if (ll.appWant) ll.appWant('mining', true);
      rl.overlayManager.add(this.overlay);
      rl.overlayManager.add(this.rocksOverlay);
    }
    shutDown() {
      if (ll.appWant) ll.appWant('mining', false);
      this.session = null;
      this.mining = false;
      rl.overlayManager.remove(this.overlay);
      rl.overlayManager.remove(this.rocksOverlay);
      this.respawns.length = 0;
      this.depleting.clear();
    }
    onGameStateChanged(event) {
      if (event.getGameState() === 'HOPPING') this.respawns.length = 0;
    }
    onAnimationChanged(event) {
      const local = client.getLocalPlayer();
      const actor = event.getActor();
      if (!local || !actor || !actor.equals(local)) return;
      this.lastAnimationChange = Date.now();
      const animId = local.getAnimation();
      if (animId !== -1) this.lastActionAnimationId = animId;
      // (Arceuus dense essence chiselling is later)
      this.mining = this.mining || MiningAnimation.MINING_ANIMATIONS.has(animId);
    }
    onGameTick() {
      this.clearExpiredRespawns();
      if (this.session == null || this.session.getLastMined() == null) return;
      if ((this.mining && MiningAnimation.MINING_ANIMATIONS.has(client.getLocalPlayer().getAnimation())) || serverSkilling('mining')) {
        this.session.setLastMined();
        return;
      }
      const statTimeout = this.config.statTimeout() * 60000;
      const sinceMined = Date.now() - this.session.getLastMined();
      if (sinceMined >= statTimeout) this.resetSession();
    }
    clearExpiredRespawns() {
      this.respawns = this.respawns.filter((r) => !r.isExpired());
    }
    resetSession() {
      this.session = null;
      this.mining = false;
    }
    // (2007, in place of ADD_OVERLAYTIMER_LOC: a rock replaced by its depleted loc on the same tick)
    onGameObjectDespawned(event) {
      const object = event.getGameObject();
      // (the depleted loc turning back into the rock ends its timer: the server scales the ticks by player count)
      if (R.DEPLETED.includes(object.getId())) {
        const w = object.getWorldLocation();
        this.respawns = this.respawns.filter((r) => !r.getWorldPoint().equals(w));
      }
      const r = R.ROCK_RESPAWNS[object.getId()];
      if (!r) return;
      this.pair(object.getWorldLocation(), { depleted: r[0], ticks: r[1] }, null);
    }
    onGameObjectSpawned(event) {
      const object = event.getGameObject();
      if (!R.DEPLETED.includes(object.getId())) return;
      this.pair(object.getWorldLocation(), null, object.getId());
    }
    pair(point, rock, depletedId) {
      const key = `${point.getX()},${point.getY()},${point.getPlane()}`;
      const now = Date.now();
      let p = this.depleting.get(key);
      if (!p || now - p.time > GAME_TICK_LENGTH) p = { time: now };
      for (const [k, v] of this.depleting) if (now - v.time > GAME_TICK_LENGTH) this.depleting.delete(k);
      if (rock) p.rock = rock;
      if (depletedId != null) p.depletedId = depletedId;
      if (p.rock && p.depletedId === p.rock.depleted) {
        this.depleting.delete(key);
        this.addRockRespawn(Rock.ROCK, point, p.rock.ticks);
      } else this.depleting.set(key, p);
    }
    onChatMessage(event) {
      if (event.getType() === 'SPAM' || event.getType() === 'GAMEMESSAGE') {
        if (MINING_PATTERN.test(event.getMessage())) {
          if (this.session == null) this.session = new MiningSession();
          this.session.setLastMined();
        }
      }
    }
    addRockRespawn(rock, point, ticks) {
      this.respawns.push(new RockRespawn(rock, point, Date.now(), ticks * GAME_TICK_LENGTH, rock.getZOffset()));
    }
  }

  const plugin = new MiningPlugin();
  ll.__mining = { plugin, Rock, MiningAnimation };
  rl.registerPlugin('mining', plugin);
})();
