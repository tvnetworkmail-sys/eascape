// RuneLite's NPC Indicators plugin, cloned from net.runelite.client.plugins.npchighlight (BSD 2-Clause,
// Copyright (c) 2018, James Swindle, Adam <Adam@sigterm.info>, Tomas Slusny and RuneLite contributors):
// NpcIndicatorsPlugin, MemorizedNpc, NpcRespawnOverlay; the highlights go through the core's NpcOverlayService.
// For 2007: the maps are keyed by NPC index (our NPC objects are snapshots); the "Tag color" and "Tag style"
// submenus are flat (the 2007 menu has no submenus) and have no colour picker; no teleport smoke puffs
// (GraphicsObjectCreated) are seen, so an NPC teleporting away can start a respawn timer.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Color, ColorUtil, Text, WildcardMatcher, MenuAction, KeyCode, GameState, WorldPoint, LocalPoint, Perspective, BasicStroke,
    Overlay, OverlayPosition, OverlayLayer, HighlightedNpc, npcOverlayService, npcUtil, configManager, overlayManager } = rl;

  const GROUP = 'npcindicators';
  const MAX_ACTOR_VIEW_RANGE = 15;
  const MAX_RESPAWN_TIME_TICKS = 500;
  const TAG = 'Tag';
  const UNTAG = 'Un-tag';
  const TAG_ALL = 'Tag-All';
  const UNTAG_ALL = 'Un-tag-All';
  const STYLE_HULL = 'hull';
  const STYLE_TILE = 'tile';
  const STYLE_TRUE_TILE = 'truetile';
  const STYLE_SW_TILE = 'swtile';
  const STYLE_SW_TRUE_TILE = 'swtruetile';
  const STYLE_OUTLINE = 'outline';
  const GAME_TICK_LENGTH = 600;

  class MemorizedNpc {
    constructor(npc) {
      this.npcName = npc.getName();
      this.npcIndex = npc.getIndex();
      this.possibleRespawnLocations = [];
      this.respawnTime = -1;
      this.diedOnTick = -1;
      const composition = npc.getTransformedComposition();
      this.npcSize = composition != null ? composition.getSize() : 0;
    }
  }

  class NpcRespawnOverlay extends Overlay {
    constructor(plugin) { super(); this.plugin = plugin; this.config = plugin.config; this.setPosition(OverlayPosition.DYNAMIC); this.setLayer(OverlayLayer.ABOVE_SCENE); }
    getName() { return 'NpcRespawnOverlay'; }
    render(graphics) {
      const deadNpcsToDisplay = this.plugin.deadNpcsToDisplay;
      if (deadNpcsToDisplay.size === 0 || !this.config.showRespawnTimer()) return null;
      deadNpcsToDisplay.forEach((npc) => this.renderNpcRespawn(npc, graphics));
      return null;
    }
    renderNpcRespawn(npc, graphics) {
      if (npc.possibleRespawnLocations.length === 0) return;
      const respawnLocation = npc.possibleRespawnLocations[0];
      const lp = LocalPoint.fromWorld(client, respawnLocation.getX(), respawnLocation.getY());
      if (lp == null) return;
      const centerLp = new LocalPoint(lp.getX() + Math.trunc(128 * (npc.npcSize - 1) / 2), lp.getY() + Math.trunc(128 * (npc.npcSize - 1) / 2));
      const poly = Perspective.getCanvasTileAreaPoly(client, centerLp, npc.npcSize);
      this.renderPoly(graphics, this.config.highlightColor(), this.config.fillColor(), poly);
      const baseTick = ((npc.diedOnTick + npc.respawnTime) - client.getTickCount()) * (GAME_TICK_LENGTH / 1000.0);
      const sinceLast = (Date.now() - this.plugin.lastTickUpdate) / 1000.0;
      const timeLeft = Math.max(0.0, baseTick - sinceLast);
      const timeLeftStr = timeLeft.toFixed(1); // "#0.0"
      const textWidth = graphics.getFontMetrics().stringWidth(timeLeftStr);
      const textHeight = graphics.getFontMetrics().getAscent();
      const canvasPoint = Perspective.localToCanvas(client, centerLp, respawnLocation.getPlane());
      if (canvasPoint != null) {
        const canvasCenterPoint = new rl.Point(canvasPoint.getX() - Math.trunc(textWidth / 2), canvasPoint.getY() + Math.trunc(textHeight / 2));
        rl.OverlayUtil.renderTextLocation(graphics, canvasCenterPoint, timeLeftStr, Color.WHITE);
      }
    }
    renderPoly(graphics, borderColor, fillColor, polygon) {
      if (polygon != null) {
        graphics.setColor(borderColor); graphics.setStroke(new BasicStroke(this.config.borderWidth())); graphics.draw(polygon);
        graphics.setColor(fillColor); graphics.fill(polygon);
      }
    }
  }

  function isInViewRange(wp1, wp2) { return wp1.distanceTo(wp2) < MAX_ACTOR_VIEW_RANGE; }

  function getWorldLocationBehind(npc) {
    const orientation = Math.trunc(npc.getOrientation() / 256);
    let dx = 0; let dy = 0;
    switch (orientation) {
      case 0: dy = -1; break; // South
      case 1: dx = -1; dy = -1; break; // Southwest
      case 2: dx = -1; break; // West
      case 3: dx = -1; dy = 1; break; // Northwest
      case 4: dy = 1; break; // North
      case 5: dx = 1; dy = 1; break; // Northeast
      case 6: dx = 1; break; // East
      case 7: dx = 1; dy = -1; break; // Southeast
      default: break;
    }
    const currWP = npc.getWorldLocation();
    return new WorldPoint(currWP.getX() - dx, currWP.getY() - dy, currWP.getPlane());
  }

  function recolorMenuTarget(target, style, color) {
    if (style === 'NONE') return target;
    if (style === 'BOTH') return ColorUtil.prependColorTag(Text.removeTags(target), color);
    let name; let level;
    if (target.includes('  (level-')) {
      const c = target.lastIndexOf('<');
      name = target.substring(0, c);
      level = target.substring(c);
    } else {
      name = target;
      level = null;
    }
    if (style === 'NAME') {
      let t = ColorUtil.prependColorTag(Text.removeTags(name), color);
      if (level != null) t += level;
      return t;
    } else if (style === 'LEVEL') {
      let t = name;
      if (level != null) t += ColorUtil.prependColorTag(Text.removeTags(level), color);
      return t;
    }
    throw new Error('IllegalArgumentException');
  }

  class NpcIndicatorsPlugin {
    constructor() {
      this.configGroup = GROUP;
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.highlightedNpcs = new Map(); // NPC index -> HighlightedNpc
      this.deadNpcsToDisplay = new Map();
      this.lastTickUpdate = Date.now();
      this.memorizedNpcs = new Map();
      this.highlights = [];
      this.npcTags = new Set();
      this.spawnedNpcsThisTick = [];
      this.despawnedNpcsThisTick = [];
      this.teleportGraphicsObjectSpawnedThisTick = [];
      this.lastPlayerLocation = null;
      this.skipNextSpawnCheck = false;
      this.isHighlighted = (npc) => this.highlightedNpcs.get(npc.getIndex()) || null;
      this.npcRespawnOverlay = new NpcRespawnOverlay(this);
    }

    startUp() {
      npcOverlayService.registerHighlighter(this.isHighlighted);
      overlayManager.add(this.npcRespawnOverlay);
      this.skipNextSpawnCheck = true;
      this.rebuild();
      this.migrate();
    }

    shutDown() {
      npcOverlayService.unregisterHighlighter(this.isHighlighted);
      overlayManager.remove(this.npcRespawnOverlay);
      this.deadNpcsToDisplay.clear();
      this.memorizedNpcs.clear();
      this.spawnedNpcsThisTick = [];
      this.despawnedNpcsThisTick = [];
      this.teleportGraphicsObjectSpawnedThisTick = [];
      this.npcTags.clear();
      this.highlightedNpcs.clear();
    }

    migrate() {
      const b = configManager.getConfiguration(GROUP, 'highlightMenuNames');
      if (b != null) {
        configManager.unsetConfiguration(GROUP, 'highlightMenuNames');
        configManager.setConfiguration(GROUP, 'highlightMenuStyle', b === true || b === 'true' ? 'BOTH' : 'NONE');
      }
    }

    onGameStateChanged(event) {
      if (event.getGameState() === GameState.LOGIN_SCREEN) {
        this.highlightedNpcs.clear();
        this.deadNpcsToDisplay.clear();
        this.memorizedNpcs.forEach((npc) => { npc.diedOnTick = -1; });
        this.lastPlayerLocation = null;
        this.skipNextSpawnCheck = true;
      }
    }

    onConfigChanged(configChanged) {
      if (configChanged.getGroup() !== GROUP) return;
      this.rebuild();
    }

    onMenuEntryAdded(event) {
      const menuEntry = event.getMenuEntry();
      const menuAction = menuEntry.getType();
      const npc = menuEntry.getNpc();
      if (npc == null) return;
      if (menuAction === MenuAction.EXAMINE_NPC && client.isKeyPressed(KeyCode.KC_SHIFT)) {
        if (npc.getName() == null) return;
        const npcName = npc.getName();
        const lower = npcName.toLowerCase();
        const nameMatch = this.highlights.some((h) => h.toLowerCase() === lower);
        const idMatch = this.npcTags.has(npc.getIndex());
        const wildcardMatch = this.highlights.filter((h) => h.toLowerCase() !== lower).some((h) => WildcardMatcher.matches(h, npcName));
        // (createMenuEntry(idx--): each one under the last; ours go in above the entry, so they're made bottom first)
        const entries = [];
        entries.push({ option: idMatch ? UNTAG : TAG, click: (e) => this.tag(e, event.getIdentifier()) });
        if (!wildcardMatch) entries.push({ option: nameMatch ? UNTAG_ALL : TAG_ALL, click: (e) => this.tag(e, event.getIdentifier()) });
        if (idMatch || nameMatch || wildcardMatch) {
          this.createTagColorMenu(entries, npc);
          this.createTagStyleMenu(entries, npc);
        }
        for (const s of entries.reverse()) {
          client.createMenuEntry(-1).setOption(s.option).setTarget(event.getTarget()).setWorldViewId(menuEntry.getWorldViewId())
            .setIdentifier(event.getIdentifier()).setType(MenuAction.RUNELITE).onClick(s.click);
        }
      } else {
        if (npcUtil.isDying(npc)) {
          const color = this.config.deadNpcMenuColor();
          if (color != null) {
            menuEntry.setTarget(ColorUtil.prependColorTag(Text.removeTags(event.getTarget()), color));
            return;
          }
        }
        if (this.highlightedNpcs.has(npc.getIndex()) && (!npcUtil.isDying(npc) || !this.config.ignoreDeadNpcs())) {
          const color = this.getNpcHighlightColor(npc.getId()) || this.config.highlightColor();
          menuEntry.setTarget(recolorMenuTarget(event.getTarget(), this.config.highlightMenuStyle(), color));
        }
      }
    }

    // "Tag color" submenu, flat: Set color (the colours used, then the defaults, up to 5), Reset
    createTagColorMenu(entries, npc) {
      const colors = this.getUsedColors();
      for (const d of [Color.RED, Color.GREEN, Color.BLUE, Color.YELLOW, Color.MAGENTA]) {
        if (colors.length < 5 && !colors.some((c) => c.equals(d))) colors.push(d);
      }
      for (const c of colors) {
        entries.push({ option: ColorUtil.prependColorTag('Set color', c), click: () => { this.setNpcHighlightColor(npc.getId(), c); this.rebuild(); } });
      }
      // ("Pick color": no colour picker in the game's menu)
      if (this.getNpcHighlightColor(npc.getId()) != null) {
        entries.push({ option: 'Reset color', click: () => { this.unsetNpcHighlightColor(npc.getId()); this.rebuild(); } });
      }
    }

    // "Tag style" submenu, flat
    createTagStyleMenu(entries, npc) {
      const names = ['Hull', 'Tile', 'True tile', 'South-west tile', 'South-west true tile', 'Outline'];
      const styles = [STYLE_HULL, STYLE_TILE, STYLE_TRUE_TILE, STYLE_SW_TILE, STYLE_SW_TRUE_TILE, STYLE_OUTLINE];
      for (let i = 0; i < names.length; ++i) {
        const style = styles[i];
        entries.push({ option: 'Tag style ' + names[i], click: () => { this.setNpcTagStyle(npc.getId(), style); this.rebuild(); } });
      }
      if (this.getNpcTagStyle(npc.getId()) != null) {
        entries.push({ option: 'Reset style', click: () => { this.unsetNpcTagStyle(npc.getId()); this.rebuild(); } });
      }
    }

    tag(entry, id) {
      const wv = client.getWorldView(entry.getWorldViewId());
      if (wv == null) return;
      const npc = wv.npcs().byIndex(id);
      if (npc == null || npc.getName() == null) return;
      if (entry.getOption() === TAG || entry.getOption() === UNTAG) {
        const exists = this.highlightedNpcs.has(npc.getIndex());
        if (exists) {
          this.npcTags.delete(id);
          if (!this.highlightMatchesNPCName(npc.getName())) {
            this.highlightedNpcs.delete(npc.getIndex());
            this.memorizedNpcs.delete(npc.getIndex());
          }
        } else {
          if (!wv.isInstance()) this.memorizeNpc(npc);
          this.npcTags.add(id);
          this.highlightedNpcs.set(npc.getIndex(), this.highlightedNpc(npc));
        }
        npcOverlayService.rebuild();
      } else {
        const name = npc.getName();
        const list = [...this.highlights];
        const before = list.length;
        for (let i = list.length - 1; i >= 0; i--) if (list[i].toLowerCase() === name.toLowerCase()) list.splice(i, 1);
        if (list.length === before) list.push(name);
        configManager.setConfiguration(GROUP, 'npcToHighlight', Text.toCSV(list));
        this.rebuild();
      }
    }

    onNpcSpawned(npcSpawned) {
      const npc = npcSpawned.getNpc();
      const npcName = npc.getName();
      if (npcName == null) return;
      if (this.npcTags.has(npc.getIndex())) {
        this.memorizeNpc(npc);
        this.highlightedNpcs.set(npc.getIndex(), this.highlightedNpc(npc));
        this.spawnedNpcsThisTick.push(npc);
        return;
      }
      if (this.highlightMatchesNPCName(npcName)) {
        this.highlightedNpcs.set(npc.getIndex(), this.highlightedNpc(npc));
        if (!client.isInInstancedRegion()) {
          this.memorizeNpc(npc);
          this.spawnedNpcsThisTick.push(npc);
        }
      }
    }

    onNpcDespawned(npcDespawned) {
      const npc = npcDespawned.getNpc();
      if (this.memorizedNpcs.has(npc.getIndex())) this.despawnedNpcsThisTick.push({ coord: npc.getWorldLocation(), index: npc.getIndex() });
      this.highlightedNpcs.delete(npc.getIndex());
    }

    onNpcChanged(event) {
      const npc = event.getNpc();
      const npcName = npc.getName();
      this.highlightedNpcs.delete(npc.getIndex());
      if (npcName == null) return;
      if (this.npcTags.has(npc.getIndex()) || this.highlightMatchesNPCName(npcName)) this.highlightedNpcs.set(npc.getIndex(), this.highlightedNpc(npc));
    }

    onGameTick() {
      this.removeOldHighlightedRespawns();
      this.validateSpawnedNpcs();
      this.lastTickUpdate = Date.now();
      const local = client.getLocalPlayer();
      if (local != null) this.lastPlayerLocation = local.getWorldLocation();
    }

    memorizeNpc(npc) {
      const npcIndex = npc.getIndex();
      if (!this.memorizedNpcs.has(npcIndex)) this.memorizedNpcs.set(npcIndex, new MemorizedNpc(npc));
    }

    removeOldHighlightedRespawns() {
      for (const [k, x] of this.deadNpcsToDisplay) if (x.diedOnTick + x.respawnTime <= client.getTickCount() + 1) this.deadNpcsToDisplay.delete(k);
    }

    getHighlights() {
      const configNpcs = this.config.getNpcToHighlight() || '';
      if (configNpcs.length === 0) return [];
      return Text.fromCSV(configNpcs);
    }

    rebuild() {
      this.highlights = this.getHighlights();
      this.highlightedNpcs.clear();
      if (client.getGameState() !== GameState.LOGGED_IN && client.getGameState() !== GameState.LOADING) return;
      this.rebuildWorldview(client.getTopLevelWorldView());
      npcOverlayService.rebuild();
    }

    rebuildWorldview(wv) {
      for (const npc of wv.npcs()) {
        const npcName = npc.getName();
        if (npcName == null) continue;
        if (this.npcTags.has(npc.getIndex())) {
          this.highlightedNpcs.set(npc.getIndex(), this.highlightedNpc(npc));
          continue;
        }
        if (this.highlightMatchesNPCName(npcName)) {
          if (!wv.isInstance()) this.memorizeNpc(npc);
          this.highlightedNpcs.set(npc.getIndex(), this.highlightedNpc(npc));
          continue;
        }
        this.memorizedNpcs.delete(npc.getIndex());
      }
      for (const sub of wv.worldViews()) this.rebuildWorldview(sub);
    }

    highlightMatchesNPCName(npcName) {
      for (const highlight of this.highlights) if (WildcardMatcher.matches(highlight, npcName)) return true;
      return false;
    }

    validateSpawnedNpcs() {
      const has = (list, wp) => list.some((x) => x.equals(wp));
      if (this.skipNextSpawnCheck) {
        this.skipNextSpawnCheck = false;
      } else {
        for (const npc of this.despawnedNpcsThisTick) {
          if (this.teleportGraphicsObjectSpawnedThisTick.length && has(this.teleportGraphicsObjectSpawnedThisTick, npc.coord)) continue;
          const me = client.getLocalPlayer();
          if (me && isInViewRange(me.getWorldLocation(), npc.coord)) {
            const mn = this.memorizedNpcs.get(npc.index);
            if (mn != null) {
              mn.diedOnTick = client.getTickCount() + 1; // This runs before tickCounter updates, so we add 1
              if (mn.possibleRespawnLocations.length) this.deadNpcsToDisplay.set(mn.npcIndex, mn);
            }
          }
        }
        for (const npc of this.spawnedNpcsThisTick) {
          if (this.teleportGraphicsObjectSpawnedThisTick.length
            && (has(this.teleportGraphicsObjectSpawnedThisTick, npc.getWorldLocation()) || has(this.teleportGraphicsObjectSpawnedThisTick, getWorldLocationBehind(npc)))) continue;
          if (this.lastPlayerLocation != null && isInViewRange(this.lastPlayerLocation, npc.getWorldLocation())) {
            const mn = this.memorizedNpcs.get(npc.getIndex());
            if (!mn) continue;
            if (mn.diedOnTick !== -1) {
              const respawnTime = client.getTickCount() + 1 - mn.diedOnTick;
              if ((mn.respawnTime === -1 || respawnTime < mn.respawnTime) && respawnTime <= MAX_RESPAWN_TIME_TICKS) mn.respawnTime = respawnTime;
              mn.diedOnTick = -1;
            }
            const npcLocation = npc.getWorldLocation();
            const possibleOtherNpcLocation = getWorldLocationBehind(npc);
            mn.possibleRespawnLocations = mn.possibleRespawnLocations.filter((x) => x.equals(npcLocation) || x.equals(possibleOtherNpcLocation));
            if (mn.possibleRespawnLocations.length === 0) {
              mn.possibleRespawnLocations.push(npcLocation);
              mn.possibleRespawnLocations.push(possibleOtherNpcLocation);
            }
          }
        }
      }
      this.spawnedNpcsThisTick = [];
      this.despawnedNpcsThisTick = [];
      this.teleportGraphicsObjectSpawnedThisTick = [];
    }

    highlightedNpc(npc) {
      const npcId = npc.getId();
      const style = this.getNpcTagStyle(npcId);
      const c = this.config;
      const pick = (s, fn) => (style != null ? style === s : fn());
      return HighlightedNpc.builder()
        .npc(npc)
        .highlightColor(this.getNpcHighlightColor(npcId) || c.highlightColor())
        .fillColor(c.fillColor())
        .hull(pick(STYLE_HULL, c.highlightHull))
        .tile(pick(STYLE_TILE, c.highlightTile))
        .trueTile(pick(STYLE_TRUE_TILE, c.highlightTrueTile))
        .swTile(pick(STYLE_SW_TILE, c.highlightSouthWestTile))
        .swTrueTile(pick(STYLE_SW_TRUE_TILE, c.highlightSouthWestTrueTile))
        .outline(pick(STYLE_OUTLINE, c.highlightOutline))
        .name(c.drawNames())
        .nameOnMinimap(c.drawMinimapNames())
        .borderWidth(c.borderWidth())
        .outlineFeather(c.outlineFeather())
        .render((n) => this.render(n))
        .build();
    }

    render(n) {
      if (npcUtil.isDying(n) && this.config.ignoreDeadNpcs()) return false;
      const c = n.getTransformedComposition();
      if (c != null && c.isFollower() && this.config.ignorePets()) return false;
      return true;
    }

    setNpcHighlightColor(npcId, color) { configManager.setConfiguration(GROUP, 'highlightcolor_' + npcId, '#' + (color.getRGB() >>> 0).toString(16).padStart(8, '0')); }
    unsetNpcHighlightColor(npcId) { configManager.unsetConfiguration(GROUP, 'highlightcolor_' + npcId); }
    getNpcHighlightColor(npcId) { const v = configManager.getConfiguration(GROUP, 'highlightcolor_' + npcId); return v == null ? null : Color.parse(v); }
    setNpcTagStyle(npcId, style) { configManager.setConfiguration(GROUP, 'tagstyle_' + npcId, style); }
    unsetNpcTagStyle(npcId) { configManager.unsetConfiguration(GROUP, 'tagstyle_' + npcId); }
    getNpcTagStyle(npcId) { const v = configManager.getConfiguration(GROUP, 'tagstyle_' + npcId); return v == null ? null : v; }

    getUsedColors() {
      const colors = [];
      for (const npc of client.getNpcs()) {
        const c = this.getNpcHighlightColor(npc.getId());
        if (c != null && !colors.some((x) => x.equals(c))) {
          colors.push(c);
          if (colors.length >= 5) break;
        }
      }
      return colors;
    }
  }

  rl.registerPlugin('npcindicators', new NpcIndicatorsPlugin());
})();
