'use strict';
// RuneLite's Blast Furnace plugin (net.runelite.client.plugins.blastfurnace), cloned 1:1: BlastFurnaceConfig.
// Blast Furnace came in Mar 2005; our server doesn't have it yet, so this is ready for when it's built.
// Trimmed for Sept 2007: no lead / nickel ores or cupronickel bars (2025), no smiths' uniform ice gloves (2021).
module.exports = {
  id: 'blastfurnace',
  name: 'Blast Furnace',
  description: 'Show helpful information for the Blast Furnace minigame',
  tags: ['minigame', 'overlay', 'skilling', 'smithing'],
  enabledByDefault: true,
  game: './blastfurnace/game.js',
  page: './blastfurnace/page.js',
  config: {
    group: 'blastfurnace',
    sections: [],
    items: [
      { key: 'showConveyorBelt', name: 'Show conveyor belt clickbox', description: 'Configures whether or not the clickbox for the conveyor belt is displayed.', type: 'boolean', default: false, position: 1 },
      { key: 'showBarDispenser', name: 'Show bar dispenser clickbox', description: 'Configures whether or not the clickbox for the bar dispenser is displayed.', type: 'boolean', default: false, position: 2 },
      { key: 'showCofferTime', name: 'Show coffer time remaining', description: 'Configures whether or not the coffer time remaining is displayed.', type: 'boolean', default: true, position: 3 },
    ],
  },
};
