// RuneLite's Attack Styles plugin, cloned from net.runelite.client.plugins.attackstyles (BSD 2-Clause,
// Copyright (c) 2017, honeyhoney <https://github.com/honeyhoney> and RuneLite contributors):
// AttackStylesPlugin, AttackStyle, AttackStylesOverlay.
// 2007: the weapon type (OSRS's COMBAT_WEAPON_CATEGORY varbit) is the open combat tab's group (a tab per weapon
// type, rl.CombatInterface), so a weapon switch is that tab opening; its styles are the server's list for the tab
// (getWeaponTypeStyles from combat.dbrow, not OSRS's enum 3908 / structs); COM_MODE is varp 43 as in OSRS, and the
// staff's index 4 (casting) is the 2007 autocast (lastcastspell varp 108: autocast_set and a spell). No defensive
// casting in 2007. CombatInterface._0 .. _3 / AUTOCAST_BUTTONS / RETALIATE are the 2007 tab's button, icon and label.
// Left out: COMBAT_INTERFACE_SP / fixListeners (OSRS's special attack bar listeners; the 2007 bar has its own).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Skill, Color, Dimension, OverlayPanel, OverlayPosition, TitleComponent, ScriptID, CombatInterface } = rl;

  const COM_MODE = 43;
  const LASTCASTSPELL = 108; // varbits autocast_set (275), autocast_spell (276)

  // AttackStyle
  const AttackStyle = {};
  for (const [key, name, ...skills] of [
    ['ACCURATE', 'Accurate', Skill.ATTACK], ['AGGRESSIVE', 'Aggressive', Skill.STRENGTH], ['DEFENSIVE', 'Defensive', Skill.DEFENCE],
    ['CONTROLLED', 'Controlled', Skill.ATTACK, Skill.STRENGTH, Skill.DEFENCE], ['RANGING', 'Ranging', Skill.RANGED],
    ['LONGRANGE', 'Longrange', Skill.RANGED, Skill.DEFENCE], ['CASTING', 'Casting', Skill.MAGIC],
    ['DEFENSIVE_CASTING', 'Defensive Casting', Skill.MAGIC, Skill.DEFENCE], ['OTHER', 'Other']]) {
    AttackStyle[key] = { key, getName: () => name, getSkills: () => skills, toString: () => key };
  }
  const { OTHER } = AttackStyle;

  class AttackStylesOverlay extends OverlayPanel {
    constructor(plugin, config) {
      super(plugin);
      this.setPosition(OverlayPosition.ABOVE_CHATBOX_RIGHT);
      this.plugin = plugin; this.config = config;
      this.addMenuEntry('RUNELITE_OVERLAY_CONFIG', 'Configure', 'Attack style overlay');
    }
    render(graphics) {
      const warnedSkillSelected = this.plugin.isWarnedSkillSelected();
      if (warnedSkillSelected || this.config.alwaysShowStyle()) {
        const attackStyle = this.plugin.getAttackStyle();
        if (attackStyle == null) return null;
        const attackStyleString = attackStyle.getName();
        this.panelComponent.getChildren().push(TitleComponent.builder().text(attackStyleString).color(warnedSkillSelected ? Color.RED : Color.WHITE).build());
        this.panelComponent.setPreferredSize(new Dimension(graphics.getFontMetrics().stringWidth(attackStyleString) + 10, 0));
        return super.render(graphics);
      }
      return null;
    }
  }

  class AttackStylesPlugin {
    constructor() {
      this.configGroup = 'attackIndicator';
      this.config = rl.configProxy('attackIndicator', () => this.configItems);
      this.equippedWeaponTypeVarbit = -1;
      this.attackStyle = null; this.prevAttackStyle = null;
      this.warnedSkills = new Set();
      this.warnedSkillSelected = false;
      // Weapon type, component, hidden (Guava Table)
      this.widgetsToHide = new Map();
      this.hiddenByUs = new Set();
      this.overlay = new AttackStylesOverlay(this, this.config);
    }
    startUp() {
      rl.overlayManager.add(this.overlay);
      this.resetWarnings();
      if (client.getGameState() === rl.GameState.LOGGED_IN) {
        this.equippedWeaponTypeVarbit = CombatInterface.open();
        this.updateAttackStyle(this.equippedWeaponTypeVarbit, this.comMode(), 0);
        this.updateWarning();
        this.processWidgets();
      }
    }
    shutDown() {
      rl.overlayManager.remove(this.overlay);
      this.updateWidgetsToHide(false);
      this.processWidgets();
      this.hideWidgets(CombatInterface.components('RETALIATE'), false);
      this.warnedSkills.clear();
    }
    getAttackStyle() { return this.attackStyle; }
    isWarnedSkillSelected() { return this.warnedSkillSelected; }
    /** OSRS's COM_MODE: the 2007 varp 43, or 4 while the staff autocasts */
    comMode() {
      const styles = CombatInterface.getStyles(this.equippedWeaponTypeVarbit);
      if (styles && styles.length > 4 && client.getVarbitValue(275) === 1 && client.getVarbitValue(276) > 0) return 4;
      return client.getVarpValue(COM_MODE);
    }
    onScriptPostFired(scriptPostFired) {
      if (scriptPostFired.getScriptId() === ScriptID.COMBAT_INTERFACE_SETUP) {
        // (a 2007 tab of another weapon type: the weapon category changed)
        if (CombatInterface.open() !== this.equippedWeaponTypeVarbit) this.onWidgetLoaded({ getGroupId: () => CombatInterface.open() });
        this.processWidgets();
      }
    }
    processWidgets() {
      const row = this.widgetsToHide.get(this.equippedWeaponTypeVarbit);
      if (row) for (const [key, hidden] of row) this.hideWidgets(CombatInterface.components(key, this.equippedWeaponTypeVarbit), hidden);
      this.hideWidgets(CombatInterface.components('RETALIATE'), this.config.hideAutoRetaliate());
    }
    // (the weapon category varbit changing is the 2007 combat tab of another weapon type opening)
    onWidgetLoaded(event) { if (CombatInterface.getStyles(event.getGroupId())) this.onVarbitChanged({ getVarpId: () => -1, getVarbitId: () => -1, weaponTab: true }); }
    onVarbitChanged(event) {
      if (event.weaponTab || event.getVarpId() === COM_MODE || event.getVarpId() === LASTCASTSPELL) {
        const currentEquippedWeaponTypeVarbit = CombatInterface.open();
        const weaponSwitch = currentEquippedWeaponTypeVarbit !== this.equippedWeaponTypeVarbit;
        this.equippedWeaponTypeVarbit = currentEquippedWeaponTypeVarbit;
        this.updateAttackStyle(this.equippedWeaponTypeVarbit, this.comMode(), 0);
        this.updateWarning();
        if (weaponSwitch) this.processWidgets();
      }
    }
    onConfigChanged(event) {
      if (event.getGroup() !== 'attackIndicator') return;
      const enabled = String(event.getNewValue()) === 'true';
      switch (event.getKey()) {
        case 'warnForDefensive': this.updateWarnedSkills(enabled, Skill.DEFENCE); break;
        case 'warnForAttack': this.updateWarnedSkills(enabled, Skill.ATTACK); break;
        case 'warnForStrength': this.updateWarnedSkills(enabled, Skill.STRENGTH); break;
        case 'warnForRanged': this.updateWarnedSkills(enabled, Skill.RANGED); break;
        case 'warnForMagic': this.updateWarnedSkills(enabled, Skill.MAGIC); break;
        case 'removeWarnedStyles': this.updateWidgetsToHide(enabled); break;
        default: break;
      }
      this.updateWarning();
      this.processWidgets();
    }
    onGameTick() {
      if (this.attackStyle !== this.prevAttackStyle && this.warnedSkillSelected) {
        if (this.config.showChatWarnings()) {
          // ChatMessageBuilder HIGHLIGHT, as a CONSOLE message
          client.addChatMessage('CONSOLE', '', 'Your attack style has been changed to ' + this.attackStyle.getName(), null);
        }
        if (this.config.warningNotification()) rl.notifier.notify('Attack style changed to ' + this.attackStyle.getName() + '!');
      }
      this.prevAttackStyle = this.attackStyle;
    }
    resetWarnings() {
      this.updateWarnedSkills(this.config.warnForAttack(), Skill.ATTACK);
      this.updateWarnedSkills(this.config.warnForStrength(), Skill.STRENGTH);
      this.updateWarnedSkills(this.config.warnForDefence(), Skill.DEFENCE);
      this.updateWarnedSkills(this.config.warnForRanged(), Skill.RANGED);
      this.updateWarnedSkills(this.config.warnForMagic(), Skill.MAGIC);
    }
    updateAttackStyle(equippedWeaponType, attackStyleIndex, castingMode) {
      const attackStyles = this.getWeaponTypeStyles(equippedWeaponType);
      if (attackStyleIndex < attackStyles.length) {
        if (attackStyleIndex === 4) attackStyleIndex += castingMode;
        this.attackStyle = attackStyles[attackStyleIndex];
        if (this.attackStyle == null) this.attackStyle = OTHER;
      }
    }
    getWeaponTypeStyles(weaponType) {
      // (the 2007 tab's style list: the server's combat_style_table row for it)
      const names = CombatInterface.getStyles(weaponType);
      if (!names) return [];
      return names.map((n) => (n == null || n === 'OTHER' ? null : AttackStyle[n]));
    }
    updateWarnedSkills(enabled, skill) { if (enabled) this.warnedSkills.add(skill); else this.warnedSkills.delete(skill); }
    updateWarning() {
      this.warnedSkillSelected = false;
      if (this.attackStyle != null) {
        for (const skill of this.attackStyle.getSkills()) if (this.warnedSkills.has(skill)) { this.warnedSkillSelected = true; break; }
      }
      this.updateWidgetsToHide(this.config.removeWarnedStyles());
    }
    updateWidgetsToHide(enabled) {
      const attackStyles = this.getWeaponTypeStyles(this.equippedWeaponTypeVarbit);
      let row = this.widgetsToHide.get(this.equippedWeaponTypeVarbit);
      if (!row) { row = new Map(); this.widgetsToHide.set(this.equippedWeaponTypeVarbit, row); }
      for (let i = 0; i < attackStyles.length; i++) {
        const attackStyle = attackStyles[i];
        if (attackStyle == null) continue;
        let warnedSkill = false;
        for (const skill of attackStyle.getSkills()) if (this.warnedSkills.has(skill)) { warnedSkill = true; break; }
        switch (i) {
          case 0: row.set('_0', enabled && warnedSkill); break;
          case 1: row.set('_1', enabled && warnedSkill); break;
          case 2: row.set('_2', enabled && warnedSkill); break;
          case 3: row.set('_3', enabled && warnedSkill); break;
          case 4: row.set('AUTOCAST_BUTTONS', enabled && warnedSkill); break;
          // (5: defensive casting, not in 2007)
          default: break;
        }
      }
    }
    /** hideWidget for each of the 2007 components; only what this plugin hid is shown again (the server hides some) */
    hideWidgets(ids, hidden) {
      for (const id of ids) {
        const widget = client.getWidget(id);
        if (widget == null) continue;
        if (hidden) { widget.setHidden(true); this.hiddenByUs.add(id); } else if (this.hiddenByUs.has(id)) { widget.setHidden(false); this.hiddenByUs.delete(id); }
      }
    }
    getWarnedSkills() { return this.warnedSkills; }
    getHiddenWidgets() { return this.widgetsToHide; }
  }

  const plugin = new AttackStylesPlugin();
  ll.__attackstyles = { plugin };
  rl.registerPlugin('attackstyles', plugin);
})();
