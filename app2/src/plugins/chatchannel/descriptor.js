'use strict';
// RuneLite's Chat Channels plugin (net.runelite.client.plugins.chatchannel), cloned 1:1: ChatChannelConfig.
// The 2007 clan chat is OSRS's friends chat. Era-trim: no clan chat or guest clan chat (2021) sections.
// Hidden (no 2007 way to do them): Chat icons / Private message icons / Public chat icons (rank icons need a chat
// icon for the 2007 rank sprites), Confirm kicks (a kick goes to the server from the confirm prompt).
const RANKS = ['UNRANKED', 'FRIEND', 'RECRUIT', 'CORPORAL', 'SERGEANT', 'LIEUTENANT', 'CAPTAIN', 'GENERAL', 'OWNER', 'JMOD'];
module.exports = {
  id: 'chatchannel',
  name: 'Chat Channels',
  description: 'Improvements for friends chat and clan chat.',
  tags: ['icons', 'rank', 'recent', 'clan', 'friend', 'channel'],
  // 2006RS-2: off by default: the game this plugin is for isn't in our 2006 game (app2/README.md)
  enabledByDefault: false,
  game: './chatchannel/game.js',
  page: './chatchannel/page.js',
  config: {
    group: 'clanchat',
    sections: [
      { key: 'friendsChat', name: 'Friends chat', description: 'Configuration for friends chat.', position: 10 },
    ],
    items: [
      { key: 'joinLeaveTimeout', name: 'Join/leave timeout', description: 'Set the timeout duration of join/leave messages. A value of 0 will make the messages permanent.', type: 'int', default: 20, position: 0 },
      { key: 'clanChatIcons', method: 'chatIcons', name: 'Chat icons', description: 'Show rank icons next to friends chat members.', type: 'boolean', default: true, hidden: true, section: 'friendsChat', position: 1 },
      { key: 'recentChats', name: 'Recent chats', description: 'Show recent friends chats.', type: 'boolean', default: true, section: 'friendsChat', position: 2 },
      { key: 'chatsData', name: '', description: '', type: 'string', default: '', hidden: true, position: -1 },
      { key: 'showJoinLeave', method: 'showFriendsChatJoinLeave', name: 'Show join/leave', description: 'Adds a temporary message notifying when a member joins or leaves.', type: 'boolean', default: false, section: 'friendsChat', position: 4 },
      { key: 'joinLeaveRank', name: 'Join/leave rank', description: 'Only show join/leave messages for members at or above this rank.', type: 'enum', options: RANKS.map((r) => ({ value: r, label: r.charAt(0) + r.slice(1).toLowerCase() })), default: 'UNRANKED', section: 'friendsChat', position: 5 },
      { key: 'privateMessageIcons', name: 'Private message icons', description: 'Add rank icons to private messages received from members.', type: 'boolean', default: false, hidden: true, section: 'friendsChat', position: 7 },
      { key: 'publicChatIcons', name: 'Public chat icons', description: 'Add rank icons to public chat messages from members.', type: 'boolean', default: false, hidden: true, section: 'friendsChat', position: 8 },
      { key: 'confirmKicks', name: 'Confirm kicks', description: 'Shows a chat prompt to confirm kicks.', type: 'boolean', default: false, hidden: true, section: 'friendsChat', position: 10 },
      { key: 'showIgnores', name: 'Recolor ignored players', description: 'Recolor members who are on your ignore list.', type: 'boolean', default: true, section: 'friendsChat', position: 11 },
      { key: 'showIgnoresColor', name: 'Ignored color', description: 'Allows you to change the color of the ignored players in your friends chat.', type: 'color', default: '#FF0000', section: 'friendsChat', position: 12 },
    ],
  },
};
