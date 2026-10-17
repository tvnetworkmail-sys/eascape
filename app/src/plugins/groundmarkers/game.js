'use strict';
// Ground Markers, sidebar side: sends the settings and the marked tiles to the page side and
// saves the list when you mark or unmark a tile in the game.
const descriptor = require('./descriptor');

module.exports = function groundMarkers(ctx) {
  let off = null;
  function send(enabled) {
    const config = {};
    for (const it of descriptor.config.items) config[it.key] = ctx.config(it.key);
    config.points = ctx.state('points', []);
    ctx.sendToGame({ type: 'plugin-config', id: 'groundmarkers', enabled, config });
  }
  return {
    start() {
      off = ctx.onRuntime((type, data) => {
        if (type === 'groundmarkers-points' && Array.isArray(data)) ctx.setState('points', data);
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
