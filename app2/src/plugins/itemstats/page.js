// RuneLite's Item Stats plugin, cloned from net.runelite.client.plugins.itemstats (BSD 2-Clause, Copyright (c) 2016-2018,
// Adam <Adam@sigterm.info>, (c) 2017 Seth, (c) 2018 Abex and RuneLite contributors): ItemStatPlugin, ItemStatOverlay,
// ItemStatChanges / ItemStatChangesService(Impl), Effect, SingleEffect, Combo, StatsChanges, StatChange, RangeStatChange,
// Positivity, StatBoost, SimpleStatBoost, BoostedStatBoost, CappedStatBoost, RangeStatBoost, Food, FoodBase, Builders,
// DeltaPercentage, stats/*, potions/{MixedPotion, PrayerPotion, SaradominBrew, SuperRestore, PotionDuration},
// special/{CastleWarsBandage, CaveNightshade, DwarvenRockCake, NettleTeaRunEnergy, SpicyStew}.
// The ItemStatChanges table is changes.js (app/tools/runelite/itemstatchanges.py: init() with the items in the 2007
// cache); the effect classes only later items used (Ambrosia, Anglerfish, AncientBrew, StaminaPotion, the moths ...) aren't
// ported. Equipment bonuses: rl.itemManager.getItemStats (our server's obj params, runelite/itemstats.js); only
// equipable items have stats there, so the weight row shows for those only.
// Era-trim (22 Sep 2007): no GE item information (createItemInformation / resetGEInventory: the Grand Exchange is from
// Nov 2007), no Leagues combat masteries or sunlight cuffs in StatBoost, no Sailing stat, no ring of the gods / max cape
// in PrayerPotion's holy wrench check, PotionDuration only for the 2007 potions (no anti-venom, extended / super antifire).
// The service (rl.itemStatChangesService) is bound when this page loads, as RuneLite's public module, so Status Bars'
// heal previews work with the plugin off too.
// 2007 interfaces: worn items 387 (an inv component: its slot's item, where OSRS's WORNITEMS slot has the item as child 1),
// inventory 149:0, bank 12 / bank side 15 (Show stats in bank); no equipment-stats side (85) in this client.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Color, Overlay, Skill, InventoryID, ColorUtil, QuantityFormatter, Tooltip } = rl;
  const GROUP = 'itemstat';

  // ---- stats
  class Stat {
    constructor(name) { this.name = name; }
    getName() { return this.name; }
  }
  class SkillStat extends Stat {
    constructor(skill) { super(skill.getName()); this.skill = skill; }
    getValue(c) { return c.getBoostedSkillLevel(this.skill); }
    getMaximum(c) { return c.getRealSkillLevel(this.skill); }
  }
  class EnergyStat extends Stat {
    constructor() { super('Run Energy'); }
    getValue(c) { return Math.trunc(c.getEnergy() / 100); }
    getMaximum() { return 100; }
  }
  const Stats = {};
  for (const n of ['ATTACK', 'DEFENCE', 'STRENGTH', 'HITPOINTS', 'RANGED', 'PRAYER', 'MAGIC', 'COOKING', 'WOODCUTTING', 'FLETCHING',
    'FISHING', 'FIREMAKING', 'CRAFTING', 'SMITHING', 'MINING', 'HERBLORE', 'AGILITY', 'THIEVING', 'SLAYER', 'FARMING', 'RUNECRAFT',
    'HUNTER', 'CONSTRUCTION']) Stats[n] = new SkillStat(Skill[n]);
  Stats.RUN_ENERGY = new EnergyStat();
  const { ATTACK, DEFENCE, STRENGTH, HITPOINTS, RANGED, PRAYER, MAGIC, RUN_ENERGY } = Stats;

  // ---- Positivity
  const Positivity = { WORSE: 0, NO_CHANGE: 1, BETTER_CAPPED: 2, BETTER_SOMECAPPED: 3, BETTER_UNCAPPED: 4 };
  const POSITIVITY_VALUES = ['WORSE', 'NO_CHANGE', 'BETTER_CAPPED', 'BETTER_SOMECAPPED', 'BETTER_UNCAPPED'];
  Positivity.values = () => POSITIVITY_VALUES.map((n) => Positivity[n]);
  Positivity.getColor = (config, positivity) => {
    switch (positivity) {
      case Positivity.BETTER_UNCAPPED: return config.colorBetterUncapped();
      case Positivity.BETTER_SOMECAPPED: return config.colorBetterSomeCapped();
      case Positivity.BETTER_CAPPED: return config.colorBetterCapped();
      case Positivity.NO_CHANGE: return config.colorNoChange();
      case Positivity.WORSE: return config.colorWorse();
      default: return Color.WHITE;
    }
  };
  const maxPositivity = (changes) => changes.reduce((m, c) => Math.max(m, c.getPositivity()), 0);

  // ---- StatChange / RangeStatChange / StatsChanges
  const formatBoost = (boost) => (boost >= 0 ? '+' : '') + boost;
  class StatChange {
    constructor() { this.stat = null; this.relative = 0; this.theoretical = 0; this.absolute = 0; this.positivity = Positivity.NO_CHANGE; }
    getStat() { return this.stat; } setStat(s) { this.stat = s; }
    getRelative() { return this.relative; } setRelative(v) { this.relative = v; }
    getTheoretical() { return this.theoretical; } setTheoretical(v) { this.theoretical = v; }
    getAbsolute() { return this.absolute; } setAbsolute(v) { this.absolute = v; }
    getPositivity() { return this.positivity; } setPositivity(p) { this.positivity = p; }
    getFormattedRelative() { return formatBoost(this.relative); }
    getFormattedTheoretical() { return formatBoost(this.theoretical); }
  }
  class RangeStatChange extends StatChange {
    constructor() { super(); this.minRelative = 0; this.minTheoretical = 0; this.minAbsolute = 0; }
    getMinRelative() { return this.minRelative; } setMinRelative(v) { this.minRelative = v; }
    getMinTheoretical() { return this.minTheoretical; } setMinTheoretical(v) { this.minTheoretical = v; }
    getMinAbsolute() { return this.minAbsolute; } setMinAbsolute(v) { this.minAbsolute = v; }
    getFormattedRelative() { return RangeStatChange.concat(this.minRelative, this.getRelative()); }
    getFormattedTheoretical() { return RangeStatChange.concat(this.minTheoretical, this.getTheoretical()); }
    static concat(changeA, changeB) {
      if (changeA === changeB) return formatBoost(changeA);
      else if (changeA * -1 === changeB) return '±' + Math.abs(changeA);
      let sb = formatBoost(changeA) + '~';
      if ((changeA < 0 && changeB < 0) || (changeA >= 0 && changeB >= 0)) sb += Math.abs(changeB);
      else sb += formatBoost(changeB);
      return sb;
    }
  }
  class StatsChanges {
    constructor(len) { this.statChanges = new Array(len).fill(null); this.positivity = Positivity.NO_CHANGE; }
    getStatChanges() { return this.statChanges; } setStatChanges(s) { this.statChanges = s; }
    getPositivity() { return this.positivity; } setPositivity(p) { this.positivity = p; }
  }

  // ---- effects
  class SingleEffect {
    calculate(c) {
      const out = new StatsChanges(1);
      const statChanges = out.getStatChanges();
      statChanges[0] = this.effect(c);
      out.setPositivity(statChanges[0].getPositivity());
      return out;
    }
  }
  class StatBoost extends SingleEffect {
    constructor(stat, boost) { super(); this.stat = stat; this.boost = boost; }
    getStat() { return this.stat; } setStat(s) { this.stat = s; }
    isBoost() { return this.boost; }
    effect(c) {
      const stat = this.stat;
      const value = stat.getValue(c);
      let max = stat.getMaximum(c);
      let hitCap = false;
      const calcedDelta = this.heals(c);
      // (no Leagues combat masteries or sunlight cuffs in 2007)
      if (this.boost && calcedDelta > 0) max += calcedDelta;
      if (value > max) max = value;
      let newValue = value + calcedDelta;
      if (newValue > max) { newValue = max; hitCap = true; }
      if (newValue < 0) newValue = 0;
      const delta = newValue - value;
      const out = new StatChange();
      out.setStat(stat);
      if (delta > 0) out.setPositivity(hitCap ? Positivity.BETTER_CAPPED : Positivity.BETTER_UNCAPPED);
      else if (delta === 0) out.setPositivity(Positivity.NO_CHANGE);
      else out.setPositivity(Positivity.WORSE);
      out.setAbsolute(newValue);
      out.setRelative(delta);
      out.setTheoretical(calcedDelta);
      return out;
    }
  }
  const delta = (p) => (typeof p === 'function' ? { calculateDelta: p } : p);
  class SimpleStatBoost extends StatBoost {
    constructor(stat, boost, deltaCalculator) { super(stat, boost); this.deltaCalculator = delta(deltaCalculator); }
    heals(c) { return this.deltaCalculator.calculateDelta(this.getStat().getMaximum(c)); }
  }
  class BoostedStatBoost extends StatBoost {
    constructor(stat, boost, deltaCalculator) { super(stat, boost); this.deltaCalculator = delta(deltaCalculator); }
    heals(c) { return this.deltaCalculator.calculateDelta(this.getStat().getValue(c)); }
  }
  class CappedStatBoost extends StatBoost {
    constructor(stat, deltaCalculator, capCalculator) { super(stat, true); this.deltaCalculator = delta(deltaCalculator); this.capCalculator = delta(capCalculator); }
    heals(c) {
      const max = this.getStat().getMaximum(c);
      const current = Math.min(this.getStat().getValue(c), max);
      const d = this.deltaCalculator.calculateDelta(max);
      const cap = this.capCalculator.calculateDelta(max);
      if (d + current <= max + cap) return d;
      return max + cap - current;
    }
  }
  class RangeStatBoost extends SingleEffect {
    constructor(a, b) { super(); this.a = a; this.b = b; }
    effect(c) {
      const changeA = this.a.effect(c);
      const changeB = this.b.effect(c);
      const r = new RangeStatChange();
      r.setMinAbsolute(Math.min(changeA.getAbsolute(), changeB.getAbsolute()));
      r.setAbsolute(Math.max(changeA.getAbsolute(), changeB.getAbsolute()));
      r.setMinRelative(Math.min(changeA.getRelative(), changeB.getRelative()));
      r.setRelative(Math.max(changeA.getRelative(), changeB.getRelative()));
      r.setMinTheoretical(Math.min(changeA.getTheoretical(), changeB.getTheoretical()));
      r.setTheoretical(Math.max(changeA.getTheoretical(), changeB.getTheoretical()));
      r.setStat(changeA.getStat());
      const avg = Math.trunc((changeA.getPositivity() + changeB.getPositivity()) / 2);
      r.setPositivity(Positivity.values()[avg]);
      return r;
    }
  }
  class Combo {
    constructor(calcs) { this.calcs = calcs; }
    calculate(c) {
      const out = new StatsChanges(this.calcs.length);
      const statChanges = out.getStatChanges();
      let positivity = Positivity.NO_CHANGE;
      for (let i = 0; i < this.calcs.length; i++) {
        statChanges[i] = this.calcs[i].effect(c);
        if (positivity < statChanges[i].getPositivity()) positivity = statChanges[i].getPositivity();
      }
      out.setPositivity(positivity);
      return out;
    }
  }
  class FoodBase extends StatBoost { constructor() { super(HITPOINTS, false); } }
  class Food extends FoodBase {
    constructor(p) { super(); this.p = delta(p); }
    heals(c) { return this.p.calculateDelta(this.getStat().getMaximum(c)); }
  }
  class DeltaPercentage {
    constructor(perc, d) { this.perc = perc; this.delta = d; }
    calculateDelta(max) { return (Math.trunc(max * this.perc) * (this.delta >= 0 ? 1 : -1)) + this.delta; }
  }
  // Builders
  const food = (p) => new Food(typeof p === 'number' ? () => p : p);
  const combo = (...effect) => new Combo(effect);
  const boost = (stat, p) => new SimpleStatBoost(stat, true, typeof p === 'number' ? () => p : p);
  const heal = (stat, p) => new SimpleStatBoost(stat, false, typeof p === 'number' ? () => p : p);
  const dec = (stat, b) => heal(stat, -b);
  const perc = (p, d) => new DeltaPercentage(p, d);
  const range = (a, b) => new RangeStatBoost(a, b);

  // ---- potions / special
  // ItemID / EquipmentInventorySlot
  const DEAL_WRENCH_BLESSED = 6714;
  const SKILLCAPE_PRAYER = 9759;
  const CAPE_SLOT = 1; const GLOVES_SLOT = 9;
  class PrayerPotion extends StatBoost {
    constructor(d, p = 0.25) { super(PRAYER, false); this.delta = d; this.perc = p; }
    heals(c) {
      const variations = (id) => (rl.ItemVariationMapping ? rl.ItemVariationMapping.getVariations(id) : [id]);
      let hasHolyWrench = false;
      const equipContainer = client.getItemContainer(InventoryID.WORN);
      if (equipContainer != null) {
        const cape = equipContainer.getItem(CAPE_SLOT);
        // (no ring of the gods (i) or max cape in 2007)
        if (cape != null) hasHolyWrench = variations(SKILLCAPE_PRAYER).includes(cape.getId());
      }
      if (!hasHolyWrench) {
        const invContainer = client.getItemContainer(InventoryID.INV);
        if (invContainer != null) {
          for (const itemStack of invContainer.getItems()) {
            const item = itemStack.getId();
            hasHolyWrench = item === DEAL_WRENCH_BLESSED;
            hasHolyWrench = hasHolyWrench || variations(SKILLCAPE_PRAYER).includes(item);
            if (hasHolyWrench) break;
          }
        }
      }
      const percent = hasHolyWrench ? this.perc + 0.02 : this.perc;
      const max = this.getStat().getMaximum(c);
      return (Math.trunc(max * percent) * (this.delta >= 0 ? 1 : -1)) + this.delta;
    }
  }
  class MixedPotion {
    constructor(h, potion) { this.heal = h; this.potion = potion; }
    calculate(c) {
      const changes = new StatsChanges(0);
      const mixedPotionHpBoost = food(this.heal).effect(c);
      const potionChanges = this.potion.calculate(c);
      const mixedPotionHitpointsHealing = mixedPotionHpBoost.getRelative();
      if (potionChanges.getStatChanges().some((s) => s.getStat() === HITPOINTS)) {
        changes.setStatChanges(potionChanges.getStatChanges().map((change) => {
          // Only adjust the hitpoints change when it heals less than the mix's own heal
          if (change.getStat() !== HITPOINTS || mixedPotionHitpointsHealing === 0 || change.getTheoretical() >= 0) return change;
          // Mix potions heal and then apply the potion's own (negative) effect
          const max = HITPOINTS.getMaximum(c);
          const absolute = change.getAbsolute();
          const relative = change.getRelative();
          if (absolute + mixedPotionHitpointsHealing > max) change.setPositivity(Positivity.BETTER_CAPPED);
          else if (relative + mixedPotionHitpointsHealing > 0) change.setPositivity(Positivity.BETTER_UNCAPPED);
          else if (relative + mixedPotionHitpointsHealing === 0) change.setPositivity(Positivity.NO_CHANGE);
          else change.setPositivity(Positivity.WORSE);
          change.setAbsolute(Math.min(max, absolute + mixedPotionHitpointsHealing));
          change.setRelative(change.getRelative() + mixedPotionHitpointsHealing);
          change.setTheoretical(change.getTheoretical() + mixedPotionHitpointsHealing);
          return change;
        }));
      } else {
        changes.setStatChanges([mixedPotionHpBoost, ...potionChanges.getStatChanges()]);
      }
      changes.setPositivity(maxPositivity(changes.getStatChanges()));
      return changes;
    }
  }
  class SaradominBrew {
    constructor(percH, percD, percSD, deltaB, deltaR) { Object.assign(this, { percH, percD, percSD, deltaB, deltaR }); }
    calculate(c) {
      const changes = new StatsChanges(0);
      const hitpoints = new SimpleStatBoost(HITPOINTS, true, perc(this.percH, this.deltaB));
      const defence = new SimpleStatBoost(DEFENCE, true, perc(this.percD, this.deltaB));
      const calc = new BoostedStatBoost(null, false, perc(this.percSD, -this.deltaR));
      changes.setStatChanges([hitpoints.effect(c), defence.effect(c),
        ...[ATTACK, STRENGTH, RANGED, MAGIC].filter((stat) => stat.getValue(c) > 1).map((stat) => { calc.setStat(stat); return calc.effect(c); })]);
      changes.setPositivity(maxPositivity(changes.getStatChanges()));
      return changes;
    }
  }
  const SUPER_RESTORE_STATS = ['ATTACK', 'DEFENCE', 'STRENGTH', 'RANGED', 'MAGIC', 'COOKING', 'WOODCUTTING', 'FLETCHING', 'FISHING',
    'FIREMAKING', 'CRAFTING', 'SMITHING', 'MINING', 'HERBLORE', 'AGILITY', 'THIEVING', 'SLAYER', 'FARMING', 'RUNECRAFT', 'HUNTER', 'CONSTRUCTION'];
  class SuperRestore {
    constructor(percR, d) { this.percR = percR; this.delta = d; }
    calculate(c) {
      const changes = new StatsChanges(0);
      const calc = new SimpleStatBoost(null, false, perc(this.percR, this.delta));
      const prayer = new PrayerPotion(this.delta, this.percR);
      changes.setStatChanges([prayer.effect(c),
        ...SUPER_RESTORE_STATS.map((n) => Stats[n]).filter((stat) => stat.getValue(c) < stat.getMaximum(c)).map((stat) => { calc.setStat(stat); return calc.effect(c); })]);
      changes.setPositivity(maxPositivity(changes.getStatChanges()));
      return changes;
    }
  }
  const CASTLEWARS_BRACELETS = [11079, 11081, 11083]; // JEWL_CASTLEWARS_BRACELET(3/2/1)
  class CastleWarsBandage {
    calculate(c) {
      const equipmentContainer = client.getItemContainer(InventoryID.WORN);
      const percH = this.hasBracelet(equipmentContainer) ? 0.15 : 0.10;
      const hitPoints = heal(HITPOINTS, perc(percH, 0)).effect(c);
      const runEnergy = heal(RUN_ENERGY, 30).effect(c);
      const changes = new StatsChanges(2);
      changes.setStatChanges([hitPoints, runEnergy]);
      changes.setPositivity(maxPositivity(changes.getStatChanges()));
      return changes;
    }
    hasBracelet(equipmentContainer) {
      if (equipmentContainer == null) return false;
      const gloves = equipmentContainer.getItem(GLOVES_SLOT);
      if (gloves != null) return CASTLEWARS_BRACELETS.includes(gloves.getId());
      return false;
    }
  }
  class CaveNightshade extends StatBoost {
    constructor() { super(HITPOINTS, false); }
    heals(c) {
      const currentHP = this.getStat().getValue(c);
      if (currentHP < 20) return -Math.trunc(currentHP / 2);
      return -15;
    }
  }
  class DwarvenRockCake {
    calculate(c) {
      const current = c.getBoostedSkillLevel(Skill.HITPOINTS);
      const eat = current <= 1 ? 0 : -1;
      const guzzle = current <= 1 ? 0 : -1 * (Math.trunc(current / 10) + 1);
      const changes = new StatsChanges(2);
      changes.setStatChanges([heal(HITPOINTS, eat).effect(c), heal(HITPOINTS, guzzle).effect(c)]);
      return changes;
    }
  }
  class NettleTeaRunEnergy extends StatBoost {
    constructor() { super(RUN_ENERGY, false); }
    heals(c) { return c.getBoostedSkillLevel(Skill.HITPOINTS) < c.getRealSkillLevel(Skill.HITPOINTS) ? 5 : 0; }
  }
  // VarbitID.HUNDRED_DAVE_RED / YELLOW / ORANGE / BROWN (Recipe for Disaster's spice doses; 0 until the server sends them)
  const HUNDRED_DAVE = { RED: 1879, YELLOW: 1880, BROWN: 1881, ORANGE: 1882 };
  class SpicyStew {
    calculate(c) {
      const redBoost = SpicyStew.spiceBoostOf(c.getVarbitValue(HUNDRED_DAVE.RED));
      const yellowBoost = SpicyStew.spiceBoostOf(c.getVarbitValue(HUNDRED_DAVE.YELLOW));
      const orangeBoost = SpicyStew.spiceBoostOf(c.getVarbitValue(HUNDRED_DAVE.ORANGE));
      const brownBoost = SpicyStew.spiceBoostOf(c.getVarbitValue(HUNDRED_DAVE.BROWN));
      const changes = [];
      const add = (b, names) => { if (b > 0) for (const n of names) changes.push(SpicyStew.statChangeOf(Stats[n], b, c)); };
      add(redBoost, ['ATTACK', 'STRENGTH', 'DEFENCE', 'RANGED', 'MAGIC']);
      add(yellowBoost, ['PRAYER', 'AGILITY', 'THIEVING', 'SLAYER', 'HUNTER']); // (no Sailing)
      add(orangeBoost, ['SMITHING', 'COOKING', 'CRAFTING', 'FIREMAKING', 'FLETCHING', 'RUNECRAFT', 'CONSTRUCTION']);
      add(brownBoost, ['MINING', 'HERBLORE', 'FISHING', 'WOODCUTTING', 'FARMING']);
      const changesReturn = new StatsChanges(4);
      changesReturn.setStatChanges(changes);
      return changesReturn;
    }
    static spiceBoostOf(spiceDoses) { return Math.max(0, (spiceDoses * 2) - 1); }
    static statChangeOf(stat, spiceBoost, c) {
      const currentValue = stat.getValue(c);
      const currentBase = stat.getMaximum(c);
      const currentBoost = currentValue - currentBase; // Can be negative
      const spiceBoostCapped = (currentBoost <= 0) ? spiceBoost : Math.max(0, spiceBoost - currentBoost);
      const change = new RangeStatChange();
      change.setStat(stat);
      change.setMinRelative(-spiceBoost);
      change.setRelative(spiceBoostCapped);
      change.setMinTheoretical(-spiceBoost);
      change.setTheoretical(spiceBoost);
      change.setMinAbsolute(Math.max(-spiceBoost, -currentValue));
      change.setAbsolute(stat.getValue(c) + spiceBoostCapped);
      let positivity;
      if (spiceBoostCapped === 0) positivity = Positivity.NO_CHANGE;
      else if (spiceBoost > spiceBoostCapped) positivity = Positivity.BETTER_CAPPED;
      else positivity = Positivity.BETTER_UNCAPPED;
      change.setPositivity(positivity);
      return change;
    }
  }

  // PotionDuration (the 2007 potions)
  const PotionDuration = new Map();
  for (const [secs, ids] of [
    [90, [2446, 175, 177, 179]], // ANTIPOISON
    [360, [2448, 181, 183, 185]], // SUPERANTIPOISON
    [540, [5943, 5945, 5947, 5949]], // ANTIDOTE_P
    [720, [5952, 5954, 5956, 5958]], // ANTIDOTE_PP
    [360, [2452, 2454, 2456, 2458]], // ANTIFIRE
    [90, [11435, 11433]], // ANTIPOISON_MIX
    [360, [11475, 11473]], // ANTIPOISON_SUPERMIX
    [540, [11503, 11501]], // ANTIDOTE_PLUS_MIX
  ]) {
    const p = { getDurationRanges: () => [{ getPotionName: () => '', getLowestDuration: () => secs * 1000, getHighestDuration: () => secs * 1000 }] };
    for (const id of ids) PotionDuration.set(id, p);
  }
  const formatMss = (ms) => { const s = Math.trunc(ms / 1000); return Math.trunc(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  // ---- ItemStatChanges
  const ATTACK_POT = boost(ATTACK, perc(0.10, 3));
  const STRENGTH_POT = boost(STRENGTH, perc(0.10, 3));
  const DEFENCE_POT = boost(DEFENCE, perc(0.10, 3));
  const SUPER_ATTACK_POT = boost(ATTACK, perc(0.15, 5));
  const SUPER_STRENGTH_POT = boost(STRENGTH, perc(0.15, 5));
  const SUPER_DEFENCE_POT = boost(DEFENCE, perc(0.15, 5));
  const effects = new Map();
  if (ll.itemStatChangesInit) {
    ll.itemStatChangesInit({
      food, combo, boost, heal, dec, perc, range, Stats, ATTACK_POT, STRENGTH_POT, DEFENCE_POT, SUPER_ATTACK_POT, SUPER_STRENGTH_POT, SUPER_DEFENCE_POT,
      SimpleStatBoost, BoostedStatBoost, CappedStatBoost, MixedPotion, PrayerPotion, SaradominBrew, SuperRestore, CastleWarsBandage, CaveNightshade,
      DwarvenRockCake, NettleTeaRunEnergy, SpicyStew,
    }, (effect, ...items) => { for (const item of items) effects.set(item, effect); });
  }
  const ItemStatChanges = { get: (id) => effects.get(id) || null };
  // ItemStatChangesService(Impl)
  rl.itemStatChangesService = { getItemStatChanges: (id) => ItemStatChanges.get(id) };

  // ---- ItemStatOverlay
  const EQ_KEYS = ['astab', 'aslash', 'acrush', 'amagic', 'arange', 'dstab', 'dslash', 'dcrush', 'dmagic', 'drange', 'str', 'rstr', 'mdmg', 'prayer', 'aspeed'];
  const cap = (k) => k[0].toUpperCase() + k.slice(1);
  /** ItemEquipmentStats.builder(): a plain stats object with RuneLite's getters */
  const equipmentStats = (o) => {
    const e = { slot: o.slot | 0, twoHanded: !!o.twoHanded };
    for (const k of EQ_KEYS) e[k] = o[k] || 0;
    e.getSlot = () => e.slot; e.isTwoHanded = () => e.twoHanded;
    for (const k of EQ_KEYS) e['get' + cap(k)] = () => e[k];
    return e;
  };
  const itemStats = (equipable, weight, equipment) => ({ isEquipable: () => equipable, getWeight: () => weight, getEquipment: () => equipment });
  const UNARMED = itemStats(true, 0, equipmentStats({ aspeed: 4 }));
  // EquipmentInventorySlot
  const WEAPON_SLOT = 3; const SHIELD_SLOT = 5;
  // InterfaceID (2007)
  const WORNITEMS = 387; const INVENTORY_ITEMS = 149 << 16; const BANKMAIN = 12; const BANKSIDE = 15;
  const MENU_TARGET = new Color(255, 144, 64); // JagexColors.MENU_TARGET

  class ItemStatOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
    }
    render() {
      const config = this.plugin.config;
      if (client.isMenuOpen() || (!config.relative() && !config.absolute() && !config.theoretical())) return null;
      const menu = client.getMenuEntries();
      const menuSize = menu.length;
      if (menuSize <= 0) return null;
      const entry = menu[menuSize - 1];
      const widget = entry.getWidget();
      if (widget == null) return null;
      const group = widget.getId() >>> 16;
      let itemId = -1;
      if (group === WORNITEMS
        || widget.getId() === INVENTORY_ITEMS
        || (group === BANKMAIN && config.showStatsInBank())
        || (group === BANKSIDE && config.showStatsInBank())) {
        itemId = widget.getItemId();
      }
      if (itemId === -1) return null;
      if (config.consumableStats()) {
        const change = ItemStatChanges.get(itemId);
        if (change != null) {
          let b = '';
          const statsChanges = change.calculate(client);
          for (const c of statsChanges.getStatChanges()) b += this.buildStatChangeString(c);
          if (b !== '') rl.tooltipManager.add(new Tooltip(b));
        }
        const p = PotionDuration.get(itemId);
        if (p != null) {
          const durationRanges = p.getDurationRanges();
          let sb = '';
          if (durationRanges.length === 1) {
            sb += 'Duration: ' + formatMss(durationRanges[0].getLowestDuration());
          } else {
            for (const durationRange of durationRanges) {
              if (sb.length > 0) sb += '</br>';
              sb += durationRange.getPotionName() + ': ' + formatMss(durationRange.getLowestDuration());
              if (durationRange.getLowestDuration() !== durationRange.getHighestDuration()) sb += '~' + formatMss(durationRange.getHighestDuration());
            }
          }
          rl.tooltipManager.add(new Tooltip(sb));
        }
      }
      if (config.equipmentStats()) {
        const stats = rl.itemManager.getItemStats(itemId);
        if (stats != null) {
          const tooltip = this.buildStatBonusString(stats);
          if (tooltip !== '') rl.tooltipManager.add(new Tooltip(tooltip));
        }
      }
      return null;
    }
    getChangeString(value, inverse, showPercent) {
      const config = this.plugin.config;
      const plus = Positivity.getColor(config, Positivity.BETTER_UNCAPPED);
      const minus = Positivity.getColor(config, Positivity.WORSE);
      if (value === 0) return '';
      const color = inverse ? (value > 0 ? minus : plus) : (value > 0 ? plus : minus);
      const prefix = value > 0 ? '+' : '';
      const suffix = showPercent ? '%' : '';
      return ColorUtil.wrapWithColorTag(prefix + QuantityFormatter.formatNumber(value) + suffix, color);
    }
    buildStatRow(label, value, diffValue, inverse, showPercent, showBase = true) {
      let b = '';
      if (value !== 0 || diffValue !== 0) {
        const changeStr = this.getChangeString(diffValue, inverse, showPercent);
        if (this.plugin.config.alwaysShowBaseStats() && showBase) {
          b += label + ': ' + QuantityFormatter.formatNumber(value) + (changeStr !== '' ? ' (' + changeStr + ') ' : '') + '</br>';
        } else if (changeStr !== '') {
          b += label + ': ' + changeStr + '</br>';
        }
      }
      return b;
    }
    getItemStatsFromContainer(container, slotID) {
      const item = container.getItem(slotID);
      return item != null && item.getId() !== -1 ? rl.itemManager.getItemStats(item.getId()) : null;
    }
    buildStatBonusString(s) {
      const config = this.plugin.config;
      let other = null;
      let offHand = null;
      const currentEquipment = s.getEquipment();
      const c = client.getItemContainer(InventoryID.WORN);
      if (s.isEquipable() && currentEquipment != null && c != null) {
        const slot = currentEquipment.getSlot();
        other = this.getItemStatsFromContainer(c, slot);
        if (other == null && slot === SHIELD_SLOT) {
          other = this.getItemStatsFromContainer(c, WEAPON_SLOT);
          if (other != null) {
            const otherEquip = other.getEquipment();
            if (otherEquip != null) other = otherEquip.isTwoHanded() ? ItemStatOverlay.subtract(other, UNARMED) : null;
          }
        }
        if (slot === WEAPON_SLOT) {
          if (other == null) other = UNARMED;
          if (currentEquipment.isTwoHanded()) offHand = this.getItemStatsFromContainer(c, SHIELD_SLOT);
        }
      }
      const subtracted = ItemStatOverlay.subtract(ItemStatOverlay.subtract(s, other), offHand);
      const e = subtracted.getEquipment();
      let b = '';
      if (config.showWeight()) {
        const sw = config.alwaysShowBaseStats() ? subtracted.getWeight() : s.getWeight();
        b += this.buildStatRow('Weight', s.getWeight(), sw, true, false, s.isEquipable());
      }
      if (subtracted.isEquipable() && e != null) {
        b += this.buildStatRow('Prayer', currentEquipment.getPrayer(), e.getPrayer(), false, false);
        b += this.buildStatRow('Speed', currentEquipment.getAspeed(), e.getAspeed(), true, false);
        b += this.buildStatRow('Melee Str', currentEquipment.getStr(), e.getStr(), false, false);
        b += this.buildStatRow('Range Str', currentEquipment.getRstr(), e.getRstr(), false, false);
        b += this.buildStatRow('Magic Dmg', currentEquipment.getMdmg(), e.getMdmg(), false, true);
        let abb = '';
        abb += this.buildStatRow('Stab', currentEquipment.getAstab(), e.getAstab(), false, false);
        abb += this.buildStatRow('Slash', currentEquipment.getAslash(), e.getAslash(), false, false);
        abb += this.buildStatRow('Crush', currentEquipment.getAcrush(), e.getAcrush(), false, false);
        abb += this.buildStatRow('Magic', currentEquipment.getAmagic(), e.getAmagic(), false, false);
        abb += this.buildStatRow('Range', currentEquipment.getArange(), e.getArange(), false, false);
        if (abb.length > 0) b += ColorUtil.wrapWithColorTag('Attack Bonus</br>', MENU_TARGET) + abb;
        let dbb = '';
        dbb += this.buildStatRow('Stab', currentEquipment.getDstab(), e.getDstab(), false, false);
        dbb += this.buildStatRow('Slash', currentEquipment.getDslash(), e.getDslash(), false, false);
        dbb += this.buildStatRow('Crush', currentEquipment.getDcrush(), e.getDcrush(), false, false);
        dbb += this.buildStatRow('Magic', currentEquipment.getDmagic(), e.getDmagic(), false, false);
        dbb += this.buildStatRow('Range', currentEquipment.getDrange(), e.getDrange(), false, false);
        if (dbb.length > 0) b += ColorUtil.wrapWithColorTag('Defence Bonus</br>', MENU_TARGET) + dbb;
      }
      return b;
    }
    static subtract(one, two) {
      if (two == null) return one;
      const newWeight = one.getWeight() - two.getWeight();
      let newEquipment;
      if (two.getEquipment() != null) {
        const equipment = one.getEquipment() != null ? one.getEquipment() : equipmentStats({});
        const t = two.getEquipment();
        const o = { slot: equipment.getSlot() };
        for (const k of EQ_KEYS) o[k] = equipment['get' + cap(k)]() - t['get' + cap(k)]();
        newEquipment = equipmentStats(o);
      } else {
        newEquipment = one.getEquipment();
      }
      return itemStats(one.isEquipable(), newWeight, newEquipment);
    }
    buildStatChangeString(c) {
      const config = this.plugin.config;
      let b = ColorUtil.colorTag(Positivity.getColor(config, c.getPositivity()));
      if (config.relative()) b += c.getFormattedRelative();
      if (config.theoretical()) {
        if (config.relative()) b += '/';
        b += c.getFormattedTheoretical();
      }
      if (config.absolute() && (config.relative() || config.theoretical())) b += ' (';
      if (config.absolute()) b += c.getAbsolute();
      if (config.absolute() && (config.relative() || config.theoretical())) b += ')';
      b += ' ' + c.getStat().getName() + '</br>';
      return b;
    }
  }

  class ItemStatPlugin {
    constructor() { this.configGroup = GROUP; }
    startUp() {
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.overlay = new ItemStatOverlay(this);
      rl.overlayManager.add(this.overlay);
    }
    shutDown() {
      rl.overlayManager.remove(this.overlay);
      // (no GE inventory to reset in 2007)
    }
  }

  const plugin = new ItemStatPlugin();
  ll.__itemstats = { plugin, ItemStatChanges, ItemStatOverlay, Stats, Positivity, UNARMED };
  rl.registerPlugin('itemstats', plugin);
})();
