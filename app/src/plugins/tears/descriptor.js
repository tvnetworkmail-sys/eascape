'use strict';
// EASCape's own: Tears of Guthix. While you're in the tears cave (Juna's minigame) it shows how
// many tears you've collected, as an info box (Juna's stone bowl) and a panel. The server sends the
// count in varp 449 (tog_minigame: bits 12-20 the tears, bit 6 set while you're collecting).
module.exports = {
  id: 'tears',
  name: 'Tears of Guthix',
  description: 'Show how many tears you have collected in the Tears of Guthix cave',
  tags: ['minigame', 'tears', 'guthix', 'juna', 'xp'],
  enabledByDefault: true,
  game: './tears/game.js',
  page: './tears/page.js',
  infoboxes: ['tears'],
  config: {
    group: 'tearsofguthix',
    sections: [],
    items: [
      { key: 'showInfobox', name: 'Show info box', description: 'Show the tears collected as an info box.', type: 'boolean', default: true, position: 1 },
      { key: 'showPanel', name: 'Show panel', description: 'Show the tears collected as a panel.', type: 'boolean', default: true, position: 2 },
      { key: 'panelSize', name: 'Panel size', description: 'The size of this plugin\'s panel on the game view, in percent.', type: 'int', default: 100, min: 50, max: 300, unit: '%', position: 99 },
    ],
  },
};
