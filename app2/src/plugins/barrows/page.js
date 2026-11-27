// RuneLite's Barrows Brothers plugin, cloned from net.runelite.client.plugins.barrows (BSD 2-Clause,
// Copyright (c) 2018, Seth <Sethtroll3@gmail.com> and RuneLite contributors): BarrowsPlugin,
// BarrowsOverlay, BarrowsBrotherSlainOverlay, BarrowsBrothers.
// 2007: the varbits are the 2007 cache's (457-463, the same ids as OSRS); the puzzle is interface 25 as
// in OSRS, but its question is component 1 and its answers 6-8; the 2007 underground overlay (24) has
// no brothers / kill count components to hide, so the slain panel shows while that overlay is open.
// The chest value is a price: only while the prices switch is on.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Color, LineComponent, OverlayPanel, Overlay, OverlayPosition, OverlayLayer, OverlayPriority, LocalPoint, WorldPoint, Perspective, FontManager, LoopTimer, QuantityFormatter } = rl;

  // VarbitID.BARROWS_KILLED_*
  const BARROWS_KILLED_AHRIM = 457; const BARROWS_KILLED_DHAROK = 458; const BARROWS_KILLED_GUTHAN = 459;
  const BARROWS_KILLED_KARIL = 460; const BARROWS_KILLED_TORAG = 461; const BARROWS_KILLED_VERAC = 462;
  const BARROWS_KILLED_MONSTER = 463;
  // InterfaceID (2007 components)
  const BARROWS_OVERLAY = 24;
  const BARROWS_PUZZLE = 25;
  const BARROWS_REWARD = 364; // (2007's reward window, as Loot Tracker's)
  const PUZZLE_1 = (BARROWS_PUZZLE << 16) | 1;
  const POSSIBLE_SOLUTIONS = [(BARROWS_PUZZLE << 16) | 6, (BARROWS_PUZZLE << 16) | 7, (BARROWS_PUZZLE << 16) | 8];
  const TRAIL_REWARDINV = 141; // InventoryID.TRAIL_REWARDINV
  const PRAYER_SPRITE = 179; // SpriteID.SideiconsInterface.PRAYER (2007: the prayer star, sprite 179)

  class BarrowsBrothers {
    constructor(name, location, killedVarbit) { this.name = name; this.location = location; this.killedVarbit = killedVarbit; }
    getName() { return this.name; }
    getLocation() { return this.location; }
    getKilledVarbit() { return this.killedVarbit; }
    static values() { return BROTHERS; }
  }
  const BROTHERS = [
    new BarrowsBrothers('Ahrim', new WorldPoint(3566, 3289, 0), BARROWS_KILLED_AHRIM),
    new BarrowsBrothers('Dharok', new WorldPoint(3575, 3298, 0), BARROWS_KILLED_DHAROK),
    new BarrowsBrothers('Guthan', new WorldPoint(3577, 3283, 0), BARROWS_KILLED_GUTHAN),
    new BarrowsBrothers('Karil', new WorldPoint(3566, 3275, 0), BARROWS_KILLED_KARIL),
    new BarrowsBrothers('Torag', new WorldPoint(3553, 3283, 0), BARROWS_KILLED_TORAG),
    new BarrowsBrothers('Verac', new WorldPoint(3557, 3298, 0), BARROWS_KILLED_VERAC),
  ];

  const getCanvasTextMiniMapLocation = (graphics, localLocation, text) => {
    const p = Perspective.localToMinimap(client, localLocation);
    if (!p) return null;
    const fm = graphics.getFontMetrics();
    const xOffset = p.getX() - Math.trunc(fm.stringWidth(text) / 2);
    const yOffset = p.getY() - Math.trunc(fm.getHeight() / 2) + fm.getAscent();
    return new rl.Point(xOffset, yOffset);
  };

  class BarrowsOverlay extends Overlay {
    constructor(plugin, config) {
      super(plugin);
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_WIDGETS);
      this.plugin = plugin; this.config = config;
    }
    render(graphics) {
      if (this.plugin.isBarrowsLoaded() && this.config.showBrotherLoc()) this.renderBarrowsBrothers(graphics);
      const puzzleAnswer = this.plugin.getPuzzleAnswer();
      if (puzzleAnswer && this.config.showPuzzleAnswer() && !puzzleAnswer.isHidden()) {
        graphics.setColor(Color.GREEN);
        graphics.draw(puzzleAnswer.getBounds());
      }
      return null;
    }
    renderBarrowsBrothers(graphics) {
      for (const brother of BarrowsBrothers.values()) {
        const localLocation = LocalPoint.fromWorld(client, brother.getLocation());
        if (!localLocation) continue;
        const brotherLetter = brother.getName().charAt(0);
        const miniMapLocation = getCanvasTextMiniMapLocation(graphics, localLocation, brotherLetter);
        if (miniMapLocation) {
          graphics.setColor(Color.BLACK);
          graphics.drawString(brotherLetter, miniMapLocation.getX() + 1, miniMapLocation.getY() + 1);
          graphics.setColor(client.getVarbitValue(brother.getKilledVarbit()) > 0 ? this.config.deadBrotherLocColor() : this.config.brotherLocColor());
          graphics.drawString(brotherLetter, miniMapLocation.getX(), miniMapLocation.getY());
        }
      }
    }
  }

  // DecimalFormat("##0.00%")
  const percent = (f) => (Math.round(f * 10000) / 100).toFixed(2) + '%';

  class BarrowsBrotherSlainOverlay extends OverlayPanel {
    constructor(plugin) {
      super(plugin);
      this.setPosition(OverlayPosition.TOP_LEFT);
      this.setPriority(OverlayPriority.LOW);
      this.addMenuEntry('RUNELITE_OVERLAY_CONFIG', 'Configure', 'Barrows overlay');
    }
    render(graphics) {
      // Only render the brothers slain overlay where the vanilla interface shows: OSRS's BarrowsOverlay is up at the
      // mounds (14131) and in the crypt / tunnels (14231). 2007: the server opens its overlay (24) underground and never
      // closes it, so the region decides, and underground the overlay must also be open.
      const me = client.getLocalPlayer();
      const region = me ? me.getWorldLocation().getRegionID() : -1;
      if (region !== BARROWS_REGION_ID && region !== CRYPT_REGION_ID) return null;
      const barrowsOverlay = client.getWidget(BARROWS_OVERLAY << 16);
      if (region === CRYPT_REGION_ID && (!barrowsOverlay || barrowsOverlay.isHidden())) return null;
      for (const brother of BarrowsBrothers.values()) {
        const brotherSlain = client.getVarbitValue(brother.getKilledVarbit()) > 0;
        this.panelComponent.getChildren().push(LineComponent.builder()
          .left(brother.getName())
          .right(brotherSlain ? '✓' : '✗')
          .rightFont(FontManager.getDefaultFont())
          .rightColor(brotherSlain ? Color.GREEN : Color.RED)
          .build());
      }
      const rewardPotential = this.rewardPotential();
      this.panelComponent.getChildren().push(LineComponent.builder()
        .left('Potential')
        .right(percent(rewardPotential / 1012))
        .rightColor(rewardPotential >= 756 && rewardPotential < 881 ? Color.GREEN : rewardPotential < 631 ? Color.WHITE : Color.YELLOW)
        .build());
      return super.render(graphics);
    }
    /** [proc,barrows_overlay_reward]: 0-1012 */
    rewardPotential() {
      const brothers = client.getVarbitValue(BARROWS_KILLED_AHRIM) + client.getVarbitValue(BARROWS_KILLED_DHAROK)
        + client.getVarbitValue(BARROWS_KILLED_GUTHAN) + client.getVarbitValue(BARROWS_KILLED_KARIL)
        + client.getVarbitValue(BARROWS_KILLED_TORAG) + client.getVarbitValue(BARROWS_KILLED_VERAC);
      return client.getVarbitValue(BARROWS_KILLED_MONSTER) + brothers * 2;
    }
  }

  const PRAYER_DRAIN_INTERVAL_MS = 18200;
  const CRYPT_REGION_ID = 14231;
  const BARROWS_REGION_ID = 14131;

  class BarrowsPlugin {
    constructor() {
      this.configGroup = 'barrows';
      this.config = rl.configProxy('barrows', () => this.configItems);
      this.barrowsPrayerDrainTimer = null;
      this.puzzleAnswer = null;
      this.barrowsOverlay = new BarrowsOverlay(this, this.config);
      this.brotherOverlay = new BarrowsBrotherSlainOverlay(this);
    }
    getPuzzleAnswer() { return this.puzzleAnswer; }
    startUp() {
      rl.overlayManager.add(this.barrowsOverlay);
      rl.overlayManager.add(this.brotherOverlay);
    }
    shutDown() {
      rl.overlayManager.remove(this.barrowsOverlay);
      rl.overlayManager.remove(this.brotherOverlay);
      this.puzzleAnswer = null;
      this.stopPrayerDrainTimer();
      // (Restore widgets: nothing was hidden, 2007's overlay has no brothers / kill count components)
    }
    onConfigChanged(event) {
      if (event.getGroup() === 'barrows' && !this.config.showPrayerDrainTimer()) this.stopPrayerDrainTimer();
    }
    onGameStateChanged(event) {
      if (event.getGameState() === rl.GameState.LOGGED_IN) {
        const isInCrypt = this.isInCrypt();
        if (!isInCrypt && this.barrowsPrayerDrainTimer) this.stopPrayerDrainTimer();
        else if (isInCrypt && !this.barrowsPrayerDrainTimer) this.startPrayerDrainTimer();
      }
    }
    onWidgetLoaded(event) {
      if (event.getGroupId() === BARROWS_REWARD && this.config.showChestValue() && rl.prices.enabled()) {
        const barrowsRewardContainer = client.getItemContainer(TRAIL_REWARDINV);
        if (!barrowsRewardContainer) return;
        let chestPrice = 0;
        for (const item of barrowsRewardContainer.getItems()) chestPrice += rl.itemManager.getItemPrice(item.getId()) * item.getQuantity();
        client.addChatMessage('ITEM_EXAMINE', '', 'Your chest is worth around ' + QuantityFormatter.formatNumber(chestPrice) + ' coins.');
      } else if (event.getGroupId() === BARROWS_PUZZLE) {
        const q = client.getWidget(PUZZLE_1);
        const answer = q ? q.getModelId() - 3 : -1;
        this.puzzleAnswer = null;
        for (const puzzleComponent of POSSIBLE_SOLUTIONS) {
          const widgetToCheck = client.getWidget(puzzleComponent);
          if (widgetToCheck && widgetToCheck.getModelId() === answer) { this.puzzleAnswer = widgetToCheck; break; }
        }
      }
    }
    // (onBeforeRender hides OSRS's vanilla brothers / kill count widgets: 2007 has none)
    onWidgetClosed(event) {
      if (event.getGroupId() === BARROWS_PUZZLE) this.puzzleAnswer = null;
    }
    startPrayerDrainTimer() {
      if (this.config.showPrayerDrainTimer()) {
        const loopTimer = new LoopTimer(PRAYER_DRAIN_INTERVAL_MS, null, this, true);
        // spriteManager.getSpriteAsync: the image once the client has it
        Object.defineProperty(loopTimer, 'image', { get() { return this._img || (this._img = rl.spriteManager.getSprite(PRAYER_SPRITE) || null); }, set(v) { this._img = v; } });
        loopTimer.setPriority('MED');
        loopTimer.setTooltip('Prayer Drain');
        rl.infoBoxManager.addInfoBox(loopTimer);
        this.barrowsPrayerDrainTimer = loopTimer;
      }
    }
    stopPrayerDrainTimer() {
      rl.infoBoxManager.removeInfoBox(this.barrowsPrayerDrainTimer);
      this.barrowsPrayerDrainTimer = null;
    }
    isInCrypt() {
      const localPlayer = client.getLocalPlayer();
      return !!localPlayer && localPlayer.getWorldLocation().getRegionID() === CRYPT_REGION_ID;
    }
    isBarrowsLoaded() { return client.getMapRegions().includes(BARROWS_REGION_ID); }
  }

  rl.registerPlugin('barrows', new BarrowsPlugin());
  ll.barrowsTest = { BarrowsBrothers, BarrowsOverlay, BarrowsBrotherSlainOverlay };
})();
