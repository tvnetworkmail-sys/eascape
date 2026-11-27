'use strict';
// RuneLite's Status Bars plugin (net.runelite.client.plugins.statusbars), cloned 1:1 (era-trimmed: no Warmth bar).
const MODES = [{ value: 'DISABLED', label: 'Disabled' }, { value: 'HITPOINTS', label: 'Hitpoints' }, { value: 'PRAYER', label: 'Prayer' },
  { value: 'RUN_ENERGY', label: 'Run energy' }, { value: 'SPECIAL_ATTACK', label: 'Special attack' }];
module.exports = {
  id: 'statusbars',
  name: 'Status Bars',
  description: 'Draws status bars next to players inventory showing current HP & Prayer and healing amounts',
  tags: [],
  enabledByDefault: false,
  game: './statusbars/game.js',
  page: './statusbars/page.js',
  config: {
    group: 'statusbars',
    sections: [],
    items: [
      { key: 'enableCounter', name: 'Show counters', description: 'Shows current value of the status on the bar.', type: 'boolean', default: false },
      { key: 'enableSkillIcon', name: 'Show icons', description: 'Adds skill icons at the top of the bars.', type: 'boolean', default: true },
      { key: 'enableRestorationBars', name: 'Show restores', description: 'Visually shows how much will be restored to your status bar.', type: 'boolean', default: true },
      { key: 'leftBarMode', name: 'Left bar', description: 'Configures the left status bar.', type: 'enum', default: 'HITPOINTS', options: MODES },
      { key: 'rightBarMode', name: 'Right bar', description: 'Configures the right status bar.', type: 'enum', default: 'PRAYER', options: MODES },
      { key: 'hideAfterCombatDelay', name: 'Hide after combat delay', description: 'Amount of ticks before hiding status bars after no longer in combat. 0 = always show status bars.', type: 'int', default: 0, unit: ' ticks' },
      { key: 'barWidth', name: 'Bar width', description: 'The width of the status bars in the modern resizeable layout.', type: 'int', default: 20, min: 3, max: 40 },
    ],
  },
};
