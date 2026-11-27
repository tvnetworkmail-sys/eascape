'use strict';
// RuneLite's Chat Filter (net.runelite.client.plugins.chatfilter), cloned 1:1: ChatFilterConfig.
module.exports = {
  id: 'chatfilter',
  name: 'Chat Filter',
  description: 'Censor user configurable words or patterns from chat',
  tags: ['censor', 'chat', 'filter'],
  enabledByDefault: false,
  game: './chatfilter/game.js',
  page: './chatfilter/page.js',
  config: {
    group: 'chatfilter',
    sections: [{ key: 'filterLists', name: 'Filter lists', description: 'Custom word, regex, and username filter lists.', position: 0, closedByDefault: true }],
    items: [
      { key: 'filteredWords', name: 'Filtered words', description: 'List of filtered words, separated by commas.', type: 'string', default: '', section: 'filterLists', position: 1 },
      { key: 'filteredRegex', name: 'Filtered regex', description: 'List of regular expressions to filter, one per line.', type: 'string', default: '', section: 'filterLists', position: 2 },
      { key: 'filteredNames', name: 'Filtered names', description: 'List of filtered names, one per line. Accepts regular expressions.', type: 'string', default: '', section: 'filterLists', position: 3 },
      { key: 'filterType', name: 'Filter type', description: 'Configures how the messages are filtered.', type: 'enum', default: 'CENSOR_WORDS', options: [{ value: 'CENSOR_WORDS', label: 'Censor words' }, { value: 'CENSOR_MESSAGE', label: 'Censor message' }, { value: 'REMOVE_MESSAGE', label: 'Remove message' }], position: 4 },
      { key: 'filterFriends', name: 'Filter friends', description: "Filter your friends' messages.", type: 'boolean', default: false, position: 5 },
      { key: 'filterClan', method: 'filterFriendsChat', name: 'Filter friends chat members', description: "Filter your friends chat members' messages.", type: 'boolean', default: false, position: 6 },
      { key: 'filterClanChat', name: 'Filter clan chat members', description: "Filter your clan chat members' messages.", type: 'boolean', default: false, position: 7 },
      { key: 'filterGameChat', name: 'Filter game chat', description: 'Filter your game chat messages.', type: 'boolean', default: false, position: 9 },
      { key: 'collapseGameChat', name: 'Collapse game chat', description: 'Collapse duplicate game chat messages into a single line.', type: 'boolean', default: false, position: 10 },
      { key: 'collapsePlayerChat', name: 'Collapse player chat', description: 'Collapse duplicate player chat messages into a single line.', type: 'boolean', default: false, position: 11 },
      { key: 'maxRepeatedPublicChats', name: 'Repeat filter', description: 'Block player chat message if repeated this many times. 0 is off.', type: 'int', default: 0, position: 12 },
      { key: 'stripAccents', name: 'Strip accents', description: 'Remove accents before applying filters.', type: 'boolean', default: false, position: 13 },
    ],
  },
};
