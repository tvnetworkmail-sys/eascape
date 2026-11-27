// RuneLite's Pest Control plugin, cloned from net.runelite.client.plugins.pestcontrol (BSD 2-Clause, Copyright (c) 2017,
// Kronos <https://github.com/KronosDesign>, Adam <Adam@sigterm.info> and RuneLite contributors): PestControlPlugin,
// PestControlOverlay, Game, Portal, PortalContext, Rotation.
// 2007 ids from the 2007 cache: the spinners are NPCs 3747-3751; the status overlay is interface 408 as in OSRS, laid out
// differently: per portal (purple W, blue E, yellow SE, red SW) the hitpoints text 13-16, a graphic 7-10 and a layer
// 18/20/22/24 under it (the shield / icon pair of the OSRS PEST_STATUS_PORT / PEST_PORTAL_DONE components; the box
// drawn round them is their union as in RuneLite). The game is on while 408 is open (the core's getWidget finds a
// component whether or not its interface is open). Era-trim: the 2007 overlay has no activity bar (ACTIVITY_CONTAINER /
// ACTIVITY_BAR, later), so renderProgressWidget draws nothing.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Overlay, OverlayPosition, OverlayUtil, Color, Rectangle, GameState } = rl;

  const PEST_STATUS = 408;
  const C = (child) => (PEST_STATUS << 16) | child;
  const InterfaceID = {
    PEST_STATUS_PORT1: C(7), PEST_STATUS_PORT2: C(8), PEST_STATUS_PORT3: C(9), PEST_STATUS_PORT4: C(10),
    PEST_PORTAL_1_DONE: C(18), PEST_PORTAL_2_DONE: C(20), PEST_PORTAL_3_DONE: C(22), PEST_PORTAL_4_DONE: C(24),
    PEST_STATUS_PORTTXT1: C(13), PEST_STATUS_PORTTXT2: C(14), PEST_STATUS_PORTTXT3: C(15), PEST_STATUS_PORTTXT4: C(16),
    ACTIVITY_CONTAINER: null, ACTIVITY_BAR: null,
  };
  const NpcID = { PEST_SPINNER_1: 3747, PEST_SPINNER_2: 3748, PEST_SPINNER_3: 3749, PEST_SPINNER_4: 3750, PEST_SPINNER_5: 3751 };

  // Portal
  const Portal = {};
  [['PURPLE', 1], ['BLUE', 2], ['YELLOW', 3], ['RED', 4]].forEach(([name, n]) => {
    Portal[name] = { name, shield: InterfaceID['PEST_STATUS_PORT' + n], hitpoints: InterfaceID['PEST_STATUS_PORTTXT' + n], icon: InterfaceID['PEST_PORTAL_' + n + '_DONE'],
      getShield() { return this.shield; }, getHitpoints() { return this.hitpoints; }, getIcon() { return this.icon; }, toString: () => name };
  });
  const { PURPLE, BLUE, YELLOW, RED } = Portal;

  // Rotation
  const ROTATIONS = [[PURPLE, BLUE, YELLOW, RED], [PURPLE, YELLOW, BLUE, RED], [BLUE, RED, YELLOW, PURPLE], [BLUE, PURPLE, RED, YELLOW],
    [YELLOW, RED, PURPLE, BLUE], [YELLOW, PURPLE, RED, BLUE]].map((portals) => ({
    portals, getPortal(index) { return index < 0 || index >= portals.length ? null : portals[index]; },
  }));

  class PortalContext {
    constructor(portal) { this.portal = portal; this.shielded = true; this.dead = false; }
    getPortal() { return this.portal; }
    isShielded() { return this.shielded; } setShielded(b) { this.shielded = b; }
    isDead() { return this.dead; } setDead(b) { this.dead = b; }
  }

  class Game {
    constructor() {
      // Game starts with all possible rotations
      this.possibleRotations = ROTATIONS.slice();
      // Number of shields dropped
      this.shieldsDropped = 0;
      this.purple = new PortalContext(PURPLE); this.blue = new PortalContext(BLUE);
      this.yellow = new PortalContext(YELLOW); this.red = new PortalContext(RED);
    }
    getPurple() { return this.purple; } getBlue() { return this.blue; } getYellow() { return this.yellow; } getRed() { return this.red; }
    fall(color) {
      if (typeof color !== 'string') { this.fallPortal(color); return; }
      switch (color.toLowerCase()) {
        case 'purple': this.fallPortal(this.purple); break;
        case 'red': this.fallPortal(this.red); break;
        case 'yellow': this.fallPortal(this.yellow); break;
        case 'blue': this.fallPortal(this.blue); break;
        default: break;
      }
    }
    fallPortal(portal) {
      if (!portal.isShielded()) return;
      portal.setShielded(false);
      const shieldDrop = this.shieldsDropped++;
      // Remove impossible rotations
      this.possibleRotations = this.possibleRotations.filter((r) => r.getPortal(shieldDrop) === portal.getPortal());
    }
    die(portal) {
      if (portal.isDead()) return;
      portal.setDead(true);
    }
    getNextPortals() {
      const portals = [];
      for (const rotation of this.possibleRotations) {
        const portal = rotation.getPortal(this.shieldsDropped);
        if (portal != null && !portals.includes(portal)) portals.push(portal);
      }
      return portals;
    }
  }

  const union = (a, b) => {
    const x1 = Math.min(a.x, b.x); const y1 = Math.min(a.y, b.y);
    const x2 = Math.max(a.x + a.width, b.x + b.width); const y2 = Math.max(a.y + a.height, b.y + b.height);
    return new Rectangle(x1, y1, x2 - x1, y2 - y1);
  };
  const isZero = (widget) => widget.getText().trim() === '0';
  const gameOn = () => !!(ll.api && ll.api.ifOpen && ll.api.ifOpen(PEST_STATUS)) && client.getWidget(InterfaceID.PEST_STATUS_PORT2) != null;

  class PestControlOverlay extends Overlay {
    constructor(plugin) { super(plugin); this.plugin = plugin; this.game = null; this.setPosition(OverlayPosition.DYNAMIC); }
    getGame() { return this.game; }
    render(graphics) {
      // See if we are in a game or not
      if (!gameOn()) {
        if (this.game != null) this.game = null;
        return null;
      }
      if (this.game == null) this.game = new Game();
      this.renderSpinners(graphics);
      this.renderPortalWidgets(graphics);
      return null;
    }
    renderSpinners(graphics) {
      for (const npc of this.plugin.getSpinners()) OverlayUtil.renderActorOverlay(graphics, npc, npc.getName(), Color.CYAN);
    }
    renderPortalWidgets(graphics) {
      const g = this.game;
      const { purple, blue, yellow, red } = g;
      // Check for dead portals
      if (isZero(client.getWidget(PURPLE.getHitpoints()))) g.die(purple);
      if (isZero(client.getWidget(BLUE.getHitpoints()))) g.die(blue);
      if (isZero(client.getWidget(YELLOW.getHitpoints()))) g.die(yellow);
      if (isZero(client.getWidget(RED.getHitpoints()))) g.die(red);
      // display "ATK" overlay on recorded portals without shields
      this.renderAttack(graphics, purple);
      this.renderAttack(graphics, blue);
      this.renderAttack(graphics, yellow);
      this.renderAttack(graphics, red);
      // display "NEXT" overlay on predicted portals
      for (const portal of g.getNextPortals()) this.renderWidgetOverlay(graphics, portal, 'NEXT', Color.ORANGE);
      this.renderProgressWidget(graphics);
    }
    renderProgressWidget() {
      // (2007: no activity bar)
      if (InterfaceID.ACTIVITY_CONTAINER == null) return;
    }
    renderWidgetOverlay(graphics, portal, text, color) {
      const shield = client.getWidget(portal.getShield());
      const icon = client.getWidget(portal.getIcon());
      const hp = client.getWidget(portal.getHitpoints());
      const barHeight = 0; // (no activity bar in 2007)
      // create one rectangle from two different widget bounds
      let bounds = union(shield.getBounds(), icon.getBounds());
      bounds = union(bounds, hp.getBounds());
      graphics.setColor(color);
      graphics.draw(new Rectangle(bounds.x, bounds.y - 2, bounds.width, bounds.height - 3));
      const fm = graphics.getFontMetrics();
      const tw = fm.stringWidth(text); const th = fm.getHeight();
      const x = Math.trunc(bounds.x + bounds.width / 2 - tw / 2);
      const y = Math.trunc(bounds.y + bounds.height + th + barHeight);
      graphics.setColor(Color.BLACK);
      graphics.drawString(text, x + 1, y + 5);
      graphics.setColor(color);
      graphics.drawString(text, x, y + 4);
    }
    renderAttack(graphics, portal) {
      if (portal.isShielded() || portal.isDead()) return;
      this.renderWidgetOverlay(graphics, portal.getPortal(), 'ATK', Color.RED);
    }
  }

  const SPINNER_IDS = new Set(Object.values(NpcID));
  const SHIELD_DROP = /^The ([a-z]+), [^ ]+ portal shield has dropped!/i;
  const sameNpc = (a, b) => a === b || (!!a && !!b && a.getIndex && b.getIndex && a.getIndex() === b.getIndex());

  class PestControlPlugin {
    constructor() { this.spinners = []; this.overlay = new PestControlOverlay(this); }
    getSpinners() { return this.spinners; }
    startUp() { rl.overlayManager.add(this.overlay); }
    shutDown() { rl.overlayManager.remove(this.overlay); this.spinners.length = 0; }
    onGameStateChanged(event) {
      const s = event.getGameState();
      if (s === GameState.CONNECTION_LOST || s === GameState.LOGIN_SCREEN || s === GameState.HOPPING) this.spinners.length = 0;
    }
    onChatMessage(chatMessage) {
      if (this.overlay.getGame() != null && chatMessage.getType() === 'GAMEMESSAGE') {
        const m = SHIELD_DROP.exec(rl.Text ? rl.Text.removeTags(chatMessage.getMessage()) : chatMessage.getMessage());
        if (m) this.overlay.getGame().fall(m[1]);
      }
    }
    onNpcSpawned(event) { const npc = event.getNpc(); if (SPINNER_IDS.has(npc.getId())) this.spinners.push(npc); }
    onNpcDespawned(event) { const i = this.spinners.findIndex((n) => sameNpc(n, event.getNpc())); if (i >= 0) this.spinners.splice(i, 1); }
  }

  const plugin = new PestControlPlugin();
  ll.__pestcontrol = { plugin, Game, Portal, ROTATIONS, InterfaceID };
  rl.registerPlugin('pestcontrol', plugin);
})();
