'use strict';
// Developer Tools, game side: asks the runtime for the NPC and player lists (2.2) while the
// plugin is on, so they aren't collected when nobody is looking.
module.exports = function devTools(ctx) {
  return {
    start() { ctx.sendToGame({ type: 'watch-entities', on: true }); },
    stop() { ctx.sendToGame({ type: 'watch-entities', on: false }); },
    gameReady() { ctx.sendToGame({ type: 'watch-entities', on: true }); },
  };
};
