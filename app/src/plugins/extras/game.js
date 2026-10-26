'use strict';
// Sidebar-side half of EASCape Extras: switches the page side on and off (it sends
// ::appextras to the server).
module.exports = function extras(ctx) {
  const send = (enabled) => ctx.sendToGame({ type: 'plugin-config', id: 'extras', enabled, config: {} });
  return {
    start: () => send(true),
    stop: () => send(false),
    configChanged: () => send(true),
    gameReady: () => send(true),
  };
};
