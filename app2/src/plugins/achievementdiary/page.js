// RuneLite's Diary Requirements plugin, cloned from net.runelite.client.plugins.achievementdiary (BSD 2-Clause,
// Copyright (c) 2018, Marshall <https://github.com/marshdevs> and RuneLite contributors): DiaryRequirementsPlugin,
// Requirement, SkillRequirement, QuestRequirement, QuestPointRequirement, CombatLevelRequirement, OrRequirement,
// DiaryRequirement, GenericDiaryRequirement. InterfaceID.JOURNALSCROLL is the 2007 quest journal (275): TITLE its
// heading (275:2), TEXTLAYER its scroll layer (275:1, lines 275:4 .. 275:173). The diaries are our server's 2007 Karamja
// and Varrock ones (diaries.js). The 2007 journal's scroll is a fixed 170 lines, so ScriptID.DIARY_UPDATE_LINECOUNT
// has nothing to update. A struck task line starts with its colour tags before <str> (2007's journal colours every line).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Skill, Text, Quest, QuestState, VarPlayerID } = rl;

  const JOURNALSCROLL = 275;
  const TITLE = (275 << 16) | 2;
  const TEXTLAYER = (275 << 16) | 1;
  const AND_JOINER = ', ';
  const AND_JOINER_PATTERN = /(?<=, )/;
  const STRUCK = /^(<col=[0-9a-fA-F]+>)*<str>/;

  class SkillRequirement {
    constructor(skill, level) { this.skill = skill; this.level = level; }
    toString() { return this.level + ' ' + this.skill.getName(); }
    satisfiesRequirement(c) { return c.getRealSkillLevel(this.skill) >= this.level; }
  }
  class QuestRequirement {
    constructor(quest, started = false) { this.quest = quest; this.started = started; }
    toString() { return this.started ? 'Started ' + this.quest.getName() : this.quest.getName(); }
    satisfiesRequirement(c) {
      const questState = this.quest.getState(c);
      if (this.started) return questState !== QuestState.NOT_STARTED;
      return questState === QuestState.FINISHED;
    }
  }
  class QuestPointRequirement {
    constructor(qp) { this.qp = qp; }
    toString() { return this.qp + ' ' + 'Quest points'; }
    satisfiesRequirement(c) { return c.getVarpValue(VarPlayerID.QP) >= this.qp; }
  }
  class CombatLevelRequirement {
    constructor(level) { this.level = level; }
    toString() { return this.level + ' ' + 'Combat'; }
    satisfiesRequirement(c) { return c.getLocalPlayer() != null && c.getLocalPlayer().getCombatLevel() >= this.level; }
  }
  class OrRequirement {
    constructor(...reqs) { this.requirements = reqs; }
    getRequirements() { return this.requirements; }
    toString() { return this.requirements.join(' or '); }
    satisfiesRequirement(c) { for (const r of this.getRequirements()) if (r.satisfiesRequirement(c)) return true; return false; }
  }
  class DiaryRequirement {
    constructor(task, requirements) { this.task = task; this.requirements = requirements.slice(); }
    getTask() { return this.task; }
    getRequirements() { return this.requirements; }
  }
  class GenericDiaryRequirement {
    constructor() { this.requirements = new Set(); }
    getRequirements() { return this.requirements; }
    add(task, ...requirements) { this.requirements.add(new DiaryRequirement(task, requirements)); }
  }
  // the generated diaries/*DiaryRequirement classes (diaries.js)
  const toRequirement = (r) => (r.or ? new OrRequirement(...r.or.map(toRequirement))
    : r.skill ? new SkillRequirement(Skill[r.skill], r.level)
      : r.quest ? new QuestRequirement(Quest[r.quest])
        : r.started ? new QuestRequirement(Quest[r.started], true)
          : r.qp ? new QuestPointRequirement(r.qp) : new CombatLevelRequirement(r.combat));
  const diaryClass = (title) => class extends GenericDiaryRequirement {
    constructor() { super(); for (const [task, reqs] of (ll.__diaryRequirements || {})[title] || []) this.add(task, ...reqs.map(toRequirement)); }
  };
  const KaramjaDiaryRequirement = diaryClass('KARAMJA_AREA_TASKS');
  const VarrockDiaryRequirement = diaryClass('VARROCK_AREA_TASKS');

  class DiaryRequirementsPlugin {
    startUp() {}
    shutDown() {}
    onWidgetLoaded(event) {
      if (event.getGroupId() === JOURNALSCROLL) {
        const widgetTitle = Text.removeTags(client.getWidget(TITLE).getText()).replace(/ /g, '_').toUpperCase();
        if (widgetTitle.startsWith('ACHIEVEMENT_DIARY')) this.showDiaryRequirements();
      }
    }
    showDiaryRequirements() {
      const widget = client.getWidget(TEXTLAYER);
      const children = widget.getStaticChildren();
      const titleWidget = children[0];
      if (titleWidget == null) return;
      const font = titleWidget.getFont();
      const maxWidth = titleWidget.getWidth();
      const originalAchievements = this.getOriginalAchievements(children);
      // new requirements starts out as a copy of the original
      const newRequirements = originalAchievements.slice();
      const requirements = this.getRequirementsForTitle(titleWidget.getText());
      if (requirements == null) return;
      const skillRequirements = this.buildRequirements(requirements.getRequirements());
      if (skillRequirements == null) return;
      let offset = 0;
      let taskBuffer = '';
      for (let i = 0; i < originalAchievements.length; i++) {
        const rowText = Text.removeTags(originalAchievements[i]);
        if (skillRequirements.get(taskBuffer + ' ' + rowText) != null) taskBuffer = taskBuffer + ' ' + rowText;
        else taskBuffer = rowText;
        if (skillRequirements.get(taskBuffer) != null) {
          const levelRequirement = skillRequirements.get(taskBuffer);
          const task = originalAchievements[i];
          const taskWidth = font.getTextWidth(task);
          const ourWidth = font.getTextWidth(levelRequirement);
          const strike = STRUCK.test(task) ? '<str>' : '';
          if (ourWidth + taskWidth < maxWidth) {
            // Merge onto 1 line
            newRequirements[i + offset] = task + levelRequirement;
          } else if (ourWidth < maxWidth) {
            // 2 line split
            newRequirements.splice(i + (++offset), 0, strike + levelRequirement);
          } else {
            // Full text layout
            let b = task;
            let runningWidth = font.getTextWidth(b);
            for (const word of levelRequirement.split(AND_JOINER_PATTERN)) {
              const wordWidth = font.getTextWidth(word);
              if (runningWidth === 0 || wordWidth + runningWidth < maxWidth) {
                runningWidth += wordWidth;
                b += word;
              } else {
                newRequirements.splice(i + (offset++), 0, b);
                runningWidth = wordWidth;
                b = strike + word;
              }
            }
            newRequirements[i + offset] = b;
          }
        }
      }
      let lastLine = 0;
      for (let i = 0; i < newRequirements.length && i < children.length; i++) {
        const achievementWidget = children[i];
        const text = newRequirements[i];
        achievementWidget.setText(text);
        if (text != null && text !== '') lastLine = i;
      }
      // (client.runScript(DIARY_UPDATE_LINECOUNT, 1, lastLine): the 2007 journal's scroll is fixed)
      this.lastLine = lastLine;
    }
    getOriginalAchievements(children) { return children.map((requirementWidget) => requirementWidget.getText()); }
    getRequirementsForTitle(title) {
      const diaryName = Text.removeTags(title.replace(/ /g, '_').toUpperCase());
      switch (diaryName) {
        case 'KARAMJA_AREA_TASKS': return new KaramjaDiaryRequirement();
        case 'VARROCK_AREA_TASKS': return new VarrockDiaryRequirement();
        default: return null;
      }
    }
    // returns a map of task -> level requirements
    buildRequirements(requirements) {
      const reqs = new Map();
      for (const req of requirements) {
        let b = '<col=ffffff>(';
        for (const ireq of req.getRequirements()) {
          const satifisfied = ireq.satisfiesRequirement(client);
          b += satifisfied ? '<col=000080><str>' : '<col=800000>';
          b += ireq.toString();
          b += satifisfied ? '</str>' : '<col=000080>';
          b += AND_JOINER;
        }
        b = b.substring(0, b.length - AND_JOINER.length);
        b += '<col=ffffff>)';
        reqs.set(req.getTask(), b);
      }
      return reqs;
    }
  }

  const plugin = new DiaryRequirementsPlugin();
  ll.__achievementdiary = { plugin, SkillRequirement, QuestRequirement, QuestPointRequirement, CombatLevelRequirement, OrRequirement };
  rl.registerPlugin('achievementdiary', plugin);
})();
