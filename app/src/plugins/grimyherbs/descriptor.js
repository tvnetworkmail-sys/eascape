'use strict';
// EASCape: Grimy herbs (ours). The game shows unidentified herbs as 2005 had them: "Herb", "I need
// a closer look to identify this.", Identify. This plugin shows them as the February 2006 cache
// names them instead (Grimy guam ... Grimy torstol, "It needs cleaning.", Clean), only on your
// screen: the game client reads the page's data-eascape-grimy attribute (webclient ObjType).
module.exports = {
  id: 'grimyherbs',
  name: 'Grimy Herbs',
  description: "Show unidentified herbs by name (Grimy guam, Grimy ranarr...) instead of 'Herb'",
  tags: ['herblore', 'items', 'names'],
  enabledByDefault: false,
  game: './grimyherbs/game.js',
  config: { group: 'grimyherbs', sections: [], items: [] },
};
