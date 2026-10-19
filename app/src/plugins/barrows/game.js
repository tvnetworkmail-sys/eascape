'use strict';
// Barrows Brothers, sidebar side: sends the settings to the page side (page.js), which hands
// them to the client; the client draws everything itself.
const descriptor = require('./descriptor');

module.exports = function barrows(ctx) {
  function send(enabled) {
    const config = {};
    for (const it of descriptor.config.items) config[it.key] = ctx.config(it.key);
    ctx.sendToGame({ type: 'plugin-config', id: 'barrows', enabled, config });
  }

  return {
    start() {
      send(true);
    },
    stop() {
      send(false);
    },
    configChanged: () => send(true),
    gameReady: () => {
      send(true);
    },
  };
};
