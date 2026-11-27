// RuneLite's Cannon plugin, cloned from net.runelite.client.plugins.cannon (BSD 2-Clause, Copyright (c) 2016-2018,
// Seth <Sethtroll3@gmail.com> and RuneLite contributors): CannonPlugin, CannonCounter, CannonOverlay, CannonSpotOverlay,
// CannonSpots.
// The 2007 cache has the cannon varps at OSRS's ids (dropcannon 2, rockthrower 3, ownedmcannon 4) and the cannon parts
// and cannonball at OSRS's item ids. Our server keeps those varps server-side (no transmit), so the ball count, the
// infobox and the placed-cannon overlay wait for the server to send them; the cannon spots (all parts in the inventory)
// and the chat notifications work now. 2007 has no MCANNON_DECAYED varbit (cannon decay is 2009) or League cannon.
// Era-trim of CannonSpots: no spots in the Wilderness Slayer Cave (2019), Stronghold Slayer Cave (2016), Kourend and
// its Catacombs (2016), Prifddinas (2019), Fossil Island (2016), Myths' Guild (2018), Meiyerditch lab, Smoke Devil
// Dungeon (2015), the Ankou / dragon / giant spots of the Wilderness Slayer Cave, Wilderness revamp (2017: mammoths, elder chaos druids), Lizardmen or warped creatures.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Color, Overlay, OverlayPosition, Counter, InfoBox, TextComponent, WorldPoint, WorldArea, LocalPoint, Perspective, InventoryID, GameState } = rl;

  const VarPlayerID = { DROPCANNON: 2, ROCKTHROWER: 3, OWNEDMCANNON: 4 };
  const ItemID = { MCANNONBALL: 2, TWPART1: 6, TWPART2: 8, TWPART3: 10, TWPART4: 12 };
  const MAX_OVERLAY_DISTANCE = 4100;
  const LOCAL_TILE_SIZE = 128;

  const wp = (x, y, p) => new WorldPoint(x, y, p);
  const CannonSpots = {
    BANDIT: [wp(3037, 3700, 0)],
    BEAR: [wp(3113, 3672, 0)],
    BLACK_DEMONS: [wp(2859, 9778, 0), wp(2841, 9791, 0), wp(3089, 9960, 0)],
    BLACK_KNIGHTS: [wp(2906, 9685, 0), wp(3053, 3852, 0)],
    BRINE_RAT: [wp(2707, 10132, 0)],
    CAVE_HORROR: [wp(3785, 9460, 0)],
    DAGGANOTH: [wp(2524, 10020, 0), wp(2478, 10443, 0), wp(2420, 10425, 0)],
    DARK_BEAST: [wp(1992, 4655, 0)],
    DARK_WARRIOR: [wp(3030, 3632, 0)],
    DUST_DEVIL: [wp(3218, 9366, 0)],
    EARTH_WARRIOR: [wp(3120, 9987, 0)],
    FIRE_GIANTS: [wp(3047, 10340, 0)],
    HELLHOUNDS: [wp(2783, 9686, 0)],
    HILL_GIANT: [wp(3044, 10318, 0)],
    ICE_WARRIOR: [wp(2955, 3876, 0)],
    KALPHITE: [wp(3307, 9528, 0)],
    LESSER_DEMON: [wp(2838, 9559, 0)],
    MAGIC_AXE: [wp(3190, 3960, 0)],
    MINIONS_OF_SCARABAS: [wp(3297, 9252, 0)],
    MOSS_GIANT: [wp(3159, 9903, 0)],
    ROGUE: [wp(3285, 3930, 0)],
    SKELETON: [wp(3017, 3589, 0)],
    SPIDER: [wp(3169, 3886, 0)],
    SUQAHS: [wp(2114, 3943, 0)],
    TROLLS: [wp(2401, 3856, 0)],
    ZOMBIE: [wp(3172, 3677, 0)],
  };
  const cannonSpots = [].concat(...Object.values(CannonSpots));

  class CannonCounter extends InfoBox {
    constructor(img, plugin) { super(img, plugin); this.plugin = plugin; }
    getText() { return String(this.plugin.getCballsLeft()); }
    getTextColor() { return this.plugin.getStateColor(); }
  }

  class CannonOverlay extends Overlay {
    constructor(config, plugin) {
      super(plugin);
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setPriority(rl.OverlayPriority.MED); // (PRIORITY_MED)
      this.config = config; this.plugin = plugin;
      this.textComponent = new TextComponent();
    }
    render(graphics) {
      const plugin = this.plugin;
      if (!plugin.isCannonPlaced() || plugin.getCannonPosition() == null || plugin.getCannonWorld() !== client.getWorld() || plugin.isCannonDecayed()) return null;
      // WorldAreas return the SW point, whereas we want the centre point
      const cannonLocation = plugin.getCannonPosition().toWorldPoint().dx(1).dy(1);
      const cannonPoint = LocalPoint.fromWorld(client, cannonLocation);
      if (cannonPoint == null) return null;
      const localLocation = client.getLocalPlayer().getLocalLocation();
      if (localLocation.distanceTo(cannonPoint) <= MAX_OVERLAY_DISTANCE) {
        const cannonLoc = Perspective.getCanvasTextLocation(client, graphics, cannonPoint, String(plugin.getCballsLeft()), 150);
        if (cannonLoc != null) {
          this.textComponent.setText(String(plugin.getCballsLeft()));
          this.textComponent.setPosition(cannonLoc.getX(), cannonLoc.getY());
          this.textComponent.setColor(plugin.getStateColor());
          this.textComponent.render(graphics);
        }
        if (this.config.showDoubleHitSpot()) this.drawDoubleHitSpots(graphics, cannonPoint, this.config.highlightDoubleHitColor());
      }
      return null;
    }
    drawDoubleHitSpots(graphics, startTile, color) {
      for (let x = -3; x <= 3; x++) {
        for (let y = -3; y <= 3; y++) {
          if (y !== 1 && x !== 1 && y !== -1 && x !== -1) continue;
          // Ignore center square
          if (y >= -1 && y <= 1 && x >= -1 && x <= 1) continue;
          const marker = new LocalPoint(startTile.getX() - (x * LOCAL_TILE_SIZE), startTile.getY() - (y * LOCAL_TILE_SIZE));
          const poly = Perspective.getCanvasTilePoly(client, marker);
          if (poly == null) continue;
          rl.OverlayUtil.renderPolygon(graphics, poly, color);
        }
      }
    }
  }

  class CannonSpotOverlay extends Overlay {
    constructor(plugin, config) {
      super(plugin);
      this.setPosition(OverlayPosition.DYNAMIC);
      this.plugin = plugin; this.config = config;
      this.hidden = false;
    }
    setHidden(h) { this.hidden = h; }
    render(graphics) {
      const spotPoints = this.plugin.getSpotPoints();
      if (this.hidden || spotPoints.length === 0 || !this.config.showCannonSpots() || this.plugin.isCannonPlaced()) return null;
      for (const spot of spotPoints) {
        if (spot.getPlane() !== client.getPlane()) continue;
        const spotPoint = LocalPoint.fromWorld(client, spot);
        const localLocation = client.getLocalPlayer().getLocalLocation();
        if (spotPoint != null && localLocation.distanceTo(spotPoint) <= MAX_OVERLAY_DISTANCE) {
          this.renderCannonSpot(graphics, spotPoint, rl.itemManager.getImage(ItemID.MCANNONBALL), Color.RED);
        }
      }
      return null;
    }
    renderCannonSpot(graphics, point, image, color) {
      // Render tile
      const poly = Perspective.getCanvasTilePoly(client, point);
      if (poly != null) rl.OverlayUtil.renderPolygon(graphics, poly, color);
      // Render icon
      if (!image) return;
      const imageLoc = Perspective.getCanvasImageLocation(client, point, image, 0);
      if (imageLoc != null) rl.OverlayUtil.renderImageLocation(graphics, imageLoc, image);
    }
  }

  class CannonPlugin {
    constructor() {
      this.configGroup = 'cannon';
      this.config = rl.configProxy(this.configGroup, () => this.configItems);
      this.counter = null;
      this.cannonBallNotificationSent = false;
      this.cballsLeft = 0;
      this.cannonPlaced = false;
      this.cannonDecayed = false;
      this.cannonPosition = null;
      this.cannonWorld = -1;
      this.spotPoints = [];
      this.cannonOverlay = new CannonOverlay(this.config, this);
      this.cannonSpotOverlay = new CannonSpotOverlay(this, this.config);
    }
    getCballsLeft() { return this.cballsLeft; }
    isCannonPlaced() { return this.cannonPlaced; }
    isCannonDecayed() { return this.cannonDecayed; }
    getCannonPosition() { return this.cannonPosition; }
    getCannonWorld() { return this.cannonWorld; }
    getSpotPoints() { return this.spotPoints; }
    startUp() {
      rl.overlayManager.add(this.cannonOverlay);
      rl.overlayManager.add(this.cannonSpotOverlay);
      if (client.getGameState() === GameState.LOGGED_IN) {
        this.cballsLeft = client.getVarpValue(VarPlayerID.ROCKTHROWER);
        this.cannonPlaced = client.getVarpValue(VarPlayerID.DROPCANNON) === 4;
        this.cannonDecayed = false; // (no MCANNON_DECAYED in 2007)
        if (this.cannonPlaced && !this.cannonDecayed) this.addCounter();
        this.onGameStateChanged({ getGameState: () => GameState.LOGGED_IN }); // (the spots in the scene now)
      }
    }
    shutDown() {
      this.cannonSpotOverlay.setHidden(true);
      rl.overlayManager.remove(this.cannonOverlay);
      rl.overlayManager.remove(this.cannonSpotOverlay);
      this.cannonPlaced = false;
      this.cannonDecayed = false;
      this.cannonWorld = -1;
      this.cannonPosition = null;
      this.cannonBallNotificationSent = false;
      this.cballsLeft = 0;
      this.removeCounter();
      this.spotPoints.length = 0;
    }
    onItemContainerChanged(event) {
      if (event.getContainerId() !== InventoryID.INV) return;
      let hasBase = false; let hasStand = false; let hasBarrels = false; let hasFurnace = false; let hasAll = false;
      if (!this.cannonPlaced) {
        for (const item of event.getItemContainer().getItems()) {
          if (item == null) continue;
          switch (item.getId()) {
            case ItemID.TWPART1: hasBase = true; break;
            case ItemID.TWPART2: hasStand = true; break;
            case ItemID.TWPART3: hasBarrels = true; break;
            case ItemID.TWPART4: hasFurnace = true; break;
            default: break;
          }
          if (hasBase && hasStand && hasBarrels && hasFurnace) { hasAll = true; break; }
        }
      }
      this.cannonSpotOverlay.setHidden(!hasAll);
    }
    onConfigChanged(event) {
      if (event.getGroup() === 'cannon') {
        if (!this.config.showInfobox()) this.removeCounter();
        else if (this.cannonPlaced) this.addCounter();
      }
    }
    onGameStateChanged(gameStateChanged) {
      if (gameStateChanged.getGameState() !== GameState.LOGGED_IN) return;
      this.spotPoints.length = 0;
      for (const spot of cannonSpots) if (spot.isInScene(client)) this.spotPoints.push(spot);
    }
    onVarbitChanged(varbitChanged) {
      if (varbitChanged.getVarbitId() !== -1) return; // (the varp events: 2007 has no MCANNON_DECAYED varbit)
      if (varbitChanged.getVarpId() === VarPlayerID.ROCKTHROWER) {
        const old = this.cballsLeft;
        this.cballsLeft = varbitChanged.getValue();
        if (this.cballsLeft > old) this.cannonBallNotificationSent = false;
        if (!this.cannonBallNotificationSent && this.cballsLeft > 0 && this.config.lowWarningThreshold() >= this.cballsLeft) {
          if (this.config.showCannonNotifications()) rl.notifier.notify(`Your cannon has ${this.cballsLeft} cannon balls remaining!`);
          this.cannonBallNotificationSent = true;
        }
      } else if (varbitChanged.getVarpId() === VarPlayerID.OWNEDMCANNON) {
        const c = WorldPoint.fromCoord(varbitChanged.getValue());
        this.cannonPosition = CannonPlugin.buildCannonWorldArea(c);
      } else if (varbitChanged.getVarpId() === VarPlayerID.DROPCANNON) {
        this.cannonPlaced = varbitChanged.getValue() === 4;
        if (this.cannonPlaced) this.addCounter();
        else this.removeCounter();
      }
    }
    onChatMessage(event) {
      if (event.getType() !== 'SPAM' && event.getType() !== 'GAMEMESSAGE') return;
      if (event.getMessage() === 'You add the furnace.') this.cannonWorld = client.getWorld();
      else if (event.getMessage().includes('Your cannon is out of ammo!')) {
        if (this.config.showCannonNotifications()) rl.notifier.notify('Your cannon is out of ammo!');
      }
    }
    getStateColor() {
      if (this.cballsLeft > 15) return Color.GREEN;
      if (this.cballsLeft > 5) return Color.ORANGE;
      return Color.RED;
    }
    addCounter() {
      if (!this.config.showInfobox() || this.cannonDecayed || this.counter != null) return;
      this.counter = new CannonCounter(rl.itemManager.getImage(ItemID.MCANNONBALL), this);
      this.counter.setTooltip('Cannonballs');
      rl.infoBoxManager.addInfoBox(this.counter);
    }
    removeCounter() {
      if (this.counter == null) return;
      rl.infoBoxManager.removeInfoBox(this.counter);
      this.counter = null;
    }
    static buildCannonWorldArea(worldPoint) { return new WorldArea(worldPoint.getX(), worldPoint.getY(), 3, 3, worldPoint.getPlane()); }
  }

  const plugin = new CannonPlugin();
  ll.__cannon = { plugin, CannonCounter, cannonSpots };
  rl.registerPlugin('cannon', plugin);
})();
