'use strict';
// Port of RuneLite's Ground Markers: Shift + right-click a tile and "Mark tile"; marked tiles
// are outlined in the game (names, defaults and wording from GroundMarkerConfig).
module.exports = {
  id: 'groundmarkers',
  name: 'Ground Markers',
  description: 'Enable marking of tiles using the Shift key',
  tags: ['overlay', 'tiles', 'ground', 'marker', 'mark', 'tile'],
  enabledByDefault: true,
  game: './groundmarkers/game.js',
  page: './groundmarkers/page.js',
  config: {
    group: 'groundMarker',
    sections: [],
    items: [
      { key: 'markerColor', name: 'Tile color', description: 'The default color for marked tiles.', type: 'color', default: '#FFFF00', position: 0 },
      { key: 'borderWidth', name: 'Border width', description: 'Width of the marked tile border.', type: 'int', default: 2, min: 0, max: 10, position: 3 },
      { key: 'fillOpacity', name: 'Fill opacity', description: 'Opacity of the tile fill color.', type: 'int', default: 50, min: 0, max: 255, position: 4 },
    ],
  },
};
