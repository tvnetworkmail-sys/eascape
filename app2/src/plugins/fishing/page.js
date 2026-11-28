// RuneLite's Fishing plugin, cloned from net.runelite.client.plugins.fishing (BSD 2-Clause, Copyright (c) 2017, Seth
// <Sethtroll3@gmail.com> and RuneLite contributors): FishingPlugin, FishingOverlay, FishingSpotOverlay,
// FishingSpotMinimapOverlay, FishingSession; the spots are the core's FishingSpot.
// Trimmed for Sept 2007: no minnows, aerial fishing or Tempoross (their colours, the minnow pies, the flying fish
// notification). The Fishing Trawler (2002) timer and contribution rewrite the Trawler overlay's text through the core's
// display-only widget writes (Widget.setText; the server's own updates overwrite them). The catch message is a plain game
// message in 2007 (OSRS sends it as SPAM). Tools and animations are RuneLite's lists trimmed to the 2007 cache.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl || !rl.FishingSpot) return;
  // the Trawler: InterfaceID.TRAWLER_OVERLAY 366 (TrawlerOverlay.CATCH / TIME), VarbitID.TRAWLER_ACTIVITY, the ship's regions
  const TRAWLER_SHIP_REGION_NORMAL = 7499;
  const TRAWLER_SHIP_REGION_SINKING = 8011;
  // 2006RS-2: our Trawler game is 1000 ticks, 10 minutes (trawler_control.rs2 murphy_normal: 200 x 5 ticks), as in 2006
  // (OSRS's is 5 minutes 14)
  const TRAWLER_TIME_LIMIT_IN_SECONDS = ll && ll.c2007 ? 314 : 600;
  const TRAWLER_OVERLAY = 366;
  const TrawlerOverlay = { CATCH: 0x016e000d, TIME: 0x016e000e };
  const TRAWLER_ACTIVITY = 3377;
  const { client, Skill, Color, LineComponent, TitleComponent, Overlay, OverlayPanel, OverlayPosition, OverlayLayer, LocalPoint, FishingSpot, InventoryID } = rl;
  // 2006RS-2: server data: the server says when an action in a skill is going on (::appidle, engine Player.appIdleTick;
  // the runtime's ll.appSkilling), so this needn't rest on the animation alone
  const serverSkilling = (skill) => !!(ll.appSkilling && ll.appSkilling(skill));

  const FISHING_CATCH_REGEX = /You catch (?:a|an|some) |Your cormorant returns with its catch.|You catch .* Karambwanji/;
  // RuneLite's tools in the 2007 cache: harpoon, big net, net, Evil Bob's net, fishing rod, fly fishing rod, oily fishing
  // rod, lobster pot, karambwan vessel (empty / loaded)
  const FISHING_TOOLS = new Set([311, 305, 303, 6209, 307, 309, 1585, 301, 3157, 3159]);
  // RuneLite's FISHING_ANIMATIONS in the 2007 cache: HUMAN_LARGENET, HUMAN_LOBSTER, HUMAN_HARPOON, HUMAN_OCTOPUS_POT,
  // HUMAN_SMALLNET, HUMAN_FISHING_CASTING, HUMAN_FISH_ONSPOT
  const FISHING_ANIMATIONS = new Set([620, 619, 618, 1193, 621, 622, 623]);

  class FishingSession {
    constructor() { this.lastFishCaught = null; }
    getLastFishCaught() { return this.lastFishCaught; }
    setLastFishCaught(v) { this.lastFishCaught = v; }
  }

  // ---------------------------------------------------------------- FishingSpotOverlay
  class FishingSpotOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_SCENE);
      this.plugin = plugin; this.config = plugin.config; this.hidden = false;
    }
    setHidden(h) { this.hidden = h; }
    render(graphics) {
      if (this.hidden) return null;
      const config = this.config;
      let previousSpot = null;
      let previousLocation = null;
      for (const npc of this.plugin.getFishingSpots()) {
        const spot = FishingSpot.findSpot(npc.getId());
        if (spot == null) continue;
        if (config.onlyCurrentSpot() && this.plugin.getCurrentSpot() != null && this.plugin.getCurrentSpot() !== spot) continue;
        // This relies on the sort order to keep identical npcs on the same tile adjacent to each other
        if (previousSpot === spot && previousLocation.equals(npc.getWorldLocation())) continue;
        const color = config.getOverlayColor();
        if (config.showSpotTiles()) {
          const poly = npc.getCanvasTilePoly();
          if (poly != null) rl.OverlayUtil.renderPolygon(graphics, poly, color.darker());
        }
        if (config.showSpotIcons()) {
          const fishImage = rl.itemManager.getImage(spot.getFishSpriteId());
          if (fishImage != null) {
            const imageLocation = npc.getCanvasImageLocation(fishImage, npc.getLogicalHeight());
            if (imageLocation != null) rl.OverlayUtil.renderImageLocation(graphics, imageLocation, fishImage);
          }
        }
        if (config.showSpotNames()) {
          const text = spot.getName();
          const textLocation = npc.getCanvasTextLocation(graphics, text, npc.getLogicalHeight() + 40);
          if (textLocation != null) rl.OverlayUtil.renderTextLocation(graphics, textLocation, text, color.darker());
        }
        previousSpot = spot;
        previousLocation = npc.getWorldLocation();
      }
      return null;
    }
  }

  // ---------------------------------------------------------------- FishingSpotMinimapOverlay
  class FishingSpotMinimapOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_WIDGETS);
      this.plugin = plugin; this.config = plugin.config; this.hidden = false;
    }
    setHidden(h) { this.hidden = h; }
    render(graphics) {
      if (this.hidden) return null;
      for (const npc of this.plugin.getFishingSpots()) {
        const spot = FishingSpot.findSpot(npc.getId());
        if (spot == null) continue;
        if (this.config.onlyCurrentSpot() && this.plugin.getCurrentSpot() != null && this.plugin.getCurrentSpot() !== spot) continue;
        const color = this.config.getOverlayColor();
        const minimapLocation = npc.getMinimapLocation();
        if (minimapLocation != null) rl.OverlayUtil.renderMinimapLocation(graphics, minimapLocation, color.darker());
      }
      return null;
    }
  }

  // ---------------------------------------------------------------- FishingOverlay
  const FISHING_SPOT = 'Fishing spot';
  class FishingOverlay extends OverlayPanel {
    constructor(plugin) {
      super(plugin);
      this.setPosition(OverlayPosition.TOP_LEFT);
      this.plugin = plugin; this.config = plugin.config;
      this.addMenuEntry('RUNELITE_OVERLAY_CONFIG', 'Configure', 'Fishing overlay');
      this.addMenuEntry('RUNELITE_OVERLAY', 'Reset', 'Fishing overlay', () => plugin.reset());
    }
    render(graphics) {
      if (!this.config.showFishingStats() || this.plugin.getSession().getLastFishCaught() == null) return null;
      const me = client.getLocalPlayer();
      const it = me && me.getInteracting();
      const ch = this.panelComponent.getChildren();
      if (serverSkilling('fishing') || (it != null && (it.getName() || '').includes(FISHING_SPOT) && FISHING_ANIMATIONS.has(me.getAnimation()))) {
        ch.push(TitleComponent.builder().text('Fishing').color(Color.GREEN).build());
      } else {
        ch.push(TitleComponent.builder().text('NOT fishing').color(Color.RED).build());
      }
      const actions = rl.xpTrackerService.getActions(Skill.FISHING);
      if (actions > 0) {
        ch.push(LineComponent.builder().left('Caught fish:').right(String(actions)).build());
        if (actions > 2) ch.push(LineComponent.builder().left('Fish/hr:').right(String(rl.xpTrackerService.getActionsHr(Skill.FISHING))).build());
      }
      return super.render(graphics);
    }
  }

  // ---------------------------------------------------------------- FishingPlugin
  class FishingPlugin {
    constructor() {
      this.config = rl.configProxy('fishing', () => this.configItems);
      this.session = new FishingSession();
      this.fishingSpots = [];
      this.currentSpot = null;
      this.overlay = new FishingOverlay(this);
      this.spotOverlay = new FishingSpotOverlay(this);
      this.fishingSpotMinimapOverlay = new FishingSpotMinimapOverlay(this);
    }
    getSession() { return this.session; }
    getFishingSpots() { return this.fishingSpots; }
    getCurrentSpot() { return this.currentSpot; }
    startUp() {
      if (ll.appWant) ll.appWant('fishing', true);
      rl.overlayManager.add(this.overlay);
      rl.overlayManager.add(this.spotOverlay);
      rl.overlayManager.add(this.fishingSpotMinimapOverlay);
    }
    shutDown() {
      if (ll.appWant) ll.appWant('fishing', false);
      this.spotOverlay.setHidden(true);
      this.fishingSpotMinimapOverlay.setHidden(true);
      rl.overlayManager.remove(this.overlay);
      rl.overlayManager.remove(this.spotOverlay);
      rl.overlayManager.remove(this.fishingSpotMinimapOverlay);
      this.fishingSpots = [];
      this.currentSpot = null;
      this.trawlerStartTime = null;
    }
    onGameStateChanged(e) {
      const s = e.getGameState();
      if (s === 'CONNECTION_LOST' || s === 'LOGIN_SCREEN' || s === 'HOPPING') this.fishingSpots = [];
    }
    reset() { this.session.setLastFishCaught(null); }
    onItemContainerChanged(event) {
      // (our containers are built per call: compared by id)
      const id = event.getContainerId();
      if (id !== InventoryID.INV && id !== InventoryID.WORN) return;
      const showOverlays = this.session.getLastFishCaught() != null
        || this.canPlayerFish(client.getItemContainer(InventoryID.INV))
        || this.canPlayerFish(client.getItemContainer(InventoryID.WORN));
      if (!showOverlays) this.currentSpot = null;
      this.spotOverlay.setHidden(!showOverlays);
      this.fishingSpotMinimapOverlay.setHidden(!showOverlays);
    }
    onChatMessage(event) {
      // (2007: a game message; OSRS's SPAM type is later)
      if (event.getType() !== 'GAMEMESSAGE' && event.getType() !== 'SPAM') return;
      const message = event.getMessage();
      if (FISHING_CATCH_REGEX.test(message)) {
        this.session.setLastFishCaught(Date.now());
        this.spotOverlay.setHidden(false);
        this.fishingSpotMinimapOverlay.setHidden(false);
      }
    }
    onInteractingChanged(event) {
      const me = client.getLocalPlayer();
      const src = event.getSource();
      if (!me || !src || !src.equals(me)) return;
      const target = event.getTarget();
      if (!(target instanceof rl.NPC)) return;
      const spot = FishingSpot.findSpot(target.getId());
      if (spot == null) return;
      this.currentSpot = spot;
    }
    canPlayerFish(itemContainer) {
      if (itemContainer == null) return false;
      for (const item of itemContainer.getItems()) if (item && FISHING_TOOLS.has(item.getId())) return true;
      return false;
    }
    onGameTick() {
      // Reset fishing session
      if (this.session.getLastFishCaught() != null) {
        const statTimeout = this.config.statTimeout() * 60000;
        const sinceCaught = Date.now() - this.session.getLastFishCaught();
        if (sinceCaught >= statTimeout) {
          this.currentSpot = null;
          this.session.setLastFishCaught(null);
        }
      }
      // (our NPC objects are per-tick snapshots: the spots are read again by index)
      this.refreshSpots();
      this.inverseSortSpotDistanceFromPlayer();
      this.updateTrawlerTimer();
      this.updateTrawlerContribution();
    }
    onWidgetLoaded(event) {
      if (event.getGroupId() === TRAWLER_OVERLAY) this.trawlerStartTime = Date.now();
    }
    regionId() {
      const p = client.getLocalPlayer();
      const w = p && p.getWorldLocation();
      return w ? w.getRegionID() : -1;
    }
    /** Updates the trawler contribution value */
    updateTrawlerContribution() {
      const regionID = this.regionId();
      if (regionID !== TRAWLER_SHIP_REGION_NORMAL && regionID !== TRAWLER_SHIP_REGION_SINKING) return;
      if (!this.config.trawlerContribution()) return;
      // 2006RS-2: our Trawler keeps no contribution points (OSRS's TRAWLER_ACTIVITY varbit came later), so the overlay's
      // own catch line stays
      if (!ll.c2007) return;
      const trawlerContributionWidget = client.getWidget(TrawlerOverlay.CATCH);
      if (trawlerContributionWidget == null) return;
      const trawlerContribution = client.getVarbitValue(TRAWLER_ACTIVITY);
      trawlerContributionWidget.setText('Contribution: ' + trawlerContribution);
    }
    /** Changes the Fishing Trawler timer widget from minutes to minutes and seconds */
    updateTrawlerTimer() {
      if (this.trawlerStartTime == null) return;
      const regionID = this.regionId();
      if (regionID !== TRAWLER_SHIP_REGION_NORMAL && regionID !== TRAWLER_SHIP_REGION_SINKING) {
        this.trawlerStartTime = null;
        return;
      }
      if (!this.config.trawlerTimer()) return;
      const trawlerTimerWidget = client.getWidget(TrawlerOverlay.TIME);
      if (trawlerTimerWidget == null) return;
      let timeLeft = TRAWLER_TIME_LIMIT_IN_SECONDS - Math.trunc((Date.now() - this.trawlerStartTime) / 1000);
      if (timeLeft < 0) timeLeft = 0;
      const minutes = Math.trunc(timeLeft / 60);
      const seconds = timeLeft % 60;
      trawlerTimerWidget.setText('Time Left: ' + (minutes > 0 ? minutes : '0') + ':' + (seconds < 10 ? '0' : '') + seconds);
    }
    refreshSpots() {
      if (!this.fishingSpots.length) return;
      const live = new Map();
      for (const n of client.getNpcs()) live.set(n.getIndex(), n);
      this.fishingSpots = this.fishingSpots.map((n) => live.get(n.getIndex()) || n);
    }
    onNpcSpawned(event) {
      const npc = event.getNpc();
      if (FishingSpot.findSpot(npc.getId()) == null) return;
      this.fishingSpots.push(npc);
      this.inverseSortSpotDistanceFromPlayer();
    }
    onNpcDespawned(event) {
      const npc = event.getNpc();
      this.fishingSpots = this.fishingSpots.filter((n) => n.getIndex() !== npc.getIndex());
    }
    inverseSortSpotDistanceFromPlayer() {
      if (this.fishingSpots.length === 0) return;
      const cameraPoint = new LocalPoint(client.getCameraX(), client.getCameraY());
      this.fishingSpots.sort((a, b) => {
        // Negate to have the furthest first
        const d = -a.getLocalLocation().distanceTo(cameraPoint) + b.getLocalLocation().distanceTo(cameraPoint);
        if (d) return d;
        // Order by position
        const la = a.getLocalLocation(); const lb = b.getLocalLocation();
        if (la.getX() !== lb.getX()) return la.getX() - lb.getX();
        if (la.getY() !== lb.getY()) return la.getY() - lb.getY();
        // And then by id
        return a.getId() - b.getId();
      });
    }
  }

  const plugin = new FishingPlugin();
  ll.__fishing = { plugin };
  rl.registerPlugin('fishing', plugin);
})();
