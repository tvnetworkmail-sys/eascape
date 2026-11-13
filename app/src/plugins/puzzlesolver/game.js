'use strict';
// Puzzle Solver, sidebar side: sends the settings to the page side, which reads the puzzle and
// solves it.
const descriptor = require('./descriptor');

module.exports = function puzzleSolver(ctx) {
  function send(enabled) {
    const config = {};
    for (const it of descriptor.config.items) {
      const v = ctx.config(it.key);
      config[it.key] = v === undefined ? it.default : v;
    }
    ctx.sendToGame({ type: 'plugin-config', id: 'puzzlesolver', enabled, config });
  }
  return {
    start: () => send(true),
    stop: () => send(false),
    configChanged: () => send(true),
    gameReady: () => send(true),
  };
};

