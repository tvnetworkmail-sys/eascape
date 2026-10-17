// Bridge for the title bar and sidebar page. Only these calls are exposed to it.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lostlite', {
  onEvent: (fn) => ipcRenderer.on('event', (_e, ev) => fn(ev)),
  getState: () => ipcRenderer.invoke('get-state'),
  window: (action) => ipcRenderer.send('window', action),
  setPanel: (id) => ipcRenderer.send('set-panel', id),
  hop: (worldId) => ipcRenderer.invoke('hop', worldId),
  reloadGame: () => ipcRenderer.send('reload-game'),
  refreshWorlds: () => ipcRenderer.send('refresh-worlds'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  openLogs: () => ipcRenderer.send('open-logs'),
  log: (msg) => ipcRenderer.send('ui-log', msg),
  setConfig: (group, key, value) => ipcRenderer.send('set-config', group, key, value),
  unsetConfig: (group, key) => ipcRenderer.send('unset-config', group, key),
  setPluginEnabled: (id, on) => ipcRenderer.send('set-plugin-enabled', id, on),
  profile: (action, a, b) => ipcRenderer.invoke('profile', action, a, b),
  installUpdate: () => ipcRenderer.send('install-update'),
});
