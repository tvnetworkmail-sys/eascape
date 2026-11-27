'use strict';
// RuneLite's Chat Notifications (net.runelite.client.plugins.chatnotifications), cloned 1:1: ChatNotificationsConfig
// (same keys, names, defaults and section). Era-trim: Notify on broadcast is left out (broadcasts are 2019).
module.exports = {
  id: 'chatnotifications',
  name: 'Chat Notifications',
  description: 'Highlight and notify you of chat messages',
  tags: ['duel', 'messages', 'notifications', 'trade', 'username'],
  enabledByDefault: false,
  game: './chatnotifications/game.js',
  page: './chatnotifications/page.js',
  config: {
    group: 'chatnotification',
    sections: [{ key: 'highlightLists', name: 'Highlight lists', description: 'Custom single word and regex filter lists.', position: 0 }],
    items: [
      { key: 'highlightWordsString', name: 'Highlight words', description: 'Highlights the following words in chat, separated by commas.', type: 'string', default: '', section: 'highlightLists', position: 1 },
      { key: 'highlightRegexString', name: 'Highlight regex', description: 'Highlights the following regular expressions in chat, one per line.', type: 'string', default: '', section: 'highlightLists', position: 2 },
      { key: 'highlightOwnName', name: 'Highlight own name', description: 'Highlights any instance of your username in chat.', type: 'boolean', default: true, position: 1 },
      { key: 'notifyOnOwnName', name: 'Notify on own name', description: 'Notifies you whenever someone mentions you by name.', type: 'notification', default: false, position: 2 },
      { key: 'notifyOnHighlight', name: 'Notify on highlight', description: 'Notifies you whenever a highlighted word is matched.', type: 'notification', default: false, position: 3 },
      { key: 'notifyOnTrade', name: 'Notify on trade', description: 'Notifies you whenever you are traded.', type: 'notification', default: false, position: 4 },
      { key: 'notifyOnDuel', name: 'Notify on duel', description: 'Notifies you whenever you are challenged to a duel.', type: 'notification', default: false, position: 5 },
      { key: 'notifyOnPM', name: 'Notify on private message', description: 'Notifies you whenever you receive a private message.', type: 'notification', default: false, position: 7 },
    ],
  },
};
