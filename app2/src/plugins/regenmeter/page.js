// RuneLite's Regeneration Meter plugin, cloned from net.runelite.client.plugins.regenmeter (BSD 2-Clause, Copyright (c)
// 2018, Abex and RuneLite contributors): RegenMeterPlugin, RegenMeterOverlay, RegenMeterConfig.
// 2007 has no orb widgets: the rings go round our Status Orbs' hitpoints and special attack orbs (rl.statusOrbs), just
// outside each orb's circle so the orb doesn't cover them (RuneLite draws them on the orb's 26 px ball; ours is 26 px
// across too, so the ring is 30 px). Era-trim: no Lightbearer (2021). Special energy is varp 300 (as OSRS's SA_ENERGY);
// Rapid Heal is varp 90 (rl.Prayer.RAPID_HEAL; OSRS: varbit PRAYER_RAPIDHEAL).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Skill, Color, GameState, BasicStroke, Overlay, OverlayPosition, OverlayLayer, Arc2D, Prayer } = rl;
  const GROUP = 'regenmeter';
  const SA_ENERGY = 300;

  // Color.getHSBColor(hue, 1, 1) of the colour's hue
  const brighter = (rgb) => {
    const r = (rgb >>> 16) & 0xff; const g = (rgb >> 8) & 0xff; const b = rgb & 0xff;
    const max = Math.max(r, g, b); const min = Math.min(r, g, b);
    let h = 0;
    if (max !== min) {
      const d = max - min;
      const rc = (max - r) / d; const gc = (max - g) / d; const bc = (max - b) / d;
      if (r === max) h = bc - gc; else if (g === max) h = 2 + rc - bc; else h = 4 + gc - rc;
      h /= 6; if (h < 0) h += 1;
    }
    const hh = (h - Math.floor(h)) * 6; const f = hh - Math.floor(hh); const q = 1 - f;
    const [R, G, B] = [[1, f, 0], [q, 1, 0], [0, 1, f], [0, q, 1], [f, 0, 1], [1, 0, q]][Math.floor(hh)];
    return new Color(Math.round(R * 255), Math.round(G * 255), Math.round(B * 255));
  };
  const HITPOINTS_COLOR = brighter(0x9B0703);
  const SPECIAL_COLOR = brighter(0x1E95B0);
  const STROKE_WIDTH = 2;

  class RegenMeterOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_WIDGETS);
    }
    render(g) {
      const config = this.plugin.config;
      if (config.showHitpoints()) this.renderRegen(g, 'hitpoints', this.plugin.getHitpointsPercentage(), HITPOINTS_COLOR);
      if (config.showSpecial()) this.renderRegen(g, 'special', this.plugin.getSpecialPercentage(), SPECIAL_COLOR);
      return null;
    }
    renderRegen(g, orb, percent, color) {
      if (!rl.statusOrbs.shown(orb)) return;
      const c = rl.statusOrbs.circle(orb);
      // the ring's stroke just outside the orb's circle (radius r + 1 .. r + 3)
      const diameter = (c.r + STROKE_WIDTH) * 2;
      const arc = new Arc2D.Double(c.x - diameter / 2, c.y - diameter / 2, diameter, diameter, 90.0, -360.0 * percent, Arc2D.OPEN);
      g.setStroke(new BasicStroke(STROKE_WIDTH));
      g.setColor(color);
      g.draw(arc);
    }
  }

  const SPEC_REGEN_TICKS = 50;
  const NORMAL_HP_REGEN_TICKS = 100;
  const GAME_TICK_LENGTH = 600;
  class RegenMeterPlugin {
    constructor() { this.configGroup = GROUP; this.hitpointsPercentage = 0; this.specialPercentage = 0; this.ticksSinceSpecRegen = 0; this.ticksSinceHPRegen = 0; }
    getHitpointsPercentage() { return this.hitpointsPercentage; }
    getSpecialPercentage() { return this.specialPercentage; }
    startUp() {
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.overlay = new RegenMeterOverlay(this);
      rl.overlayManager.add(this.overlay);
    }
    shutDown() { rl.overlayManager.remove(this.overlay); }
    onGameStateChanged(ev) {
      if (ev.getGameState() === GameState.HOPPING || ev.getGameState() === GameState.LOGIN_SCREEN) {
        this.ticksSinceHPRegen = -2; // For some reason this makes this accurate
        this.ticksSinceSpecRegen = 0;
      }
    }
    onVarbitChanged(ev) {
      // (2007: Rapid Heal's own varp)
      if (ev.getVarbitId() === -1 && ev.getVarpId() === Prayer.RAPID_HEAL.getVarp()) this.ticksSinceHPRegen = 0;
    }
    onGameTick() {
      const ticksPerSpecRegen = SPEC_REGEN_TICKS;
      if (client.getVarpValue(SA_ENERGY) === 1000) this.ticksSinceSpecRegen = 0;
      else this.ticksSinceSpecRegen = (this.ticksSinceSpecRegen + 1) % ticksPerSpecRegen;
      this.specialPercentage = this.ticksSinceSpecRegen / ticksPerSpecRegen;

      let ticksPerHPRegen = NORMAL_HP_REGEN_TICKS;
      if (client.isPrayerActive(Prayer.RAPID_HEAL)) ticksPerHPRegen /= 2;
      this.ticksSinceHPRegen = (this.ticksSinceHPRegen + 1) % ticksPerHPRegen;
      this.hitpointsPercentage = this.ticksSinceHPRegen / ticksPerHPRegen;

      const currentHP = client.getBoostedSkillLevel(Skill.HITPOINTS);
      const maxHP = client.getRealSkillLevel(Skill.HITPOINTS);
      if (currentHP === maxHP && !this.config.showWhenNoChange()) this.hitpointsPercentage = 0;
      else if (currentHP > maxHP) this.hitpointsPercentage = 1 - this.hitpointsPercentage;

      if (this.config.notifyBeforeHpRegenDuration() > 0 && currentHP < maxHP && this.shouldNotifyHpRegenThisTick(ticksPerHPRegen)) {
        rl.notifier.notify('Your next hitpoint will regenerate soon!');
      }
    }
    shouldNotifyHpRegenThisTick(ticksPerHPRegen) {
      const ticksBeforeHPRegen = ticksPerHPRegen - this.ticksSinceHPRegen;
      const notifyTick = Math.ceil((this.config.notifyBeforeHpRegenDuration() * 1000) / GAME_TICK_LENGTH);
      return ticksBeforeHPRegen === notifyTick;
    }
  }

  const plugin = new RegenMeterPlugin();
  ll.__regenmeter = { plugin, RegenMeterOverlay };
  rl.registerPlugin(GROUP, plugin);
})();
