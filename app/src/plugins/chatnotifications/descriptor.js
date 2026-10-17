'use strict';
// Port of RuneLite's Chat Notifications: a notification (LostLite > Notifications) when
// someone says your name or a word you choose, or you're traded, challenged or sent a
// private message (names, defaults and wording from ChatNotificationsConfig; RuneLite's
// notifications are off until you turn them on).
module.exports = {
  id: 'chatnotifications',
  name: 'Chat Notifications',
  description: 'Highlight and notify you of chat messages',
  tags: ['duel', 'messages', 'notifications', 'trade', 'username', 'chat'],
  enabledByDefault: false,
  game: './chatnotifications/game.js',
  config: {
    group: 'chatnotification',
    sections: [{ key: 'highlightLists', name: 'Highlight lists', description: 'Custom single word and regex filter lists.', position: 0 }],
    items: [
      { key: 'highlightWordsString', name: 'Highlight words', description: 'Notifies on the following words in chat, separated by commas.', type: 'string', default: '', section: 'highlightLists', position: 1 },
      { key: 'highlightRegexString', name: 'Highlight regex', description: 'Notifies on the following regular expressions in chat, one per line.', type: 'string', default: '', section: 'highlightLists', position: 2 },
      { key: 'notifyOnOwnName', name: 'Notify on own name', description: 'Notifies you whenever someone mentions you by name.', type: 'boolean', default: false, position: 4 },
      { key: 'notifyOnHighlight', name: 'Notify on highlight', description: 'Notifies you whenever a highlighted word is matched.', type: 'boolean', default: false, position: 5 },
      { key: 'notifyOnTrade', name: 'Notify on trade', description: 'Notifies you whenever you are traded.', type: 'boolean', default: false, position: 6 },
      { key: 'notifyOnDuel', name: 'Notify on duel', description: 'Notifies you whenever you are challenged to a duel.', type: 'boolean', default: false, position: 7 },
      { key: 'notifyOnPM', name: 'Notify on private message', description: 'Notifies you whenever you receive a private message.', type: 'boolean', default: false, position: 9 },
    ],
  },
};
