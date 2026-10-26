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

// EASCape: typing while the sidebar or title bar has the focus (after clicking a button there)
// goes to the game, which takes the focus back; text fields here keep their keys. Keys with
// Ctrl, Alt or Meta stay here (the app's own hotkeys).
window.addEventListener('keydown', (e) => {
  const t = e.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  const named = { Enter: 'Enter', Backspace: 'Backspace', ' ': 'Space', Escape: 'Escape', Tab: 'Tab',
    ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right' };
  const key = e.key.length === 1 && e.key !== ' ' ? e.key : named[e.key];
  if (!key && !/^F\d+$/.test(e.key)) return;
  e.preventDefault();
  ipcRenderer.send('type-to-game', key || e.key, e.shiftKey);
}, true);
