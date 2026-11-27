// RuneLite's Mage Training Arena plugin, cloned from net.runelite.client.plugins.mta (BSD 2-Clause, Copyright (c) 2018,
// Jasper Ketelaar <Jasper0781@gmail.com> and RuneLite contributors): MTAPlugin, MTARoom, MTASceneOverlay, MTAItemOverlay,
// alchemy/{AlchemyRoom, AlchemyItem, AlchemyRoomTimer, Cupboard}, graveyard/{GraveyardRoom, GraveyardCounter},
// enchantment/EnchantmentRoom, telekinetic/TelekineticRoom.
// The arena (Jan 2006) isn't built on our server yet; the ids are the 2007 cache's, read from its maps (m52_150 /
// m52_151) and the client's definitions:
// - Region 13462 (m52_150) and the planes are OSRS's: enchantment 0, graveyard 1, alchemy 2.
// - Items 6893-6907 are OSRS's ids (leather boots .. dragonstone, the four bones); the guide cake 7542.
// - Interfaces: alchemy 194, telekinetic 198 (as OSRS), but the 2007 alchemy window lists its items in components 4-8
//   and their points in 9-13 (OSRS: 7-11 and 12-16).
// - Alchemy cupboards: the 2007 room has EIGHT (locs 10783 + 2i closed, 10784 + 2i open, i = 0..7, in a ring: west
//   wall south to north, then east wall north to south); OSRS has six (23678-23689), so NUM_CUPBOARDS is 8 and fill()
//   goes round eight (five items, then empty ones), as the 2007 room's cupboards do.
// - Telekinetic maze: walls 10755 (MAGICTRAINING_MINIWALL, same id), the finish statue pitfall is ground decoration
//   10777 (OSRS 23672), the Maze Guardian npc 3102 (OSRS 6777, MAGICTRAINING_GUARD_MAZE_INCOMPLETE). The 2007 cache has
//   no separate moving guardian (OSRS 6778), so the MAZE_GUARDIAN_MOVING branches never run.
// Hint arrows are the app's own (client.setHintArrow: display only).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Color, Overlay, OverlayPosition, OverlayLayer, WidgetItemOverlay, FontManager, Perspective, Counter, Timer,
    InventoryID, LocalPoint, WorldPoint, WorldArea, Rectangle, GameState } = rl;
  const GROUP = 'mta';
  const MTA_REGION = 13462;

  // ItemID
  const ItemID = {
    MAGICTRAINING_LEATHER_BOOTS: 6893, MAGICTRAINING_ADAMANT_KITESHIELD: 6894, MAGICTRAINING_ADAMANT_MED_HELM: 6895,
    MAGICTRAINING_EMERALD: 6896, MAGICTRAINING_RUNE_LONGSWORD: 6897, MAGICTRAINING_DRAGONSTONE: 6903,
    MAGICTRAINING_BONES1: 6904, MAGICTRAINING_BONES2: 6905, MAGICTRAINING_BONES3: 6906, MAGICTRAINING_BONES4: 6907,
    _100GUIDE_GUIDECAKE: 7542,
  };
  // ObjectID / NpcID / InterfaceID (2007 cache, see the header)
  const NUM_CUPBOARDS = 8;
  const CUPBOARD_FIRST = 10783;
  const MAGICTRAINING_MINIWALL = 10755;
  const MAGICTRAINING_MINI_STATUE_PITFALL = 10777;
  const MAGICTRAINING_GUARD_MAZE_INCOMPLETE = 3102;
  const MAGICTRAINING_GUARD_MAZE_MOVING = null;
  const MAGICTRAINING_ALCHEM = 194;
  const MAGICTRAINING_TELE = 198;

  class MTARoom {
    constructor(config) { this.config = config; }
    getConfig() { return this.config; }
    inside() { return false; }
    under() {}
    renderItemOverlay() {}
  }

  // ---- alchemy
  const AlchemyItem = {};
  const ALCHEMY_ITEMS = [];
  for (const [n, name, id] of [
    ['LEATHER_BOOTS', 'Leather Boots', ItemID.MAGICTRAINING_LEATHER_BOOTS],
    ['ADAMANT_KITESHIELD', 'Adamant Kiteshield', ItemID.MAGICTRAINING_ADAMANT_KITESHIELD],
    ['ADAMANT_MED_HELM', 'Helm', ItemID.MAGICTRAINING_ADAMANT_MED_HELM],
    ['EMERALD', 'Emerald', ItemID.MAGICTRAINING_EMERALD],
    ['RUNE_LONGSWORD', 'Rune Longsword', ItemID.MAGICTRAINING_RUNE_LONGSWORD],
    ['EMPTY', '', -1],
    ['UNKNOWN', 'Unknown', ItemID._100GUIDE_GUIDECAKE],
  ]) {
    const it = { name: n, ordinal: ALCHEMY_ITEMS.length, getName: () => name, getId: () => id, toString: () => n };
    AlchemyItem[n] = it; ALCHEMY_ITEMS.push(it);
  }
  AlchemyItem.values = () => ALCHEMY_ITEMS.slice();
  AlchemyItem.find = (item) => ALCHEMY_ITEMS.find((a) => item.toLowerCase().includes(a.getName().toLowerCase())) || null;

  class AlchemyRoomTimer extends Timer {
    constructor(plugin) {
      super(60 * 1000, plugin.resources['reset.png'] || null, plugin);
      this.setTooltip('Time until items swap');
    }
  }
  class Cupboard { constructor() { this.gameObject = null; this.alchemyItem = null; } }

  const IMAGE_Z_OFFSET = 150;
  const INFO_ITEM_START = 4; // (OSRS: 7)
  const INFO_POINT_START = 9; // (OSRS: 12)
  const INFO_LENGTH = 5;
  const BEST_POINTS = 30;
  const YOU_FOUND = 'You found:';
  const EMPTY = 'The cupboard is empty.';

  class AlchemyRoom extends MTARoom {
    constructor(config, plugin) {
      super(config);
      this.plugin = plugin;
      this.cupboards = new Array(NUM_CUPBOARDS).fill(null);
      this.best = null; this.suggestion = null; this.hintSet = false;
    }
    onGameTick() {
      if (!this.inside() || !this.config.alchemy()) return;
      const bestItem = this.getBest();
      if (this.best == null || this.best !== bestItem) {
        if (this.best != null) {
          rl.infoBoxManager.removeIf((e) => e instanceof AlchemyRoomTimer);
          rl.infoBoxManager.addInfoBox(new AlchemyRoomTimer(this.plugin));
        }
        this.best = bestItem;
        for (const e of this.cupboards) if (e) e.alchemyItem = AlchemyItem.UNKNOWN;
        client.clearHintArrow();
      }
      this.suggestion = this.getSuggestion();
    }
    onGameObjectSpawned(event) {
      if (!this.inside()) return;
      const spawn = event.getGameObject();
      const id = spawn.getId();
      if (id < CUPBOARD_FIRST || id >= CUPBOARD_FIRST + NUM_CUPBOARDS * 2) return;
      const cupboardId = (id - CUPBOARD_FIRST) >> 1; // (closed and open)
      let cupboard = this.cupboards[cupboardId];
      if (cupboard != null) {
        cupboard.gameObject = spawn;
      } else {
        cupboard = new Cupboard();
        cupboard.gameObject = spawn;
        cupboard.alchemyItem = AlchemyItem.UNKNOWN;
        this.cupboards[cupboardId] = cupboard;
      }
    }
    onGameStateChanged(event) {
      if (event.getGameState() === GameState.LOGGED_IN && !this.inside()) {
        this.reset();
        if (this.hintSet) { client.clearHintArrow(); this.hintSet = false; }
      }
    }
    onChatMessage(wrapper) {
      if (!this.inside() || !this.config.alchemy()) return;
      const message = wrapper.getMessage();
      if (wrapper.getType() !== 'GAMEMESSAGE') return;
      if (message.includes(YOU_FOUND)) {
        const item = message.replace(YOU_FOUND, '').trim();
        const alchemyItem = AlchemyItem.find(item);
        const clicked = this.getClicked();
        if (clicked && clicked.alchemyItem !== alchemyItem) this.fill(clicked, alchemyItem);
      } else if (message === EMPTY) {
        const clicked = this.getClicked();
        if (clicked && clicked.alchemyItem !== AlchemyItem.EMPTY) this.fill(clicked, AlchemyItem.EMPTY);
      }
    }
    reset() { this.cupboards.fill(null); }
    inside() {
      const player = client.getLocalPlayer();
      return player != null && player.getWorldLocation().getRegionID() === MTA_REGION && player.getWorldLocation().getPlane() === 2;
    }
    getBest() {
      for (let i = 0; i < INFO_LENGTH; i++) {
        const textWidget = client.getWidget(MAGICTRAINING_ALCHEM, INFO_ITEM_START + i);
        if (textWidget == null) return null;
        const item = textWidget.getText();
        const pointsWidget = client.getWidget(MAGICTRAINING_ALCHEM, INFO_POINT_START + i);
        const points = parseInt(pointsWidget ? pointsWidget.getText() : '', 10);
        if (points === BEST_POINTS) return AlchemyItem.find(item);
      }
      return null;
    }
    getClicked() {
      let nearest = null; let distance = Number.MAX_VALUE;
      const mine = client.getLocalPlayer().getWorldLocation();
      for (const cupboard of this.cupboards) {
        if (cupboard == null) continue;
        const objectDistance = cupboard.gameObject.getWorldLocation().distanceTo(mine);
        if (nearest == null || objectDistance < distance) { nearest = cupboard; distance = objectDistance; }
      }
      return nearest;
    }
    fill(cupboard, alchemyItem) {
      const idx = this.cupboards.indexOf(cupboard);
      const itemIdx = alchemyItem.ordinal;
      for (let i = 0; i < NUM_CUPBOARDS; ++i) {
        const cupIdx = (idx + i) % NUM_CUPBOARDS;
        const itemIndex = (itemIdx + i) % NUM_CUPBOARDS;
        if (this.cupboards[cupIdx]) this.cupboards[cupIdx].alchemyItem = itemIndex <= 4 ? ALCHEMY_ITEMS[itemIndex] : AlchemyItem.EMPTY;
      }
    }
    under(graphics) {
      if (!this.getConfig().alchemy() || this.best == null || !this.inside()) return;
      let found = false;
      for (const cupboard of this.cupboards) {
        if (cupboard == null) continue;
        const object = cupboard.gameObject;
        const alchemyItem = cupboard.alchemyItem;
        if (alchemyItem === AlchemyItem.EMPTY) continue;
        if (alchemyItem === this.best) {
          client.setHintArrow(object.getWorldLocation());
          found = true;
          this.hintSet = true;
        }
        const image = rl.itemManager.getImage(alchemyItem.getId());
        if (!image) continue;
        const canvasLoc = Perspective.getCanvasImageLocation(client, object.getLocalLocation(), image, IMAGE_Z_OFFSET);
        if (canvasLoc != null) graphics.drawImage(image, canvasLoc.getX(), canvasLoc.getY(), null);
      }
      if (!found && this.suggestion != null) {
        client.setHintArrow(this.suggestion.gameObject.getWorldLocation());
        this.hintSet = true;
      }
    }
    getSuggestion() {
      if (this.best != null) for (const cupboard of this.cupboards) if (cupboard != null && cupboard.alchemyItem === this.best) return cupboard;
      return null;
    }
    renderItemOverlay(graphics, itemId, widgetItem) {
      if (this.best == null || this.best.getId() !== itemId || !this.config.alchemy()) return;
      const bounds = widgetItem.getCanvasBounds();
      graphics.setColor(Color.GREEN);
      graphics.draw(bounds);
    }
  }

  // ---- graveyard
  const MIN_SCORE = 16;
  class GraveyardCounter extends Counter {
    constructor(image, plugin) { super(image, plugin, 0); }
    // (the item icon can be null until the client has drawn it once)
    getImage() { return this.image || (this.image = rl.itemManager.getImage(ItemID.MAGICTRAINING_BONES1)); }
    getTextColor() {
      const count = this.getCount();
      if (count >= MIN_SCORE) return Color.GREEN;
      else if (count === 0) return Color.RED;
      return Color.ORANGE;
    }
  }
  class GraveyardRoom extends MTARoom {
    constructor(config, plugin) { super(config); this.plugin = plugin; this.score = 0; this.counter = null; }
    inside() {
      const player = client.getLocalPlayer();
      return player != null && player.getWorldLocation().getRegionID() === MTA_REGION && player.getWorldLocation().getPlane() === 1;
    }
    onGameTick() {
      if (!this.inside() || !this.config.graveyard()) {
        if (this.counter != null) {
          rl.infoBoxManager.removeIf((e) => e instanceof GraveyardCounter);
          this.counter = null;
        }
      }
    }
    onItemContainerChanged(event) {
      if (!this.inside()) return;
      if (event.getContainerId() === InventoryID.INV) {
        this.score = this.scoreOf(event.getItemContainer().getItems());
        if (this.counter == null) {
          const image = rl.itemManager.getImage(ItemID.MAGICTRAINING_BONES1);
          this.counter = new GraveyardCounter(image, this.plugin);
          rl.infoBoxManager.addInfoBox(this.counter);
        }
        this.counter.setCount(this.score);
      }
    }
    scoreOf(items) {
      let score = 0;
      if (items == null) return score;
      for (const item of items) score += GraveyardRoom.getPoints(item.getId());
      return score;
    }
    static getPoints(id) {
      switch (id) {
        case ItemID.MAGICTRAINING_BONES1: return 1;
        case ItemID.MAGICTRAINING_BONES2: return 2;
        case ItemID.MAGICTRAINING_BONES3: return 3;
        case ItemID.MAGICTRAINING_BONES4: return 4;
        default: return 0;
      }
    }
  }

  // ---- enchantment
  class EnchantmentRoom extends MTARoom {
    constructor(config) { super(config); this.dragonstones = []; this.hintSet = false; }
    onGameStateChanged(event) {
      if (event.getGameState() === GameState.LOADING) {
        this.dragonstones.length = 0;
        if (this.hintSet) { client.clearHintArrow(); this.hintSet = false; }
      }
    }
    onGameTick() {
      if (!this.inside() || !this.config.enchantment()) return;
      const nearest = this.findNearestStone();
      if (nearest != null) { client.setHintArrow(nearest); this.hintSet = true; }
      else { client.clearHintArrow(); this.hintSet = false; }
    }
    findNearestStone() {
      let nearest = null; let dist = Number.MAX_VALUE;
      const local = client.getLocalPlayer().getWorldLocation();
      for (const worldPoint of this.dragonstones) {
        const currDist = local.distanceTo(worldPoint);
        if (nearest == null || currDist < dist) { dist = currDist; nearest = worldPoint; }
      }
      return nearest;
    }
    onItemSpawned(itemSpawned) {
      if (itemSpawned.getItem().getId() === ItemID.MAGICTRAINING_DRAGONSTONE) this.dragonstones.push(itemSpawned.getTile().getWorldLocation());
    }
    onItemDespawned(itemDespawned) {
      if (itemDespawned.getItem().getId() !== ItemID.MAGICTRAINING_DRAGONSTONE) return;
      const location = itemDespawned.getTile().getWorldLocation();
      const i = this.dragonstones.findIndex((p) => p.equals(location));
      if (i !== -1) this.dragonstones.splice(i, 1);
    }
    inside() {
      const player = client.getLocalPlayer();
      return player != null && player.getWorldLocation().getRegionID() === MTA_REGION && player.getWorldLocation().getPlane() === 0;
    }
  }

  // ---- telekinetic
  const { Direction, Angle } = rl;
  const wpKey = (p) => `${p.x},${p.y},${p.plane}`;
  class TelekineticRoom extends MTARoom {
    constructor(config) {
      super(config);
      this.telekineticWalls = []; this.moves = []; this.destination = null; this.location = null; this.finishLocation = null;
      this.bounds = null; this.guardian = null; this.numMazeWalls = 0;
    }
    resetRoom() { this.finishLocation = null; this.telekineticWalls.length = 0; }
    onWallObjectSpawned(event) {
      const wall = event.getWallObject();
      if (wall.getId() !== MAGICTRAINING_MINIWALL) return;
      this.telekineticWalls.push(wall);
    }
    onGameStateChanged(event) { if (event.getGameState() === GameState.LOADING) this.resetRoom(); }
    onGroundObjectSpawned(event) {
      const object = event.getGroundObject();
      if (object.getId() === MAGICTRAINING_MINI_STATUE_PITFALL) this.finishLocation = object.getWorldLocation();
    }
    onGameTick() {
      if (!this.inside() || !this.config.telekinetic()) {
        this.numMazeWalls = 0;
        this.moves.length = 0;
        return;
      }
      if (this.telekineticWalls.length !== this.numMazeWalls) {
        this.bounds = this.getBounds(this.telekineticWalls);
        this.numMazeWalls = this.telekineticWalls.length;
        client.clearHintArrow();
      } else if (this.guardian != null) {
        let current;
        if (this.guardian.getId() === MAGICTRAINING_GUARD_MAZE_MOVING) {
          this.destination = this.getGuardianDestination();
          current = WorldPoint.fromLocal(client, this.destination);
        } else {
          this.destination = null;
          current = this.guardian.getWorldLocation();
        }
        if (current.equals(this.location)) return;
        this.location = current;
        if (this.location.equals(this.finishLocation)) client.clearHintArrow();
        else this.moves = this.build();
      } else {
        client.clearHintArrow();
        this.moves.length = 0;
      }
    }
    onNpcSpawned(event) {
      const npc = event.getNpc();
      if (npc.getId() === MAGICTRAINING_GUARD_MAZE_INCOMPLETE || npc.getId() === MAGICTRAINING_GUARD_MAZE_MOVING) this.guardian = npc;
    }
    onNpcDespawned(event) { if (event.getNpc() === this.guardian) this.guardian = null; }
    inside() { return client.getWidget(MAGICTRAINING_TELE, 0) != null; }
    under(graphics2D) {
      if (this.inside() && this.numMazeWalls > 0 && this.guardian != null) {
        if (this.destination != null) {
          graphics2D.setColor(Color.ORANGE);
          this.renderLocalPoint(graphics2D, this.destination);
        }
        if (this.moves.length > 0) {
          if (this.guardian.getId() === MAGICTRAINING_GUARD_MAZE_MOVING) graphics2D.setColor(Color.YELLOW);
          else if (this.moves[this.moves.length - 1] === this.getPosition()) graphics2D.setColor(Color.GREEN);
          else graphics2D.setColor(Color.RED);
          const tile = Perspective.getCanvasTilePoly(client, this.guardian.getLocalLocation());
          if (tile != null) graphics2D.drawPolygon(tile);
          const optimal = this.optimal(0);
          if (optimal != null) {
            client.setHintArrow(optimal);
            this.renderWorldPoint(graphics2D, optimal);
          }
        }
        if (this.moves.length >= 2) {
          const optimal = this.optimal(1);
          if (optimal != null) {
            graphics2D.setColor(Color.CYAN);
            this.renderWorldPoint(graphics2D, optimal);
          }
        }
      }
    }
    optimal(index) {
      const current = client.getLocalPlayer().getWorldLocation();
      const next = this.moves[this.moves.length - 1 - index];
      const areaNext = this.getIndicatorLine(next);
      const nearestNext = this.nearest(areaNext, current);
      if (this.moves.length <= 1 + index) return nearestNext;
      const after = this.moves[this.moves.length - 2 - index];
      const areaAfter = this.getIndicatorLine(after);
      const nearestAfter = this.nearest(areaAfter, nearestNext);
      return this.nearest(areaNext, nearestAfter);
    }
    static manhattan(p1, p2) { return Math.abs(p1.getX() - p2.getX()) + Math.abs(p2.getY() - p1.getY()); }
    nearest(area, worldPoint) {
      let dist = Number.MAX_SAFE_INTEGER; let nearest = null;
      for (const areaPoint of area.toWorldPointList()) {
        const currDist = TelekineticRoom.manhattan(areaPoint, worldPoint);
        if (nearest == null || dist > currDist) { nearest = areaPoint; dist = currDist; }
      }
      return nearest;
    }
    renderWorldPoint(graphics, worldPoint) { this.renderLocalPoint(graphics, LocalPoint.fromWorld(client, worldPoint)); }
    renderLocalPoint(graphics, local) {
      if (local != null) {
        const canvasTilePoly = Perspective.getCanvasTilePoly(client, local);
        if (canvasTilePoly != null) graphics.drawPolygon(canvasTilePoly);
      }
    }
    build(start) {
      if (start === undefined) {
        if (this.guardian.getId() === MAGICTRAINING_GUARD_MAZE_MOVING) return this.build(WorldPoint.fromLocal(client, this.getGuardianDestination()));
        return this.build(this.guardian.getWorldLocation());
      }
      const visit = [];
      const closed = new Set();
      const scores = new Map();
      const edges = new Map();
      scores.set(wpKey(start), 0);
      visit.push(start);
      while (visit.length > 0) {
        const next = visit.shift();
        closed.add(wpKey(next));
        const localNext = LocalPoint.fromWorld(client, next);
        if (localNext == null) continue;
        for (const neighbour of this.neighbours(localNext)) {
          if (neighbour == null) continue;
          const nghbWorld = WorldPoint.fromLocal(client, neighbour);
          if (!nghbWorld.equals(next) && !closed.has(wpKey(nghbWorld))) {
            const score = scores.get(wpKey(next)) + 1;
            if (!scores.has(wpKey(nghbWorld)) || scores.get(wpKey(nghbWorld)) > score) {
              scores.set(wpKey(nghbWorld), score);
              edges.set(wpKey(nghbWorld), [nghbWorld, next]);
              visit.push(nghbWorld);
            }
          }
        }
      }
      return this.buildPath(edges, this.finishLocation);
    }
    buildPath(edges, finish) {
      const path = [];
      let current = finish;
      while (current && edges.has(wpKey(current))) {
        const next = edges.get(wpKey(current))[1];
        if (next.getX() > current.getX()) path.push(Direction.WEST);
        else if (next.getX() < current.getX()) path.push(Direction.EAST);
        else if (next.getY() > current.getY()) path.push(Direction.SOUTH);
        else path.push(Direction.NORTH);
        current = next;
      }
      return path;
    }
    getGuardianDestination() {
      const angle = new Angle(this.guardian.getOrientation());
      return this.neighbour(this.guardian.getLocalLocation(), angle.getNearestDirection());
    }
    neighbours(point) {
      return [this.neighbour(point, Direction.NORTH), this.neighbour(point, Direction.SOUTH),
        this.neighbour(point, Direction.EAST), this.neighbour(point, Direction.WEST)];
    }
    neighbour(point, direction) {
      let worldPoint = WorldPoint.fromLocal(client, point);
      let area = worldPoint.toWorldArea();
      const [dx, dy] = { NORTH: [0, 1], SOUTH: [0, -1], EAST: [1, 0], WEST: [-1, 0] }[direction];
      let guard = 0;
      while (area.canTravelInDirection(client.getTopLevelWorldView(), dx, dy) && guard++ < 104) {
        worldPoint = area.toWorldPoint().dx(dx).dy(dy);
        area = worldPoint.toWorldArea();
      }
      return LocalPoint.fromWorld(client, worldPoint);
    }
    getBounds(walls) {
      let minX = Number.MAX_SAFE_INTEGER; let minY = Number.MAX_SAFE_INTEGER;
      let maxX = Number.MIN_SAFE_INTEGER; let maxY = Number.MIN_SAFE_INTEGER;
      for (const wall of walls) {
        const point = wall.getWorldLocation();
        minX = Math.min(minX, point.getX()); minY = Math.min(minY, point.getY());
        maxX = Math.max(maxX, point.getX()); maxY = Math.max(maxY, point.getY());
      }
      return new Rectangle(minX, minY, maxX - minX, maxY - minY);
    }
    getPosition() {
      const mine = client.getLocalPlayer().getWorldLocation();
      const b = this.bounds;
      if (mine.getY() >= b.getMaxY() && mine.getX() < b.getMaxX() && mine.getX() > b.getX()) return Direction.NORTH;
      else if (mine.getY() <= b.getY() && mine.getX() < b.getMaxX() && mine.getX() > b.getX()) return Direction.SOUTH;
      else if (mine.getX() >= b.getMaxX() && mine.getY() < b.getMaxY() && mine.getY() > b.getY()) return Direction.EAST;
      else if (mine.getX() <= b.getX() && mine.getY() < b.getMaxY() && mine.getY() > b.getY()) return Direction.WEST;
      return null;
    }
    getIndicatorLine(direction) {
      const b = this.bounds;
      switch (direction) {
        case Direction.NORTH: return new WorldArea(b.x + 1, b.getMaxY(), b.width - 1, 1, 0);
        case Direction.SOUTH: return new WorldArea(b.x + 1, b.y, b.width - 1, 1, 0);
        case Direction.WEST: return new WorldArea(b.x, b.y + 1, 1, b.height - 1, 0);
        case Direction.EAST: return new WorldArea(b.getMaxX(), b.y + 1, 1, b.height - 1, 0);
        default: return null;
      }
    }
  }

  // ---- overlays
  class MTASceneOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_SCENE);
    }
    render(graphics) {
      for (const room of this.plugin.getRooms()) {
        if (room.inside()) {
          graphics.setFont(FontManager.getRunescapeFont());
          room.under(graphics);
        }
      }
      return null;
    }
  }
  class MTAItemOverlay extends WidgetItemOverlay {
    constructor(plugin) { super(plugin); this.plugin = plugin; this.showOnInventory(); }
    renderItemOverlay(graphics, itemId, widgetItem) {
      for (const room of this.plugin.getRooms()) if (room.inside()) room.renderItemOverlay(graphics, itemId, widgetItem);
    }
  }

  const EVENTS = ['onGameTick', 'onGameObjectSpawned', 'onGameStateChanged', 'onChatMessage', 'onItemContainerChanged',
    'onItemSpawned', 'onItemDespawned', 'onWallObjectSpawned', 'onGroundObjectSpawned', 'onNpcSpawned', 'onNpcDespawned'];
  class MTAPlugin {
    constructor() { this.configGroup = GROUP; this.rooms = []; }
    getRooms() { return this.rooms; }
    startUp() {
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.alchemyRoom = new AlchemyRoom(this.config, this);
      this.graveyardRoom = new GraveyardRoom(this.config, this);
      this.telekineticRoom = new TelekineticRoom(this.config);
      this.enchantmentRoom = new EnchantmentRoom(this.config);
      this.sceneOverlay = new MTASceneOverlay(this);
      this.itemOverlay = new MTAItemOverlay(this);
      rl.overlayManager.add(this.sceneOverlay);
      rl.overlayManager.add(this.itemOverlay);
      // (eventBus.register(room): the plugin's handlers pass each event to the rooms)
      this.rooms = [this.alchemyRoom, this.graveyardRoom, this.telekineticRoom, this.enchantmentRoom];
    }
    shutDown() {
      rl.overlayManager.remove(this.sceneOverlay);
      rl.overlayManager.remove(this.itemOverlay);
      this.rooms = [];
      if (this.telekineticRoom) this.telekineticRoom.resetRoom();
    }
  }
  for (const m of EVENTS) {
    MTAPlugin.prototype[m] = function dispatch(event) { for (const room of this.rooms) if (typeof room[m] === 'function') room[m](event); };
  }

  const plugin = new MTAPlugin();
  ll.__mta = { plugin, AlchemyItem, AlchemyRoom, GraveyardRoom, TelekineticRoom, EnchantmentRoom, GraveyardCounter, AlchemyRoomTimer };
  rl.registerPlugin('mta', plugin);
})();
