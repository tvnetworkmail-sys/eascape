'use strict';
// Timers & Buffs, sidebar side: sends the settings and the spell icons to the page side.
const descriptor = require('./descriptor');
const icons = require('./icons.json');

module.exports = function timersAndBuffs(ctx) {
  let sentIcons = false;

  function send(enabled) {
    const config = {};
    for (const it of descriptor.config.items) config[it.key] = ctx.config(it.key);
    if (enabled && !sentIcons) {
      config.icons = icons;
      sentIcons = true;
    }
    ctx.sendToGame({ type: 'plugin-config', id: 'timersandbuffs', enabled, config });
  }

  return {
    start() {
      sentIcons = false;
      send(true);
    },
    stop() {
      send(false);
    },
    configChanged: () => send(true),
    gameReady: () => {
      sentIcons = false;
      send(true);
    },
  };
};
