'use strict';
// Tab to reply, as in the modern game: press Tab to open the game's own "Enter message to
// send to <name>" prompt for the last player who sent you a private message. Like the
// friends list's Message option, it works for friends who are online.
module.exports = {
  id: 'privatemessages',
  name: 'Private Messages',
  description: 'Press Tab to reply to the last private message',
  tags: ['private', 'message', 'pm', 'reply', 'tab', 'chat', 'friends'],
  enabledByDefault: true,
  game: './privatemessages/game.js',
  config: {
    group: 'privatemessages',
    sections: [],
    items: [
      { key: 'replyHotkey', name: 'Reply key', description: 'Opens a reply to the last player who sent you a private message', type: 'hotkey', default: 'Tab', position: 0 },
    ],
  },
};
