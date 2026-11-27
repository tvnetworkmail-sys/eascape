'use strict';
// RuneLite's Ground Markers plugin (net.runelite.client.plugins.groundmarkers), cloned 1:1: GroundMarkerConfig.
// For 2007: no world map orb, so GroundMarkerSharingManager's Import / Export / Clear menu isn't added (the
// option is kept); the "Color" submenu is flat and has no colour picker.
module.exports = {
  id: 'groundmarkers',
  name: 'Ground Markers',
  description: 'Enable marking of tiles using the Shift key',
  tags: ['overlay', 'tiles'],
  enabledByDefault: true,
  game: './groundmarkers/game.js',
  page: './groundmarkers/page.js',
  config: {
    group: 'groundMarker',
    sections: [],
    items: [
      { key: 'markerColor', name: 'Tile color', description: 'The default color for marked tiles.', type: 'color', alpha: true, default: '#FFFFFF00', position: -1 },
      { key: 'drawOnMinimap', method: 'drawTileOnMinimmap', name: 'Draw tiles on minimap', description: 'Configures whether marked tiles should be drawn on minimap.', type: 'boolean', default: false, position: -1 },
      { key: 'showImportExport', name: 'Show import/export/clear options', description: 'Show the Import, Export, and Clear options on the world map orb right-click menu.', type: 'boolean', default: true, position: -1 },
      { key: 'borderWidth', name: 'Border width', description: 'Width of the marked tile border.', type: 'double', default: 2, position: -1 },
      { key: 'fillOpacity', name: 'Fill opacity', description: 'Opacity of the tile fill color.', type: 'int', default: 50, min: 0, max: 255, position: -1 },
    ],
  },
};
