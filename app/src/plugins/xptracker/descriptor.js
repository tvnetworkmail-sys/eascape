'use strict';
// EASCape's XP Tracker: RuneLite's XP Tracker plugin (BSD 2-Clause, Copyright (c) 2017-2018,
// Cameron <moberg@tuta.io>, Adam <Adam@sigterm.info> and RuneLite contributors) for the 2006
// game's 21 skills. The tracking runs in game.js (RuneLite's XpStateSingle / XpPauseState),
// the sidebar panel is ui/panels/xptracker.js (XpPanel / XpInfoBox) and the on-screen boxes
// are page.js (XpInfoBoxOverlay). Names, wording and defaults are RuneLite's XpTrackerConfig.
// Left out: the Wise Old Man links (an OSRS website) and the level markers and goals, which
// come from OSRS's in-game XP goals (2006 has none, so the goal is always the next level).

// RuneLite's XpPanelLabel
const LABELS = [
  { value: 'TIME_TO_LEVEL', label: 'TTL' },
  { value: 'XP_GAINED', label: 'XP Gained' },
  { value: 'XP_HOUR', label: 'XP/hr' },
  { value: 'XP_LEFT', label: 'XP Left' },
  { value: 'ACTIONS_LEFT', label: 'Actions' },
  { value: 'ACTIONS_HOUR', label: 'Actions/hr' },
  { value: 'ACTIONS_DONE', label: 'Actions Done' },
];
// RuneLite's XpProgressBarLabel
const BAR_LABELS = [
  { value: 'PERCENTAGE', label: 'Percentage' },
  { value: 'TIME_TO_LEVEL', label: 'Time to level' },
  { value: 'HOURS_TO_LEVEL', label: 'Hours to level' },
];

module.exports = {
  id: 'xptracker',
  name: 'XP Tracker',
  description: 'Enable XP tracking in the sidebar',
  tags: ['xp', 'experience', 'tracker', 'skill', 'hour', 'rate', 'level', 'exp'],
  enabledByDefault: true,
  game: './xptracker/game.js',
  page: './xptracker/page.js',
  LABELS,
  BAR_LABELS,
  config: {
    group: 'xptracker',
    sections: [
      { key: 'overlay', name: 'Overlay', position: 99 },
    ],
    items: [
      { key: 'saveState', name: 'Save between sessions', description: 'Saves xp trackers between sessions.', type: 'boolean', default: true, position: -1 },
      { key: 'hideMaxed', name: 'Hide maxed skills', description: 'XP tracker will no longer track level 99 skills.', type: 'boolean', default: false, position: 0 },
      { key: 'pauseOnLogout', name: 'Pause on logout', description: 'Configures whether skills should pause on logout.', type: 'boolean', default: true, position: 1 },
      { key: 'pauseSkillAfter', name: 'Auto pause after', description: "Configures how many minutes passes before pausing a skill while in game and there's no XP, 0 means disabled.", type: 'int', default: 0, min: 0, max: 1440, unit: ' mins', position: 3 },
      { key: 'resetSkillRateAfter', name: 'Auto reset after', description: "Configures how many minutes passes before resetting a skill's per hour rates while in game and there's no XP, 0 means disabled.", type: 'int', default: 0, min: 0, max: 1440, unit: ' mins', position: 4 },
      { key: 'onScreenDisplayMode', name: 'On-screen tracker display mode (top)', description: 'Configures the information displayed in the first line of on-screen XP overlays.', type: 'enum', default: 'XP_GAINED', options: LABELS, section: 'overlay', position: 6 },
      { key: 'onScreenDisplayModeBottom', name: 'On-screen tracker display mode (bottom)', description: 'Configures the information displayed in the second line of on-screen XP overlays.', type: 'enum', default: 'XP_HOUR', options: LABELS, section: 'overlay', position: 7 },
      { key: 'xpPanelLabel1', name: 'Top-left XP info label', description: 'Configures the information displayed in the top-left of XP info box.', type: 'enum', default: 'XP_GAINED', options: LABELS, position: 8 },
      { key: 'xpPanelLabel2', name: 'Top-right XP info label', description: 'Configures the information displayed in the top-right of XP info box.', type: 'enum', default: 'XP_LEFT', options: LABELS, position: 9 },
      { key: 'xpPanelLabel3', name: 'Bottom-left XP info label', description: 'Configures the information displayed in the bottom-left of XP info box.', type: 'enum', default: 'XP_HOUR', options: LABELS, position: 10 },
      { key: 'xpPanelLabel4', name: 'Bottom-right XP info label', description: 'Configures the information displayed in the bottom-right of XP info box.', type: 'enum', default: 'ACTIONS_LEFT', options: LABELS, position: 11 },
      { key: 'progressBarLabel', name: 'Progress bar label', description: 'Configures the info box progress bar to show time to goal or percentage complete.', type: 'enum', default: 'PERCENTAGE', options: BAR_LABELS, position: 12 },
      { key: 'progressBarTooltipLabel', name: 'Tooltip label', description: 'Configures the info box progress bar tooltip to show time to goal or percentage complete.', type: 'enum', default: 'TIME_TO_LEVEL', options: BAR_LABELS, position: 13 },
      { key: 'prioritizeRecentXpSkills', name: 'Move recently trained skills to top', description: 'Configures whether skills should be organized by most recently gained XP.', type: 'boolean', default: false, position: 14 },
    ],
  },
};
