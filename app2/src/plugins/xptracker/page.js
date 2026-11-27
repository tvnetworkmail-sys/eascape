// RuneLite's XP Tracker plugin, cloned from net.runelite.client.plugins.xptracker (BSD 2-Clause, Copyright (c)
// 2017-2018, Cameron <moberg@tuta.io>, Adam <Adam@sigterm.info>, Levi <me@levischuck.com> and RuneLite contributors):
// XpTrackerPlugin, XpState, XpStateSingle, XpPauseState, XpPauseStateSingle, XpSave, XpPanelLabel,
// XpProgressBarLabel, XpInfoBoxOverlay, and the state of XpPanel / XpInfoBox (drawn by ui/panels/xptracker.js).
// The 2007 game has no in-game XP goals (OSRS's XPDROPS_*_START/END varps), so the goal is always the next level,
// as RuneLite does when no goal is set. Left out: the online XP updater (XpClient) and Wise Old Man links.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Skill, Color, Point, Rectangle, LineComponent, SplitComponent, ImageComponent, PanelComponent, ProgressBarComponent,
    ComponentOrientation, OverlayPanel, FontManager, Experience, QuantityFormatter, SkillColor, MenuAction, WidgetUtil, Text, GameState } = rl;

  const INT_MAX = 2147483647;
  // Java's (int) casts: of a double, saturating; of a long, wrapping
  const toInt = (v) => (Number.isFinite(v) ? Math.max(-2147483648, Math.min(INT_MAX, Math.trunc(v))) : (Number.isNaN(v) ? 0 : (v > 0 ? INT_MAX : -2147483648)));
  const longToInt = (v) => v | 0;

  // ---------------------------------------------------------------- XpPanelLabel / XpProgressBarLabel

  const fmt = (val) => (val === INT_MAX ? 'N/A' : QuantityFormatter.quantityToRSDecimalStack(val, true));
  const XpPanelLabel = {
    TIME_TO_LEVEL: { key: 'TTL', value: (s) => s.timeTillGoalShort },
    XP_GAINED: { key: 'XP Gained', value: (s) => fmt(s.xpGainedInSession) },
    XP_HOUR: { key: 'XP/hr', value: (s) => fmt(s.xpPerHour) },
    XP_LEFT: { key: 'XP Left', value: (s) => fmt(s.xpRemainingToGoal) },
    ACTIONS_LEFT: { key: 'Actions', value: (s) => fmt(s.actionsRemainingToGoal) },
    ACTIONS_HOUR: { key: 'Actions/hr', value: (s) => fmt(s.actionsPerHour) },
    ACTIONS_DONE: { key: 'Actions Done', value: (s) => fmt(s.actionsInSession) },
  };
  // XpInfoBox.TWO_DECIMAL_FORMAT: "0.00", RoundingMode.DOWN
  const twoDecimal = (v) => (Math.trunc(Math.round(v * 100 * 1e6) / 1e6) / 100).toFixed(2);
  const XpProgressBarLabel = {
    PERCENTAGE: (s) => twoDecimal(s.skillProgressToGoal) + '%',
    TIME_TO_LEVEL: (s) => s.timeTillGoal,
    HOURS_TO_LEVEL: (s) => s.timeTillGoalHours,
  };

  // ---------------------------------------------------------------- XpStateSingle

  const p2 = (n) => String(n).padStart(2, '0');
  class XpStateSingle {
    constructor(startXp) {
      this.actions = 0; this.actionsSinceReset = 0; this.actionsHistoryInitialized = false;
      this.actionExps = new Array(10).fill(0); this.actionExpIndex = 0;
      this.startXp = startXp; this.xpGainedSinceReset = 0; this.xpGainedBeforeReset = 0;
      this.skillTime = 0; this.lastChangeMillis = 0; this.startLevelExp = 0; this.endLevelExp = 0; this.compactView = false;
    }
    getStartXp() { return this.startXp; }
    setStartXp(v) { this.startXp = v; }
    getCurrentXp() { return this.startXp + this.getTotalXpGained(); }
    getTotalXpGained() { return this.xpGainedBeforeReset + this.xpGainedSinceReset; }
    getLastChangeMillis() { return this.lastChangeMillis; }
    getActionsHr() { return this.toHourly(this.actionsSinceReset); }
    toHourly(value) { return toInt((1.0 / (this.getTimeElapsedInSeconds() / 3600.0)) * value); }
    getTimeElapsedInSeconds() { return Math.max(60, Math.trunc(this.skillTime / 1000)); }
    getXpRemaining() { return this.endLevelExp - longToInt(this.getCurrentXp()); }
    getActionsRemaining() {
      if (this.actionsHistoryInitialized) {
        const xpRemaining = this.getXpRemaining() * this.actionExps.length;
        let total = 0;
        for (const a of this.actionExps) total += a;
        if (total > 0) {
          const remainder = xpRemaining % total;
          const quotient = Math.trunc(xpRemaining / total);
          return quotient + (remainder > 0 ? 1 : 0);
        }
      }
      return INT_MAX;
    }
    getSkillProgress() {
      const xpGained = this.getCurrentXp() - this.startLevelExp;
      const xpGoal = this.endLevelExp - this.startLevelExp;
      return (xpGained / xpGoal) * 100;
    }
    getSecondsTillLevel() {
      const seconds = this.getTimeElapsedInSeconds();
      if (seconds <= 0 || this.xpGainedSinceReset <= 0) return -1;
      return Math.trunc((this.getXpRemaining() * seconds) / this.xpGainedSinceReset);
    }
    getTimeTillLevel(type) {
      const rem = this.getSecondsTillLevel();
      if (rem < 0) return '∞';
      const days = Math.trunc(rem / 86400);
      const hours = Math.trunc((rem % 86400) / 3600);
      const hoursTotal = Math.trunc(rem / 3600);
      const mins = Math.trunc((rem % 3600) / 60);
      const secs = rem % 60;
      // (the Java switch falls through DAYS -> HOURS -> SHORT)
      if (type === 'DAYS') {
        if (days > 1) return `${days} days ${p2(hours)}:${p2(mins)}:${p2(secs)}`;
        if (days === 1) return `1 day ${p2(hours)}:${p2(mins)}:${p2(secs)}`;
      }
      if (type === 'DAYS' || type === 'HOURS') {
        if (hoursTotal > 1) return `${hoursTotal} hours ${p2(mins)}:${p2(secs)}`;
        if (hoursTotal === 1) return `1 hour ${p2(mins)}:${p2(secs)}`;
      }
      if (hoursTotal > 0) return `${hoursTotal}:${p2(mins)}:${p2(secs)}`;
      return `${p2(mins)}:${p2(secs)}`;
    }
    getXpHr() { return this.toHourly(this.xpGainedSinceReset); }
    resetPerHour() {
      this.actionsSinceReset = 0;
      this.xpGainedBeforeReset += this.xpGainedSinceReset;
      this.xpGainedSinceReset = 0;
      this.lastChangeMillis = Date.now();
      this.skillTime = 0;
    }
    update(currentXp) {
      if (this.startXp === -1) return false;
      const originalXp = this.getTotalXpGained() + this.startXp;
      const actionExp = longToInt(currentXp - originalXp);
      if (actionExp === 0) return false;
      if (this.actionsHistoryInitialized) this.actionExps[this.actionExpIndex] = actionExp;
      else { this.actionExps.fill(actionExp); this.actionsHistoryInitialized = true; }
      this.actionExpIndex = (this.actionExpIndex + 1) % this.actionExps.length;
      this.actions++;
      this.actionsSinceReset++;
      this.xpGainedSinceReset = longToInt(currentXp - (this.startXp + this.xpGainedBeforeReset));
      this.lastChangeMillis = Date.now();
      return true;
    }
    updateGoals(currentXp, goalStartXp, goalEndXp) {
      if (goalStartXp < 0 || currentXp > goalEndXp) this.startLevelExp = Experience.getXpForLevel(Experience.getLevelForXp(longToInt(currentXp)));
      else this.startLevelExp = goalStartXp;
      if (goalEndXp <= 0 || currentXp > goalEndXp) {
        const lvl = Experience.getLevelForXp(longToInt(currentXp));
        this.endLevelExp = lvl + 1 <= Experience.MAX_VIRT_LEVEL ? Experience.getXpForLevel(lvl + 1) : Experience.MAX_SKILL_XP;
      } else this.endLevelExp = goalEndXp;
    }
    tick(delta) {
      if (this.xpGainedSinceReset <= 0) return;
      this.skillTime += delta;
    }
    snapshot() {
      return {
        startLevel: Experience.getLevelForXp(this.startLevelExp),
        endLevel: Experience.getLevelForXp(this.endLevelExp),
        xpGainedInSession: this.getTotalXpGained(),
        xpRemainingToGoal: this.getXpRemaining(),
        xpPerHour: this.getXpHr(),
        skillProgressToGoal: this.getSkillProgress(),
        actionsInSession: this.actions,
        actionsRemainingToGoal: this.getActionsRemaining(),
        actionsPerHour: this.getActionsHr(),
        timeTillGoal: this.getTimeTillLevel('DAYS'),
        timeTillGoalHours: this.getTimeTillLevel('HOURS'),
        timeTillGoalShort: this.getTimeTillLevel('SHORT'),
        startGoalXp: this.startLevelExp,
        endGoalXp: this.endLevelExp,
        compactView: this.compactView,
      };
    }
    // XpSaveSingle (gson names s, br, ar, t)
    save() { return { s: this.startXp, br: this.xpGainedBeforeReset, ar: this.xpGainedSinceReset, t: this.skillTime }; }
    restore(save) { this.startXp = save.s; this.xpGainedBeforeReset = save.br; this.xpGainedSinceReset = save.ar; this.skillTime = save.t; }
  }

  // ---------------------------------------------------------------- XpState

  class XpState {
    constructor(config) { this.config = config; this.xpSkills = new Map(); this.order = []; this.overall = new XpStateSingle(-1); }
    reset() { this.xpSkills.clear(); this.order.length = 0; this.overall = new XpStateSingle(-1); }
    resetSkillPerHour(skill) { const s = this.xpSkills.get(skill); if (s) s.resetPerHour(); }
    resetOverallPerHour() { this.overall.resetPerHour(); }
    updateSkill(skill, currentXp, goalStartXp, goalEndXp) {
      const state = this.xpSkills.get(skill);
      if (!state || state.getStartXp() === -1) { this.initializeSkill(skill, currentXp); return 'INITIALIZED'; }
      if (state.getStartXp() + state.getTotalXpGained() > currentXp) { this.initializeSkill(skill, currentXp); return 'INITIALIZED'; }
      if (!state.update(currentXp)) return 'NO_CHANGE';
      state.updateGoals(currentXp, goalStartXp, goalEndXp);
      this.updateOrder(skill);
      return 'UPDATED';
    }
    updateOverall(currentXp) {
      if (!this.overall || this.overall.getStartXp() + this.overall.getTotalXpGained() > currentXp) this.overall = new XpStateSingle(currentXp);
      else this.overall.update(currentXp);
    }
    tick(skill, delta) { this._tick(this.getSkill(skill), delta); }
    tickOverall(delta) { this._tick(this.overall, delta); }
    _tick(state, delta) {
      state.tick(delta);
      const resetAfterMinutes = this.config.resetSkillRateAfter();
      if (resetAfterMinutes > 0) {
        const last = state.getLastChangeMillis();
        if (last !== 0 && Date.now() - last >= resetAfterMinutes * 60 * 1000) state.resetPerHour();
      }
    }
    initializeSkill(skill, currentXp) { this.xpSkills.set(skill, new XpStateSingle(currentXp)); }
    initializeOverall(currentXp) { this.overall = new XpStateSingle(currentXp); }
    isInitialized(skill) { const s = this.xpSkills.get(skill); return !!s && s.getStartXp() !== -1; }
    isOverallInitialized() { return this.overall.getStartXp() !== -1; }
    getSkill(skill) { if (!this.xpSkills.has(skill)) this.xpSkills.set(skill, new XpStateSingle(-1)); return this.xpSkills.get(skill); }
    getSkillSnapshot(skill) { return this.getSkill(skill).snapshot(); }
    getTotalSnapshot() { return this.overall.snapshot(); }
    setCompactView(skill, compact) { const s = this.xpSkills.get(skill); if (s) s.compactView = compact; }
    setOrder(skill, newPosition) {
      const old = this.order.indexOf(skill);
      if (old !== newPosition && old >= 0) { this.order.splice(old, 1); this.order.splice(newPosition, 0, skill); }
    }
    updateOrder(skill) {
      if (this.config.prioritizeRecentXpSkills()) {
        if (this.order.indexOf(skill) !== 0) { const i = this.order.indexOf(skill); if (i >= 0) this.order.splice(i, 1); this.order.unshift(skill); }
      } else if (!this.order.includes(skill)) this.order.push(skill);
    }
    save() {
      if (this.overall.getStartXp() === -1) return null;
      const save = { skills: {}, compactViewSkills: [], overall: null };
      for (const skill of this.order) {
        const state = this.xpSkills.get(skill);
        if (!state) continue;
        if (state.getTotalXpGained() > 0) save.skills[skill.name] = state.save();
        if (state.compactView) save.compactViewSkills.push(skill.name);
      }
      save.overall = this.overall.save();
      return save;
    }
    restore(save) {
      this.reset();
      for (const [name, s] of Object.entries(save.skills || {})) {
        const skill = Skill[name];
        if (!skill) continue;
        const state = new XpStateSingle(s.s);
        state.restore(s);
        this.xpSkills.set(skill, state);
        this.order.push(skill);
      }
      for (const name of save.compactViewSkills || []) { const st = Skill[name] && this.xpSkills.get(Skill[name]); if (st) st.compactView = true; }
      if (save.overall) this.overall.restore(save.overall);
    }
  }

  // ---------------------------------------------------------------- XpPauseState / XpPauseStateSingle

  class XpPauseStateSingle {
    constructor() { this.pauseReasons = new Set(); this.lastChangeMillis = 0; this.xp = 0; }
    isPaused() { return this.pauseReasons.size > 0; }
    _add(r) { const had = this.pauseReasons.has(r); this.pauseReasons.add(r); return !had; }
    login() { return this.pauseReasons.delete('PAUSED_LOGOUT'); }
    logout() { return this._add('PAUSED_LOGOUT'); }
    timeout() { return this._add('PAUSED_TIMEOUT'); }
    manualPause() { return this._add('PAUSE_MANUAL'); }
    xpChanged(xp) { this.xp = xp; this.lastChangeMillis = Date.now(); return this.clearAll(); }
    unpause() { this.lastChangeMillis = Date.now(); return this.clearAll(); }
    clearAll() { if (!this.pauseReasons.size) return false; this.pauseReasons.clear(); return true; }
  }
  class XpPauseState {
    constructor() { this.skillPauses = new Map(); this.overall = new XpPauseStateSingle(); this.prevIsLoggedIn = false; }
    pauseSkill(skill) { return this.find(skill).manualPause(); }
    pauseOverall() { return this.overall.manualPause(); }
    unpauseSkill(skill) { return this.find(skill).unpause(); }
    unpauseOverall() { return this.overall.unpause(); }
    isPaused(skill) { return this.find(skill).isPaused(); }
    isOverallPaused() { return this.overall.isPaused(); }
    tickXp(skill, xp, after) { this.tick(this.find(skill), xp, after); }
    tickOverall(xp, after) { this.tick(this.overall, xp, after); }
    tick(state, currentXp, pauseAfterMinutes) {
      if (state.xp !== currentXp) state.xpChanged(currentXp);
      else if (pauseAfterMinutes > 0) {
        const last = state.lastChangeMillis;
        if (last !== 0 && Date.now() - last >= pauseAfterMinutes * 60 * 1000) state.timeout();
      }
    }
    tickLogout(pauseOnLogout, loggedIn) {
      if (!this.prevIsLoggedIn && loggedIn) {
        this.prevIsLoggedIn = true;
        for (const skill of Skill.values()) this.find(skill).login();
        this.overall.login();
      } else if (this.prevIsLoggedIn && !loggedIn) {
        this.prevIsLoggedIn = false;
        if (pauseOnLogout) {
          for (const skill of Skill.values()) this.find(skill).logout();
          this.overall.logout();
        }
      }
    }
    find(skill) { if (!this.skillPauses.has(skill)) this.skillPauses.set(skill, new XpPauseStateSingle()); return this.skillPauses.get(skill); }
  }

  // ---------------------------------------------------------------- XpPanel / XpInfoBox (their state; the sidebar draws it)

  const isCombatSkill = (s) => s === Skill.ATTACK || s === Skill.STRENGTH || s === Skill.DEFENCE || s === Skill.HITPOINTS || s === Skill.RANGED;
  const isActions = (l) => l === 'ACTIONS_LEFT' || l === 'ACTIONS_HOUR' || l === 'ACTIONS_DONE';

  class XpInfoBox {
    constructor(plugin, config, panel, skill) {
      this.plugin = plugin; this.config = config; this.panel = panel; this.skill = skill;
      this.paused = false; this.pauseText = 'Pause'; this.compact = false;
      this.bar = { value: 0, center: '', left: '', right: '', positions: [], tooltip: '', dimmed: false };
      this.labels = ['', '', '', ''];
    }
    reset() { this.setCompactView(false); this.panel.remove(this); }
    toggleCompactView() { const isCompact = this.compact; this.setCompactView(!isCompact); return !isCompact; }
    setCompactView(c) { this.compact = c; }
    update(updated, skillPaused, snap) {
      const c = this.config;
      if (updated) {
        this.panel.add(this);
        if (c.prioritizeRecentXpSkills()) this.panel.toFront(this);
        this.paused = skillPaused;
        const b = this.bar;
        b.value = Math.trunc(snap.skillProgressToGoal);
        b.center = XpProgressBarLabel[c.progressBarLabel()](snap);
        b.left = 'Lvl. ' + snap.startLevel;
        b.right = snap.endGoalXp === Experience.MAX_SKILL_XP ? '200M' : 'Lvl. ' + snap.endLevel;
        b.positions = [];
        if (c.showIntermediateLevels() && snap.endLevel - snap.startLevel > 1) {
          for (let level = snap.startLevel + 1; level <= snap.endLevel; level++) {
            const rs = Experience.getXpForLevel(level) - snap.startGoalXp;
            const re = snap.endGoalXp - snap.startGoalXp;
            b.positions.push(Math.trunc((rs / re) * 100));
          }
        }
        const tl = c.progressBarTooltipLabel();
        const end = `${XpProgressBarLabel[tl](snap)} ${tl === 'PERCENTAGE' ? 'of goal' : 'till goal lvl'}`;
        b.tooltip = isCombatSkill(this.skill) ? end : `${snap.actionsInSession} Actions done\n${snap.actionsPerHour} Actions/hr\n${end}`;
        b.dimmed = skillPaused;
        this.setCompactView(snap.compactView);
      } else if (!this.paused && skillPaused) {
        this.bar.dimmed = true; this.paused = true; this.pauseText = 'Unpause';
      } else if (this.paused && !skillPaused) {
        this.bar.dimmed = false; this.paused = false; this.pauseText = 'Pause';
      }
      const labels = [c.xpPanelLabel1(), c.xpPanelLabel2(), c.xpPanelLabel3(), c.xpPanelLabel4()];
      this.labels = labels.map((l) => (isActions(l) && isCombatSkill(this.skill) ? null : [XpPanelLabel[l].key + ': ', XpPanelLabel[l].value(snap)]));
    }
    state() {
      return { skill: this.skill.name, name: this.skill.getName(), color: SkillColor.find(this.skill).getColor().getRGB() & 0xffffff,
        compact: this.compact, paused: this.paused, pauseText: this.pauseText, canvas: this.plugin.hasOverlay(this.skill), bar: this.bar, labels: this.labels };
    }
  }

  class XpPanel {
    constructor(plugin, config) {
      this.plugin = plugin; this.config = config;
      this.infoBoxes = new Map();
      this.shown = []; // DragAndDropReorderPane's children, top to bottom
      this.overallVisible = false;
      this.overall = ['0', '0'];
      for (const skill of Skill.values()) this.infoBoxes.set(skill, new XpInfoBox(plugin, config, this, skill));
    }
    add(box) { if (!this.shown.includes(box)) this.shown.push(box); }
    remove(box) { const i = this.shown.indexOf(box); if (i >= 0) this.shown.splice(i, 1); }
    toFront(box) { this.remove(box); this.shown.unshift(box); }
    resetAllInfoBoxes() { for (const b of this.infoBoxes.values()) b.reset(); }
    resetSkill(skill) { this.infoBoxes.get(skill).reset(); }
    updateSkillExperience(updated, paused, skill, snap) { this.infoBoxes.get(skill).update(updated, paused, snap); }
    updateTotal(t) {
      if (t.xpGainedInSession > 0 && !this.overallVisible) this.overallVisible = true;
      else if (t.xpGainedInSession === 0 && this.overallVisible) this.overallVisible = false;
      this.overall = [QuantityFormatter.quantityToRSDecimalStack(t.xpGainedInSession, true), QuantityFormatter.quantityToRSDecimalStack(t.xpPerHour, true)];
    }
    publish() {
      rl.panels.update('xptracker', { overallVisible: this.overallVisible, overall: this.overall, boxes: this.shown.map((b) => b.state()) });
    }
  }

  // ---------------------------------------------------------------- XpInfoBoxOverlay

  const BORDER_SIZE = 2;
  const XP_AND_PROGRESS_BAR_GAP = 2;
  const XP_AND_ICON_GAP = 4;
  class XpInfoBoxOverlay extends OverlayPanel {
    constructor(plugin, config, skill, icon) {
      super(plugin);
      this.plugin = plugin; this.config = config; this.skill = skill; this.icon = icon;
      this.iconXpSplitPanel = new PanelComponent();
      this.panelComponent.setBorder(new Rectangle(BORDER_SIZE, BORDER_SIZE, BORDER_SIZE, BORDER_SIZE));
      this.panelComponent.setGap(new Point(0, XP_AND_PROGRESS_BAR_GAP));
      this.iconXpSplitPanel.setBorder(new Rectangle(2, 1, 4, 0));
      this.iconXpSplitPanel.setBackgroundColor(null);
    }
    getSkill() { return this.skill; }
    render(graphics) {
      this.iconXpSplitPanel.getChildren().length = 0;
      graphics.setFont(FontManager.getRunescapeSmallFont());
      const snap = this.plugin.getSkillSnapshot(this.skill);
      const top = XpPanelLabel[this.config.onScreenDisplayMode()];
      const bottom = XpPanelLabel[this.config.onScreenDisplayModeBottom()];
      const xpLine = LineComponent.builder().left(top.key + ':').right(top.value(snap)).build();
      const xpLineBottom = LineComponent.builder().left(bottom.key + ':').right(bottom.value(snap)).build();
      const xpSplit = SplitComponent.builder().first(xpLine).second(xpLineBottom).orientation(ComponentOrientation.VERTICAL).build();
      const iconXpSplit = SplitComponent.builder().first(new ImageComponent(this.icon)).second(xpSplit)
        .orientation(ComponentOrientation.HORIZONTAL).gap(new Point(XP_AND_ICON_GAP, 0)).build();
      this.iconXpSplitPanel.getChildren().push(iconXpSplit);
      const bar = new ProgressBarComponent();
      bar.setBackgroundColor(new Color(61, 56, 49));
      bar.setForegroundColor(SkillColor.find(this.skill).getColor());
      bar.setLeftLabel(String(snap.startLevel));
      bar.setRightLabel(snap.endGoalXp === Experience.MAX_SKILL_XP ? '200M' : String(snap.endLevel));
      bar.setValue(snap.skillProgressToGoal);
      this.panelComponent.getChildren().push(this.iconXpSplitPanel);
      this.panelComponent.getChildren().push(bar);
      return super.render(graphics);
    }
    getName() { return super.getName() + this.skill.getName(); }
  }

  // ---------------------------------------------------------------- XpTrackerPlugin

  const MENUOP_ADD_CANVAS_TRACKER = 'Add to canvas';
  const MENUOP_REMOVE_CANVAS_TRACKER = 'Remove from canvas';
  // InterfaceID.STATS: the skills tab (320, as in RuneLite; the 2007 client uses the same interface ids)
  const STATS = 320;

  class XpTrackerPlugin {
    constructor() {
      this.configGroup = 'xpTracker';
      this.config = rl.configProxy('xpTracker', () => this.configItems);
      this.xpState = new XpState(this.config);
      this.xpPauseState = new XpPauseState();
      this.lastAccount = -1;
      this.lastProfile = null;
      this.lastTickMillis = 0;
      this.initializeTracker = 0;
      this.timers = [];
    }
    startUp() {
      this.xpPanel = new XpPanel(this, this.config);
      this.initializeTracker = 2;
      this.lastAccount = -1;
      this.lastTickMillis = 0;
      if (client.getGameState() === GameState.LOGGED_IN) this.lastAccount = client.getAccountHash();
      // @Schedule(period = 1, SECONDS) tickSkillTimes, @Schedule(period = 1, MINUTES) tickStateSave
      this.timers = [setInterval(() => this.tickSkillTimes(), 1000), setInterval(() => this.tickStateSave(), 60000)];
      this.onUnload = () => this.onClientShutdown();
      window.addEventListener('beforeunload', this.onUnload);
      this.xpPanel.publish();
    }
    shutDown() {
      rl.overlayManager.removeIf((o) => o instanceof XpInfoBoxOverlay);
      this.xpState.reset();
      this.timers.forEach(clearInterval);
      this.timers = [];
      window.removeEventListener('beforeunload', this.onUnload);
    }
    onGameStateChanged(event) {
      const state = event.getGameState();
      if (state === GameState.LOGGED_IN) {
        // (the 2007 client goes from the login screen straight to logged in: that is RuneLite's LOGGING_IN)
        if (this.prevState === GameState.LOGIN_SCREEN) this.initializeTracker = 2;
        if (client.getAccountHash() !== this.lastAccount) {
          // RuneScapeProfileChanged: save the previous profile's state first
          const save = this.xpState.save();
          if (save && this.lastProfile) this.saveSaveState(this.lastProfile, save);
          this.lastAccount = client.getAccountHash();
          this.resetState();
        }
        this.lastProfile = rl.configManager.getRSProfileKey();
      }
      this.prevState = state;
    }
    onClientShutdown() {
      const save = this.xpState.save();
      const profile = rl.configManager.getRSProfileKey();
      if (save && profile) this.saveSaveState(profile, save);
    }
    addOverlay(skill) {
      this.removeOverlay(skill);
      rl.overlayManager.add(new XpInfoBoxOverlay(this, this.config, skill, rl.SkillIconManager.getSkillImage(skill)));
    }
    removeOverlay(skill) { rl.overlayManager.removeIf((o) => o instanceof XpInfoBoxOverlay && o.getSkill() === skill); }
    hasOverlay(skill) { return rl.overlayManager.overlays.some((o) => o instanceof XpInfoBoxOverlay && o.getSkill() === skill); }
    resetAndInitState() {
      this.clearSaveState(rl.configManager.getRSProfileKey());
      this.resetState();
      for (const skill of Skill.values()) {
        this.xpState.initializeSkill(skill, client.getSkillExperience(skill));
        this.removeOverlay(skill);
      }
      this.xpState.initializeOverall(client.getOverallExperience());
    }
    resetState() {
      this.xpState.reset();
      this.xpPanel.resetAllInfoBoxes();
      this.xpPanel.updateTotal(EMPTY_SNAPSHOT);
      rl.overlayManager.removeIf((o) => o instanceof XpInfoBoxOverlay);
    }
    resetSkillState(skill) {
      this.xpState.initializeSkill(skill, client.getSkillExperience(skill));
      this.xpPanel.resetSkill(skill);
      this.removeOverlay(skill);
    }
    resetOtherSkillState(skill) { for (const s of Skill.values()) if (s !== skill) this.resetSkillState(s); }
    resetSkillPerHourState(skill) { this.xpState.resetSkillPerHour(skill); }
    resetAllSkillsPerHourState() {
      for (const skill of Skill.values()) this.xpState.resetSkillPerHour(skill);
      this.xpState.resetOverallPerHour();
    }
    updateSkillOrderState(skill, newPosition) { this.xpState.setOrder(skill, newPosition); }
    setSkillCompactViewState(skill, compactView) { this.xpState.setCompactView(skill, compactView); }
    onStatChanged(e) {
      const skill = e.getSkill();
      const currentXp = e.getXp();
      const currentLevel = e.getLevel();
      // (no XP goals in 2007: XPDROPS_*_START / _END are OSRS varps)
      const startGoalXp = -1; const endGoalXp = -1;
      if (this.initializeTracker > 0) return;
      if (this.config.hideMaxed() && currentLevel >= Experience.MAX_REAL_LEVEL) {
        this.xpPanel.resetSkill(skill);
        this.removeOverlay(skill);
        this.xpPanel.publish();
        return;
      }
      const result = this.xpState.updateSkill(skill, currentXp, startGoalXp, endGoalXp);
      this.xpPanel.updateSkillExperience(result === 'UPDATED', this.xpPauseState.isPaused(skill), skill, this.xpState.getSkillSnapshot(skill));
      this.xpState.updateOverall(client.getOverallExperience());
      this.xpPanel.updateTotal(this.xpState.getTotalSnapshot());
      this.xpPanel.publish();
    }
    onGameTick() {
      // (the 2007 client may tick once before your stats arrive: wait for them)
      if (this.initializeTracker > 0 && client.getOverallExperience() > 0 && --this.initializeTracker === 0) {
        let save;
        if (!this.xpState.isOverallInitialized() && this.config.saveState() && (save = this.loadSaveState(rl.configManager.getRSProfileKey())) != null) {
          this.xpState.restore(save);
          for (const name of Object.keys(save.skills || {})) {
            const skill = Skill[name];
            if (!skill) continue;
            const x = this.xpState.getSkill(skill);
            x.updateGoals(x.getCurrentXp(), -1, -1);
          }
          for (const name of Object.keys(save.skills || {})) if (Skill[name]) this.xpPanel.updateSkillExperience(true, false, Skill[name], this.xpState.getSkillSnapshot(Skill[name]));
          this.xpPanel.updateTotal(this.xpState.getTotalSnapshot());
        }
        for (const skill of Skill.values()) {
          if (!this.xpState.isInitialized(skill)) continue;
          const st = this.xpState.getSkill(skill);
          const currentXp = client.getSkillExperience(skill);
          if (st.getCurrentXp() !== currentXp) {
            if (currentXp < st.getCurrentXp()) {
              this.resetState();
              this.clearSaveState(rl.configManager.getRSProfileKey());
              break;
            }
            st.setStartXp(st.getStartXp() + (currentXp - st.getCurrentXp()));
          }
        }
        for (const skill of Skill.values()) {
          if (!this.xpState.isInitialized(skill)) this.xpState.updateSkill(skill, client.getSkillExperience(skill), -1, -1);
        }
        if (!this.xpState.isOverallInitialized()) this.xpState.initializeOverall(client.getOverallExperience());
        this.xpPanel.publish();
      }
    }
    onMenuEntryAdded(event) {
      const widgetID = event.getActionParam1();
      if (WidgetUtil.componentToInterface(widgetID) !== STATS || !event.getOption().startsWith('View') || !this.config.skillTabOverlayMenuOptions()) return;
      // eg. "View <col=ff981f>Attack</col> guide"
      const skillText = (event.getOption() + ' ' + event.getTarget()).trim().split(' ')[1];
      let skill;
      try { skill = Skill.valueOf(Text.removeTags(skillText || '').toUpperCase()); } catch { return; }
      client.createMenuEntry(-1)
        .setTarget(skillText)
        .setOption(this.hasOverlay(skill) ? MENUOP_REMOVE_CANVAS_TRACKER : MENUOP_ADD_CANVAS_TRACKER)
        .setType(MenuAction.RUNELITE)
        .onClick(() => { if (this.hasOverlay(skill)) this.removeOverlay(skill); else this.addOverlay(skill); this.xpPanel.publish(); });
    }
    getSkillState(skill) { return this.xpState.getSkill(skill); }
    getSkillSnapshot(skill) { return this.xpState.getSkillSnapshot(skill); }
    tickSkillTimes() {
      const after = this.config.pauseSkillAfter();
      for (const skill of Skill.values()) this.xpPauseState.tickXp(skill, client.getSkillExperience(skill), after);
      this.xpPauseState.tickOverall(client.getOverallExperience(), after);
      const loggedIn = client.getGameState() === GameState.LOGGED_IN;
      this.xpPauseState.tickLogout(this.config.pauseOnLogout(), loggedIn);
      if (this.lastTickMillis === 0) { this.lastTickMillis = Date.now(); return; }
      const now = Date.now();
      const delta = now - this.lastTickMillis;
      this.lastTickMillis = now;
      for (const skill of Skill.values()) if (!this.xpPauseState.isPaused(skill)) this.xpState.tick(skill, delta);
      if (!this.xpPauseState.isOverallPaused()) this.xpState.tickOverall(delta);
      this.rebuildSkills();
    }
    tickStateSave() {
      const save = this.xpState.save();
      const profile = rl.configManager.getRSProfileKey();
      if (save && profile) this.saveSaveState(profile, save);
    }
    rebuildSkills() {
      for (const skill of Skill.values()) this.xpPanel.updateSkillExperience(false, this.xpPauseState.isPaused(skill), skill, this.xpState.getSkillSnapshot(skill));
      this.xpPanel.updateTotal(this.xpState.getTotalSnapshot());
      this.xpPanel.publish();
    }
    pauseSkill(skill, pause) {
      if (pause ? this.xpPauseState.pauseSkill(skill) : this.xpPauseState.unpauseSkill(skill)) {
        this.xpPanel.updateSkillExperience(false, this.xpPauseState.isPaused(skill), skill, this.xpState.getSkillSnapshot(skill));
      }
    }
    pauseAllSkills(pause) {
      for (const skill of Skill.values()) this.pauseSkill(skill, pause);
      if (pause) this.xpPauseState.pauseOverall(); else this.xpPauseState.unpauseOverall();
    }
    saveSaveState(profile, state) { rl.configManager.setConfiguration('xpTracker', profile, 'state', JSON.stringify(state)); }
    clearSaveState(profile) { if (profile) rl.configManager.unsetConfiguration('xpTracker', profile, 'state'); }
    loadSaveState(profile) {
      if (!profile) return null;
      const s = rl.configManager.getConfiguration('xpTracker', profile, 'state');
      try { return s ? JSON.parse(s) : null; } catch { return null; }
    }
    /** XpPanel's and XpInfoBox's menu items, the click to compact a box and the drag to reorder, from the sidebar */
    onPanelAction(a) {
      const skill = a.skill ? Skill[a.skill] : null;
      switch (a.action) {
        case 'resetAll': this.resetAndInitState(); break;
        case 'resetAllPerHour': this.resetAllSkillsPerHourState(); break;
        case 'pauseAll': this.pauseAllSkills(true); break;
        case 'unpauseAll': this.pauseAllSkills(false); break;
        case 'reset': if (skill) this.resetSkillState(skill); break;
        case 'resetOthers': if (skill) this.resetOtherSkillState(skill); break;
        case 'resetPerHour': if (skill) this.resetSkillPerHourState(skill); break;
        case 'pause': if (skill) { const box = this.xpPanel.infoBoxes.get(skill); this.pauseSkill(skill, !box.paused); } break;
        case 'canvas': if (skill) { if (this.hasOverlay(skill)) this.removeOverlay(skill); else this.addOverlay(skill); } break;
        case 'compact': if (skill) this.setSkillCompactViewState(skill, this.xpPanel.infoBoxes.get(skill).toggleCompactView()); break;
        case 'reorder': {
          if (!skill) break;
          const box = this.xpPanel.infoBoxes.get(skill);
          const pos = Math.max(0, Math.min(this.xpPanel.shown.length - 1, a.position | 0));
          this.xpPanel.remove(box);
          this.xpPanel.shown.splice(pos, 0, box);
          this.updateSkillOrderState(skill, pos);
          break;
        }
        default: return;
      }
      this.xpPanel.publish();
    }
  }
  // new XpSnapshotSingle.XpSnapshotSingleBuilder().build(): every field zero
  const EMPTY_SNAPSHOT = { startLevel: 0, endLevel: 0, startGoalXp: 0, endGoalXp: 0, xpGainedInSession: 0, xpRemainingToGoal: 0, xpPerHour: 0,
    skillProgressToGoal: 0, actionsInSession: 0, actionsRemainingToGoal: 0, actionsPerHour: 0, timeTillGoal: null, timeTillGoalHours: null, timeTillGoalShort: null, compactView: false };

  rl.registerPlugin('xptracker', new XpTrackerPlugin());
})();
