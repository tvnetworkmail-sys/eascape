'use strict';
// RuneLite's Player Indicators plugin (net.runelite.client.plugins.playerindicators), cloned. Era-trim: no clan
// members or clan ranks (OSRS clans are 2021); no party members (RuneLite's party service isn't available).
const HS = [{ value: 'DISABLED', label: 'DISABLED' }, { value: 'ENABLED', label: 'ENABLED' }, { value: 'PVP', label: 'PVP' }];
module.exports = {
  id: 'playerindicators',
  name: 'Player Indicators',
  description: 'Highlight players on-screen and/or on the minimap',
  tags: ['highlight', 'minimap', 'overlay', 'players'],
  enabledByDefault: true,
  game: './playerindicators/game.js',
  page: './playerindicators/page.js',
  config: {
    group: 'playerindicators',
    sections: [{ key: 'section', name: 'Highlight options', description: 'Toggle highlighted players by type (self, friends, etc.) and choose their highlight colors.', position: 99 }],
    items: [
      { key: 'highlightSelf', method: 'highlightOwnPlayer', name: 'Highlight own player', description: 'Configures whether your own player should be highlighted.', type: 'enum', default: 'DISABLED', options: HS, section: 'section', position: 1 },
      { key: 'ownNameColor', method: 'getOwnPlayerColor', name: 'Own player', description: 'Color of your own player.', type: 'color', default: '#FF00B8D4', section: 'section', position: 2 },
      { key: 'highlightFriends', method: 'highlightFriends', name: 'Highlight friends', description: 'Configures whether friends should be highlighted.', type: 'enum', default: 'ENABLED', options: HS, section: 'section', position: 5 },
      { key: 'friendNameColor', method: 'getFriendColor', name: 'Friend', description: 'Color of friend names.', type: 'color', default: '#FF00C853', section: 'section', position: 6 },
      { key: 'highlightFriendsChat', method: 'highlightFriendsChat', name: 'Highlight friends chat members', description: 'Configures whether friends chat members should be highlighted.', type: 'enum', default: 'ENABLED', options: HS, section: 'section', position: 7 },
      { key: 'clanMemberColor', method: 'getFriendsChatMemberColor', name: 'Friends chat', description: 'Color of friends chat members.', type: 'color', default: '#FFAA00FF', section: 'section', position: 8 },
      { key: 'highlightTeamMembers', method: 'highlightTeamMembers', name: 'Highlight team members', description: 'Configures whether team members should be highlighted.', type: 'enum', default: 'ENABLED', options: HS, section: 'section', position: 9 },
      { key: 'teamMemberColor', method: 'getTeamMemberColor', name: 'Team member', description: 'Color of team members.', type: 'color', default: '#FF136EF7', section: 'section', position: 10 },
      { key: 'highlightOthers', method: 'highlightOthers', name: 'Highlight others', description: 'Configures whether other players should be highlighted.', type: 'enum', default: 'DISABLED', options: HS, section: 'section', position: 13 },
      { key: 'nonClanMemberColor', method: 'getOthersColor', name: 'Others', description: 'Color of other players names.', type: 'color', default: '#FFFF0000', section: 'section', position: 10 },
      { key: 'drawPlayerTiles', method: 'drawTiles', name: 'Draw tiles under players', description: 'Configures whether or not tiles under highlighted players should be drawn.', type: 'boolean', default: false, position: 11 },
      { key: 'playerNamePosition', name: 'Name position', description: 'Configures the position of drawn player names, or if they should be disabled.', type: 'enum', default: 'ABOVE_HEAD', options: [{ value: 'DISABLED', label: 'Disabled' }, { value: 'ABOVE_HEAD', label: 'Above head' }, { value: 'MODEL_CENTER', label: 'Center of model' }, { value: 'MODEL_RIGHT', label: 'Right of model' }], position: 12 },
      { key: 'drawMinimapNames', name: 'Draw names on minimap', description: 'Configures whether or not minimap names for players with rendered names should be drawn.', type: 'boolean', default: false, position: 13 },
      { key: 'colorPlayerMenu', name: 'Colorize player menu', description: 'Color right-click menu for players.', type: 'boolean', default: true, position: 14 },
      { key: 'clanMenuIcons', method: 'showFriendsChatRanks', name: 'Show friends chat ranks', description: 'Add friends chat rank to right-click menu and next to player names.', type: 'boolean', default: true, position: 15 },
    ],
  },
};
