// RuneLite's Poison plugin, cloned from net.runelite.client.plugins.poison (BSD 2-Clause, Copyright (c) 2018, Hydrox6
// <ikada@protonmail.ch> and RuneLite contributors): PoisonPlugin, PoisonConfig, PoisonInfobox, PoisonOverlay.
// Era-trim: no venom (2014), so the venom threshold, its splat and heart never come up; the varps are the 2007 cache's
// (poison 102). The 2007 hitmarks sprite (298, the green poison splat is image 2) stands for
// SpriteID.Hitmark.HITSPLAT_GREEN_POISON. 2007 has no hitpoints orb widget: the tooltip shows over our Status Orbs'
// hitpoints orb, where it is, and "Change HP orb icon" has no orb sprite to override (Status Orbs already turns its
// orb green while poisoned).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Color, Overlay, OverlayPosition, OverlayLayer, Timer, Tooltip, ColorUtil, Graphics2D, FontManager, Rectangle } = rl;
  const GROUP = 'poison';
  const POISON_TICK_MILLIS = 18200;
  const VENOM_THRESHOLD = 1000000;
  const VENOM_MAXIUMUM_DAMAGE = 20;
  const POISON = 102; // VarPlayerID.POISON
  const HITMARKS = 298; const HITSPLAT_GREEN_POISON = 2;
  // our Status Orbs' hitpoints orb (its own layout: an arc round the minimap; the orb is 60 x 28 at the angle 202)
  const healthOrbBounds = () => {
    const cx = Math.round(637 + 79 * Math.cos((202 * Math.PI) / 180)); const cy = Math.round(82 + 79 * Math.sin((202 * Math.PI) / 180));
    return new Rectangle(cx - 45, cy - 14, 60, 28);
  };
  const orbShown = () => !!document.querySelector('canvas.ll-orb') && [...document.querySelectorAll('canvas.ll-orb')].some((e) => e.style.display !== 'none');

  class PoisonInfobox extends Timer {
    constructor(image, plugin) { super(POISON_TICK_MILLIS, image, plugin); this.plugin = plugin; }
    getTooltip() { return this.plugin.createTooltip(); }
    getTextColor() { return Color.RED.brighter(); }
  }

  class PoisonOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_WIDGETS);
    }
    render() {
      if (this.plugin.lastDamage <= 0) return null;
      if (!orbShown()) return null;
      const bounds = healthOrbBounds();
      if (bounds.getX() <= 0) return null;
      const mousePosition = client.getMouseCanvasPosition();
      if ((mousePosition && bounds.contains(mousePosition.getX(), mousePosition.getY())) || (rl.statusOrbs && rl.statusOrbs.hovered('hitpoints'))) rl.tooltipManager.add(new Tooltip(this.plugin.createTooltip()));
      return null;
    }
  }

  class PoisonPlugin {
    constructor() {
      this.configGroup = GROUP;
      this.lastDamage = 0; this.envenomed = false; this.infobox = null; this.poisonNaturalCure = null; this.nextPoisonTick = null;
    }
    getLastDamage() { return this.lastDamage; }
    startUp() {
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.overlay = new PoisonOverlay(this);
      rl.overlayManager.add(this.overlay);
    }
    shutDown() {
      rl.overlayManager.remove(this.overlay);
      if (this.infobox != null) rl.infoBoxManager.removeInfoBox(this.infobox);
      this.infobox = null; this.envenomed = false; this.lastDamage = 0; this.poisonNaturalCure = null; this.nextPoisonTick = null;
    }
    onVarbitChanged(event) {
      if (event.getVarpId() !== POISON || (event.getVarbitId && event.getVarbitId() !== -1)) return;
      const poisonValue = event.getValue();
      this.nextPoisonTick = Date.now() + POISON_TICK_MILLIS;
      const damage = PoisonPlugin.nextDamage(poisonValue);
      this.lastDamage = damage;
      this.envenomed = poisonValue >= VENOM_THRESHOLD;
      this.poisonNaturalCure = poisonValue < VENOM_THRESHOLD ? Date.now() + POISON_TICK_MILLIS * poisonValue : null;
      if (this.config.showInfoboxes()) {
        if (this.infobox != null) { rl.infoBoxManager.removeInfoBox(this.infobox); this.infobox = null; }
        if (damage > 0) {
          const image = this.getSplat(HITSPLAT_GREEN_POISON, damage);
          if (image != null) { this.infobox = new PoisonInfobox(image, this); rl.infoBoxManager.addInfoBox(this.infobox); }
        }
      }
    }
    onConfigChanged(event) {
      if (event.getGroup() !== GROUP) return;
      if (!this.config.showInfoboxes() && this.infobox != null) { rl.infoBoxManager.removeInfoBox(this.infobox); this.infobox = null; }
    }
    static nextDamage(poisonValue) {
      let damage;
      if (poisonValue >= VENOM_THRESHOLD) {
        poisonValue -= VENOM_THRESHOLD - 3;
        damage = Math.min(poisonValue * 2, VENOM_MAXIUMUM_DAMAGE);
      } else {
        damage = Math.ceil(poisonValue / 5.0);
      }
      return damage;
    }
    getSplat(file, damage) {
      const rawSplat = rl.spriteManager.getSprite(HITMARKS, file);
      if (rawSplat == null) return null;
      const splat = document.createElement('canvas'); splat.width = rawSplat.w; splat.height = rawSplat.h;
      const g = new Graphics2D(splat.getContext('2d'));
      g.drawImage(rawSplat, 0, 0);
      g.setFont(FontManager.getRunescapeSmallFont());
      const metrics = g.getFontMetrics();
      const text = String(damage);
      const x = Math.trunc((splat.width - metrics.stringWidth(text)) / 2);
      const y = Math.trunc((splat.height - metrics.getHeight()) / 2) + metrics.getAscent();
      g.setColor(Color.BLACK); g.drawString(text, x + 1, y + 1);
      g.setColor(Color.WHITE); g.drawString(text, x, y);
      return splat;
    }
    static getFormattedTime(endTime) {
      const seconds = Math.trunc((endTime - Date.now()) / 1000);
      return `${Math.trunc(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }
    createTooltip() {
      const line1 = `Next ${this.envenomed ? 'venom' : 'poison'} damage: ${ColorUtil.wrapWithColorTag(String(this.lastDamage), Color.RED)}</br>Time until damage: ${PoisonPlugin.getFormattedTime(this.nextPoisonTick)}`;
      const line2 = this.envenomed ? '' : `</br>Time until cure: ${PoisonPlugin.getFormattedTime(this.poisonNaturalCure)}`;
      return line1 + line2;
    }
  }

  const plugin = new PoisonPlugin();
  ll.__poison = { plugin, PoisonPlugin };
  rl.registerPlugin(GROUP, plugin);
})();
