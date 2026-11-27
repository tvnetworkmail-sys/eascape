'use strict';
// RuneLite's Chat History plugin (net.runelite.client.plugins.chathistory), cloned 1:1: ChatHistoryConfig.
module.exports = {
  id: 'chathistory',
  name: 'Chat History',
  description: 'Retain your chat history when logging in/out or world hopping',
  tags: ['chat', 'history', 'retain', 'cycle', 'pm'],
  enabledByDefault: true,
  game: './chathistory/game.js',
  page: './chathistory/page.js',
  config: {
    group: 'chathistory',
    sections: [],
    items: [
      { key: 'retainChatHistory', name: 'Retain chat history', description: 'Retains chat history when logging in/out or world hopping.', type: 'boolean', default: true, position: 0 },
      { key: 'pmTargetCycling', name: 'PM target cycling', description: 'Pressing tab while sending a PM will cycle the target username based on PM history.', type: 'boolean', default: true, position: 1 },
      { key: 'copyToClipboard', name: 'Copy to clipboard', description: 'Add option on chat messages to copy them to clipboard.', type: 'boolean', default: true, position: 2 },
      { key: 'clearHistory', name: 'Clear history option for all tabs', description: 'Add \'Clear history\' option chatbox tab buttons.', type: 'boolean', default: true, position: 3 },
    ],
  },
};
