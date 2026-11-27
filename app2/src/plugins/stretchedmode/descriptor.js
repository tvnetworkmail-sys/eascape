'use strict';
// RuneLite's Stretched Mode plugin (net.runelite.client.plugins.stretchedmode), cloned 1:1: StretchedModeConfig.
// The 2007 client has fixed mode only, so "Resizable scaling" has nothing to act on (as in RuneLite's fixed mode).
module.exports = {
  id: 'stretchedmode',
  name: 'Stretched Mode',
  description: 'Stretches the game in fixed and resizable modes.',
  tags: ['resize', 'ui', 'interface', 'stretch', 'scaling', 'fixed'],
  enabledByDefault: false,
  game: './stretchedmode/game.js',
  page: './stretchedmode/page.js',
  config: {
    group: 'stretchedmode',
    sections: [],
    items: [
      { key: 'keepAspectRatio', name: 'Keep aspect ratio', description: 'Keeps the aspect ratio when stretching.', type: 'boolean', default: false, position: -1 },
      { key: 'increasedPerformance', name: 'Increased performance mode', description: 'Uses a fast algorithm when stretching, lowering quality but increasing performance.', type: 'boolean', default: false, position: -1 },
      { key: 'integerScaling', name: 'Integer scaling', description: 'Forces use of a whole number scale factor when stretching.', type: 'boolean', default: false, position: -1 },
      // 2007RS (not RuneLite's): the SD 3D view drawn at the size it has on screen
      { key: 'increasedResolution', name: 'Increased resolution', description: 'In SD, draws the 3D view at the size the game is shown at, so it stays sharp when stretched. The interfaces keep their pixels. (HD is always drawn at full resolution.)', type: 'boolean', default: true, position: -1 },
      { key: 'scalingFactor', name: 'Resizable scaling', description: 'In resizable mode, the game is reduced in size this much before it\'s stretched.', type: 'int', default: 50, unit: '%', position: -1 },
    ],
  },
};
