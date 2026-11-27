'use strict';
// RuneLite's Team plugin (net.runelite.client.plugins.team), cloned. Era-trim: no clan chat section (OSRS clans, 2021).
module.exports = {
  id: 'team',
  name: 'Team',
  description: 'Shows how many team and clan mates are nearby',
  tags: ['overlay', 'players', 'cape', 'clan', 'friend'],
  enabledByDefault: false,
  game: './team/game.js',
  page: './team/page.js',
  config: {
    group: 'teamCapes',
    sections: [
      { key: 'teamSection', name: 'Team', description: 'Configuration for teams.', position: 10 },
      { key: 'friendsChatSection', name: 'Friends chat', description: 'Configuration for friends chat.', position: 20 },
    ],
    items: [
      { key: 'teamCapesOverlay', name: 'Team cape overlay', description: 'Configures whether to show the team cape overlay.', type: 'boolean', default: false, section: 'teamSection', position: 0 },
      { key: 'minimumCapeCount', method: 'getMinimumCapeCount', name: 'Minimum cape count', description: 'Configures the minimum number of team capes which must be present before being displayed.', type: 'int', default: 1, section: 'teamSection', position: 1 },
      { key: 'friendsChatMemberCounter', name: 'Friends chat members counter', description: 'Show the amount of friends chat members near you.', type: 'boolean', default: false, section: 'friendsChatSection', position: 0 },
    ],
  },
};
