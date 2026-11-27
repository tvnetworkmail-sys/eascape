'use strict';
// RuneLite's Login Screen plugin (net.runelite.client.plugins.loginscreen), cloned 1:1. Era-trim: the Background
// option has Off (the 2007 title screen with our 2007RS logo) and Custom (login.png in the app's data folder, as
// RuneLite's RUNELITE_DIR/login.png); OSRS's login screen art (Normal .. Yama, Random) is later than 2007.
// 2007RS section: the user's own features from before the clone, kept by request (do not remove in a review): tick
// boxes on the 2007 login box to remember the username and password and to hide the username. The username is kept
// in settings like RuneLite does (its own key, so it never fights Sync username's); the password is only stored
// encrypted with your Windows account (never in the settings files: main/secrets.js, login-password.bin).
module.exports = {
  id: 'loginscreen',
  name: 'Login Screen',
  description: 'Provides various enhancements for login screen',
  tags: [],
  enabledByDefault: true,
  game: './loginscreen/game.js',
  page: './loginscreen/page.js',
  config: {
    group: 'loginscreen',
    sections: [{ key: 'eascape2007', name: '2006RS-2', description: 'Remember your username and password, and hide your username on the login screen', position: 10 }],
    items: [
      { key: 'syncusername', method: 'syncUsername', name: 'Sync username', description: 'Syncs the username that is currently remembered between computers.', type: 'boolean', default: true, position: 0 },
      { key: 'pasteenabled', method: 'pasteEnabled', name: 'Ctrl-V paste', description: 'Enables Ctrl-V pasting on the login screen.', type: 'boolean', default: false, position: 1 },
      { key: 'username', name: '', description: '', type: 'string', default: '', hidden: true, position: 2 },
      { key: 'loginScreen', name: 'Background', description: 'Change the login screen background to use an image from the past, or a custom one.', type: 'enum', default: 'OFF', options: [{ value: 'OFF', label: 'Off' }, { value: 'CUSTOM', label: 'Custom' }], position: 3 },
      { key: 'showLoginFire', name: 'Display fire', description: 'Whether the flames above the braziers on the login sceen should be drawn.', type: 'boolean', default: true, position: 4 },
      // 2007RS (the user's own, kept by request)
      { key: 'rememberUsername', name: 'Remember username', description: 'Fill in your username on the login screen', type: 'boolean', default: false, position: 5, section: 'eascape2007' },
      { key: 'rememberPassword', name: 'Remember password', description: 'Fill in your password too. It is stored encrypted with your Windows account and never in the settings files, but anyone who can use your Windows account can log in as you. Don\'t use this on a shared computer. Unticking it deletes the stored password.', type: 'boolean', default: false, position: 6, section: 'eascape2007' },
      { key: 'hideUsername', name: 'Hide username', description: 'Show your username as asterisks on the login screen (for streaming and screenshots)', type: 'boolean', default: false, position: 7, section: 'eascape2007' },
      { key: 'showOnLoginScreen', name: 'Show tick boxes on login screen', description: 'Show the three tick boxes under the Login and Cancel buttons', type: 'boolean', default: true, position: 8, section: 'eascape2007' },
      { key: 'rememberedUsername', name: '', description: '', type: 'string', default: '', hidden: true, position: 9, section: 'eascape2007' },
    ],
  },
};
