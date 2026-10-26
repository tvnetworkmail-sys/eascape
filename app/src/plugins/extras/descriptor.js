'use strict';
// EASCape Extras: game conveniences the server gives only to the app (the web game plays as
// 2006 did). On by default; switched off, you get the 2006 behaviour in the app too.
module.exports = {
  id: 'extras',
  name: 'EASCape Extras',
  description: 'Keeps your attack style between logins and sets your autocast spell again when you go back to a staff',
  tags: ['extras', 'attack', 'style', 'autocast', 'spell', 'staff', 'remember', 'qol'],
  enabledByDefault: true,
  game: './extras/game.js',
  page: './extras/page.js',
  config: { group: 'extras', sections: [], items: [] },
};
