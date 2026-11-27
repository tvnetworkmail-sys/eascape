// RuneLite's Smelting plugin, cloned from net.runelite.client.plugins.smelting (BSD 2-Clause, Copyright (c) 2019, Stephen
// <stepzhu@umich.edu> and RuneLite contributors): SmeltingPlugin, SmeltingConfig, SmeltingOverlay, SmeltingSession.
// 2007: the bar and cannonball messages are game messages (OSRS: SPAM); our Varrock armour's extra bar comes without a
// message, so it isn't counted. Animations: human_furnace 899 and human_pickupfloor 827, the 2007 cache's ids.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Skill, Color, LineComponent, TitleComponent, OverlayPanel, OverlayPosition } = rl;
  const GROUP = 'smelting';
  const HUMAN_FURNACE = 899; const HUMAN_PICKUPFLOOR = 827;

  class SmeltingSession {
    constructor() { this.barsSmelted = 0; this.cannonBallsSmelted = 0; this.lastItemSmelted = 0; }
    getBarsSmelted() { return this.barsSmelted; }
    getCannonBallsSmelted() { return this.cannonBallsSmelted; }
    getLastItemSmelted() { return this.lastItemSmelted; }
    increaseBarsSmelted() { this.barsSmelted++; this.lastItemSmelted = Date.now(); }
    increaseCannonBallsSmelted(amount) { this.cannonBallsSmelted += amount; this.lastItemSmelted = Date.now(); }
  }

  const SMELT_TIMEOUT = 7;
  const SMELTING_RESET = 'Reset';
  class SmeltingOverlay extends OverlayPanel {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.setPosition(OverlayPosition.TOP_LEFT);
      this.addMenuEntry('RUNELITE_OVERLAY_CONFIG', 'Configure', 'Smelting overlay');
      this.addMenuEntry('RUNELITE_OVERLAY', SMELTING_RESET, 'Smelting overlay', () => plugin.setSession(null));
    }
    render(graphics) {
      const session = this.plugin.getSession();
      if (session == null) return null;
      const ch = this.panelComponent.getChildren();
      if (this.isSmelting() || Math.trunc((Date.now() - session.getLastItemSmelted()) / 1000) < SMELT_TIMEOUT) {
        ch.push(TitleComponent.builder().text('Smelting').color(Color.GREEN).build());
      } else {
        ch.push(TitleComponent.builder().text('NOT smelting').color(Color.RED).build());
      }
      const actions = rl.xpTrackerService.getActions(Skill.SMITHING);
      if (actions > 0) {
        if (session.getBarsSmelted() > 0) ch.push(LineComponent.builder().left('Bars:').right(String(session.getBarsSmelted())).build());
        if (session.getCannonBallsSmelted() > 0) ch.push(LineComponent.builder().left('Cannonballs:').right(String(session.getCannonBallsSmelted())).build());
        if (actions > 2) ch.push(LineComponent.builder().left('Actions/hr:').right(String(rl.xpTrackerService.getActionsHr(Skill.SMITHING))).build());
      }
      return super.render(graphics);
    }
    isSmelting() {
      const a = client.getLocalPlayer().getAnimation();
      return a === HUMAN_FURNACE || a === HUMAN_PICKUPFLOOR;
    }
  }

  class SmeltingPlugin {
    constructor() { this.configGroup = GROUP; this.session = null; this.cannonBallsMade = 0; }
    getSession() { return this.session; }
    setSession(s) { this.session = s; }
    startUp() {
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.overlay = new SmeltingOverlay(this);
      this.session = null;
      rl.overlayManager.add(this.overlay);
      this.cannonBallsMade = 0;
    }
    shutDown() {
      rl.overlayManager.remove(this.overlay);
      this.session = null;
      this.cannonBallsMade = 0;
    }
    onChatMessage(event) {
      // (2007: a game message; OSRS's SPAM type is later)
      if (event.getType() !== 'SPAM' && event.getType() !== 'GAMEMESSAGE') return;
      const m = event.getMessage();
      if (m.startsWith('You retrieve a bar of') || m.startsWith('The Varrock platebody enabled you to smelt your next ore')) {
        if (this.session == null) this.session = new SmeltingSession();
        this.session.increaseBarsSmelted();
      } else if (m.endsWith(' to form 8 cannonballs.')) {
        this.cannonBallsMade = 8;
      } else if (m.endsWith(' to form 4 cannonballs.')) {
        this.cannonBallsMade = 4;
      } else if (m.startsWith('You remove the cannonballs from the mould')) {
        if (this.session == null) this.session = new SmeltingSession();
        this.session.increaseCannonBallsSmelted(this.cannonBallsMade);
      }
    }
    onGameTick() {
      if (this.session != null) {
        const statTimeout = this.config.statTimeout() * 60000;
        if (Date.now() - this.session.getLastItemSmelted() >= statTimeout) this.session = null;
      }
    }
  }

  const plugin = new SmeltingPlugin();
  ll.__smelting = { plugin, SmeltingSession };
  rl.registerPlugin(GROUP, plugin);
})();
