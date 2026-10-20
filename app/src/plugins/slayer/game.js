'use strict';
// Slayer, sidebar side: sends the settings and the task table (tasks.json, built from the
// server's own data by tools/slayer/tasks.py) to the page side, which does the rest.
const descriptor = require('./descriptor');
const tasks = require('./tasks.json');

module.exports = function slayer(ctx) {
  function send(enabled) {
    const config = {};
    for (const it of descriptor.config.items) {
      const v = ctx.config(it.key);
      config[it.key] = v === undefined ? it.default : v;
    }
    if (enabled) config.tasks = tasks;
    ctx.sendToGame({ type: 'plugin-config', id: 'slayer', enabled, config });
  }
  return {
    start: () => send(true),
    stop: () => send(false),
    configChanged: () => send(true),
    gameReady: () => send(true),
  };
};
