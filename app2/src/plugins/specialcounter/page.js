// RuneLite's Special Attack Counter plugin, cloned from net.runelite.client.plugins.specialcounter (BSD 2-Clause,
// Copyright (c) 2018, Raqes <j.raqes@gmail.com> and RuneLite contributors): SpecialCounterPlugin, SpecialCounter,
// SpecialWeapon, PercentageInfobox, PlayerInfoDrop, PlayerInfoDropOverlay, SpecialCounterConfig.
// Era-trim: the 2007 special weapons only, with the 2007 cache's item ids: Bandos godsword (10502; God Wars, June 2007),
// Bone dagger (8468-8474), Dorgeshuun crossbow (8476), Seercull (6724). Dragon warhammer, Arclight, Darklight's
// Weaken, Elder maul, Bulwark, Accursed sceptre, Tonalztics, Emberlight, Eye of Ayak are later; the Barrelchest anchor
// isn't in our cache. No defence drain weapons remain, so the defence drain infobox can never show (its option hidden,
// the code kept). No party (RuneLite's party service), no ToB / Sotetseg, Duke or later ignored NPCs. 2007 hitsplats
// carry no owner, so a hitsplat on the spec target on the hit tick counts (OSRS: isMine). NPCs are snapshots here, so the
// target is matched by its index. Special energy is varp 300 (SA_ENERGY); the miss splat is the 2007 hitmarks sprite 298.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Skill, Color, GameState, Counter, InfoBox, Overlay, OverlayPosition, OverlayPriority, Point, FontManager, ColorUtil, NPC } = rl;
  const GROUP = 'specialcounter';
  const SA_ENERGY = 300;
  const WEAPON_SLOT = 3;
  const HITMARKS = 298;

  const weapon = (name, itemID, damage, clientCycleHitDelay, threshold, extra) => Object.assign({
    name, itemID, damage, clientCycleHitDelay, threshold,
    getName() { return this.name; }, getItemID() { return this.itemID; }, isDamage() { return this.damage; },
    getThreshold() { return this.threshold; },
    getHitDelay(distance) { return Math.trunc(this.clientCycleHitDelay(distance) / 30) + 1; },
    computeDrainPercent() { return 0; },
    computeHit(hit) { return hit; },
  }, extra || {});
  const SpecialWeapon = {
    BANDOS_GODSWORD: weapon('Bandos Godsword', [10502], true, () => 0, (c) => c.bandosGodswordThreshold()),
    BONE_DAGGER: weapon('Bone Dagger', [8468, 8470, 8472, 8474], true, () => 0, () => 0),
    DORGESHUUN_CROSSBOW: weapon('Dorgeshuun Crossbow', [8476], true, (distance) => 60 + distance * 3, () => 0),
    SEERCULL: weapon('Seercull', [6724], true, (d) => 46 + d * 5, () => 0),
  };
  const WEAPONS = Object.keys(SpecialWeapon);
  WEAPONS.forEach((k, i) => { SpecialWeapon[k].ordinal = () => i; SpecialWeapon[k].toString = () => k; });
  SpecialWeapon.values = () => WEAPONS.map((k) => SpecialWeapon[k]);

  class SpecialCounter extends Counter {
    constructor(image, plugin, config, hitValue, w) { super(image, plugin, hitValue); this.weapon = w; this.config = config; this.partySpecs = new Map(); }
    getPartySpecs() { return this.partySpecs; }
    addHits(hit) { this.setCount(this.getCount() + hit); }
    getTooltip() {
      const hitValue = this.getCount();
      if (!this.partySpecs.size) return this.buildTooltip(hitValue);
      let sb = this.buildTooltip(hitValue);
      for (const [k, v] of this.partySpecs) sb += `</br>${k == null ? 'You' : k}: ${this.buildTooltip(v)}`;
      return sb;
    }
    buildTooltip(hitValue) {
      if (!this.weapon.isDamage()) return `${this.weapon.getName()} special has hit ${hitValue} ${hitValue === 1 ? 'time' : 'times'}.`;
      return `${this.weapon.getName()} special has hit ${hitValue} total.`;
    }
    getTextColor() {
      const threshold = this.weapon.getThreshold()(this.config);
      if (threshold > 0) return this.getCount() >= threshold ? Color.GREEN : Color.RED;
      return super.getTextColor();
    }
  }

  class PercentageInfobox extends InfoBox {
    constructor(image, plugin) { super(image, plugin); this.percent = 1; }
    mul(p) { this.percent *= p; }
    getTooltip() { return `Opponent defence has been reduced by ${this.getText()}.`; }
    getTextColor() { return Color.WHITE; }
    getText() { return `${Math.trunc((1 - this.percent) * 100)}%`; }
  }

  // ImageUtil.resizeImage(img, 24, 24)
  const resize = (img, w, h) => {
    if (!img || typeof document === 'undefined') return img;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext && c.getContext('2d');
    if (!x || !x.drawImage) return img;
    try { x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, w, h); } catch { return img; }
    return c;
  };

  class PlayerInfoDropOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setPriority(OverlayPriority.MED);
    }
    render(graphics) {
      const infoDrops = this.plugin.getPlayerInfoDrops();
      if (!infoDrops.length) return null;
      const cycle = client.getGameCycle();
      for (let i = 0; i < infoDrops.length; i++) {
        const infoDrop = infoDrops[i];
        if (cycle < infoDrop.startCycle) continue;
        if (cycle > infoDrop.endCycle) { infoDrops.splice(i--, 1); continue; }
        if (!this.plugin.config.specDrops()) continue;
        const me = client.getLocalPlayer();
        const player = me && infoDrop.playerIdx === -1 ? me : null; // (no party: only your own drops)
        if (player == null) continue;
        const elapsed = cycle - infoDrop.startCycle;
        const percent = Math.trunc((elapsed * 100) / (infoDrop.endCycle - infoDrop.startCycle));
        const currentHeight = Math.trunc((infoDrop.endHeightOffset * percent) / 100);
        const text = infoDrop.text;
        graphics.setFont(infoDrop.font);
        const playerLocation = player.getCanvasTextLocation(graphics, text, player.getLogicalHeight() + infoDrop.startHeightOffset + currentHeight);
        if (playerLocation == null) continue;
        const fontMetrics = graphics.getFontMetrics();
        const alpha = 255 - Math.trunc((255 * percent) / 100);
        const sprite = infoDrop.image;
        const sw = sprite ? sprite.width : 24; const sh = sprite ? sprite.height : 24;
        const textHeight = fontMetrics.getHeight() - fontMetrics.getMaxDescent();
        const textWidth = fontMetrics.stringWidth(text);
        const textMargin = Math.trunc(sw / 2);
        const imageLocation = new Point(playerLocation.getX() - textMargin - 1, playerLocation.getY() - Math.trunc(textHeight / 2) - Math.trunc(sh / 2));
        const textLocation = new Point(playerLocation.getX() + textMargin, playerLocation.getY());
        const ctx = graphics.ctx;
        const a0 = ctx ? ctx.globalAlpha : 1;
        if (ctx) ctx.globalAlpha = alpha / 255; // ImageUtil.alphaOffset(sprite, alpha - 255)
        const bg = infoDrop.textBackground;
        if (bg != null && bg.width) {
          let x = textLocation.getX(); let y = textLocation.getY();
          y -= Math.trunc(textHeight / 2); y -= Math.trunc(bg.height / 2);
          x += Math.trunc((textWidth + 1) / 2); x -= Math.trunc(bg.width / 2);
          graphics.drawImage(bg, x, y);
        }
        if (sprite) graphics.drawImage(sprite, imageLocation.getX(), imageLocation.getY());
        if (ctx) ctx.globalAlpha = a0;
        PlayerInfoDropOverlay.drawText(graphics, textLocation, text, infoDrop.color, alpha);
      }
      return null;
    }
    static drawText(g, point, text, color, colorAlpha) {
      g.setColor(ColorUtil.colorWithAlpha(Color.BLACK, colorAlpha));
      g.drawString(text, point.getX() + 1, point.getY() + 1);
      g.setColor(ColorUtil.colorWithAlpha(color, colorAlpha));
      g.drawString(text, point.getX(), point.getY());
    }
  }

  class SpecialCounterPlugin {
    constructor() {
      this.configGroup = GROUP;
      this.currentWorld = -1; this.specialPercentage = -1; this.lastHitPointsExperience = -1; this.lastHpChangeCycle = 0;
      this.specialWeapon = null; this.hitsplatTick = 0; this.hitsplats = []; this.lastSpecTarget = null; this.lastSpecHpChange = false;
      this.interactedNpcIndexes = new Set(); this.specialCounter = new Array(WEAPONS.length).fill(null); this.percentageInfobox = null;
      this.playerInfoDrops = [];
    }
    getPlayerInfoDrops() { return this.playerInfoDrops; }
    startUp() {
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.playerInfoDropOverlay = new PlayerInfoDropOverlay(this);
      rl.overlayManager.add(this.playerInfoDropOverlay);
      this.currentWorld = -1; this.specialPercentage = -1; this.lastHitPointsExperience = -1;
      this.interactedNpcIndexes.clear();
    }
    shutDown() {
      this.specialWeapon = null; this.lastSpecTarget = null; this.hitsplats = [];
      this.removeCounters();
      rl.overlayManager.remove(this.playerInfoDropOverlay);
    }
    onStatChanged(event) {
      if (event.getSkill() === Skill.HITPOINTS) {
        if (event.getXp() > this.lastHitPointsExperience) this.lastHpChangeCycle = client.getGameCycle();
        this.lastHitPointsExperience = event.getXp();
      }
    }
    onGameTick() {
      if (this.specialWeapon == null || this.lastSpecTarget == null) return;
      const tickCount = client.getTickCount();
      if (this.hitsplatTick === tickCount) {
        if (!this.hitsplats.length) return;
        const delayedHit = this.specialWeapon.getHitDelay(1) > 1;
        const hitsplat = this.hitsplats[delayedHit ? 0 : this.hitsplats.length - 1];
        this.specialAttackHit(this.specialWeapon, hitsplat.getAmount(), this.lastSpecTarget);
        this.specialWeapon = null; this.hitsplats = []; this.lastSpecTarget = null;
      } else if (tickCount > this.hitsplatTick) {
        this.specialWeapon = null; this.hitsplats = []; this.lastSpecTarget = null;
      }
    }
    onGameStateChanged(event) {
      if (event.getGameState() === GameState.LOGGED_IN) {
        if (this.currentWorld === -1) this.currentWorld = client.getWorld();
        else if (this.currentWorld !== client.getWorld()) { this.currentWorld = client.getWorld(); this.removeCounters(); }
      }
    }
    onVarbitChanged(event) {
      if (event.getVarpId() !== SA_ENERGY || event.getVarbitId() !== -1) return;
      const specialPercentage = event.getValue();
      if (this.specialPercentage === -1 || specialPercentage >= this.specialPercentage) { this.specialPercentage = specialPercentage; return; }
      this.specialPercentage = specialPercentage;
      const serverTicks = client.getTickCount();
      // (clientThread.invokeLater: the same tick's state is already in)
      this.specialWeapon = this.usedSpecialWeapon();
      if (this.specialWeapon == null) return;
      const target = client.getLocalPlayer().getInteracting();
      this.lastSpecTarget = target instanceof NPC ? target : null;
      this.lastSpecHpChange = this.lastHpChangeCycle === client.getGameCycle();
      this.hitsplatTick = serverTicks + this.getHitDelay(this.specialWeapon, target);
      if (this.lastSpecTarget != null) {
        const npcIndex = this.lastSpecTarget.getIndex();
        if (!this.interactedNpcIndexes.has(npcIndex)) {
          this.removeCounters();
          this.interactedNpcIndexes.add(npcIndex);
        }
      }
    }
    onHitsplatApplied(hitsplatApplied) {
      const target = hitsplatApplied.getActor();
      const hitsplat = hitsplatApplied.getHitsplat();
      if (!(target instanceof NPC)) return; // (2007: no hitsplat owner; never the local player)
      if (this.lastSpecTarget == null || target.getIndex() !== this.lastSpecTarget.getIndex()) return;
      if (this.hitsplatTick === client.getTickCount()) this.hitsplats.push(hitsplat);
    }
    specialAttackHit(specialWeapon, hit, target) {
      const counterHit = specialWeapon.isDamage() ? specialWeapon.computeHit(hit, target) : Math.min(hit, 1);
      const defenceDrain = specialWeapon.computeDrainPercent(hit, target);
      if (this.config.infobox()) this.updateCounter(specialWeapon, null, counterHit, defenceDrain);
      if (counterHit > 0 || defenceDrain > 0 || this.config.specDropMisses()) this.playerInfoDrops.push(this.createSpecInfoDrop(specialWeapon, counterHit, -1));
    }
    onNpcDespawned(npcDespawned) {
      const actor = npcDespawned.getNpc();
      if (this.lastSpecTarget != null && this.lastSpecTarget.getIndex() === actor.getIndex()) this.lastSpecTarget = null;
      if (actor.isDead() && this.interactedNpcIndexes.has(actor.getIndex())) this.removeCounters();
    }
    usedSpecialWeapon() {
      const equipment = client.getItemContainer(rl.InventoryID.WORN);
      if (equipment == null) return null;
      const w = equipment.getItem(WEAPON_SLOT);
      if (w == null) return null;
      return SpecialWeapon.values().find((s) => s.getItemID().includes(w.getId())) || null;
    }
    updateCounter(specialWeapon, name, hit, defenceDrain) {
      if (defenceDrain > 0 && this.config.defenceDrainInfobox()) {
        if (this.percentageInfobox == null) {
          this.percentageInfobox = new PercentageInfobox(rl.itemManager.getImage(specialWeapon.getItemID()[0]), this);
          rl.infoBoxManager.addInfoBox(this.percentageInfobox);
        }
        this.percentageInfobox.mul(defenceDrain);
      }
      if (hit === 0) return;
      let counter = this.specialCounter[specialWeapon.ordinal()];
      if (counter == null) {
        counter = new SpecialCounter(rl.itemManager.getImage(specialWeapon.getItemID()[0]), this, this.config, hit, specialWeapon);
        rl.infoBoxManager.addInfoBox(counter);
        this.specialCounter[specialWeapon.ordinal()] = counter;
      } else {
        counter.addHits(hit);
      }
      this.sendNotification(specialWeapon, counter);
    }
    sendNotification(w, counter) {
      const threshold = w.getThreshold()(this.config);
      if (threshold > 0 && counter.getCount() >= threshold && this.config.thresholdNotification()) rl.notifier.notify(`${w.getName()} special attack threshold reached!`);
    }
    removeCounters() {
      this.interactedNpcIndexes.clear();
      for (let i = 0; i < this.specialCounter.length; ++i) {
        if (this.specialCounter[i] != null) { rl.infoBoxManager.removeInfoBox(this.specialCounter[i]); this.specialCounter[i] = null; }
      }
      if (this.percentageInfobox) rl.infoBoxManager.removeInfoBox(this.percentageInfobox);
      this.percentageInfobox = null;
    }
    createSpecInfoDrop(w, hit, playerId) {
      const cycle = client.getGameCycle();
      return {
        startCycle: cycle, endCycle: cycle + 100, playerIdx: playerId, text: String(hit),
        textBackground: hit === 0 ? rl.spriteManager.getSprite(HITMARKS, 0) : null,
        color: this.config.specDropColor(), startHeightOffset: 100, endHeightOffset: 400,
        image: resize(rl.itemManager.getImage(w.getItemID()[0]), 24, 24), font: FontManager.getRunescapeBoldFont(),
      };
    }
    getHitDelay(w, target) {
      if (target == null) return 1;
      const player = client.getLocalPlayer();
      if (player == null) return 1;
      const playerWp = player.getWorldLocation();
      if (playerWp == null) return 1;
      const targetArea = target.getWorldArea ? target.getWorldArea() : null;
      if (targetArea == null) return 1;
      return w.getHitDelay(targetArea.distanceTo(playerWp));
    }
  }

  const plugin = new SpecialCounterPlugin();
  ll.__specialcounter = { plugin, SpecialWeapon };
  rl.registerPlugin(GROUP, plugin);
})();
