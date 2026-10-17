'use strict';
// Agility, sidebar side: sends the settings and the course / shortcut tables
// (tools/skilling/agility.py, from Lost City's 274 and 377 files).
const descriptor = require('./descriptor');
const data = require('./agility.json');

module.exports = function agility(ctx) {
  let sent = false;
  function send(enabled) {
    const config = {};
    for (const it of descriptor.config.items) config[it.key] = ctx.config(it.key);
    if (enabled && !sent) {
      config.data = data;
      sent = true;
    }
    ctx.sendToGame({ type: 'plugin-config', id: 'agility', enabled, config });
  }
  return {
    start() {
      sent = false;
      send(true);
    },
    stop: () => send(false),
    configChanged: () => send(true),
    gameReady() {
      sent = false;
      send(true);
    },
  };
};
