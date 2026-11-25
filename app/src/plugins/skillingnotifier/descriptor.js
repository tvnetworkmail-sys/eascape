'use strict';
// Skilling Notifier (ours, at the owner's request, 25 Nov 2026): when you stop woodcutting or
// fishing, the same alert as the Logout Notifier: a ding, the game screen flashing until you
// move the mouse or press a key, and a desktop notification when 2006RS isn't in front. It goes
// by the server (varp 945, moved on with every woodcutting or fishing op), not by your
// character's animation, which the old Idle Notifier guessed from and got wrong.
module.exports = {
  id: 'skillingnotifier',
  name: 'Skilling Notifier',
  description: 'Ding and flash the screen when you stop woodcutting or fishing',
  tags: ['idle', 'skilling', 'woodcutting', 'fishing', 'afk', 'notify', 'notification', 'alert', 'ding', 'flash'],
  enabledByDefault: true,
  game: './skillingnotifier/game.js',
  config: {
    group: 'skillingnotifier',
    sections: [],
    items: [
      { key: 'woodcutting', name: 'Woodcutting', description: 'Alert when you stop cutting (the tree falls, your inventory is full, or anything else stops you)', type: 'boolean', default: true, position: 0 },
      { key: 'fishing', name: 'Fishing', description: 'Alert when you stop fishing (the spot moves, your inventory is full, or anything else stops you)', type: 'boolean', default: true, position: 1 },
      { key: 'raise', name: 'Bring the window back up', description: 'When it alerts you, bring 2006RS back up if it is minimised or behind other windows', type: 'boolean', default: true, position: 2 },
      { key: 'delay', name: 'Seconds to wait', description: 'How long after you stop to alert you', type: 'int', default: 5, min: 3, max: 60, position: 3 },
    ],
  },
};
