// RuneLite's Cooking plugin, cloned from net.runelite.client.plugins.cooking (BSD 2-Clause, Copyright (c) 2018, Joris K
// <kjorisje@gmail.com>, (c) 2018, Lasse <cronick@zytex.dk> and RuneLite contributors): CookingPlugin, CookingOverlay,
// CookingSession, FermentTimer.
// 2007: the cooking messages are plain game messages (OSRS sends them as SPAM). Making wine plays no spotanim in 2007
// (OSRS's COOKING_MAKE_WINE_SPOTANIM is later), so the ferment timer starts from the message the 2007 server sends
// then, and runs the server's 20 ticks (settimer(fermenting_wine, 20): 12 s; OSRS's wine takes 13.8 s).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Skill, Color, LineComponent, TitleComponent, OverlayPanel, OverlayPosition, InfoBox } = rl;
  const HUMAN_FIRECOOKING = 897;
  const HUMAN_COOKING = 896;
  const JUG_WINE = 1993;
  const WINE_MESSAGE = 'You squeeze the grapes into the jug. The wine begins to ferment.';

  class CookingSession {
    constructor() { this.lastCookingAction = null; this.cookAmount = 0; this.burnAmount = 0; }
    getLastCookingAction() { return this.lastCookingAction; }
    getCookAmount() { return this.cookAmount; }
    getBurnAmount() { return this.burnAmount; }
    updateLastCookingAction() { this.lastCookingAction = Date.now(); }
    increaseCookAmount() { this.cookAmount++; }
    increaseBurnAmount() { this.burnAmount++; }
    getBurntPercentage() { return (this.getBurnAmount() / (this.getCookAmount() + this.getBurnAmount())) * 100; }
  }

  // ---------------------------------------------------------------- FermentTimer
  const FERMENT_TIME = 20 * 600; // (2007: the server's 20 ticks)
  class FermentTimer extends InfoBox {
    constructor(image, plugin) { super(image, plugin); this.reset(); }
    getText() { return String(this.timeUntilFerment()); }
    getTextColor() { return this.timeUntilFerment() <= 3 ? Color.RED : Color.WHITE; }
    cull() { return this.timeUntilFerment() <= 0; }
    reset() { this.fermentTime = Date.now() + FERMENT_TIME; }
    timeUntilFerment() { return Math.trunc((this.fermentTime - Date.now()) / 1000); }
  }

  // ---------------------------------------------------------------- CookingOverlay
  const COOK_TIMEOUT = 3;
  const COOKING_RESET = 'Reset';
  // DecimalFormat("#.#")
  const FORMAT = (n) => String(Math.round(n * 10) / 10);
  class CookingOverlay extends OverlayPanel {
    constructor(plugin) {
      super(plugin);
      this.setPosition(OverlayPosition.TOP_LEFT);
      this.plugin = plugin;
      this.addMenuEntry('RUNELITE_OVERLAY_CONFIG', 'Configure', 'Cooking overlay');
      this.addMenuEntry('RUNELITE_OVERLAY', COOKING_RESET, 'Cooking overlay', () => plugin.setSession(null));
    }
    render(graphics) {
      const session = this.plugin.getSession();
      if (session == null) return null;
      const ch = this.panelComponent.getChildren();
      if (this.isCooking() || Math.trunc((Date.now() - session.getLastCookingAction()) / 1000) < COOK_TIMEOUT) {
        ch.push(TitleComponent.builder().text('Cooking').color(Color.GREEN).build());
      } else {
        ch.push(TitleComponent.builder().text('NOT cooking').color(Color.RED).build());
      }
      ch.push(LineComponent.builder().left('Cooked:')
        .right(session.getCookAmount() + (session.getCookAmount() >= 1 ? ' (' + rl.xpTrackerService.getActionsHr(Skill.COOKING) + '/hr)' : '')).build());
      ch.push(LineComponent.builder().left('Burnt:')
        .right(session.getBurnAmount() + (session.getBurnAmount() >= 1 ? ' (' + FORMAT(session.getBurntPercentage()) + '%)' : '')).build());
      return super.render(graphics);
    }
    isCooking() {
      const a = client.getLocalPlayer().getAnimation();
      return a === HUMAN_FIRECOOKING || a === HUMAN_COOKING;
    }
  }

  // ---------------------------------------------------------------- CookingPlugin
  const COOKED = ['You successfully cook', 'You successfully bake', 'You successfully fry', 'You manage to cook', 'You roast a',
    'You spit-roast', 'You cook', 'Eventually the Jubbly', 'You half-cook', 'The undead meat is now cooked',
    'The undead chicken is now cooked', 'You successfully scramble', 'You dry a piece of meat'];
  const BURNT = ['You accidentally burn', 'Unfortunately the Jubbly', 'You accidentally spoil'];
  class CookingPlugin {
    constructor() {
      this.config = rl.configProxy('cooking', () => this.configItems);
      this.session = null;
      this.overlay = new CookingOverlay(this);
    }
    getSession() { return this.session; }
    setSession(s) { this.session = s; }
    startUp() {
      this.session = null;
      rl.overlayManager.add(this.overlay);
    }
    shutDown() {
      rl.infoBoxManager.removeIf((b) => b instanceof FermentTimer);
      rl.overlayManager.remove(this.overlay);
      this.session = null;
    }
    onGameTick() {
      if (this.session == null || this.config.statTimeout() === 0) return;
      const statTimeout = this.config.statTimeout() * 60000;
      const sinceCooked = Date.now() - this.session.getLastCookingAction();
      if (sinceCooked >= statTimeout) this.session = null;
    }
    // (onGraphicChanged on COOKING_MAKE_WINE_SPOTANIM in RuneLite: 2007 has no wine spotanim, see the header)
    startFermentTimer() {
      if (!this.config.fermentTimer()) return;
      const fermentTimer = rl.infoBoxManager.getInfoBoxes().find((b) => b instanceof FermentTimer);
      if (fermentTimer) fermentTimer.reset();
      else rl.infoBoxManager.addInfoBox(new FermentTimer(rl.itemManager.getImage(JUG_WINE), this));
    }
    onChatMessage(event) {
      // (2007: a game message; OSRS's SPAM type is later)
      if (event.getType() !== 'SPAM' && event.getType() !== 'GAMEMESSAGE') return;
      const message = event.getMessage();
      if (message === WINE_MESSAGE) { this.startFermentTimer(); return; }
      if (COOKED.some((p) => message.startsWith(p))) {
        if (this.session == null) this.session = new CookingSession();
        this.session.updateLastCookingAction();
        this.session.increaseCookAmount();
      } else if (BURNT.some((p) => message.startsWith(p)) || message === 'You burn the mushroom in the fire.') {
        if (this.session == null) this.session = new CookingSession();
        this.session.updateLastCookingAction();
        this.session.increaseBurnAmount();
      }
    }
  }

  const plugin = new CookingPlugin();
  ll.__cooking = { plugin, FermentTimer };
  rl.registerPlugin('cooking', plugin);
})();
