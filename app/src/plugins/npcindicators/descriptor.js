'use strict';
// Port of RuneLite's NPC Indicators (NpcIndicatorsConfig). Not ported yet: model outline
// (the hull is), names on the minimap, respawn timers; pets don't exist in 2004.
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
    sections: [
      { key: 'renderStyleSection', name: 'Render style', position: 0 },
    ],
    items: [
      { section: 'renderStyleSection', key: 'highlightHull', name: 'Highlight hull', description: 'Configures whether or not NPC should be highlighted by hull', type: 'boolean', default: true, position: 0 },
      { section: 'renderStyleSection', key: 'highlightTile', name: 'Highlight tile', description: 'Configures whether or not NPC should be highlighted by tile', type: 'boolean', default: false, position: 1 },
      { section: 'renderStyleSection', key: 'highlightTrueTile', name: 'Highlight true tile', description: 'Configures whether or not NPC should be highlighted by true tile (where the server has it, even while it walks)', type: 'boolean', default: false, position: 2 },
      { section: 'renderStyleSection', key: 'highlightSouthWestTile', name: 'Highlight south west tile', description: 'Configures whether or not NPC should be highlighted by south western tile', type: 'boolean', default: false, position: 3 },
      { section: 'renderStyleSection', key: 'highlightSouthWestTrueTile', name: 'Highlight south west true tile', description: 'Configures whether or not NPC should be highlighted by south western true tile', type: 'boolean', default: false, position: 4 },
      { section: 'renderStyleSection', key: 'npcColor', name: 'Highlight color', description: 'Color of the NPC highlight border, menu, and text', type: 'color', default: '#00FFFF', position: 10 },
      { section: 'renderStyleSection', key: 'fillColor', name: 'Fill color', description: 'Color of the NPC highlight fill', type: 'color', default: '#00FFFF', position: 11 },
      { section: 'renderStyleSection', key: 'fillOpacity', name: 'Fill opacity', description: 'How solid the fill is, from 0 (none) to 255 (solid)', type: 'int', default: 20, min: 0, max: 255, position: 12 },
      { section: 'renderStyleSection', key: 'borderWidth', name: 'Border width', description: 'Width of the highlighted NPC border', type: 'int', default: 2, min: 1, max: 3, position: 13 },
      { key: 'npcToHighlight', name: 'NPCs to highlight', description: 'NPCs to highlight by name. Use * as a wildcard. You can also hold Alt, right-click an NPC and choose Tag-All.', type: 'itemlist', default: '', position: 1 },
      { key: 'tagKey', name: 'Tag key', description: 'Hold this key and right-click an NPC to get Tag and Tag-All', type: 'enum', default: 'alt', options: [{ value: 'alt', label: 'Alt' }, { value: 'shift', label: 'Shift' }, { value: 'ctrl', label: 'Ctrl' }], position: 3 },
      { key: 'drawNames', name: 'Draw names above NPC', description: 'Configures whether or not NPC names should be drawn above the NPC', type: 'boolean', default: false, position: 2 },
      { key: 'highlightMenuStyle', name: 'Highlight menu style', description: 'Highlight setting for right click menu', type: 'enum', default: 'none', options: [{ value: 'none', label: 'None' }, { value: 'name', label: 'Name' }, { value: 'level', label: 'Level' }, { value: 'both', label: 'Both' }], position: 4 },
      { key: 'ignoreDeadNpcs', name: 'Ignore dead NPCs', description: 'Prevents highlighting NPCs after they are dead', type: 'boolean', default: true, position: 5 },
    ],
  },
};
