'use strict';
// RuneLite's Object Markers plugin (net.runelite.client.plugins.objectindicators), cloned 1:1: ObjectIndicatorsConfig.
// For 2007: no model outline renderer (Highlight outline draws the hull's outline); the clickbox is the model's hull.
const S = 'renderStyleSection';
module.exports = {
  id: 'objectindicators',
  name: 'Object Markers',
  description: 'Enable marking of objects using the Shift key',
  tags: ['overlay', 'objects', 'mark', 'marker'],
  enabledByDefault: false,
  game: './objectindicators/game.js',
  page: './objectindicators/page.js',
  config: {
    group: 'objectindicators',
    sections: [{ key: S, name: 'Render style', description: 'The render style of object highlighting.', position: 0 }],
    items: [
      { key: 'highlightHull', name: 'Highlight hull', description: 'Configures whether or not object should be highlighted by hull.', type: 'boolean', default: true, position: 0, section: S },
      { key: 'highlightOutline', name: 'Highlight outline', description: 'Configures whether or not the model of the object should be highlighted by outline.', type: 'boolean', default: false, position: 1, section: S },
      { key: 'highlightClickbox', name: 'Highlight clickbox', description: 'Configures whether the object\'s clickbox should be highlighted.', type: 'boolean', default: false, position: 2, section: S },
      { key: 'highlightTile', name: 'Highlight tile', description: 'Configures whether the object\'s tile should be highlighted.', type: 'boolean', default: false, position: 3, section: S },
      { key: 'markerColor', name: 'Marker color', description: 'Configures the color of newly created object markers.', type: 'color', alpha: true, default: '#FFFFFF00', position: 4, section: S },
      { key: 'fillColor', name: 'Fill color', description: 'Configures the fill color of newly created object markers.', type: 'color', alpha: true, default: null, position: 5, section: S },
      { key: 'borderWidth', name: 'Border width', description: 'Width of the marked object border.', type: 'double', default: 2, position: 6, section: S },
      { key: 'outlineFeather', name: 'Outline feather', description: 'Specify between 0-4 how much of the model outline should be faded.', type: 'int', default: 0, min: 0, max: 4, position: 7, section: S },
    ],
  },
};
