'use strict';
// Login Screen: tick boxes on the 2004 login box to remember the username and password and
// to hide the username, in the style of the modern client's login screen. The same three
// settings appear here. The username is kept in settings like RuneLite does; the password
// is only stored encrypted with your Windows account (never in the settings files).
module.exports = {
  id: 'loginscreen',
  name: 'Login Screen',
  description: 'Remember your username and password, and hide your username on the login screen',
  tags: ['login', 'username', 'password', 'remember', 'hide', 'stream'],
  enabledByDefault: true,
  game: './loginscreen/game.js',
  config: {
    group: 'loginscreen',
    sections: [],
    items: [
      { key: 'rememberUsername', name: 'Remember username', description: 'Fill in your username on the login screen', type: 'boolean', default: false, position: 0 },
      { key: 'rememberPassword', name: 'Remember password', description: 'Fill in your password too. It is stored encrypted with your Windows account and never in the settings files, but anyone who can use your Windows account can log in as you. Don\'t use this on a shared computer. Unticking it deletes the stored password.', type: 'boolean', default: false, position: 1 },
      { key: 'hideUsername', name: 'Hide username', description: 'Show your username as asterisks on the login screen (for streaming and screenshots)', type: 'boolean', default: false, position: 2 },
      { key: 'showOnLoginScreen', name: 'Show tick boxes on login screen', description: 'Show the three tick boxes under the Login and Cancel buttons', type: 'boolean', default: true, position: 3 },
    ],
  },
};
