'use strict';
// RuneLite's XP Tracker plugin (net.runelite.client.plugins.xptracker), cloned 1:1: XpTrackerConfig.
// Left out: "Wise Old Man option" (links to wiseoldman.net, an OSRS hiscores site that doesn't track this game) and
// the online XP updater (XpClient, see xpupdater: skip-tech). The 2007 game has no in-game XP goals, so the goal
// is always the next level (as RuneLite does when no goal is set).
const LABELS = [
  { value: 'TIME_TO_LEVEL', label: 'TTL' }, { value: 'XP_GAINED', label: 'XP Gained' }, { value: 'XP_HOUR', label: 'XP/hr' },
  { value: 'XP_LEFT', label: 'XP Left' }, { value: 'ACTIONS_LEFT', label: 'Actions' }, { value: 'ACTIONS_HOUR', label: 'Actions/hr' },
  { value: 'ACTIONS_DONE', label: 'Actions Done' },
];
const BAR_LABELS = [{ value: 'PERCENTAGE', label: 'Percentage' }, { value: 'TIME_TO_LEVEL', label: 'Time to level' }, { value: 'HOURS_TO_LEVEL', label: 'Hours to level' }];
module.exports = {
  id: 'xptracker',
  name: 'XP Tracker',
  description: 'Enable the XP Tracker panel',
  tags: ['experience', 'levels', 'panel'],
  enabledByDefault: true,
  game: './xptracker/game.js',
  page: './xptracker/page.js',
  config: {
    group: 'xpTracker',
    sections: [{ key: 'overlay', name: 'Overlay', description: 'Canvas overlay options.', position: 99 }],
    items: [
      { key: 'saveState', name: 'Save between sessions', description: 'Saves xp trackers between sessions.', type: 'boolean', default: true, position: -1 },
      { key: 'hideMaxed', name: 'Hide maxed skills', description: 'XP tracker will no longer track level 99 skills.', type: 'boolean', default: false, position: 0 },
      { key: 'logoutPausing', method: 'pauseOnLogout', name: 'Pause on logout', description: 'Configures whether skills should pause on logout.', type: 'boolean', default: true, position: 1 },
      { key: 'intermediateLevelMarkers', method: 'showIntermediateLevels', name: 'Show intermediate level markers', description: 'Marks intermediate levels on the progress bar.', type: 'boolean', default: false, position: 2 },
      { key: 'pauseSkillAfter', name: 'Auto pause after', description: "Configures how many minutes passes before pausing a skill while in game and there's no XP, 0 means disabled.", type: 'int', default: 0, unit: ' mins', position: 3 },
      { key: 'resetSkillRateAfter', name: 'Auto reset after', description: "Configures how many minutes passes before resetting a skill's per hour rates while in game and there's no XP, 0 means disabled.", type: 'int', default: 0, unit: ' mins', position: 4 },
      { key: 'skillTabOverlayMenuOptions', name: 'Add skill tab canvas menu option', description: 'Configures whether a menu option to show/hide canvas XP trackers will be added to skills on the skill tab.', type: 'boolean', default: true, section: 'overlay', position: 5 },
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
