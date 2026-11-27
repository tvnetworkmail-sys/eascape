'use strict';
// RuneLite's XP Globes plugin (net.runelite.client.plugins.xpglobes), cloned 1:1.
module.exports = {
  id: 'xpglobes',
  name: 'XP Globes',
  description: 'Show XP globes for the respective skill when gaining XP',
  tags: ['experience', 'levels', 'overlay'],
  enabledByDefault: false,
  game: './xpglobes/game.js',
  page: './xpglobes/page.js',
  config: {
    group: 'xpglobes',
    sections: [],
    items: [
      { key: 'enableTooltips', name: 'Enable tooltips', description: 'Configures whether or not to show tooltips.', type: 'boolean', default: true, position: 0 },
      { key: 'showXpLeft', name: 'Show XP left', description: 'Shows XP left inside the globe tooltip box.', type: 'boolean', default: true, position: 1 },
      { key: 'showActionsLeft', name: 'Show actions left', description: 'Shows the number of actions left inside the globe tooltip box.', type: 'boolean', default: true, position: 2 },
      { key: 'showXpHour', name: 'Show XP/hr', description: 'Shows XP per hour inside the globe tooltip box.', type: 'boolean', default: true, position: 3 },
      { key: 'showTimeTilGoal', name: 'Show time til goal', description: 'Shows the amount of time until goal level in the globe tooltip box.', type: 'boolean', default: true, position: 4 },
      { key: 'hideMaxed', name: 'Hide maxed skills', description: 'Stop globes from showing up for level 99 skills.', type: 'boolean', default: false, position: 14 },
      { key: 'showVirtualLevel', name: 'Show virtual level', description: "Shows virtual level if over 99 in a skill and 'Hide maxed skills' is not checked.", type: 'boolean', default: false, position: 15 },
      { key: 'enableCustomArcColor', name: 'Enable custom arc color', description: "Enables the custom coloring of the globe's arc instead of using the skill's default color.", type: 'boolean', default: false, position: 16 },
      { key: 'Progress arc color', method: 'progressArcColor', name: 'Progress arc color', description: 'Change the color of the progress arc in the XP orb.', type: 'color', alpha: true, default: '#FFFFC800', position: 17 },
      { key: 'Progress orb outline color', method: 'progressOrbOutLineColor', name: 'Progress orb outline color', description: 'Change the color of the progress orb outline.', type: 'color', alpha: true, default: '#FF000000', position: 18 },
      { key: 'Progress orb background color', method: 'progressOrbBackgroundColor', name: 'Progress orb background color', description: 'Change the color of the progress orb background.', type: 'color', alpha: true, default: '#7F808080', position: 19 },
      { key: 'Progress arc width', method: 'progressArcStrokeWidth', name: 'Progress arc width', description: 'Change the stroke width of the progress arc.', type: 'int', default: 2, unit: 'px', position: 20 },
      { key: 'Orb size', method: 'xpOrbSize', name: 'Size of orbs', description: 'Change the size of the XP orbs.', type: 'int', default: 40, unit: 'px', position: 21 },
      { key: 'Orb duration', method: 'xpOrbDuration', name: 'Duration of orbs', description: 'Change the duration the XP orbs are visible.', type: 'int', default: 10, unit: 's', position: 22 },
      { key: 'alignOrbsVertically', name: 'Vertical orbs', description: 'Aligns the orbs vertically instead of horizontally.', type: 'boolean', default: false, hidden: true },
    ],
  },
};
