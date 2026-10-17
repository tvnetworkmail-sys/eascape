'use strict';
// XP Drops, sidebar side: sends the settings and the stat icons to the page side, which
// draws the drops into the game view (page.js).
const descriptor = require('./descriptor');
const icons = require('./icons.json');

module.exports = function xpDrops(ctx) {
  let sentIcons = false;

  function send(enabled) {
    const config = {};
    for (const it of descriptor.config.items) config[it.key] = ctx.config(it.key);
    if (enabled && !sentIcons) {
      config.icons = icons;
      sentIcons = true;
    }
    ctx.sendToGame({ type: 'plugin-config', id: 'xpdrops', enabled, config });
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
      sentIcons = false; // a new game page needs them again
      send(true);
    },
  };
};
