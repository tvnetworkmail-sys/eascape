'use strict';
// Sidebar-side half of NPC Indicators: sends the settings to the page side and saves the
// name list when you Tag-All / Un-tag-All in game.
const descriptor = require('./descriptor');

module.exports = function npcIndicators(ctx) {
  let off = null;

  function send(enabled) {
    const config = {};
    for (const it of descriptor.config.items) config[it.key] = ctx.config(it.key);
    ctx.sendToGame({ type: 'plugin-config', id: 'npcindicators', enabled, config });
  }

  return {
    start() {
      off = ctx.onRuntime((type, data) => {
        if (type === 'npcindicators-list') ctx.setState('npcToHighlight', String(data || ''));
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
