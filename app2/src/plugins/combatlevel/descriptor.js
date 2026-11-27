'use strict';
// RuneLite's Combat Level plugin (net.runelite.client.plugins.combatlevel), cloned 1:1: CombatLevelConfig.
// Trimmed for Sept 2007: no Character Summary tab (2021), so the precise level goes only into the combat tab's
// "Combat Lvl:" text (the tab of the wielded weapon's type, rl.CombatInterface); no PvP worlds.
module.exports = {
  id: 'combatlevel',
  name: 'Combat Level',
  description: 'Show a more accurate combat level in Combat Options panel and other combat level functions',
  tags: ['wilderness', 'attack', 'range'],
  enabledByDefault: true,
  game: './combatlevel/game.js',
  page: './combatlevel/page.js',
  config: {
    group: 'combatlevel',
    sections: [],
    items: [
      { key: 'showLevelsUntil', name: 'Calculate next level', description: 'Mouse over the combat level to calculate what skill levels will increase combat.', type: 'boolean', default: true, position: -1 },
      { key: 'showPreciseCombatLevel', name: 'Show precise combat level', description: 'Displays your combat level with accurate decimals.', type: 'boolean', default: true, position: -1 },
      { key: 'wildernessAttackLevelRange', name: 'Show level range in wilderness', description: 'Displays a PvP-world-like attack level range in the wilderness.', type: 'boolean', default: true, position: -1 },
    ],
  },
};
