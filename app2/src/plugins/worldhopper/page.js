// RuneLite's World Hopper plugin, cloned from net.runelite.client.plugins.worldhopper (BSD 2-Clause, Copyright (c)
// 2018, Lotto <https://github.com/devLotto> and RuneLite contributors): WorldHopperPlugin, WorldHopperPingOverlay,
// RegionFilterMode, SubscriptionFilterMode, WorldTypeFilter. The WorldSwitcherPanel / WorldTableRow / WorldTableHeader
// are the sidebar panel ui/panels/worldhopper.js, drawn from the state this publishes.
// Adapted: the world list is the core's WorldService, which is our server's own list (app main/worlds.js: its world
// number, members flag and address from the server's config); the server publishes no player count (null: "-").
// Ping is the app's TCP connect time to the server (RuneLite's ICMP ping, async here). The 2007 client has no world
// switcher interface (InterfaceID.Worldswitcher) and no world switcher favourite varbits, so a quick hop goes
// straight to Client.hopToWorld on the next tick (the app opens the game on that world, asking first). No friends
// chat or clans in 2007: Hop-to is on the friends list (2007 group 550) only. No TCP info (retransmits) in a browser.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Overlay, OverlayPosition, OverlayLayer, OverlayPriority, OverlayUtil, Point, Color, GameState, Skill, MenuAction, WidgetUtil, Text } = rl;

  const GROUP = 'worldhopper';
  const MAX_PLAYER_COUNT = 1950;
  const REFRESH_THROTTLE = 60000; // ms
  const HOP_TO = 'Hop-to';
  const KICK_OPTION = 'Kick';
  const BEFORE_OPTIONS = ['Add friend', 'Remove friend', KICK_OPTION];
  const AFTER_OPTIONS = ['Message'];
  const FRIENDS = 550; // InterfaceID.FRIENDS (OSRS 429) in the 2007 client

  // RegionFilterMode (era-trimmed: the regions with worlds in 2007)
  const RegionFilterMode = { AUSTRALIA: 'AUSTRALIA', UNITED_KINGDOM: 'UNITED_KINGDOM', UNITED_STATES: 'UNITED_STATES' };
  const REGION_OF = { AUSTRALIA: 'AUSTRALIA', UNITED_KINGDOM: 'UNITED_KINGDOM', UNITED_STATES: 'UNITED_STATES_OF_AMERICA' };
  RegionFilterMode.of = (region) => {
    for (const [k, r] of Object.entries(REGION_OF)) if (r === region) return k;
    throw new Error('IllegalArgumentException');
  };
  // WorldTypeFilter (era-trimmed: NORMAL)
  const NORMAL_TYPES = new Set(['MEMBERS', 'SKILL_TOTAL', 'LAST_MAN_STANDING']);
  const WorldTypeFilter = {
    NORMAL: { matches: (types) => [...types].every((t) => NORMAL_TYPES.has(t)) },
  };

  // RetransmitCalculator: no TCP info in a browser (always 0)
  const retransmitCalculator = { getRetransmitPercent: () => 0, record() {} };

  class WorldHopperPingOverlay extends Overlay {
    constructor(plugin, config) {
      super(plugin);
      this.plugin = plugin; this.config = config;
      this.setLayer(OverlayLayer.ABOVE_WIDGETS);
      this.setPriority(OverlayPriority.HIGH);
      this.setPosition(OverlayPosition.DYNAMIC);
    }
    getName() { return 'WorldHopperPingOverlay'; }
    render(graphics) {
      const Y_OFFSET = 11; const X_OFFSET = 1;
      if (!this.config.displayPing()) return null;
      // (InterfaceID.ToplevelPreEoc.ICON10, the logout button at the top right: not in the 2007 fixed layout)
      let xOffset = X_OFFSET;
      const fm = graphics.getFontMetrics();
      const textHeight = fm.getAscent() - fm.getDescent();
      const width = client.getCanvasWidth ? client.getCanvasWidth() : 765;
      const ping = this.plugin.getCurrentPing();
      if (ping >= 0) {
        const text = ping + ' ms';
        const textWidth = fm.stringWidth(text);
        const point = new Point(width - textWidth - xOffset, textHeight + Y_OFFSET);
        OverlayUtil.renderTextLocation(graphics, point, text, Color.YELLOW);
        xOffset += textWidth + fm.stringWidth(' ');
      }
      const percRetransmit = retransmitCalculator.getRetransmitPercent();
      if (percRetransmit > 0) {
        const text = percRetransmit + '% loss';
        const point = new Point(width - fm.stringWidth(text) - xOffset, textHeight + Y_OFFSET);
        OverlayUtil.renderTextLocation(graphics, point, text, Color.RED);
      }
      return null;
    }
  }

  class WorldHopperPlugin {
    constructor() {
      this.configGroup = GROUP;
      this.lastWorld = 0;
      this.currentPing = -1;
      this.storedPings = new Map();
      this.currentWorld = 0;
      this.lastFetch = null;
      this.quickHopTargetWorld = null;
      this.displaySwitcherAttempts = 0;
      this.populated = [];
    }

    startUp() {
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.overlay = this.overlay || new WorldHopperPingOverlay(this, this.config);
      this.currentPing = -1;
      const self = this;
      this.previousKeyListener = new (class extends rl.HotkeyListener { hotkeyPressed() { self.hop(true); } })(() => this.config.previousKey());
      this.nextKeyListener = new (class extends rl.HotkeyListener { hotkeyPressed() { self.hop(false); } })(() => this.config.nextKey());
      rl.keyManager.registerKeyListener(this.previousKeyListener);
      rl.keyManager.registerKeyListener(this.nextKeyListener);
      rl.overlayManager.add(this.overlay);
      this.subscriptionFilterMode = this.config.subscriptionFilter();
      this.regionFilterMode = this.config.regionFilter();
      this.worldTypeFilters = this.config.worldTypeFilter();
      // the plugin's own executor for pings (one task at a time)
      this.busy = false;
      this.updateList();
      this.run(() => this.pingInitialWorlds());
      this.startTimer = setTimeout(() => {
        this.pingTimer = setInterval(() => this.run(() => this.pingNextWorld()), 3000);
        this.currPingTimer = setInterval(() => this.run(() => this.pingCurrentWorld()), 1000);
      }, 15000);
    }

    shutDown() {
      clearTimeout(this.startTimer); clearInterval(this.pingTimer); clearInterval(this.currPingTimer);
      rl.overlayManager.remove(this.overlay);
      rl.keyManager.unregisterKeyListener(this.previousKeyListener);
      rl.keyManager.unregisterKeyListener(this.nextKeyListener);
      rl.panels.update(GROUP, null);
    }

    /** the single-threaded executor: a task is skipped while one is running */
    async run(task) {
      if (this.busy) return;
      this.busy = true;
      try { await task(); } catch { /* keep going */ } finally { this.busy = false; }
    }

    onConfigChanged(event) {
      if (event.getGroup() !== GROUP) return;
      // (the core reports a change without its key: apply them all)
      this.subscriptionFilterMode = this.config.subscriptionFilter();
      this.regionFilterMode = this.config.regionFilter();
      this.worldTypeFilters = this.config.worldTypeFilter();
      this.updateList();
    }

    onCommandExecuted(commandExecuted) {
      if (String(commandExecuted.getCommand()).toLowerCase() !== 'hop') return;
      commandExecuted.consume();
      const worldNumber = Number.parseInt(commandExecuted.getArguments()[0], 10);
      if (!Number.isFinite(worldNumber) || String(worldNumber) !== String(commandExecuted.getArguments()[0]).trim()) {
        client.addChatMessage('CONSOLE', '', 'Usage: ::hop world', null);
        return;
      }
      const result = rl.worldService.getWorlds();
      const world = result && result.findWorld(worldNumber);
      if (!world) {
        client.addChatMessage('CONSOLE', '', 'Unknown world ' + worldNumber, null);
        return;
      }
      this.hopWorld(world);
    }

    setFavoriteConfig(world) { rl.configManager.setConfiguration(GROUP, 'favorite_' + world, true); }
    isFavoriteConfig(world) {
      const v = rl.configManager.getConfiguration(GROUP, 'favorite_' + world);
      return v === true || v === 'true';
    }
    clearFavoriteConfig(world) { rl.configManager.unsetConfiguration(GROUP, 'favorite_' + world); }
    isFavorite(world) { return this.isFavoriteConfig(world.getId()); }
    getCurrentWorld() { return client.getWorld(); }
    getLastWorld() { return this.lastWorld; }
    getCurrentPing() { return this.currentPing; }
    addToFavorites(world) { this.setFavoriteConfig(world.getId()); this.publish(); }
    removeFromFavorites(world) { this.clearFavoriteConfig(world.getId()); this.publish(); }

    onMenuEntryAdded(event) {
      if (!this.config.menuOption()) return;
      const componentId = event.getActionParam1();
      const groupId = WidgetUtil.componentToInterface(componentId);
      const option = event.getOption();
      let after;
      if (groupId === FRIENDS) {
        if (AFTER_OPTIONS.includes(option)) after = true;
        else if (BEFORE_OPTIONS.includes(option)) after = false;
        else return;
      } else {
        // 2006RS-2: the 2006 friends list's entries are the client's MESSAGE_PRIVATE (902, "Message") and FRIENDLIST_DEL
        // (513, "Remove"), with no component in their arguments: seen through if2006.js as 10000 + the opcode
        const t = typeof event.getType === 'function' ? event.getType() : -1;
        if ((t === 10902 || t === 12902) && option === 'Message') after = true;
        else if ((t === 10513 || t === 12513) && option === 'Remove') after = false;
        else return;
      }
      // Don't add entry if user is offline
      const player = this.getChatPlayerFromName(event.getTarget());
      const worldResult = rl.worldService.getWorlds();
      if (!player || player.getWorld() === 0 || player.getWorld() === client.getWorld() || !worldResult) return;
      const currentWorld = worldResult.findWorld(client.getWorld());
      const targetWorld = worldResult.findWorld(player.getWorld());
      if (!targetWorld || !currentWorld || (!currentWorld.getTypes().has('PVP') && targetWorld.getTypes().has('PVP'))) return;
      client.createMenuEntry(after ? -2 : -1)
        .setOption(HOP_TO)
        .setTarget(event.getTarget())
        .setType(MenuAction.RUNELITE)
        .onClick((e) => {
          const p = this.getChatPlayerFromName(e.getTarget());
          if (p) this.hopId(p.getWorld());
        });
    }

    onGameStateChanged(gameStateChanged) {
      if (gameStateChanged.getGameState() === GameState.LOGGED_IN && this.lastWorld !== client.getWorld()) {
        this.currentPing = -1;
        this.lastWorld = client.getWorld();
        this.publish();
      }
    }

    refresh() {
      const now = Date.now();
      if (this.lastFetch != null && now - this.lastFetch < REFRESH_THROTTLE) return; // throttling world refresh
      this.lastFetch = now;
      rl.worldService.refresh();
    }

    onWorldsFetch() { this.updateList(); }

    updateList() {
      const worldResult = rl.worldService.getWorlds();
      if (worldResult) this.populate(worldResult.getWorlds());
    }

    // WorldSwitcherPanel.populate: the filters
    populate(worlds) {
      const rows = [];
      for (const world of worlds) {
        if (this.subscriptionFilterMode === 'FREE' && world.getTypes().has('MEMBERS')) continue;
        if (this.subscriptionFilterMode === 'MEMBERS' && !world.getTypes().has('MEMBERS')) continue;
        if (this.regionFilterMode.size && world.getRegion() != null && !this.regionFilterMode.has(RegionFilterMode.of(world.getRegion()))) continue;
        if (this.worldTypeFilters.size) {
          let matches = false;
          for (const f of this.worldTypeFilters) matches = matches || (WorldTypeFilter[f] ? WorldTypeFilter[f].matches(world.getTypes()) : false);
          if (!matches) continue;
        }
        rows.push(world);
      }
      this.populated = rows;
      this.publish();
    }

    getStoredPing(world) {
      if (!this.config.ping()) return null;
      const p = this.storedPings.get(world.getId());
      return p === undefined ? null : p;
    }

    /** the panel's state (WorldSwitcherPanel's rows) */
    publish() {
      if (!this.config) return;
      rl.panels.update(GROUP, {
        showSidebar: this.config.showSidebar(),
        rows: this.populated.map((w) => ({
          id: w.getId(),
          types: [...w.getTypes()],
          activity: w.getActivity(),
          players: w.getPlayers(),
          region: w.getRegion(),
          location: w.getLocation(),
          ping: this.getStoredPing(w),
          current: w.getId() === this.getCurrentWorld() && this.lastWorld !== 0,
          favorite: this.isFavorite(w),
        })),
      });
    }

    onPanelAction(a) {
      const result = rl.worldService.getWorlds();
      const world = result && a.id != null ? result.findWorld(Number(a.id)) : null;
      if (a.action === 'hop' && world) this.hopTo(world);
      else if (a.action === 'favorite' && world) { if (a.add) this.addToFavorites(world); else this.removeFromFavorites(world); }
      else if (a.action === 'refresh') this.refresh();
    }

    hop(previous) {
      const worldResult = rl.worldService.getWorlds();
      if (!worldResult || client.getGameState() !== GameState.LOGGED_IN) return;
      const currentWorld = worldResult.findWorld(client.getWorld());
      if (!currentWorld) return;
      const currentWorldTypes = currentWorld.getTypes();
      // Make it so you always hop out of PVP and high risk worlds
      if (this.config.quickhopOutOfDanger()) { currentWorldTypes.delete('PVP'); currentWorldTypes.delete('HIGH_RISK'); }
      // Don't regard these worlds as a type that must be hopped between
      currentWorldTypes.delete('BOUNTY'); currentWorldTypes.delete('SKILL_TOTAL'); currentWorldTypes.delete('LAST_MAN_STANDING');
      const worlds = worldResult.getWorlds();
      let worldIdx = worlds.indexOf(currentWorld);
      const totalLevel = client.getTotalLevel();
      const f2pTotalLevel = Skill.values().filter((s) => !s.isMembers()).reduce((a, s) => a + client.getRealSkillLevel(s), 0);
      const regionFilter = this.config.regionFilter();
      let world;
      do {
        // the previous or next world in the list, starting over at the other end
        if (previous) { worldIdx--; if (worldIdx < 0) worldIdx = worlds.length - 1; }
        else { worldIdx++; if (worldIdx >= worlds.length) worldIdx = 0; }
        world = worlds[worldIdx];
        // Check world region if filter is enabled
        if (regionFilter.size && world.getRegion() != null && !regionFilter.has(RegionFilterMode.of(world.getRegion()))) continue;
        const types = world.getTypes();
        types.delete('BOUNTY');
        // Treat LMS world like casual world
        types.delete('LAST_MAN_STANDING');
        if (types.has('SKILL_TOTAL')) {
          const totalRequirement = Number.parseInt(world.getActivity().substring(0, world.getActivity().indexOf(' ')), 10);
          if (Number.isFinite(totalRequirement)) {
            const effectiveTotalLevel = types.has('MEMBERS') ? totalLevel : f2pTotalLevel;
            if (effectiveTotalLevel >= totalRequirement) types.delete('SKILL_TOTAL');
          }
        }
        // Avoid switching to near-max population worlds, as it will refuse to allow the hop if the world is full
        if (world.getPlayers() != null && world.getPlayers() >= MAX_PLAYER_COUNT) continue;
        if (world.getPlayers() != null && world.getPlayers() < 0) continue; // offline world
        // Break out if we've found a good world to hop to
        if (types.size === currentWorldTypes.size && [...types].every((t) => currentWorldTypes.has(t))) break;
      } while (world !== currentWorld);
      if (world === currentWorld) client.addChatMessage('CONSOLE', '', "Couldn't find a world to quick-hop to.", null);
      else this.hopId(world.getId());
    }

    hopId(worldId) {
      const worldResult = rl.worldService.getWorlds();
      // Don't try to hop if the world doesn't exist
      const world = worldResult && worldResult.findWorld(worldId);
      if (world) this.hopWorld(world);
    }

    hopTo(world) { this.hopWorld(world); }

    hopWorld(world) {
      const rsWorld = client.createWorld();
      rsWorld.setActivity(world.getActivity());
      rsWorld.setAddress(world.getAddress());
      rsWorld.setId(world.getId());
      rsWorld.setPlayerCount(world.getPlayers());
      rsWorld.setLocation(world.getLocation());
      rsWorld.setTypes(world.getTypes());
      if (client.getGameState() === GameState.LOGIN_SCREEN) {
        // on the login screen we can just change the world by ourselves
        client.changeWorld(rsWorld);
        return;
      }
      if (this.config.showWorldHopMessage()) client.addChatMessage('CONSOLE', '', `Quick-hopping to World ${world.getId()}..`, null);
      this.quickHopTargetWorld = rsWorld;
      this.displaySwitcherAttempts = 0;
    }

    onGameTick() {
      if (!this.quickHopTargetWorld) return;
      // (no world switcher to open in 2007: hop at once)
      client.hopToWorld(this.quickHopTargetWorld);
      this.resetQuickHopper();
    }

    onChatMessage(event) {
      if (event.getType() !== 'GAMEMESSAGE') return;
      if (event.getMessage() === "Please finish what you're doing before using the World Switcher.") this.resetQuickHopper();
    }

    resetQuickHopper() { this.displaySwitcherAttempts = 0; this.quickHopTargetWorld = null; }

    getChatPlayerFromName(name) {
      const cleanName = Text.removeTags(name);
      const friendContainer = client.getFriendContainer();
      return friendContainer ? friendContainer.findByName(cleanName) : null;
    }

    async pingInitialWorlds() {
      const worldResult = rl.worldService.getWorlds();
      if (!worldResult || !this.config.showSidebar() || !this.config.ping()) return;
      for (const world of worldResult.getWorlds()) await this.ping(world);
      this.publish();
    }

    async pingNextWorld() {
      const worldResult = rl.worldService.getWorlds();
      if (!worldResult || !this.config.showSidebar() || !this.config.ping()) return;
      const worlds = worldResult.getWorlds();
      if (!worlds.length) return;
      if (this.currentWorld >= worlds.length) this.currentWorld = 0; // Wrap back around
      const world = worlds[this.currentWorld++];
      // If we are displaying the ping overlay, there is a separate scheduled task for the current world
      const displayPing = this.config.displayPing() && client.getGameState() === GameState.LOGGED_IN;
      if (displayPing && client.getWorld() === world.getId()) return;
      await this.ping(world);
      this.publish();
    }

    async pingCurrentWorld() {
      const worldResult = rl.worldService.getWorlds();
      // There is no reason to ping the current world if not logged in, as the overlay doesn't draw
      if (!worldResult || !this.config.displayPing() || client.getGameState() !== GameState.LOGGED_IN) return;
      const currentWorld = worldResult.findWorld(client.getWorld());
      if (!currentWorld) return;
      const ping = await this.ping(currentWorld);
      if (ping < 0) return;
      this.currentPing = ping;
      this.publish();
    }

    async ping(world) {
      const ping = await rl.Ping.ping(world);
      this.storedPings.set(world.getId(), ping);
      return ping;
    }
  }

  rl.registerPlugin(GROUP, new WorldHopperPlugin());
})();
