'use strict';
// EASCape: the 2007 interface - the game frame as it was in August 2007 (the stone pillars, the
// tab bars with the 2007 icons and red stones, the 2007 chat box and its All / Game / Public /
// Private / Clan / Trade / Report Abuse buttons), from the August 2007 cache's game frame
// (tools/frame2007/build.py). The windows inside it stay 2006's. Your call, 31 Oct 2026.
module.exports = {
  id: 'frame2007',
  name: '2007 interface',
  description: 'Use the August 2007 game frame instead of the 2006 one',
  tags: ['interface', 'frame', 'gameframe', '2007', 'skin', 'ui', 'layout'],
  enabledByDefault: false,
  game: './frame2007/game.js',
  page: './frame2007/page.js',
  config: { group: 'frame2007', sections: [], items: [] },
};
