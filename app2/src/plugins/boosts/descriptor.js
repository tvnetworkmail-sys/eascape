'use strict';
// RuneLite's Boosts Information plugin (net.runelite.client.plugins.boosts), cloned 1:1: BoostsConfig.
// Trimmed for Sept 2007: no Sailing; no Preserve prayer (2017), so the buff timer is always 100/125 ticks.
const DISPLAY_CHANGE = [{ value: 'ALWAYS', label: 'Always' }, { value: 'BOOSTED', label: 'Boosted' }, { value: 'NEVER', label: 'Never' }];
module.exports = {
  id: 'boosts',
  name: 'Boosts Information',
  description: 'Show combat and/or skill boost information',
  tags: ['combat', 'notifications', 'skilling', 'overlay'],
  enabledByDefault: true,
  game: './boosts/game.js',
  page: './boosts/page.js',
  resources: ['buffed.png', 'debuffed.png', 'buffedsmall.png', 'debuffedsmall.png'],
  config: {
    group: 'boosts',
    sections: [],
    items: [
      { key: 'displayBoosts', name: 'Display boosts', description: 'Configures which skill boosts to display.', type: 'enum', default: 'COMBAT', options: [{ value: 'NONE', label: 'None' }, { value: 'COMBAT', label: 'Combat' }, { value: 'NON_COMBAT', label: 'Non Combat' }, { value: 'BOTH', label: 'Both' }], position: 1 },
      { key: 'relativeBoost', method: 'useRelativeBoost', name: 'Show relative boosts', description: 'Configures whether or not relative boost is used.', type: 'boolean', default: false, position: 2 },
      { key: 'displayIndicators', method: 'displayInfoboxes', name: 'Display infoboxes', description: 'Configures whether to display boost infoboxes.', type: 'boolean', default: true, position: 3 },
      { key: 'displayPanel', name: 'Display panel', description: 'Configures whether to display the boost panel.', type: 'boolean', default: false, position: 3 },
      { key: 'compactDisplay', name: 'Compact display', description: 'Displays skill boosts in a more compact panel.', type: 'boolean', default: false, position: 4 },
      { key: 'displayNextBuffChange', name: 'Next buff change', description: 'Configures whether or not to display when the next buffed stat change will be.', type: 'enum', default: 'BOOSTED', options: DISPLAY_CHANGE, position: 10 },
      { key: 'displayNextDebuffChange', name: 'Next debuff change', description: 'Configures whether or not to display when the next debuffed stat change will be.', type: 'enum', default: 'NEVER', options: DISPLAY_CHANGE, position: 11 },
      { key: 'boostThreshold', name: 'Boost threshold', description: 'Number of levels above your base level at which boosted levels will be displayed in a different color.', type: 'int', default: 0, position: 12 },
      { key: 'notifyOnBoost', name: 'Notify on boost threshold', description: 'Configures whether or not a notification will be sent when boosted stats drain to the boost threshold.', type: 'notification', default: false, position: 13 },
    ],
  },
};
