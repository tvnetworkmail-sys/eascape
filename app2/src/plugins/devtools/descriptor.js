'use strict';
// RuneLite's Developer Tools plugin (net.runelite.client.plugins.devtools), cloned: DevToolsPlugin, DevToolsConfig,
// DevToolsPanel (sidebar panel ui/panels/devtools.js), DevToolsButton, DevToolsOverlay, LocationOverlay,
// CameraOverlay, SceneOverlay, VarInspector. See page.js for what is left out.
module.exports = {
  id: 'devtools',
  name: 'Developer Tools',
  description: '',
  tags: ['panel'],
  enabledByDefault: false,
  game: './devtools/game.js',
  page: './devtools/page.js',
  resources: ['devtools_icon.png'],
  config: {
    group: 'devtools',
    sections: [],
    items: [
      { key: 'inspectorAlwaysOnTop', name: '', description: '', type: 'boolean', default: false, hidden: true, position: 0 },
      { key: 'swingInspectorHotkey', name: 'Swing inspector', description: 'Hotkey to open the Swing inspector, if available.', type: 'keybind', default: '', hidden: true, position: 1 },
      { key: 'notification', name: 'Notification', description: '', type: 'notification', default: true, position: 2 },
    ],
  },
};
