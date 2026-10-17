'use strict';
// Port of the idea behind RuneLite's Developer Tools: a sidebar panel that shows what
// LostLite reads from the game, for checking the game data layer and building plugins.
// Its game side only switches the NPC and player lists on; the data comes from the in-page
// runtime through the app.
module.exports = {
  id: 'devtools',
  name: 'Developer Tools',
  description: 'Sidebar panel showing the live game data EASCape reads: your player, inventory, equipment, and the NPCs and players around you',
  tags: ['developer', 'dev', 'debug', 'tools', 'inspector', 'location', 'inventory', 'equipment'],
  enabledByDefault: false,
  game: './devtools/game.js',
  config: {
    group: 'devtools',
    sections: [],
    items: [],
  },
};
