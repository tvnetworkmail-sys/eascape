'use strict';
// RuneLite's NPC Indicators plugin (net.runelite.client.plugins.npchighlight), cloned 1:1: NpcIndicatorsConfig.
// For 2007: no pets flag (Ignore pets does nothing), no model outline renderer (Outline draws the hull's outline).
const MENU_STYLE = [{ value: 'NONE', label: 'None' }, { value: 'LEVEL', label: 'Level' }, { value: 'NAME', label: 'Name' }, { value: 'BOTH', label: 'Both' }];
const S = 'renderStyleSection';
module.exports = {
  id: 'npcindicators',
  name: 'NPC Indicators',
  description: 'Highlight NPCs on-screen and/or on the minimap',
  tags: ['highlight', 'minimap', 'npcs', 'overlay', 'respawn', 'tags'],
  enabledByDefault: true,
  game: './npcindicators/game.js',
  page: './npcindicators/page.js',
  config: {
    group: 'npcindicators',
    sections: [{ key: S, name: 'Render style', description: 'The render style of NPC highlighting.', position: 0 }],
    items: [
      { key: 'highlightHull', name: 'Highlight hull', description: 'Configures whether or not NPC should be highlighted by hull.', type: 'boolean', default: true, position: 0, section: S },
      { key: 'highlightTile', name: 'Highlight tile', description: 'Configures whether or not NPC should be highlighted by tile.', type: 'boolean', default: false, position: 1, section: S },
      { key: 'highlightTrueTile', name: 'Highlight true tile', description: 'Configures whether or not NPC should be highlighted by true tile.', type: 'boolean', default: false, position: 2, section: S },
      { key: 'highlightSouthWestTile', name: 'Highlight south west tile', description: 'Configures whether or not NPC should be highlighted by south western tile.', type: 'boolean', default: false, position: 3, section: S },
      { key: 'highlightSouthWestTrueTile', name: 'Highlight south west true tile', description: 'Configures whether or not NPC should be highlighted by south western true tile.', type: 'boolean', default: false, position: 4, section: S },
      { key: 'highlightOutline', name: 'Highlight outline', description: 'Configures whether or not the model of the NPC should be highlighted by outline.', type: 'boolean', default: false, position: 5, section: S },
      { key: 'npcColor', method: 'highlightColor', name: 'Highlight color', description: 'Color of the NPC highlight border, menu, and text.', type: 'color', alpha: true, default: '#FF00FFFF', position: 10, section: S },
      { key: 'fillColor', name: 'Fill color', description: 'Color of the NPC highlight fill.', type: 'color', alpha: true, default: '#1400FFFF', position: 11, section: S },
      { key: 'borderWidth', name: 'Border width', description: 'Width of the highlighted NPC border.', type: 'double', default: 2, position: 12, section: S },
      { key: 'outlineFeather', name: 'Outline feather', description: 'Specify between 0-4 how much of the model outline should be faded.', type: 'int', default: 0, min: 0, max: 4, position: 13, section: S },
      { key: 'npcToHighlight', method: 'getNpcToHighlight', name: 'NPCs to highlight', description: 'List of NPC names to highlight. Format: npc1, npc2, npc3', type: 'string', default: '', position: 7 },
      { key: 'drawNames', name: 'Draw names above NPC', description: 'Configures whether or not NPC names should be drawn above the NPC.', type: 'boolean', default: false, position: 8 },
      { key: 'drawMinimapNames', name: 'Draw names on minimap', description: 'Configures whether or not NPC names should be drawn on the minimap.', type: 'boolean', default: false, position: 9 },
      { key: 'highlightMenuStyle', name: 'Highlight menu style', description: 'Highlight style in the right-click menu.', type: 'enum', default: 'NONE', options: MENU_STYLE, position: 10 },
      { key: 'ignoreDeadNpcs', name: 'Ignore dead NPCs', description: 'Prevents highlighting NPCs after they are dead.', type: 'boolean', default: true, position: 11 },
      { key: 'deadNpcMenuColor', name: 'Dead NPC menu color', description: 'Color of the NPC menus for dead NPCs.', type: 'color', default: null, position: 12 },
      { key: 'showRespawnTimer', name: 'Show respawn timer', description: 'Show respawn timer of tagged NPCs.', type: 'boolean', default: false, position: 13 },
      { key: 'ignorePets', name: 'Ignore pets', description: 'Excludes pets from being highlighted.', type: 'boolean', default: true, position: 14 },
    ],
  },
};
