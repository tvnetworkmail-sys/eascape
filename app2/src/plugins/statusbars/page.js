// RuneLite's Status Bars plugin, cloned from net.runelite.client.plugins.statusbars (BSD 2-Clause, Copyright (c) 2019,
// Jos <Malevolentdev@gmail.com> and RuneLite contributors): StatusBarsPlugin, StatusBarsOverlay, BarRenderer,
// StatusBarsConfig, Viewport.
// 2007: the fixed client's side panel is the same 190 x 261 rectangle at 547,205 as OSRS's Toplevel.SIDE_PANELS (and the
// bank's inventory side takes it too), so Viewport FIXED / FIXED_BANK are the open sidebar interface's rectangle (client
// hook `subRects`); no resizable layouts in 2007 (Bar width only applies to RESIZED_BOTTOM, so it is inert). Era-trim: no
// Warmth (Wintertodt), venom, disease, parasite, stamina colours or Last Man Standing. The orb icons are OSRS's
// (runelite/assets/orbicon: our Status Orbs' icons and RuneLite's poisoned heart). Restore values come from Item Stats'
// ItemStatChangesService (rl.itemStatChangesService, bound when Item Stats' page loads, as RuneLite's public module). PvP area
// = the 2007 Wilderness overlay (381) open.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Skill, Color, Overlay, OverlayPosition, OverlayLayer, TextComponent, Point, FontManager, Prayer, NPC, Player } = rl;
  const GROUP = 'statusbars';
  const POISON = 102; const SA_ENERGY = 300;

  const BACKGROUND = new Color(0, 0, 0, 150);
  const OVERHEAL_COLOR = new Color(216, 255, 139, 150);
  const SKILL_ICON_HEIGHT = 35;
  const COUNTER_ICON_HEIGHT = 18;
  const BORDER_SIZE = 1;
  const MIN_ICON_AND_COUNTER_WIDTH = 16;
  const DEFAULT_WIDTH = 20;
  class BarRenderer {
    constructor(maxValueSupplier, currentValueSupplier, healSupplier, colorSupplier, healColorSupplier, iconSupplier) {
      Object.assign(this, { maxValueSupplier, currentValueSupplier, healSupplier, colorSupplier, healColorSupplier, iconSupplier, maxValue: 0, currentValue: 0 });
    }
    refreshSkills() { this.maxValue = this.maxValueSupplier(); this.currentValue = this.currentValueSupplier(); }
    renderBar(config, graphics, x, y, width, height) {
      const filledHeight = BarRenderer.getBarHeight(this.maxValue, this.currentValue, height);
      const fill = this.colorSupplier();
      this.refreshSkills();
      graphics.setColor(BACKGROUND);
      graphics.drawRect(x, y, width - BORDER_SIZE, height - BORDER_SIZE);
      graphics.fillRect(x, y, width, height);
      graphics.setColor(fill);
      graphics.fillRect(x + BORDER_SIZE, y + BORDER_SIZE + (height - filledHeight), width - BORDER_SIZE * 2, filledHeight - BORDER_SIZE * 2);
      if (config.enableRestorationBars()) this.renderRestore(graphics, x, y, width, height);
      if (config.enableSkillIcon() || config.enableCounter()) this.renderIconsAndCounters(config, graphics, x, y, width);
    }
    renderIconsAndCounters(config, graphics, x, y, width) {
      if (width < MIN_ICON_AND_COUNTER_WIDTH) return;
      const skillIconEnabled = config.enableSkillIcon();
      if (skillIconEnabled) {
        const icon = this.iconSupplier();
        if (icon != null && icon.width) {
          const xDraw = x + Math.trunc(width / 2) - Math.trunc(icon.width / 2);
          graphics.drawImage(icon, xDraw, y + 4);
        }
      }
      if (config.enableCounter()) {
        graphics.setFont(FontManager.getRunescapeSmallFont());
        const counterText = String(this.currentValue);
        const widthOfCounter = graphics.getFontMetrics().stringWidth(counterText);
        const centerText = Math.trunc(width / 2) - Math.trunc(widthOfCounter / 2);
        const yOffset = skillIconEnabled ? SKILL_ICON_HEIGHT : COUNTER_ICON_HEIGHT;
        const textComponent = new TextComponent();
        textComponent.setText(counterText);
        textComponent.setPosition(new Point(x + centerText, y + yOffset));
        textComponent.render(graphics);
      }
    }
    renderRestore(graphics, x, y, width, height) {
      const heal = this.healSupplier();
      if (heal <= 0) return;
      const filledCurrentHeight = BarRenderer.getBarHeight(this.maxValue, this.currentValue, height);
      const filledHealHeight = BarRenderer.getBarHeight(this.maxValue, heal, height);
      let fillY; let fillHeight;
      graphics.setColor(this.healColorSupplier());
      if (filledHealHeight + filledCurrentHeight > height) {
        graphics.setColor(OVERHEAL_COLOR);
        fillY = y + BORDER_SIZE;
        fillHeight = height - filledCurrentHeight - BORDER_SIZE;
      } else {
        fillY = y + BORDER_SIZE + height - (filledCurrentHeight + filledHealHeight);
        fillHeight = filledHealHeight;
      }
      graphics.fillRect(x + BORDER_SIZE, fillY, width - BORDER_SIZE * 2, fillHeight);
    }
    static getBarHeight(base, current, size) {
      const ratio = current / base;
      if (ratio >= 1) return size;
      return Math.round(ratio * size);
    }
  }

  const PRAYER_COLOR = new Color(50, 200, 200, 175);
  const ACTIVE_PRAYER_COLOR = new Color(57, 255, 186, 225);
  const HEALTH_COLOR = new Color(225, 35, 0, 125);
  const POISONED_COLOR = new Color(0, 145, 0, 150);
  const HEAL_COLOR = new Color(255, 112, 6, 150);
  const PRAYER_HEAL_COLOR = new Color(57, 255, 186, 75);
  const ENERGY_HEAL_COLOR = new Color(199, 118, 0, 218);
  const SPECIAL_ATTACK_COLOR = new Color(3, 153, 0, 195);
  const ENERGY_COLOR = new Color(199, 174, 0, 220);
  const HEIGHT = 252;
  const MAX_SPECIAL_ATTACK_VALUE = 100;
  const MAX_RUN_ENERGY_VALUE = 100;
  // Viewport FIXED / FIXED_BANK: offsets left (20, -4), right (0, -4)
  const OFFSET_LEFT = new Point(20, -4); const OFFSET_RIGHT = new Point(0, -4);

  class StatusBarsOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_WIDGETS);
      this.barRenderers = new Map();
      this.initRenderers();
    }
    initRenderers() {
      const icon = (k) => rl.spriteManager.getAsset(`orbicon/${k}.png`);
      this.barRenderers.set('HITPOINTS', new BarRenderer(
        () => client.getRealSkillLevel(Skill.HITPOINTS),
        () => client.getBoostedSkillLevel(Skill.HITPOINTS),
        () => this.getRestoreValue(Skill.HITPOINTS.getName()),
        () => (client.getVarpValue(POISON) > 0 ? POISONED_COLOR : HEALTH_COLOR),
        () => HEAL_COLOR,
        () => { const p = client.getVarpValue(POISON); return p > 0 && p < 50 ? icon('poison_heart') : icon('hitpoints'); }));
      this.barRenderers.set('PRAYER', new BarRenderer(
        () => client.getRealSkillLevel(Skill.PRAYER),
        () => client.getBoostedSkillLevel(Skill.PRAYER),
        () => this.getRestoreValue(Skill.PRAYER.getName()),
        () => (Prayer.values().some((p) => client.isPrayerActive(p)) ? ACTIVE_PRAYER_COLOR : PRAYER_COLOR),
        () => PRAYER_HEAL_COLOR,
        () => rl.SkillIconManager.getSkillImage(Skill.PRAYER, true)));
      this.barRenderers.set('RUN_ENERGY', new BarRenderer(
        () => MAX_RUN_ENERGY_VALUE,
        () => Math.trunc(client.getEnergy() / 100),
        () => this.getRestoreValue('Run Energy'),
        () => ENERGY_COLOR,
        () => ENERGY_HEAL_COLOR,
        () => icon('run')));
      this.barRenderers.set('SPECIAL_ATTACK', new BarRenderer(
        () => MAX_SPECIAL_ATTACK_VALUE,
        () => Math.trunc(client.getVarpValue(SA_ENERGY) / 10),
        () => 0,
        () => SPECIAL_ATTACK_COLOR,
        () => null,
        () => icon('special')));
    }
    /** the open sidebar interface's rectangle (OSRS: Toplevel.SIDE_PANELS / Bankside.ITEMS) */
    static sidePanel() {
      const t = ll.api && ll.api.subRects ? ll.api.subRects() : [];
      for (let i = 0; i + 5 < t.length; i += 6) if (t[i + 2] >= 500 && t[i + 4] >= 150) return { x: t[i + 2], y: t[i + 3], w: t[i + 4], h: t[i + 5] };
      return null;
    }
    render(g) {
      if (!this.plugin.isBarsDisplayed()) return null;
      const w = StatusBarsOverlay.sidePanel();
      if (w == null) return null;
      const config = this.plugin.config;
      const width = DEFAULT_WIDTH; const height = HEIGHT;
      const offsetLeftBarX = w.x - OFFSET_LEFT.getX(); const offsetLeftBarY = w.y - OFFSET_LEFT.getY();
      const offsetRightBarX = w.x - OFFSET_RIGHT.getX() + w.w; const offsetRightBarY = w.y - OFFSET_RIGHT.getY();
      const left = this.barRenderers.get(config.leftBarMode());
      const right = this.barRenderers.get(config.rightBarMode());
      if (left != null) left.renderBar(config, g, offsetLeftBarX, offsetLeftBarY, width, height);
      if (right != null) right.renderBar(config, g, offsetRightBarX, offsetRightBarY, width, height);
      return null;
    }
    getRestoreValue(skill) {
      const svc = rl.itemStatChangesService;
      if (!svc) return 0;
      const menu = client.getMenuEntries();
      if (menu.length === 0) return 0;
      const entry = menu[menu.length - 1];
      const widget = entry.getWidget ? entry.getWidget() : null;
      let restoreValue = 0;
      if (widget != null && (widget.getId() >>> 16) === 149) { // Inventory.ITEMS (2007: 149)
        const change = svc.getItemStatChanges(entry.getItemId());
        if (change != null) {
          for (const c of change.calculate(client).getStatChanges()) {
            const value = c.getTheoretical();
            if (value !== 0 && c.getStat().getName() === skill) restoreValue = value;
          }
        }
      }
      return restoreValue;
    }
  }

  class StatusBarsPlugin {
    constructor() { this.configGroup = GROUP; this.barsDisplayed = false; this.lastCombatActionTickCount = 0; }
    isBarsDisplayed() { return this.barsDisplayed; }
    startUp() {
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.overlay = new StatusBarsOverlay(this);
      this.checkStatusBars();
      rl.overlayManager.add(this.overlay);
    }
    shutDown() { rl.overlayManager.remove(this.overlay); this.barsDisplayed = false; }
    onGameTick() { this.checkStatusBars(); }
    onConfigChanged(event) { if (event.getGroup() === GROUP && event.getKey() === 'hideAfterCombatDelay') this.checkStatusBars(); }
    checkStatusBars() {
      const localPlayer = client.getLocalPlayer();
      if (localPlayer == null) return;
      const interacting = localPlayer.getInteracting();
      if (this.config.hideAfterCombatDelay() === 0) {
        this.barsDisplayed = true;
      } else if ((interacting instanceof NPC && interacting.getComposition().getActions().includes('Attack'))
        || (interacting instanceof Player && !!(ll.api && ll.api.ifOpen && ll.api.ifOpen(381)))) {
        this.lastCombatActionTickCount = client.getTickCount();
        this.barsDisplayed = true;
      } else if (client.getTickCount() - this.lastCombatActionTickCount >= this.config.hideAfterCombatDelay()) {
        this.barsDisplayed = false;
      }
    }
  }

  const plugin = new StatusBarsPlugin();
  ll.__statusbars = { plugin, BarRenderer };
  rl.registerPlugin(GROUP, plugin);
})();
