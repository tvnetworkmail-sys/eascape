'use strict';
// World map (3.5): the 2004 world drawn from Lost City's 274 map data in the minimap's own
// style, opened from the globe by the minimap. Markers from other plugins come later.
module.exports = {
  id: 'worldmap',
  name: 'World Map',
  description: 'A map of the 2004 world, opened from the globe by the minimap',
  tags: ['world', 'map', 'location', 'minimap', 'icons', 'labels'],
  enabledByDefault: true,
  game: './worldmap/game.js',
  config: {
    group: 'worldmap',
    sections: [],
    items: [
      { key: 'hotkey', name: 'Hotkey', description: 'Opens and closes the world map', type: 'hotkey', default: 'Ctrl+M', position: 0 },
      { key: 'showLabels', name: 'Place names', description: 'Show town and area names on the map', type: 'boolean', default: true, position: 1 },
      { key: 'showIcons', name: 'Map icons', description: 'Show banks, shops, altars and the other minimap icons', type: 'boolean', default: true, position: 2 },
    ],
  },
};
