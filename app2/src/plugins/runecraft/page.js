// RuneLite's Runecraft plugin, cloned from net.runelite.client.plugins.runecraft (BSD 2-Clause, Copyright (c) 2017,
// Seth <Sethtroll3@gmail.com> and RuneLite contributors): RunecraftPlugin, RunecraftConfig, AbyssRifts, AbyssOverlay,
// AbyssMinimapOverlay, EssencePouchOverlay.
// 2007 ids: the rifts are the 2007 locs abyss_exit_to_* (7129-7141, blood's is abyss_exit_to_blood), the pouches
// 5509-5515, the Dark mage 2262 (RCU_ZAMMY_MAGE2 by its debug name). Era-trim: no colossal pouch.
// Pouches: the counts are the 2007 cache's varbits 603-606 on varp 486 and the degradation varps 488-490 (OSRS's ids
// under the same names). 2006RS-2: our server keeps them at the same ids and sends them to the client (transmit=yes in
// content _unpack/377/all.varp); the counts are drawn once one of them is not zero, as before.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Skill, Color, Overlay, OverlayPosition, OverlayLayer, WidgetItemOverlay, Perspective, HighlightedNpc, InventoryID } = rl;
  const GROUP = 'runecraft';

  const ObjectID = { ABYSS_EXIT_TO_AIR: 7139, ABYSS_EXIT_TO_BLOOD: 7141, ABYSS_EXIT_TO_BODY: 7131, ABYSS_EXIT_TO_CHAOS: 7134, ABYSS_EXIT_TO_COSMIC: 7132, ABYSS_EXIT_TO_DEATH: 7136, ABYSS_EXIT_TO_EARTH: 7130, ABYSS_EXIT_TO_FIRE: 7129, ABYSS_EXIT_TO_LAW: 7135, ABYSS_EXIT_TO_MIND: 7140, ABYSS_EXIT_TO_NATURE: 7133, ABYSS_EXIT_TO_SOUL: 7138, ABYSS_EXIT_TO_WATER: 7137 };
  const ItemID = { AIRRUNE: 556, BLOODRUNE: 565, BODYRUNE: 559, CHAOSRUNE: 562, COSMICRUNE: 564, DEATHRUNE: 560, EARTHRUNE: 557, FIRERUNE: 554, LAWRUNE: 563, MINDRUNE: 558, NATURERUNE: 561, SOULRUNE: 566, WATERRUNE: 555, RCU_POUCH_SMALL: 5509, RCU_POUCH_MEDIUM: 5510, RCU_POUCH_MEDIUM_DEGRADE: 5511, RCU_POUCH_LARGE: 5512, RCU_POUCH_LARGE_DEGRADE: 5513, RCU_POUCH_GIANT: 5514, RCU_POUCH_GIANT_DEGRADE: 5515 };
  const NpcID = { RCU_ZAMMY_MAGE2: 2262 };
  const VarbitID = { SMALL_ESSENCE_POUCH: 603, MEDIUM_ESSENCE_POUCH: 604, LARGE_ESSENCE_POUCH: 605, GIANT_ESSENCE_POUCH: 606 };
  const VarPlayerID = { ABYSSAL_POUCHES1: 486, RCU_POUCH_DEGRADATION_MED: 488, RCU_POUCH_DEGRADATION_LARGE: 489, RCU_POUCH_DEGRADATION_GIANT: 490 };

  class AbyssRift {
    constructor(name, objectId, itemId, configEnabled) { Object.assign(this, { name, objectId, itemId, configEnabled }); }
    getObjectId() { return this.objectId; } getItemId() { return this.itemId; } getConfigEnabled() { return this.configEnabled; }
  }
  const AbyssRifts = {};
  for (const [name, obj, item, cfg] of [
    ['AIR_RIFT', ObjectID.ABYSS_EXIT_TO_AIR, ItemID.AIRRUNE, 'showAir'],
    ['BLOOD_RIFT', ObjectID.ABYSS_EXIT_TO_BLOOD, ItemID.BLOODRUNE, 'showBlood'],
    ['BODY_RIFT', ObjectID.ABYSS_EXIT_TO_BODY, ItemID.BODYRUNE, 'showBody'],
    ['CHAOS_RIFT', ObjectID.ABYSS_EXIT_TO_CHAOS, ItemID.CHAOSRUNE, 'showChaos'],
    ['COSMIC_RIFT', ObjectID.ABYSS_EXIT_TO_COSMIC, ItemID.COSMICRUNE, 'showCosmic'],
    ['DEATH_RIFT', ObjectID.ABYSS_EXIT_TO_DEATH, ItemID.DEATHRUNE, 'showDeath'],
    ['EARTH_RIFT', ObjectID.ABYSS_EXIT_TO_EARTH, ItemID.EARTHRUNE, 'showEarth'],
    ['FIRE_RIFT', ObjectID.ABYSS_EXIT_TO_FIRE, ItemID.FIRERUNE, 'showFire'],
    ['LAW_RIFT', ObjectID.ABYSS_EXIT_TO_LAW, ItemID.LAWRUNE, 'showLaw'],
    ['MIND_RIFT', ObjectID.ABYSS_EXIT_TO_MIND, ItemID.MINDRUNE, 'showMind'],
    ['NATURE_RIFT', ObjectID.ABYSS_EXIT_TO_NATURE, ItemID.NATURERUNE, 'showNature'],
    ['SOUL_RIFT', ObjectID.ABYSS_EXIT_TO_SOUL, ItemID.SOULRUNE, 'showSoul'],
    ['WATER_RIFT', ObjectID.ABYSS_EXIT_TO_WATER, ItemID.WATERRUNE, 'showWater'],
  ]) AbyssRifts[name] = new AbyssRift(name, obj, item, { test: (config) => config[cfg]() });
  const rifts = new Map(Object.values(AbyssRifts).map((r) => [r.getObjectId(), r]));
  AbyssRifts.getRift = (id) => rifts.get(id) || null;

  const ABYSS_REGION = 12107;

  class AbyssOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_SCENE);
    }
    render(graphics) {
      const player = client.getLocalPlayer();
      if (player == null) return null;
      const region = player.getWorldLocation().getRegionID();
      const abyssObjects = this.plugin.getAbyssObjects();
      const config = this.plugin.config;
      if (region !== ABYSS_REGION || abyssObjects.size === 0 || !config.showRifts() || !config.showClickBox()) return null;
      for (const object of abyssObjects) this.renderRift(graphics, object);
      return null;
    }
    renderRift(graphics, object) {
      const rift = AbyssRifts.getRift(object.getId());
      if (rift == null || !rift.getConfigEnabled().test(this.plugin.config)) return;
      const mousePosition = client.getMouseCanvasPosition();
      const objectClickbox = object.getClickbox();
      if (objectClickbox != null) {
        if (objectClickbox.contains(mousePosition.getX(), mousePosition.getY())) graphics.setColor(Color.MAGENTA.darker());
        else graphics.setColor(Color.MAGENTA);
        graphics.draw(objectClickbox);
        graphics.setColor(new Color(255, 0, 255, 20));
        graphics.fill(objectClickbox);
      }
    }
  }

  const IMAGE_SIZE = { width: 15, height: 14 };
  class AbyssMinimapOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_WIDGETS);
    }
    render(graphics) {
      const player = client.getLocalPlayer();
      if (player == null) return null;
      const region = player.getWorldLocation().getRegionID();
      const config = this.plugin.config;
      if (region !== ABYSS_REGION || !config.showRifts()) return null;
      for (const object of this.plugin.getAbyssObjects()) {
        const rift = AbyssRifts.getRift(object.getId());
        if (rift == null || !rift.getConfigEnabled().test(config)) continue;
        const image = rl.itemManager.getImage(rift.getItemId());
        if (!image) continue;
        // (the 15 x 14 resized icon: drawn scaled)
        const lp = object.getLocalLocation();
        const mini = Perspective.localToMinimap(client, lp);
        if (mini != null) graphics.drawImage(image, mini.getX() - Math.trunc(IMAGE_SIZE.width / 2), mini.getY() - Math.trunc(IMAGE_SIZE.height / 2), IMAGE_SIZE.width, IMAGE_SIZE.height);
      }
      return null;
    }
  }

  class EssPouch {
    constructor(name, amountVarb, getDegradation, degradationLevels, maxFill) { Object.assign(this, { name, amountVarb, getDegradation, degradationLevels, maxFill }); }
    scaleLimit(c, limit) { return limit; }
    maxAmount(c) {
      const deg = this.getDegradationOf(c);
      let limit = this.maxFill;
      for (let i = 0; i < this.degradationLevels.length; i += 2) {
        if (deg >= this.degradationLevels[i]) { limit = this.degradationLevels[i + 1]; break; }
      }
      if (limit > 0) limit = this.scaleLimit(c, limit);
      return limit;
    }
    nextDegradationBreakpoint(c) {
      const deg = this.getDegradation(c);
      for (let i = this.degradationLevels.length - 2; i >= 0; i -= 2) if (deg < this.degradationLevels[i]) return this.degradationLevels[i];
      return deg;
    }
    getDegradationOf(c) { return this.getDegradation == null ? 0 : this.getDegradation(c); }
    getAmount(c) { return c.getVarbitValue(this.amountVarb); }
  }
  const EssPouches = {
    SMALL: new EssPouch('SMALL', VarbitID.SMALL_ESSENCE_POUCH, null, [], 3),
    MEDIUM: new EssPouch('MEDIUM', VarbitID.MEDIUM_ESSENCE_POUCH, (c) => c.getVarpValue(VarPlayerID.RCU_POUCH_DEGRADATION_MED), [800, 0, 400, 3], 6),
    LARGE: new EssPouch('LARGE', VarbitID.LARGE_ESSENCE_POUCH, (c) => c.getVarpValue(VarPlayerID.RCU_POUCH_DEGRADATION_LARGE), [1000, 0, 800, 3, 600, 5, 400, 7], 9),
    GIANT: new EssPouch('GIANT', VarbitID.GIANT_ESSENCE_POUCH, (c) => c.getVarpValue(VarPlayerID.RCU_POUCH_DEGRADATION_GIANT), [1200, 0, 1000, 3, 800, 5, 600, 6, 400, 7, 300, 8, 200, 9], 12),
  };

  class EssencePouchOverlay extends WidgetItemOverlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.showOnInventory();
    }
    static durabilityToEssence(remainingDurability) { return Math.ceil(0.4 * Math.pow(remainingDurability, 1.07)); }
    renderItemOverlay(g, itemId, widgetItem) {
      let pouch; let degraded = false;
      switch (itemId) {
        case ItemID.RCU_POUCH_SMALL: pouch = EssPouches.SMALL; break;
        case ItemID.RCU_POUCH_MEDIUM_DEGRADE: degraded = true; // fallthrough
        case ItemID.RCU_POUCH_MEDIUM: pouch = EssPouches.MEDIUM; break;
        case ItemID.RCU_POUCH_LARGE_DEGRADE: degraded = true; // fallthrough
        case ItemID.RCU_POUCH_LARGE: pouch = EssPouches.LARGE; break;
        case ItemID.RCU_POUCH_GIANT_DEGRADE: degraded = true; // fallthrough
        case ItemID.RCU_POUCH_GIANT: pouch = EssPouches.GIANT; break;
        default: return;
      }
      // (2007: only once the server has sent the pouch varps, see the header)
      if (![VarPlayerID.ABYSSAL_POUCHES1, VarPlayerID.RCU_POUCH_DEGRADATION_MED, VarPlayerID.RCU_POUCH_DEGRADATION_LARGE, VarPlayerID.RCU_POUCH_DEGRADATION_GIANT].some((v) => client.getVarpValue(v) !== 0)) return;
      const config = this.plugin.config;
      const pt = widgetItem.getCanvasLocation();
      if (config.showPouch()) {
        const limit = pouch.maxAmount(client);
        const amount = pouch.getAmount(client);
        g.setColor(amount !== 0 && amount !== limit ? Color.YELLOW : Color.CYAN);
        g.drawString(String(amount), pt.getX(), pt.getY() + 15);
      }
      if (pouch.getDegradation != null && config.pouchDegrade()) {
        const breakpoint = pouch.nextDegradationBreakpoint(client);
        const remDura = breakpoint - pouch.getDegradationOf(client);
        const remEss = EssencePouchOverlay.durabilityToEssence(remDura);
        const limit = pouch.maxAmount(client);
        const remFills = Math.trunc((remEss + limit - 1) / limit);
        if (degraded) g.setColor(Color.RED);
        else if (remFills <= 1) g.setColor(Color.YELLOW);
        else g.setColor(Color.CYAN);
        g.drawString(String(remFills), pt.getX(), pt.getY() + 30);
      }
    }
  }

  const POUCH_DECAYED_NOTIFICATION_MESSAGE = 'Your rune pouch has decayed.';
  const POUCH_DECAYED_MESSAGE = 'Your pouch has decayed through use.';
  const DEGRADED_POUCHES = [ItemID.RCU_POUCH_MEDIUM_DEGRADE, ItemID.RCU_POUCH_LARGE_DEGRADE, ItemID.RCU_POUCH_GIANT_DEGRADE];

  class RunecraftPlugin {
    constructor() {
      this.configGroup = GROUP;
      this.abyssObjects = new Set();
      this.degradedPouchInInventory = false;
      this.highlightDarkMage = (npc) => {
        if (npc.getId() === NpcID.RCU_ZAMMY_MAGE2) {
          return HighlightedNpc.builder().npc(npc).tile(true).highlightColor(Color.GREEN)
            .render(() => this.config.hightlightDarkMage() && this.degradedPouchInInventory).build();
        }
        return null;
      };
    }
    getAbyssObjects() { return this.abyssObjects; }
    startUp() {
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.abyssOverlay = new AbyssOverlay(this);
      this.abyssMinimapOverlay = new AbyssMinimapOverlay(this);
      this.essencePouchOverlay = new EssencePouchOverlay(this);
      rl.npcOverlayService.registerHighlighter(this.highlightDarkMage);
      rl.overlayManager.add(this.abyssOverlay);
      rl.overlayManager.add(this.abyssMinimapOverlay);
      rl.overlayManager.add(this.essencePouchOverlay);
      const inv = client.getItemContainer(InventoryID.INV);
      if (inv) this.onItemContainerChanged({ getContainerId: () => InventoryID.INV, getItemContainer: () => inv });
    }
    shutDown() {
      rl.npcOverlayService.unregisterHighlighter(this.highlightDarkMage);
      rl.overlayManager.remove(this.abyssOverlay);
      rl.overlayManager.remove(this.abyssMinimapOverlay);
      rl.overlayManager.remove(this.essencePouchOverlay);
      this.abyssObjects.clear();
      this.degradedPouchInInventory = false;
    }
    onChatMessage(event) {
      if (event.getType() !== 'GAMEMESSAGE') return;
      if (event.getMessage().includes(POUCH_DECAYED_MESSAGE) && this.config.degradingNotification()) rl.notifier.notify(POUCH_DECAYED_NOTIFICATION_MESSAGE);
    }
    onDecorativeObjectSpawned(event) {
      const decorativeObject = event.getDecorativeObject();
      if (AbyssRifts.getRift(decorativeObject.getId()) != null) this.abyssObjects.add(decorativeObject);
    }
    onDecorativeObjectDespawned(event) {
      const d = event.getDecorativeObject();
      this.abyssObjects.delete(d);
      // (our objects are one per loc: match by id and place as well)
      for (const o of this.abyssObjects) if (o.getId() === d.getId() && o.equals(d)) this.abyssObjects.delete(o);
    }
    onGameStateChanged(event) {
      if (event.getGameState() === rl.GameState.LOADING) this.abyssObjects.clear();
    }
    onItemContainerChanged(event) {
      if (event.getContainerId() !== InventoryID.INV) return;
      const items = event.getItemContainer().getItems();
      this.degradedPouchInInventory = items.some((i) => i && DEGRADED_POUCHES.includes(i.getId()));
      rl.npcOverlayService.rebuild();
    }
  }

  const plugin = new RunecraftPlugin();
  ll.__runecraft = { plugin, AbyssRifts, EssPouches, EssencePouchOverlay };
  rl.registerPlugin('runecraft', plugin);
})();
