'use strict';
// RuneLite's Camera plugin (net.runelite.client.plugins.camera), cloned 1:1: CameraConfig (group "zoom") and ControlFunction.
// The zoom, middle-mouse camera, speed, invert and shake are the client's in OSRS: the RuneLite core does them for the
// 2007 client (plugins/runelite/api.js, "the client's camera"). "Expand pitch limit" is hidden: the 2007 client clamps the
// pitch itself. 2007RS: Draw distance and Hide roofs (from the old Camera plugin; RuneLite has them in GPU and Roof Removal,
// which the 2007 client can't host) stay here in a section of their own.
module.exports = {
  id: 'camera',
  name: 'Camera',
  description: 'Expands zoom limit, provides vertical camera, and remaps mouse input keys',
  tags: ['zoom', 'limit', 'vertical', 'click', 'mouse'],
  enabledByDefault: false,
  game: './camera/game.js',
  page: './camera/page.js',
  config: {
    group: 'zoom',
    sections: [
      { key: 'mouseSettings', name: 'Mouse settings', description: 'Mouse settings.', position: 10 },
      { key: 'eascape2007', name: '2006RS-2', description: 'Draw distance and roofs (not in RuneLite\'s Camera).', position: 20 },
    ],
    items: [
      { key: 'inner', method: 'innerLimit', name: 'Expand inner zoom limit', description: 'Configures whether or not the inner zoom limit is reduced.', type: 'boolean', default: false, position: 1 },
      { key: 'outerLimit', name: 'Expand outer zoom limit', description: 'Configures how much the outer zoom limit is adjusted.', type: 'int', default: 0, min: -400, max: 400, position: 2 },
      { key: 'relaxCameraPitch', hidden: true, name: 'Expand pitch limit', description: "Relax the camera's upper and lower pitch limits. Allows vertical and horizontal camera movement.", type: 'boolean', default: false, position: 3 },
      { key: 'controlFunction', name: 'Control function', description: 'Configures the zoom function when control is pressed.', type: 'enum', default: 'NONE', options: [{ value: 'NONE', label: 'None' }, { value: 'CONTROL_TO_ZOOM', label: 'Hold to zoom' }, { value: 'CONTROL_TO_RESET', label: 'Reset zoom' }], position: 4 },
      { key: 'ctrlZoomValue', name: 'Reset zoom position', description: 'Position of zoom when it is reset.', type: 'int', default: 512, min: -400, max: 1400, position: 5 },
      { key: 'zoomIncrement', name: 'Zoom speed', description: 'Speed of zoom.', type: 'int', default: 25, position: 6 },
      { key: 'cameraSpeed', name: 'Camera speed', description: 'Speed which the camera moves from input.', type: 'double', default: 1, position: 7 },
      { key: 'disableCameraShake', name: 'Disable camera shake', description: 'Disables camera shake.', type: 'boolean', default: false, position: 8 },
      { key: 'rightClickMovesCamera', name: 'Right-click moves camera', description: 'Remaps right-click to middle mouse click.', type: 'boolean', default: false, position: 7, section: 'mouseSettings' },
      { key: 'rightClickObjects', name: 'Right-click objects', description: "Right-clicking objects opens the menu when 'Right-click moves camera' is on.", type: 'boolean', default: true, position: 8, section: 'mouseSettings' },
      { key: 'rightClickExamine', name: 'Right-click examine', description: "Right-clicking examinable objects opens the menu when 'Right-click moves camera' is on.", type: 'boolean', default: false, position: 9, section: 'mouseSettings' },
      { key: 'rightClickMenuBlocksCamera', name: 'Right-click menu blocks camera', description: "Prevents camera movement when 'Right-click moves camera' is on and the right-click menu<br>is opened due to either 'Right-click objects' or 'Right-click examine' being on.", type: 'boolean', default: true, position: 10, section: 'mouseSettings' },
      { key: 'middleClickMenu', name: 'Middle-button opens menu', description: 'Remaps middle mouse click to right-click.', type: 'boolean', default: false, position: 11, section: 'mouseSettings' },
      { key: 'invertYaw', name: 'Invert yaw', description: 'Makes moving the camera horizontally with the mouse backwards.', type: 'boolean', default: false, position: 12, section: 'mouseSettings' },
      { key: 'invertPitch', name: 'Invert pitch', description: 'Makes moving the camera vertically with the mouse backwards.', type: 'boolean', default: false, position: 13, section: 'mouseSettings' },
      { key: 'drawDistance', name: 'Draw distance', description: 'Tiles drawn around the camera, in SD and HD. The 2007 game draws 25; 50 is about as far as the game loads the map around you. Lower it if the game runs slowly.', type: 'int', default: 50, min: 25, max: 50, unit: ' tiles', position: 20, section: 'eascape2007' },
      { key: 'hideRoofs', name: 'Hide roofs', description: 'Never draw roofs or the floors above you, as when you stand indoors - without switching the whole game to low detail', type: 'boolean', default: false, position: 21, section: 'eascape2007' },
    ],
  },
};
