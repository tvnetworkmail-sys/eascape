// RuneLite's Interact Highlight plugin, cloned from net.runelite.client.plugins.interacthighlight (BSD 2-Clause,
// Copyright (c) 2021, Adam <Adam@sigterm.info>): InteractHighlightPlugin, InteractHighlightOverlay.
// The outlines are the core's ModelOutlineRenderer (corea.js: the models' triangles as the client drew them).
// 2007: the menu's object entries carry the loc's scene tag (its id in the high bits); scene x / y are param0 / param1
// on the 104-square scene (no extended scene offset). Our actors and tile items are snapshots, so "the same one" is
// compared by NPC / player index and by item id on the same square. A spell cast on an NPC counts as an attack when
// its option is "Cast" (InterfaceID.MAGIC_SPELLBOOK's selected widget in RuneLite; the 2007 spell entry says Cast).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Color, ColorUtil, Overlay, OverlayPosition, OverlayLayer, MenuAction, GameState } = rl;
  const M = MenuAction;

  const OBJECT_OPS = [M.WIDGET_TARGET_ON_GAME_OBJECT, M.ITEM_USE_ON_GAME_OBJECT, M.GAME_OBJECT_FIRST_OPTION, M.GAME_OBJECT_SECOND_OPTION,
    M.GAME_OBJECT_THIRD_OPTION, M.GAME_OBJECT_FOURTH_OPTION, M.GAME_OBJECT_FIFTH_OPTION];
  const NPC_OPS = [M.WIDGET_TARGET_ON_NPC, M.ITEM_USE_ON_NPC, M.NPC_FIRST_OPTION, M.NPC_SECOND_OPTION, M.NPC_THIRD_OPTION, M.NPC_FOURTH_OPTION, M.NPC_FIFTH_OPTION];
  const PLAYER_OPS = [M.WIDGET_TARGET_ON_PLAYER, M.ITEM_USE_ON_PLAYER, M.PLAYER_FIRST_OPTION, M.PLAYER_SECOND_OPTION, M.PLAYER_THIRD_OPTION,
    M.PLAYER_FOURTH_OPTION, M.PLAYER_FIFTH_OPTION, M.PLAYER_SIXTH_OPTION, M.PLAYER_SEVENTH_OPTION, M.PLAYER_EIGHTH_OPTION];
  const ITEM_OPS = [M.WIDGET_TARGET_ON_GROUND_ITEM, M.GROUND_ITEM_FIRST_OPTION, M.GROUND_ITEM_SECOND_OPTION, M.GROUND_ITEM_THIRD_OPTION,
    M.GROUND_ITEM_FOURTH_OPTION, M.GROUND_ITEM_FIFTH_OPTION];
  // the 2007 opcodes RuneLite's names share (WIDGET_TARGET is 25 for both ground items and widgets): an entry's
  // type, deprioritized ones (+2000) included
  const typeOf = (t) => { t = Number(t) | 0; return t >= 2000 ? t - 2000 : t; };
  // a loc entry's identifier: the scene tag (id in the high bits) or the id
  const locId = (raw) => (typeof raw === 'bigint' ? Number((raw >> 32n) & 0x7fffffffn)
    : Number(raw) > 0x7fffffff ? Math.floor(Number(raw) / 4294967296) & 0x7fffffff : Number(raw) | 0);
  const sameActor = (a, b) => !!a && !!b && a.constructor === b.constructor && a.getIndex() === b.getIndex();
  const isNpc = (a) => !!a && a.info && (a.info.typecode & 0x20000000) !== 0;

  const INTERACT_CLICK_COLOR = new Color(0xff, 0xff, 0xff, 0x90);
  class InteractHighlightOverlay extends Overlay {
    constructor(plugin, config) {
      super(plugin);
      this.plugin = plugin; this.config = config;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_SCENE);
      this.setPriority('HIGH');
    }
    render() {
      this.renderMouseover();
      this.renderTarget();
      return null;
    }
    renderMouseover() {
      const menuEntries = client.getMenuEntries();
      if (menuEntries.length === 0) return;
      const entry = client.isMenuOpen() ? this.hoveredMenuEntry(menuEntries) : menuEntries[menuEntries.length - 1];
      const menuAction = typeOf(entry.getType());
      const config = this.config; const plugin = this.plugin; const mor = rl.modelOutlineRenderer;
      if (OBJECT_OPS.includes(menuAction) || menuAction === M.EXAMINE_OBJECT) {
        const tileObject = plugin.findTileObject(entry.getWorldViewId(), entry.getParam0(), entry.getParam1(), locId(entry.getIdentifier()));
        if (tileObject != null && config.objectShowHover() && (!plugin.sameObject(tileObject, plugin.getInteractedObject()) || !config.objectShowInteract())) {
          mor.drawOutline(tileObject, config.borderWidth(), config.objectHoverHighlightColor(), config.outlineFeather());
        }
      } else if (ITEM_OPS.includes(menuAction) || menuAction === M.EXAMINE_ITEM_GROUND) {
        const layer = plugin.findItemLayer(entry.getWorldViewId(), entry.getParam0(), entry.getParam1());
        const item = plugin.findItem(layer, Number(entry.getIdentifier()) | 0);
        if (item != null && config.itemShowHover() && (!plugin.sameItem(item, plugin.getInteractedItem()) || !config.itemShowInteract())) {
          mor.drawOutline(layer, item, config.borderWidth(), config.itemHoverHighlightColor(), config.outlineFeather());
        }
      } else if (NPC_OPS.includes(menuAction) || menuAction === M.EXAMINE_NPC) {
        const npc = entry.getNpc();
        if (npc != null && config.npcShowHover() && (!sameActor(npc, plugin.getInteractedActor()) || !config.npcShowInteract())) {
          const highlightColor = menuAction === M.NPC_SECOND_OPTION || (menuAction === M.WIDGET_TARGET_ON_NPC && plugin.isSpellEntry(entry))
            ? config.npcAttackHoverHighlightColor() : config.npcHoverHighlightColor();
          mor.drawOutline(npc, config.borderWidth(), highlightColor, config.outlineFeather());
        }
      } else if (PLAYER_OPS.includes(menuAction)) {
        const player = entry.getPlayer();
        if (player != null && config.playerShowHover() && (!sameActor(player, plugin.getInteractedActor()) || !config.npcShowInteract())) {
          mor.drawOutline(player, config.borderWidth(), config.playerHoverHighlightColor(), config.outlineFeather());
        }
      }
    }
    renderTarget() {
      const config = this.config; const plugin = this.plugin; const mor = rl.modelOutlineRenderer;
      const interactedObject = plugin.getInteractedObject();
      const item = plugin.getInteractedItem();
      if (item != null && interactedObject != null && config.itemShowInteract()) {
        const clickColor = this.getClickColor(config.itemHoverHighlightColor(), config.itemInteractHighlightColor(), client.getGameCycle() - plugin.getGameCycle());
        mor.drawOutline(interactedObject, item, config.borderWidth(), clickColor, config.outlineFeather());
      } else if (interactedObject != null && item == null && config.objectShowInteract()) {
        const clickColor = this.getClickColor(config.objectHoverHighlightColor(), config.objectInteractHighlightColor(), client.getGameCycle() - plugin.getGameCycle());
        mor.drawOutline(interactedObject, config.borderWidth(), clickColor, config.outlineFeather());
      }
      const target = plugin.getInteractedActor();
      if (target != null && isNpc(target) && config.npcShowInteract()) {
        const startColor = plugin.isAttacked() ? config.npcAttackHoverHighlightColor() : config.npcHoverHighlightColor();
        const endColor = plugin.isAttacked() ? config.npcAttackHighlightColor() : config.npcInteractHighlightColor();
        const clickColor = this.getClickColor(startColor, endColor, client.getGameCycle() - plugin.getGameCycle());
        mor.drawOutline(target, config.borderWidth(), clickColor, config.outlineFeather());
      } else if (target != null && !isNpc(target) && config.playerShowInteract()) {
        const clickColor = this.getClickColor(config.playerHoverHighlightColor(), config.playerInteractHighlightColor(), client.getGameCycle() - plugin.getGameCycle());
        mor.drawOutline(target, config.borderWidth(), clickColor, config.outlineFeather());
      }
    }
    getClickColor(start, end, time) {
      if (time < 5) return ColorUtil.colorLerp(start, INTERACT_CLICK_COLOR, time / 5);
      else if (time < 10) return ColorUtil.colorLerp(INTERACT_CLICK_COLOR, end, (time - 5) / 5);
      return end;
    }
    hoveredMenuEntry(menuEntries) {
      const menuX = client.getMenuX();
      const menuY = client.getMenuY();
      const menuWidth = client.getMenuWidth();
      const mousePosition = client.getMouseCanvasPosition();
      let dy = mousePosition.getY() - menuY;
      dy -= 19; // Height of Choose Option
      if (dy < 0) return menuEntries[menuEntries.length - 1];
      let idx = Math.trunc(dy / 15); // Height of each menu option
      idx = menuEntries.length - 1 - idx;
      if (mousePosition.getX() > menuX && mousePosition.getX() < menuX + menuWidth && idx >= 0 && idx < menuEntries.length) return menuEntries[idx];
      return menuEntries[menuEntries.length - 1];
    }
  }

  class InteractHighlightPlugin {
    constructor() {
      this.configGroup = 'interacthighlight';
      this.config = rl.configProxy(this.configGroup, () => this.configItems);
      this.overlay = new InteractHighlightOverlay(this, this.config);
      this.interactedObject = null; this.interactedItem = null; this.interactedActor = null;
      this.attacked = false; this.clickTick = 0; this.gameCycle = 0;
    }
    getInteractedObject() { return this.interactedObject; }
    getInteractedItem() { return this.interactedItem; }
    getInteractedActor() {
      // our actors are snapshots: the live one with the same index
      const a = this.interactedActor;
      if (a == null) return null;
      if (isNpc(a)) return client.getNpcs().find((n) => n.getIndex() === a.getIndex()) || null;
      return client.getPlayers().find((p) => p.getIndex() === a.getIndex()) || null;
    }
    isAttacked() { return this.attacked; }
    getGameCycle() { return this.gameCycle; }
    startUp() { rl.overlayManager.add(this.overlay); }
    shutDown() { rl.overlayManager.remove(this.overlay); }
    onGameStateChanged(e) { if (e.getGameState() === GameState.LOADING) this.interactedObject = null; }
    onNpcSpawned(event) {
      const localPlayer = client.getLocalPlayer(); const npc = event.getNpc();
      if (localPlayer != null && sameActor(npc, localPlayer.getInteracting())) this.interactedActor = npc;
    }
    onNpcDespawned(event) { if (sameActor(event.getNpc(), this.interactedActor)) this.interactedActor = null; }
    onPlayerSpawned(event) {
      const localPlayer = client.getLocalPlayer(); const otherPlayer = event.getPlayer();
      if (localPlayer != null && sameActor(otherPlayer, localPlayer.getInteracting())) this.interactedActor = otherPlayer;
    }
    onPlayerDespawned(event) { if (sameActor(event.getPlayer(), this.interactedActor)) this.interactedActor = null; }
    onItemDespawned(event) {
      const it = this.interactedItem; const layer = this.interactedObject;
      if (it != null && layer != null && layer.sceneX !== undefined && event.getItem().getId() === it.getId()
        && event.getTile().getWorldLocation().equals(layer.getWorldLocation())) {
        this.interactedObject = null; this.interactedItem = null;
      }
    }
    onGameTick() {
      if (client.getTickCount() > this.clickTick && client.getLocalDestinationLocation() == null && this.interactedActor == null) {
        // when the destination is reached, clear the interacting object
        this.interactedObject = null; this.interactedItem = null;
      }
    }
    onInteractingChanged(e) {
      const lp = client.getLocalPlayer();
      if (lp != null && sameActor(e.getSource(), lp) && client.getTickCount() > this.clickTick) {
        const target = e.getTarget();
        this.interactedObject = null; this.interactedItem = null;
        this.interactedActor = target;
        this.attacked = target != null && target.getCombatLevel() > 0;
      }
    }
    onMenuOptionClicked(e) {
      const action = typeOf(e.getMenuAction());
      const x = e.getParam0(); const y = e.getParam1();
      const stamp = () => { this.clickTick = client.getTickCount(); this.gameCycle = client.getGameCycle(); };
      if (OBJECT_OPS.includes(action) && this.findTileObject(-1, x, y, this.clickedLocId(e)) != null) {
        this.interactedObject = this.findTileObject(-1, x, y, this.clickedLocId(e));
        this.interactedItem = null; this.interactedActor = null; stamp();
      } else if (NPC_OPS.includes(action)) {
        this.interactedObject = null; this.interactedItem = null;
        this.interactedActor = this.entryNpc(e);
        this.attacked = action === M.NPC_SECOND_OPTION || (action === M.WIDGET_TARGET_ON_NPC && /^Cast\b/.test(e.getMenuOption() || ''));
        stamp();
      } else if (PLAYER_OPS.includes(action)) {
        this.interactedObject = null; this.interactedItem = null;
        this.interactedActor = client.getPlayers().find((p) => p.getIndex() === e.getId()) || null;
        this.attacked = false; stamp();
      } else if (ITEM_OPS.includes(action) && this.findItemLayer(-1, x, y) != null) {
        this.interactedObject = this.findItemLayer(-1, x, y);
        this.interactedItem = this.findItem(this.interactedObject, e.getId());
        this.interactedActor = null; stamp();
      } else if (action === M.WIDGET_TARGET || action === M.WALK) {
        // Any menu click which clears an interaction
        this.interactedObject = null; this.interactedActor = null;
      } else if (e.isItemOp()) {
        this.interactedObject = null; this.interactedActor = null;
      }
    }
    clickedLocId(e) { return e.getRawId !== undefined ? locId(e.getRawId()) : locId(e.getId()); }
    entryNpc(e) { return client.getNpcs().find((n) => n.getIndex() === e.getId()) || null; }
    isSpellEntry(entry) { return /^Cast\b/.test(entry.getOption() || ''); }
    findTileObject(worldId, x, y, id) {
      const wv = client.getWorldView(worldId);
      const tile = wv.getScene().getTiles()[wv.getPlane()][x][y];
      if (tile != null) {
        for (const gameObject of tile.getGameObjects()) if (gameObject != null && this.objIdEquals(id, gameObject.getId())) return gameObject;
        const wallObject = tile.getWallObject();
        if (wallObject != null && this.objIdEquals(id, wallObject.getId())) return wallObject;
        const decorativeObject = tile.getDecorativeObject();
        if (decorativeObject != null && this.objIdEquals(id, decorativeObject.getId())) return decorativeObject;
        const groundObject = tile.getGroundObject();
        if (groundObject != null && this.objIdEquals(id, groundObject.getId())) return groundObject;
      }
      return null;
    }
    objIdEquals(id1 /* base id or multiloc id */, id2 /* base id */) {
      if (id1 === id2) return true;
      let obj = client.getObjectDefinition(id2);
      obj = obj == null || obj.getImpostorIds() == null ? obj : obj.getImpostor();
      return obj != null && obj.getId() === id1;
    }
    findItemLayer(worldId, x, y) { return rl.itemLayerAt(x, y); }
    findItem(layer, id) {
      if (layer == null) return null;
      let current = layer.getTop();
      while (current != null) {
        const item = current;
        current = current.getNext();
        if (item.getId() === id) return item;
      }
      return null;
    }
    sameObject(a, b) { return !!a && !!b && a.getId() === b.getId() && a.getWorldLocation().equals(b.getWorldLocation()); }
    sameItem(a, b) { return !!a && !!b && a.getId() === b.getId() && a.__layer && b.__layer && a.__layer.sceneX === b.__layer.sceneX && a.__layer.sceneY === b.__layer.sceneY; }
  }

  const plugin = new InteractHighlightPlugin();
  ll.__interacthighlight = { plugin };
  rl.registerPlugin('interacthighlight', plugin);
})();
