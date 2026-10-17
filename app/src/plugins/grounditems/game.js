'use strict';
// Sidebar-side half of Ground Items: sends the settings to the page side (page.js), which
// draws the overlay and changes the menu, and saves list changes made in game (Alt-click).
const descriptor = require('./descriptor');

module.exports = function groundItems(ctx) {
  let off = null;

  function send(enabled) {
    const config = {};
    for (const it of descriptor.config.items) config[it.key] = ctx.config(it.key);
    ctx.sendToGame({ type: 'plugin-config', id: 'grounditems', enabled, config });
  }

  return {
    start() {
      off = ctx.onRuntime((type, data) => {
        if (type === 'grounditems-lists' && data) {
          ctx.setState('hiddenItems', String(data.hiddenItems || ''));
          ctx.setState('highlightedItems', String(data.highlightedItems || ''));
        }
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
