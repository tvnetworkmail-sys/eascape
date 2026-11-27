// RuneLite's Player-owned House plugin, cloned from net.runelite.client.plugins.poh (BSD 2-Clause, Copyright (c) 2018,
// Seth <Sethtroll3@gmail.com> and RuneLite contributors): PohPlugin, PohConfig, PohOverlay, BurnerOverlay, PohIcons,
// IncenseBurner (icons: RuneLite's resources).
// Era-trim (Construction as of Sep 2007): the portal chamber's seven portals (Varrock, Lumbridge, Falador, Camelot, Ardougne,
// Yanille, Kharyrll), the chapel altars, mounted glory, armour repair stand, exit portal and incense burners (three
// tiers; 2007 has no fourth). Later furniture (pools, spellbook altars, jewellery box, fairy ring / spirit tree / obelisk,
// portal nexus, digsite pendant, Xeric's talisman, mythical cape) and their settings are left out.
// 2007 loc ids from the 2007 cache: the same as OSRS's for the altars, burners, glory and the Varrock .. Yanille portals;
// Kharyrll is 13621 / 13628 / 13635 (OSRS renumbered it), the exit portal 13405 and the repair stand 13715.
// The burner timer for another player needs Jagex's hiscores (left out: only your own lighting sets the timer).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Overlay, OverlayPosition, OverlayLayer, Perspective, Color, ProgressPieComponent, Player, Skill, GameState } = rl;
  const GROUP = 'poh';
  const ObjectID = {
    POH_TORCH_5: 13208, POH_TORCH_5_LIT: 13209, POH_TORCH_6: 13210, POH_TORCH_6_LIT: 13211, POH_TORCH_7: 13212, POH_TORCH_7_LIT: 13213,
  };
  const AnimationID = { HUMAN_LIGHT_TORCH: 3687 };
  const GAME_TICK_LENGTH = 600;

  // PohIcons
  const PohIcons = {};
  const ICON_LIST = [
    ['EXITPORTAL', 'exitportal', [13405]],
    ['VARROCK', 'varrock', [13615, 13622, 13629]],
    ['FALADOR', 'falador', [13617, 13624, 13631]],
    ['LUMBRIDGE', 'lumbridge', [13616, 13623, 13630]],
    ['ARDOUGNE', 'ardougne', [13619, 13626, 13633]],
    ['YANILLE', 'yanille', [13620, 13627, 13634]],
    ['CAMELOT', 'camelot', [13618, 13625, 13632]],
    ['KHARYLL', 'kharyll', [13621, 13628, 13635]],
    ['ALTAR', 'altar', [13179, 13180, 13181, 13182, 13183, 13184, 13185, 13186, 13187, 13188, 13189, 13190, 13191, 13192, 13193, 13194, 13196, 13197, 13198, 13199]],
    ['GLORY', 'glory', [13523]],
    ['REPAIR', 'repair', [13715]],
  ];
  const minimapIcons = new Map();
  for (const [name, imageResource, ids] of ICON_LIST) {
    PohIcons[name] = { name, imageResource, ids, getImageResource: () => imageResource, getIds: () => ids,
      getImage() { return plugin.resources ? plugin.resources[imageResource + '.png'] || null : null; }, toString: () => name };
    for (const id of ids) minimapIcons.set(id, PohIcons[name]);
  }
  PohIcons.getIcon = (id) => minimapIcons.get(id) || null;

  class IncenseBurner {
    constructor() { this.start = null; this.lit = false; this.countdownTimer = 0; this.randomTimer = 0; this.end = null; }
    getStart() { return this.start; } setStart(v) { this.start = v; }
    isLit() { return this.lit; } setLit(v) { this.lit = v; }
    getCountdownTimer() { return this.countdownTimer; } setCountdownTimer(v) { this.countdownTimer = v; }
    getRandomTimer() { return this.randomTimer; } setRandomTimer(v) { this.randomTimer = v; }
    getEnd() { return this.end; } setEnd(v) { this.end = v; }
    reset() { this.countdownTimer = 0; this.randomTimer = 0; }
  }

  class PohOverlay extends Overlay {
    constructor(plugin, config) {
      super(plugin);
      this.plugin = plugin; this.config = config;
      this.iconList = [];
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_WIDGETS);
    }
    getIconList() { return this.iconList; }
    render(graphics) {
      const player = client.getLocalPlayer();
      if (player == null) return null;
      const localLocation = player.getLocalLocation();
      this.plugin.getPohObjects().forEach((tile, object) => {
        const location = object.getLocalLocation();
        if (tile.getPlane() === client.getPlane() && location && localLocation.distanceTo(location) <= MAX_DISTANCE) {
          const icon = PohIcons.getIcon(object.getId());
          if (icon != null && this.iconList.includes(icon)) {
            const image = icon.getImage();
            if (!image || !image.width) return;
            const minimapLoc = Perspective.getMiniMapImageLocation(client, object.getLocalLocation(), image);
            if (minimapLoc != null) graphics.drawImage(image, minimapLoc.getX(), minimapLoc.getY());
          }
        }
      });
      return null;
    }
    updateConfig() {
      const c = this.config;
      this.iconList.length = 0;
      if (c.showPortals()) this.iconList.push(...PORTALS);
      if (c.showAltar()) this.iconList.push(PohIcons.ALTAR);
      if (c.showGlory()) this.iconList.push(PohIcons.GLORY);
      if (c.showRepairStand()) this.iconList.push(PohIcons.REPAIR);
      if (c.showExitPortal()) this.iconList.push(PohIcons.EXITPORTAL);
    }
  }
  const PORTALS = [PohIcons.LUMBRIDGE, PohIcons.FALADOR, PohIcons.VARROCK, PohIcons.CAMELOT, PohIcons.ARDOUGNE, PohIcons.YANILLE, PohIcons.KHARYLL];
  const MAX_DISTANCE = 2350;

  class BurnerOverlay extends Overlay {
    constructor(plugin, config) {
      super(plugin);
      this.plugin = plugin; this.config = config;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_SCENE);
    }
    render(graphics) {
      if (!this.config.showBurner()) return null;
      this.plugin.getIncenseBurners().forEach(({ tile, burner }) => {
        if (tile.getPlane() !== client.getPlane() || !burner.isLit()) return;
        const now = Date.now();
        const startCountdown = Math.trunc((now - burner.getStart()) / 1000);
        const certainSec = burner.getCountdownTimer() - startCountdown;
        let endCountdown = 0;
        if (certainSec <= 0) {
          if (burner.getEnd() == null) burner.setEnd(Date.now());
          endCountdown = Math.trunc((now - burner.getEnd()) / 1000);
        }
        const randomSec = burner.getRandomTimer() - endCountdown;
        const pieComponent = new ProgressPieComponent();
        const lp = tile.getLocalLocation();
        const loc = lp ? Perspective.localToCanvas(client, lp, tile.getPlane()) : null;
        if (loc == null) return;
        pieComponent.setPosition(loc);
        if (certainSec > 0) {
          pieComponent.setProgress(certainSec / burner.getCountdownTimer());
          pieComponent.setFill(Color.GREEN);
          pieComponent.setBorderColor(Color.GREEN);
          pieComponent.render(graphics);
        } else if (randomSec > 0) {
          pieComponent.setProgress(randomSec / burner.getRandomTimer());
          pieComponent.setFill(Color.ORANGE);
          pieComponent.setBorderColor(Color.ORANGE);
          pieComponent.render(graphics);
        }
      });
      return null;
    }
  }

  const BURNER_UNLIT = new Set([ObjectID.POH_TORCH_5, ObjectID.POH_TORCH_6, ObjectID.POH_TORCH_7]);
  const BURNER_LIT = new Set([ObjectID.POH_TORCH_5_LIT, ObjectID.POH_TORCH_6_LIT, ObjectID.POH_TORCH_7_LIT]);
  const tileKey = (tile) => { const w = tile.getWorldLocation(); return `${w.x}:${w.y}:${w.plane}`; };

  class PohPlugin {
    constructor() {
      this.configGroup = GROUP;
      this.pohObjects = new Map(); // TileObject -> Tile
      this.incenseBurners = new Map(); // tile key -> { tile, burner } (our Tiles are made per event)
    }
    getPohObjects() { return this.pohObjects; }
    getIncenseBurners() { return this.incenseBurners; }
    startUp() {
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.overlay = this.overlay || new PohOverlay(this, this.config);
      this.burnerOverlay = this.burnerOverlay || new BurnerOverlay(this, this.config);
      rl.overlayManager.add(this.overlay);
      rl.overlayManager.add(this.burnerOverlay);
      this.overlay.updateConfig();
    }
    shutDown() {
      rl.overlayManager.remove(this.overlay);
      rl.overlayManager.remove(this.burnerOverlay);
      this.pohObjects.clear();
      this.incenseBurners.clear();
    }
    onConfigChanged() { if (this.overlay) this.overlay.updateConfig(); }
    onGameObjectSpawned(event) {
      const gameObject = event.getGameObject();
      if (!BURNER_LIT.has(gameObject.getId()) && !BURNER_UNLIT.has(gameObject.getId())) {
        if (PohIcons.getIcon(gameObject.getId()) != null) this.pohObjects.set(gameObject, event.getTile());
        return;
      }
      const key = tileKey(event.getTile());
      if (!this.incenseBurners.has(key)) this.incenseBurners.set(key, { tile: event.getTile(), burner: new IncenseBurner() });
      const incenseBurner = this.incenseBurners.get(key).burner;
      incenseBurner.setStart(Date.now());
      incenseBurner.setLit(BURNER_LIT.has(gameObject.getId()));
      incenseBurner.setEnd(null);
      // The burner timers are set when observing a player light the burner
    }
    onGameObjectDespawned(event) { this.pohObjects.delete(event.getGameObject()); }
    onDecorativeObjectSpawned(event) {
      const decorativeObject = event.getDecorativeObject();
      if (PohIcons.getIcon(decorativeObject.getId()) != null) this.pohObjects.set(decorativeObject, event.getTile());
    }
    onDecorativeObjectDespawned(event) { this.pohObjects.delete(event.getDecorativeObject()); }
    onGameStateChanged(event) {
      if (event.getGameState() === GameState.LOADING) { this.pohObjects.clear(); this.incenseBurners.clear(); }
    }
    onAnimationChanged(event) {
      const actor = event.getActor();
      if (!(actor instanceof Player) || actor.getAnimation() !== AnimationID.HUMAN_LIGHT_TORCH) return;
      const loc = actor.getLocalLocation();
      // Find burner closest to player
      let best = null; let bestD = Infinity;
      for (const entry of this.incenseBurners.values()) {
        const tl = entry.tile.getLocalLocation();
        const d = tl ? loc.distanceTo(tl) : Infinity;
        if (d < bestD) { bestD = d; best = entry; }
      }
      if (!best) return;
      const incenseBurner = best.burner;
      incenseBurner.reset();
      const me = client.getLocalPlayer();
      if (me && actor.getName() === me.getName()) {
        const level = client.getRealSkillLevel(Skill.FIREMAKING);
        PohPlugin.updateBurner(incenseBurner, level);
      }
      // (another player: RuneLite looks their Firemaking level up on the hiscores; 2007RS has none)
    }
    static updateBurner(incenseBurner, fmLevel) {
      const tickLengthSeconds = GAME_TICK_LENGTH / 1000.0;
      incenseBurner.setCountdownTimer((200 + fmLevel) * tickLengthSeconds);
      incenseBurner.setRandomTimer((fmLevel - 1) * tickLengthSeconds);
    }
  }

  const plugin = new PohPlugin();
  ll.__poh = { plugin, PohIcons, IncenseBurner };
  rl.registerPlugin('poh', plugin);
})();
