'use strict';
// Port of RuneLite's XP Tracker: a sidebar panel with, for each skill you train, the XP
// gained, XP an hour, XP and actions left to the next level, and a progress bar; plus the
// total. Saved per account on this PC until you reset it (right-click a box).
module.exports = {
  id: 'xptracker',
  name: 'XP Tracker',
  description: 'Enable XP tracking in the sidebar',
  tags: ['xp', 'experience', 'tracker', 'skill', 'hour', 'rate', 'level', 'exp'],
  enabledByDefault: true,
  config: {
    group: 'xptracker',
    sections: [],
    items: [
      { key: 'pauseOnLogout', name: 'Pause on logout', description: 'Only count the time you are logged in for XP an hour', type: 'boolean', default: true, position: 0 },
      { key: 'resetAfter', name: 'Auto reset after', description: 'Reset a skill after this many minutes without XP in it (0 = never)', type: 'int', default: 0, min: 0, max: 1440, position: 1 },
      { key: 'hideMaxed', name: 'Hide maxed skills', description: 'Stop showing skills at level 99', type: 'boolean', default: false, position: 2 },
    ],
  },
};
