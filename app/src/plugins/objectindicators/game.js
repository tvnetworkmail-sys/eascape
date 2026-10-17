'use strict';
// Object Markers, sidebar side: sends the settings and the marked objects to the page side and
// saves the list when you mark or unmark an object in the game.
const descriptor = require('./descriptor');

module.exports = function objectIndicators(ctx) {
  let off = null;
  function send(enabled) {
    const config = {};
    for (const it of descriptor.config.items) config[it.key] = ctx.config(it.key);
    config.objects = ctx.state("objects", []);
    ctx.sendToGame({ type: 'plugin-config', id: 'objectindicators', enabled, config });
  }
  return {
    start() {
      off = ctx.onRuntime((type, data) => {
        if (type === 'objectindicators-objects' && Array.isArray(data)) ctx.setState("objects", data);
      });
      send(true);
    },
    stop() {
      if (off) off();
      send(false);
    },
    configChanged: () => send(true),
    gameReady: () => send(true),
  };
};
