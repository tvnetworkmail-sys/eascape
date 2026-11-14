'use strict';
// Logout Notifier (ours; it was RuneLite's Idle Notifier, cut down to the idle logout at the
// owner's request, 14 Nov 2026). At the time you set before the game logs you out for being
// idle, it dings and flashes the game screen (until you move the mouse or press a key), and
// shows a desktop notification when 2006RS isn't in front. The id stays 'idlenotifier' so
// settings carry over.
module.exports = {
  id: 'idlenotifier',
  name: 'Logout Notifier',
  description: 'Ding and flash the screen before the game logs you out for being idle',
  tags: ['idle', 'logout', 'afk', 'notify', 'notification', 'alert', 'ding', 'flash'],
  enabledByDefault: true,
  game: './idlenotifier/game.js',
  config: {
    group: 'idlenotifier',
    sections: [],
    items: [
      { key: 'logoutWarning', name: 'Seconds before logout', description: 'How many seconds before the 90 second idle logout to ding and flash the screen (in combat the game waits until the fight is over)', type: 'int', default: 10, min: 1, max: 85, position: 0 },
    ],
  },
};
