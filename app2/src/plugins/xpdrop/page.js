// RuneLite's XP Drop plugin, cloned from net.runelite.client.plugins.xpdrop (BSD 2-Clause, Copyright (c) 2018, Cameron
// <https://github.com/noremac201>, Adam <Adam@sigterm.info> and RuneLite contributors): XpDropPlugin, XpDropConfig.
// It works on the core's OSRS-style XP drops (runelite/core2007.js: ScriptPreFired XPDROPS_SETDROPSIZE, the drop widgets,
// XPDROP_DISABLED for fake drops). Era-trim: the prayers after 2007 (Deadeye, Mystic Vigour, Rigour, Augury and the Raids
// prayers) are left out. 2007 keeps each prayer's state in a varp (rl.Prayer.getVarbit() is that varp), and the XP drop
// colour varbit / enum are the core's XP drop settings (rl.xpDrops.varbit, client.getEnum), which are this plugin's "2007RS"
// section. Era deviation: off by default (2007 had no XP drops; RuneLite's is on by default).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Prayer, Skill } = rl;
  const GROUP = 'xpdrop';
  const ScriptID = { XPDROPS_SETDROPSIZE: 996, XPDROP_DISABLED: 2091 };
  const EnumID = { XPDROP_COLORS: 1169 };
  const VarbitID = { XPDROPS_COLOUR: 4695 };
  const Staticons = { ATTACK: 197, STRENGTH: 198, DEFENCE: 199, RANGED: 200, MAGIC: 202 };

  const PrayerType = { MELEE: 'MELEE', RANGE: 'RANGE', MAGIC: 'MAGIC' };
  const PRAYER_TYPE = [
    ['BURST_OF_STRENGTH', [PrayerType.MELEE]], ['CLARITY_OF_THOUGHT', [PrayerType.MELEE]], ['SHARP_EYE', [PrayerType.RANGE]],
    ['MYSTIC_WILL', [PrayerType.MAGIC]], ['SUPERHUMAN_STRENGTH', [PrayerType.MELEE]], ['IMPROVED_REFLEXES', [PrayerType.MELEE]],
    ['HAWK_EYE', [PrayerType.RANGE]], ['MYSTIC_LORE', [PrayerType.MAGIC]], ['ULTIMATE_STRENGTH', [PrayerType.MELEE]],
    ['INCREDIBLE_REFLEXES', [PrayerType.MELEE]], ['EAGLE_EYE', [PrayerType.RANGE]], ['MYSTIC_MIGHT', [PrayerType.MAGIC]],
    ['CHIVALRY', [PrayerType.MELEE]], ['PIETY', [PrayerType.MELEE]],
  ].filter(([p]) => Prayer && Prayer[p]);

  class XpDropPlugin {
    constructor() {
      this.configGroup = GROUP;
      this.tickCounter = 0;
      this.previousExpGained = 0;
      this.hasDropped = false;
      this.xpdropColor = 0;
      this.lastSkill = null;
      this.previousSkillExpTable = new Map();
    }
    // (2007RS: the core's counter and drops exist only while this plugin is on)
    startUp() { this.config = rl.configProxy(GROUP, () => this.configItems); if (rl.xpDrops) rl.xpDrops.setActive(true); }
    shutDown() { if (rl.xpDrops) rl.xpDrops.setActive(false); }
    onScriptPreFired(scriptPreFired) {
      if (scriptPreFired.getScriptId() === ScriptID.XPDROPS_SETDROPSIZE) {
        const intStack = client.getIntStack();
        const intStackSize = client.getIntStackSize();
        // This runs prior to the proc being invoked, so the arguments are still on the stack.
        // Grab the first argument to the script.
        const widgetId = intStack[intStackSize - 4];
        this.processXpDrop(widgetId);
      }
    }
    processXpDrop(widgetId) {
      const xpdrop = client.getWidget(widgetId);
      const children = xpdrop.getChildren();
      // child 0 is the xpdrop text, everything else are sprite ids for skills
      const text = children[0];
      const prayers = this.getActivePrayerType();
      if (prayers.length === 0) {
        this.hideSkillIcons(xpdrop);
        this.resetTextColor(text);
        return;
      }
      const xpDropTypes = [...new Set(children.slice(1) // skip text
        .filter((c) => c != null)
        .map((c) => c.getSpriteId())
        .map((id) => {
          if (id === Staticons.ATTACK || id === Staticons.STRENGTH || id === Staticons.DEFENCE) return PrayerType.MELEE;
          if (id === Staticons.RANGED) return PrayerType.RANGE;
          if (id === Staticons.MAGIC) return PrayerType.MAGIC;
          return null;
        })
        .filter((t) => t != null))];
      // Check MELEE last to avoid defensive casting being categorized as melee
      if (xpDropTypes.includes(PrayerType.RANGE)) {
        if (prayers.includes(PrayerType.RANGE)) this.xpdropColor = this.config.getRangePrayerColor().getRGB();
      } else if (xpDropTypes.includes(PrayerType.MAGIC)) {
        if (prayers.includes(PrayerType.MAGIC)) this.xpdropColor = this.config.getMagePrayerColor().getRGB();
      } else if (xpDropTypes.includes(PrayerType.MELEE)) {
        if (prayers.includes(PrayerType.MELEE)) this.xpdropColor = this.config.getMeleePrayerColor().getRGB();
      }
      if (this.xpdropColor !== 0) text.setTextColor(this.xpdropColor);
      else this.resetTextColor(text);
      this.hideSkillIcons(xpdrop);
    }
    resetTextColor(widget) {
      const standardColor = this.config.standardColor();
      if (standardColor != null) {
        widget.setTextColor(standardColor.getRGB());
      } else {
        const colorEnum = client.getEnum(EnumID.XPDROP_COLORS);
        const defaultColorId = rl.xpDrops.varbit(VarbitID.XPDROPS_COLOUR);
        widget.setTextColor(colorEnum.getIntValue(defaultColorId));
      }
    }
    hideSkillIcons(xpdrop) {
      if (this.config.hideSkillIcons()) {
        const children = xpdrop.getChildren();
        // keep only text
        children.fill(null, 1, children.length);
      }
    }
    getActivePrayerType() {
      for (const [prayer, types] of PRAYER_TYPE) {
        if (client.getVarpValue(Prayer[prayer].getVarbit()) === 1) return types;
      }
      return [];
    }
    onGameTick() {
      this.xpdropColor = 0;
      const fakeTickDelay = this.config.fakeXpDropDelay();
      if (fakeTickDelay === 0 || this.lastSkill == null) return;
      // If an xp drop was created this tick, reset the counter
      if (this.hasDropped) {
        this.hasDropped = false;
        this.tickCounter = 0;
        return;
      }
      if (++this.tickCounter % fakeTickDelay !== 0) return;
      client.runScript(ScriptID.XPDROP_DISABLED, this.lastSkill.ordinal, this.previousExpGained);
    }
    onStatChanged(statChanged) {
      const skill = statChanged.getSkill();
      const xp = statChanged.getXp();
      this.lastSkill = skill;
      const previous = this.previousSkillExpTable.get(skill);
      this.previousSkillExpTable.set(skill, xp);
      if (previous !== undefined) {
        this.previousExpGained = xp - previous;
        this.hasDropped = true;
      }
    }
  }

  const plugin = new XpDropPlugin();
  ll.__xpdrop = { plugin, Skill };
  rl.registerPlugin('xpdrop', plugin);
})();
