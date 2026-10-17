'use strict';
// Port of RuneLite's Object Markers (objectindicators): Shift + right-click an object and
// "Mark object"; marked objects are highlighted (names, defaults and wording from
// ObjectIndicatorsConfig).
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
    sections: [{ key: 'renderStyleSection', name: 'Render style', description: 'The render style of object highlighting.', position: 0 }],
    items: [
      { key: 'highlightHull', name: 'Highlight hull', description: 'Configures whether or not object should be highlighted by hull.', type: 'boolean', default: true, section: 'renderStyleSection', position: 0 },
      { key: 'highlightTile', name: 'Highlight tile', description: "Configures whether the object's tile should be highlighted.", type: 'boolean', default: false, section: 'renderStyleSection', position: 3 },
      { key: 'markerColor', name: 'Marker color', description: 'Configures the color of newly created object markers.', type: 'color', default: '#FFFF00', section: 'renderStyleSection', position: 4 },
      { key: 'borderWidth', name: 'Border width', description: 'Width of the marked object border.', type: 'int', default: 2, min: 0, max: 10, section: 'renderStyleSection', position: 6 },
    ],
  },
};
