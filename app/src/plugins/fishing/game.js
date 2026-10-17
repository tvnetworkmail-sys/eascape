'use strict';
// Fishing, sidebar side: sends the settings and the fishing spot table (tools/skilling/fishing.py).
const descriptor = require('./descriptor');
const spots = require('./fishing.json');

module.exports = function fishing(ctx) {
  function send(enabled) {
    const config = { spots };
    for (const it of descriptor.config.items) config[it.key] = ctx.config(it.key);
    ctx.sendToGame({ type: 'plugin-config', id: 'fishing', enabled, config });
  }
  return {
    start: () => send(true),
    stop: () => send(false),
    configChanged: () => send(true),
    gameReady: () => send(true),
  };
};
