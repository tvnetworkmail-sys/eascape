// RuneLite's Virtual Levels plugin, cloned from net.runelite.client.plugins.virtuallevels (BSD 2-Clause, Copyright (c)
// 2018, Joshua Filby <joshua@filby.me> and RuneLite contributors): VirtualLevelsPlugin, VirtualLevelsConfig.
// RuneLite answers the skill tab scripts' skillTabBaseLevel / skillTabTotalLevel callbacks. The 2007 skill tab (320) is
// if1: each base level is a text component whose cs1 script is stat_base_level (opcode 2) and the total one "Total
// Lvl: %1" with opcode 9, so the same values are written into those components (display-only setText, again after
// each 3D view as the client refreshes them) and the originals are put back when it's off. skillTabMaxLevel (the
// OSRS tooltip's level cap) has no 2007 counterpart.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Skill, Experience, GameState } = rl;
  const GROUP = 'virtuallevels';
  const SKILLS_GROUP = 320;
  const OP_STAT_BASE_LEVEL = 2;
  const OP_TOTAL_LEVEL = 9;

  class VirtualLevelsPlugin {
    constructor() { this.configGroup = GROUP; this.originals = new Map(); this.hook = () => this.update(); }
    startUp() {
      this.config = rl.configProxy(GROUP, () => this.configItems);
      rl.viewDrawnHooks.push(this.hook);
    }
    shutDown() {
      const i = rl.viewDrawnHooks.indexOf(this.hook);
      if (i >= 0) rl.viewDrawnHooks.splice(i, 1);
      this.simulateSkillChange();
    }
    onConfigChanged(e) {
      if (e.getGroup() !== GROUP) return;
      this.simulateSkillChange();
    }
    /** the skill tab's base-level and total components: [packed id, cs1 opcode, skill index] */
    components() {
      if (this.coms) return this.coms;
      const list = ll.api && ll.api.comsOf ? ll.api.comsOf(SKILLS_GROUP) || [] : [];
      const out = [];
      for (const c of list) {
        if (!c || c.type !== 4 || !c.scripts || !c.scripts[0]) continue;
        const op = c.scripts[0][0];
        if (op === OP_STAT_BASE_LEVEL || op === OP_TOTAL_LEVEL) out.push([c.id, op, c.scripts[0][1] | 0, c.text]);
      }
      if (out.length) this.coms = out;
      return out;
    }
    update() {
      if (client.getGameState() !== GameState.LOGGED_IN) return;
      if (ll.api && ll.api.ifOpen && !ll.api.ifOpen(SKILLS_GROUP)) return;
      const skills = Skill.values();
      for (const [id, op, skillId, text] of this.components()) {
        const w = client.getWidget(id);
        if (w == null) continue;
        if (!this.originals.has(id)) this.originals.set(id, text);
        let value;
        if (op === OP_STAT_BASE_LEVEL) {
          // case "skillTabBaseLevel"
          const skill = skills[skillId];
          if (!skill) continue;
          value = String(Experience.getLevelForXp(client.getSkillExperience(skill)));
        } else {
          // case "skillTabTotalLevel"
          if (!this.config.virtualTotalLevel()) { this.restore(id); continue; }
          let level = 0;
          for (const s of skills) level += Experience.getLevelForXp(client.getSkillExperience(s));
          value = String(this.originals.get(id) || '%1').replace('%1', String(level));
        }
        if (w.getText() !== value) w.setText(value);
      }
    }
    restore(id) {
      if (!this.originals.has(id)) return;
      const w = client.getWidget(id);
      if (w) w.setText(this.originals.get(id));
      this.originals.delete(id);
    }
    /** simulateSkillChange: the skill tab shows the client's own values again (and the hook rewrites them if on) */
    simulateSkillChange() { for (const id of [...this.originals.keys()]) this.restore(id); }
  }

  const plugin = new VirtualLevelsPlugin();
  ll.__virtuallevels = { plugin };
  rl.registerPlugin(GROUP, plugin);
})();
