// RuneLite's Boosts Information plugin, cloned from net.runelite.client.plugins.boosts (BSD 2-Clause,
// Copyright (c) 2016-2018, Adam <Adam@sigterm.info>, Tomas Slusny and RuneLite contributors):
// BoostsPlugin, BoostIndicator, StatChangeIndicator, BoostsOverlay, CompactBoostsOverlay.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Skill, Color, LineComponent, TextComponent, Point, Dimension, OverlayPanel, Overlay, OverlayPosition, OverlayPriority, InfoBox, ColorUtil } = rl;

  const COMBAT = new Set([Skill.ATTACK, Skill.STRENGTH, Skill.DEFENCE, Skill.RANGED, Skill.MAGIC]);
  // (Sailing left out: not in 2007)
  const NON_COMBAT = new Set([Skill.MINING, Skill.AGILITY, Skill.SMITHING, Skill.HERBLORE, Skill.FISHING, Skill.THIEVING, Skill.COOKING, Skill.CRAFTING,
    Skill.FIREMAKING, Skill.FLETCHING, Skill.WOODCUTTING, Skill.RUNECRAFT, Skill.SLAYER, Skill.FARMING, Skill.CONSTRUCTION, Skill.HUNTER]);
  const GAME_TICK_LENGTH = 600;

  class BoostIndicator extends InfoBox {
    constructor(skill, image, plugin, config) {
      super(image, plugin);
      this.plugin = plugin; this.config = config; this.skill = skill;
      this.setTooltip(skill.getName() + ' boost');
      this.setPriority('HIGH');
    }
    getText() {
      if (!this.config.useRelativeBoost()) return String(client.getBoostedSkillLevel(this.skill));
      const boost = client.getBoostedSkillLevel(this.skill) - client.getRealSkillLevel(this.skill);
      return boost > 0 ? '+' + boost : String(boost);
    }
    getTextColor() {
      const boosted = client.getBoostedSkillLevel(this.skill); const base = client.getRealSkillLevel(this.skill);
      if (boosted < base) return new Color(238, 51, 51);
      return boosted - base <= this.config.boostThreshold() ? Color.YELLOW : Color.GREEN;
    }
    render() { return this.plugin.skillsToDisplay.has(this.skill) && this.config.displayInfoboxes(); }
    getName() { return 'Boost ' + this.skill.getName(); }
  }

  class StatChangeIndicator extends InfoBox {
    constructor(up, image, plugin, config) {
      super(image, plugin);
      this.up = up; this.plugin = plugin; this.config = config;
      this.setPriority('MED');
      this.setTooltip(up ? 'Next debuff change' : 'Next buff change');
    }
    ticks() { return this.up ? this.plugin.getChangeUpTicks() : this.plugin.getChangeDownTicks(); }
    getText() { return String(this.plugin.getChangeTime(this.ticks())).padStart(2, '0'); }
    getTextColor() { return this.ticks() < 10 ? Color.RED.brighter() : Color.WHITE; }
    render() { return this.ticks() !== -1 && this.config.displayInfoboxes(); }
  }

  function textColor(config, boost) {
    if (boost < 0) return new Color(238, 51, 51);
    return boost <= config.boostThreshold() ? Color.YELLOW : Color.GREEN;
  }

  class BoostsOverlay extends OverlayPanel {
    constructor(plugin, config) { super(plugin); this.plugin = plugin; this.config = config; this.setPosition(OverlayPosition.TOP_LEFT); this.setPriority(OverlayPriority.MED); }
    render(graphics) {
      if (!this.config.displayPanel()) return null;
      let next = this.plugin.getChangeDownTicks();
      if (next !== -1) this.panelComponent.getChildren().push(LineComponent.builder().left('Next + restore in').right(String(this.plugin.getChangeTime(next))).build());
      next = this.plugin.getChangeUpTicks();
      if (next !== -1) this.panelComponent.getChildren().push(LineComponent.builder().left('Next - restore in').right(String(this.plugin.getChangeTime(next))).build());
      for (const skill of this.plugin.skillsToDisplay) {
        const boosted = client.getBoostedSkillLevel(skill); const base = client.getRealSkillLevel(skill);
        const boost = boosted - base;
        const col = textColor(this.config, boost);
        const str = this.config.useRelativeBoost() ? (boost > 0 ? '+' + boost : String(boost))
          : ColorUtil.prependColorTag(String(boosted), col) + ColorUtil.prependColorTag('/' + base, Color.WHITE);
        this.panelComponent.getChildren().push(LineComponent.builder().left(skill.getName()).right(str).rightColor(col).build());
      }
      return super.render(graphics);
    }
  }

  class CompactBoostsOverlay extends Overlay {
    constructor(plugin, config) { super(plugin); this.plugin = plugin; this.config = config; this.setPosition(OverlayPosition.TOP_LEFT); this.setPriority(OverlayPriority.MED); }
    render(graphics) {
      if (!this.config.compactDisplay()) return null;
      this.curY = 0; this.maxX = 0;
      const fm = graphics.getFontMetrics();
      const fh = fm.getHeight();
      for (const skill of this.plugin.skillsToDisplay) {
        const boosted = client.getBoostedSkillLevel(skill); const base = client.getRealSkillLevel(skill);
        const boost = boosted - base;
        if (boost === 0) continue;
        this.drawBoost(graphics, fm, fh, rl.SkillIconManager.getSkillImage(skill, true), textColor(this.config, boost),
          this.config.useRelativeBoost() ? (boost > 0 ? '+' + boost : String(boost)) : String(boosted));
      }
      let time = this.plugin.getChangeUpTicks();
      if (time !== -1) this.drawBoost(graphics, fm, fh, this.plugin.resources['debuffedsmall.png'], time < 10 ? Color.RED.brighter() : Color.WHITE, String(this.plugin.getChangeTime(time)));
      time = this.plugin.getChangeDownTicks();
      if (time !== -1) this.drawBoost(graphics, fm, fh, this.plugin.resources['buffedsmall.png'], time < 10 ? Color.RED.brighter() : Color.WHITE, String(this.plugin.getChangeTime(time)));
      return new Dimension(this.maxX, this.curY);
    }
    drawBoost(graphics, fm, fh, image, color, text) {
      const iw = image ? image.width || 0 : 0; const ih = image ? image.height || 0 : 0;
      if (image) graphics.drawImage(image, 0, this.curY);
      const tc = new TextComponent();
      tc.setColor(color); tc.setText(text); tc.setOutline(true);
      tc.setPosition(new Point(iw + 2 + (22 - fm.stringWidth(text)), this.curY + fh));
      tc.render(graphics);
      this.curY += Math.max(ih, fh) + 1;
      this.maxX = Math.max(this.maxX, iw + 2 + 22);
    }
  }

  class BoostsPlugin {
    constructor() {
      this.configGroup = 'boosts';
      this.config = rl.configProxy('boosts', () => this.configItems);
      this.skillsToDisplay = new Set();
      this.shownSkills = new Set();
      this.isChangedDown = false; this.isChangedUp = false;
      this.lastSkillLevels = new Array(Skill.values().length).fill(-1);
      this.lastChangeDown = -1; this.lastChangeUp = -1;
      this.lastTickMillis = 0;
      this.boostsOverlay = new BoostsOverlay(this, this.config);
      this.compactBoostsOverlay = new CompactBoostsOverlay(this, this.config);
    }
    startUp() {
      rl.overlayManager.add(this.boostsOverlay);
      rl.overlayManager.add(this.compactBoostsOverlay);
      this.updateShownSkills();
      this.lastSkillLevels.fill(-1);
      rl.infoBoxManager.addInfoBox(new StatChangeIndicator(true, this.resources['debuffed.png'], this, this.config));
      rl.infoBoxManager.addInfoBox(new StatChangeIndicator(false, this.resources['buffed.png'], this, this.config));
      for (const skill of Skill.values()) rl.infoBoxManager.addInfoBox(new BoostIndicator(skill, rl.SkillIconManager.getSkillImage(skill), this, this.config));
    }
    shutDown() {
      rl.overlayManager.remove(this.boostsOverlay);
      rl.overlayManager.remove(this.compactBoostsOverlay);
      rl.infoBoxManager.removeIf((t) => t instanceof BoostIndicator || t instanceof StatChangeIndicator);
      this.lastChangeDown = -1; this.lastChangeUp = -1; this.isChangedUp = false; this.isChangedDown = false;
      this.skillsToDisplay.clear();
    }
    onGameStateChanged(e) {
      if (e.getGameState() === rl.GameState.LOGIN_SCREEN) { this.lastChangeDown = -1; this.lastChangeUp = -1; }
    }
    onConfigChanged() {
      this.updateShownSkills();
      if (this.config.displayNextBuffChange() === 'NEVER') this.lastChangeDown = -1;
      if (this.config.displayNextDebuffChange() === 'NEVER') this.lastChangeUp = -1;
    }
    onStatChanged(e) {
      const skill = e.getSkill();
      if (!COMBAT.has(skill) && !NON_COMBAT.has(skill)) return;
      const idx = skill.ordinal;
      const last = this.lastSkillLevels[idx];
      const cur = client.getBoostedSkillLevel(skill);
      if (cur === last - 1) this.lastChangeDown = client.getTickCount();
      if (cur === last + 1) this.lastChangeUp = client.getTickCount();
      this.lastSkillLevels[idx] = cur;
      this.updateBoostedStats();
      const threshold = this.config.boostThreshold();
      const real = client.getRealSkillLevel(skill);
      if (cur - real <= threshold && threshold < last - real && this.config.notifyOnBoost()) rl.notifier.notify(skill.getName() + ' level is getting low!');
    }
    onGameTick() {
      this.lastTickMillis = Date.now();
      if (this.getChangeUpTicks() <= 0) {
        const m = this.config.displayNextDebuffChange();
        if (m === 'ALWAYS') { if (this.lastChangeUp !== -1) this.lastChangeUp = client.getTickCount(); } else this.lastChangeUp = -1;
      }
      if (this.getChangeDownTicks() <= 0) {
        const m = this.config.displayNextBuffChange();
        if (m === 'ALWAYS') { if (this.lastChangeDown !== -1) this.lastChangeDown = client.getTickCount(); } else this.lastChangeDown = -1;
      }
    }
    updateShownSkills() {
      const m = this.config.displayBoosts();
      const set = (s, on) => s.forEach((k) => (on ? this.shownSkills.add(k) : this.shownSkills.delete(k)));
      if (m === 'NONE') { set(COMBAT, false); set(NON_COMBAT, false); }
      if (m === 'COMBAT') { set(COMBAT, true); set(NON_COMBAT, false); }
      if (m === 'NON_COMBAT') { set(COMBAT, false); set(NON_COMBAT, true); }
      if (m === 'BOTH') { set(COMBAT, true); set(NON_COMBAT, true); }
      this.updateBoostedStats();
    }
    updateBoostedStats() {
      this.isChangedDown = false; this.isChangedUp = false;
      this.skillsToDisplay.clear();
      for (const skill of Skill.values()) {
        if (!this.shownSkills.has(skill)) continue;
        const boosted = client.getBoostedSkillLevel(skill); const base = client.getRealSkillLevel(skill);
        if (boosted > base) this.isChangedUp = true; else if (boosted < base) this.isChangedDown = true;
        if (boosted !== base) this.skillsToDisplay.add(skill);
      }
    }
    getChangeDownTicks() {
      const m = this.config.displayNextBuffChange();
      if (this.lastChangeDown === -1 || m === 'NEVER' || (m === 'BOOSTED' && !this.isChangedUp)) return -1;
      const since = client.getTickCount() - this.lastChangeDown;
      // (no Preserve prayer in 2007)
      if (since > 125) return 150 - since;
      return since > 100 ? 125 - since : 100 - since;
    }
    getChangeUpTicks() {
      const m = this.config.displayNextDebuffChange();
      if (this.lastChangeUp === -1 || m === 'NEVER' || (m === 'BOOSTED' && !this.isChangedDown)) return -1;
      return 100 - (client.getTickCount() - this.lastChangeUp);
    }
    getChangeTime(time) {
      const diff = Date.now() - this.lastTickMillis;
      return time !== -1 ? Math.trunc((time * GAME_TICK_LENGTH - diff) / 1000) : time;
    }
  }

  rl.registerPlugin('boosts', new BoostsPlugin());
})();
