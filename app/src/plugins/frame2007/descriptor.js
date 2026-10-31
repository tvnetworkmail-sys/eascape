'use strict';
// EASCape: the 2007 interface - the combat tabs as they were in August 2007 (the weapon name and
// "Combat Lvl", the style boxes, Auto Retaliate on the tab and the 2007 special attack bar), from
// the August 2007 cache (tools/frame2007/combat_tabs.py). The game frame stays 2006's. Your call,
// 31 Oct 2026.
module.exports = {
  id: 'frame2007',
  name: '2007 interface',
  description: 'Use the August 2007 combat tabs and special attack bar',
  tags: ['interface', 'combat', 'attack style', 'special attack', '2007', 'skin', 'ui'],
  enabledByDefault: false,
  game: './frame2007/game.js',
  page: './frame2007/page.js',
  config: { group: 'frame2007', sections: [], items: [] },
};
