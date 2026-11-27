'use strict';
// RuneLite's Friend Notes plugin (net.runelite.client.plugins.friendnotes), cloned 1:1: FriendNotesConfig.
module.exports = {
  id: 'friendnotes',
  name: 'Friend Notes',
  description: 'Store notes about your friends',
  tags: [],
  enabledByDefault: true,
  game: './friendnotes/game.js',
  page: './friendnotes/page.js',
  config: {
    group: 'friendNotes',
    sections: [],
    items: [
      { key: 'showIcons', name: 'Show icons', description: 'Show icons on friend or ignore list.', type: 'boolean', default: true, position: 1 },
    ],
  },
};
