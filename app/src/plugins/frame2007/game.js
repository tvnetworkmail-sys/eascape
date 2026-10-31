'use strict';
// 2007 interface, sidebar side: tells the page side it's on or off.
module.exports = function frame2007(ctx) {
  const send = (enabled) => ctx.sendToGame({ type: 'plugin-config', id: 'frame2007', enabled, config: {} });
  return {
    start: () => send(true),
    stop: () => send(false),
    configChanged: () => send(true),
    gameReady: () => send(true),
  };
};
