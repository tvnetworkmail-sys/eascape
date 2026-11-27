'use strict';
// RuneLite's Quest List plugin (net.runelite.client.plugins.questlist), cloned 1:1.
module.exports = {
  id: 'questlist',
  name: 'Quest List',
  description: 'Adds a search filter to the quest list',
  tags: [],
  enabledByDefault: true,
  game: './questlist/game.js',
  page: './questlist/page.js',
  config: { group: 'questlist', sections: [], items: [] },
};
