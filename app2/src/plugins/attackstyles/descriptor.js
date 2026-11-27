'use strict';
// RuneLite's Attack Styles plugin (net.runelite.client.plugins.attackstyles), cloned 1:1: AttackStylesConfig.
// Trimmed for Sept 2007: the weapon type is the open 2007 combat tab (a tab per weapon type, rl.CombatInterface)
// with the server's style list for it; no defensive casting (the staff casts as style 4 while autocasting).
module.exports = {
  id: 'attackstyles',
  name: 'Attack Styles',
  description: 'Show your current attack style as an overlay',
  tags: ['combat', 'defence', 'magic', 'overlay', 'ranged', 'strength', 'warn', 'pure'],
  enabledByDefault: false,
  game: './attackstyles/game.js',
  page: './attackstyles/page.js',
  config: {
    group: 'attackIndicator',
    sections: [],
    items: [
      { key: 'alwaysShowStyle', name: 'Always show style', description: 'Show attack style indicator at all times.', type: 'boolean', default: true, position: 1 },
      { key: 'warnForDefensive', method: 'warnForDefence', name: 'Warn for defence', description: 'Show warning when a defence skill combat option is selected.', type: 'boolean', default: false, position: 2 },
      { key: 'warnForAttack', name: 'Warn for attack', description: 'Show warning when an attack skill combat option is selected.', type: 'boolean', default: false, position: 3 },
      { key: 'warnForStrength', name: 'Warn for strength', description: 'Show warning when a strength skill combat option is selected.', type: 'boolean', default: false, position: 4 },
      { key: 'warnForRanged', name: 'Warn for ranged', description: 'Show warning when a ranged skill combat option is selected.', type: 'boolean', default: false, position: 5 },
      { key: 'warnForMagic', name: 'Warn for magic', description: 'Show warning when a magic skill combat option is selected.', type: 'boolean', default: false, position: 6 },
      { key: 'hideAutoRetaliate', name: 'Hide auto retaliate', description: 'Hide auto retaliate from the combat options tab.', type: 'boolean', default: false, position: 7 },
      { key: 'removeWarnedStyles', name: 'Remove warned styles', description: 'Remove warned styles from the combat options tab.', type: 'boolean', default: false, position: 8 },
      { key: 'showChatWarnings', name: 'Show chat warnings', description: 'Show chat warnings about switching to an unwanted attack style.', type: 'boolean', default: true, position: 9 },
      { key: 'warningNotification', name: 'Warning notification', description: 'Notification for switching to an unwanted attack style.', type: 'notification', default: false, position: 10 },
    ],
  },
};
