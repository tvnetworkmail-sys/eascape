'use strict';
// RuneLite's Minimap plugin (net.runelite.client.plugins.minimap), cloned 1:1: MinimapConfig. Era-trim: the 2007
// client has five minimap dots (item, NPC, player, friend, team), so no friends chat or clan chat colours.
module.exports = {
  id: 'minimap',
  name: 'Minimap',
  description: 'Customize the color of minimap dots, hide the minimap, and zoom',
  tags: ['items', 'npcs', 'players', 'zoom'],
  enabledByDefault: true,
  game: './minimap/game.js',
  page: './minimap/page.js',
  config: {
    group: 'minimap',
    sections: [
      { key: 'minimapDotSection', name: 'Minimap dot colors', description: 'The colors of dots on the minimap.', position: 0 },
    ],
    items: [
      { key: 'zoom', name: 'Zoom', description: 'Enables zooming on the minimap.', type: 'boolean', default: true, position: -1 },
      { key: 'hideMinimap', name: 'Hide minimap', description: 'Do not show the minimap on screen (resizable only).', type: 'boolean', default: false, position: -1 },
      { key: 'item', method: 'itemColor', name: 'Item color', description: 'Set the minimap color items are drawn in.', type: 'color', default: '', section: 'minimapDotSection', position: -1 },
      { key: 'npc', method: 'npcColor', name: 'NPC color', description: 'Set the minimap color NPCs are drawn in.', type: 'color', default: '', section: 'minimapDotSection', position: -1 },
      { key: 'player', method: 'playerColor', name: 'Player color', description: 'Set the minimap color players are drawn in.', type: 'color', default: '', section: 'minimapDotSection', position: -1 },
      { key: 'friend', method: 'friendColor', name: 'Friends color', description: 'Set the minimap color your friends are drawn in.', type: 'color', default: '', section: 'minimapDotSection', position: -1 },
      { key: 'team', method: 'teamColor', name: 'Team color', description: 'Set the minimap color your team is drawn in.', type: 'color', default: '', section: 'minimapDotSection', position: -1 },
      { key: 'zoomLevel', name: '', description: '', type: 'double', default: 0, hidden: true },
    ],
  },
};
