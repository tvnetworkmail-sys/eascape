'use strict';
// Cooking, sidebar side: sends the settings and the message tables (tools/skilling/cooking.py).
const descriptor = require('./descriptor');
const messages = require('./cooking.json');

module.exports = function cooking(ctx) {
  function send(enabled) {
    const config = { messages };
    for (const it of descriptor.config.items) config[it.key] = ctx.config(it.key);
    ctx.sendToGame({ type: 'plugin-config', id: 'cooking', enabled, config });
  }
  return {
    start: () => send(true),
    stop: () => send(false),
    configChanged: () => send(true),
    gameReady: () => send(true),
  };
};
