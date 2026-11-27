// RuneLite's Skill Calculator plugin, cloned from net.runelite.client.plugins.skillcalculator (BSD 2-Clause, Copyright (c)
// 2018, Kruithne <kruithne@gmail.com>, Psikoi <https://github.com/psikoi> and RuneLite contributors):
// SkillCalculatorPlugin, SkillCalculatorPanel, SkillCalculator, UIActionSlot, UICombinedActionSlot, UICalculatorInputArea,
// CalculatorType and the skills/ SkillAction / ItemSkillAction / NamedSkillAction / SkillBonus interfaces. The
// <Skill>Action / <Skill>Bonus enums are data.js (app/tools/runelite/skillcalc.py: trimmed to Sept 2007, Sailing
// dropped, with our server's xp where it differs). The Swing panel is ui/panels/skillcalculator.js, drawn from the state
// this publishes (rl.panels.update); its input fields, tabs, bonus checkboxes and slot clicks come back through
// onPanelAction. The search bar filters in the panel (RuneLite's onSearch only adds / removes the slot components).
// 2007: no XP drop end goals (XPDROPS_*_END varps), so a calculator always starts at the next level.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Experience, Skill } = rl;
  const DATA = ll.skillCalculatorData || [];
  const MAX_XP_MULTIPLIER = 32;
  const COMBINED_SPRITE = 582; // UICombinedActionSlot's icon

  // ---- skills/: SkillBonus, SkillAction (ItemSkillAction / NamedSkillAction), CalculatorType
  class SkillBonus {
    constructor(o) { this.n = o.n; this.bonusName = o.name; this.value = o.value; this.stack = new Set(o.stack || []); }
    name() { return this.n; }
    getName() { return this.bonusName; }
    getValue() { return this.value; }
    getCanBeStackedWith() { return this.stack; }
  }

  class SkillAction {
    constructor(o) { Object.assign(this, { n: o.n, itemId: o.id, actionName: o.name, level: o.lvl, xp: o.xp, icon: o.icon, sprite: o.sprite, mem: o.mem, ex: new Set(o.ex || []) }); }
    name() { return this.n; }
    getItemId() { return this.itemId; }
    // ItemSkillAction.getName: the item's (members) name, unless the enum overrides it; NamedSkillAction.getName
    getName(itemManager) {
      if (this.actionName) return this.actionName;
      return itemManager.getItemComposition(this.itemId).getMembersName();
    }
    getLevel() { return this.level; }
    getXp() { return this.xp; }
    // ItemSkillAction.getIcon is the item; a NamedSkillAction's icon item; MagicAction's sprite
    getIcon() { return this.itemId != null ? this.itemId : (this.icon != null ? this.icon : -1); }
    getSprite() { return this.sprite != null ? this.sprite : -1; }
    isBonusApplicable(bonus) { return !this.getExcludedSkillBonuses().has(bonus.name()); }
    // ItemSkillAction.isMembers (the item's flag) or the enum's members override; NamedSkillAction: true; MagicAction: its own
    isMembers(itemManager) {
      if (this.mem === true || (this.mem === undefined && this.itemId == null)) return true;
      if (this.mem === false) return false;
      const c = itemManager.getItemComposition(this.itemId);
      return !!(c && c.isMembers && c.isMembers());
    }
    getExcludedSkillBonuses() { return this.ex; }
  }

  const CalculatorType = DATA.map((t) => ({
    name: () => t.type,
    getSkill: () => Skill[t.skill],
    getSkillBonuses: () => (t.bonuses ? (t._b = t._b || t.bonuses.map((b) => new SkillBonus(b))) : null),
    getSkillActions: () => (t._a = t._a || t.actions.map((a) => new SkillAction(a))),
  }));

  const isMembersWorld = () => {
    const types = client.getWorldType ? client.getWorldType() : null;
    return types ? types.has('MEMBERS') : true;
  };
  // the panel's icons: the item's / sprite's image as a data url
  const spriteUrl = (id) => {
    try {
      // the 2007 client's sprite: { w, h, px } (ARGB pixels)
      const img = rl.spriteManager.getSprite(id, 0);
      if (!img || !img.w || !img.px) return null;
      const c = document.createElement('canvas');
      c.width = img.w; c.height = img.h;
      const cx = c.getContext('2d');
      const d = cx.createImageData(img.w, img.h);
      for (let i = 0; i < img.px.length; i++) {
        const p = img.px[i];
        d.data[i * 4] = (p >> 16) & 255; d.data[i * 4 + 1] = (p >> 8) & 255; d.data[i * 4 + 2] = p & 255; d.data[i * 4 + 3] = (p >>> 24) & 255;
      }
      cx.putImageData(d, 0, 0);
      return c.toDataURL('image/png');
    } catch { return null; }
  };
  const itemUrl = (id) => (ll.itemIconUrl ? ll.itemIconUrl(id, 1) : null);

  // NumberFormat.getIntegerInstance().format / String.format("%,d")
  const fmt = (n) => Math.trunc(n).toLocaleString('en-US');

  // ---- UIActionSlot
  class UIActionSlot {
    constructor(action, index) {
      this.action = action;
      this.index = index;
      this.actionName = action.getName(rl.itemManager);
      this.text = 'Unknown';
      this.isAvailable = false; this.isSelected = false; this.isOverlapping = false; this.value = 0;
      this.iconUrl = null;
    }
    getAction() { return this.action; }
    getActionName() { return this.actionName; }
    setSelected(v) { this.isSelected = v; }
    setAvailable(v) { this.isAvailable = v; }
    setOverlapping(v) { this.isOverlapping = v; }
    setText(t) { this.text = t; }
    getValue() { return this.value; }
    setValue(v) { this.value = v; }
    // updateBackground: GREEN_BORDER / ORANGE_BORDER / RED_BORDER
    border() { return this.isAvailable ? 'green' : this.isOverlapping ? 'orange' : 'red'; }
  }

  // ---- UICombinedActionSlot / UICalculatorInputArea: plain state the panel draws
  class SkillCalculator {
    constructor(plugin) {
      this.plugin = plugin;
      this.uiActionSlots = [];
      this.combinedActionSlots = [];
      this.combined = { title: 'No Action Selected', text: 'Shift-click to select multiple', icon: null };
      this.input = { currentLevel: 1, currentXP: '', targetLevel: 2, targetXP: '', neededXP: '', multiplier: 1 };
      this.bonusChecks = new Map(); // SkillBonus -> checked
      this.currentCalculator = null;
      this.currentLevel = 1;
      this.currentXP = Experience.getXpForLevel(this.currentLevel);
      this.targetLevel = this.currentLevel + 1;
      this.targetXP = Experience.getXpForLevel(this.targetLevel);
      this.xpMultiplier = 1;
      this.currentBonuses = new Set();
      this.emptyPanel = false;
      this.showBonuses = false;
    }

    openCalculator(calculatorType, forceReload) {
      // Update internal skill/XP values.
      this.currentXP = client.getSkillExperience(calculatorType.getSkill());
      this.currentLevel = Experience.getLevelForXp(this.currentXP);
      if (forceReload || this.currentCalculator !== calculatorType) {
        this.currentCalculator = calculatorType;
        this.currentBonuses.clear();
        // (2007 has no XP drop end goals: endGoal is always -1)
        const endGoal = -1;
        if (endGoal !== -1) {
          this.targetLevel = Experience.getLevelForXp(endGoal);
          this.targetXP = endGoal;
        } else {
          this.targetLevel = SkillCalculator.enforceSkillBounds(this.currentLevel + 1);
          this.targetXP = Experience.getXpForLevel(this.targetLevel);
        }
        // Clear the search bar (the panel's), the combined action slots
        this.plugin.searchReset = (this.plugin.searchReset | 0) + 1;
        this.clearCombinedSlots();
        // Add in checkboxes for available skill bonuses if we're not on a F2P world.
        this.bonusChecks.clear();
        this.showBonuses = isMembersWorld();
        if (this.showBonuses) this.renderBonusOptions();
        // Create action slots for the skill actions.
        this.renderActionSlots();
      }
      // Update the input fields.
      this.updateInputFields();
    }

    updateCombinedAction() {
      const size = this.combinedActionSlots.length;
      if (size > 1) this.combined.title = size + ' actions selected';
      else if (size === 1) this.combined.title = '1 action selected';
      else {
        this.combined.title = 'No action selected';
        this.combined.text = 'Shift-click to select multiple';
        return;
      }
      let actionCount = 0;
      let neededXP = this.targetXP - this.currentXP;
      let xp = 0;
      for (const slot of this.combinedActionSlots) xp += slot.getValue();
      if (neededXP > 0) {
        neededXP *= 10;
        actionCount = Math.trunc((neededXP - 1) / xp) + 1;
      }
      this.combined.text = SkillCalculator.formatXPActionString(xp, actionCount, 'exp - ');
    }

    clearCombinedSlots() {
      for (const slot of this.combinedActionSlots) slot.setSelected(false);
      this.combinedActionSlots = [];
    }

    renderBonusOptions() {
      const skillBonuses = this.currentCalculator.getSkillBonuses();
      if (skillBonuses == null) return;
      for (const bonus of skillBonuses) this.bonusChecks.set(bonus, false);
    }

    static generateDisplayNameForBonus(bonus) {
      return bonus.getName() + ' (' + SkillCalculator.formatBonusPercentage(bonus.getValue()) + '%)';
    }

    static formatBonusPercentage(bonus) {
      const bonusValue = Math.round(10000 * Math.fround(bonus));
      const bonusPercent = Math.fround(bonusValue / 100);
      const bonusPercentInt = Math.trunc(bonusPercent);
      return bonusPercent === bonusPercentInt ? String(bonusPercentInt) : String(Number(bonusPercent.toPrecision(7)));
    }

    adjustCheckboxes(target, selected) {
      // Check if target is stackable with any other bonuses
      for (const [bonus] of this.bonusChecks) {
        if (bonus !== target && !bonus.getCanBeStackedWith().has(target.name())) {
          this.currentBonuses.delete(bonus);
          this.bonusChecks.set(bonus, false);
        }
      }
      this.bonusChecks.set(target, selected);
      if (selected) this.currentBonuses.add(target);
      else this.currentBonuses.delete(target);
      this.calculate();
    }

    renderActionSlots() {
      // Wipe the list of references to the slot components.
      this.uiActionSlots = [];
      this.currentCalculator.getSkillActions().forEach((action, i) => {
        const slot = new UIActionSlot(action, i);
        this.uiActionSlots.push(slot);
      });
      this.loadIcons();
      // Filter out members actions on F2P
      if (isMembersWorld()) {
        this.uiActionSlots.forEach((s) => { s.shown = true; });
        this.emptyPanel = false;
      } else {
        const free = this.uiActionSlots.filter((slot) => !slot.getAction().isMembers(rl.itemManager));
        this.uiActionSlots.forEach((s) => { s.shown = free.includes(s); });
        this.emptyPanel = free.length === 0;
      }
    }

    // AsyncBufferedImage.addTo / SpriteManager.addSpriteTo: the item icons and sprites arrive once the client has drawn
    // them, so the missing ones are asked for again for a while and the panel redrawn when any comes in
    loadIcons() {
      clearInterval(this.iconTimer);
      let tries = 0;
      const fill = () => {
        let changed = false, missing = 0;
        if (!this.combined.icon) { this.combined.icon = spriteUrl(COMBINED_SPRITE); changed = changed || !!this.combined.icon; missing += this.combined.icon ? 0 : 1; }
        for (const slot of this.uiActionSlots) {
          if (slot.iconUrl) continue;
          const a = slot.getAction();
          slot.iconUrl = a.getIcon() !== -1 ? itemUrl(a.getIcon()) : a.getSprite() !== -1 ? spriteUrl(a.getSprite()) : null;
          if (slot.iconUrl) changed = true;
          else if (a.getIcon() !== -1 || a.getSprite() !== -1) missing++;
        }
        if (changed) this.plugin.publish();
        if (!missing || ++tries > 60) clearInterval(this.iconTimer);
      };
      this.iconTimer = setInterval(fill, 500);
    }

    // the slot's mousePressed
    slotPressed(slot, shift) {
      if (!shift) this.clearCombinedSlots();
      if (slot.isSelected) this.combinedActionSlots = this.combinedActionSlots.filter((s) => s !== slot);
      else this.combinedActionSlots.push(slot);
      slot.setSelected(!slot.isSelected);
      this.updateCombinedAction();
    }

    calculate() {
      for (const slot of this.uiActionSlots) {
        let actionCount = 0;
        let neededXP = this.targetXP - this.currentXP;
        const action = slot.getAction();
        let bonus = 1;
        for (const skillBonus of this.currentBonuses) {
          if (action.isBonusApplicable(skillBonus)) bonus = Math.fround(bonus * skillBonus.getValue());
        }
        const xp = Math.floor(Math.fround(Math.fround(Math.fround(Math.fround(action.getXp()) * 10) * bonus) * this.xpMultiplier));
        if (neededXP > 0) {
          neededXP *= 10;
          actionCount = Math.trunc((neededXP - 1) / xp) + 1;
        }
        slot.setText('Lvl. ' + action.getLevel() + ' (' + SkillCalculator.formatXPActionString(xp, actionCount, 'exp) - '));
        slot.setAvailable(this.currentLevel >= action.getLevel());
        slot.setOverlapping(action.getLevel() < this.targetLevel);
        slot.setValue(xp);
      }
      this.updateCombinedAction();
    }

    static formatXPActionString(xp, actionCount, expExpression) {
      const integer = Math.trunc(xp / 10);
      const frac = xp % 10;
      return (frac !== 0 ? integer + '.' + frac : integer) + expExpression + fmt(actionCount) + (actionCount === 1 ? ' action' : ' actions');
    }

    updateInputFields() {
      if (this.targetXP < this.currentXP) {
        this.targetLevel = SkillCalculator.enforceSkillBounds(this.currentLevel + 1);
        this.targetXP = Experience.getXpForLevel(this.targetLevel);
      }
      Object.assign(this.input, {
        currentLevel: this.currentLevel,
        currentXP: fmt(this.currentXP),
        targetLevel: this.targetLevel,
        targetXP: fmt(this.targetXP),
        neededXP: fmt(this.targetXP - this.currentXP) + ' XP required to reach target XP',
        multiplier: this.xpMultiplier,
      });
      this.calculate();
    }

    onFieldCurrentLevelUpdated(v) {
      this.currentLevel = SkillCalculator.enforceSkillBounds(v);
      this.currentXP = Experience.getXpForLevel(this.currentLevel);
      this.updateInputFields();
    }
    onFieldXPMultiplierUpdated(v) {
      this.xpMultiplier = SkillCalculator.enforceMultiplierBounds(v);
      this.updateInputFields();
    }
    onFieldCurrentXPUpdated(v) {
      this.currentXP = SkillCalculator.enforceXPBounds(v);
      this.currentLevel = Experience.getLevelForXp(this.currentXP);
      this.updateInputFields();
    }
    onFieldTargetLevelUpdated(v) {
      this.targetLevel = SkillCalculator.enforceSkillBounds(v);
      this.targetXP = Experience.getXpForLevel(this.targetLevel);
      this.updateInputFields();
    }
    onFieldTargetXPUpdated(v) {
      this.targetXP = SkillCalculator.enforceXPBounds(v);
      this.targetLevel = Experience.getLevelForXp(this.targetXP);
      this.updateInputFields();
    }

    static enforceSkillBounds(input) { return Math.min(Experience.MAX_VIRT_LEVEL, Math.max(1, input)); }
    static enforceXPBounds(input) { return Math.min(Experience.MAX_SKILL_XP, Math.max(0, input)); }
    static enforceMultiplierBounds(input) { return Math.min(MAX_XP_MULTIPLIER, Math.max(1, input)); }
  }

  // UICalculatorInputArea.getInput: the digits of the field's text, 0 when there are none
  const getInput = (text) => {
    const n = parseInt(String(text == null ? '' : text).replace(/\D/g, ''), 10);
    return Number.isFinite(n) && n <= 2147483647 ? n : 0;
  };

  // ---- SkillCalculatorPlugin + SkillCalculatorPanel
  class SkillCalculatorPlugin {
    constructor() {
      this.uiCalculator = new SkillCalculator(this);
      this.currentTab = null;
      this.shouldForceReload = false;
      this.lastWorldWasMembers = false;
    }
    // startUp / shutDown: the NavigationButton ("Skill Calculator", calc.png, priority 6) is the panel's
    startUp() { this.publish(); }
    shutDown() { clearInterval(this.uiCalculator.iconTimer); rl.panels.update('skillcalculator', null); }

    onWorldChanged() {
      const currentWorldIsMembers = isMembersWorld();
      if (currentWorldIsMembers !== this.lastWorldWasMembers) this.reloadCurrentCalculator();
      this.lastWorldWasMembers = currentWorldIsMembers;
    }

    // SkillCalculatorPanel: a tab per CalculatorType; selecting one opens its calculator
    selectTab(i) {
      const calculatorType = CalculatorType[i];
      if (!calculatorType) return;
      this.uiCalculator.openCalculator(calculatorType, this.shouldForceReload);
      this.currentTab = i;
      this.shouldForceReload = false;
      this.publish();
    }
    reloadCurrentCalculator() {
      if (this.currentTab != null) {
        this.shouldForceReload = true;
        this.selectTab(this.currentTab);
      }
    }

    publish() {
      const c = this.uiCalculator;
      rl.panels.update('skillcalculator', {
        tabs: CalculatorType.map((t) => t.getSkill().getName()),
        selected: this.currentTab,
        searchReset: this.searchReset | 0,
        input: c.input,
        open: c.currentCalculator != null,
        bonuses: c.showBonuses ? [...c.bonusChecks].map(([b, on]) => ({ id: b.name(), label: SkillCalculator.generateDisplayNameForBonus(b), on })) : [],
        combined: c.combined,
        empty: c.emptyPanel,
        slots: c.uiActionSlots.filter((s) => s.shown).map((s) => ({ i: s.index, n: s.getAction().name(), name: s.getActionName(), icon: s.iconUrl, text: s.text, border: s.border(), selected: s.isSelected })),
      });
    }

    onPanelAction(a) {
      const c = this.uiCalculator;
      if (a.action === 'tab') { this.selectTab(a.index | 0); return; }
      if (!c.currentCalculator) return;
      switch (a.action) {
        case 'currentLevel': c.onFieldCurrentLevelUpdated(getInput(a.value)); break;
        case 'currentXP': c.onFieldCurrentXPUpdated(getInput(a.value)); break;
        case 'targetLevel': c.onFieldTargetLevelUpdated(getInput(a.value)); break;
        case 'targetXP': c.onFieldTargetXPUpdated(getInput(a.value)); break;
        case 'multiplier': c.onFieldXPMultiplierUpdated(getInput(a.value)); break;
        case 'bonus': {
          const b = [...c.bonusChecks.keys()].find((x) => x.name() === a.id);
          if (b) c.adjustCheckboxes(b, !!a.value);
          break;
        }
        case 'slot': {
          const s = c.uiActionSlots.find((x) => x.index === (a.index | 0));
          if (s) c.slotPressed(s, !!a.shift);
          break;
        }
        default: return;
      }
      this.publish();
    }
  }

  const plugin = new SkillCalculatorPlugin();
  ll.__skillcalculator = { plugin, SkillCalculator, CalculatorType, SkillAction, SkillBonus };
  rl.registerPlugin('skillcalculator', plugin);
})();
