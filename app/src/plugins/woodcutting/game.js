'use strict';
// Woodcutting, sidebar side: sends the settings and the respawn table (built from Lost City's
// files by tools/skilling/build.py) to the page side.
const descriptor = require('./descriptor');
const table = require('./trees.json');

module.exports = function woodcutting(ctx) {
  let sent = false;
  function send(enabled) {
    const config = {};
    for (const it of descriptor.config.items) config[it.key] = ctx.config(it.key);
    if (enabled && !sent) {
      config.table = table;
      sent = true;
    }
    ctx.sendToGame({ type: 'plugin-config', id: 'woodcutting', enabled, config });
  }
  return {
    start() {
      sent = false;
      send(true);
    },
    stop: () => send(false),
    configChanged: () => send(true),
    gameReady: () => {
      sent = false;
      send(true);
    },
  };
};
