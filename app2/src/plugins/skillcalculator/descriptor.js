'use strict';
// RuneLite's Skill Calculator plugin (net.runelite.client.plugins.skillcalculator), cloned 1:1 and trimmed to Sept 2007
// (data.js: app/tools/runelite/skillcalc.py); the sidebar panel is ui/panels/skillcalculator.js. No config.
module.exports = {
  id: 'skillcalculator',
  name: 'Skill Calculator',
  description: 'Enable the Skill Calculator panel',
  tags: ['panel', 'skilling'],
  enabledByDefault: true,
  game: './skillcalculator/game.js',
  page: ['./skillcalculator/data.js', './skillcalculator/page.js'],
  config: { group: 'skillcalculator', sections: [], items: [] },
};
