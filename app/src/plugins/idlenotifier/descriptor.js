'use strict';
// Port of RuneLite's Idle Notifier: a desktop notification when you stop skilling or
// fighting, when hitpoints or prayer run low, and before the game logs you out for being
// idle. Notifications follow LostLite > Notifications (only when the window isn't in front
// by default).
module.exports = {
  id: 'idlenotifier',
  name: 'Idle Notifier',
  description: 'Send a notification when going idle, or when hitpoints or prayer are low',
  tags: ['idle', 'notify', 'notification', 'alert', 'afk', 'logout', 'hitpoints', 'prayer', 'skilling', 'combat'],
  enabledByDefault: true,
  game: './idlenotifier/game.js',
  config: {
    group: 'idlenotifier',
    sections: [],
    items: [
      { key: 'animationIdle', name: 'Idle animation notifications', description: 'Notify when you stop skilling (cutting, mining, fishing and so on)', type: 'boolean', default: true, position: 0 },
      { key: 'interactionIdle', name: 'Idle interaction notifications', description: 'Notify when you stop fighting', type: 'boolean', default: true, position: 1 },
      { key: 'logoutIdle', name: 'Logout notifications', description: 'Notify before the game logs you out for not touching the mouse or keyboard (after 90 seconds; in combat, once the fight is over)', type: 'boolean', default: true, position: 2 },
      { key: 'logoutWarning', name: 'Logout warning', description: 'How many seconds before the 90 second idle logout to warn you', type: 'int', default: 20, min: 1, max: 85, position: 3 },
      { key: 'timeout', name: 'Idle notification delay', description: 'How long to wait (in milliseconds) before saying you are idle', type: 'int', default: 5000, min: 0, max: 60000, position: 4 },
      { key: 'hitpoints', name: 'Hitpoints threshold', description: 'Notify when your hitpoints drop to this or below (0 = off)', type: 'int', default: 0, min: 0, max: 99, position: 5 },
      { key: 'prayer', name: 'Prayer threshold', description: 'Notify when your prayer points drop to this or below (0 = off)', type: 'int', default: 0, min: 0, max: 99, position: 6 },
      { key: 'lowEnergy', name: 'Low energy threshold', description: 'Notify when your run energy drops to this percentage or below (100 = off)', type: 'int', default: 100, min: 0, max: 100, position: 7 },
      { key: 'specEnergy', name: 'Special attack energy', description: 'Notify when your special attack energy is back to this percentage (0 = off)', type: 'int', default: 0, min: 0, max: 100, position: 8 },
    ],
  },
};
