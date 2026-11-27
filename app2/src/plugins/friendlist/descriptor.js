'use strict';
// RuneLite's Friend List plugin (net.runelite.client.plugins.friendlist), cloned 1:1: FriendListConfig.
module.exports = {
  id: 'friendlist',
  name: 'Friend List',
  description: 'Add extra information to the friend and ignore lists',
  tags: [],
  enabledByDefault: true,
  game: './friendlist/game.js',
  page: './friendlist/page.js',
  config: {
    group: 'friendlist',
    sections: [],
    items: [
      { key: 'showWorldOnLogin', name: 'Show world on login', description: 'Shows world number on friend login notifications.', type: 'boolean', default: false, position: -1 },
    ],
  },
};
