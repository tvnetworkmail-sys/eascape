// RuneLite's Prayer plugin, cloned from net.runelite.client.plugins.prayer (BSD 2-Clause, Copyright (c) 2017,
// Adam <Adam@sigterm.info> and RuneLite contributors): PrayerPlugin, PrayerConfig, PrayerType, PrayerCounter,
// PrayerFlickLocation, PrayerFlickOverlay, PrayerDoseOverlay, PrayerBarOverlay, PrayerRestoreType.
// 2007: the prayer orb is our Status Orbs' (rl.statusOrbs, the orb's rectangle as OSRS's PRAYERBUTTON widget); the
// prayers are the 2007 varps (rl.Prayer); the prayer bonus is the server's (ItemManager.getItemStats, itemstats.js).
// Era-trim: PrayerType stops at Mystic Might plus Retribution / Redemption / Smite (Chivalry and Piety came with King's
// Ransom in 2008); no Sanfew serum or Nightmare Zone wrench; no PrayerReorder (the 2007 prayer tab is if1, no drag);
// "Show time left" changes the tooltip only, as the orb's text is drawn by Status Orbs (our own plugin); no HD bar
// (2007 has no sprite overrides).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Skill, Color, Overlay, OverlayPosition, OverlayLayer, BasicStroke, InfoBox, Tooltip, ColorUtil, InventoryID } = rl;
  const GROUP = 'prayer';
  const GAME_TICK_LENGTH = 600;

  // SpriteID.Prayeron (the same group ids in the 2007 cache)
  const PRAYERON = { THICK_SKIN: 115, BURST_OF_STRENGTH: 116, CLARITY_OF_THOUGHT: 117, ROCK_SKIN: 118, SUPERHUMAN_STRENGTH: 119, IMPROVED_REFLEXES: 120, RAPID_RESTORE: 121, RAPID_HEAL: 122, PROTECT_ITEM: 123, STEEL_SKIN: 124, ULTIMATE_STRENGTH: 125, INCREDIBLE_REFLEXES: 126, PROTECT_FROM_MAGIC: 127, PROTECT_FROM_MISSILES: 128, PROTECT_FROM_MELEE: 129, REDEMPTION: 130, RETRIBUTION: 131, SMITE: 132, SHARP_EYE: 133, MYSTIC_WILL: 134, HAWK_EYE: 502, MYSTIC_LORE: 503, EAGLE_EYE: 504, MYSTIC_MIGHT: 505 };

  class PrayerType {
    constructor(name, key, description, overhead, drainEffect) { Object.assign(this, { name, key, prayer: rl.Prayer[key], description, spriteID: PRAYERON[key], overhead, drainEffect }); }
    getName() { return this.name; } getPrayer() { return this.prayer; } getDescription() { return this.description; }
    getSpriteID() { return this.spriteID; } isOverhead() { return this.overhead; } getDrainEffect() { return this.drainEffect; }
    ordinal() { return PrayerType.values().indexOf(this); }
    isEnabled() { return true; }
    isActive(c) { return c.isPrayerActive(this.prayer) && this.isEnabled(c); }
  }
  const TYPES = [
    ['Thick Skin', 'THICK_SKIN', '+5% Defence', false, 1],
    ['Burst of Strength', 'BURST_OF_STRENGTH', '+5% Strength', false, 1],
    ['Clarity of Thought', 'CLARITY_OF_THOUGHT', '+5% Attack', false, 1],
    ['Sharp Eye', 'SHARP_EYE', '+5% Ranged', false, 1],
    ['Mystic Will', 'MYSTIC_WILL', '+5% Magical attack and defence', false, 1],
    ['Rock Skin', 'ROCK_SKIN', '+10% Defence', false, 6],
    ['Superhuman Strength', 'SUPERHUMAN_STRENGTH', '+10% Strength', false, 6],
    ['Improved Reflexes', 'IMPROVED_REFLEXES', '+10% Attack', false, 6],
    ['Rapid Restore', 'RAPID_RESTORE', '2 x Restore rate for all skills except Hitpoints and Prayer', false, 1],
    ['Rapid Heal', 'RAPID_HEAL', '2 x Restore rate for Hitpoints', false, 2],
    ['Protect Item', 'PROTECT_ITEM', 'Player keeps 1 extra item when they die', false, 2],
    ['Hawk Eye', 'HAWK_EYE', '+10% Ranged', false, 6],
    ['Mystic Lore', 'MYSTIC_LORE', '+10% Magical attack and defence', false, 6],
    ['Steel Skin', 'STEEL_SKIN', '+15% Defence', false, 12],
    ['Ultimate Strength', 'ULTIMATE_STRENGTH', '+15% Strength', false, 12],
    ['Incredible reflexes', 'INCREDIBLE_REFLEXES', '+15% Attack', false, 12],
    ['protect from magic', 'PROTECT_FROM_MAGIC', 'Protects against magic attacks', true, 12],
    ['Protect from missiles', 'PROTECT_FROM_MISSILES', 'Protects against ranged attacks', true, 12],
    ['Protect from melee', 'PROTECT_FROM_MELEE', 'Protects against melee attacks', true, 12],
    ['Eagle Eye', 'EAGLE_EYE', '+15% Ranged', false, 12],
    ['Mystic Might', 'MYSTIC_MIGHT', '+15% Magical attack and defence', false, 12],
    ['Retribution', 'RETRIBUTION', "Deals damage up to 25% of your Prayer level to nearby targets upon the user's death", true, 3],
    ['Redemption', 'REDEMPTION', 'Heals the player if they fall below 10% health', true, 6],
    ['Smite', 'SMITE', 'Removes 1 Prayer point from an enemy for every 4 damage inflicted on the enemy', true, 18],
  ].map((a) => new PrayerType(...a));
  PrayerType.values = () => TYPES;
  for (const t of TYPES) PrayerType[t.key] = t;

  // PrayerRestoreType (2007 item ids)
  const PrayerRestoreType = { RESTOREPOT: 'RESTOREPOT', PRAYERPOT: 'PRAYERPOT', SANFEWPOT: 'SANFEWPOT', HOLYWRENCH: 'HOLYWRENCH' };
  const RESTORE_ITEMS = {
    RESTOREPOT: [3024, 3026, 3028, 3030], // _4DOSE2RESTORE .. _1DOSE2RESTORE
    PRAYERPOT: [2434, 139, 141, 143], // _4DOSEPRAYERRESTORE .. _1DOSEPRAYERRESTORE
    SANFEWPOT: [],
    HOLYWRENCH: [8233, 8234, 6714], // SKILLCAPE_PRAYER, SKILLCAPE_PRAYER_TRIMMED, DEAL_WRENCH_BLESSED
  };
  const prayerRestores = new Map();
  for (const [type, items] of Object.entries(RESTORE_ITEMS)) for (const id of items) prayerRestores.set(id, type);
  PrayerRestoreType.getType = (itemId) => prayerRestores.get(itemId) || null;

  const PrayerFlickLocation = { NONE: 'NONE', PRAYER_ORB: 'PRAYER_ORB', PRAYER_BAR: 'PRAYER_BAR', BOTH: 'BOTH' };

  class PrayerCounter extends InfoBox {
    constructor(plugin, prayerType) { super(null, plugin); this.prayerType = prayerType; }
    getPrayerType() { return this.prayerType; }
    getText() { return null; }
    getTextColor() { return null; }
    getTooltip() { return this.prayerType.getDescription(); }
  }

  /** the prayer orb's "widget" (InterfaceID.Orbs.PRAYERBUTTON): our Status Orbs' prayer orb */
  const prayerOrbBounds = () => (rl.statusOrbs.shown('prayer') ? rl.statusOrbs.bounds('prayer') : null);
  // (bounds.x + 24, bounds.y - 1, height: the inside of OSRS's orb; ours is a circle of radius r at the right)
  const orbInner = (bounds) => { const c = rl.statusOrbs.circle('prayer'); return { x: c.x - c.r, y: c.y - c.r, size: c.r * 2 }; };

  class PrayerFlickOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_WIDGETS);
    }
    render(graphics) {
      const config = this.plugin.config;
      if ((!this.plugin.isPrayersActive() && !config.prayerFlickAlwaysOn())
        || config.prayerFlickLocation() === PrayerFlickLocation.NONE
        || config.prayerFlickLocation() === PrayerFlickLocation.PRAYER_BAR) return null;
      const bounds = prayerOrbBounds();
      if (bounds == null || bounds.getX() <= 0) return null;
      const inner = orbInner(bounds);
      const orbInnerHeight = inner.size;
      const orbInnerWidth = orbInnerHeight;
      const orbInnerX = inner.x;
      const orbInnerY = inner.y;
      const t = this.plugin.getTickProgress();
      const xOffset = Math.trunc(-Math.cos(t) * orbInnerWidth / 2) + Math.trunc(orbInnerWidth / 2);
      const indicatorHeight = Math.trunc(Math.sin(t) * orbInnerHeight);
      const yOffset = Math.trunc(orbInnerHeight / 2) - Math.trunc(indicatorHeight / 2);
      graphics.setColor(config.prayerFlickColor());
      graphics.fillRect(orbInnerX + xOffset, orbInnerY + yOffset, 1, indicatorHeight);
      return null;
    }
  }

  const PULSE_TIME = 2 * GAME_TICK_LENGTH;
  const DARKEN_FACTOR = 0.36078;
  class PrayerDoseOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.startOfLastTick = Date.now();
      this.trackTick = true;
      this.restoreAmount = 0;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_WIDGETS);
    }
    setRestoreAmount(n) { this.restoreAmount = n; }
    onTick() {
      if (this.trackTick) { this.startOfLastTick = Date.now(); this.trackTick = false; } else this.trackTick = true;
    }
    render(graphics) {
      const config = this.plugin.config;
      const bounds = prayerOrbBounds();
      if (bounds == null || bounds.getX() <= 0) return null;
      const mousePosition = client.getMouseCanvasPosition();
      // (the orb's canvas takes the mouse: statusOrbs.hovered)
      if (config.showPrayerStatistics() && ((mousePosition && bounds.contains(mousePosition.getX(), mousePosition.getY())) || rl.statusOrbs.hovered('prayer'))) {
        let sb = '';
        if (config.replaceOrbText()) sb += `Prayer points remaining: ${client.getBoostedSkillLevel(Skill.PRAYER)}`;
        else sb += `Time Remaining: ${this.plugin.getEstimatedTimeRemaining(false)}`;
        sb += `</br>Prayer Bonus: ${this.plugin.getPrayerBonus()}`;
        rl.tooltipManager.add(new Tooltip(sb));
      }
      if (!config.showPrayerDoseIndicator() || this.restoreAmount === 0) return null;
      const currentPrayer = client.getBoostedSkillLevel(Skill.PRAYER);
      const maxPrayer = client.getRealSkillLevel(Skill.PRAYER);
      const prayerPointsMissing = maxPrayer - currentPrayer;
      if (prayerPointsMissing <= 0 || prayerPointsMissing < this.restoreAmount) return null;
      const inner = orbInner(bounds);
      const timeSinceLastTick = Date.now() - this.startOfLastTick;
      const tickProgress = Math.min(timeSinceLastTick / PULSE_TIME, 1);
      const t = tickProgress * Math.PI;
      const startColor = config.prayerDoseOrbStartColor();
      graphics.setColor(ColorUtil.colorLerp(startColor, PrayerDoseOverlay.endColor(startColor), Math.sin(t)));
      graphics.setStroke(new BasicStroke(2));
      graphics.drawOval(inner.x, inner.y, inner.size, inner.size);
      return null;
    }
    static endColor(start) {
      return new Color(Math.max(Math.trunc(start.getRed() * DARKEN_FACTOR), 0), Math.max(Math.trunc(start.getGreen() * DARKEN_FACTOR), 0),
        Math.max(Math.trunc(start.getBlue() * DARKEN_FACTOR), 0), start.getAlpha());
    }
  }

  const BAR_FILL_COLOR = new Color(0, 149, 151);
  const BAR_BG_COLOR = Color.BLACK;
  const PRAYER_BAR_SIZE = { width: 30, height: 5 };
  class PrayerBarOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.showingPrayerBar = false;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setPriority(rl.OverlayPriority.HIGH);
      this.setLayer(OverlayLayer.ABOVE_SCENE);
    }
    render(graphics) {
      const config = this.plugin.config;
      if (!this.showingPrayerBar || !config.showPrayerBar()) return null;
      const local = client.getLocalPlayer();
      if (local == null) return null;
      const coord = local.getLocalLocation();
      const actorHeight = local.getLogicalHeight() + 10;
      const canvasPoint = rl.Perspective.localToCanvas(client, coord, client.getPlane(), actorHeight);
      if (canvasPoint == null) return null;
      const ratio = client.getBoostedSkillLevel(Skill.PRAYER) / client.getRealSkillLevel(Skill.PRAYER);
      // (no HD bar: 2007 has no sprite overrides)
      const barX = canvasPoint.getX() - 15;
      const barY = canvasPoint.getY();
      const barWidth = PRAYER_BAR_SIZE.width;
      const barHeight = PRAYER_BAR_SIZE.height;
      const progressFill = Math.ceil(Math.min(barWidth * ratio, barWidth));
      graphics.setColor(BAR_BG_COLOR);
      graphics.fillRect(barX, barY, barWidth, barHeight);
      graphics.setColor(BAR_FILL_COLOR);
      graphics.fillRect(barX, barY, progressFill, barHeight);
      if ((this.plugin.isPrayersActive() || config.prayerFlickAlwaysOn())
        && (config.prayerFlickLocation() === PrayerFlickLocation.PRAYER_BAR || config.prayerFlickLocation() === PrayerFlickLocation.BOTH)) {
        const t = this.plugin.getTickProgress();
        const xOffset = Math.trunc(-Math.cos(t) * barWidth / 2) + barWidth / 2;
        graphics.setColor(config.prayerFlickColor());
        graphics.fillRect(barX + xOffset, barY, 1, barHeight);
      }
      return null;
    }
    onTick() {
      const config = this.plugin.config;
      const localPlayer = client.getLocalPlayer();
      this.showingPrayerBar = true;
      if (localPlayer == null) { this.showingPrayerBar = false; return; }
      if (config.hideIfNotPraying() && !this.plugin.isPrayersActive()) { this.showingPrayerBar = false; return; }
      if (config.hideIfOutOfCombat() && localPlayer.getHealthScale() === -1) this.showingPrayerBar = false;
    }
  }

  class PrayerPlugin {
    constructor() { this.configGroup = GROUP; this.prayerCounter = new Array(TYPES.length).fill(null); this.startOfLastTick = Date.now(); this.prayersActive = false; this.prayerBonus = 0; }
    isPrayersActive() { return this.prayersActive; }
    getPrayerBonus() { return this.prayerBonus; }
    setPrayerBonus(n) { this.prayerBonus = n; }
    startUp() {
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.flickOverlay = new PrayerFlickOverlay(this);
      this.doseOverlay = new PrayerDoseOverlay(this);
      this.barOverlay = new PrayerBarOverlay(this);
      rl.overlayManager.add(this.flickOverlay);
      rl.overlayManager.add(this.doseOverlay);
      rl.overlayManager.add(this.barOverlay);
      // (the item containers as they are now: RuneLite gets ItemContainerChanged at log in)
      const worn = client.getItemContainer(InventoryID.WORN);
      if (worn) this.prayerBonus = this.totalPrayerBonus(worn.getItems());
      const inv = client.getItemContainer(InventoryID.INV);
      if (inv) this.updatePotionBonus(inv, worn);
    }
    shutDown() {
      rl.overlayManager.remove(this.flickOverlay);
      rl.overlayManager.remove(this.doseOverlay);
      rl.overlayManager.remove(this.barOverlay);
      this.removeIndicators();
    }
    onConfigChanged(event) {
      if (event.getGroup() === GROUP) {
        if (!this.config.prayerIndicator()) this.removeIndicators();
        else if (!this.config.prayerIndicatorOverheads()) this.removeOverheadsIndicators();
      }
    }
    onItemContainerChanged(event) {
      const id = event.getContainerId();
      if (id === InventoryID.INV) this.updatePotionBonus(event.getItemContainer(), client.getItemContainer(InventoryID.WORN));
      else if (id === InventoryID.WORN) this.prayerBonus = this.totalPrayerBonus(event.getItemContainer().getItems());
    }
    onGameTick() {
      const config = this.config;
      this.prayersActive = this.isAnyPrayerActive();
      if (config.prayerFlickLocation() !== PrayerFlickLocation.NONE) this.startOfLastTick = Date.now();
      if (config.showPrayerDoseIndicator()) this.doseOverlay.onTick();
      if (config.showPrayerBar()) this.barOverlay.onTick();
      // (replaceOrbText: the orb text is Status Orbs', see the header)
      if (!config.prayerIndicator()) return;
      for (const prayerType of TYPES) {
        const ord = prayerType.ordinal();
        if (prayerType.isActive(client)) {
          if (prayerType.isOverhead() && !config.prayerIndicatorOverheads()) continue;
          if (this.prayerCounter[ord] == null) {
            const counter = this.prayerCounter[ord] = new PrayerCounter(this, prayerType);
            // (getSpriteAsync: the 2007 sprite may still be downloading, so the image is read when drawn)
            Object.defineProperty(counter, 'image', { get() { return this._img || (this._img = rl.spriteManager.getSprite(prayerType.getSpriteID()) || null); }, set(v) { this._img = v; } });
            rl.infoBoxManager.addInfoBox(counter);
          }
        } else if (this.prayerCounter[ord] != null) {
          rl.infoBoxManager.removeInfoBox(this.prayerCounter[ord]);
          this.prayerCounter[ord] = null;
        }
      }
    }
    totalPrayerBonus(items) {
      let total = 0;
      for (const item of items) {
        if (!item || item.getId() < 0) continue;
        const is = rl.itemManager.getItemStats(item.getId());
        if (is != null && is.getEquipment() != null) total += is.getEquipment().getPrayer();
      }
      return total;
    }
    updatePotionBonus(inventory, equip) {
      let hasPrayerPotion = false; let hasSuperRestore = false; let hasSanfew = false; let hasWrench = false;
      for (const item of inventory.getItems()) {
        if (!item) continue;
        switch (PrayerRestoreType.getType(item.getId())) {
          case 'PRAYERPOT': hasPrayerPotion = true; break;
          case 'RESTOREPOT': hasSuperRestore = true; break;
          case 'SANFEWPOT': hasSanfew = true; break;
          case 'HOLYWRENCH': hasWrench = true; break;
          default: break;
        }
      }
      if (!hasWrench && equip != null) {
        for (const item of equip.getItems()) {
          if (item && PrayerRestoreType.getType(item.getId()) === 'HOLYWRENCH') { hasWrench = true; break; }
        }
      }
      const prayerLevel = client.getRealSkillLevel(Skill.PRAYER);
      let restored = 0;
      if (hasSanfew) restored = Math.max(restored, 4 + Math.floor(prayerLevel * (hasWrench ? 0.32 : 0.30)));
      if (hasSuperRestore) restored = Math.max(restored, 8 + Math.floor(prayerLevel * (hasWrench ? 0.27 : 0.25)));
      if (hasPrayerPotion) restored = Math.max(restored, 7 + Math.floor(prayerLevel * (hasWrench ? 0.27 : 0.25)));
      this.doseOverlay.setRestoreAmount(restored);
    }
    getTickProgress() {
      const timeSinceLastTick = Date.now() - this.startOfLastTick;
      const tickProgress = (timeSinceLastTick % GAME_TICK_LENGTH) / GAME_TICK_LENGTH;
      return tickProgress * Math.PI;
    }
    isAnyPrayerActive() {
      for (const pray of rl.Prayer.values()) if (client.isPrayerActive(pray)) return true;
      return false;
    }
    removeIndicators() { rl.infoBoxManager.removeIf((e) => e instanceof PrayerCounter); this.prayerCounter.fill(null); }
    removeOverheadsIndicators() {
      rl.infoBoxManager.removeIf((e) => e instanceof PrayerCounter && e.getPrayerType().isOverhead());
      TYPES.forEach((t, i) => { if (t.isOverhead()) this.prayerCounter[i] = null; });
    }
    static getDrainEffect(c) {
      let drainEffect = 0;
      for (const prayerType of TYPES) if (prayerType.isActive(c)) drainEffect += prayerType.getDrainEffect();
      return drainEffect;
    }
    getEstimatedTimeRemaining(formatForOrb) {
      const drainEffect = PrayerPlugin.getDrainEffect(client);
      if (drainEffect === 0) return 'N/A';
      const drainResistance = 2 * this.prayerBonus + 60;
      const secondsPerPoint = 0.6 * (drainResistance / drainEffect);
      const currentPrayer = client.getBoostedSkillLevel(Skill.PRAYER);
      const secondsLeft = Math.trunc(currentPrayer * secondsPerPoint) % 86400; // LocalTime.ofSecondOfDay
      const h = Math.floor(secondsLeft / 3600); const m = Math.floor((secondsLeft % 3600) / 60); const s = secondsLeft % 60;
      const p2 = (n) => String(n).padStart(2, '0');
      if (formatForOrb && (h > 0 || m > 9)) return `${Math.floor(secondsLeft / 60)}m`;
      if (h > 0) return `${h}:${p2(m)}:${p2(s)}`;
      return `${m}:${p2(s)}`;
    }
  }

  const plugin = new PrayerPlugin();
  ll.__prayer = { plugin, PrayerType, PrayerRestoreType, PrayerCounter };
  rl.registerPlugin('prayer', plugin);
})();
