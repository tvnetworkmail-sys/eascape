'use strict';
// Port of RuneLite's Camera plugin, plus the draw distance part of its GPU plugin.
// The 2004 client has no zoom, no mouse camera control and a fixed 25-tile view, so the
// patcher makes all three adjustable and this plugin drives them. Settings mirror
// RuneLite's CameraConfig (and GpuConfig's draw distance) where they apply.
module.exports = {
  id: 'camera',
  name: 'Camera',
  description: 'Scroll to zoom, middle-drag to rotate, and see further than the original 25 tiles',
  tags: ['zoom', 'scroll', 'wheel', 'mouse', 'camera', 'rotate', 'middle', 'draw', 'distance', 'gpu'],
  enabledByDefault: true,
  game: './camera/game.js',
  config: {
    group: 'zoom',
    sections: [
      { key: 'zoomSection', name: 'Zoom', position: 0 },
      { key: 'mouseSection', name: 'Mouse', position: 1 },
      { key: 'drawSection', name: 'Draw Distance', position: 2 },
      { key: 'roofSection', name: 'Roofs', position: 3 },
    ],
    items: [
      { section: 'zoomSection', key: 'inner', name: 'Expand inner zoom limit', description: 'Lets you zoom in closer than normal', type: 'boolean', default: false, position: 1 },
      { section: 'zoomSection', key: 'outerLimit', name: 'Expand outer zoom limit', description: 'How much further out you can zoom, in percent. Pair it with a higher draw distance so the scene fills the view.', type: 'int', default: 0, min: 0, max: 100, unit: '%', position: 2 },
      { section: 'zoomSection', key: 'controlFunction', name: 'Control function', description: 'What holding Ctrl does', type: 'enum', default: 'none', options: [{ value: 'none', label: 'None' }, { value: 'reset', label: 'Control to reset' }], position: 4 },
      { section: 'zoomSection', key: 'ctrlZoomValue', name: 'Reset zoom position', description: 'Zoom level to reset to, in percent (100 is the original 2004 view)', type: 'int', default: 100, min: 50, max: 200, unit: '%', position: 5 },
      { section: 'zoomSection', key: 'zoomIncrement', name: 'Zoom speed', description: 'How far each step of the mouse wheel zooms', type: 'int', default: 25, min: 1, max: 100, position: 6 },
      { section: 'zoomSection', key: 'invertZoom', name: 'Invert zoom direction', description: 'Scroll down to zoom in instead of out', type: 'boolean', default: false, position: 7 },
      { section: 'mouseSection', key: 'middleClickRotate', name: 'Middle-button moves camera', description: 'Hold the mouse wheel button and move the mouse to rotate and tilt the camera', type: 'boolean', default: true, position: 10 },
      { section: 'mouseSection', key: 'cameraSpeed', name: 'Camera speed', description: 'How fast the camera turns when moved with the mouse, in percent', type: 'int', default: 100, min: 10, max: 400, unit: '%', position: 11 },
      { section: 'mouseSection', key: 'invertYaw', name: 'Invert yaw', description: 'Swap the left/right direction of mouse camera movement', type: 'boolean', default: false, position: 12 },
      { section: 'mouseSection', key: 'invertPitch', name: 'Invert pitch', description: 'Swap the up/down direction of mouse camera movement', type: 'boolean', default: false, position: 13 },
      { section: 'roofSection', key: 'hideRoofs', name: 'Hide roofs', description: 'Never draw roofs or the floors above you, as when you stand indoors - without switching the whole game to low detail', type: 'boolean', default: false, position: 30 },
      { section: 'drawSection', key: 'drawDistance', name: 'Draw distance', description: 'Tiles drawn around the camera. 25 is the original 2004 view; RuneLite\'s GPU plugin goes up to 90 but the 2004 game only loads about 50 tiles around you, so the edge of the loaded area can show above that. Higher values cost more CPU. Takes effect when the game next loads (Info panel: Reload the game).', type: 'int', default: 40, min: 25, max: 50, unit: 'tiles', position: 20 },
    ],
  },
};
