// RuneLite's Combat Level plugin, cloned from net.runelite.client.plugins.combatlevel (BSD 2-Clause,
// Copyright (c) 2017, Devin French <https://github.com/devinfrench> and RuneLite contributors):
// CombatLevelPlugin, CombatLevelOverlay. InterfaceID.CombatInterface.LEVEL is the open 2007 combat tab's
// "Combat Lvl:" text (rl.CombatInterface); PvpIcons.WILDERNESSLEVEL the 2007 Wilderness overlay's level text (381:1).
// Left out: the Character Summary tab (2021, ACCOUNT_SUMMARY_* scripts) and PvP worlds (2007 has none).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Skill, Color, Overlay, Experience, ColorUtil, Tooltip, ScriptID, CombatInterface } = rl;

  const WILDERNESSLEVEL = (381 << 16) | 1;
  // new DecimalFormat("#.###")
  const DECIMAL_FORMAT = { format: (v) => String(Math.round(v * 1000) / 1000) };
  const CONFIG_GROUP = 'combatlevel';
  const ATTACK_RANGE_CONFIG_KEY = 'wildernessAttackLevelRange';
  const WILDERNESS_LEVEL_PATTERN = /^Level: (\d+)$/;
  const MIN_COMBAT_LEVEL = 3;
  const COMBAT_LEVEL_COLOUR = new Color(0xff981f);
  const levelWidget = () => { const ids = CombatInterface.components('LEVEL'); return ids.length ? client.getWidget(ids[0]) : null; };
  const precise = () => Experience.getCombatLevelPrecise(
    client.getRealSkillLevel(Skill.ATTACK), client.getRealSkillLevel(Skill.STRENGTH), client.getRealSkillLevel(Skill.DEFENCE),
    client.getRealSkillLevel(Skill.HITPOINTS), client.getRealSkillLevel(Skill.MAGIC), client.getRealSkillLevel(Skill.RANGED),
    client.getRealSkillLevel(Skill.PRAYER));

  class CombatLevelOverlay extends Overlay {
    constructor(plugin, config) { super(plugin); this.config = config; }
    render() {
      if (!this.config.showLevelsUntil() || (client.getLocalPlayer() != null && client.getLocalPlayer().getCombatLevel() === Experience.MAX_COMBAT_LEVEL)) return null;
      const combatTabLevelWidget = levelWidget();
      let combatCanvas = null;
      if (combatTabLevelWidget != null && !combatTabLevelWidget.isHidden()) combatCanvas = combatTabLevelWidget.getBounds();
      // (no Character Summary tab in 2007)
      if (combatCanvas == null) return null;
      if (combatCanvas.contains(client.getMouseCanvasPosition().getX(), client.getMouseCanvasPosition().getY())) {
        rl.tooltipManager.add(new Tooltip(this.getLevelsUntilTooltip()));
      }
      return null;
    }
    getLevelsUntilTooltip() {
      const attackLevel = client.getRealSkillLevel(Skill.ATTACK);
      const strengthLevel = client.getRealSkillLevel(Skill.STRENGTH);
      const defenceLevel = client.getRealSkillLevel(Skill.DEFENCE);
      const hitpointsLevel = client.getRealSkillLevel(Skill.HITPOINTS);
      const magicLevel = client.getRealSkillLevel(Skill.MAGIC);
      const rangeLevel = client.getRealSkillLevel(Skill.RANGED);
      const prayerLevel = client.getRealSkillLevel(Skill.PRAYER);
      const args = [attackLevel, strengthLevel, defenceLevel, hitpointsLevel, magicLevel, rangeLevel, prayerLevel];
      const meleeNeed = Experience.getNextCombatLevelMelee(...args);
      const hpDefNeed = Experience.getNextCombatLevelHpDef(...args);
      const rangeNeed = Experience.getNextCombatLevelRange(...args);
      const magicNeed = Experience.getNextCombatLevelMagic(...args);
      const prayerNeed = Experience.getNextCombatLevelPrayer(...args);
      let sb = ColorUtil.wrapWithColorTag('Next combat level:</br>', COMBAT_LEVEL_COLOUR);
      if ((attackLevel + strengthLevel) < Experience.MAX_REAL_LEVEL * 2) sb += meleeNeed + ' Attack/Strength</br>';
      if ((hitpointsLevel + defenceLevel) < Experience.MAX_REAL_LEVEL * 2) sb += hpDefNeed + ' Defence/Hitpoints</br>';
      if (rangeLevel < Experience.MAX_REAL_LEVEL) sb += rangeNeed + ' Ranged</br>';
      if (magicLevel < Experience.MAX_REAL_LEVEL) sb += magicNeed + ' Magic</br>';
      if (prayerLevel < Experience.MAX_REAL_LEVEL) sb += prayerNeed + ' Prayer';
      return sb;
    }
  }

  class CombatLevelPlugin {
    constructor() {
      this.configGroup = CONFIG_GROUP;
      this.config = rl.configProxy(CONFIG_GROUP, () => this.configItems);
      this.overlay = new CombatLevelOverlay(this, this.config);
      this.combatLevelStr = null;
    }
    startUp() {
      this.combatLevelStr = DECIMAL_FORMAT.format(precise());
      rl.overlayManager.add(this.overlay);
      if (this.config.wildernessAttackLevelRange()) this.appendAttackLevelRangeText();
      // (OSRS re-runs the combat tab's setup script when the plugin starts; the open 2007 tab gets the text now)
      if (this.config.showPreciseCombatLevel()) this.onScriptPostFired({ getScriptId: () => ScriptID.COMBAT_INTERFACE_SETUP });
    }
    shutDown() {
      rl.overlayManager.remove(this.overlay);
      const combatLevelWidget = levelWidget();
      if (combatLevelWidget != null) {
        const widgetText = combatLevelWidget.getText();
        // (the 2007 text works its level out itself: give it back its "%1" so it follows level ups again)
        if (widgetText.includes('.')) combatLevelWidget.setText('Combat Lvl: %1');
      }
      this.shutDownAttackLevelRange();
    }
    onStatChanged(statChanged) {
      const skill = statChanged.getSkill();
      if (skill === Skill.ATTACK || skill === Skill.DEFENCE || skill === Skill.STRENGTH || skill === Skill.HITPOINTS
        || skill === Skill.MAGIC || skill === Skill.PRAYER || skill === Skill.RANGED) {
        this.combatLevelStr = DECIMAL_FORMAT.format(precise());
      }
    }
    onConfigChanged(event) {
      if (CONFIG_GROUP !== event.getGroup() || ATTACK_RANGE_CONFIG_KEY !== event.getKey()) return;
      if (this.config.wildernessAttackLevelRange()) this.appendAttackLevelRangeText();
      else this.shutDownAttackLevelRange();
    }
    onScriptPostFired(scriptPostFired) {
      if (scriptPostFired.getScriptId() === ScriptID.PVP_WIDGET_BUILDER && this.config.wildernessAttackLevelRange()) this.appendAttackLevelRangeText();
      if (scriptPostFired.getScriptId() === ScriptID.COMBAT_INTERFACE_SETUP && this.config.showPreciseCombatLevel()) {
        const combatLevelWidget = levelWidget();
        if (combatLevelWidget) combatLevelWidget.setText('Combat Lvl: ' + this.combatLevelStr);
      }
    }
    appendAttackLevelRangeText() {
      const wildernessLevelWidget = client.getWidget(WILDERNESSLEVEL);
      if (wildernessLevelWidget == null) return;
      const wildernessLevelText = wildernessLevelWidget.getText();
      const m = WILDERNESS_LEVEL_PATTERN.exec(wildernessLevelText);
      if (!m) return; // (no PvP worlds)
      const wildernessLevel = parseInt(m[1], 10);
      const combatLevel = client.getLocalPlayer().getCombatLevel();
      wildernessLevelWidget.setText(wildernessLevelText + '<br>' + CombatLevelPlugin.combatAttackRange(combatLevel, wildernessLevel));
    }
    shutDownAttackLevelRange() {
      const wildernessLevelWidget = client.getWidget(WILDERNESSLEVEL);
      if (wildernessLevelWidget != null) {
        const wildernessLevelText = wildernessLevelWidget.getText();
        if (wildernessLevelText.includes('<br>')) wildernessLevelWidget.setText(wildernessLevelText.substring(0, wildernessLevelText.indexOf('<br>')));
      }
    }
    static combatAttackRange(combatLevel, wildernessLevel) {
      return Math.max(MIN_COMBAT_LEVEL, combatLevel - wildernessLevel) + '-' + Math.min(Experience.MAX_COMBAT_LEVEL, combatLevel + wildernessLevel);
    }
  }

  const plugin = new CombatLevelPlugin();
  ll.__combatlevel = { plugin };
  rl.registerPlugin('combatlevel', plugin);
})();
