// RuneLite's Pyramid Plunder plugin, cloned from net.runelite.client.plugins.pyramidplunder (BSD 2-Clause, Copyright
// (c) 2020, Mitchell <https://github.com/Mitchell-Kovacs> and RuneLite contributors): PyramidPlunderPlugin,
// PyramidPlunderConfig, PyramidPlunderOverlay, PyramidPlunderTimer.
// Our server doesn't have Pyramid Plunder yet (July 2006), but the 2007 cache does: its locs (16458-16517), the
// pharaoh's sceptre (9044), the overlay interface 428 (OSRS's NtkOverlay, "Room %1 of 8") and the NTK_* varbits (the
// same ids as OSRS's). 2007 has no multilocs for them: the server swaps the loc itself (closed urn 16501 -> opened
// 16505), so the "multi" sets are every state's id, the impostor is the loc itself, and despawns drop the old state.
// The 2007 overlay has no CONTENT layer: "Hide default timer" hides its components (428:0-55).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Color, Overlay, OverlayPosition, OverlayLayer, OverlayUtil, ColorUtil, Timer, GameState } = rl;
  const GROUP = 'pyramidplunder';

  // 2007 ids
  const range = (x, y) => Array.from({ length: y - x + 1 }, (_, i) => x + i);
  const ObjectID = {
    TOMB_DOORS: [16475, 16476], NTK_TOMB_DOOR_NOANIM: 16475, NTK_SPEARTRAP_INMOTION: 16517,
    URNS: range(16501, 16516), NTK_URN1_CLOSED: 16501, NTK_URN2_CLOSED: 16502, NTK_URN3_CLOSED: 16503,
    GOLDEN_CHESTS: [16473, 16474], NTK_GOLDEN_CHEST_CLOSED: 16473, SARCOPHAGI: range(16495, 16500), NTK_SARCOPHAGUS: 16495,
  };
  const ItemID = { NTK_JEWELLED_SCEPTRE_3: 9044 };
  const VarbitID = { NTK_PLAYER_TIMER_COUNT: 2375, NTK_ROOM_NUMBER: 2377, NTK_TRAP_ACTIVE: 2365, NTK_THIEVING_REQUIRED: 2376 };
  const NTK_OVERLAY = 428; // InterfaceID.NtkOverlay (CONTENT: its components)
  const varbit = (id) => client.getVarbitValue(id);
  const ids = (...a) => new Set(a.flat());
  /** the overlay's components while it's open (OSRS: the CONTENT widget) */
  const ppWidget = () => {
    if (!ll.api || !ll.api.ifOpen || !ll.api.ifOpen(NTK_OVERLAY)) return null;
    const ws = ll.api.comsOf(NTK_OVERLAY).map((c) => client.getWidget(c.id)).filter(Boolean);
    return { setHidden: (h) => ws.forEach((w) => w.setHidden(h)) };
  };
  const impostorId = (id) => { const d = client.getObjectDefinition(id); const imp = d && d.getImpostor ? d.getImpostor() : null; return imp ? imp.getId() : id; };

  const PYRAMID_PLUNDER_DURATION = 501 * 600;
  const PYRAMID_PLUNDER_REGION = 7749;
  const TOMB_DOOR_WALL_IDS = ids(ObjectID.TOMB_DOORS);
  const TOMB_DOOR_CLOSED_ID = ObjectID.NTK_TOMB_DOOR_NOANIM;
  const SPEARTRAP_ID = ObjectID.NTK_SPEARTRAP_INMOTION;
  const URN_IDS = ids(ObjectID.URNS);
  const URN_CLOSED_IDS = ids(ObjectID.NTK_URN1_CLOSED, ObjectID.NTK_URN2_CLOSED, ObjectID.NTK_URN3_CLOSED);
  const GRAND_GOLD_CHEST_IDS = ids(ObjectID.GOLDEN_CHESTS);
  const GRAND_GOLD_CHEST_CLOSED_ID = ObjectID.NTK_GOLDEN_CHEST_CLOSED;
  const SARCOPHAGUS_IDS = ids(ObjectID.SARCOPHAGI);
  const SARCOPHAGUS_CLOSED_ID = ObjectID.NTK_SARCOPHAGUS;
  const is = (id, want) => (want instanceof Set ? want.has(id) : id === want);

  class PyramidPlunderTimer extends Timer {
    constructor(durationMs, image, plugin, config) { super(durationMs, image, plugin); this.config = config; }
    getTextColor() { const secondsLeft = Math.trunc((this.end - Date.now()) / 1000); return secondsLeft < this.config.timerLowWarning() ? Color.RED.brighter() : Color.WHITE; }
    getTooltip() { return `Time remaining. Floor: ${varbit(VarbitID.NTK_ROOM_NUMBER)}. Thieving level: ${varbit(VarbitID.NTK_THIEVING_REQUIRED)}`; }
    render() { return this.config.showExactTimer(); }
  }

  const MAX_DISTANCE = 2350;
  class PyramidPlunderOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_SCENE);
    }
    render(graphics) {
      const config = this.plugin.config;
      const pp = ppWidget();
      if (pp == null) return null;
      pp.setHidden(config.hideTimer());
      const playerLocation = client.getLocalPlayer().getLocalLocation();
      const currentFloor = varbit(VarbitID.NTK_ROOM_NUMBER);
      for (const object of this.plugin.getObjectsToHighlight()) {
        if ((config.highlightUrnsFloor() > currentFloor && URN_IDS.has(object.getId()))
          || (config.highlightChestFloor() > currentFloor && is(object.getId(), GRAND_GOLD_CHEST_IDS))
          || (config.highlightSarcophagusFloor() > currentFloor && is(object.getId(), SARCOPHAGUS_IDS))
          || object.getLocalLocation().distanceTo(playerLocation) >= MAX_DISTANCE) continue;
        const imposter = impostorId(object.getId());
        if (URN_CLOSED_IDS.has(imposter) || is(imposter, GRAND_GOLD_CHEST_CLOSED_ID) || is(imposter, SARCOPHAGUS_CLOSED_ID)) {
          const shape = object.getConvexHull();
          if (shape != null) OverlayUtil.renderPolygon(graphics, shape, config.highlightContainersColor());
        }
      }
      const mousePosition = client.getMouseCanvasPosition();
      for (const [object, tile] of this.plugin.getTilesToHighlight()) {
        if ((!config.highlightDoors() && TOMB_DOOR_WALL_IDS.has(object.getId()))
          || (!config.highlightSpeartraps() && is(object.getId(), SPEARTRAP_ID))
          || tile.getPlane() !== client.getPlane()
          || object.getLocalLocation().distanceTo(playerLocation) >= MAX_DISTANCE) continue;
        let highlightColor;
        if (is(object.getId(), SPEARTRAP_ID)) {
          if (varbit(VarbitID.NTK_TRAP_ACTIVE) !== 1) continue;
          highlightColor = config.highlightSpeartrapsColor();
        } else {
          if (!is(impostorId(object.getId()), TOMB_DOOR_CLOSED_ID)) continue;
          highlightColor = config.highlightDoorsColor();
        }
        const objectClickbox = object.getClickbox();
        if (objectClickbox != null) {
          graphics.setColor(objectClickbox.contains(mousePosition.getX(), mousePosition.getY()) ? highlightColor.darker() : highlightColor);
          graphics.draw(objectClickbox);
          graphics.setColor(ColorUtil.colorWithAlpha(highlightColor, Math.trunc(highlightColor.getAlpha() / 5)));
          graphics.fill(objectClickbox);
        }
      }
      return null;
    }
  }

  class PyramidPlunderPlugin {
    constructor() { this.configGroup = GROUP; this.tilesToHighlight = new Map(); this.objectsToHighlight = []; this.timer = null; }
    getTilesToHighlight() { return this.tilesToHighlight; }
    getObjectsToHighlight() { return this.objectsToHighlight; }
    startUp() {
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.overlay = new PyramidPlunderOverlay(this);
      rl.overlayManager.add(this.overlay);
    }
    shutDown() {
      this.tilesToHighlight.clear();
      this.objectsToHighlight.length = 0;
      rl.overlayManager.remove(this.overlay);
      this.timer = null;
      rl.infoBoxManager.removeIf((b) => b instanceof PyramidPlunderTimer);
      const pp = ppWidget();
      if (pp != null) pp.setHidden(false);
    }
    onGameStateChanged(event) {
      if (event.getGameState() === GameState.LOADING) { this.tilesToHighlight.clear(); this.objectsToHighlight.length = 0; }
    }
    onGameTick() {
      if (this.isInPyramidPlunder()) {
        if (this.timer == null) {
          const ppTimer = varbit(VarbitID.NTK_PLAYER_TIMER_COUNT);
          const remaining = PYRAMID_PLUNDER_DURATION - ppTimer * 600;
          this.timer = new PyramidPlunderTimer(remaining, rl.itemManager.getImage(ItemID.NTK_JEWELLED_SCEPTRE_3), this, this.config);
          // (the icon may still be loading: read when drawn)
          Object.defineProperty(this.timer, 'image', { get() { return this._img || (this._img = rl.itemManager.getImage(ItemID.NTK_JEWELLED_SCEPTRE_3) || null); }, set(v) { this._img = v; } });
          rl.infoBoxManager.addInfoBox(this.timer);
        }
      } else if (this.timer != null) {
        rl.infoBoxManager.removeInfoBox(this.timer);
        this.timer = null;
      }
    }
    onWallObjectSpawned(event) {
      const object = event.getWallObject();
      if (TOMB_DOOR_WALL_IDS.has(object.getId())) this.tilesToHighlight.set(object, event.getTile());
    }
    onGameObjectSpawned(event) {
      const object = event.getGameObject();
      if (is(object.getId(), SPEARTRAP_ID)) this.tilesToHighlight.set(object, event.getTile());
      else if (URN_IDS.has(object.getId()) || is(object.getId(), GRAND_GOLD_CHEST_IDS) || is(object.getId(), SARCOPHAGUS_IDS)) this.objectsToHighlight.push(object);
    }
    // (2007: the server swaps the loc, so the old state's object goes)
    onWallObjectDespawned(event) { this.dropObject(event.getWallObject()); }
    onGameObjectDespawned(event) { this.dropObject(event.getGameObject()); }
    dropObject(o) {
      for (const k of [...this.tilesToHighlight.keys()]) if (k === o || (k.getId() === o.getId() && k.equals && k.equals(o))) this.tilesToHighlight.delete(k);
      const i = this.objectsToHighlight.findIndex((k) => k === o || (k.getId() === o.getId() && k.equals && k.equals(o)));
      if (i >= 0) this.objectsToHighlight.splice(i, 1);
    }
    isInPyramidPlunder() {
      return client.getLocalPlayer() != null && PYRAMID_PLUNDER_REGION === client.getLocalPlayer().getWorldLocation().getRegionID()
        && varbit(VarbitID.NTK_PLAYER_TIMER_COUNT) > 0;
    }
  }

  const plugin = new PyramidPlunderPlugin();
  ll.__pyramidplunder = { plugin, PyramidPlunderTimer };
  rl.registerPlugin('pyramidplunder', plugin);
})();
