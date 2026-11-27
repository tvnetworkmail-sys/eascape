'use strict';
// Client-wide settings, shown at the top of the plugin list like RuneLite's own "RuneLite"
// entry. It has no on/off switch.
module.exports = {
  id: 'lostlite',
  name: '2006RS-2',
  description: 'Client settings for the window, sidebar and game area',
  tags: ['client', 'window', 'sidebar', 'settings', 'size'],
  alwaysOn: true,
  config: {
    group: 'lostlite',
    sections: [
      { key: 'window', name: 'Window Settings', position: 0 },
      { key: 'game', name: 'Game Area', position: 1 },
      { key: 'notifications', name: 'Notifications', position: 2 },
    ],
    items: [
      { key: 'rememberWindow', name: 'Remember window size and position', description: 'Reopen the window where you left it', type: 'boolean', default: true, section: 'window', position: 0 },
      { key: 'alwaysOnTop', name: 'Always on top', description: 'Keep the 2006RS-2 window above other windows', type: 'boolean', default: false, section: 'window', position: 1 },
      { key: 'confirmClose', name: 'Confirm close when logged in', description: 'Ask before closing the window while you are logged in', type: 'boolean', default: true, section: 'window', position: 2 },
      { key: 'sidebarToggleKey', name: 'Sidebar toggle key', description: 'Key that opens and closes the sidebar', type: 'hotkey', default: 'Ctrl+F11', section: 'window', position: 3 },
      { key: 'hardwareAcceleration', name: 'Hardware acceleration', description: 'Use the graphics card to draw. Turn off if the game screen stays black (needs a restart of 2006RS-2).', type: 'boolean', default: true, section: 'window', position: 4 },
      { key: 'gameSize', name: 'Game size', description: 'Fixed keeps the original 765 x 503 game. Fit to window scales it up to fill the space, keeping its shape (the HD view stays sharp at any size).', type: 'enum', default: 'fixed', options: [{ value: 'fixed', label: 'Fixed (765 x 503)' }, { value: 'fit', label: 'Fit to window' }], section: 'game', position: 0 },
      { key: 'pixelated', name: 'Sharp pixels when scaled', description: 'Fit to window with hard pixel edges (in whole steps, 2x, 3x ..., when one nearly fills the window); off smooths the scaled game', type: 'boolean', default: true, section: 'game', position: 1 },
      { key: 'renderer', name: 'Renderer', description: 'HD draws the world with the graphics card (lighting, fog, smooth ground); SD is the original software renderer. "As the login screen" keeps what you chose with the HD button there. A change while logged in takes effect when you next see the login screen.', type: 'enum', default: 'client', options: [{ value: 'client', label: 'As the login screen' }, { value: 'sd', label: 'SD (original)' }, { value: 'hd', label: 'HD' }], section: 'game', position: 2 },
      { key: 'showFps', name: 'Show FPS', description: 'Show the frame rate in the corner of the game view', type: 'boolean', default: false, section: 'game', position: 3 },
      { key: 'hideWebsite', name: 'Game only', description: 'Show only the game, centred on black', type: 'boolean', default: true, section: 'game', position: 4 },
      { key: 'escCloses', name: 'Esc closes interfaces', description: 'Press Esc to close the bank, shops and other windows, like clicking their Close button', type: 'boolean', default: true, section: 'game', position: 5 },
      { key: 'showChristmasSnow', name: 'Show Christmas snow', description: 'While the server has Christmas mode on (in December), show falling snow and snowy ground outdoors. Off hides it for you only', type: 'boolean', default: true, section: 'game', position: 6 },
      { key: 'notifications', name: 'Enable notifications', description: 'Let plugins (like the Idle Notifier) show desktop notifications', type: 'boolean', default: true, section: 'notifications', position: 0 },
      { key: 'notifyWhenFocused', name: 'Notify when focused', description: 'Also show notifications while the 2006RS-2 window is in front', type: 'boolean', default: false, section: 'notifications', position: 1 },
      { key: 'notificationSound', name: 'Notification sound', description: 'Play the system sound with each notification', type: 'boolean', default: true, section: 'notifications', position: 2 },
      { key: 'gameMessageNotification', name: 'Game message notifications', description: 'Also put each notification in the chat box, so you see it while playing in the window', type: 'boolean', default: true, section: 'notifications', position: 4 },
      { key: 'flash', name: 'Flash', description: 'Flash the game screen with each notification: once, or until you move the mouse or press a key in the game', type: 'enum', default: 'until', options: [{ value: 'off', label: 'Off' }, { value: 'once', label: 'Flash once' }, { value: 'until', label: 'Until cancelled' }], section: 'notifications', position: 5 },
      { key: 'flashColour', name: 'Flash colour', description: 'Colour of the screen flash', type: 'color', default: '#FF0000', section: 'notifications', position: 6 },
      { key: 'flashOpacity', name: 'Flash opacity', description: 'How strong the screen flash is, in percent', type: 'int', default: 27, min: 5, max: 100, section: 'notifications', position: 7 },
      { key: 'flashTaskbar', name: 'Flash taskbar', description: 'Flash 2006RS-2 on the taskbar until you come back to it', type: 'boolean', default: true, section: 'notifications', position: 3 },
    ],
  },
};
