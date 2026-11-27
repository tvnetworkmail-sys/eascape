'use strict';
// RuneLite's Key Remapping plugin (net.runelite.client.plugins.keyremapping), cloned 1:1: KeyRemappingConfig
// (ModifierlessKeybinds, here the hotkey text; the Control key's default is VK_UNDEFINED, not set).
module.exports = {
  id: 'keyremapping',
  name: 'Key Remapping',
  description: "Allows use of WASD keys for camera movement with 'Press Enter to Chat', and remapping number keys to F-keys",
  tags: ['enter', 'chat', 'wasd', 'camera'],
  enabledByDefault: false,
  game: './keyremapping/game.js',
  page: './keyremapping/page.js',
  config: {
    group: 'keyremapping',
    sections: [
      { key: 'camera', name: 'Camera remapping', description: 'Settings for remapping the camera.', position: 0 },
      { key: 'fKeys', name: 'F-key remapping', description: 'Settings for remapping the F-keys.', position: 1 },
    ],
    items: [
      { key: 'cameraRemap', name: 'Remap camera', description: 'Configures whether the camera movement uses remapped keys.', type: 'boolean', default: true, section: 'camera', position: 1 },
      { key: 'up', name: 'Camera up key', description: 'The key which will replace up.', type: 'hotkey', default: 'W', section: 'camera', position: 2 },
      { key: 'down', name: 'Camera down key', description: 'The key which will replace down.', type: 'hotkey', default: 'S', section: 'camera', position: 3 },
      { key: 'left', name: 'Camera left key', description: 'The key which will replace left.', type: 'hotkey', default: 'A', section: 'camera', position: 4 },
      { key: 'right', name: 'Camera right key', description: 'The key which will replace right.', type: 'hotkey', default: 'D', section: 'camera', position: 5 },
      { key: 'fkeyRemap', name: 'Remap F-keys', description: 'Configures whether f-keys use remapped keys.', type: 'boolean', default: false, section: 'fKeys', position: 6 },
      { key: 'f1', name: 'F1', description: 'The key which will replace F1.', type: 'hotkey', default: '1', section: 'fKeys', position: 7 },
      { key: 'f2', name: 'F2', description: 'The key which will replace F2.', type: 'hotkey', default: '2', section: 'fKeys', position: 8 },
      { key: 'f3', name: 'F3', description: 'The key which will replace F3.', type: 'hotkey', default: '3', section: 'fKeys', position: 9 },
      { key: 'f4', name: 'F4', description: 'The key which will replace F4.', type: 'hotkey', default: '4', section: 'fKeys', position: 10 },
      { key: 'f5', name: 'F5', description: 'The key which will replace F5.', type: 'hotkey', default: '5', section: 'fKeys', position: 11 },
      { key: 'f6', name: 'F6', description: 'The key which will replace F6.', type: 'hotkey', default: '6', section: 'fKeys', position: 12 },
      { key: 'f7', name: 'F7', description: 'The key which will replace F7.', type: 'hotkey', default: '7', section: 'fKeys', position: 13 },
      { key: 'f8', name: 'F8', description: 'The key which will replace F8.', type: 'hotkey', default: '8', section: 'fKeys', position: 14 },
      { key: 'f9', name: 'F9', description: 'The key which will replace F9.', type: 'hotkey', default: '9', section: 'fKeys', position: 15 },
      { key: 'f10', name: 'F10', description: 'The key which will replace F10.', type: 'hotkey', default: '0', section: 'fKeys', position: 16 },
      { key: 'f11', name: 'F11', description: 'The key which will replace F11.', type: 'hotkey', default: '-', section: 'fKeys', position: 17 },
      { key: 'f12', name: 'F12', description: 'The key which will replace F12.', type: 'hotkey', default: '=', section: 'fKeys', position: 18 },
      { key: 'esc', name: 'ESC', description: 'The key which will replace ESC.', type: 'hotkey', default: 'Escape', section: 'fKeys', position: 19 },
      { key: 'space', name: 'Space', description: 'The key which will replace space when dialogs are open.', type: 'hotkey', default: 'Space', position: 20 },
      { key: 'control', name: 'Control', description: 'The key which will replace control.', type: 'hotkey', default: '', position: 21 },
    ],
  },
};
