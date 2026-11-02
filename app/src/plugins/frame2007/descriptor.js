'use strict';
// EASCape: the 2006 interface (was "2007 interface"; renamed 2 Nov 2026, your call): the 2006 frame
// with the later tab icons (the 2007 cache's: the logout door, the red ignore face...), as in your
// screenshot, plus the combat tabs as they were in August 2007 (the weapon name and
// "Combat Lvl", the style boxes, Auto Retaliate on the tab and the 2007 special attack bar), from
// the August 2007 cache (tools/frame2007/combat_tabs.py). The game frame stays 2006's. Your call,
// 31 Oct 2026.
module.exports = {
  id: 'frame2007',
  name: '2006 interface',
  description: 'The 2006 frame with the later tab icons (logout door), and the August 2007 combat tabs and special attack bar',
  tags: ['interface', 'combat', 'attack style', 'special attack', '2006', '2007', 'icons', 'tabs', 'skin', 'ui'],
  enabledByDefault: false,
  game: './frame2007/game.js',
  page: './frame2007/page.js',
  config: { group: 'frame2007', sections: [], items: [] },
};
