// RuneLite's XP Globes plugin, cloned from net.runelite.client.plugins.xpglobes (BSD 2-Clause, Copyright (c) 2017,
// Steve <steve.rs.dev@gmail.com> and RuneLite contributors): XpGlobesPlugin, XpGlobesOverlay, XpGlobe, XpGlobesConfig.
// The goals and rates come from the XP Tracker clone through the core's xpTrackerService (2007 has no XP goals, so the
// goal is the next level). The game is at UI scale here like a RuneLite panel overlay (TOP_CENTER).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Skill, Experience, Color, Overlay, OverlayPosition, BasicStroke, Arc2D, Point, Dimension, PanelComponent, LineComponent, Tooltip, SkillColor } = rl;
  const GROUP = 'xpglobes';

  class XpGlobe {
    constructor(skill, currentXp, currentLevel, time) { Object.assign(this, { skill, currentXp, currentLevel, time, size: 0, skillIcon: null }); }
    getSkill() { return this.skill; } setSkill(s) { this.skill = s; }
    getCurrentXp() { return this.currentXp; } setCurrentXp(x) { this.currentXp = x; }
    getCurrentLevel() { return this.currentLevel; } setCurrentLevel(l) { this.currentLevel = l; }
    getTime() { return this.time; } setTime(t) { this.time = t; }
  }

  const MINIMUM_STEP = 10;
  const PROGRESS_RADIUS_START = 90;
  const PROGRESS_RADIUS_REMAINDER = 0;
  const PROGRESS_BACKGROUND_SIZE = 5;
  const TOOLTIP_RECT_SIZE_X = 150;
  const DARK_OVERLAY_COLOR = new Color(0, 0, 0, 180);
  const FLIP_ACTION = 'Flip';
  const GLOBE_ICON_RATIO = 0.65;
  const fmt = (n) => Math.trunc(n).toLocaleString('en-US'); // DecimalFormat("###,###,###")
  const ellipse = (x, y, w, h) => ({ ellipse: { x, y, w, h }, contains(px, py) { const rx = w / 2; const ry = h / 2; const dx = px - (x + rx); const dy = py - (y + ry); return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1; } });

  class XpGlobesOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.xpTooltip = new Tooltip(new PanelComponent());
      this.xpTooltip.component = this.xpTooltip.text;
      this.xpTooltip.component.setPreferredSize(new Dimension(TOOLTIP_RECT_SIZE_X, 0));
      this.setPosition(OverlayPosition.TOP_CENTER);
      this.addMenuEntry('RUNELITE_OVERLAY_CONFIG', 'Configure', 'XP Globes overlay');
      this.addMenuEntry('RUNELITE_OVERLAY', FLIP_ACTION, 'XP Globes overlay', () => plugin.config.alignOrbsVertically(!plugin.config.alignOrbsVertically()));
    }
    render(graphics) {
      const config = this.plugin.config;
      const xpGlobes = this.plugin.getXpGlobes();
      const queueSize = xpGlobes.length;
      if (queueSize === 0) return null;
      const progressArcOffset = Math.ceil(Math.max(PROGRESS_BACKGROUND_SIZE, config.progressArcStrokeWidth()) / 2.0);
      let curDrawPosition = progressArcOffset;
      for (const xpGlobe of xpGlobes) {
        const startXp = rl.xpTrackerService.getStartGoalXp(xpGlobe.getSkill());
        const goalXp = rl.xpTrackerService.getEndGoalXp(xpGlobe.getSkill());
        if (config.alignOrbsVertically()) this.renderProgressCircle(graphics, xpGlobe, startXp, goalXp, progressArcOffset, curDrawPosition, this.getBounds());
        else this.renderProgressCircle(graphics, xpGlobe, startXp, goalXp, curDrawPosition, progressArcOffset, this.getBounds());
        curDrawPosition += MINIMUM_STEP + config.xpOrbSize();
      }
      const markersLength = queueSize * (config.xpOrbSize() + progressArcOffset) + MINIMUM_STEP * (queueSize - 1);
      if (config.alignOrbsVertically()) return new Dimension(config.xpOrbSize() + progressArcOffset * 2, markersLength);
      return new Dimension(markersLength, config.xpOrbSize() + progressArcOffset * 2);
    }
    static getSkillProgress(startXp, currentXp, goalXp) { return ((currentXp - startXp) / (goalXp - startXp)) * 100; }
    static getSkillProgressRadius(startXp, currentXp, goalXp) { return -(3.6 * XpGlobesOverlay.getSkillProgress(startXp, currentXp, goalXp)); }
    renderProgressCircle(graphics, skillToDraw, startXp, goalXp, x, y, bounds) {
      const config = this.plugin.config;
      const radiusCurrentXp = XpGlobesOverlay.getSkillProgressRadius(startXp, skillToDraw.getCurrentXp(), goalXp);
      const radiusToGoalXp = 360;
      const backgroundCircle = this.drawEllipse(graphics, x, y);
      this.drawSkillImage(graphics, skillToDraw, x, y);
      const mouse = client.getMouseCanvasPosition();
      const b = bounds || { x: 0, y: 0 };
      // (the overlay is drawn at UI scale: the mouse goes into the overlay's units)
      const s = graphics.scale || 1;
      const mouseX = (mouse.getX() - b.x) / s; const mouseY = (mouse.getY() - b.y) / s;
      if (backgroundCircle.contains(mouseX, mouseY)) {
        graphics.setColor(DARK_OVERLAY_COLOR);
        graphics.fill(backgroundCircle);
        this.drawProgressLabel(graphics, skillToDraw, startXp, goalXp, x, y);
        if (config.enableTooltips()) this.drawTooltip(skillToDraw, goalXp);
      }
      this.drawProgressArc(graphics, x, y, config.xpOrbSize(), config.xpOrbSize(), PROGRESS_RADIUS_REMAINDER, radiusToGoalXp, PROGRESS_BACKGROUND_SIZE, config.progressOrbOutLineColor());
      this.drawProgressArc(graphics, x, y, config.xpOrbSize(), config.xpOrbSize(), PROGRESS_RADIUS_START, radiusCurrentXp, config.progressArcStrokeWidth(),
        config.enableCustomArcColor() ? config.progressArcColor() : SkillColor.find(skillToDraw.getSkill()).getColor());
    }
    drawProgressLabel(graphics, globe, startXp, goalXp, x, y) {
      if (goalXp <= globe.getCurrentXp()) return;
      const size = this.plugin.config.xpOrbSize();
      const progress = `${Math.trunc(XpGlobesOverlay.getSkillProgress(startXp, globe.getCurrentXp(), goalXp))}%`;
      const metrics = graphics.getFontMetrics();
      const drawX = x + Math.trunc(size / 2) - Math.trunc(metrics.stringWidth(progress) / 2);
      const drawY = y + Math.trunc(size / 2) + Math.trunc(metrics.getHeight() / 2);
      rl.OverlayUtil.renderTextLocation(graphics, new Point(drawX, drawY), progress, Color.WHITE);
    }
    drawProgressArc(graphics, x, y, w, h, radiusStart, radiusEnd, strokeWidth, color) {
      const stroke = graphics.getStroke();
      graphics.setStroke(new BasicStroke(strokeWidth));
      graphics.setColor(color);
      graphics.draw(new Arc2D.Double(x, y, w, h, radiusStart, radiusEnd, Arc2D.OPEN));
      graphics.setStroke(stroke);
    }
    drawEllipse(graphics, x, y) {
      const size = this.plugin.config.xpOrbSize();
      graphics.setColor(this.plugin.config.progressOrbBackgroundColor());
      const e = ellipse(x, y, size, size);
      graphics.fill(e);
      graphics.draw(e);
      return e;
    }
    drawSkillImage(graphics, xpGlobe, x, y) {
      const orbSize = this.plugin.config.xpOrbSize();
      const skillImage = this.getScaledSkillIcon(xpGlobe, orbSize);
      if (skillImage == null) return;
      graphics.drawImage(skillImage, x + Math.trunc(orbSize / 2) - Math.trunc(skillImage.width / 2), y + Math.trunc(orbSize / 2) - Math.trunc(skillImage.height / 2));
    }
    getScaledSkillIcon(xpGlobe, orbSize) {
      if (xpGlobe.skillIcon != null && xpGlobe.size === orbSize) return xpGlobe.skillIcon;
      const icon = rl.SkillIconManager.getSkillImage(xpGlobe.getSkill());
      if (icon == null || !icon.width) return null; // (not loaded yet)
      const size = orbSize - this.plugin.config.progressArcStrokeWidth();
      const scaledIconSize = Math.trunc(size * GLOBE_ICON_RATIO);
      if (scaledIconSize <= 0) return null;
      // ImageUtil.resizeImage(icon, n, n, true): keeps the aspect ratio
      const r = Math.min(scaledIconSize / icon.width, scaledIconSize / icon.height);
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(icon.width * r)); c.height = Math.max(1, Math.round(icon.height * r));
      const cx = c.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(icon, 0, 0, c.width, c.height);
      xpGlobe.skillIcon = c; xpGlobe.size = orbSize;
      return c;
    }
    drawTooltip(mouseOverSkill, goalXp) {
      const config = this.plugin.config;
      mouseOverSkill.setTime(Date.now());
      const xpTooltip = this.xpTooltip.component;
      const ch = xpTooltip.getChildren();
      ch.length = 0;
      ch.push(LineComponent.builder().left(mouseOverSkill.getSkill().getName()).right(String(mouseOverSkill.getCurrentLevel())).build());
      ch.push(LineComponent.builder().left('Current XP:').leftColor(Color.ORANGE).right(fmt(mouseOverSkill.getCurrentXp())).build());
      if (goalXp > mouseOverSkill.getCurrentXp()) {
        if (config.showActionsLeft()) {
          const actionsLeft = rl.xpTrackerService.getActionsLeft(mouseOverSkill.getSkill());
          if (actionsLeft !== 2147483647) ch.push(LineComponent.builder().left('Actions left:').leftColor(Color.ORANGE).right(fmt(actionsLeft)).build());
        }
        if (config.showXpLeft()) ch.push(LineComponent.builder().left('XP left:').leftColor(Color.ORANGE).right(fmt(goalXp - mouseOverSkill.getCurrentXp())).build());
        if (config.showXpHour()) {
          const xpHr = rl.xpTrackerService.getXpHr(mouseOverSkill.getSkill());
          if (xpHr !== 0) ch.push(LineComponent.builder().left('XP per hour:').leftColor(Color.ORANGE).right(fmt(xpHr)).build());
        }
        if (config.showTimeTilGoal()) ch.push(LineComponent.builder().left('Time left:').leftColor(Color.ORANGE).right(rl.xpTrackerService.getTimeTilGoal(mouseOverSkill.getSkill())).build());
      }
      rl.tooltipManager.add({ component: xpTooltip });
    }
  }

  const MAXIMUM_SHOWN_GLOBES = 5;
  class XpGlobesPlugin {
    constructor() { this.configGroup = GROUP; this.globeCache = new Array(Skill.values().length).fill(null); this.xpGlobes = []; }
    getXpGlobes() { return this.xpGlobes; }
    startUp() {
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.overlay = new XpGlobesOverlay(this);
      rl.overlayManager.add(this.overlay);
      // @Schedule(period = 1, unit = SECONDS) removeExpiredXpGlobes
      this.timer = setInterval(() => this.removeExpiredXpGlobes(), 1000);
    }
    shutDown() { clearInterval(this.timer); rl.overlayManager.remove(this.overlay); }
    onStatChanged(statChanged) {
      const skill = statChanged.getSkill();
      const currentXp = statChanged.getXp();
      let currentLevel = statChanged.getLevel();
      const skillIdx = skill.ordinal;
      const cachedGlobe = this.globeCache[skillIdx];
      if (cachedGlobe != null && cachedGlobe.getCurrentXp() >= currentXp) return;
      if (currentLevel >= Experience.MAX_REAL_LEVEL) {
        if (this.config.hideMaxed()) return;
        if (this.config.showVirtualLevel()) currentLevel = Experience.getLevelForXp(currentXp);
      }
      if (cachedGlobe != null) {
        cachedGlobe.setSkill(skill);
        cachedGlobe.setCurrentXp(currentXp);
        cachedGlobe.setCurrentLevel(currentLevel);
        cachedGlobe.setTime(Date.now());
        this.addXpGlobe(cachedGlobe);
      } else {
        this.globeCache[skillIdx] = new XpGlobe(skill, currentXp, currentLevel, Date.now());
      }
    }
    addXpGlobe(xpGlobe) {
      if (this.xpGlobes.includes(xpGlobe)) return;
      // (sorted by skill, as Collections.binarySearch on Skill's order)
      let i = 0; while (i < this.xpGlobes.length && this.xpGlobes[i].getSkill().ordinal < xpGlobe.getSkill().ordinal) i++;
      this.xpGlobes.splice(i, 0, xpGlobe);
      if (this.xpGlobes.length > MAXIMUM_SHOWN_GLOBES) {
        const oldest = this.xpGlobes.reduce((a, b) => (b.getTime() < a.getTime() ? b : a));
        this.xpGlobes.splice(this.xpGlobes.indexOf(oldest), 1);
      }
    }
    removeExpiredXpGlobes() {
      if (!this.xpGlobes.length) return;
      const expireTime = Date.now() - this.config.xpOrbDuration() * 1000;
      this.xpGlobes = this.xpGlobes.filter((g) => !(g.getTime() < expireTime));
    }
    resetGlobeState() { this.xpGlobes = []; this.globeCache = new Array(Skill.values().length).fill(null); }
    onGameStateChanged(event) {
      switch (event.getGameState()) {
        case 'HOPPING': case 'LOGGING_IN': case 'LOGIN_SCREEN': this.resetGlobeState(); break; // (2007: no LOGGING_IN)
        default:
      }
    }
  }

  const plugin = new XpGlobesPlugin();
  ll.__xpglobes = { plugin, XpGlobesOverlay };
  rl.registerPlugin(GROUP, plugin);
})();
