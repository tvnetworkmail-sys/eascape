'use strict';
// Sidebar-side half of Dialogue Keys: sends the settings to the page side.
const descriptor = require('./descriptor');

module.exports = function dialogueKeys(ctx) {
  function send(enabled) {
    const config = {};
    for (const it of descriptor.config.items) config[it.key] = ctx.config(it.key);
    ctx.sendToGame({ type: 'plugin-config', id: 'dialoguekeys', enabled, config });
  }
  return {
    start: () => send(true),
    stop: () => send(false),
    configChanged: () => send(true),
    gameReady: () => send(true),
  };
};
